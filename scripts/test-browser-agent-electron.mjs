import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { app, BrowserWindow } from "electron";
import { createBrowserAgentService } from "../electron/browser-agent.js";
import { configureBrowserHost, configureBrowserSession, registerBrowserGuestSecurity } from "../electron/browser-guest.js";

const port = 48765;
const stage = (value) => {
  const line = `browser-agent-electron:${value}\n`;
  process.stdout.write(line);
};
const fixture = spawn("node.exe", ["scripts/browser-fixture.mjs", String(port)], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});

const waitFixture = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Fixture server timed out.")), 5000);
  fixture.stdout.setEncoding("utf8");
  fixture.stderr.setEncoding("utf8");
  fixture.stdout.on("data", (value) => {
    if (String(value).includes("browser-fixture:")) {
      clearTimeout(timer);
      resolve();
    }
  });
  fixture.stderr.on("data", (value) => reject(new Error(String(value))));
  fixture.on("exit", (code) => {
    if (code && code !== 0) {
      reject(new Error(`Fixture exited with ${code}.`));
    }
  });
});

let host = null;
registerBrowserGuestSecurity(app, () => host);

const closeFixture = () => {
  try {
    fixture.kill();
  } catch {}
};

const run = async () => {
  try {
  stage("ready");
  configureBrowserSession();
  await waitFixture;
  stage("fixture");
  host = new BrowserWindow({
    width: 1000,
    height: 760,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });
  configureBrowserHost(host);
  const attached = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Webview attach timed out.")), 10000);
    host.webContents.once("did-attach-webview", (_, guest) => {
      clearTimeout(timer);
      resolve(guest);
    });
  });
  const html = `<html><body style="margin:0"><webview src="http://127.0.0.1:${port}/" partition="persist:vx-browser" style="width:100vw;height:100vh"></webview></body></html>`;
  await host.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  stage("host-loaded");
  const guest = await attached;
  stage("guest-attached");
  const service = createBrowserAgentService({
    getMainWindow: () => host,
    analyzeVision: async (_, __, question) => question.includes("button")
      ? {
        summary: "Fixture button.",
        text: ["Visual action"],
        regions: [{ label: "Visual action", box: [0.73, 0.84, 0.84, 0.99], confidence: 0.95 }],
      }
      : {
        summary: "Fixture canvas with Layers and Export.",
        text: ["Layers", "Export"],
        regions: [{ label: "Layers", box: [0.82, 0.67, 0.98, 0.81], confidence: 0.95 }],
      },
  });
  service.attachHost(host);
  const event = { sender: host.webContents };
  assert.deepEqual(await service.registerTab(event, { tabId: "browser-test", webContentsId: guest.id }), { ok: true, tabId: "browser-test" });
  assert.deepEqual(await service.setActiveTab(event, { tabId: "browser-test" }), { ok: true, tabId: "browser-test" });
  await service.runTool("browser_wait", { condition: "load", timeout_ms: 10000 }, {});
  stage("registered");

  const snapshot = await service.runTool("browser_snapshot", {}, {});
  stage("snapshot");
  assert.equal(snapshot.browserSnapshot, true);
  assert.match(snapshot.content, /Browser fixture/);
  assert.match(snapshot.content, /"Email"/);
  assert.match(snapshot.content, /"Password" protected/);
  assert.equal(snapshot.content.includes("fixture-secret"), false);
  assert.equal(snapshot.content.includes("hidden-fixture-secret"), false);
  assert.match(snapshot.content, /"Frame action"/);
  assert.match(snapshot.content, /"Nested action"/);

  const refFor = (content, text, role = "") => {
    const line = content.split("\n").find((value) => value.includes(`"${text}"`) && (!role || value.includes(`] ${role} `)));
    const match = line?.match(/^\[(b\d+)\]/);
    assert.ok(match, `Missing ref for ${text}`);
    return match[1];
  };

  const choiceRef = refFor(snapshot.content, "Choice", "combobox");
  const scoped = await service.runTool("browser_snapshot", {
    snapshot_id: snapshot.snapshot_id,
    scope_ref: choiceRef,
  }, {});
  assert.match(scoped.content, /Choice/);
  assert.equal(scoped.content.includes('"Email"'), false, scoped.content);

  const emailRef = refFor(snapshot.content, "Email", "textbox");
  const typeResult = await service.runTool("browser_type", {
    snapshot_id: snapshot.snapshot_id,
    ref: emailRef,
    text: "agent@example.com",
    clear: true,
  }, {});
  assert.equal(typeResult.text, "[REDACTED]");
  assert.equal(typeResult.text_length, 17);
  assert.equal(await guest.executeJavaScript(`document.getElementById("email").value`), "agent@example.com");
  stage("typed");

  const frameSnapshot = await service.runTool("browser_snapshot", {}, {});
  const frameRef = refFor(frameSnapshot.content, "Frame action", "button");
  await service.runTool("browser_click", {
    snapshot_id: frameSnapshot.snapshot_id,
    ref: frameRef,
  }, {});
  const frameWait = await service.runTool("browser_wait", {
    condition: "text",
    value: "Frame clicked",
    timeout_ms: 5000,
  }, {});
  assert.equal(frameWait.matched, true);
  stage("frame-clicked");
  const nestedSnapshot = await service.runTool("browser_snapshot", {}, {});
  const nestedRef = refFor(nestedSnapshot.content, "Nested action", "button");
  await service.runTool("browser_click", {
    snapshot_id: nestedSnapshot.snapshot_id,
    ref: nestedRef,
  }, {});
  const nestedWait = await service.runTool("browser_wait", {
    condition: "text",
    value: "Nested clicked",
    timeout_ms: 5000,
  }, {});
  assert.equal(nestedWait.matched, true);
  stage("nested-clicked");
  const stale = await service.runTool("browser_click", {
    snapshot_id: frameSnapshot.snapshot_id,
    ref: frameRef,
  }, {}).catch((error) => ({ error: error.message }));
  assert.match(stale.error, /stale/i);

  const abort = new AbortController();
  const waiting = service.runTool("browser_wait", {
    condition: "text",
    value: "never-visible-fixture-value",
    timeout_ms: 10000,
  }, { signal: abort.signal });
  setTimeout(() => abort.abort(), 150);
  await assert.rejects(waiting, /canceled/i);
  stage("aborted");

  const permission = await service.runTool("browser_visual_analyze", {
    question: "Where is Layers?",
  }, { chatId: "chat-test", settings: {} });
  assert.equal(permission.permissionRequired, true);
  assert.equal(permission.browserVision, true);
  assert.deepEqual(permission.stickyOptions, ["chat"]);
  service.grantVision("chat-test");
  const vision = await service.approveVision(permission.pendingBrowserVisionId);
  assert.equal(vision.browserVision, true);
  assert.equal(vision.regions[0].ref, "v1");
  const canvasClick = await service.runTool("browser_visual_click", {
    screenshot_id: vision.screenshot_id,
    ref: "v1",
  }, {});
  assert.equal(canvasClick.semantic, false);
  assert.equal(await guest.executeJavaScript(`document.getElementById("fixture-canvas").dataset.clicked`), "layers");

  const buttonVision = await service.runTool("browser_visual_analyze", {
    question: "Where is the button?",
  }, { chatId: "chat-test", settings: {} });
  const buttonClick = await service.runTool("browser_visual_click", {
    screenshot_id: buttonVision.screenshot_id,
    ref: "v1",
  }, {});
  assert.equal(buttonClick.semantic, true);
  assert.equal(await guest.executeJavaScript(`document.getElementById("visual-button").dataset.clicked`), "yes");
  stage("vision");

  guest.debugger.detach();
  const recovered = await service.runTool("browser_snapshot", {}, {});
  assert.equal(recovered.browserSnapshot, true);
  stage("recovered");

  const pendingCommand = service.runTool("browser_tabs", { action: "new", url: `http://127.0.0.1:${port}/page2` }, {});
  setTimeout(() => host.reload(), 120);
  await assert.rejects(pendingCommand, /renderer reloaded|unavailable|closed/i);

  service.cleanupAll();
    process.stdout.write("browser-agent-electron: ok\n");
  } finally {
    if (host && !host.isDestroyed()) {
      host.destroy();
    }
    closeFixture();
    app.quit();
  }
};

app.whenReady().then(run).catch((error) => {
  stage(`failed:${String(error?.stack || error)}`);
  closeFixture();
  app.exit(1);
});
