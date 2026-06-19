import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentApi", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  loadChats: () => ipcRenderer.invoke("chats:load"),
  saveChats: (chats) => ipcRenderer.invoke("chats:save", chats),
  getModels: () => ipcRenderer.invoke("models:get"),
  getBalance: () => ipcRenderer.invoke("key:balance"),
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
  estimateContext: (payload) => ipcRenderer.invoke("context:estimate", payload),
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
  closeWindow: () => ipcRenderer.invoke("window:close"),
  zoomWindow: (delta) => ipcRenderer.invoke("window:zoom", delta),
  toggleFullscreen: () => ipcRenderer.invoke("window:fullscreen"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
});
