import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.OPENROUTER_KEY;
if (!KEY) {
  console.error("Set OPENROUTER_KEY in the environment. This script never reads settings.json.");
  process.exit(2);
}

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

const safetySrc = slice("const geminiSafetySettings =", "\nconst classifierCache");
const narratorSrc = slice("const visualNoteMarker =", "\nconst createNarrator");
const built = new Function(`${safetySrc}\n${narratorSrc}\nreturn { narratorBody, parseNarratorLines };`)();

const SLICE = [
  "The user is asking about the new NVIDIA model catalog entry. I need to work out which models are actually reachable on that endpoint.",
  "Let me think about what I already know. The catalog lives in config/models.json and every entry carries an apiId plus an effortMap.",
  "The question is whether the model in question is provisioned for this account at all, because an unprovisioned function returns a 404 rather than a permission error.",
  "So the honest answer depends on live evidence. I should check the models endpoint first and only then reason about the request body shape.",
  "Actually, before that, it is worth confirming whether the account has trial credits left, since an exhausted trial also surfaces as an error that looks unrelated.",
].join(" ");

const body = built.narratorBody({ message: "Was genau kann das neue NVIDIA Modell?" }, SLICE, []);

const started = Date.now();
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost",
    "X-Title": "VantheaX",
  },
  body: JSON.stringify(body),
});
const took = Date.now() - started;

if (!response.ok) {
  const text = await response.text();
  console.error(`HTTP ${response.status} after ${took}ms`);
  console.error(text.slice(0, 800));
  console.error("");
  console.error("If this is a 400 naming the reasoning field, drop `reasoning` from narratorBody entirely and re-run, keeping max_tokens at 1000. That is what classifyCommand does and it works in production.");
  process.exit(1);
}

const data = await response.json();
const raw = data.choices?.[0]?.message?.content || "";
const usage = data.usage || {};
const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens;
const parsed = built.parseNarratorLines(raw, []);

console.log(`latency            ${took}ms`);
console.log(`served model       ${data.model || "(unknown)"}`);
console.log(`raw usage          ${JSON.stringify(usage)}`);
console.log(`reasoning tokens   ${reasoningTokens === undefined ? "(absent)" : reasoningTokens}`);
console.log(`raw content        ${JSON.stringify(raw)}`);
console.log(`parsed             ${JSON.stringify(parsed)}`);
console.log("");

const german = /[äöüß]/i.test(parsed.lines.join(" ")) || /\b(der|die|das|wir|ist|nach|neue|Modell|braucht|sucht)\b/i.test(parsed.lines.join(" "));

let fail = 0;
const check = (name, condition, detail = "") => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!condition) {
    fail += 1;
  }
};

check("the reasoning field was accepted (no 400 above)", true, `reasoning tokens: ${reasoningTokens === undefined ? "absent" : reasoningTokens}`);
check("reasoning did not eat the output budget", raw.trim().length > 0, `completion tokens: ${usage.completion_tokens}`);
check("the response parses", parsed.ok, JSON.stringify(parsed));
check("1 to 3 lines came back", parsed.lines.length >= 1 && parsed.lines.length <= 3, String(parsed.lines.length));
check("lines follow the German user message, not the English slice", german, parsed.lines.join(" | "));
check("no line announces a tool call", !/\b(searching|running|reading|let me search|ich suche jetzt)\b/i.test(parsed.lines.join(" ")), parsed.lines.join(" | "));

console.log("");
console.log(fail ? `${fail} check(s) failed. See plan section 6.2 for the decided fallbacks.` : "All checks passed. Record the reasoning-token number in the CHANGELOG entry.");
process.exit(fail ? 1 : 0);
