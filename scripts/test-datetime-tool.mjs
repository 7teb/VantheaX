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
  `${body}\nreturn { toolsForContext, localIsoStamp, localTimeZone, datetimeFunctionTool, readOnlyToolNames };`,
)(fakeSpecs, { getToolSpecs: () => mcp });

const names = (list) => list.map((tool) => (tool.type === "function" ? tool.function.name : tool.type));

// localIsoStamp matches the {datetime, timezone} shape the tool returns
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

// the tool is a plain function tool, never the openrouter:datetime server tool (which poisons the request)
{
  check("datetime is a function tool", api.datetimeFunctionTool.type, "function");
  check("datetime tool name", api.datetimeFunctionTool.function.name, "datetime");
  check("datetime takes no arguments", api.datetimeFunctionTool.function.parameters.properties, {});
  check("datetime survives plan-mode filtering", api.readOnlyToolNames.has("datetime"), true);
}

// BOTH routes get the same plain function tool, and the openrouter server-tool type never appears
{
  const list = api.toolsForContext({ webSearchEnabled: true });
  check("datetime function tool is present", names(list).includes("datetime"), true);
  check("no openrouter:datetime server tool anywhere", names(list).includes("openrouter:datetime"), false);
  check("exactly one datetime tool", names(list).filter((n) => n === "datetime").length, 1);
  const mcpAt = names(list).indexOf("mcp__srv__thing");
  const dtAt = names(list).indexOf("datetime");
  check("datetime sits before the mcp specs", dtAt < mcpAt, true);
  check("nativeSpecs slice still captures it", names(list.slice(0, list.length - mcp.length)).includes("datetime"), true);
}

// plan mode keeps datetime (read-only) and still drops the write tools and mcp
{
  const list = api.toolsForContext({ planMode: true, webSearchEnabled: true });
  check("plan mode keeps datetime", names(list).includes("datetime"), true);
  check("plan mode keeps read_file", names(list).includes("read_file"), true);
  check("plan mode drops write_file", names(list).includes("write_file"), false);
  check("plan mode drops run_command", names(list).includes("run_command"), false);
  check("plan mode drops mcp", names(list).includes("mcp__srv__thing"), false);
}

// web search off drops the web_search tool, on keeps it
{
  check("web off drops web_search", names(api.toolsForContext({ webSearchEnabled: false })).includes("web_search"), false);
  check("web on keeps web_search", names(api.toolsForContext({ webSearchEnabled: true })).includes("web_search"), true);
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
  probe({ webSearchEnabled: true });
  check("filter only ever saw function specs", seen.every((type) => type === "function"), true);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
