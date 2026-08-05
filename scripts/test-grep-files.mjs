import fsSync, { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fsSync.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8");

const grabLine = (prefix) => {
  const start = src.indexOf(prefix);
  if (start === -1) {
    throw new Error(`missing anchor: ${prefix}`);
  }
  return src.slice(start, src.indexOf("\n", start) + 1);
};

const grabTo = (startMarker, endMarker) => {
  const start = src.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`missing anchor: ${startMarker}`);
  }
  const end = src.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`missing end anchor after: ${startMarker}`);
  }
  return src.slice(start, end);
};

const code = [
  grabLine("const ignoredDirs"),
  grabLine("const secretFilePatterns"),
  grabLine("const textExtensions"),
  grabLine("const maxIndexFileBytes"),
  grabLine("const maxGrepMatches"),
  grabLine("const maxGrepLineChars"),
  grabLine("const isTextFile"),
  grabTo("const isSecretPath", "\nconst "),
  grabTo("const normalizeProjectPath", "\nconst maxWriteBytes"),
  grabTo("const walkProject", "\nconst loadAgentsDoc"),
  grabTo("const grepMatcher", "\nconst getFileOutline"),
].join("\n");

const grepProjectFiles = new Function("fs", "path", "createReadStream", "readline", `${code}\nreturn grepProjectFiles;`)(fs, path, createReadStream, readline);

const root = fsSync.mkdtempSync(path.join(os.tmpdir(), "vx-grep-"));
const put = (relative, content) => {
  const absolute = path.join(root, relative);
  fsSync.mkdirSync(path.dirname(absolute), { recursive: true });
  fsSync.writeFileSync(absolute, content, "utf8");
};

put("src/features/a.cpp", [
  '#include "core.hpp"',
  "class GameManager {",
  "static auto get_instance -> game_manager*",
  "GameManager::get_instance;",
  "}",
].join("\n"));
put("src/other/b.cpp", ["auto x = gamemanager_ref;", "int y = 0;"].join("\n"));
put("lib/c.txt", ["foo.bar value", "fooXbar value", "a+b = c", "Controller::Get() called", "open ( paren"].join("\n"));
put("cap/exact.txt", Array.from({ length: 200 }, (_, i) => `caphit ${i}`).join("\n"));
put("cap/over.txt", Array.from({ length: 201 }, (_, i) => `caphit ${i}`).join("\n"));
const bigLines = Array.from({ length: 22000 }, (_, i) => `filler line ${i} ${"x".repeat(90)}`);
bigLines[4] = "has streamneedle marker";
bigLines[11110] = "has streamneedle marker";
bigLines[21998] = "has streamneedle marker";
put("cap/streambig.txt", bigLines.join("\n"));
put("long/longline.txt", `${"y".repeat(400)} longmark ${"y".repeat(400)}`);
put("notes.log", "loghit here");

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

const run = (args) => grepProjectFiles(root, args);

const r1 = await run({ query: "GameManager" });
check("default literal ci finds all casings", r1.count === 3, String(r1.count));
check("default mode is literal", r1.mode === "literal" && r1.caseSensitive === false && r1.regexFallback === false);
check("default is not capped", r1.capped === false);
check("paths are root-relative with forward slashes", r1.matches.every((m) => !path.isAbsolute(m.path) && !m.path.includes("\\")), JSON.stringify(r1.matches.map((m) => m.path)));

const r2 = await run({ query: "gamemanager" });
check("lowercase query matches the same lines", r2.count === 3, String(r2.count));

const r3 = await run({ query: "GameManager", case_sensitive: true });
check("case_sensitive excludes other casings", r3.count === 2 && r3.matches.every((m) => m.path === "src/features/a.cpp"), JSON.stringify(r3.matches));

const r4 = await run({ query: "foo.bar" });
check("literal dot does not act as wildcard", r4.count === 1 && r4.matches[0].line === 1, JSON.stringify(r4.matches));

const r5 = await run({ query: "foo.bar", regex: true });
check("regex dot acts as wildcard", r5.count === 2 && r5.mode === "regex", JSON.stringify(r5.matches));

const r6 = await run({ query: "a+b", path: "lib/c.txt" });
check("literal plus matches literally", r6.count === 1 && r6.matches[0].line === 3, JSON.stringify(r6.matches));

const r7 = await run({ query: "a+b", regex: true, path: "lib/c.txt" });
check("regex plus is a quantifier", r7.count === 0 && r7.mode === "regex" && r7.regexFallback === false, JSON.stringify(r7));

const r8 = await run({ query: "Controller::Get()" });
check("parens in literal query match literally", r8.count === 1, String(r8.count));

const r9 = await run({ query: "(", regex: true, path: "lib/" });
check("invalid regex falls back to literal", r9.regexFallback === true && r9.mode === "literal", JSON.stringify({ mode: r9.mode, fallback: r9.regexFallback }));
check("fallback still finds literal matches", r9.count === 2, String(r9.count));

const r10 = await run({ query: "GameManager", path: "src/features/" });
check("directory path restricts the walk", r10.count === 2 && r10.matches.every((m) => m.path.startsWith("src/features/")), JSON.stringify(r10.matches));
check("line numbers are correct", r10.matches.map((m) => m.line).join(",") === "2,4", r10.matches.map((m) => m.line).join(","));

const r11 = await run({ query: "gamemanager", path: "src/other/b.cpp" });
check("file path restricts to that file", r11.count === 1 && r11.matches[0].path === "src/other/b.cpp", JSON.stringify(r11.matches));

const r12 = await run({ query: "caphit", path: "cap/exact.txt" });
check("exactly 200 matches is not capped", r12.count === 200 && r12.capped === false, `count ${r12.count} capped ${r12.capped}`);

const r13 = await run({ query: "caphit", path: "cap/over.txt" });
check("201 matches is capped at 200", r13.count === 200 && r13.capped === true && r13.matches.length === 200, `count ${r13.count} capped ${r13.capped}`);

const r14 = await run({ query: "caphit" });
check("project-wide overflow is capped", r14.count === 200 && r14.capped === true, `count ${r14.count} capped ${r14.capped}`);

const r15 = await run({ query: "\\b(?:game_?manager|get_?instance)\\b", regex: true });
check("word-boundary regex skips embedded identifiers", r15.count === 3 && r15.matches.every((m) => m.path === "src/features/a.cpp"), JSON.stringify(r15.matches));

const r16 = await run({ query: "\\bauto\\s+get_instance\\b", regex: true, case_sensitive: true, path: "src/" });
check("definition-oriented regex finds only the definition", r16.count === 1 && r16.matches[0].line === 3, JSON.stringify(r16.matches));

const r17 = await run({ query: "streamneedle", path: "cap/streambig.txt" });
check("streamed large file uses the matcher", r17.count === 3 && r17.matches.map((m) => m.line).join(",") === "5,11111,21999", JSON.stringify(r17.matches.map((m) => m.line)));

const r18 = await run({ query: "longmark" });
check("line preview is bounded to 300 chars", r18.count === 1 && r18.matches[0].text.length <= 300, String(r18.matches[0]?.text.length));

const r19raw = JSON.stringify(r13);
check("metadata precedes matches in the payload", r19raw.indexOf('"capped"') < r19raw.indexOf('"matches"') && r19raw.indexOf('"count"') < r19raw.indexOf('"matches"'));

let threw = false;
try {
  await run({ query: "x", path: "../" });
} catch {
  threw = true;
}
check("path outside the project throws", threw);

const r21 = await run({ query: "loghit", path: "notes.log" });
check("explicit file skips the extension filter", r21.count === 1, String(r21.count));
const r22 = await run({ query: "loghit" });
check("directory walk keeps the extension filter", r22.count === 0, String(r22.count));

const r23 = await run({ query: "   " });
check("blank query returns empty result", r23.count === 0 && r23.matches.length === 0 && r23.capped === false);

await fs.rm(root, { recursive: true, force: true });
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
