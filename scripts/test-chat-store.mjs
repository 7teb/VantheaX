import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createChatStore } from "../electron/chat-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "vantheax-chat-store-"));
const legacyFile = path.join(root, "chats.json");
const backupFile = path.join(root, "chats.v1.backup.json");
const directory = path.join(root, "chat-store");
const now = new Date().toISOString();
const legacy = [
  {
    id: "chat-a",
    title: "Alpha",
    projectPath: "D:\\alpha",
    messages: [
      { id: "u1", role: "user", content: "find the alpha symbol" },
      {
        id: "a1",
        role: "assistant",
        content: "done",
        tools: [{ id: "t1", name: "read_file", args: { path: "big.cpp" }, result: { content: "x".repeat(200000) } }],
        segments: [{ type: "tool", tool: { id: "t1", name: "read_file", args: { path: "big.cpp" }, result: { content: "x".repeat(200000) } } }],
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "chat-b",
    title: "Beta",
    projectPath: "",
    messages: [{ id: "u2", role: "user", content: "beta search phrase" }],
    createdAt: now,
    updatedAt: new Date(Date.now() - 1000).toISOString(),
  },
];

await fs.writeFile(legacyFile, JSON.stringify(legacy, null, 2), "utf8");
const original = await fs.readFile(legacyFile, "utf8");
const store = createChatStore({ directory, legacyFile, backupFile });
await store.initialize();

assert.equal(await fs.readFile(legacyFile, "utf8"), original);
assert.equal(await fs.readFile(backupFile, "utf8"), original);

const list = await store.list("chat-b");
assert.equal(list.length, 2);
assert.equal(list.find((chat) => chat.id === "chat-b").messagesLoaded, true);
assert.equal(list.find((chat) => chat.id === "chat-a").messagesLoaded, false);
assert.equal(list.find((chat) => chat.id === "chat-a").messages.length, 0);
assert.match(list.find((chat) => chat.id === "chat-a").searchText, /alpha symbol/);
assert.ok(JSON.stringify(list).length < 10000);
const index = JSON.parse(await fs.readFile(path.join(directory, "index.json"), "utf8"));
const packedFiles = await fs.readdir(path.join(directory, "data-v2"));
assert.equal(index.version, 2);
assert.equal(packedFiles.filter((file) => file.endsWith(".vxchat")).length, 2);
assert.equal(packedFiles.some((file) => file.endsWith(".json")), false);

const alpha = await store.get("chat-a");
assert.equal(alpha.messagesLoaded, true);
assert.equal(alpha.messages[1].tools[0].result.content.length, 200000);
alpha.title = "Alpha renamed";
alpha.messages.push({ id: "u3", role: "user", content: "new searchable phrase" });
await store.save(alpha);

const restored = createChatStore({ directory, legacyFile, backupFile });
await restored.initialize();
const restoredList = await restored.list("chat-b");
assert.equal(restoredList.find((chat) => chat.id === "chat-a").title, "Alpha renamed");
assert.match(restoredList.find((chat) => chat.id === "chat-a").searchText, /new searchable phrase/);

assert.equal(await restored.remove("chat-a"), true);
assert.equal(await restored.get("chat-a"), null);
assert.equal((await restored.list("chat-b")).length, 1);

await fs.rm(root, { recursive: true, force: true });
console.log("chat store tests passed");
