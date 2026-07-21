import fs from "node:fs";

const src = fs.readFileSync("D:/VantheaX/electron/main.js", "utf8");

const cut = (a, b) => {
  const s = src.indexOf(a);
  const e = src.indexOf(b, s);
  if (s === -1 || e === -1) {
    throw new Error(`anchor missing: ${a}`);
  }
  return src.slice(s, e);
};

const body = cut("const readOnlyToolNames =", "\nconst parseToolArguments =");

let passed = 0;
let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

const fakeSpecs = [
  { type: "function", function: { name: "read_file" } },
  { type: "function", function: { name: "write_file" } },
  { type: "function", function: { name: "run_command" } },
  { type: "function", function: { name: "web_search" } },
  { type: "function", function: { name: "present_plan" } },
  { type: "function", function: { name: "submit_result" } },
];
const mcp = [{ type: "function", function: { name: "mcp__srv__thing" } }];

const api = new Function("toolSpecs", "mcpManager",
  `${body}\nreturn { toolsForContext, localIsoStamp, localTimeZone, datetimeServerTool, datetimeFunctionTool, readOnlyToolNames, setOff: (v) => { serverDatetimeOff = v; } };`,
)(fakeSpecs, { getToolSpecs: () => mcp });

const names = (list) => list.map((tool) => (tool.type === "function" ? tool.function.name : tool.type));

// localIsoStamp matches the shape OpenRouter's datetime tool returns
{
  const stamp = api.localIsoStamp(new Date(Date.UTC(2026, 6, 21, 20, 49, 5, 7)));
  check("iso shape", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/.test(stamp), true);
  check("iso round-trips to the same instant", new Date(stamp).getTime(), Date.UTC(2026, 6, 21, 20, 49, 5, 7));
  check("iso keeps millis", stamp.slice(20, 23), "007");
}
{
  const now = new Date();
  check("iso of now round-trips", new Date(api.localIsoStamp(now)).getTime(), now.getTime());
}

// the tool objects themselves
{
  check("server tool type", api.datetimeServerTool.type, "openrouter:datetime");
  check("server tool carries the machine timezone", api.datetimeServerTool.parameters.timezone, api.localTimeZone);
  check("server tool has no function key", "function" in api.datetimeServerTool, false);
  check("local tool name", api.datetimeFunctionTool.function.name, "datetime");
  check("local tool takes no arguments", api.datetimeFunctionTool.function.parameters.properties, {});
  check("datetime survives plan-mode filtering", api.readOnlyToolNames.has("datetime"), true);
}

// OpenRouter route gets the server tool, NVIDIA gets the local function
{
  api.setOff(false);
  const or = api.toolsForContext({ webSearchEnabled: true }, undefined);
  check("openrouter gets the server tool", names(or).includes("openrouter:datetime"), true);
  check("openrouter does not also get the local one", names(or).filter((n) => n === "datetime").length, 0);

  const nv = api.toolsForContext({ webSearchEnabled: true }, "nvidia");
  check("nvidia gets the local function", names(nv).includes("datetime"), true);
  check("nvidia never sees the server tool", names(nv).includes("openrouter:datetime"), false);
}

// exactly one datetime tool, always, and it sits before the MCP specs
{
  api.setOff(false);
  const list = api.toolsForContext({ webSearchEnabled: true }, undefined);
  const dt = names(list).filter((n) => n === "openrouter:datetime" || n === "datetime");
  check("exactly one datetime tool", dt.length, 1);
  const mcpAt = names(list).indexOf("mcp__srv__thing");
  const dtAt = names(list).indexOf("openrouter:datetime");
  check("datetime sits before the mcp specs", dtAt < mcpAt, true);
  check("nativeSpecs slice still captures it", names(list.slice(0, list.length - mcp.length)).includes("openrouter:datetime"), true);
}

// the 4xx fallback swaps the server tool for the local one
{
  api.setOff(true);
  const list = api.toolsForContext({ webSearchEnabled: true }, undefined);
  check("fallback drops the server tool", names(list).includes("openrouter:datetime"), false);
  check("fallback uses the local function", names(list).includes("datetime"), true);
  api.setOff(false);
}

// plan mode keeps datetime and still drops the write tools
{
  const list = api.toolsForContext({ planMode: true, webSearchEnabled: true }, undefined);
  check("plan mode keeps datetime", names(list).includes("openrouter:datetime"), true);
  check("plan mode keeps read_file", names(list).includes("read_file"), true);
  check("plan mode drops write_file", names(list).includes("write_file"), false);
  check("plan mode drops run_command", names(list).includes("run_command"), false);
  check("plan mode drops mcp", names(list).includes("mcp__srv__thing"), false);
}

// nothing without a .function key ever reaches the spec filter
{
  const seen = [];
  const probe = new Function("toolSpecs", "mcpManager",
    `${body}\nreturn toolsForContext;`,
  )(
    new Proxy(fakeSpecs, { get: (t, k) => (k === "filter" ? (fn) => t.filter((x, i) => { seen.push(x.type); return fn(x, i); }) : t[k]) }),
    { getToolSpecs: () => mcp },
  );
  probe({ webSearchEnabled: true }, undefined);
  check("filter only ever saw function specs", seen.every((type) => type === "function"), true);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
