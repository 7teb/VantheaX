import assert from "node:assert/strict";
import fs from "node:fs";

const rendererSource = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../electron/main.js", import.meta.url), "utf8");

const presetsSource = rendererSource.match(/const THEME_PRESETS = (\[[\s\S]*?\]);/);
const defaultSource = rendererSource.match(/const DEFAULT_THEME = (\{[^\n]+\});/);
const normalizeSource = rendererSource.match(/const normalizeTheme = \(input\) => \{([\s\S]*?)\n\};/);
const mainNormalizeSource = mainSource.match(/const normalizeThemeSettings = \(theme\) => \{([\s\S]*?)\n\};/);

assert.ok(presetsSource);
assert.ok(defaultSource);
assert.ok(normalizeSource);
assert.ok(mainNormalizeSource);

const presets = Function(`return ${presetsSource[1]}`)();
const defaultTheme = Function(`return ${defaultSource[1]}`)();
const normalizeTheme = Function("DEFAULT_THEME", `return (input) => {${normalizeSource[1]}}`)(defaultTheme);
const normalizeThemeSettings = Function(`return (theme) => {${mainNormalizeSource[1]}}`)();

for (const preset of presets) {
  assert.equal(preset.surfaceApp, preset.surfaceSidebar, `${preset.id} has split chrome colors`);
}

const normalizedRenderer = normalizeTheme({ surfaceApp: "#111111", surfaceSidebar: "#222222" });
assert.equal(normalizedRenderer.surfaceApp, "#222222");
assert.equal(normalizedRenderer.surfaceSidebar, "#222222");

const normalizedMain = normalizeThemeSettings({ surfaceApp: "#333333", surfaceSidebar: "#444444" });
assert.equal(normalizedMain.surfaceApp, "#444444");
assert.equal(normalizedMain.surfaceSidebar, "#444444");

const designSettings = rendererSource.slice(rendererSource.indexOf("const DesignSettings"), rendererSource.indexOf("const SettingsModal"));
assert.match(designSettings, /design\.sidebar/);
assert.match(designSettings, /surfaceApp: event\.target\.value, surfaceSidebar: event\.target\.value/);
assert.doesNotMatch(designSettings, /<Lock/);
assert.doesNotMatch(designSettings, /design\.chrome/);
assert.doesNotMatch(designSettings, /design\.titlebar/);

console.log(`Theme lock verified across ${presets.length} presets`);
