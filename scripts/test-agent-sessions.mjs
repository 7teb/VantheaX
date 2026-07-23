import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAgentSessionManager } from "../electron/agent-sessions.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "vantheax-agent-test-"));
const dataFile = path.join(root, "agent-sessions.json");
const backgroundEvents = [];
const transcriptEvents = [];
const manager = createAgentSessionManager({
  dataFile,
  emit: (event) => backgroundEvents.push(event),
  emitTranscript: (event) => transcriptEvents.push(event),
});

await manager.initialize();
const values = [];
for (let index = 0; index < 4; index += 1) {
  values.push(await manager.begin({
    chatId: "chat-1",
    turnId: "turn-1",
    projectPath: "D:\\project",
    name: `Agent ${index + 1}`,
    description: "Bounded work",
    model: "deepseek/deepseek-v4-flash",
    effort: "high",
    profile: index === 0 ? "worker" : "explore",
    prompt: `Prompt ${index + 1}`,
  }));
}

assert.equal(values.every((value) => value.session && value.run), true);
const overflow = await manager.begin({
  chatId: "chat-1",
  turnId: "turn-1",
  projectPath: "D:\\project",
  name: "Overflow",
  description: "Must fail",
  model: "deepseek/deepseek-v4-flash",
  effort: "high",
  profile: "explore",
  prompt: "No slot",
});
assert.match(overflow.error, /4 agents/);

const first = values[0];
const toolEntry = manager.addEntry(first.session.id, first.run.id, {
  type: "tool",
  name: "read_file",
  args: "{\"path\":\"x.cpp\"}",
  status: "running",
});
assert.equal(manager.updateEntry(first.session.id, first.run.id, toolEntry, { status: "completed" }), true);
assert.equal(manager.setProgress(first.session.id, first.run.id, toolEntry, "live output"), true);
assert.equal(manager.setProgress(first.session.id, first.run.id, toolEntry, "final output"), true);
for (let index = 0; index < 1005; index += 1) {
  manager.addEntry(first.session.id, first.run.id, { type: "text", text: `Entry ${index}` });
}
manager.saveContext(first.session.id, [{ role: "assistant", content: "saved" }], "checkpoint");
await manager.finish(first.session.id, first.run.id, {
  status: "completed",
  report: "Done",
  writtenFiles: ["x.cpp", "x.cpp"],
});

const firstTranscript = manager.getTranscript(first.session.id, first.run.id);
assert.equal(firstTranscript.run.transcript[0].type, "prompt");
assert.equal(firstTranscript.run.transcript.filter((entry) => entry.type === "progress" && entry.parentId === toolEntry).length, 0);
assert.equal(firstTranscript.run.writtenFiles.length, 1);
const notification = await manager.claimPending("chat-1");
assert.equal(notification.kind, "agent");
assert.equal(notification.agentId, first.session.id);
assert.equal(notification.report, "Done");
assert.equal(await manager.settleNotification(notification.id, true), true);
assert.equal(await manager.claimPending("chat-1"), null);

const continued = await manager.begin({
  agentId: first.session.id,
  chatId: "chat-1",
  turnId: "turn-2",
  projectPath: "D:\\project",
  model: "deepseek/deepseek-v4-pro",
  effort: "xhigh",
  prompt: "Continue from the checkpoint",
});
assert.equal(continued.session.id, first.session.id);
assert.notEqual(continued.run.id, first.run.id);
assert.equal(continued.session.context[0].content, "saved");
await manager.cancel(first.session.id);
assert.equal(manager.getTranscript(first.session.id, continued.run.id).run.status, "canceled");

assert.equal(manager.list("chat-1").length, 4);
assert.equal(backgroundEvents.some((event) => event.type === "started"), true);
await new Promise((resolve) => setTimeout(resolve, 80));
assert.equal(transcriptEvents.some((event) => event.agentId === first.session.id), true);

manager.shutdown();
const restored = createAgentSessionManager({ dataFile });
await restored.initialize();
assert.equal(restored.list("chat-1").length, 4);
assert.equal(restored.getTranscript(values[1].session.id).run.status, "interrupted");
assert.equal(restored.getTranscript(first.session.id, continued.run.id).run.status, "canceled");
restored.shutdown();
await fs.rm(root, { recursive: true, force: true });

console.log("agent session tests passed");
