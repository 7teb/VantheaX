import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8");

const start = src.indexOf("const narratorModel =");
const endAnchor = "\nconst narratorBody";
const end = src.indexOf(endAnchor, start);
if (start === -1 || end === -1) {
  console.error("Could not extract parseNarratorLines from main.js");
  process.exit(1);
}
const parseNarratorLines = new Function(`${src.slice(start, end)}\nreturn parseNarratorLines;`)();

let pass = 0;
let fail = 0;
const check = (name, condition, detail = "") => {
  if (condition) {
    pass += 1;
    return;
  }
  fail += 1;
  console.error(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const clean = parseNarratorLines('["The user is asking about a new model.", "We need current info."]', []);
check("a clean array parses", clean.ok && eq(clean.lines, ["The user is asking about a new model.", "We need current info."]), JSON.stringify(clean));

const wrapped = parseNarratorLines('Sure, here you go:\n["Checking the config."]\nHope that helps.', []);
check("a prose-wrapped array is extracted", wrapped.ok && eq(wrapped.lines, ["Checking the config."]), JSON.stringify(wrapped));

const fenced = parseNarratorLines('```json\n["Reading the file."]\n```', []);
check("a code-fenced array is extracted", fenced.ok && eq(fenced.lines, ["Reading the file."]), JSON.stringify(fenced));

const truncated = parseNarratorLines('["First line here.", "Second line here.", "unterminated', []);
check("truncated JSON salvages the complete strings", truncated.ok && eq(truncated.lines, ["First line here.", "Second line here."]), JSON.stringify(truncated));

const garbage = parseNarratorLines("I am sorry, I cannot help with that request.", []);
check("garbage with no quoted strings is a failure", !garbage.ok && eq(garbage.lines, []), JSON.stringify(garbage));

const refusal = parseNarratorLines('I am sorry, I cannot help with "that request".', []);
check("a prose refusal containing a quote is a failure, not a line", !refusal.ok && eq(refusal.lines, []), JSON.stringify(refusal));

const quotedProse = parseNarratorLines('The agent said "hello there" and then stopped.', []);
check("quoted prose without a bracket never salvages", !quotedProse.ok, JSON.stringify(quotedProse));

const empty = parseNarratorLines("", []);
check("an empty response is a failure", !empty.ok, JSON.stringify(empty));

const whitespace = parseNarratorLines("   \n\t ", []);
check("a whitespace-only response is a failure", !whitespace.ok, JSON.stringify(whitespace));

const cleanEmpty = parseNarratorLines("[]", []);
check("a clean empty array is ok with no lines", cleanEmpty.ok && eq(cleanEmpty.lines, []), JSON.stringify(cleanEmpty));

const allFiltered = parseNarratorLines('["Already shown."]', ["Already shown."]);
check("an all-filtered clean response is ok with no lines", allFiltered.ok && eq(allFiltered.lines, []), JSON.stringify(allFiltered));

const long = `["${"a".repeat(91)}", "Short one."]`;
const longRes = parseNarratorLines(long, []);
check("lines over 90 chars are dropped, not truncated", longRes.ok && eq(longRes.lines, ["Short one."]), JSON.stringify(longRes));

const exactly90 = `["${"a".repeat(89)}."]`;
const exactly90Res = parseNarratorLines(exactly90, []);
check("a line of exactly 90 chars is kept", exactly90Res.ok && exactly90Res.lines.length === 1, JSON.stringify(exactly90Res));

const noPunct = parseNarratorLines('["Weighing the options"]', []);
check("a line without terminal punctuation gains a period", noPunct.ok && eq(noPunct.lines, ["Weighing the options."]), JSON.stringify(noPunct));

const bang = parseNarratorLines('["Let\'s search!", "Which one?"]', []);
check("exclamation and question marks count as terminal punctuation", bang.ok && eq(bang.lines, ["Let's search!", "Which one?"]), JSON.stringify(bang));

const dupe = parseNarratorLines('["THE USER IS ASKING SOMETHING.", "A fresh line."]', ["the user is asking something."]);
check("case-insensitive duplicates are dropped", dupe.ok && eq(dupe.lines, ["A fresh line."]), JSON.stringify(dupe));

const dupeAfterPunct = parseNarratorLines('["Reading the config"]', ["Reading the config."]);
check("a duplicate is detected after the period is appended", dupeAfterPunct.ok && eq(dupeAfterPunct.lines, []), JSON.stringify(dupeAfterPunct));

const many = parseNarratorLines('["One.", "Two.", "Three.", "Four.", "Five.", "Six."]', []);
check("more than five lines cap at five", many.ok && eq(many.lines, ["One.", "Two.", "Three.", "Four.", "Five."]), JSON.stringify(many));

const action = parseNarratorLines('["Writing the expression parser...", "Tracing through the division cases..."]', []);
check("action lines keep their trailing ellipsis", action.ok && eq(action.lines, ["Writing the expression parser...", "Tracing through the division cases..."]), JSON.stringify(action));

const unicodeEllipsis = parseNarratorLines('["Writing the main loop…"]', []);
check("a unicode ellipsis becomes three dots", unicodeEllipsis.ok && eq(unicodeEllipsis.lines, ["Writing the main loop..."]), JSON.stringify(unicodeEllipsis));

const mixed = parseNarratorLines('["Real line.", 42, null, {"a":1}, "  ", "Second real line."]', []);
check("non-string and empty entries are dropped", mixed.ok && eq(mixed.lines, ["Real line.", "Second real line."]), JSON.stringify(mixed));

const trims = parseNarratorLines('["   Padded line.   "]', []);
check("lines are trimmed", trims.ok && eq(trims.lines, ["Padded line."]), JSON.stringify(trims));

const noShown = parseNarratorLines('["Works without a shown list."]', null);
check("a missing shownLines argument is tolerated", noShown.ok && noShown.lines.length === 1, JSON.stringify(noShown));

const objectResponse = parseNarratorLines('{"lines": ["Nested in an object."]}', []);
check("an object response salvages its quoted strings", objectResponse.ok && objectResponse.lines.includes("Nested in an object."), JSON.stringify(objectResponse));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
