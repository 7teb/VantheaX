import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src", "main.jsx"), "utf8");
const start = source.indexOf("const isEditTool =");
const end = source.indexOf("const PREVIEW_MAX_LINES =", start);

if (start < 0 || end < 0) {
  throw new Error("Could not extract MCP grouping logic");
}

const runtime = new Function(`${source.slice(start, end)}return { clusterKind, groupWorkSegments };`);
const { clusterKind, groupWorkSegments } = runtime();
let passed = 0;

const check = (condition, name) => {
  if (!condition) {
    throw new Error(`FAIL: ${name}`);
  }
  passed += 1;
};

const mcpTool = (id, tool = "get_address_info") => ({
  id,
  name: `mcp__cheatengine-mcp__${tool}`,
  result: {
    mcp: true,
    mcpServer: "cheatengine-mcp",
    mcpTool: tool,
    content: id,
  },
});

const seven = Array.from({ length: 7 }, (_, index) => ({
  type: "tool",
  tool: mcpTool(`mcp-${index + 1}`),
}));
const grouped = groupWorkSegments(seven);

check(grouped.length === 1, "seven consecutive MCP calls form one block");
check(grouped[0].kind === "bundle", "MCP calls use the shared bundle");
check(grouped[0].tools.length === 7, "the MCP block keeps all seven calls");
check(clusterKind(mcpTool("direct")) === "mcp", "an MCP tool is classified directly");
check(clusterKind({ name: "native", result: { mcp: true } }) === "mcp", "MCP result metadata is classified");

const separated = groupWorkSegments([
  ...seven.slice(0, 3),
  { type: "text", content: "Weiter." },
  ...seven.slice(3),
]);

check(separated.length === 3, "narration separates MCP runs");
check(separated[0].tools.length === 3 && separated[2].tools.length === 4, "separate MCP runs keep their counts");

const permission = mcpTool("permission");
permission.result.permissionRequired = true;
check(clusterKind(permission) === null, "permission prompts stay ungrouped");

const running = mcpTool("running");
running.result.running = true;
check(clusterKind(running) === null, "running MCP calls stay live");

check(source.includes('"cluster.mcp": "Ran {n} MCP commands"'), "English MCP label is present");
check(source.includes('"cluster.mcp": "{n} MCP-Befehle ausgeführt"'), "German MCP label is present");
check(source.includes("kind === \"mcp\" ? WorkflowIcon"), "MCP groups use the workflow icon");

const browserCalls = ["browser_navigate", "browser_wait", "browser_snapshot"].map((name, index) => ({
  type: "tool",
  tool: {
    id: `browser-${index + 1}`,
    name,
    result: { browser: true, content: name },
  },
}));
const browserGrouped = groupWorkSegments(browserCalls);

check(browserGrouped.length === 1, "consecutive browser calls form one block");
check(browserGrouped[0].kind === "bundle", "browser calls use the shared bundle");
check(browserGrouped[0].tools.length === 3, "the browser bundle keeps every call");
check(clusterKind(browserCalls[0].tool) === "browser", "browser tools are classified directly");

const failedBrowser = browserCalls[0].tool;
failedBrowser.result.error = "failed";
check(clusterKind(failedBrowser) === null, "failed browser calls stay ungrouped");

check(source.includes('"cluster.browser": "Used the browser {n} times"'), "English browser label is present");
check(source.includes('"cluster.browser": "{n} Browseraktionen ausgeführt"'), "German browser label is present");
check(source.includes('kind === "browser" ? Globe'), "browser groups use the globe icon");
check(source.includes("return SummaryIcon"), "file listings use the summary icon");
check(source.includes("return SquareChartGanttIcon"), "single file reads use the gantt icon");

console.log(`${passed} tool grouping checks passed`);
