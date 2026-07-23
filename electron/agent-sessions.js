import fs from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const terminalStatuses = new Set(["completed", "failed", "canceled", "interrupted", "context_limit", "max_rounds"]);
const maxSessions = 200;
const maxRuns = 40;
const maxReportChars = 30000;

const cleanText = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const clone = (value) => JSON.parse(JSON.stringify(value));

const capTranscript = (entries) => {
  const values = Array.isArray(entries) ? entries : [];
  if (values.length <= 1000) {
    return values;
  }
  const prompt = values.find((entry) => entry?.type === "prompt");
  const tail = values.slice(prompt ? -999 : -1000);
  return prompt && !tail.some((entry) => entry.id === prompt.id) ? [prompt, ...tail] : tail;
};

const publicAgent = (session) => {
  const run = session.runs.find((entry) => entry.id === session.currentRunId) || session.runs[session.runs.length - 1] || null;
  return {
    kind: "agent",
    id: session.id,
    agentId: session.id,
    runId: run?.id || "",
    chatId: session.chatId,
    turnId: run?.turnId || "",
    name: session.name,
    description: session.description,
    category: "Agent",
    model: run?.model || session.model,
    effort: run?.effort || session.effort,
    profile: session.profile,
    status: run?.status || "completed",
    startedAt: run?.startedAt || session.createdAt,
    finishedAt: run?.finishedAt || null,
    durationMs: Number(run?.durationMs) || 0,
    stopReason: run?.stopReason || "",
    viewTranscript: true,
  };
};

const storedSession = (session) => ({
  id: session.id,
  chatId: session.chatId,
  projectPath: session.projectPath,
  name: session.name,
  description: session.description,
  model: session.model,
  effort: session.effort,
  profile: session.profile,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  currentRunId: session.currentRunId,
  initialPrompt: session.initialPrompt,
  summary: session.summary,
  context: session.context,
  hidden: Boolean(session.hidden),
  runs: session.runs.slice(-maxRuns),
});

export const createAgentSessionManager = ({ dataFile, emit = () => {}, emitTranscript = () => {} }) => {
  const sessions = new Map();
  const controllers = new Map();
  const transcriptTimers = new Map();
  let writeChain = Promise.resolve();
  let persistenceGeneration = 0;
  let persistTimer = null;

  const serialize = () => [...sessions.values()]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, maxSessions)
    .map(storedSession);

  const persist = () => {
    const value = serialize();
    const generation = persistenceGeneration;
    const run = writeChain.then(async () => {
      if (generation !== persistenceGeneration) {
        return;
      }
      await fs.mkdir(path.dirname(dataFile), { recursive: true });
      const temporary = `${dataFile}.${Date.now()}-${Math.random().toString(16).slice(2, 8)}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
        if (generation !== persistenceGeneration) {
          await fs.rm(temporary, { force: true }).catch(() => {});
          return;
        }
        await fs.rename(temporary, dataFile);
      } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => {});
        throw error;
      }
    });
    writeChain = run.catch(() => {});
    return run;
  };

  const persistSoon = () => {
    if (persistTimer) {
      return;
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persist().catch(() => {});
    }, 300);
    persistTimer.unref?.();
  };

  const persistSync = () => {
    mkdirSync(path.dirname(dataFile), { recursive: true });
    writeFileSync(dataFile, JSON.stringify(serialize(), null, 2), "utf8");
  };

  const notify = (type, session) => {
    try {
      emit({ type, task: publicAgent(session) });
    } catch {}
  };

  const notifyTranscript = (agentId, runId) => {
    const key = `${agentId}:${runId}`;
    if (transcriptTimers.has(key)) {
      return;
    }
    const timer = setTimeout(() => {
      transcriptTimers.delete(key);
      try {
        emitTranscript({ type: "transcript", agentId, runId });
      } catch {}
    }, 50);
    timer.unref?.();
    transcriptTimers.set(key, timer);
  };

  const findRun = (agentId, runId) => {
    const session = sessions.get(String(agentId || ""));
    if (!session) {
      return { session: null, run: null };
    }
    const run = session.runs.find((entry) => entry.id === String(runId || ""));
    return { session, run: run || null };
  };

  const initialize = async () => {
    let stored = [];
    try {
      stored = JSON.parse(await fs.readFile(dataFile, "utf8"));
    } catch {}
    const now = new Date().toISOString();
    let changed = false;
    for (const entry of Array.isArray(stored) ? stored.slice(0, maxSessions) : []) {
      if (!entry?.id || !entry?.chatId) {
        continue;
      }
      const runs = (Array.isArray(entry.runs) ? entry.runs : []).slice(-maxRuns).map((run) => {
        const next = {
          id: String(run.id || `agent_run_${randomUUID()}`),
          turnId: String(run.turnId || ""),
          prompt: String(run.prompt || ""),
          model: String(run.model || entry.model || ""),
          effort: String(run.effort || entry.effort || ""),
          status: terminalStatuses.has(run.status) ? run.status : "running",
          startedAt: String(run.startedAt || now),
          finishedAt: run.finishedAt ? String(run.finishedAt) : null,
          durationMs: Number(run.durationMs) || 0,
          stopReason: String(run.stopReason || ""),
          report: String(run.report || "").slice(0, maxReportChars),
          writtenFiles: Array.isArray(run.writtenFiles) ? run.writtenFiles.map(String).slice(0, 200) : [],
          transcript: capTranscript(run.transcript),
          notificationState: ["pending", "sending", "delivered"].includes(run.notificationState) ? run.notificationState : "delivered",
        };
        if (next.status === "running") {
          next.status = "interrupted";
          next.finishedAt = now;
          next.durationMs = Math.max(0, Date.now() - new Date(next.startedAt).getTime());
          next.stopReason = "app_closed";
          next.notificationState = "delivered";
          changed = true;
        } else if (next.notificationState === "sending") {
          next.notificationState = "pending";
          changed = true;
        }
        return next;
      });
      const session = {
        id: String(entry.id),
        chatId: String(entry.chatId),
        projectPath: String(entry.projectPath || ""),
        name: cleanText(entry.name, 120) || "Agent",
        description: cleanText(entry.description, 240),
        model: String(entry.model || ""),
        effort: String(entry.effort || ""),
        profile: entry.profile === "worker" ? "worker" : "explore",
        createdAt: String(entry.createdAt || now),
        updatedAt: String(entry.updatedAt || now),
        currentRunId: String(entry.currentRunId || runs[runs.length - 1]?.id || ""),
        initialPrompt: String(entry.initialPrompt || ""),
        summary: String(entry.summary || "").slice(0, 60000),
        context: Array.isArray(entry.context) ? entry.context : [],
        hidden: Boolean(entry.hidden),
        runs,
      };
      sessions.set(session.id, session);
    }
    if (changed) {
      await persist();
    }
  };

  const runningCount = () => [...sessions.values()].filter((session) => {
    const run = session.runs.find((entry) => entry.id === session.currentRunId);
    return run?.status === "running";
  }).length;

  const begin = async ({ agentId = "", chatId, turnId, projectPath, name, description, model, effort, profile, prompt }) => {
    if (runningCount() >= 4) {
      return { error: "At most 4 agents can run at once." };
    }
    const cleanPrompt = String(prompt || "").trim();
    if (!cleanPrompt) {
      return { error: "The agent prompt is required." };
    }
    let session;
    if (agentId) {
      session = sessions.get(String(agentId));
      if (!session || session.chatId !== String(chatId || "")) {
        return { error: "Agent context not found in this chat." };
      }
      const active = session.runs.find((entry) => entry.id === session.currentRunId);
      if (active?.status === "running") {
        return { error: "This agent is already running." };
      }
      if (projectPath && session.projectPath !== String(projectPath)) {
        return { error: "This agent belongs to a different project." };
      }
      if (model) {
        session.model = String(model);
      }
      if (effort) {
        session.effort = String(effort);
      }
      session.hidden = false;
    } else {
      const cleanName = cleanText(name, 120);
      if (!cleanName || !chatId || !projectPath || !model) {
        return { error: "name, chatId, projectPath and model are required." };
      }
      const id = `agent_${randomUUID()}`;
      const now = new Date().toISOString();
      session = {
        id,
        chatId: String(chatId),
        projectPath: String(projectPath),
        name: cleanName,
        description: cleanText(description, 240),
        model: String(model),
        effort: String(effort || ""),
        profile: profile === "worker" ? "worker" : "explore",
        createdAt: now,
        updatedAt: now,
        currentRunId: "",
        initialPrompt: cleanPrompt,
        summary: "",
        context: [],
        hidden: false,
        runs: [],
      };
      sessions.set(id, session);
    }
    const now = new Date().toISOString();
    const run = {
      id: `agent_run_${randomUUID()}`,
      turnId: String(turnId || ""),
      prompt: cleanPrompt,
      model: session.model,
      effort: session.effort,
      status: "running",
      startedAt: now,
      finishedAt: null,
      durationMs: 0,
      stopReason: "",
      report: "",
      writtenFiles: [],
      transcript: [{ id: `entry_${randomUUID()}`, type: "prompt", text: cleanPrompt, at: now }],
      notificationState: "delivered",
    };
    session.runs.push(run);
    session.runs = session.runs.slice(-maxRuns);
    session.currentRunId = run.id;
    session.updatedAt = now;
    await persist();
    notify("started", session);
    notifyTranscript(session.id, run.id);
    return { session, run };
  };

  const attachController = (agentId, runId, controller) => {
    controllers.set(`${agentId}:${runId}`, controller);
  };

  const detachController = (agentId, runId) => {
    controllers.delete(`${agentId}:${runId}`);
  };

  const addEntry = (agentId, runId, entry) => {
    const found = findRun(agentId, runId);
    if (!found.run) {
      return "";
    }
    const value = {
      id: `entry_${randomUUID()}`,
      type: String(entry.type || "text"),
      at: new Date().toISOString(),
      ...entry,
    };
    found.run.transcript.push(value);
    found.run.transcript = capTranscript(found.run.transcript);
    found.session.updatedAt = value.at;
    persistSoon();
    notifyTranscript(agentId, runId);
    return value.id;
  };

  const updateEntry = (agentId, runId, entryId, patch) => {
    const found = findRun(agentId, runId);
    const entry = found.run?.transcript.find((item) => item.id === entryId);
    if (!entry) {
      return false;
    }
    Object.assign(entry, patch || {});
    found.session.updatedAt = new Date().toISOString();
    persistSoon();
    notifyTranscript(agentId, runId);
    return true;
  };

  const setProgress = (agentId, runId, parentId, text) => {
    const found = findRun(agentId, runId);
    if (!found.run) {
      return false;
    }
    let entry = found.run.transcript.find((item) => item.type === "progress" && item.parentId === parentId);
    if (!entry) {
      entry = {
        id: `entry_${randomUUID()}`,
        type: "progress",
        parentId,
        text: "",
        at: new Date().toISOString(),
      };
      found.run.transcript.push(entry);
      found.run.transcript = capTranscript(found.run.transcript);
    }
    entry.text = String(text || "");
    entry.at = new Date().toISOString();
    found.session.updatedAt = entry.at;
    persistSoon();
    notifyTranscript(agentId, runId);
    return true;
  };

  const appendText = (agentId, runId, entryId, delta) => {
    const found = findRun(agentId, runId);
    const entry = found.run?.transcript.find((item) => item.id === entryId);
    if (!entry) {
      return false;
    }
    entry.text = `${entry.text || ""}${String(delta || "")}`;
    found.session.updatedAt = new Date().toISOString();
    persistSoon();
    notifyTranscript(agentId, runId);
    return true;
  };

  const saveContext = (agentId, context, summary = null) => {
    const session = sessions.get(String(agentId || ""));
    if (!session) {
      return false;
    }
    session.context = Array.isArray(context) ? clone(context) : [];
    if (summary !== null) {
      session.summary = String(summary || "").slice(0, 60000);
    }
    session.updatedAt = new Date().toISOString();
    persistSoon();
    return true;
  };

  const finish = async (agentId, runId, { status, report = "", stopReason = "", writtenFiles = [] }) => {
    const found = findRun(agentId, runId);
    if (!found.run) {
      return null;
    }
    if (found.run.status === "running") {
      found.run.status = terminalStatuses.has(status) ? status : "completed";
      found.run.finishedAt = new Date().toISOString();
      found.run.durationMs = Math.max(0, Date.now() - new Date(found.run.startedAt).getTime());
      found.run.stopReason = String(stopReason || "");
      found.run.report = String(report || "").slice(0, maxReportChars);
      found.run.writtenFiles = [...new Set((writtenFiles || []).map(String))].slice(0, 200);
      found.run.notificationState = found.run.status === "canceled" || found.run.status === "interrupted" ? "delivered" : "pending";
    }
    found.session.updatedAt = new Date().toISOString();
    detachController(agentId, runId);
    await persist().catch(() => {});
    notify(found.run.status === "canceled" ? "canceled" : "finished", found.session);
    notifyTranscript(agentId, runId);
    return publicAgent(found.session);
  };

  const cancel = async (agentId) => {
    const session = sessions.get(String(agentId || ""));
    if (!session) {
      return { error: "Agent not found." };
    }
    const run = session.runs.find((entry) => entry.id === session.currentRunId);
    if (!run || run.status !== "running") {
      return publicAgent(session);
    }
    const controller = controllers.get(`${session.id}:${run.id}`);
    run.status = "canceled";
    run.finishedAt = new Date().toISOString();
    run.durationMs = Math.max(0, Date.now() - new Date(run.startedAt).getTime());
    run.stopReason = "user_canceled";
    run.notificationState = "delivered";
    session.updatedAt = run.finishedAt;
    controller?.abort();
    detachController(session.id, run.id);
    await persist().catch(() => {});
    notify("canceled", session);
    notifyTranscript(session.id, run.id);
    return publicAgent(session);
  };

  const list = (chatId) => [...sessions.values()]
    .filter((session) => !chatId || session.chatId === String(chatId))
    .filter((session) => !session.hidden)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map(publicAgent);

  const get = (agentId) => {
    const session = sessions.get(String(agentId || ""));
    return session ? clone(storedSession(session)) : null;
  };

  const getTranscript = (agentId, runId = "") => {
    const session = sessions.get(String(agentId || ""));
    if (!session) {
      return null;
    }
    const run = session.runs.find((entry) => entry.id === String(runId || session.currentRunId))
      || session.runs[session.runs.length - 1];
    if (!run) {
      return null;
    }
    return {
      agent: publicAgent(session),
      run: clone(run),
      runs: session.runs.map((entry) => ({
        id: entry.id,
        status: entry.status,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
        durationMs: entry.durationMs,
      })),
    };
  };

  const claimPending = async (chatId) => {
    const candidates = [];
    for (const session of sessions.values()) {
      if (session.chatId !== String(chatId || "")) {
        continue;
      }
      for (const run of session.runs) {
        if (run.notificationState === "pending") {
          candidates.push({ session, run });
        }
      }
    }
    candidates.sort((a, b) => String(a.run.finishedAt || "").localeCompare(String(b.run.finishedAt || "")));
    const found = candidates[0];
    if (!found) {
      return null;
    }
    found.run.notificationState = "sending";
    await persist();
    return {
      kind: "agent",
      id: found.run.id,
      agentId: found.session.id,
      runId: found.run.id,
      chatId: found.session.chatId,
      turnId: found.run.turnId,
      name: found.session.name,
      description: found.session.description,
      category: "Agent",
      model: found.run.model,
      effort: found.run.effort,
      profile: found.session.profile,
      status: found.run.status,
      startedAt: found.run.startedAt,
      finishedAt: found.run.finishedAt,
      durationMs: found.run.durationMs,
      stopReason: found.run.stopReason,
      report: found.run.report,
      writtenFiles: found.run.writtenFiles,
    };
  };

  const settleNotification = async (runId, delivered) => {
    for (const session of sessions.values()) {
      const run = session.runs.find((entry) => entry.id === String(runId || ""));
      if (!run || run.notificationState !== "sending") {
        continue;
      }
      run.notificationState = delivered ? "delivered" : "pending";
      session.updatedAt = new Date().toISOString();
      await persist();
      return true;
    }
    return false;
  };

  const clearFinished = async (chatId) => {
    let removed = 0;
    for (const session of sessions.values()) {
      if (session.chatId !== String(chatId || "")) {
        continue;
      }
      const run = session.runs.find((entry) => entry.id === session.currentRunId);
      if (run && run.status !== "running" && !session.hidden) {
        session.hidden = true;
        removed += 1;
      }
    }
    if (removed) {
      await persist().catch(() => {});
      emit({ type: "cleared", chatId: String(chatId || ""), kind: "agent" });
    }
    return { removed };
  };

  const deleteChat = async (chatId) => {
    const ids = [...sessions.values()].filter((session) => session.chatId === String(chatId || "")).map((session) => session.id);
    for (const id of ids) {
      await cancel(id);
      sessions.delete(id);
    }
    if (ids.length) {
      await persist().catch(() => {});
      emit({ type: "cleared", chatId: String(chatId || ""), kind: "agent" });
    }
    return { removed: ids.length };
  };

  const shutdown = () => {
    persistenceGeneration += 1;
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    for (const timer of transcriptTimers.values()) {
      clearTimeout(timer);
    }
    transcriptTimers.clear();
    const now = new Date().toISOString();
    for (const session of sessions.values()) {
      const run = session.runs.find((entry) => entry.id === session.currentRunId);
      if (!run || run.status !== "running") {
        continue;
      }
      controllers.get(`${session.id}:${run.id}`)?.abort();
      run.status = "interrupted";
      run.finishedAt = now;
      run.durationMs = Math.max(0, Date.now() - new Date(run.startedAt).getTime());
      run.stopReason = "app_closed";
      run.notificationState = "delivered";
      session.updatedAt = now;
    }
    controllers.clear();
    try {
      persistSync();
    } catch {}
  };

  return {
    initialize,
    begin,
    attachController,
    detachController,
    addEntry,
    updateEntry,
    setProgress,
    appendText,
    saveContext,
    finish,
    cancel,
    list,
    get,
    getTranscript,
    claimPending,
    settleNotification,
    clearFinished,
    deleteChat,
    shutdown,
  };
};
