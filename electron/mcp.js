import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { spawn } from "node:child_process";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";

export const MCP_TIERS = ["readonly", "state_change", "dangerous", "shell_system"];
export const MCP_MAX_DESC = 500;
export const MCP_MAX_SCHEMA = 4000;
export const MCP_MAX_RESULT_CHARS = 100000;

const SHELL_NAME = /(^|_)(run_command|shell_execute|exec|create_process|open_process|spawn|launch|start_process)(_|$)/i;
const SHELL_STRONG_KEYS = new Set(["command", "cmd", "commandline", "command_line", "script", "powershell", "shell", "exec"]);
const SHELL_WEAK_KEYS = new Set(["path", "exe", "program", "file", "application", "executable"]);
const EXEC_VERB = /\b(run|execute|spawn|shell|create[_ ]?process|open[_ ]?process|launch|start)\b/i;

const DANGEROUS_NAME = /(write_|write_memory|write_process|patch|inject|auto_assemble|(?<![a-z])assemble|execute_code|execute_method|create_thread|alloc|allocate|set_memory_protection|freeze|modify|kernel|dbvm|dbk_|cr3|map_memory|set_context|poke|unprotect)/i;
const DANGEROUS_DESC = /\b(writes?|modif(y|ies)|injects?|patch(es)?|execute|executes|allocat(e|es)|overwrites?)\b/i;
const WRITE_PAYLOAD_KEYS = new Set(["bytes", "data", "value", "buffer", "assembly", "opcodes", "payload", "content"]);
const TARGET_KEYS = new Set(["address", "addr", "pid", "handle", "base"]);

const STATE_CHANGE_NAME = /(rename|set_|add_|create_|delete_|remove_|comment|label|breakpoint|register_|declare_|define_|save_|import|apply|update_)/i;
const READONLY_NAME = /(read_|list_|get_|disassemble|decompile|search|scan|enum_|analyze|find_|metadata|info|check_|xref|dump)/i;

const schemaKeys = (schema) => {
  if (!schema || typeof schema !== "object" || !schema.properties || typeof schema.properties !== "object") {
    return [];
  }
  return Object.keys(schema.properties).map((k) => k.toLowerCase());
};

export const classifyMcpRisk = (tool) => {
  const name = String(tool?.name || "").toLowerCase();
  const desc = String(tool?.description || "");
  const keys = schemaKeys(tool?.inputSchema);
  if (SHELL_NAME.test(name)) {
    return "shell_system";
  }
  if (keys.some((k) => SHELL_STRONG_KEYS.has(k))) {
    return "shell_system";
  }
  if (keys.some((k) => SHELL_WEAK_KEYS.has(k)) && (EXEC_VERB.test(name) || EXEC_VERB.test(desc))) {
    return "shell_system";
  }
  if (DANGEROUS_NAME.test(name) || DANGEROUS_DESC.test(desc)) {
    return "dangerous";
  }
  if (keys.some((k) => WRITE_PAYLOAD_KEYS.has(k)) && keys.some((k) => TARGET_KEYS.has(k))) {
    return "dangerous";
  }
  if (STATE_CHANGE_NAME.test(name)) {
    return "state_change";
  }
  if (READONLY_NAME.test(name) && !keys.some((k) => WRITE_PAYLOAD_KEYS.has(k))) {
    return "readonly";
  }
  return "state_change";
};

const RANK = { readonly: 0, state_change: 1, dangerous: 2, shell_system: 3 };

export const applyRiskOverride = (heuristic, override) => {
  if (!override || !MCP_TIERS.includes(override) || override === heuristic) {
    return heuristic;
  }
  if (heuristic === "shell_system") {
    return "shell_system";
  }
  if (override === "shell_system") {
    return "shell_system";
  }
  if (heuristic === "dangerous" && override === "readonly") {
    return "state_change";
  }
  return override;
};

const CMD_ARG_KEYS = ["command", "cmd", "commandline", "command_line", "script", "exec", "powershell", "shell", "path", "exe", "program"];

export const extractCommandArg = (args) => {
  if (!args || typeof args !== "object") {
    return null;
  }
  for (const key of Object.keys(args)) {
    if (CMD_ARG_KEYS.includes(key.toLowerCase())) {
      const value = args[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
      if (Array.isArray(value)) {
        const joined = value.filter((item) => typeof item === "string").join(" ");
        if (joined.trim()) {
          return joined;
        }
      }
    }
  }
  return null;
};

export const collectArgStrings = (value, depth = 0, out = []) => {
  if (depth > 6 || out.length > 200) {
    return out;
  }
  if (typeof value === "string") {
    if (value) {
      out.push(value);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectArgStrings(item, depth + 1, out);
    }
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      collectArgStrings(value[key], depth + 1, out);
    }
  }
  return out;
};

export const extractTargetScope = (args) => {
  if (!args || typeof args !== "object") {
    return null;
  }
  const scope = {};
  for (const key of Object.keys(args)) {
    const lower = key.toLowerCase();
    if (["pid", "processid", "process_id"].includes(lower)) {
      scope.pid = String(args[key]);
    } else if (["process", "processname", "process_name", "executable"].includes(lower)) {
      scope.process = String(args[key]).toLowerCase();
    } else if (["module", "modulename", "module_name", "dll"].includes(lower)) {
      scope.module = String(args[key]).toLowerCase();
    } else if (["address", "addr", "base"].includes(lower)) {
      scope.address = String(args[key]);
    } else if (["size", "length", "len", "count"].includes(lower)) {
      scope.size = String(args[key]);
    }
  }
  return Object.keys(scope).length ? scope : null;
};

export const scopeKey = (scope) => {
  if (!scope) {
    return "";
  }
  return ["pid", "process", "module", "address", "size"].map((k) => `${k}=${scope[k] ?? ""}`).join("|");
};

const normalizeSchema = (schema) => {
  if (!schema || typeof schema !== "object" || schema.type !== "object" || !schema.properties) {
    return { type: "object", properties: {}, additionalProperties: true };
  }
  return schema;
};

export const capDescription = (description, fallback) => {
  const text = String(description || fallback || "").trim();
  if (text.length > MCP_MAX_DESC) {
    return `${text.slice(0, MCP_MAX_DESC)} …(truncated)`;
  }
  return text;
};

export const buildSpecName = (server, rawName, used) => {
  const safe = String(rawName || "tool").replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "tool";
  const prefix = `mcp__${server}__`;
  let base = `${prefix}${safe}`;
  if (base.length > 64) {
    const room = Math.max(1, 64 - prefix.length);
    base = `${prefix}${safe.slice(0, room)}`.slice(0, 64);
  }
  let name = base;
  let i = 2;
  while (used && used.has(name)) {
    const suffix = `_${i}`;
    name = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    i += 1;
  }
  if (used) {
    used.add(name);
  }
  return name;
};

export const buildToolSpec = (server, tool) => {
  const norm = normalizeSchema(tool.inputSchema);
  let params = norm;
  let degraded = false;
  let serialized = "";
  try {
    serialized = JSON.stringify(norm);
  } catch {
    serialized = "";
    params = { type: "object", properties: {}, additionalProperties: true };
    degraded = true;
  }
  if (serialized && serialized.length > MCP_MAX_SCHEMA) {
    params = { type: "object", properties: {}, additionalProperties: true };
    degraded = true;
  }
  let description = capDescription(tool.description, `${tool.name} (MCP server ${server})`);
  if (degraded) {
    description = capDescription(`${description} [schema omitted: too large, pass arguments as the server expects]`);
  }
  const specName = tool.specFullName || `mcp__${server}__${tool.name}`;
  return { type: "function", function: { name: specName, description, parameters: params } };
};

export const capMcpResult = (res, server, tool, tier) => {
  const parts = Array.isArray(res?.content) ? res.content : [];
  const texts = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue;
    }
    if (part.type === "text") {
      texts.push(String(part.text || ""));
    } else if (part.type === "image") {
      const len = String(part.data || "").length;
      texts.push(`[image: ${part.mimeType || "image"}, ${len} base64 chars omitted]`);
    } else if (part.type === "resource") {
      texts.push(`[resource: ${part.resource?.uri || "embedded"}, not inlined]`);
    } else {
      texts.push(`[${part.type || "unknown"} content omitted]`);
    }
  }
  let content = texts.join("\n");
  let truncated = false;
  if (content.length > MCP_MAX_RESULT_CHARS) {
    content = `${content.slice(0, MCP_MAX_RESULT_CHARS)}\n…[MCP result truncated: showing ${MCP_MAX_RESULT_CHARS} of ${content.length} chars, request a smaller range or page]`;
    truncated = true;
  }
  const isError = Boolean(res?.isError);
  if (isError) {
    content = `[MCP tool error] ${content}`;
  }
  return { mcp: true, server, tool, tier, isError, truncated, content: content || "(empty result)" };
};

const resolveWindowsCommand = (command, args) => {
  if (process.platform === "win32") {
    const lower = String(command || "").toLowerCase();
    const isShim = lower.endsWith(".cmd") || lower.endsWith(".bat") || ["npx", "npm", "uvx", "uv", "pnpm", "yarn"].includes(lower);
    if (isShim) {
      return { command: process.env.ComSpec || "cmd.exe", args: ["/c", command, ...args] };
    }
  }
  return { command, args };
};

const isElectronProcess = () => "type" in process;

class HiddenStdioTransport {
  constructor(params) {
    this._params = params;
    this._abort = new AbortController();
    this._readBuffer = new ReadBuffer();
    this._process = null;
  }
  async start() {
    if (this._process) {
      throw new Error("Transport already started");
    }
    return new Promise((resolve, reject) => {
      this._process = spawn(this._params.command, this._params.args || [], {
        env: this._params.env || process.env,
        stdio: ["pipe", "pipe", this._params.stderr || "inherit"],
        shell: false,
        signal: this._abort.signal,
        detached: false,
        windowsHide: true,
      });
      this._process.on("error", (error) => {
        if (error.name === "AbortError") {
          if (this.onclose) {
            this.onclose();
          }
          return;
        }
        reject(error);
        if (this.onerror) {
          this.onerror(error);
        }
      });
      this._process.on("spawn", () => resolve());
      this._process.on("close", () => {
        this._process = null;
        if (this.onclose) {
          this.onclose();
        }
      });
      if (this._process.stdin) {
        this._process.stdin.on("error", (error) => {
          if (this.onerror) {
            this.onerror(error);
          }
        });
      }
      if (this._process.stdout) {
        this._process.stdout.on("data", (chunk) => {
          this._readBuffer.append(chunk);
          this._drain();
        });
        this._process.stdout.on("error", (error) => {
          if (this.onerror) {
            this.onerror(error);
          }
        });
      }
    });
  }
  get stderr() {
    return this._process ? this._process.stderr : null;
  }
  _drain() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        if (this.onmessage) {
          this.onmessage(message);
        }
      } catch (error) {
        if (this.onerror) {
          this.onerror(error);
        }
      }
    }
  }
  async close() {
    const proc = this._process;
    this._process = null;
    if (proc && proc.pid && process.platform === "win32") {
      try {
        spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { windowsHide: true });
      } catch {}
    }
    try {
      this._abort.abort();
    } catch {}
    this._readBuffer.clear();
  }
  send(message) {
    return new Promise((resolve) => {
      if (!this._process || !this._process.stdin) {
        throw new Error("Not connected");
      }
      const json = serializeMessage(message);
      if (this._process.stdin.write(json)) {
        resolve();
      } else {
        this._process.stdin.once("drain", resolve);
      }
    });
  }
}

const withTimeout = (promise, ms, onTimeout) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    try {
      if (onTimeout) {
        onTimeout();
      }
    } catch {}
    reject(new Error(`MCP operation timed out after ${ms}ms`));
  }, ms);
  promise.then((value) => {
    clearTimeout(timer);
    resolve(value);
  }, (error) => {
    clearTimeout(timer);
    reject(error);
  });
});

class McpManager {
  constructor() {
    this.state = new Map();
  }

  async syncFromSettings(mcpServers) {
    const desired = mcpServers && typeof mcpServers === "object" ? mcpServers : {};
    for (const name of [...this.state.keys()]) {
      const cfg = desired[name];
      if (!cfg || cfg.enabled === false) {
        await this.stopServer(name);
      }
    }
    for (const name of Object.keys(desired)) {
      const cfg = desired[name];
      if (!cfg || cfg.enabled === false) {
        continue;
      }
      const existing = this.state.get(name);
      const sig = this.configSignature(cfg);
      if (existing && (existing.status === "ready" || existing.status === "starting") && existing.sig === sig) {
        continue;
      }
      if (existing) {
        await this.stopServer(name);
      }
      await this.startServer(name, cfg);
    }
  }

  configSignature(cfg) {
    try {
      return JSON.stringify({ type: cfg.type || "stdio", command: cfg.command || "", args: Array.isArray(cfg.args) ? cfg.args : [], env: cfg.env || {} });
    } catch {
      return "";
    }
  }

  async startServer(name, cfg) {
    const sig = this.configSignature(cfg);
    this.state.set(name, { status: "starting", tools: [], error: "", client: null, transport: null, sig });
    try {
      if (cfg.type && cfg.type !== "stdio") {
        this.state.set(name, { status: "unsupported", tools: [], error: "Only stdio transport is supported in V1", client: null, transport: null, sig });
        return;
      }
      const { command, args } = resolveWindowsCommand(cfg.command, Array.isArray(cfg.args) ? cfg.args : []);
      const transport = new HiddenStdioTransport({ command, args, env: { ...process.env, ...(cfg.env || {}) }, stderr: "pipe" });
      const client = new Client({ name: "VantheaX", version: "0.1.0" }, { capabilities: {} });
      await withTimeout(client.connect(transport), 15000, () => {
        try {
          transport.close();
        } catch {}
      });
      const listed = await withTimeout(client.listTools(), 15000, () => {});
      const usedSpecNames = new Set();
      const tools = (listed.tools || []).map((tool) => {
        const heuristic = classifyMcpRisk(tool);
        const tier = applyRiskOverride(heuristic, cfg.toolRisk ? cfg.toolRisk[tool.name] : undefined);
        const enabled = cfg.toolEnabled ? cfg.toolEnabled[tool.name] !== false : true;
        const specFullName = buildSpecName(name, tool.name, usedSpecNames);
        return { name: tool.name, specFullName, description: tool.description || "", inputSchema: tool.inputSchema || null, heuristic, tier, enabled };
      });
      this.state.set(name, { status: "ready", tools, error: "", client, transport, sig });
    } catch (error) {
      this.state.set(name, { status: "error", tools: [], error: String(error?.message || error).slice(0, 500), client: null, transport: null, sig });
    }
  }

  async stopServer(name) {
    const st = this.state.get(name);
    if (st) {
      if (st.client) {
        try {
          await st.client.close();
        } catch {}
      }
      if (st.transport) {
        try {
          await st.transport.close();
        } catch {}
      }
    }
    this.state.delete(name);
  }

  findTool(prefixedName) {
    if (typeof prefixedName !== "string" || !prefixedName.startsWith("mcp__")) {
      return null;
    }
    for (const [server, st] of this.state) {
      for (const tool of (st?.tools || [])) {
        const specName = tool.specFullName || `mcp__${server}__${tool.name}`;
        if (specName === prefixedName) {
          return { server, tool: tool.name, tier: tool.tier || "state_change", found: true };
        }
      }
    }
    return null;
  }

  getToolSpecs() {
    const specs = [];
    for (const [server, st] of this.state) {
      if (st.status !== "ready") {
        continue;
      }
      for (const tool of st.tools) {
        if (tool.enabled === false) {
          continue;
        }
        specs.push(buildToolSpec(server, tool));
      }
    }
    return specs;
  }

  toolSpecsText() {
    try {
      return JSON.stringify(this.getToolSpecs());
    } catch {
      return "";
    }
  }

  connectedSummary() {
    const out = [];
    for (const [server, st] of this.state) {
      if (st.status === "ready") {
        out.push(`${server} (${st.tools.filter((tool) => tool.enabled !== false).length} tools)`);
      }
    }
    return out;
  }

  async callTool(server, tool, args, timeoutMs) {
    const st = this.state.get(server);
    if (!st || st.status !== "ready" || !st.client) {
      return { mcp: true, server, tool, isError: true, content: `[MCP tool error] server '${server}' is not connected` };
    }
    const timeout = Math.min(600000, Math.max(1000, Number(timeoutMs) || 60000));
    try {
      const res = await withTimeout(st.client.callTool({ name: tool, arguments: args || {} }), timeout, () => {});
      const meta = st.tools.find((item) => item.name === tool);
      return capMcpResult(res, server, tool, meta?.tier || "state_change");
    } catch (error) {
      return { mcp: true, server, tool, isError: true, content: `[MCP tool error] ${String(error?.message || error).slice(0, 500)}` };
    }
  }

  setToolRisk(server, tool, tier) {
    const st = this.state.get(server);
    if (!st) {
      return;
    }
    const meta = st.tools.find((item) => item.name === tool);
    if (!meta) {
      return;
    }
    meta.tier = applyRiskOverride(meta.heuristic, tier);
  }

  setToolEnabled(server, tool, enabled) {
    const st = this.state.get(server);
    if (!st) {
      return;
    }
    const meta = st.tools.find((item) => item.name === tool);
    if (!meta) {
      return;
    }
    meta.enabled = enabled !== false;
  }

  getStatusForRenderer() {
    return [...this.state.entries()].map(([name, st]) => ({
      name,
      status: st.status,
      error: st.error || "",
      toolCount: (st.tools || []).length,
      tools: (st.tools || []).map((tool) => ({
        name: tool.name,
        description: String(tool.description || "").slice(0, 300),
        tier: tool.tier,
        heuristic: tool.heuristic,
        enabled: tool.enabled !== false,
      })),
    }));
  }

  async shutdownAll() {
    for (const name of [...this.state.keys()]) {
      await this.stopServer(name);
    }
  }
}

export const mcpManager = new McpManager();
