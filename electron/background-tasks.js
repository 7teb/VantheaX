import fs from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const terminalStatuses = new Set(["completed", "failed", "canceled", "interrupted"]);
const maxStoredTasks = 500;
const maxTailBytes = 256 * 1024;

const stripAnsi = (text) => String(text || "")
  .replace(/\x1B\[[0-9;?]*[A-Za-z]/g, "")
  .replace(/\x1B[()][AB0-2]/g, "")
  .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, "")
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

const appendTail = (current, chunk) => {
  const buffer = Buffer.from(`${current || ""}${stripAnsi(chunk)}`, "utf8");
  if (buffer.length <= maxTailBytes) {
    return buffer.toString("utf8");
  }
  return buffer.subarray(buffer.length - maxTailBytes).toString("utf8");
};

const cleanText = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const publicTask = (task) => ({
  id: task.id,
  chatId: task.chatId,
  turnId: task.turnId,
  name: task.name,
  category: task.category,
  cwd: task.cwd,
  status: task.status,
  pid: task.pid,
  startedAt: task.startedAt,
  finishedAt: task.finishedAt,
  durationMs: task.durationMs,
  exitCode: task.exitCode,
  expectedMinutes: task.expectedMinutes,
});

const storedTask = (task) => ({
  ...publicTask(task),
  projectPath: task.projectPath,
  command: task.command,
  stdoutTail: task.stdoutTail,
  stderrTail: task.stderrTail,
  notificationState: task.notificationState,
});

const defaultKillTree = (pid) => {
  if (!pid) {
    return;
  }
  spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    windowsHide: true,
    shell: false,
  });
};

const defaultKillTreeSync = (pid) => {
  if (!pid) {
    return;
  }
  spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    windowsHide: true,
    shell: false,
    timeout: 5000,
  });
};

export const createBackgroundTaskManager = ({
  dataFile,
  resolveTarget,
  emit = () => {},
  spawnProcess = spawn,
  killTree = defaultKillTree,
  killTreeSync = defaultKillTreeSync,
}) => {
  const tasks = new Map();
  const children = new Map();
  let writeChain = Promise.resolve();
  let persistenceGeneration = 0;

  const serialize = () => [...tasks.values()]
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    .slice(0, maxStoredTasks)
    .map(storedTask);

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

  const persistSync = () => {
    mkdirSync(path.dirname(dataFile), { recursive: true });
    writeFileSync(dataFile, JSON.stringify(serialize(), null, 2), "utf8");
  };

  const notify = (type, task) => {
    try {
      emit({ type, task: publicTask(task) });
    } catch {}
  };

  const initialize = async () => {
    let stored = [];
    try {
      stored = JSON.parse(await fs.readFile(dataFile, "utf8"));
    } catch {}
    const now = new Date().toISOString();
    let changed = false;
    for (const entry of Array.isArray(stored) ? stored.slice(0, maxStoredTasks) : []) {
      if (!entry?.id || !entry?.chatId) {
        continue;
      }
      const task = {
        id: String(entry.id),
        chatId: String(entry.chatId),
        turnId: String(entry.turnId || ""),
        name: cleanText(entry.name, 120) || "Background task",
        category: cleanText(entry.category, 40) || "Process",
        projectPath: String(entry.projectPath || ""),
        cwd: String(entry.cwd || "."),
        command: String(entry.command || ""),
        status: terminalStatuses.has(entry.status) ? entry.status : "running",
        pid: Number(entry.pid) || null,
        startedAt: String(entry.startedAt || now),
        finishedAt: entry.finishedAt ? String(entry.finishedAt) : null,
        durationMs: Number(entry.durationMs) || 0,
        exitCode: Number.isFinite(entry.exitCode) ? Number(entry.exitCode) : null,
        expectedMinutes: Math.max(0, Number(entry.expectedMinutes) || 0),
        stdoutTail: String(entry.stdoutTail || ""),
        stderrTail: String(entry.stderrTail || ""),
        notificationState: ["pending", "sending", "delivered"].includes(entry.notificationState) ? entry.notificationState : "delivered",
      };
      if (task.status === "running") {
        task.status = "interrupted";
        task.pid = null;
        task.finishedAt = now;
        task.durationMs = Math.max(0, Date.now() - new Date(task.startedAt).getTime());
        task.notificationState = "delivered";
        changed = true;
      } else if (task.notificationState === "sending") {
        task.notificationState = "pending";
        changed = true;
      }
      tasks.set(task.id, task);
    }
    if (changed) {
      await persist();
    }
  };

  const finish = async (id, exitCode, errorText = "") => {
    const task = tasks.get(id);
    if (!task || task.status !== "running") {
      return;
    }
    task.status = exitCode === 0 && !errorText ? "completed" : "failed";
    task.pid = null;
    task.finishedAt = new Date().toISOString();
    task.durationMs = Math.max(0, Date.now() - new Date(task.startedAt).getTime());
    task.exitCode = Number.isFinite(exitCode) ? Number(exitCode) : null;
    task.stderrTail = appendTail(task.stderrTail, errorText);
    task.notificationState = "pending";
    children.delete(id);
    await persist().catch(() => {});
    notify("finished", task);
  };

  const start = async ({ projectPath, chatId, turnId, name, category, command, cwd = ".", expectedMinutes = 0 }) => {
    if ([...tasks.values()].filter((task) => task.status === "running").length >= 4) {
      return { error: "At most 4 background tasks can run at once." };
    }
    const cleanName = cleanText(name, 120);
    const cleanCategory = cleanText(category, 40);
    const cleanCommand = String(command || "").trim();
    if (!cleanName || !cleanCategory || !cleanCommand || !chatId) {
      return { error: "name, category, command and chatId are required." };
    }
    const { root, target } = await resolveTarget(projectPath, cwd || ".");
    const id = `bg_${randomUUID()}`;
    const task = {
      id,
      chatId: String(chatId),
      turnId: String(turnId || ""),
      name: cleanName,
      category: cleanCategory,
      projectPath: root,
      cwd: path.relative(root, target).replaceAll("\\", "/") || ".",
      command: cleanCommand,
      status: "running",
      pid: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationMs: 0,
      exitCode: null,
      expectedMinutes: Math.max(0, Number(expectedMinutes) || 0),
      stdoutTail: "",
      stderrTail: "",
      notificationState: "delivered",
    };
    const child = spawnProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ${cleanCommand}`], {
      cwd: target,
      windowsHide: true,
      shell: false,
    });
    task.pid = Number(child.pid) || null;
    tasks.set(id, task);
    children.set(id, child);
    child.stdout?.setEncoding?.("utf8");
    child.stderr?.setEncoding?.("utf8");
    child.stdout?.on?.("data", (data) => {
      task.stdoutTail = appendTail(task.stdoutTail, data);
    });
    child.stderr?.on?.("data", (data) => {
      task.stderrTail = appendTail(task.stderrTail, data);
    });
    child.once("error", (error) => {
      finish(id, null, String(error?.message || error)).catch(() => {});
    });
    child.once("close", (code) => {
      finish(id, code).catch(() => {});
    });
    await persist();
    notify("started", task);
    return { backgroundTask: true, started: true, ...publicTask(task) };
  };

  const list = (chatId) => [...tasks.values()]
    .filter((task) => !chatId || task.chatId === String(chatId))
    .sort((a, b) => {
      if (a.status === "running" && b.status !== "running") {
        return -1;
      }
      if (a.status !== "running" && b.status === "running") {
        return 1;
      }
      return String(b.startedAt).localeCompare(String(a.startedAt));
    })
    .map(publicTask);

  const get = (id) => {
    const task = tasks.get(String(id || ""));
    return task ? storedTask(task) : null;
  };

  const cancel = async (id) => {
    const task = tasks.get(String(id || ""));
    if (!task) {
      return { error: "Background task not found." };
    }
    if (task.status !== "running") {
      return publicTask(task);
    }
    const child = children.get(task.id);
    task.status = "canceled";
    task.finishedAt = new Date().toISOString();
    task.durationMs = Math.max(0, Date.now() - new Date(task.startedAt).getTime());
    task.pid = null;
    task.notificationState = "delivered";
    children.delete(task.id);
    await persist().catch(() => {});
    notify("canceled", task);
    try {
      killTree(child?.pid);
    } catch {}
    return publicTask(task);
  };

  const clearFinished = async (chatId) => {
    let removed = 0;
    for (const [id, task] of tasks) {
      if (task.chatId === String(chatId || "") && terminalStatuses.has(task.status)) {
        tasks.delete(id);
        removed += 1;
      }
    }
    if (removed) {
      await persist().catch(() => {});
      emit({ type: "cleared", chatId: String(chatId || "") });
    }
    return { removed };
  };

  const deleteChat = async (chatId) => {
    const ids = [...tasks.values()].filter((task) => task.chatId === String(chatId || "")).map((task) => task.id);
    for (const id of ids) {
      await cancel(id);
      tasks.delete(id);
    }
    if (ids.length) {
      await persist().catch(() => {});
      emit({ type: "cleared", chatId: String(chatId || "") });
    }
    return { removed: ids.length };
  };

  const claimPending = async (chatId) => {
    const task = [...tasks.values()]
      .filter((entry) => entry.chatId === String(chatId || "") && entry.notificationState === "pending")
      .sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)))[0];
    if (!task) {
      return null;
    }
    task.notificationState = "sending";
    await persist();
    return storedTask(task);
  };

  const settleNotification = async (id, delivered) => {
    const task = tasks.get(String(id || ""));
    if (!task || task.notificationState !== "sending") {
      return false;
    }
    task.notificationState = delivered ? "delivered" : "pending";
    await persist();
    return true;
  };

  const shutdown = () => {
    persistenceGeneration += 1;
    const now = new Date().toISOString();
    for (const task of tasks.values()) {
      if (task.status !== "running") {
        continue;
      }
      const child = children.get(task.id);
      task.status = "interrupted";
      task.pid = null;
      task.finishedAt = now;
      task.durationMs = Math.max(0, Date.now() - new Date(task.startedAt).getTime());
      task.notificationState = "delivered";
      try {
        killTreeSync(child?.pid);
      } catch {}
    }
    children.clear();
    try {
      persistSync();
    } catch {}
  };

  return {
    initialize,
    start,
    list,
    get,
    cancel,
    clearFinished,
    deleteChat,
    claimPending,
    settleNotification,
    shutdown,
  };
};
