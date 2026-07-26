import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readTextWindow } from "../electron/text-window.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "vantheax-text-window-"));
const normalFile = path.join(root, "normal.txt");
const lines = Array.from({ length: 10000 }, (_, index) => `line-${index + 1}`);
await fs.writeFile(normalFile, lines.join("\n"), "utf8");

const window = await readTextWindow(normalFile, "normal.txt", 500, 20, 50000, 25000);
assert.equal(window.startLine, 500);
assert.equal(window.endLine, 519);
assert.equal(window.totalLines, 10000);
assert.equal(window.tooLarge, false);
assert.match(window.content, /^500: line-500/);
assert.match(window.content, /519: line-519$/);

const longBeforeFile = path.join(root, "long-before.txt");
await fs.writeFile(longBeforeFile, `${"a".repeat(180000)}\nneedle`, "utf8");
const afterLongLine = await readTextWindow(longBeforeFile, "long-before.txt", 2, 1, 50000, 25000);
assert.equal(afterLongLine.tooLarge, false);
assert.equal(afterLongLine.totalLines, 2);
assert.equal(afterLongLine.content, "2: needle");

const longSelectedFile = path.join(root, "long-selected.txt");
await fs.writeFile(longSelectedFile, "b".repeat(180000), "utf8");
const longSelected = await readTextWindow(longSelectedFile, "long-selected.txt", 1, 1, 50000, 25000);
assert.equal(longSelected.tooLarge, true);
assert.equal(longSelected.totalLines, 1);

const tokenFile = path.join(root, "token-cap.txt");
await fs.writeFile(tokenFile, Array.from({ length: 100 }, () => "z".repeat(1000)).join("\n"), "utf8");
const tokenCapped = await readTextWindow(tokenFile, "token-cap.txt", 1, 100, 50000, 500);
assert.equal(tokenCapped.tooLarge, true);
assert.ok(tokenCapped.content.length < 3000);

await fs.rm(root, { recursive: true, force: true });
console.log("text window tests passed");
