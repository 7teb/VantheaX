import assert from "node:assert/strict";
import fs from "node:fs/promises";

const main = await fs.readFile(new URL("../electron/main.js", import.meta.url), "utf8");
const preload = await fs.readFile(new URL("../electron/preload.js", import.meta.url), "utf8");
const renderer = await fs.readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const styles = await fs.readFile(new URL("../src/styles.css", import.meta.url), "utf8");

assert.match(main, /name: "deploy_agent"/);
assert.match(main, /name: "continue_agent"/);
assert.doesNotMatch(main, /name: "wait_for_agents"/);
assert.match(main, /Promise\.all\(batch\.map\(\(entry\) => runCall\(entry\)\)\)/);
assert.match(main, /At most 8 agent runs can be started in one main turn/);
assert.match(main, /runtime\.depth > 0/);
assert.match(main, /Sub-agents cannot deploy or continue other agents/);
assert.match(main, /agentContextThreshold = Math\.floor\(512000 \* 0\.8\)/);
assert.match(main, /agentContextEmergency = Math\.floor\(512000 \* 0\.92\)/);
assert.match(main, /agentRuntimeLimit = 2 \* 60 \* 60 \* 1000/);
assert.match(main, /agentExploreToolNames/);
assert.match(main, /agentWorkerToolNames/);
assert.match(main, /emitAgentPermission/);
assert.match(main, /permissionId = `\$\{run\.id\}:\$\{call\.id\}`/);
assert.match(preload, /getAgentTranscript/);
assert.match(preload, /onAgentPermission/);
assert.match(renderer, /const AgentTranscriptView/);
assert.match(renderer, /const AgentTranscriptEntry/);
assert.match(renderer, /result\.agent/);
assert.match(renderer, /agent\.deploying/);
assert.match(styles, /\.agent-transcript-body/);
assert.match(styles, /\.tool-step\.agent-deploy/);

console.log("agent integration tests passed");
