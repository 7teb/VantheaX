import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const models = JSON.parse(fs.readFileSync(new URL("../config/models.json", import.meta.url), "utf8"));

const picker = source.slice(source.indexOf("const EffortSlider"), source.indexOf("const ProjectPicker"));
const composer = source.slice(source.indexOf('<div className="composer-controls">'), source.indexOf("{naming ?"));
const effortDetail = picker.slice(picker.indexOf('detail === "effort"'), picker.indexOf('detail === "narrator"'));

for (const model of models) {
  assert.ok(Array.isArray(model.efforts) && model.efforts.length > 0, `${model.id} has no effort levels`);
  assert.ok(model.efforts.includes(model.defaultEffort), `${model.id} has an invalid default effort`);
}

const deepseek = models.find((model) => model.id === "deepseek/deepseek-v4-flash");
const qwen = models.find((model) => model.id === "qwen/qwen3.7-plus");
assert.deepEqual(deepseek.efforts, ["high", "xhigh"]);
assert.deepEqual(qwen.efforts, ["low", "medium", "high", "xhigh"]);

assert.match(picker, /const isMax = selectedIndex === safeEfforts\.length - 1/);
assert.match(picker, /isMax && \(/);
assert.match(picker, /selected\.efforts/);
assert.match(picker, /model\.advanced/);
assert.match(picker, /model\.model/);
assert.match(picker, /model\.narrator/);
assert.match(picker, /onNarratorChange\(enabled\)/);
assert.match(picker, /detail === "narrator"/);
assert.match(picker, /effort-slider-thumb/);
assert.doesNotMatch(effortDetail, /<EffortSlider/);
assert.doesNotMatch(picker, /<Zap/);
assert.match(composer, /settings\.narrator\?\.enabled/);
assert.match(composer, /persistSettings\(\{ narrator:/);
assert.match(styles, /\.model-effort-picker\.is-open\s*\{\s*width: 248px/);
assert.match(styles, /\.model-menu\s*\{[\s\S]*?width: 100%/);
assert.match(styles, /@keyframes effort-particle-flow/);
assert.match(styles, /@keyframes model-menu-in/);
assert.match(styles, /@keyframes model-menu-content-in/);
assert.match(styles, /\.effort-slider-thumb\s*\{[\s\S]*?transition: left/);

console.log(`Model picker verified across ${models.length} models`);
