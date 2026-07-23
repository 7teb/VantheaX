import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createBackgroundTaskManager } from "../electron/background-tasks.js";

const waitFor = async (check) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for background task state");
};

const makeChild = (pid) => {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
};

const root = await fs.mkdtemp(path.join(os.tmpdir(), "vantheax-background-"));
const rendererSource = await fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
assert.match(rendererSource, /task\.status === "running" \? t\("background\.runningStatus"\)/);
assert.match(rendererSource, /"background\.runningStatus": "Running"/);
const dataFile = path.join(root, "tasks.json");
const children = [];
const killed = [];
const events = [];
const manager = createBackgroundTaskManager({
  dataFile,
  resolveTarget: async () => ({ root, target: root }),
  spawnProcess: () => {
    const child = makeChild(7000 + children.length);
    children.push(child);
    return child;
  },
  killTree: (pid) => killed.push(pid),
  killTreeSync: (pid) => killed.push(pid),
  emit: (event) => events.push(event),
});

await manager.initialize();
const started = await manager.start({
  projectPath: root,
  chatId: "chat-a",
  turnId: "turn-a",
  name: "Long analysis",
  category: "Python",
  command: "python long.py",
  expectedMinutes: 40,
});
assert.equal(started.started, true);
assert.equal(started.status, "running");
assert.equal(manager.list("chat-a").length, 1);
assert.equal(events[0].type, "started");

children[0].stdout.write("first output\n");
children[0].stderr.write("warning\n");
children[0].emit("close", 0);
await waitFor(() => events.at(-1)?.type === "finished");
const completed = manager.get(started.id);
assert.equal(completed.exitCode, 0);
assert.match(completed.stdoutTail, /first output/);
assert.match(completed.stderrTail, /warning/);
assert.equal(events.at(-1).type, "finished");

const claimed = await manager.claimPending("chat-a");
assert.equal(claimed.id, started.id);
assert.equal((await manager.claimPending("chat-a")), null);
await manager.settleNotification(started.id, false);
assert.equal((await manager.claimPending("chat-a")).id, started.id);
await manager.settleNotification(started.id, true);
assert.equal((await manager.claimPending("chat-a")), null);

const canceled = await manager.start({
  projectPath: root,
  chatId: "chat-a",
  turnId: "turn-b",
  name: "Cancelable build",
  category: "Build",
  command: "npm.cmd run package",
});
await manager.cancel(canceled.id);
assert.equal(manager.get(canceled.id).status, "canceled");
assert.deepEqual(killed, [7001]);
children[1].emit("close", 1);
assert.equal(manager.get(canceled.id).status, "canceled");

const interrupted = await manager.start({
  projectPath: root,
  chatId: "chat-b",
  turnId: "turn-c",
  name: "Interrupted task",
  category: "PowerShell",
  command: "Start-Sleep 999",
});
manager.shutdown();
assert.equal(manager.get(interrupted.id).status, "interrupted");
assert.deepEqual(killed, [7001, 7002]);

const reloaded = createBackgroundTaskManager({
  dataFile,
  resolveTarget: async () => ({ root, target: root }),
  spawnProcess: () => {
    throw new Error("A persisted task must not restart");
  },
});
await reloaded.initialize();
assert.equal(reloaded.get(interrupted.id).status, "interrupted");
assert.equal(reloaded.list("chat-b").length, 1);

await reloaded.clearFinished("chat-b");
assert.equal(reloaded.list("chat-b").length, 0);
await fs.rm(root, { recursive: true, force: true });
console.log("background tasks: ok");
