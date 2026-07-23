import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const main = fs.readFileSync(path.join(root, "electron", "main.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron", "preload.js"), "utf8");
let passed = 0;

const check = (condition, name) => {
  if (!condition) {
    throw new Error(`FAIL: ${name}`);
  }
  passed += 1;
};

const slice = (text, start, end) => {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from);
  if (from < 0 || to < 0) {
    throw new Error(`Could not extract ${start}`);
  }
  return text.slice(from, to);
};

const mainRuntime = new Function("Buffer", `${slice(main, "const estimateTokens =", "const maxGrepMatches")}${slice(main, "const sanitizeMessages =", "const capToolContent") }const contextBudget = 512000;${slice(main, "const measureContext =", "const measureContextState =")}return { estimateTokens, sanitizeMessages, measureContext, createLiveContextTracker };`)(Buffer);
const storeRuntime = new Function(`${slice(renderer, "const contextUsageStore =", "const useContextUsage =")}return contextUsageStore;`)();

check(preload.includes('getContextSnapshot: (payload) => ipcRenderer.invoke("context:snapshot", payload)'), "snapshot IPC is exposed");
check(!main.includes('context:estimate') && !renderer.includes("estimateContext") && !preload.includes("estimateContext"), "prediction IPC is removed");
check(!slice(renderer, "const openRightPanel =", "const addTermTab =").includes("ContextSnapshot"), "opening the panel does not measure context");
check(renderer.includes("useSyncExternalStore(contextUsageStore.subscribe, contextUsageStore.getUsage)"), "context UI uses its own store");
check(main.includes('messages.push({ role: "tool", tool_call_id: call.id, content: capToolContent(result) });\n            contextTracker.commit();\n            emit({ type: "tool", tool: requestEvent });'), "approved tool result is counted before completion event");
check(main.includes('messages.push({ role: "tool", tool_call_id: call.id, content: capToolContent(result) });\n          contextTracker.commit();\n          emit({ type: "tool", tool: toolEvent });'), "normal tool result is counted before completion event");

const messages = [
  { role: "system", content: "system" },
  { role: "user", content: "hello" },
];
const events = [];
const tracker = mainRuntime.createLiveContextTracker({
  messages,
  system: 100,
  code: 20,
  nativeSpecs: [{ type: "function", function: { name: "read_file" } }],
  mcpSpecs: [],
  chatId: "chat-a",
  requestId: "req-a",
  emit: (event) => events.push(event),
});

const initial = tracker.publish();
for (let index = 0; index < 200; index += 1) {
  tracker.setDraft({ role: "assistant", content: "x".repeat(index + 1) });
}
await new Promise((resolve) => setTimeout(resolve, 70));
check(events.length === 2, "stream fragments are coalesced into one 50ms update");
check(events[1].usage.total > initial.total, "assistant draft increases context live");

const assistant = { role: "assistant", content: "x".repeat(200), tool_calls: [{ id: "call-1", type: "function", function: { name: "read_file", arguments: '{"path":"large.cpp"}' } }] };
tracker.setDraft(assistant);
await new Promise((resolve) => setTimeout(resolve, 70));
const draftTotal = events.at(-1).usage.total;
messages.push(assistant);
const committed = tracker.commit();
const expectedCommitted = mainRuntime.measureContext(100, 20, [{ type: "function", function: { name: "read_file" } }], [], JSON.stringify(mainRuntime.sanitizeMessages(messages.slice(1))));
check(committed.total === expectedCommitted.total, "draft commit matches full concrete message measurement");
check(committed.total === draftTotal, "draft commit does not double count");

messages.push({ role: "tool", tool_call_id: "call-1", content: "a".repeat(12000) });
const firstRead = tracker.commit();
messages.push({ role: "tool", tool_call_id: "call-2", content: "b".repeat(8000) });
const secondRead = tracker.commit();
check(firstRead.total > committed.total, "first file result increases context immediately");
check(secondRead.total > firstRead.total, "second file result increases context independently");
const settled = { total: 777, budget: 512000, breakdown: { system: 100, tools: 50, mcp: 0, messages: 607, code: 20 } };
tracker.settle(settled);
check(events.at(-1).phase === "settled" && events.at(-1).usage.total === 777, "settled context is published explicitly");
tracker.close();

storeRuntime.activate("chat-a");
storeRuntime.begin("chat-a", "req-a");
check(storeRuntime.acceptEvent({ chatId: "chat-a", requestId: "req-a", revision: 1, phase: "live", usage: initial }), "active live event is accepted");
const staleTicket = storeRuntime.startSnapshot("chat-a");
check(!storeRuntime.acceptSnapshot(staleTicket, settled), "snapshot cannot overwrite an active stream");
check(storeRuntime.acceptEvent({ chatId: "chat-a", requestId: "req-a", revision: 2, phase: "settled", usage: settled }), "matching settled event is accepted");
const oldTicket = storeRuntime.startSnapshot("chat-a");
storeRuntime.begin("chat-a", "req-b");
check(!storeRuntime.acceptSnapshot(oldTicket, initial), "late snapshot cannot overwrite a newer request");
check(!storeRuntime.acceptEvent({ chatId: "chat-a", requestId: "req-a", revision: 99, phase: "live", usage: initial }), "old request event is rejected");
storeRuntime.activate("chat-b");
check(storeRuntime.getUsage() === null, "chat switch never shows another chat's usage");

console.log(`${passed} context checks passed`);
