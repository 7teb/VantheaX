import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");

const slice = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) {
    throw new Error(`Could not extract ${start}`);
  }
  return source.slice(from, to);
};

let clock = 0;
let frameId = 0;
const frames = new Map();
let timerId = 0;
const timers = new Map();

const requestFrame = (callback) => {
  frameId += 1;
  frames.set(frameId, callback);
  return frameId;
};

const cancelFrame = (id) => {
  frames.delete(id);
};

const scheduleTimer = (callback, delay) => {
  timerId += 1;
  timers.set(timerId, { at: clock + Number(delay || 0), callback });
  return timerId;
};

const cancelTimer = (id) => {
  timers.delete(id);
};

const runFrame = async (elapsed = 16) => {
  clock += elapsed;
  const due = [...timers.entries()].filter(([, timer]) => timer.at <= clock);
  for (const [id, timer] of due) {
    timers.delete(id);
    timer.callback();
  }
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) {
    callback(clock);
  }
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const runtime = new Function(
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "Date",
  "setTimeout",
  "clearTimeout",
  `${slice("const STREAM_TARGET_LATENCY =", "const useNarrationLine =")}${slice("const createStreamPacer =", "const UI_FONTS =")}return { narrationStore, createStreamPacer };`,
)(requestFrame, cancelFrame, { now: () => clock }, scheduleTimer, cancelTimer);

const { narrationStore, createStreamPacer } = runtime;
let passed = 0;

const check = (condition, name) => {
  if (!condition) {
    throw new Error(`FAIL: ${name}`);
  }
  passed += 1;
};

const startPartialLine = async (requestId, text) => {
  narrationStore.begin(requestId);
  narrationStore.enqueue(requestId, { tick: 0, lines: [text] });
  await runFrame(2500);
  await runFrame(100);
  const shown = narrationStore.getLine();
  check(shown.length > 0 && shown.length < text.length, `${requestId} starts with a partial narrator line`);
};

const runUntil = async (condition, limit = 80, elapsed = 100) => {
  for (let index = 0; index < limit && !condition(); index += 1) {
    await runFrame(elapsed);
  }
  return condition();
};

const line = "Ich prüfe jetzt den exakten Übergang.";
const lineHistory = [];
const off = narrationStore.subscribe(() => lineHistory.push({ at: clock, text: narrationStore.getLine() }));
await startPartialLine("half", line);
const applied = [];
let gateCalls = 0;
const pacer = createStreamPacer(
  (event) => applied.push({ at: clock, line: narrationStore.getLine(), event }),
  () => {
    gateCalls += 1;
    return narrationStore.handoffDelta("half");
  },
);
pacer.push({ type: "delta", delta: "Antwort" });
await runFrame();
check(applied.length === 0, "main text stays queued when handoff starts");
check(await runUntil(() => lineHistory.some((entry) => entry.text === line)), "the narrator sentence becomes fully visible");
check(applied.length === 0, "main text is still hidden while the complete sentence is visible");
check(await runUntil(() => narrationStore.getLine() === "", 4, 16), "the completed narrator sentence is cleared");
check(applied.length === 0, "clearing the narrator does not expose main text in the same frame");
await runFrame(16);
check(applied.length === 1 && applied[0].event.delta.length > 0, "main text starts on the following frame");
check(applied[0].line === "", "main text never shares a frame with narrator text");
check(gateCalls === 1, "the first text stretch opens exactly one gate");
pacer.push({ type: "delta", delta: " weiter" });
check(await runUntil(() => applied.map((entry) => entry.event.delta || "").join("").includes("weiter"), 10, 100), "later deltas stream without another handoff");
check(gateCalls === 1, "later deltas do not reopen the gate");
narrationStore.reset("half");
off();

await startPartialLine("order", "Ich ordne noch die nächsten Arbeitsschritte.");
const ordered = [];
const orderPacer = createStreamPacer(
  (event) => ordered.push(event.type),
  () => narrationStore.handoffDelta("order"),
);
orderPacer.push({ type: "delta", delta: "Zwischensatz" });
orderPacer.push({ type: "tool_progress", name: "write_file" });
await runFrame();
check(ordered.length === 0, "tool progress cannot overtake a gated delta");
check(await runUntil(() => ordered.length === 2), "gated delta and tool progress eventually apply");
check(await runUntil(() => ordered.includes("tool_progress")), "tool progress eventually becomes visible");
check(ordered[0] === "delta" && ordered.at(-1) === "tool_progress", "delta and tool progress preserve their original order");
narrationStore.reset("order");

await startPartialLine("reset", "Ich halte diesen Satz bis zum sauberen Ende.");
let resetResolved = false;
const resetWait = narrationStore.handoffDelta("reset").then(() => {
  resetResolved = true;
});
narrationStore.reset("reset");
await resetWait;
check(resetResolved, "reset releases a pending handoff immediately");
check(narrationStore.getLine() === "", "reset clears the narrator line");

await startPartialLine("timeout", "Ich bleibe auch bei gedrosselten Frames nicht hängen.");
let timeoutResolved = false;
const timeoutWait = narrationStore.handoffDelta("timeout").then(() => {
  timeoutResolved = true;
});
await runFrame(3000);
await timeoutWait;
check(timeoutResolved, "the handoff timeout releases a throttled renderer");
check(narrationStore.getLine() === "", "the handoff timeout clears stale narrator text");
narrationStore.reset("timeout");

await startPartialLine("flush", "Ich beende erst diesen Satz vor der Antwort.");
const flushed = [];
const flushPacer = createStreamPacer(
  (event) => flushed.push({ line: narrationStore.getLine(), event }),
  () => narrationStore.handoffDelta("flush"),
);
flushPacer.push({ type: "delta", delta: "Komplette Antwort" });
let flushDone = false;
const flushWait = flushPacer.flushAfterGate().then(() => {
  flushDone = true;
});
await Promise.resolve();
check(!flushDone && flushed.length === 0, "successful no-tool flush waits for the narrator");
check(await runUntil(() => flushDone), "no-tool flush completes after the sentence handoff");
await flushWait;
check(flushed.length === 1 && flushed[0].event.delta === "Komplette Antwort", "no-tool flush keeps the complete answer");
check(flushed[0].line === "", "no-tool flush cannot overlap the narrator");
narrationStore.reset("flush");

narrationStore.begin("empty");
const immediate = [];
const immediatePacer = createStreamPacer(
  (event) => immediate.push(event),
  () => narrationStore.handoffDelta("empty"),
);
immediatePacer.push({ type: "delta", delta: "Sofort" });
await runFrame();
check(await runUntil(() => immediate.length > 0, 6, 16), "text without an active narrator starts without a hold");
narrationStore.reset("empty");

check(!source.includes("NARRATE_FADE_MS") && !source.includes("s.fading"), "obsolete fade state is removed");
check(!slice("const applyStreamEvent =", "const pacer =").includes("handoffDelta"), "chat state never applies the handoff after text is visible");
check(source.includes("createStreamPacer(applyStreamEvent, () => narrationStore.handoffDelta(requestId))"), "the pacer owns the handoff before text application");

console.log(`${passed} narrator handoff checks passed`);
