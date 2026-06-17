import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyMcpRisk, applyRiskOverride, extractCommandArg, extractTargetScope, scopeKey, capMcpResult, buildToolSpec, buildSpecName, collectArgStrings, MCP_MAX_RESULT_CHARS } from "../electron/mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainSrc = fs.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8");
const cs = mainSrc.indexOf("const commandIsCatastrophic");
const ce = mainSrc.indexOf("\nconst walkProject", cs);
const commandIsCatastrophic = new Function(`${mainSrc.slice(cs, ce)}\nreturn commandIsCatastrophic;`)();
const floorBlocks = (args) => {
  const cmd = extractCommandArg(args);
  const argStrings = collectArgStrings(args);
  const joined = argStrings.join(" ");
  return [cmd, ...argStrings, joined].filter((s) => typeof s === "string" && s).some((c) => Boolean(commandIsCatastrophic(c)));
};

let pass = 0;
let fail = 0;
const check = (label, cond) => {
  if (cond) {
    pass++;
    console.log(`OK    ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
  }
};

const t = (name, description, props) => ({ name, description: description || "", inputSchema: props ? { type: "object", properties: props } : null });

console.log("=== classifyMcpRisk ===");
for (const n of ["read_memory", "list_functions", "disassemble", "get_xrefs_to", "aob_scan", "decompile_function", "get_metadata", "enum_modules"]) {
  check(`${n} -> readonly`, classifyMcpRisk(t(n)) === "readonly");
}
for (const n of ["rename_function", "set_comment", "set_breakpoint", "save_table", "register_symbol", "declare_c_type"]) {
  check(`${n} -> state_change`, classifyMcpRisk(t(n)) === "state_change");
}
for (const n of ["write_memory", "write_process_memory_cr3", "inject_dll", "auto_assemble", "execute_code", "create_thread", "patch_address_assembles", "allocate_kernel_memory", "set_memory_protection", "dbk_write"]) {
  check(`${n} -> dangerous`, classifyMcpRisk(t(n)) === "dangerous");
}
for (const n of ["run_command", "shell_execute", "create_process"]) {
  check(`${n} -> shell_system`, classifyMcpRisk(t(n)) === "shell_system");
}
check("harmless name + command arg -> shell_system", classifyMcpRisk(t("do_thing", "", { command: { type: "string" } })) === "shell_system");
check("path arg alone -> NOT shell_system (read_file)", classifyMcpRisk(t("read_file", "read a file", { path: { type: "string" } })) === "readonly");
check("path arg + run verb -> shell_system (run_program)", classifyMcpRisk(t("run_program", "run an executable", { path: { type: "string" } })) === "shell_system");
check("read name + bytes+address schema -> dangerous (upgrade)", classifyMcpRisk(t("read_and_apply", "", { bytes: { type: "string" }, address: { type: "string" } })) === "dangerous");
check("unknown frobnicate -> state_change (never readonly)", classifyMcpRisk(t("frobnicate")) === "state_change");
check("desc says writes -> dangerous", classifyMcpRisk(t("apply_change", "this writes memory at address")) === "dangerous");

console.log("\n=== applyRiskOverride (downgrade schranken) ===");
check("dangerous -> state_change allowed", applyRiskOverride("dangerous", "state_change") === "state_change");
check("dangerous -> readonly CLAMPED to state_change", applyRiskOverride("dangerous", "readonly") === "state_change");
check("shell_system -> readonly IGNORED (stays shell_system)", applyRiskOverride("shell_system", "readonly") === "shell_system");
check("shell_system -> state_change IGNORED (stays shell_system)", applyRiskOverride("shell_system", "state_change") === "shell_system");
check("shell_system -> dangerous IGNORED (floor must never be lost)", applyRiskOverride("shell_system", "dangerous") === "shell_system");
check("readonly -> state_change allowed (upgrade)", applyRiskOverride("readonly", "state_change") === "state_change");
check("state_change -> readonly allowed (free)", applyRiskOverride("state_change", "readonly") === "readonly");
check("list_functions -> dangerous (upgrade honored)", applyRiskOverride("readonly", "dangerous") === "dangerous");
check("no override returns heuristic", applyRiskOverride("dangerous", undefined) === "dangerous");
check("bogus override ignored", applyRiskOverride("dangerous", "banana") === "dangerous");

console.log("\n=== extractCommandArg / extractTargetScope / scopeKey ===");
check("command arg extracted", extractCommandArg({ command: "format c:" }) === "format c:");
check("script arg extracted", extractCommandArg({ script: "rm x" }) === "rm x");
check("no command arg -> null", extractCommandArg({ value: 5, address: "0x10" }) === null);
const sA = extractTargetScope({ pid: 1234, address: "0x401000", size: 64 });
const sB = extractTargetScope({ pid: 1234, address: "0x401000", size: 64 });
const sC = extractTargetScope({ pid: 1234, address: "0x402000", size: 64 });
check("same scope -> same key", scopeKey(sA) === scopeKey(sB));
check("different address -> different key (re-ask)", scopeKey(sA) !== scopeKey(sC));
check("process scope extracted", extractTargetScope({ processName: "game.exe" }).process === "game.exe");
check("no scope -> null", extractTargetScope({ foo: 1 }) === null);

console.log("\n=== capMcpResult ===");
const big = "x".repeat(MCP_MAX_RESULT_CHARS + 5000);
const capped = capMcpResult({ content: [{ type: "text", text: big }] }, "ce", "read_memory", "dangerous");
check("text capped at limit", capped.content.length <= MCP_MAX_RESULT_CHARS + 200 && capped.truncated === true);
const img = capMcpResult({ content: [{ type: "image", data: "AAAA".repeat(1000), mimeType: "image/png" }] }, "ce", "screenshot", "readonly");
check("image not inlined as base64", img.content.includes("base64 chars omitted") && !img.content.includes("AAAAAAAA"));
const err = capMcpResult({ content: [{ type: "text", text: "boom" }], isError: true }, "ce", "x", "readonly");
check("isError prefixed", err.isError === true && err.content.startsWith("[MCP tool error]"));

console.log("\n=== buildToolSpec ===");
const spec = buildToolSpec("cheatengine", { name: "read_memory", description: "reads", inputSchema: { type: "object", properties: { address: { type: "string" } } } });
check("namespaced name", spec.function.name === "mcp__cheatengine__read_memory");
check("schema passed as parameters", spec.function.parameters.properties.address !== undefined);
const noSchema = buildToolSpec("srv", { name: "ping", description: "" });
check("missing schema -> open object", noSchema.function.parameters.additionalProperties === true);
const hugeProps = {};
for (let i = 0; i < 2000; i++) {
  hugeProps[`p${i}`] = { type: "string", description: "x".repeat(20) };
}
const huge = buildToolSpec("srv", { name: "big", description: "", inputSchema: { type: "object", properties: hugeProps } });
check("oversized schema degraded", huge.function.parameters.additionalProperties === true && huge.function.description.includes("schema omitted"));

console.log("\n=== buildSpecName (OpenRouter name safety) ===");
const validSpecName = (n) => /^[A-Za-z0-9_-]{1,64}$/.test(n);
check("clean name namespaced", buildSpecName("ce", "read_memory", new Set()) === "mcp__ce__read_memory");
check("weird chars sanitized", buildSpecName("ce", "read.memory!now", new Set()) === "mcp__ce__read_memory_now");
const longSpec = buildSpecName("cheatengine", "x".repeat(100), new Set());
check("over-64 name truncated + valid", longSpec.length <= 64 && validSpecName(longSpec));
const usedNames = new Set();
const specA = buildSpecName("ce", "scan", usedNames);
const specB = buildSpecName("ce", "scan", usedNames);
check("collision suffixed + unique + valid", specA === "mcp__ce__scan" && specB !== specA && validSpecName(specB));
check("empty raw name -> valid fallback", validSpecName(buildSpecName("ce", "", new Set())));

console.log("\n=== collectArgStrings + hardened shell_system floor (review finding #2) ===");
check("collectArgStrings nested object", collectArgStrings({ a: "x", b: { c: "y" } }).sort().join(",") === "x,y");
check("collectArgStrings array", collectArgStrings({ args: ["a", "b"] }).join(",") === "a,b");
check("floor catches standard key (command)", floorBlocks({ command: "format c:" }) === true);
check("floor catches non-standard key (code)", floorBlocks({ code: "format c:" }) === true);
check("floor catches argv-split (arguments array)", floorBlocks({ arguments: ["format", "c:"] }) === true);
check("floor catches non-standard key (input, reg delete HKLM)", floorBlocks({ input: "reg delete HKLM\\Software\\X /f" }) === true);
check("floor catches nested object cmd", floorBlocks({ opts: { cmd: "Remove-Item C:\\Windows -Recurse" } }) === true);
check("floor allows harmless argv", floorBlocks({ arguments: ["echo", "hello"] }) === false);
check("floor allows harmless install", floorBlocks({ command: "npm install" }) === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
