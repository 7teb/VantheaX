import { session } from "electron";

export const browserPartition = "persist:vx-browser";

export const isBrowserGuestUrlAllowed = (value, allowBlank = false) => {
  if (allowBlank && value === "about:blank") {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const blockUnsafeMainFrameNavigation = (event) => {
  if (event.isMainFrame === false) {
    return;
  }
  if (!isBrowserGuestUrlAllowed(event.url, true)) {
    event.preventDefault();
  }
};

export const registerBrowserGuestSecurity = (app, getMainWindow) => {
  app.on("web-contents-created", (_, contents) => {
    if (contents.getType() !== "webview") {
      return;
    }
    const browserSession = session.fromPartition(browserPartition);
    if (contents.session !== browserSession) {
      contents.destroy();
      return;
    }
    contents.setWindowOpenHandler((details) => {
      if (!details.postBody && isBrowserGuestUrlAllowed(details.url)) {
        const window = getMainWindow();
        if (window && !window.isDestroyed()) {
          window.webContents.send("browser:popup", details.url);
        }
      }
      return { action: "deny" };
    });
    contents.on("will-navigate", blockUnsafeMainFrameNavigation);
    contents.on("will-frame-navigate", blockUnsafeMainFrameNavigation);
    contents.on("will-redirect", blockUnsafeMainFrameNavigation);
  });
};

export const configureBrowserHost = (window) => {
  window.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    if (params.partition !== browserPartition || !isBrowserGuestUrlAllowed(params.src, true)) {
      event.preventDefault();
      return;
    }
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInWorker = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.experimentalFeatures = false;
    webPreferences.webviewTag = false;
  });
};

export const configureBrowserSession = () => {
  const browserSession = session.fromPartition(browserPartition);
  browserSession.setPermissionRequestHandler((_, __, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType === "mainFrame" && !isBrowserGuestUrlAllowed(details.url, true)) {
      callback({ cancel: true });
      return;
    }
    callback({});
  });
  browserSession.on("will-download", (_, item) => item.cancel());
};
