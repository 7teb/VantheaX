import { createReadStream } from "node:fs";
import readline from "node:readline";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const maxGrepMatches = 5000;

const grepFileStream = (absolutePath, needle, filePath, matches, limit) => new Promise((resolve) => {
  let settled = false;
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    resolve();
  };
  let stream;
  try {
    stream = createReadStream(absolutePath, { encoding: "utf8" });
  } catch {
    finish();
    return;
  }
  stream.on("error", finish);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  rl.on("line", (line) => {
    if (settled) {
      return;
    }
    lineNo += 1;
    if (line.toLowerCase().includes(needle)) {
      matches.push({ path: filePath, line: lineNo, text: line.slice(0, 500) });
      if (matches.length >= limit) {
        rl.close();
        stream.destroy();
        finish();
      }
    }
  });
  rl.on("close", finish);
  rl.on("error", finish);
});

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vgrep-"));
const file = path.join(dir, "big.md");

let buf = "";
let expected = 0;
for (let i = 1; i <= 200000; i += 1) {
  if (i % 43 === 0) {
    buf += "static int ADDRESS_GAMEMANAGER = 0x4A8BE58;\n";
    expected += 1;
  } else {
    buf += `### Post ${i} filler line padding to grow the file size here\n`;
  }
}
await fs.writeFile(file, buf, "utf8");
const size = (await fs.stat(file)).size;

const matches = [];
await grepFileStream(file, "gamemanager", "big.md", matches, maxGrepMatches);
const firstLine = matches[0] ? matches[0].line : -1;
const okFirst = firstLine === 43;
const okCount = matches.length === Math.min(expected, maxGrepMatches);

const capped = [];
await grepFileStream(file, "gamemanager", "big.md", capped, 10);
const okCap = capped.length === 10;

console.log("file size bytes:", size, "over2MB:", size > 2 * 1024 * 1024);
console.log("expected hits:", expected, "found:", matches.length, "firstLine:", firstLine);
console.log("PASS firstLine==43:", okFirst);
console.log("PASS count:", okCount);
console.log("PASS cap10:", okCap);
console.log(okFirst && okCount && okCap ? "ALL_PASS" : "FAIL");

await fs.rm(dir, { recursive: true, force: true });
