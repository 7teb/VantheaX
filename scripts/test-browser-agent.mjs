import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  allowedBrowserKeys,
  bitmapDifference,
  collectFrameTree,
  formatAxEntry,
  normalizeBrowserTarget,
  normalizedVisionBox,
  publicBrowserArgs,
  readAxNode,
  sanitizeBrowserToolCall,
  shouldIncludeAxNode,
} from "../electron/browser-agent-core.js";

assert.equal(normalizeBrowserTarget("example.com"), "https://example.com");
assert.equal(normalizeBrowserTarget("localhost:48765"), "http://localhost:48765");
assert.equal(normalizeBrowserTarget("browser agent test"), "https://duckduckgo.com/?q=browser%20agent%20test");
assert.equal(normalizeBrowserTarget("file:///C:/Windows/win.ini"), null);
assert.equal(normalizeBrowserTarget("javascript:alert(1)"), null);
assert.equal(normalizeBrowserTarget("about:blank"), "about:blank");

const passwordNode = {
  backendDOMNodeId: 44,
  frameId: "frame-a",
  role: { value: "textbox" },
  name: { value: "Password" },
  value: { value: "fixture-secret" },
  properties: [
    { name: "protected", value: { value: true } },
    { name: "focused", value: { value: false } },
  ],
};
const password = readAxNode(passwordNode);
assert.equal(password.protected, true);
assert.equal(password.value, "");
assert.equal(shouldIncludeAxNode(password), true);
assert.equal(formatAxEntry(password, "b1"), `[b1] textbox "Password" protected`);

const ignored = readAxNode({ ignored: true, role: { value: "button" }, name: { value: "Hidden" } });
assert.equal(shouldIncludeAxNode(ignored), false);

const typed = publicBrowserArgs("browser_type", {
  snapshot_id: "browser-x:1:1",
  ref: "b2",
  text: "super-secret",
  clear: true,
  submit: false,
});
assert.equal(typed.text, "[REDACTED]");
assert.equal(typed.text_length, 12);
assert.equal(JSON.stringify(typed).includes("super-secret"), false);

const sanitizedCall = sanitizeBrowserToolCall({
  id: "call-1",
  function: {
    name: "browser_type",
    arguments: JSON.stringify({ snapshot_id: "s", ref: "b2", text: "persist-secret" }),
  },
});
assert.equal(sanitizedCall.function.arguments.includes("persist-secret"), false);
assert.equal(JSON.parse(sanitizedCall.function.arguments).text_length, 14);

assert.equal(allowedBrowserKeys.has("Enter"), true);
assert.equal(allowedBrowserKeys.has("a"), false);
assert.equal(allowedBrowserKeys.has("F12"), false);

assert.deepEqual(normalizedVisionBox([-1, 0.2, 1.4, 0.8]), [0, 0.2, 1, 0.8]);
assert.equal(normalizedVisionBox([0.1, 0.1, 0.1, 0.5]), null);

const same = Buffer.from([0, 10, 20, 255, 50, 60, 70, 255]);
const changed = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255]);
assert.equal(bitmapDifference(same, same), 0);
assert.ok(bitmapDifference(same, changed) > 0.5);

const frames = collectFrameTree({
  frame: { id: "root", url: "https://root.test" },
  childFrames: [{
    frame: { id: "child", parentId: "root", url: "https://frame.test" },
    childFrames: [{ frame: { id: "nested", parentId: "child", url: "https://nested.test" } }],
  }],
});
assert.equal(frames.size, 3);
assert.equal(frames.get("nested").parentId, "child");

const mainSource = await fs.readFile(new URL("../electron/main.js", import.meta.url), "utf8");
const preloadSource = await fs.readFile(new URL("../electron/preload.js", import.meta.url), "utf8");
const serviceSource = await fs.readFile(new URL("../electron/browser-agent.js", import.meta.url), "utf8");
assert.match(mainSource, /result\.browserVision && result\.pendingBrowserVisionId/);
assert.match(mainSource, /message\.tool_calls = \(message\.tool_calls \|\| \[\]\)\.map\(sanitizeBrowserToolCall\)/);
assert.match(preloadSource, /registerBrowserTab/);
assert.match(preloadSource, /resolveBrowserCommand/);
assert.match(serviceSource, /Target\.setAutoAttach/);
assert.match(serviceSource, /DOM\.getFrameOwner/);
assert.match(serviceSource, /debugger\.on\("detach"/);

process.stdout.write("browser-agent: ok\n");
