import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "electron", "main.js"), "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "config", "models.json"), "utf8"));

const start = src.indexOf("const clampNumber");
const endAnchor = ": openRouterBody(payload.model, payload.effort, messages, tools));";
const end = src.indexOf(endAnchor, start);
if (start === -1 || end === -1) {
  console.error("Could not extract the body builders from main.js");
  process.exit(1);
}
const fnSrc = src.slice(start, end + endAnchor.length);
const buildRequestBody = new Function(`${fnSrc}\nreturn buildRequestBody;`)();

const entry = (id) => catalog.find((item) => item.id === id);
const MESSAGES = [{ role: "user", content: "hi" }];
const TOOLS = [{ type: "function", function: { name: "read_file" } }];
const SETTINGS = { nvidia: { enabled: true, temperature: 0.2, topP: 1, maxTokens: 65536, reasoningBudget: 4096 } };

let pass = 0;
let fail = 0;
const check = (name, condition, detail = "") => {
  if (condition) {
    pass += 1;
    return;
  }
  fail += 1;
  console.error(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`);
};

const build = (id, effort, settings = SETTINGS, tools = TOOLS) =>
  buildRequestBody(entry(id), settings, { model: id, effort }, MESSAGES, tools);

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const EXPECTED = [
  ["nvidia:deepseek-ai/deepseek-v4-flash", "deepseek-ai/deepseek-v4-flash", 16384, 0.95, {
    high: { reasoning_effort: "high" },
    max: { reasoning_effort: "max" },
  }],
  ["nvidia:deepseek-ai/deepseek-v4-pro", "deepseek-ai/deepseek-v4-pro", 16384, 0.95, {
    high: { reasoning_effort: "high" },
    max: { reasoning_effort: "max" },
  }],
  ["nvidia:z-ai/glm-5.2", "z-ai/glm-5.2", 32768, 1, {
    high: { chat_template_kwargs: { enable_thinking: true, reasoning_effort: "high" } },
    max: { chat_template_kwargs: { enable_thinking: true, reasoning_effort: "max" } },
  }],
  ["nvidia:minimaxai/minimax-m3", "minimaxai/minimax-m3", 16384, 0.95, {
    adaptive: { chat_template_kwargs: { thinking_mode: "adaptive" } },
    enabled: { chat_template_kwargs: { thinking_mode: "enabled" } },
  }],
  ["nvidia:nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3-ultra-550b-a55b", 32768, 0.95, {
    medium: { reasoning_effort: "medium" },
    high: { reasoning_effort: "high" },
  }],
];

for (const [id, apiId, cap, defaultTopP, efforts] of EXPECTED) {
  const model = entry(id);
  check(`${id} exists in catalog`, Boolean(model));
  check(`${id} apiId`, model.apiId === apiId, model?.apiId);
  check(`${id} maxOutput matches documented cap`, model.maxOutput === cap, String(model?.maxOutput));
  check(`${id} defaultTopP`, model.defaultTopP === defaultTopP, String(model?.defaultTopP));
  check(`${id} efforts match the mapping under test`, eq(model.efforts, Object.keys(efforts)), JSON.stringify(model.efforts));
  check(`${id} defaultEffort is a real option`, model.efforts.includes(model.defaultEffort), model.defaultEffort);

  for (const [effort, fragment] of Object.entries(efforts)) {
    const body = build(id, effort);
    const label = `${apiId} @ ${effort}`;
    check(`${label} model id on the wire`, body.model === apiId, body.model);
    check(`${label} messages passed through`, eq(body.messages, MESSAGES));
    check(`${label} max_tokens clamped to cap`, body.max_tokens === cap, String(body.max_tokens));
    check(`${label} temperature`, body.temperature === 0.2, String(body.temperature));
    check(`${label} top_p`, body.top_p === 1, String(body.top_p));
    check(`${label} tools forwarded`, eq(body.tools, TOOLS) && body.tool_choice === "auto");
    for (const [field, value] of Object.entries(fragment)) {
      check(`${label} sets ${field}`, eq(body[field], value), JSON.stringify(body[field]));
    }
    const reasoningFields = ["reasoning_effort", "chat_template_kwargs"].filter((f) => body[f] !== undefined);
    check(`${label} sets exactly one reasoning field`, reasoningFields.length === 1, reasoningFields.join(","));
    check(`${label} no OpenRouter reasoning object`, body.reasoning === undefined);
    check(`${label} no OpenRouter provider pin`, body.provider === undefined);
    const budget = body.reasoning_budget;
    check(`${label} reasoning_budget only for Nemotron`, model.supportsReasoningBudget ? budget === 4096 : budget === undefined, String(budget));
  }
}

const capTest = build("nvidia:minimaxai/minimax-m3", "enabled", { nvidia: { maxTokens: 999999, temperature: 5, topP: -3 } });
check("out of range settings clamp", capTest.max_tokens === 16384 && capTest.temperature === 1 && capTest.top_p === 0.01, JSON.stringify(capTest));

const zeroTest = build("nvidia:z-ai/glm-5.2", "max", { nvidia: { temperature: 0, topP: 0, maxTokens: 4096 } });
check("zero temperature and top_p stay above the exclusive minimum", zeroTest.temperature === 0.01 && zeroTest.top_p === 0.01, JSON.stringify(zeroTest));

const schemaField = {
  "nvidia:deepseek-ai/deepseek-v4-flash": "reasoning_effort",
  "nvidia:deepseek-ai/deepseek-v4-pro": "reasoning_effort",
  "nvidia:nvidia/nemotron-3-ultra-550b-a55b": "reasoning_effort",
  "nvidia:z-ai/glm-5.2": "chat_template_kwargs",
  "nvidia:minimaxai/minimax-m3": "chat_template_kwargs",
};
for (const [id, field] of Object.entries(schemaField)) {
  const model = entry(id);
  for (const effort of model.efforts) {
    const body = build(id, effort);
    check(`${model.apiId} @ ${effort} uses only the field its own schema documents`, body[field] !== undefined, JSON.stringify(Object.keys(body)));
  }
}

const emptySettings = build("nvidia:z-ai/glm-5.2", "max", {});
check("missing nvidia settings fall back to defaults", emptySettings.temperature === 0.2 && emptySettings.top_p === 1 && emptySettings.max_tokens === 32768, JSON.stringify(emptySettings));

const bogus = build("nvidia:minimaxai/minimax-m3", "xhigh");
check("unknown effort falls back to defaultEffort", eq(bogus.chat_template_kwargs, { thinking_mode: "enabled" }), JSON.stringify(bogus.chat_template_kwargs));

const noTools = build("nvidia:z-ai/glm-5.2", "high", SETTINGS, []);
check("no tools key when the tool list is empty", noTools.tools === undefined && noTools.tool_choice === undefined);

const or = buildRequestBody(entry("deepseek/deepseek-v4-flash"), SETTINGS, { model: "deepseek/deepseek-v4-flash", effort: "xhigh" }, MESSAGES, TOOLS);
check("openrouter model keeps reasoning object", eq(or.reasoning, { effort: "xhigh" }), JSON.stringify(or.reasoning));
check("openrouter model keeps provider pin", eq(or.provider, { order: ["DeepSeek"], allow_fallbacks: false }));
check("openrouter model sends no max_tokens", or.max_tokens === undefined);
check("openrouter model sends no reasoning_effort", or.reasoning_effort === undefined);
check("openrouter model keeps its own id", or.model === "deepseek/deepseek-v4-flash");

const glmOr = buildRequestBody(entry("z-ai/glm-5.2"), SETTINGS, { model: "z-ai/glm-5.2", effort: "high" }, MESSAGES, TOOLS);
check("openrouter glm pins Z.AI", eq(glmOr.provider, { order: ["Z.AI"], allow_fallbacks: false }));

const nvidiaIds = catalog.filter((m) => m.apiProvider === "nvidia");
check("five nvidia models in the catalog", nvidiaIds.length === 5, String(nvidiaIds.length));
check("nvidia catalog ids are namespaced", nvidiaIds.every((m) => m.id.startsWith("nvidia:")));
check("nvidia ids do not collide with openrouter ids", new Set(catalog.map((m) => m.id)).size === catalog.length);
check("every nvidia model maps every effort", nvidiaIds.every((m) => m.efforts.every((e) => m.effortMap && m.effortMap[e])));
check("no nvidia model offers a reasoning-off level", nvidiaIds.every((m) => !m.efforts.some((e) => ["none", "off", "disabled"].includes(e))), nvidiaIds.map((m) => m.efforts.join("/")).join(" | "));
check("no nvidia effortMap can disable thinking", nvidiaIds.every((m) => Object.values(m.effortMap).every((frag) => frag.reasoning_effort !== "none" && frag.chat_template_kwargs?.enable_thinking !== false && frag.chat_template_kwargs?.thinking_mode !== "disabled")));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
