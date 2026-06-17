import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const tools = [
  { name: "ping", description: "health check", inputSchema: { type: "object", properties: {} } },
  { name: "read_value", description: "read a value (safe, returns a number)", inputSchema: { type: "object", properties: { key: { type: "string" } } } },
  { name: "list_things", description: "list things (safe)", inputSchema: { type: "object", properties: {} } },
  { name: "set_label", description: "set a label (state change, safe no-op)", inputSchema: { type: "object", properties: { label: { type: "string" } } } },
  { name: "write_memory", description: "write bytes to an address (SAFE TEST NO-OP, writes nothing)", inputSchema: { type: "object", properties: { address: { type: "string" }, bytes: { type: "string" } } } },
  { name: "run_command", description: "run a shell command (SAFE TEST NO-OP, does NOT execute)", inputSchema: { type: "object", properties: { command: { type: "string" } } } },
];

const server = new Server({ name: "vanthea-test-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = req.params.arguments || {};
  let text;
  if (name === "ping") {
    text = "pong";
  } else if (name === "read_value") {
    text = `value of ${args.key || "?"} = 42 (test)`;
  } else if (name === "list_things") {
    text = "thing-a\nthing-b\nthing-c";
  } else if (name === "set_label") {
    text = `label set to "${args.label || ""}" (test no-op, nothing changed)`;
  } else if (name === "write_memory") {
    text = `(test no-op) would write ${args.bytes || ""} to ${args.address || ""} — nothing was written`;
  } else if (name === "run_command") {
    text = `(test no-op) would run: ${args.command || ""} — nothing was executed`;
  } else {
    text = `unknown tool ${name}`;
  }
  return { content: [{ type: "text", text }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
