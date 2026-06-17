import path from "node:path";
import { fileURLToPath } from "node:url";
import { mcpManager } from "../electron/mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "test-mcp-server.mjs");

let pass = 0;
let fail = 0;
const check = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`OK    ${label}${extra ? "  " + extra : ""}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}${extra ? "  " + extra : ""}`);
  }
};

const cfg = { testsrv: { type: "stdio", command: process.execPath, args: [serverPath], enabled: true } };

await mcpManager.syncFromSettings(cfg);

const status = mcpManager.getStatusForRenderer();
const srv = status.find((s) => s.name === "testsrv");
check("server connected (ready)", srv && srv.status === "ready", srv ? srv.status : "no status");
check("tools listed", srv && srv.toolCount === 6, srv ? `${srv.toolCount} tools` : "");

const tierOf = (name) => (srv?.tools || []).find((t) => t.name === name)?.tier;
check("read_value -> readonly", tierOf("read_value") === "readonly", tierOf("read_value"));
check("list_things -> readonly", tierOf("list_things") === "readonly", tierOf("list_things"));
check("set_label -> state_change", tierOf("set_label") === "state_change", tierOf("set_label"));
check("write_memory -> dangerous", tierOf("write_memory") === "dangerous", tierOf("write_memory"));
check("run_command -> shell_system", tierOf("run_command") === "shell_system", tierOf("run_command"));

const specs = mcpManager.getToolSpecs();
check("tool specs namespaced", specs.some((s) => s.function.name === "mcp__testsrv__read_value"), `${specs.length} specs`);

const ref = mcpManager.findTool("mcp__testsrv__write_memory");
check("findTool resolves tier", ref && ref.found && ref.tier === "dangerous", ref ? ref.tier : "null");

const r1 = await mcpManager.callTool("testsrv", "read_value", { key: "hp" });
check("callTool read_value returns text", r1 && !r1.isError && r1.content.includes("= 42"), JSON.stringify(r1?.content || "").slice(0, 50));

const r2 = await mcpManager.callTool("testsrv", "write_memory", { address: "0x401000", bytes: "90" });
check("callTool write_memory is no-op text", r2 && !r2.isError && r2.content.includes("nothing was written"), "");

const r3 = await mcpManager.callTool("testsrv", "nope_missing", {});
check("callTool unknown -> error result (no crash)", r3 && (r3.isError || r3.content.includes("error") || r3.content.includes("unknown")), "");

await mcpManager.shutdownAll();
const after = mcpManager.getStatusForRenderer();
check("shutdown removes server", !after.find((s) => s.name === "testsrv"), `${after.length} left`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
