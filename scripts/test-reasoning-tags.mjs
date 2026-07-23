import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "electron", "main.js"), "utf8");
const start = source.indexOf("const reasoningContentTags =");
const end = source.indexOf("\nconst streamOpenRouter =", start);
if (start < 0 || end < 0) {
  throw new Error("reasoning content filter not found");
}

const filterSource = source.slice(start, end);
const createReasoningContentFilter = new Function(`${filterSource}\nreturn createReasoningContentFilter;`)();
let passed = 0;

const check = (condition, name, detail = "") => {
  if (!condition) {
    throw new Error(`FAIL: ${name}${detail ? ` (${detail})` : ""}`);
  }
  passed += 1;
};

const filter = (chunks) => {
  const instance = createReasoningContentFilter();
  let visible = "";
  for (const chunk of chunks) {
    visible += instance.push(chunk);
  }
  return visible + instance.finish();
};

check(filter(["normal answer"]) === "normal answer", "normal text remains unchanged");
check(filter(["<div>normal</div>"]) === "<div>normal</div>", "unrelated tags remain unchanged");
check(filter(["before <think>private</think> after"]) === "before  after", "short reasoning block is removed");
check(filter(["before <thinking>private</thinking> after"]) === "before  after", "long reasoning block is removed");
check(filter(["a <ThInKiNg>private</THINKING> b"]) === "a  b", "tag matching is case insensitive");
check(filter(["answer</think>"]) === "answer", "orphan short closing tag is removed");
check(filter(["answer</thinking>"]) === "answer", "orphan long closing tag is removed");
check(filter(["safe<think>```cpp\nint hidden;\n```</think>done"]) === "safedone", "hidden code fence is removed");
check(filter(["a<think>x</think>b<thinking>y</thinking>c"]) === "abc", "multiple reasoning blocks are removed");
check(filter(["visible<thinking>never closed"]) === "visible", "unfinished reasoning block does not leak");
check(filter(["visible</think"]) === "visible", "unfinished short closing tag does not leak");
check(filter(["visible</thinking"]) === "visible", "unfinished long closing tag does not leak");

for (const sample of [
  { input: "before<think>hidden</think>after", expected: "beforeafter" },
  { input: "before<thinking>hidden</thinking>after", expected: "beforeafter" },
  { input: "before</think>after", expected: "beforeafter" },
  { input: "before</thinking>after", expected: "beforeafter" },
]) {
  for (let index = 0; index <= sample.input.length; index += 1) {
    const actual = filter([sample.input.slice(0, index), sample.input.slice(index)]);
    check(actual === sample.expected, "two-chunk split is stable", `${index}: ${actual}`);
  }
  const characters = [...sample.input];
  check(filter(characters) === sample.expected, "single-character chunks are stable", filter(characters));
}

const contentBranch = source.slice(source.indexOf("if (delta.content) {"), source.indexOf("let toolDraftChanged", source.indexOf("if (delta.content) {")));
check(contentBranch.includes("appendContent(reasoningContentFilter.push(delta.content))"), "raw content cannot bypass the filter");
check(!contentBranch.includes("content += delta.content"), "raw content is never appended directly");
check(source.includes("if (!value) {\n      return;\n    }\n    content += value;"), "empty filtered chunks emit nothing");
check(source.includes("appendContent(reasoningContentFilter.finish());"), "stream tail is finalized");

console.log(`${passed} reasoning tag checks passed`);
