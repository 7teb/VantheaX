import assert from "node:assert/strict";
import fs from "node:fs";

const renderer = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const preload = fs.readFileSync(new URL("../electron/preload.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../electron/main.js", import.meta.url), "utf8");

assert.match(renderer, /WindowCaptionIcon type="minimize"/);
assert.match(renderer, /windowMaximized \? "restore" : "maximize"/);
assert.match(renderer, /api\.onWindowState/);
assert.match(styles, /\.titlebar-actions \.caption-button\s*\{[^}]*width: 46px;[^}]*height: 36px;[^}]*border-radius: 0;/s);
assert.match(styles, /\.caption-button\.close:hover\s*\{[^}]*background: #c42b1c;/s);
assert.match(styles, /\.caption-icon\s*\{[^}]*shape-rendering: crispEdges;/s);
assert.match(preload, /getWindowState: \(\) => ipcRenderer\.invoke\("window:state"\)/);
assert.match(preload, /ipcRenderer\.on\("window:state", listener\)/);
assert.match(main, /mainWindow\.on\("maximize", emitWindowState\)/);
assert.match(main, /mainWindow\.on\("minimize", emitWindowState\)/);
assert.match(main, /minimized: Boolean\(mainWindow\?\.isMinimized\(\)\)/);
assert.match(main, /ipcMain\.handle\("window:state", \(\) => getWindowState\(\)\)/);

console.log("Window control checks passed");
