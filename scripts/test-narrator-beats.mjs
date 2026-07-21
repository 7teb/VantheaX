import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8");

const slice = (startAnchor, endAnchor) => {
  const start = src.indexOf(startAnchor);
  const end = src.indexOf(endAnchor, start);
  if (start === -1 || end === -1) {
    console.error(`Could not extract ${startAnchor} from main.js`);
    process.exit(1);
  }
  return src.slice(start, end);
};

const narratorSrc = slice("const narratorModel =", "\nconst parseNarratorLines");
const readSrc = slice("const readReasoningDelta =", "\nconst streamOpenRouter");
const findNarratorBeat = new Function(`${narratorSrc}\nreturn findNarratorBeat;`)();
const readReasoningDelta = new Function(`${readSrc}\nreturn readReasoningDelta;`)();

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

const filler = (n, word = "reasoning ") => word.repeat(Math.ceil(n / word.length)).slice(0, n);

const para = `${filler(320)}\n\nthe next thought continues here`;
check("paragraph break after 300 chars cuts after the break", findNarratorBeat(para) === 322, String(findNarratorBeat(para)));

const shortPara = `${filler(120)}\n\nstill short`;
check("paragraph break under 300 chars keeps buffering", findNarratorBeat(shortPara) === -1, String(findNarratorBeat(shortPara)));

const marker = `${filler(340)}. Wait, that is not right`;
check("discourse marker cuts before the marker", findNarratorBeat(marker) === 342, String(findNarratorBeat(marker)));
check("the marker itself stays in the next buffer", marker.slice(findNarratorBeat(marker)).startsWith("Wait"), marker.slice(findNarratorBeat(marker), findNarratorBeat(marker) + 8));

const actually = `${filler(340)}. Actually that changes things`;
check("the Actually marker cuts before the marker", actually.slice(findNarratorBeat(actually)).startsWith("Actually"), String(findNarratorBeat(actually)));

const letMe = `${filler(340)}. Let me check the other file`;
check("the two-word Let me marker cuts before the marker", letMe.slice(findNarratorBeat(letMe)).startsWith("Let me"), String(findNarratorBeat(letMe)));

const midWord = `${filler(340)} alsobutnow keeps going and nothing else here at all`;
check("a mid-word marker does not match", findNarratorBeat(midWord) === -1, String(findNarratorBeat(midWord)));

const earlyMarker = `${filler(100)}. Wait, ${filler(120)}`;
check("a marker before the 300 floor does not cut", findNarratorBeat(earlyMarker) === -1, String(findNarratorBeat(earlyMarker)));

const both = `${filler(320)}\n\n${filler(60)}. So we continue`;
check("latest boundary wins when a later marker qualifies", findNarratorBeat(both) === 384, String(findNarratorBeat(both)));

const bothReversed = `${filler(320)}. So ${filler(40)}\n\ntail`;
check("latest boundary wins when a later paragraph break qualifies", findNarratorBeat(bothReversed) === 367, String(findNarratorBeat(bothReversed)));

const sentences = `${"lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(120)}`;
const sentenceCut = findNarratorBeat(sentences);
check("a marker-free sentence run still cuts", sentenceCut > 0, String(sentenceCut));

const longNoBreak = `${filler(1200, "abcdefghij ")}. ${filler(3800, "klmnopqrst ")}`;
const capCut = findNarratorBeat(longNoBreak);
check("5000-char block with no break cuts at the last sentence end before 1500", capCut === 1201, String(capCut));
check("the hard cap cut never exceeds 1500", capCut <= 1500, String(capCut));

const noSentence = filler(5000, "abcdefghij ");
const wsCut = findNarratorBeat(noSentence);
check("no sentence end cuts at the last whitespace before 1500", wsCut > 1400 && wsCut < 1500, String(wsCut));
check("the whitespace cut lands on whitespace", /\s/.test(noSentence[wsCut]), JSON.stringify(noSentence[wsCut]));

const noWhitespace = "x".repeat(5000);
check("no whitespace at all cuts hard at 1500", findNarratorBeat(noWhitespace) === 1500, String(findNarratorBeat(noWhitespace)));

const earlySentence = `Ok. ${"a".repeat(1600)}`;
check("an early sentence end never yields a sub-300 slice", findNarratorBeat(earlySentence) >= 300, String(findNarratorBeat(earlySentence)));

const earlySpace = `Ok ${"a".repeat(1600)}`;
check("an early whitespace never yields a sub-300 slice", findNarratorBeat(earlySpace) >= 300, String(findNarratorBeat(earlySpace)));

check("1499 unbroken chars keep buffering", findNarratorBeat("x".repeat(1499)) === -1);
check("exactly 1500 unbroken chars cut", findNarratorBeat("x".repeat(1500)) === 1500);

const at299 = `${filler(299)}\n\ntail`;
const at300 = `${filler(300)}\n\ntail`;
check("a paragraph break at 299 does not qualify", findNarratorBeat(at299) === -1, String(findNarratorBeat(at299)));
check("a paragraph break at exactly 300 qualifies", findNarratorBeat(at300) === 302, String(findNarratorBeat(at300)));

const marker299 = `${filler(297)}. Wait here`;
const marker300 = `${filler(298)}. Wait here`;
check("a marker starting at 299 does not qualify", findNarratorBeat(marker299) === -1, String(findNarratorBeat(marker299)));
check("a marker starting at exactly 300 qualifies", findNarratorBeat(marker300) === 300, String(findNarratorBeat(marker300)));

check("empty buffer keeps buffering", findNarratorBeat("") === -1);
check("null buffer keeps buffering", findNarratorBeat(null) === -1);

check("nvidia reasoning_content is read", readReasoningDelta({ reasoning_content: "abc" }) === "abc");
check("openrouter legacy reasoning string is read", readReasoningDelta({ reasoning: "abc" }) === "abc");
check("reasoning_content wins over reasoning", readReasoningDelta({ reasoning_content: "a", reasoning: "b" }) === "a");
check("openrouter reasoning_details array is joined", readReasoningDelta({ reasoning_details: [{ type: "reasoning.text", text: "ab" }, { text: "cd" }] }) === "abcd");
check("a metadata-only reasoning_details chunk yields an empty string", readReasoningDelta({ reasoning_details: [{ type: "reasoning.text", id: "x", index: 0 }] }) === "");
check("an empty reasoning_details array yields an empty string", readReasoningDelta({ reasoning_details: [] }) === "");
check("a content-only delta yields an empty string", readReasoningDelta({ content: "hello" }) === "");
check("an empty delta yields an empty string", readReasoningDelta({}) === "");
check("a null reasoning field is ignored", readReasoningDelta({ reasoning_content: null, reasoning: null }) === "");
check("a non-string reasoning field is ignored", readReasoningDelta({ reasoning: { text: "x" } }) === "");
check("an empty reasoning string falls through to the details array", readReasoningDelta({ reasoning: "", reasoning_details: [{ text: "ab" }] }) === "ab");
check("an empty reasoning_content falls through to the reasoning string", readReasoningDelta({ reasoning_content: "", reasoning: "ab" }) === "ab");
check("both shapes present takes the string once, never both", readReasoningDelta({ reasoning: "ab", reasoning_details: [{ text: "ab" }] }) === "ab");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
