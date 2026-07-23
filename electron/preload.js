import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentApi", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  loadChats: () => ipcRenderer.invoke("chats:load"),
  saveChats: (chats) => ipcRenderer.invoke("chats:save", chats),
  listBackgroundTasks: (chatId) => ipcRenderer.invoke("background:list", chatId),
  getBackgroundTask: (id) => ipcRenderer.invoke("background:get", id),
  cancelBackgroundTask: (id) => ipcRenderer.invoke("background:cancel", id),
  clearBackgroundTasks: (chatId) => ipcRenderer.invoke("background:clear", chatId),
  deleteBackgroundTasks: (chatId) => ipcRenderer.invoke("background:deleteChat", chatId),
  claimBackgroundNotification: (chatId) => ipcRenderer.invoke("background:claim", chatId),
  settleBackgroundNotification: (id, delivered) => ipcRenderer.invoke("background:settleNotification", id, delivered),
  onBackgroundEvent: (handler) => {
    const listener = (_, event) => handler(event);
    ipcRenderer.on("background:event", listener);
    return () => ipcRenderer.removeListener("background:event", listener);
  },
  getAgentTranscript: (agentId, runId) => ipcRenderer.invoke("agent:transcript", agentId, runId),
  onAgentEvent: (handler) => {
    const listener = (_, event) => handler(event);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },
  onAgentPermission: (handler) => {
    const listener = (_, event) => handler(event);
    ipcRenderer.on("agent:permission", listener);
    return () => ipcRenderer.removeListener("agent:permission", listener);
  },
  getModels: () => ipcRenderer.invoke("models:get"),
  getBalance: () => ipcRenderer.invoke("key:balance"),
  extractMemories: (payload) => ipcRenderer.invoke("memory:extract", payload),
  resetMemories: () => ipcRenderer.invoke("memory:reset"),
  generateChatTitle: (payload) => ipcRenderer.invoke("chat:title", payload),
  saveImage: (payload) => ipcRenderer.invoke("image:save", payload),
  analyzeImage: (payload) => ipcRenderer.invoke("image:analyze", payload),
  loadImage: (name) => ipcRenderer.invoke("image:load", name),
  deleteImages: (names) => ipcRenderer.invoke("image:delete", names),
  chooseProject: () => ipcRenderer.invoke("project:choose"),
  createProject: () => ipcRenderer.invoke("project:create"),
  indexProject: (projectPath) => ipcRenderer.invoke("project:index", projectPath),
  readFile: (projectPath, relativePath) => ipcRenderer.invoke("project:readFile", projectPath, relativePath),
  resolvePermission: (callId, payload) => ipcRenderer.invoke("permission:resolve", callId, payload),
  getMcpStatus: () => ipcRenderer.invoke("mcp:status"),
  setMcpToolRisk: (server, tool, tier) => ipcRenderer.invoke("mcp:setToolRisk", server, tool, tier),
  setMcpToolEnabled: (server, tool, enabled) => ipcRenderer.invoke("mcp:setToolEnabled", server, tool, enabled),
  setMcpSessionTrust: (server, trusted) => ipcRenderer.invoke("mcp:setSessionTrust", server, trusted),
  reconnectMcp: (name) => ipcRenderer.invoke("mcp:reconnect", name),
  detectMcpServer: () => ipcRenderer.invoke("mcp:detectFolder"),
  getContextSnapshot: (payload) => ipcRenderer.invoke("context:snapshot", payload),
  compactContext: (payload) => ipcRenderer.invoke("context:compact", payload),
  sendMessage: (payload, onEvent) => {
    const requestId = payload.requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const listener = (_, event) => {
      if (event.requestId === requestId && onEvent) {
        onEvent(event);
      }
    };
    ipcRenderer.on("agent:event", listener);
    return ipcRenderer.invoke("agent:stream", { ...payload, requestId }).finally(() => {
      ipcRenderer.removeListener("agent:event", listener);
    });
  },
  cancelStream: (requestId) => ipcRenderer.invoke("agent:cancel", requestId),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  getWindowState: () => ipcRenderer.invoke("window:state"),
  onWindowState: (handler) => {
    const listener = (_, state) => handler(state);
    ipcRenderer.on("window:state", listener);
    return () => ipcRenderer.removeListener("window:state", listener);
  },
  closeWindow: () => ipcRenderer.invoke("window:close"),
  zoomWindow: (delta) => ipcRenderer.invoke("window:zoom", delta),
  toggleFullscreen: () => ipcRenderer.invoke("window:fullscreen"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  undoTurn: (turnId) => ipcRenderer.invoke("turn:undo", turnId),
  revealPath: (projectPath, relativePath) => ipcRenderer.invoke("shell:reveal", projectPath, relativePath),
  openRoot: (projectPath, workspaceName) => ipcRenderer.invoke("shell:open-root", projectPath, workspaceName),
  terminalCreate: (opts) => ipcRenderer.invoke("terminal:create", opts),
  terminalInput: (id, data) => ipcRenderer.send("terminal:input", id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.send("terminal:resize", id, cols, rows),
  terminalClose: (id) => ipcRenderer.send("terminal:close", id),
  onTerminalData: (handler) => {
    const listener = (_, payload) => handler(payload);
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },
  onTerminalExit: (handler) => {
    const listener = (_, payload) => handler(payload);
    ipcRenderer.on("terminal:exit", listener);
    return () => ipcRenderer.removeListener("terminal:exit", listener);
  },
});
