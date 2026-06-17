import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8");

const start = src.indexOf("const commandIsCatastrophic");
const end = src.indexOf("\nconst walkProject", start);
if (start === -1 || end === -1) {
  console.error("Could not extract commandIsCatastrophic from main.js");
  process.exit(1);
}
const fnSrc = src.slice(start, end);
const commandIsCatastrophic = new Function(`${fnSrc}\nreturn commandIsCatastrophic;`)();

const catastrophic = [
  "format c:",
  "format /q /fs:ntfs d:",
  "diskpart",
  "diskpart /s script.txt",
  "bcdedit /delete {current}",
  "Clear-Disk -Number 0 -RemoveData",
  "Format-Volume -DriveLetter C",
  "Initialize-Disk -Number 1",
  "Remove-Item C:\\Windows -Recurse -Force",
  "Remove-Item C:\\Windows\\System32\\kernel32.dll",
  "rm C:\\Windows -r",
  "del C:\\Windows\\System32\\drivers\\etc\\hosts",
  "rd /s /q C:\\Windows",
  "rmdir /s C:\\Program Files",
  "Remove-Item %SystemRoot% -Recurse",
  "Remove-Item $env:windir -Recurse",
  "Remove-Item C:\\ -Recurse -Force",
  "Remove-Item \"C:\\\" -Recurse",
  "del C:\\Boot\\BCD",
  "reg delete HKLM\\SOFTWARE\\Microsoft /f",
  "reg delete \"HKEY_LOCAL_MACHINE\\SYSTEM\" /f",
  "Remove-Item HKLM:\\SOFTWARE\\Foo -Recurse",
];

const harmless = [
  "npm install",
  "Remove-Item dist -Recurse -Force",
  "Remove-Item .\\build\\out.js",
  "rm node_modules -r",
  "Format-Table",
  "Get-ChildItem C:\\Windows",
  "dir C:\\Windows\\System32",
  "Get-Content 'C:\\Program Files\\foo\\bar.txt'",
  "git status",
  "Remove-Item C:\\Users\\user\\project\\old.txt",
  "node build.js",
  "del report-system32-backup.log",
  "echo formatting complete",
  "npm run build | Select-String error",
];

let pass = 0;
let fail = 0;
console.log("=== MUST BLOCK (catastrophic) ===");
for (const cmd of catastrophic) {
  const r = commandIsCatastrophic(cmd);
  const ok = Boolean(r);
  console.log(`${ok ? "OK  " : "FAIL"}  ${cmd}   ${ok ? "-> " + r : "-> NOT BLOCKED"}`);
  ok ? pass++ : fail++;
}
console.log("\n=== MUST RUN (harmless / dev) ===");
for (const cmd of harmless) {
  const r = commandIsCatastrophic(cmd);
  const ok = !r;
  console.log(`${ok ? "OK  " : "FAIL"}  ${cmd}   ${ok ? "" : "-> WRONGLY BLOCKED: " + r}`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
