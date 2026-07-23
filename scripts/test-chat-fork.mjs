import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");
const start = source.indexOf("const forkChatAtMessage =");
const end = source.indexOf("const imageDataUrlCache =", start);

if (start < 0 || end < 0) {
  throw new Error("Could not extract chat fork helpers");
}

const runtime = new Function(`${source.slice(start, end)}return { forkChatAtMessage, deletableAttachmentNames };`);
const { forkChatAtMessage, deletableAttachmentNames } = runtime();
let passed = 0;

const check = (condition, name) => {
  if (!condition) {
    throw new Error(`FAIL: ${name}`);
  }
  passed += 1;
};

const sourceChat = {
  id: "source",
  title: "Original",
  projectPath: "D:\\Project",
  workspaceName: "",
  pinned: true,
  summary: "Earlier context",
  summaryCount: 2,
  messages: [
    { id: "u1", role: "user", content: "One", attachment: { name: "shared.png" } },
    { id: "a1", role: "assistant", content: "Two", done: true },
    { id: "u2", role: "user", content: "Three" },
    { id: "a2", role: "assistant", content: "Four", done: true, segments: [{ type: "text", content: "Four" }] },
    { id: "u3", role: "user", content: "Five" },
    { id: "a3", role: "assistant", content: "Broken", done: true },
  ],
};

const fork = forkChatAtMessage(sourceChat, "a2", "fork-id", "2026-07-23T12:00:00.000Z");

check(fork.id === "fork-id", "fork receives a new chat id");
check(fork.title === "Original (fork)", "fork title is distinguishable");
check(fork.messages.length === 4 && fork.messages.at(-1).id === "a2", "fork stops at the selected assistant message");
check(fork.projectPath === sourceChat.projectPath, "fork keeps the project");
check(fork.pinned === false, "fork starts unpinned");
check(fork.summary === sourceChat.summary && fork.summaryCount === 2, "valid compacted context is retained");
check(fork.createdAt === fork.updatedAt, "fork timestamps are reset");
check(fork.messages !== sourceChat.messages && fork.messages[3] !== sourceChat.messages[3], "fork history is deeply cloned");

fork.messages[3].segments[0].content = "Changed";
check(sourceChat.messages[3].segments[0].content === "Four", "fork mutations cannot alter the source chat");

const beforeSummary = forkChatAtMessage(sourceChat, "u1", "early", "2026-07-23T12:00:00.000Z");
check(beforeSummary.summary === "" && beforeSummary.summaryCount === 0, "fork before the compacted boundary resets the summary");
check(forkChatAtMessage(sourceChat, "missing", "none") === null, "unknown messages cannot create a fork");

const forkWithSharedImage = {
  ...fork,
  messages: [{ id: "copy", role: "user", content: "One", attachment: { name: "shared.png" } }],
};
check(deletableAttachmentNames([sourceChat, forkWithSharedImage], "source").length === 0, "shared attachments survive deleting the source");
check(deletableAttachmentNames([sourceChat], "source")[0] === "shared.png", "unshared attachments are deletable");

check(source.includes("<ForkIcon size={13} />"), "assistant actions use the requested fork icon");
check(source.includes("onFork={forkChat}"), "assistant messages receive the fork action");
check(source.includes('title={t("action.copy")}'), "assistant messages expose copy");

console.log(`${passed} chat fork checks passed`);
