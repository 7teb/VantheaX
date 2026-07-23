import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const helpersStart = source.indexOf("const turnIdForMessage");
const helpersEnd = source.indexOf("const TurnNavigator");
const helpersSource = source.slice(helpersStart, helpersEnd);
const helpers = Function(`${helpersSource}\nreturn { buildTurnNavigatorItems, compactTurnText };`)();

const turns = helpers.buildTurnNavigatorItems([
  { id: "u1", role: "user", content: "First **question**" },
  { id: "a1", role: "assistant", content: "First `answer`" },
  { id: "u2", role: "user", content: "Second question" },
  { id: "a2", role: "assistant", content: "", segments: [{ type: "text", content: "Second answer" }] },
]);

assert.equal(turns.length, 2);
assert.deepEqual(turns[0], { id: "u1", user: "First question", assistant: "First answer" });
assert.deepEqual(turns[1], { id: "u2", user: "Second question", assistant: "Second answer" });
assert.equal(helpers.compactTurnText("x".repeat(120), 20).length, 20);

const component = source.slice(source.indexOf("const TurnNavigator"), source.indexOf("const EffortSlider"));
assert.match(component, /requestAnimationFrame\(frame\)/);
assert.match(component, /progress < \.5/);
assert.match(component, /data-turn-id/);
assert.match(component, /onMouseEnter=\{\(\) => showPreview\(turn\)\}/);
assert.match(component, /onClick=\{\(\) => scrollToTurn\(turn\)\}/);
assert.match(styles, /@keyframes turn-domino-enter/);
assert.match(styles, /@keyframes turn-preview-enter/);
assert.match(styles, /@keyframes turn-preview-exit/);
assert.match(styles, /\.turn-nav-bar\s*\{[\s\S]*?transition: width \.3s/);
assert.match(styles, /clip-path: inset\(0 100% 0 0 round 12px\)/);

console.log("Turn navigator checks passed");
