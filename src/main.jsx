import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock, FileText, FolderClosed, FolderOpen, FolderPlus, FolderX, Globe, Hand, KeyRound, ListChecks, MessageSquare, Mic, Minus, MoreHorizontal, PanelLeft, PanelRight, Paperclip, Pencil, PencilLine, Pin, Plug, Plus, Search, Settings, ShieldCheck, Square, Target, Terminal, Trash2, X } from "lucide-react";
import MarkdownMessage from "./Markdown.jsx";
import "./styles.css";

let LANG = "en";

const STRINGS = {
  en: {
    "nav.newChat": "New chat",
    "nav.search": "Search",
    "nav.openProject": "Open project",
    "nav.settings": "Settings",
    "section.projects": "Projects",
    "section.noProject": "No project",
    "tree.noChats": "No chats",
    "tree.showChats": "Show chats",
    "tree.hideChats": "Hide chats",
    "title.sidebarOpen": "Open sidebar",
    "title.sidebarClose": "Close sidebar",
    "title.back": "Back",
    "title.forward": "Forward",
    "menu.file": "File",
    "menu.edit": "Edit",
    "menu.view": "View",
    "menu.window": "Window",
    "menu.help": "Help",
    "win.minimize": "Minimize",
    "win.maximize": "Maximize",
    "win.close": "Close",
    "chat.options": "Chat options",
    "chat.rename": "Rename",
    "chat.pin": "Pin",
    "chat.unpin": "Unpin",
    "chat.delete": "Delete",
    "hero.generic": "What should we work on?",
    "hero.project": "What should we work on in {name}?",
    "composer.placeholder": "Do what you want",
    "composer.goalPlaceholder": "What goal should VantheaX work toward?",
    "composer.removeGoal": "Remove goal",
    "composer.stop": "Stop",
    "plus.add": "Add",
    "plus.attach": "Add photos and files",
    "plus.planMode": "Plan mode",
    "plus.goalMode": "Track a goal",
    "perm.title": "Command permission",
    "perm.ask": "Ask",
    "perm.askDesc": "Approve every command",
    "perm.auto": "Auto",
    "perm.autoDesc": "Safe commands run, risky ask",
    "perm.full": "Full auto",
    "perm.fullDesc": "Everything runs, only system-killers blocked",
    "model.select": "Select model",
    "model.effort": "Reasoning effort",
    "model.fallback": "Model",
    "project.choose": "Choose a project",
    "project.search": "Search project",
    "project.none": "No projects",
    "project.add": "Add project",
    "project.create": "Create a project",
    "project.addExisting": "Add existing folder",
    "project.without": "Work without project",
    "plan.title": "Plan",
    "plan.risk": "Risk: {level}",
    "plan.riskTitle": "Plan risk assessment",
    "plan.keyChanges": "Key changes",
    "plan.files": "Files",
    "plan.testPlan": "Test plan",
    "plan.assumptions": "Assumptions",
    "plan.implementing": "Implementing plan…",
    "plan.accepted": "Accepted",
    "plan.rejected": "Plan dismissed — tell me what to change.",
    "plan.question": "Implement this plan?",
    "plan.no": "No",
    "plan.yes": "Yes, implement",
    "work.thinking": "Thinking",
    "work.workingSince": "Working for {s}s",
    "work.worked": "Worked {time}",
    "edit.oneFile": "1 file edited",
    "edit.nFiles": "{n} files edited",
    "cluster.commands": "Ran {n} commands",
    "cluster.reads": "Read {n} files",
    "todo.tasks": "Tasks",
    "todo.none": "No tasks yet",
    "todo.goal": "Goal",
    "todo.noGoal": "No goal active",
    "diff.tooLarge": " · too large to preview",
    "tool.denied": "Denied.",
    "tool.verifiedDone": "Verified: done",
    "tool.notDone": "Not done yet",
    "live.creating": "Creating {x}",
    "live.editing": "Editing {x}",
    "live.creatingGeneric": "Writing file…",
    "live.editingGeneric": "Editing file…",
    "live.lines": "{n} lines",
    "timeline.activity": "Agent activity",
    "timeline.done": "Done",
    "toollabel.running": "Running {x}",
    "toollabel.runCmd": "Run {x}",
    "toollabel.denied": "Denied {x}",
    "toollabel.grepping": "Searching {x}",
    "grep.matches": "{n} matches",
    "grep.noMatches": "No matches",
    "toollabel.writing": "Writing {x}",
    "toollabel.editing": "Editing {x}",
    "toollabel.reading": "Reading {x}",
    "toollabel.listing": "Listing files",
    "toollabel.working": "Working",
    "inspector.title": "Inspector",
    "inspector.noFile": "No file selected",
    "inspector.previewHint": "Select a file to preview its first 500 lines.",
    "settings.title": "Settings",
    "settings.apiKey": "OpenRouter API key",
    "settings.stored": "Stored locally",
    "settings.saveKey": "Save key",
    "settings.language": "Language",
    "settings.balance": "Key balance",
    "settings.tabGeneral": "General",
    "settings.tabMcp": "MCP servers",
    "settings.mcpName": "Name (a-z, 0-9, _ -)",
    "settings.mcpCommand": "Command (e.g. uvx, python, npx)",
    "settings.mcpArgs": "Arguments (one per line)",
    "settings.mcpEnv": "Environment (KEY=value per line)",
    "settings.mcpAdd": "Add server",
    "settings.mcpSave": "Save server",
    "settings.mcpRemove": "Remove",
    "settings.mcpReconnect": "Reconnect",
    "mcp.empty": "No MCP servers yet. Add one to give the model extra tools.",
    "mcp.addHelp": "Easiest: choose the server's folder above and the app detects how to launch it. Otherwise paste the config from its README (the same JSON Claude Desktop uses), or fill in the name and command by hand.",
    "mcp.pastePlaceholder": "Paste a server config here, e.g.\n{ \"command\": \"uvx\", \"args\": [\"ida-pro-mcp\"] }",
    "mcp.orManual": "or fill in by hand",
    "mcp.choosePlugin": "Choose plugin folder",
    "mcp.orPaste": "or paste a config",
    "mcp.detectFail": "Couldn't auto-detect this folder. Paste the config from the server's README, or fill it in below.",
    "mcp.enable": "Enable",
    "mcp.disable": "Disable",
    "mcp.tools": "Tools",
    "mcp.trustDangerous": "Trust dangerous tools from this server for this session",
    "mcp.status.ready": "{n} tools",
    "mcp.status.error": "Error",
    "mcp.status.starting": "Starting…",
    "mcp.status.disabled": "Disabled",
    "mcp.status.unsupported": "HTTP not supported yet",
    "tool.awaiting": "Waiting for your approval",
    "toollabel.mcp": "{server} · {tool}",
    "toollabel.addMcp": "Add MCP server {x}",
    "risk.readonly": "read-only",
    "risk.state_change": "state change",
    "risk.dangerous": "dangerous",
    "risk.shell_system": "shell",
    "approval.questionCommand": "May I run this command?",
    "approval.questionMcp": "May I run the MCP tool {x}?",
    "approval.questionWrite": "May I write to {x}?",
    "approval.questionAddMcp": "May I add and connect the MCP server “{x}”?",
    "approval.yes": "Yes",
    "approval.no": "No — tell it what to do differently",
    "approval.skip": "Skip",
    "approval.submit": "Submit",
    "approval.prefix": "Yes, and don't ask again for commands starting with: {x}",
    "approval.allowReadonly": "Yes, and allow read-only tools from {x}",
    "approval.allowChat": "Yes, and allow this tool for this chat",
    "approval.allowScope": "Yes, and allow this tool for the same target",
    "approval.trustSession": "Yes, and trust dangerous tools from {x} for this session",
    "approval.feedbackPlaceholder": "Tell it what to do instead…",
    "settings.balanceNoKey": "Save a key to see its balance",
    "settings.balanceNoLimit": "No spend limit set on this key",
    "settings.balanceUnavailable": "Balance unavailable",
    "settings.balanceLeft": "{remaining} of {limit} left",
    "settings.balanceSpent": "{usage} spent",
    "search.placeholder": "Search local chats",
    "search.noProject": "No project",
    "search.noResults": "No chats found",
    "mic.title": "Microphone",
    "status.ready": "Ready",
    "status.indexing": "Indexing project",
    "status.approved": "Approved, working…",
    "status.denied": "Denied",
    "status.failed": "Request failed",
    "status.saved": "Settings saved",
    "status.noVision": "Selected model does not support image parsing",
    "status.selectImage": "Select an image file",
    "status.stopped": "Stopped",
    "vision.warning": "Current model does not support image parsing.",
    "time.now": "now",
    "time.min": "{n}m",
    "time.hour": "{n}h",
    "time.day": "{n}d",
    "time.week": "{n}w",
    "time.month": "{n}mo",
  },
  de: {
    "nav.newChat": "Neuer Chat",
    "nav.search": "Suche",
    "nav.openProject": "Projekt öffnen",
    "nav.settings": "Einstellungen",
    "section.projects": "Projekte",
    "section.noProject": "Kein Projekt",
    "tree.noChats": "Keine Chats",
    "tree.showChats": "Chats anzeigen",
    "tree.hideChats": "Chats ausblenden",
    "title.sidebarOpen": "Sidebar öffnen",
    "title.sidebarClose": "Sidebar schließen",
    "title.back": "Zurück",
    "title.forward": "Vorwärts",
    "menu.file": "Datei",
    "menu.edit": "Bearbeiten",
    "menu.view": "Anzeigen",
    "menu.window": "Fenster",
    "menu.help": "Hilfe",
    "win.minimize": "Minimieren",
    "win.maximize": "Maximieren",
    "win.close": "Schließen",
    "chat.options": "Chat-Optionen",
    "chat.rename": "Umbenennen",
    "chat.pin": "Anpinnen",
    "chat.unpin": "Lösen",
    "chat.delete": "Löschen",
    "hero.generic": "Woran arbeiten wir?",
    "hero.project": "Woran arbeiten wir in {name}?",
    "composer.placeholder": "Mach, was du willst",
    "composer.goalPlaceholder": "Auf welches Ziel soll VantheaX hinarbeiten?",
    "composer.removeGoal": "Ziel entfernen",
    "composer.stop": "Stopp",
    "plus.add": "Hinzufügen",
    "plus.attach": "Fotos und Dateien hinzufügen",
    "plus.planMode": "Planmodus",
    "plus.goalMode": "Ziel verfolgen",
    "perm.title": "Befehlsfreigabe",
    "perm.ask": "Fragen",
    "perm.askDesc": "Jeden Befehl bestätigen",
    "perm.auto": "Auto",
    "perm.autoDesc": "Sichere laufen, riskante fragen",
    "perm.full": "Voll-Auto",
    "perm.fullDesc": "Alles läuft, nur System-Killer blockiert",
    "model.select": "Modell wählen",
    "model.effort": "Reasoning-Aufwand",
    "model.fallback": "Modell",
    "project.choose": "Projekt wählen",
    "project.search": "Projekt suchen",
    "project.none": "Keine Projekte",
    "project.add": "Projekt hinzufügen",
    "project.create": "Projekt erstellen",
    "project.addExisting": "Vorhandenen Ordner hinzufügen",
    "project.without": "Ohne Projekt arbeiten",
    "plan.title": "Plan",
    "plan.risk": "Risiko: {level}",
    "plan.riskTitle": "Risikoeinschätzung des Plans",
    "plan.keyChanges": "Wichtige Änderungen",
    "plan.files": "Dateien",
    "plan.testPlan": "Testplan",
    "plan.assumptions": "Annahmen",
    "plan.implementing": "Plan wird implementiert…",
    "plan.accepted": "Übernommen",
    "plan.rejected": "Plan verworfen — sag mir, was anders soll.",
    "plan.question": "Diesen Plan implementieren?",
    "plan.no": "Nein",
    "plan.yes": "Ja, implementieren",
    "work.thinking": "Denkt nach",
    "work.workingSince": "In Arbeit seit {s}s",
    "work.worked": "{time} gearbeitet",
    "edit.oneFile": "1 Datei bearbeitet",
    "edit.nFiles": "{n} Dateien bearbeitet",
    "cluster.commands": "{n} Befehle ausgeführt",
    "cluster.reads": "{n} Dateien gelesen",
    "todo.tasks": "Aufgaben",
    "todo.none": "Noch keine Aufgaben",
    "todo.goal": "Ziel",
    "todo.noGoal": "Kein Ziel aktiv",
    "diff.tooLarge": " · zu groß für Vorschau",
    "tool.denied": "Abgelehnt.",
    "tool.verifiedDone": "Verifiziert: fertig",
    "tool.notDone": "Noch nicht fertig",
    "live.creating": "Erstelle {x}",
    "live.editing": "Bearbeite {x}",
    "live.creatingGeneric": "Schreibe Datei…",
    "live.editingGeneric": "Bearbeite Datei…",
    "live.lines": "{n} Zeilen",
    "timeline.activity": "Agent-Aktivität",
    "timeline.done": "Fertig",
    "toollabel.running": "Führt {x} aus",
    "toollabel.runCmd": "{x} ausführen",
    "toollabel.denied": "{x} abgelehnt",
    "toollabel.grepping": "Sucht {x}",
    "grep.matches": "{n} Treffer",
    "grep.noMatches": "Keine Treffer",
    "toollabel.writing": "Schreibt {x}",
    "toollabel.editing": "Bearbeitet {x}",
    "toollabel.reading": "Liest {x}",
    "toollabel.listing": "Listet Dateien",
    "toollabel.working": "Arbeitet",
    "inspector.title": "Inspector",
    "inspector.noFile": "Keine Datei gewählt",
    "inspector.previewHint": "Wähle eine Datei für eine Vorschau der ersten 500 Zeilen.",
    "settings.title": "Einstellungen",
    "settings.apiKey": "OpenRouter-API-Key",
    "settings.stored": "Lokal gespeichert",
    "settings.saveKey": "Key speichern",
    "settings.language": "Sprache",
    "settings.balance": "Key-Guthaben",
    "settings.tabGeneral": "Allgemein",
    "settings.tabMcp": "MCP-Server",
    "settings.mcpName": "Name (a-z, 0-9, _ -)",
    "settings.mcpCommand": "Befehl (z.B. uvx, python, npx)",
    "settings.mcpArgs": "Argumente (eins pro Zeile)",
    "settings.mcpEnv": "Umgebung (KEY=value pro Zeile)",
    "settings.mcpAdd": "Server hinzufügen",
    "settings.mcpSave": "Server speichern",
    "settings.mcpRemove": "Entfernen",
    "settings.mcpReconnect": "Neu verbinden",
    "mcp.empty": "Noch keine MCP-Server. Füg einen hinzu, um dem Modell extra Tools zu geben.",
    "mcp.addHelp": "Am einfachsten: oben den Ordner des Servers wählen, dann erkennt die App selbst, wie er gestartet wird. Sonst die Config aus der README einfügen (dasselbe JSON wie bei Claude Desktop) oder Name und Befehl von Hand eintragen.",
    "mcp.pastePlaceholder": "Server-Config hier einfügen, z.B.\n{ \"command\": \"uvx\", \"args\": [\"ida-pro-mcp\"] }",
    "mcp.orManual": "oder von Hand ausfüllen",
    "mcp.choosePlugin": "Plugin-Ordner wählen",
    "mcp.orPaste": "oder Config einfügen",
    "mcp.detectFail": "Konnte diesen Ordner nicht erkennen. Config aus der README einfügen oder unten ausfüllen.",
    "mcp.enable": "Aktivieren",
    "mcp.disable": "Deaktivieren",
    "mcp.tools": "Tools",
    "mcp.trustDangerous": "Gefährlichen Tools dieses Servers für diese Session vertrauen",
    "mcp.status.ready": "{n} Tools",
    "mcp.status.error": "Fehler",
    "mcp.status.starting": "Startet…",
    "mcp.status.disabled": "Deaktiviert",
    "mcp.status.unsupported": "HTTP noch nicht unterstützt",
    "tool.awaiting": "Wartet auf deine Freigabe",
    "toollabel.mcp": "{server} · {tool}",
    "toollabel.addMcp": "MCP-Server {x} hinzufügen",
    "risk.readonly": "nur lesen",
    "risk.state_change": "Statusänderung",
    "risk.dangerous": "gefährlich",
    "risk.shell_system": "Shell",
    "approval.questionCommand": "Darf ich diesen Befehl ausführen?",
    "approval.questionMcp": "Darf ich das MCP-Tool {x} ausführen?",
    "approval.questionWrite": "Darf ich {x} schreiben?",
    "approval.questionAddMcp": "Darf ich den MCP-Server „{x}“ hinzufügen und verbinden?",
    "approval.yes": "Ja",
    "approval.no": "Nein — sag, was anders gemacht werden soll",
    "approval.skip": "Überspringen",
    "approval.submit": "Absenden",
    "approval.prefix": "Ja, und bei Befehlen nicht mehr nachfragen, die beginnen mit: {x}",
    "approval.allowReadonly": "Ja, und Lese-Tools von {x} immer erlauben",
    "approval.allowChat": "Ja, und dieses Tool für diesen Chat erlauben",
    "approval.allowScope": "Ja, und dieses Tool für dasselbe Ziel erlauben",
    "approval.trustSession": "Ja, und gefährlichen Tools von {x} für diese Session vertrauen",
    "approval.feedbackPlaceholder": "Sag, was stattdessen gemacht werden soll…",
    "settings.balanceNoKey": "Key speichern, um das Guthaben zu sehen",
    "settings.balanceNoLimit": "Kein Ausgabenlimit auf diesem Key",
    "settings.balanceUnavailable": "Guthaben nicht verfügbar",
    "settings.balanceLeft": "{remaining} von {limit} übrig",
    "settings.balanceSpent": "{usage} ausgegeben",
    "search.placeholder": "Lokale Chats durchsuchen",
    "search.noProject": "Kein Projekt",
    "search.noResults": "Keine Chats gefunden",
    "mic.title": "Mikrofon",
    "status.ready": "Bereit",
    "status.indexing": "Projekt wird indexiert",
    "status.approved": "Freigegeben, arbeite…",
    "status.denied": "Abgelehnt",
    "status.failed": "Anfrage fehlgeschlagen",
    "status.saved": "Einstellungen gespeichert",
    "status.noVision": "Gewähltes Modell unterstützt keine Bilder",
    "status.selectImage": "Bilddatei auswählen",
    "status.stopped": "Gestoppt",
    "vision.warning": "Aktuelles Modell unterstützt keine Bilder.",
    "time.now": "jetzt",
    "time.min": "{n} Min.",
    "time.hour": "{n} Std.",
    "time.day": "{n} Tag(e)",
    "time.week": "{n} W",
    "time.month": "{n} M",
  },
};

const t = (key, vars) => {
  const table = STRINGS[LANG] || STRINGS.en;
  let value = table[key];
  if (value === undefined) {
    value = STRINGS.en[key];
  }
  if (value === undefined) {
    return key;
  }
  if (vars) {
    for (const name of Object.keys(vars)) {
      value = value.replaceAll(`{${name}}`, String(vars[name]));
    }
  }
  return value;
};

const api = window.agentApi;
const chatsKey = "vantheax:chats";
const activeChatKey = "vantheax:active-chat";
const BOTTOM_STICK_PX = 100;

const emptyIndex = {
  root: "",
  directories: [],
  files: [],
  snippets: [],
  summary: "No project selected",
};

const loadLocalChats = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(chatsKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const makeChat = (projectPath = "") => ({
  id: crypto.randomUUID(),
  projectPath,
  pinned: false,
  title: "New chat",
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const cleanHistory = (messages) => messages
  .filter((message) => message.role === "user" || message.role === "assistant")
  .map((message) => ({ role: message.role, content: (message.content || "") + (message.cancelled ? "\n\n[The user stopped this response before it finished.]" : "") }))
  .filter((message) => message.content.trim());

const collectReadPaths = (messages) => {
  const seen = new Set();
  const paths = [];
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const tool of message.tools || []) {
      if (tool.name === "read_file" || tool.name === "get_file_outline") {
        const candidate = tool.result?.path;
        if (candidate && !seen.has(candidate)) {
          seen.add(candidate);
          paths.push(candidate);
        }
      }
    }
  }
  return paths;
};

const titleFromText = (text) => {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "New chat";
  }
  return trimmed.length > 58 ? `${trimmed.slice(0, 58)}...` : trimmed;
};

const formatSize = (value) => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const folderName = (pathValue) => {
  if (!pathValue) {
    return "";
  }
  return pathValue.split(/[\\/]/).filter(Boolean).pop() || pathValue;
};

const normPath = (pathValue) => (pathValue || "").replace(/[\\/]+$/, "").toLowerCase();

const formatRelativeTime = (iso) => {
  if (!iso) {
    return "";
  }
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return t("time.now");
  }
  if (minutes < 60) {
    return t("time.min", { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t("time.hour", { n: hours });
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return t("time.day", { n: days });
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return t("time.week", { n: weeks });
  }
  return t("time.month", { n: Math.floor(days / 30) });
};

const App = () => {
  const [settings, setSettings] = useState({ model: "deepseek/deepseek-v4-flash", effort: "high", mode: "ask", language: "en", projects: [] });
  const [models, setModels] = useState([]);
  const [projectPath, setProjectPath] = useState("");
  const [projectIndex, setProjectIndex] = useState(emptyIndex);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [openProviders, setOpenProviders] = useState([]);
  const [collapsedProjects, setCollapsedProjects] = useState([]);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState("Ready");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [planMode, setPlanMode] = useState(false);
  const [goalMode, setGoalMode] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [todos, setTodos] = useState([]);
  const [todoPanelOpen, setTodoPanelOpen] = useState(false);
  const [goalDone, setGoalDone] = useState(false);
  const [pendingPermission, setPendingPermission] = useState(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const chatsLoadedRef = useRef(false);
  const activeRequestRef = useRef(null);
  const activeMsgRef = useRef(null);
  const messagesRef = useRef(null);
  const atBottomRef = useRef(true);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) || null, [chats, activeChatId]);
  useEffect(() => {
    if (busy) {
      return;
    }
    const msgs = activeChat?.messages || [];
    let found = null;
    let done = false;
    for (const message of msgs) {
      if (message.role !== "assistant") {
        continue;
      }
      for (const tt of message.tools || []) {
        if (tt.name === "update_todos" && Array.isArray(tt.result?.todos)) {
          found = tt.result.todos;
        }
        if (tt.name === "verify_goal" && tt.result?.verifier?.done) {
          done = true;
        }
      }
    }
    setTodos(found || []);
    setGoalDone(done);
  }, [activeChatId]);
  const messages = activeChat?.messages || [];
  const currentModel = useMemo(() => models.find((model) => model.id === settings.model) || models[0], [models, settings.model]);
  LANG = settings.language || "en";

  useEffect(() => {
    const init = async () => {
      const [loadedSettings, loadedModels] = await Promise.all([api.getSettings(), api.getModels()]);
      let storedChats = await api.loadChats();
      const legacyChats = loadLocalChats();
      if (!storedChats.length && legacyChats.length) {
        storedChats = legacyChats;
        await api.saveChats(storedChats);
        localStorage.removeItem(chatsKey);
      }
      storedChats = storedChats.map((chat) => ({
        ...chat,
        messages: (chat.messages || []).map((message) => (message.role === "assistant" && message.done === false)
          ? { ...message, done: true, cancelled: true }
          : message),
      }));
      const storedActive = localStorage.getItem(activeChatKey) || "";
      setSettings(loadedSettings);
      setModels(loadedModels);
      setChats(storedChats);
      chatsLoadedRef.current = true;
      const initialChat = storedChats.find((chat) => chat.id === storedActive) || storedChats[0] || null;
      if (initialChat) {
        setActiveChatId(initialChat.id);
        localStorage.setItem(activeChatKey, initialChat.id);
        if (initialChat.projectPath) {
          setProjectPath(initialChat.projectPath);
          await refreshProject(initialChat.projectPath);
        }
      } else if (loadedSettings.projects?.[0]) {
        setProjectPath(loadedSettings.projects[0]);
        await refreshProject(loadedSettings.projects[0]);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setModelOpen(false);
        setPermissionOpen(false);
        setPlusMenuOpen(false);
        setProjectMenuOpen(false);
        setSettingsOpen(false);
        setChatMenuOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (!plusMenuOpen && !permissionOpen && !modelOpen && !projectMenuOpen && !chatMenuOpen) {
      return;
    }
    const onDown = (event) => {
      if (!event.target.closest(".plus-picker")) {
        setPlusMenuOpen(false);
      }
      if (!event.target.closest(".permission-picker")) {
        setPermissionOpen(false);
      }
      if (!event.target.closest(".model-picker")) {
        setModelOpen(false);
      }
      if (!event.target.closest(".project-picker")) {
        setProjectMenuOpen(false);
      }
      if (!event.target.closest(".chat-menu-wrap")) {
        setChatMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [plusMenuOpen, permissionOpen, modelOpen, projectMenuOpen, chatMenuOpen]);

  useEffect(() => {
    if (!chatsLoadedRef.current) {
      return;
    }
    const timer = setTimeout(() => { api.saveChats(chats); }, 400);
    return () => clearTimeout(timer);
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem(activeChatKey, activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    if (currentModel?.provider) {
      setOpenProviders([currentModel.provider]);
    }
  }, [currentModel?.provider]);

  const visibleFiles = useMemo(() => {
    const text = fileQuery.trim().toLowerCase();
    const files = projectIndex.files || [];
    if (!text) {
      return files.slice(0, 700);
    }
    return files.filter((file) => file.path.toLowerCase().includes(text)).slice(0, 700);
  }, [projectIndex.files, fileQuery]);

  const visibleProjects = useMemo(() => {
    const text = projectSearch.trim().toLowerCase();
    const projects = settings.projects || [];
    if (!text) {
      return projects;
    }
    return projects.filter((item) => `${folderName(item)} ${item}`.toLowerCase().includes(text));
  }, [settings.projects, projectSearch]);

  const sortChats = (list) => list.slice().sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))) || String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const noProjectChats = useMemo(() => sortChats(chats.filter((chat) => !chat.projectPath)), [chats]);

  const searchedChats = useMemo(() => {
    const text = chatQuery.trim().toLowerCase();
    const pool = chats.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (!text) {
      return pool.slice(0, 40);
    }
    return pool.filter((chat) => {
      const haystack = `${chat.title} ${chat.projectPath} ${(chat.messages || []).map((message) => message.content).join(" ")}`.toLowerCase();
      return haystack.includes(text);
    }).slice(0, 40);
  }, [chats, chatQuery]);

  const updateChats = (updater) => {
    setChats((current) => updater(current));
  };

  const renameChat = (chatId, title) => {
    const clean = title.trim();
    if (!clean) {
      return;
    }
    updateChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, title: clean } : chat));
  };

  const deleteChat = (chatId) => {
    updateChats((current) => current.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId("");
    }
  };

  const togglePinChat = (chatId) => {
    updateChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat));
  };

  const startRename = () => {
    setRenameValue(activeChat?.title || "");
    setRenamingChatId(activeChat?.id || "");
    setChatMenuOpen(false);
  };

  const commitRename = () => {
    if (renamingChatId) {
      renameChat(renamingChatId, renameValue);
    }
    setRenamingChatId("");
  };

  const persistSettings = async (next) => {
    const saved = await api.saveSettings(next);
    setSettings((current) => ({ ...current, ...saved }));
  };

  const refreshProject = async (pathValue = projectPath) => {
    if (!pathValue) {
      return;
    }
    setStatus(t("status.indexing"));
    try {
      const index = await api.indexProject(pathValue);
      setProjectIndex(index);
      setStatus(index.summary);
    } catch (error) {
      setProjectIndex(emptyIndex);
      setStatus(error.message);
    }
  };

  const chooseProject = async () => {
    const pathValue = await api.chooseProject();
    if (!pathValue) {
      return;
    }
    setProjectMenuOpen(false);
    setProjectPath(pathValue);
    setSelectedFile(null);
    setSelectedContent("");
    await refreshProject(pathValue);
    const saved = await api.getSettings();
    setSettings(saved);
    const chat = makeChat(pathValue);
    updateChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
  };

  const createProject = async () => {
    const pathValue = await api.createProject();
    if (!pathValue) {
      return;
    }
    setProjectMenuOpen(false);
    setProjectPath(pathValue);
    setSelectedFile(null);
    setSelectedContent("");
    await refreshProject(pathValue);
    const saved = await api.getSettings();
    setSettings(saved);
    const chat = makeChat(pathValue);
    updateChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
  };

  const selectProject = async (pathValue) => {
    setProjectMenuOpen(false);
    setProjectPath(pathValue);
    setSelectedFile(null);
    setSelectedContent("");
    await refreshProject(pathValue);
  };

  const workWithoutProject = () => {
    setProjectMenuOpen(false);
    setProjectPath("");
    setProjectIndex(emptyIndex);
    setSelectedFile(null);
    setSelectedContent("");
    setStatus(t("status.ready"));
  };

  const cancelActiveStream = () => {
    if (activeRequestRef.current) {
      api.cancelStream(activeRequestRef.current);
      activeRequestRef.current = null;
    }
    activeMsgRef.current = null;
    setPendingPermission(null);
    setBusy(false);
  };

  const onMessagesScroll = () => {
    const el = messagesRef.current;
    if (el) {
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_STICK_PX;
    }
  };

  useEffect(() => {
    const el = messagesRef.current;
    if (el && atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const newChat = () => {
    cancelActiveStream();
    atBottomRef.current = true;
    const chat = makeChat(projectPath);
    updateChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setInput("");
    setImageAttachment(null);
    setGoalText("");
    setTodos([]);
    setGoalDone(false);
  };

  const openChat = async (chat) => {
    cancelActiveStream();
    atBottomRef.current = true;
    setActiveChatId(chat.id);
    setSearchOpen(false);
    setTodos([]);
    setGoalDone(false);
    if (chat.projectPath && chat.projectPath !== projectPath) {
      setProjectPath(chat.projectPath);
      await refreshProject(chat.projectPath);
    }
  };

  const openFile = async (file) => {
    setSelectedFile(file);
    setInspectorOpen(true);
    setSelectedContent("Loading...");
    try {
      const result = await api.readFile(projectPath, file.path);
      setSelectedContent(result.content);
    } catch (error) {
      setSelectedContent(error.message);
    }
  };

  const pickImage = () => {
    fileInputRef.current?.click();
  };

  const onImageSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus(t("status.selectImage"));
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setImageAttachment({ name: file.name, type: file.type, size: file.size, dataUrl });
  };

  const sendMessage = async (overrideText = null, overrides = {}) => {
    const text = (typeof overrideText === "string" ? overrideText : input).trim();
    const effectivePlanMode = overrides.planMode !== undefined ? overrides.planMode : planMode;
    const effectiveGoal = goalMode ? (goalText.trim() || text) : "";
    if (goalMode && !goalText.trim() && text) {
      setGoalText(text);
    }
    if ((!text && !imageAttachment) || busy) {
      return;
    }
    if (imageAttachment && !currentModel?.supportsVision) {
      setStatus(t("status.noVision"));
      return;
    }
    setTodos([]);
    setGoalDone(false);
    const chat = activeChat || makeChat(projectPath);
    if (!activeChat) {
      updateChats((current) => [chat, ...current]);
      setActiveChatId(chat.id);
    }
    const assistantId = crypto.randomUUID();
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text || "Analyze this image.",
      attachment: imageAttachment ? { name: imageAttachment.name, type: imageAttachment.type, size: imageAttachment.size, dataUrl: imageAttachment.dataUrl } : null,
      createdAt: new Date().toISOString(),
    };
    const assistantDraft = { id: assistantId, role: "assistant", content: "", tools: [], segments: [], startedAt: Date.now(), done: false, createdAt: new Date().toISOString() };
    const previousMessages = chat.messages || [];
    const nextMessages = [...previousMessages, userMessage, assistantDraft];
    const nextTitle = chat.title === "New chat" ? titleFromText(userMessage.content) : chat.title;
    setInput("");
    setImageAttachment(null);
    setBusy(true);
    const requestId = crypto.randomUUID();
    activeRequestRef.current = requestId;
    activeMsgRef.current = { chatId: chat.id, assistantId };
    updateChats((current) => {
      const exists = current.some((item) => item.id === chat.id);
      const mapped = (exists ? current : [chat, ...current]).map((item) => item.id === chat.id ? { ...item, title: nextTitle, projectPath, messages: nextMessages, updatedAt: new Date().toISOString() } : item);
      return mapped;
    });
    try {
      const result = await api.sendMessage({
        requestId,
        projectPath,
        chatId: chat.id,
        model: settings.model,
        effort: settings.effort,
        mode: settings.mode,
        planMode: effectivePlanMode,
        goalMode,
        goal: effectiveGoal,
        message: userMessage.content,
        imageDataUrl: imageAttachment?.dataUrl || "",
        supportsVision: Boolean(currentModel?.supportsVision),
        history: cleanHistory(previousMessages),
        readPaths: collectReadPaths(previousMessages),
      }, (event) => {
        if (event.type === "delta") {
          updateChats((current) => current.map((item) => item.id === chat.id ? { ...item, messages: item.messages.map((message) => {
            if (message.id !== assistantId) {
              return message;
            }
            const segments = message.segments ? [...message.segments] : [];
            const last = segments[segments.length - 1];
            if (last && last.type === "text") {
              segments[segments.length - 1] = { ...last, content: last.content + event.delta };
            } else {
              segments.push({ type: "text", content: event.delta });
            }
            return { ...message, content: `${message.content || ""}${event.delta}`, segments, liveTool: null };
          }), updatedAt: new Date().toISOString() } : item));
        }
        if (event.type === "tool_progress") {
          updateChats((current) => current.map((item) => item.id === chat.id ? { ...item, messages: item.messages.map((message) =>
            message.id === assistantId ? { ...message, liveTool: { name: event.name, path: event.path, lines: event.lines } } : message
          ) } : item));
        }
        if (event.type === "tool") {
          if (event.tool?.name === "update_todos" && Array.isArray(event.tool.result?.todos)) {
            setTodos(event.tool.result.todos);
          }
          if (event.tool?.name === "verify_goal" && event.tool.result?.verifier?.done) {
            setGoalDone(true);
          }
          updateChats((current) => current.map((item) => item.id === chat.id ? { ...item, messages: item.messages.map((message) => {
            if (message.id !== assistantId) {
              return message;
            }
            const existing = message.tools || [];
            const at = existing.findIndex((entry) => entry.id === event.tool.id);
            const tools = at >= 0 ? existing.map((entry, idx) => idx === at ? event.tool : entry) : [...existing, event.tool];
            const segments = message.segments ? [...message.segments] : [];
            const si = segments.findIndex((entry) => entry.type === "tool" && entry.tool.id === event.tool.id);
            if (si >= 0) {
              segments[si] = { type: "tool", tool: event.tool };
            } else {
              segments.push({ type: "tool", tool: event.tool });
            }
            return { ...message, tools, segments, liveTool: null };
          }), updatedAt: new Date().toISOString() } : item));
          if (event.tool?.result?.permissionRequired) {
            setPendingPermission({ callId: event.tool.id, tool: event.tool });
          } else if (event.tool?.id) {
            setPendingPermission((prev) => (prev && prev.callId === event.tool.id ? null : prev));
          }
        }
      });
      updateChats((current) => current.map((item) => item.id === chat.id ? { ...item, messages: item.messages.map((message) => (message.id === assistantId && !message.cancelled) ? { ...message, content: result.content || message.content, tools: result.tools || message.tools || [], done: true, workMs: message.workMs || (Date.now() - (message.startedAt || Date.now())) } : message), updatedAt: new Date().toISOString() } : item));
      if (activeRequestRef.current === requestId) {
        setStatus(t("status.ready"));
      }
    } catch (error) {
      if (activeRequestRef.current === requestId) {
        updateChats((current) => current.map((item) => item.id === chat.id ? { ...item, messages: item.messages.map((message) => message.id === assistantId ? { ...message, content: error.message, error: true, tools: [], segments: [], done: true } : message), updatedAt: new Date().toISOString() } : item));
        setStatus(t("status.failed"));
      }
    } finally {
      if (activeRequestRef.current === requestId) {
        setBusy(false);
        activeRequestRef.current = null;
        activeMsgRef.current = null;
      }
    }
  };

  const stopGeneration = () => {
    const active = activeMsgRef.current;
    if (activeRequestRef.current) {
      api.cancelStream(activeRequestRef.current);
    }
    if (active) {
      updateChats((current) => current.map((item) => item.id === active.chatId ? { ...item, messages: item.messages.map((message) => message.id === active.assistantId ? { ...message, done: true, cancelled: true, workMs: message.workMs || Math.max(1, Date.now() - (message.startedAt || Date.now())) } : message), updatedAt: new Date().toISOString() } : item));
      setStatus(t("status.stopped"));
    }
    activeRequestRef.current = null;
    activeMsgRef.current = null;
    setPendingPermission(null);
    setBusy(false);
  };

  const acceptPlan = () => {
    setPlanMode(false);
    const msgs = activeChat?.messages || [];
    const planMsg = [...msgs].reverse().find((m) =>
      (m.tools || []).some((tt) => tt.result && tt.result.plan) ||
      (m.segments || []).some((s) => s.type === "tool" && s.tool.result && s.tool.result.plan));
    const plan =
      (planMsg && (planMsg.tools || []).find((tt) => tt.result && tt.result.plan)?.result.plan) ||
      (planMsg && (planMsg.segments || []).find((s) => s.type === "tool" && s.tool.result && s.tool.result.plan)?.tool.result.plan) || null;
    const lines = [];
    if (plan) {
      if (plan.summary) lines.push(`Summary: ${plan.summary}`);
      if (plan.keyChanges && plan.keyChanges.length) lines.push("Key changes:\n" + plan.keyChanges.map((x) => `- ${x}`).join("\n"));
      if (plan.filesToChange && plan.filesToChange.length) lines.push("Files to change:\n" + plan.filesToChange.map((x) => `- ${x}`).join("\n"));
    }
    const planText = lines.length ? "Here is the plan you presented:\n" + lines.join("\n") + "\n\n" : "";
    sendMessage(`${planText}Implement this plan now. Write the files and make the changes.`, { planMode: false });
  };

  const saveKey = async () => {
    await persistSettings({ openRouterKeyPlain: keyInput });
    setKeyInput("");
    setSettingsOpen(false);
    setStatus(t("status.saved"));
  };

  const resolvePermission = async (callId, decision) => {
    if (!callId) {
      return;
    }
    setPendingPermission(null);
    setStatus(decision.approved ? t("status.approved") : t("status.denied"));
    try {
      await api.resolvePermission(callId, decision);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className={`window-root ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${inspectorOpen ? "inspector-open" : "inspector-closed"}`}>
      <header className="titlebar">
        <div className="titlebar-left">
          <button className="chrome-button sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? t("title.sidebarOpen") : t("title.sidebarClose")}>
            <PanelLeft size={15} />
          </button>
          <button className="chrome-button" title={t("title.back")}>
            <ChevronLeft size={15} />
          </button>
          <button className="chrome-button" title={t("title.forward")}>
            <ChevronRight size={15} />
          </button>
          <nav className="titlebar-menu">
            <button>{t("menu.file")}</button>
            <button>{t("menu.edit")}</button>
            <button>{t("menu.view")}</button>
            <button>{t("menu.window")}</button>
            <button>{t("menu.help")}</button>
          </nav>
        </div>
        <div className="titlebar-center" />
        <div className="titlebar-actions">
          <button onClick={() => api.minimizeWindow()} title={t("win.minimize")}><Minus size={15} /></button>
          <button onClick={() => api.maximizeWindow()} title={t("win.maximize")}><Square size={13} /></button>
          <button className="close" onClick={() => api.closeWindow()} title={t("win.close")}><X size={16} /></button>
        </div>
      </header>

      <div className="app-shell">
        <aside className="rail">
          <button className="nav-button" onClick={newChat} title={t("nav.newChat")}>
            <Pencil size={16} />
            <span>{t("nav.newChat")}</span>
          </button>
          <button className="nav-button" onClick={() => setSearchOpen(true)} title={t("nav.search")}>
            <Search size={17} />
            <span>{t("nav.search")}</span>
          </button>
          <button className="nav-button" onClick={chooseProject} title={t("nav.openProject")}>
            <FolderOpen size={17} />
            <span>{t("nav.openProject")}</span>
          </button>
          <div className="rail-scroll">
          {Boolean(settings.projects?.length) && (
            <>
              <div className="section-label">{t("section.projects")}</div>
              <div className="project-tree">
                {settings.projects.map((item) => {
                  const list = sortChats(chats.filter((chat) => normPath(chat.projectPath) === normPath(item)));
                  const collapsed = collapsedProjects.includes(item);
                  return (
                    <div key={item} className="project-group">
                      <div className={item === projectPath && !activeChatId ? "project-head active" : "project-head"}>
                        <button className="project-head-main" title={item} onClick={async () => { setActiveChatId(""); setProjectPath(item); await refreshProject(item); }}>
                          <FolderClosed size={15} />
                          <span className="project-head-name">{folderName(item)}</span>
                        </button>
                        <button className={collapsed ? "project-collapse is-collapsed" : "project-collapse"} title={collapsed ? t("tree.showChats") : t("tree.hideChats")} onClick={() => setCollapsedProjects((current) => current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item])}>
                          <ChevronDown size={15} />
                        </button>
                      </div>
                      <div className={collapsed ? "project-chats is-collapsed" : "project-chats"}>
                        <div className="project-chats-inner">
                          {list.length === 0 ? (
                            <div className="project-empty">{t("tree.noChats")}</div>
                          ) : list.map((chat) => (
                            <button key={chat.id} className={chat.id === activeChatId ? "tree-chat active" : "tree-chat"} onClick={() => openChat(chat)}>
                              <span>{chat.title}</span>
                              {chat.pinned && <Pin size={12} className="chat-row-pin" />}
                              <small>{formatRelativeTime(chat.updatedAt)}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {Boolean(noProjectChats.length) && (
            <>
              <div className="section-label">{t("section.noProject")}</div>
              <div className="project-chats-inner project-chats-root">
                {noProjectChats.map((chat) => (
                  <button key={chat.id} className={chat.id === activeChatId ? "tree-chat active" : "tree-chat"} onClick={() => openChat(chat)}>
                    <span>{chat.title}</span>
                    {chat.pinned && <Pin size={12} className="chat-row-pin" />}
                    <small>{formatRelativeTime(chat.updatedAt)}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
          <button className="rail-settings" onClick={() => setSettingsOpen(true)} title={t("nav.settings")}>
            <Settings size={17} />
            <span>{t("nav.settings")}</span>
          </button>
        </aside>

        <main className={messages.length ? "chat-panel has-messages" : "chat-panel is-empty"}>
          <button className={todoPanelOpen ? "todo-toggle is-on" : "todo-toggle"} onClick={() => setTodoPanelOpen(!todoPanelOpen)} title={t("todo.tasks")}><ListIcon size={16} /></button>
          <TodoPanel todos={todos} goalMode={goalMode} goal={goalText} goalDone={goalDone} open={todoPanelOpen} />
          {messages.length > 0 && (
            <header className="chat-header">
              {renamingChatId && renamingChatId === activeChat?.id ? (
                <input
                  className="chat-rename-input"
                  value={renameValue}
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { commitRename(); } if (event.key === "Escape") { setRenamingChatId(""); } }}
                  onBlur={commitRename}
                />
              ) : (
                <div className="chat-title">{activeChat?.title || "New chat"}</div>
              )}
              {activeChat && (
                <div className="chat-menu-wrap">
                  <button className="chat-menu-trigger" onClick={() => setChatMenuOpen(!chatMenuOpen)} title={t("chat.options")}><MoreHorizontal size={18} /></button>
                  {chatMenuOpen && (
                    <div className="chat-menu">
                      <button className="chat-menu-row" onClick={startRename}><PencilLine size={15} /><span>{t("chat.rename")}</span></button>
                      <button className="chat-menu-row" onClick={() => { togglePinChat(activeChat.id); setChatMenuOpen(false); }}><Pin size={15} /><span>{activeChat.pinned ? t("chat.unpin") : t("chat.pin")}</span></button>
                      <button className="chat-menu-row danger" onClick={() => { deleteChat(activeChat.id); setChatMenuOpen(false); }}><Trash2 size={15} /><span>{t("chat.delete")}</span></button>
                    </div>
                  )}
                </div>
              )}
            </header>
          )}

          {messages.length > 0 && (
            <div className="messages" ref={messagesRef} onScroll={onMessagesScroll}>
              {messages.map((message, index) => (
                <Message key={message.id || `${message.createdAt}-${index}`} message={message} onAcceptPlan={acceptPlan} />
              ))}
            </div>
          )}

          <div className="composer-region">
            {messages.length === 0 && (
              <h1 className="hero-title">{projectPath ? t("hero.project", { name: folderName(projectPath) }) : t("hero.generic")}</h1>
            )}
            {imageAttachment && (
              <div className="attachment-strip">
                <div className="image-chip">
                  <img src={imageAttachment.dataUrl} alt="" />
                  <div>
                    <span>{imageAttachment.name}</span>
                    <small>{formatSize(imageAttachment.size)}</small>
                  </div>
                  <button onClick={() => setImageAttachment(null)}><X size={14} /></button>
                </div>
                {!currentModel?.supportsVision && <div className="vision-warning">{t("vision.warning")}</div>}
              </div>
            )}
            <div className="composer-stack">
              {pendingPermission ? (
                <ApprovalForm tool={pendingPermission.tool} onResolve={(decision) => resolvePermission(pendingPermission.callId, decision)} />
              ) : (
              <div className="composer">
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={goalMode && !goalText ? t("composer.goalPlaceholder") : t("composer.placeholder")} />
                <div className="composer-controls">
                  <input ref={fileInputRef} className="hidden-input" type="file" accept="image/*" onChange={onImageSelected} />
                  <PlusMenu open={plusMenuOpen} onToggle={() => setPlusMenuOpen(!plusMenuOpen)} onPickFile={() => { setPlusMenuOpen(false); pickImage(); }} planMode={planMode} goalMode={goalMode} onTogglePlan={() => setPlanMode((value) => !value)} onToggleGoal={() => setGoalMode((value) => !value)} />
                  <PermissionPicker value={settings.mode} open={permissionOpen} onToggle={() => setPermissionOpen(!permissionOpen)} onChange={(mode) => { persistSettings({ mode }); setPermissionOpen(false); }} />
                  <div className="composer-spacer" />
                  <ModelEffortPicker models={models} value={settings.model} effort={settings.effort} open={modelOpen} openProviders={openProviders} onToggle={() => setModelOpen(!modelOpen)} onToggleProvider={(provider) => setOpenProviders((current) => current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider])} onModelChange={(model) => { const selected = models.find((item) => item.id === model); persistSettings({ model, effort: selected?.defaultEffort || "" }); }} onEffortChange={(effort) => persistSettings({ effort })} />
                  <button className="tool-button mic-button" title={t("mic.title")}><Mic size={16} /></button>
                  {busy ? (
                    <button className="send-button is-stopping" onClick={stopGeneration} title={t("composer.stop")}>
                      <Square size={15} />
                    </button>
                  ) : (
                    <button className="send-button" onClick={sendMessage} disabled={(!input.trim() && !imageAttachment) || Boolean(imageAttachment && !currentModel?.supportsVision)}>
                      <ArrowUp size={18} />
                    </button>
                  )}
                </div>
              </div>
              )}
              {messages.length === 0 && !pendingPermission && (
                <ProjectPicker open={projectMenuOpen} query={projectSearch} setQuery={setProjectSearch} projects={visibleProjects} selectedPath={projectPath} onToggle={() => setProjectMenuOpen(!projectMenuOpen)} onSelect={selectProject} onChooseProject={chooseProject} onCreateProject={createProject} onWorkWithoutProject={workWithoutProject} />
              )}
            </div>
          </div>
        </main>

        {inspectorOpen && (
          <aside className="inspector">
            <div className="panel-header compact">
              <div>
                <div className="panel-title">{t("inspector.title")}</div>
                <div className="panel-meta">{selectedFile ? selectedFile.path : t("inspector.noFile")}</div>
              </div>
            </div>
            <pre className="file-preview">{selectedContent || t("inspector.previewHint")}</pre>
          </aside>
        )}
      </div>

      {searchOpen && <SearchOverlay chats={searchedChats} query={chatQuery} setQuery={setChatQuery} onClose={() => setSearchOpen(false)} onOpen={openChat} />}
      {settingsOpen && <SettingsModal hasKey={settings.hasOpenRouterKey} value={keyInput} setValue={setKeyInput} onSave={saveKey} onClose={() => setSettingsOpen(false)} lang={settings.language || "en"} onLang={(value) => persistSettings({ language: value })} />}
    </div>
  );
};

const compactModelName = (model) => {
  if (!model?.label) {
    return t("model.fallback");
  }
  return model.label.replace(/^DeepSeek\s+/i, "").replace(/^Qwen\s+/i, "Qwen ");
};

const EFFORT_LABEL = { minimal: "Minimal", low: "Low", medium: "Medium", high: "High", xhigh: "Max" };

const ModelEffortPicker = ({ models, value, effort, open, openProviders, onToggle, onToggleProvider, onModelChange, onEffortChange }) => {
  const selected = models.find((model) => model.id === value) || models[0];
  const providers = [...new Set(models.map((model) => model.provider || model.providerKey || "Models"))];
  const hasEfforts = Boolean(selected?.efforts?.length);
  const activeEffort = effort || selected?.defaultEffort;
  return (
    <div className="model-picker model-effort-picker">
      <button className="model-effort-trigger" onClick={onToggle}>
        <span className="model-name">{compactModelName(selected)}</span>
        {hasEfforts && <span className="effort-name">{EFFORT_LABEL[activeEffort] || activeEffort}</span>}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="model-menu">
          <div className="model-menu-title">{t("model.select")}</div>
          {providers.map((provider) => {
            const expanded = openProviders.includes(provider);
            return (
              <div key={provider} className="model-provider-group">
                <button className={expanded ? "model-provider is-open" : "model-provider"} onClick={() => onToggleProvider(provider)}>
                  <span className="model-provider-name">{provider}</span>
                  <ChevronDown size={14} className="model-provider-arrow" />
                </button>
                <div className={expanded ? "model-provider-children is-open" : "model-provider-children"}>
                  <div className="model-provider-children-inner">
                    {models.filter((model) => (model.provider || model.providerKey || "Models") === provider).map((model) => (
                      <button key={model.id} className={model.id === value ? "model-option is-active" : "model-option"} onClick={() => onModelChange(model.id)}>
                        <span>{model.label.replace(`${provider} `, "")}</span>
                        {model.id === value && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {hasEfforts && (
            <div className="effort-section">
              <div className="model-menu-divider" />
              <div className="effort-section-label">{t("model.effort")}</div>
              {selected.efforts.map((item) => (
                <button key={item} className={item === activeEffort ? "effort-option is-active" : "effort-option"} onClick={() => onEffortChange(item)}>
                  <span>{EFFORT_LABEL[item] || item}</span>
                  {item === activeEffort && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProjectPicker = ({ open, query, setQuery, projects, selectedPath, onToggle, onSelect, onChooseProject, onCreateProject, onWorkWithoutProject }) => (
  <div className="project-picker">
    <button className="project-trigger" onMouseDown={(event) => { event.preventDefault(); onToggle(); }}>
      <FolderClosed size={15} />
      <span>{selectedPath ? folderName(selectedPath) : t("project.choose")}</span>
      <ChevronDown size={13} />
    </button>
      <div className={open ? "project-menu is-open" : "project-menu"}>
        <div className="project-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("project.search")} />
        </div>
        <div className="project-menu-list">
          {projects.map((item) => (
            <button key={item} className={item === selectedPath ? "project-menu-row active" : "project-menu-row"} onClick={() => onSelect(item)}>
              <FolderClosed size={15} />
              <span>{folderName(item)}</span>
              {item === selectedPath && <Check size={14} />}
            </button>
          ))}
          {!projects.length && <div className="project-menu-empty">{t("project.none")}</div>}
        </div>
        <div className="project-menu-divider" />
        <div className="project-add-row">
          <button className="project-menu-row">
            <FolderPlus size={15} />
            <span>{t("project.add")}</span>
            <ChevronRight size={14} />
          </button>
          <div className="project-add-submenu">
            <button className="project-menu-row" onClick={onCreateProject}>
              <Plus size={15} />
              <span>{t("project.create")}</span>
            </button>
            <button className="project-menu-row" onClick={onChooseProject}>
              <FolderClosed size={15} />
              <span>{t("project.addExisting")}</span>
            </button>
          </div>
        </div>
        <button className="project-menu-row" onClick={onWorkWithoutProject}>
          <FolderX size={15} />
          <span>{t("project.without")}</span>
        </button>
      </div>
  </div>
);

const PlusMenu = ({ open, onToggle, onPickFile, planMode, goalMode, onTogglePlan, onToggleGoal }) => (
  <div className="plus-picker">
    <button className="tool-button" onClick={onToggle} title={t("plus.add")}><Plus size={17} /></button>
    {open && (
      <div className="plus-menu">
        <button className="plus-menu-row" onClick={onPickFile}>
          <Paperclip size={16} />
          <span>{t("plus.attach")}</span>
        </button>
        <div className="plus-menu-divider" />
        <button className="plus-menu-row toggle-row" onClick={onTogglePlan}>
          <ListChecks size={16} />
          <span>{t("plus.planMode")}</span>
          <span className={planMode ? "toggle is-on" : "toggle"} />
        </button>
        <button className="plus-menu-row toggle-row" onClick={onToggleGoal}>
          <Target size={16} />
          <span>{t("plus.goalMode")}</span>
          <span className={goalMode ? "toggle is-on" : "toggle"} />
        </button>
      </div>
    )}
  </div>
);

const ShieldAlertIcon = ({ size = 24, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const PencilSparklesIcon = ({ size = 24, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M10 3H8" />
    <path d="m15.007 5.008 3.987 3.986" />
    <path d="M20 15v4" />
    <path d="M21.174 6.813a2.82 2.82 0 0 0-3.986-3.987L3.842 16.175a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="M22 17h-4" />
    <path d="M4 5v4" />
    <path d="M6 7H2" />
    <path d="M9 2v2" />
  </svg>
);

const SquareTerminalIcon = ({ size = 24, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="m7 11 2-2-2-2" />
    <path d="M11 13h4" />
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
  </svg>
);

const FolderSearchIcon = ({ size = 24, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <circle cx="11.5" cy="12.5" r="2.5" />
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    <path d="M13.3 14.3 15 16" />
  </svg>
);

const ListIcon = ({ size = 24, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" />
    <path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />
  </svg>
);

const TaskCircleIcon = ({ size = 24, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const TaskCheckIcon = ({ size = 24, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const TodoPanel = ({ todos, goalMode, goal, goalDone, open }) => (
  <div className={open ? "todo-panel open" : "todo-panel"}>
    <div className="todo-section-title">{t("todo.tasks")}</div>
    {todos.length
      ? <ul className="todo-list">{todos.map((item, idx) => (
          <li className={item.done ? "todo-item done" : "todo-item"} key={idx}>
            <span className="todo-mark">{item.done ? <TaskCheckIcon size={15} /> : <TaskCircleIcon size={15} />}</span>
            <span className="todo-text">{item.text}</span>
          </li>
        ))}</ul>
      : <div className="todo-empty">{t("todo.none")}</div>}
    {goalMode && (
      <>
        <div className="todo-divider" />
        <div className="todo-section-title">{t("todo.goal")}</div>
        {goal && goal.trim()
          ? <div className="todo-item goal">
              <span className="todo-mark">{goalDone ? <TaskCheckIcon size={15} /> : <TaskCircleIcon size={15} />}</span>
              <span className="todo-text">{goal}</span>
            </div>
          : <div className="todo-empty">{t("todo.noGoal")}</div>}
      </>
    )}
  </div>
);

const PERMISSION_MODES = [
  { id: "ask", Icon: Hand },
  { id: "auto", Icon: ShieldCheck },
  { id: "full", Icon: ShieldAlertIcon },
];

const PermissionPicker = ({ value, open, onToggle, onChange }) => {
  const active = PERMISSION_MODES.find((mode) => mode.id === value) || PERMISSION_MODES[0];
  const ActiveIcon = active.Icon;
  return (
    <div className="permission-picker">
      <button className="permission-pill" onClick={onToggle}>
        <ActiveIcon size={14} />
        <span>{t(`perm.${active.id}`)}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="permission-menu">
          <div className="permission-menu-title">{t("perm.title")}</div>
          {PERMISSION_MODES.map((mode) => {
            const Icon = mode.Icon;
            const className = ["permission-option"];
            if (mode.id === value) {
              className.push("is-active");
            }
            return (
              <button key={mode.id} className={className.join(" ")} onClick={() => onChange(mode.id)}>
                <Icon size={17} className="permission-option-icon" />
                <span className="permission-option-text">
                  <span className="permission-option-label">{t(`perm.${mode.id}`)}</span>
                  <span className="permission-option-desc">{t(`perm.${mode.id}Desc`)}</span>
                </span>
                {mode.id === value && <Check size={15} className="permission-option-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PlanCard = ({ plan, onAccept }) => {
  const [decided, setDecided] = useState(null);
  return (
    <div className="plan-card">
      <div className="plan-card-head">
        <ListChecks size={15} />
        <span>{t("plan.title")}</span>
        {plan.riskLevel && <span className={`plan-risk risk-${String(plan.riskLevel).toLowerCase()}`} title={t("plan.riskTitle")}>{t("plan.risk", { level: plan.riskLevel })}</span>}
      </div>
      {plan.summary && <p className="plan-summary">{plan.summary}</p>}
      {Boolean(plan.keyChanges?.length) && (
        <div className="plan-section">
          <h4>{t("plan.keyChanges")}</h4>
          <ul>{plan.keyChanges.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      )}
      {Boolean(plan.filesToChange?.length) && (
        <div className="plan-section">
          <h4>{t("plan.files")}</h4>
          <ul>{plan.filesToChange.map((item, index) => <li key={index}><code>{item}</code></li>)}</ul>
        </div>
      )}
      {Boolean(plan.testPlan?.length) && (
        <div className="plan-section">
          <h4>{t("plan.testPlan")}</h4>
          <ul>{plan.testPlan.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      )}
      {Boolean(plan.assumptions?.length) && (
        <div className="plan-section">
          <h4>{t("plan.assumptions")}</h4>
          <ul>{plan.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      )}
      <div className="plan-card-foot">
        {decided === "yes" && <span className="plan-status"><Check size={13} />{t("plan.accepted")}</span>}
        {decided === "no" && <span className="plan-status">{t("plan.rejected")}</span>}
        {!decided && (
          <>
            <span>{t("plan.question")}</span>
            <button type="button" className="plan-reject" onClick={() => setDecided("no")}>{t("plan.no")}</button>
            <button type="button" className="plan-accept" onClick={() => { setDecided("yes"); onAccept(); }}><Check size={14} />{t("plan.yes")}</button>
          </>
        )}
      </div>
    </div>
  );
};

const formatWorkTime = (ms) => {
  const s = Math.max(1, Math.round((ms || 0) / 1000));
  if (s < 60) {
    return `${s}s`;
  }
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const useElapsedSeconds = (startedAt, active) => {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => force((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return Math.max(1, Math.round((Date.now() - (startedAt || Date.now())) / 1000));
};

const Thinking = () => (
  <div className="thinking">
    <span className="live-label" data-shimmer-label={t("work.thinking")}>{t("work.thinking")}</span>
  </div>
);

const Typewriter = ({ text, animate }) => {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const shownRef = useRef(animate ? 0 : text.length);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  useEffect(() => {
    if (!animate) {
      return;
    }
    const total = text.length;
    const cps = Math.max(55, total / 6);
    shownRef.current = 0;
    lastRef.current = 0;
    setShown(0);
    const step = (now) => {
      if (lastRef.current === 0) {
        lastRef.current = now;
      }
      const dt = now - lastRef.current;
      lastRef.current = now;
      shownRef.current = Math.min(total, shownRef.current + (cps * dt) / 1000);
      setShown(Math.floor(shownRef.current));
      if (shownRef.current < total) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = 0;
      }
    };
    if (total > 0) {
      rafRef.current = requestAnimationFrame(step);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [text, animate]);
  useEffect(() => {
    if (!animate) {
      return;
    }
    const scroller = document.querySelector(".messages");
    if (scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < BOTTOM_STICK_PX) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [shown, animate]);
  return <MarkdownMessage content={text.slice(0, shown)} />;
};

const isEditTool = (tool) => (tool?.name === "write_file" || tool?.name === "replace_in_file") && Boolean(tool?.result?.written);

const clusterKind = (tool) => {
  if (!tool) {
    return null;
  }
  if (isEditTool(tool)) {
    return "edits";
  }
  const result = tool.result || {};
  if (result.permissionRequired || result.error || result.denied) {
    return null;
  }
  if (tool.name === "run_command" && result.exitCode !== undefined) {
    return "commands";
  }
  if (tool.name === "read_file" && result.path) {
    return "reads";
  }
  return null;
};

const groupWorkSegments = (segments) => {
  const blocks = [];
  for (const seg of segments) {
    if (seg.type === "text") {
      if ((seg.content || "").trim()) {
        blocks.push({ kind: "text", content: seg.content });
      }
      continue;
    }
    const tool = seg.tool;
    if (tool?.result?.plan || tool?.result?.todos) {
      continue;
    }
    const kind = clusterKind(tool);
    if (kind) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) {
        last.tools.push(tool);
      } else {
        blocks.push({ kind, tools: [tool] });
      }
    } else {
      blocks.push({ kind: "tool", tool });
    }
  }
  return blocks;
};

const DiffView = ({ diff }) => {
  if (!diff || diff.tooLarge || !diff.hunks?.length) {
    return <div className="diff-empty">+{diff?.added || 0} −{diff?.removed || 0}{diff?.tooLarge ? t("diff.tooLarge") : ""}</div>;
  }
  return (
    <div className="diff-view">
      {diff.hunks.map((hunk, hi) => (
        <div className="diff-hunk" key={hi}>
          {hunk.map((row, ri) => (
            <div className={`diff-row ${row.t}`} key={ri}>
              <span className="diff-gutter">{row.t === "add" ? "" : row.a}</span>
              <span className="diff-gutter">{row.t === "del" ? "" : row.b}</span>
              <span className="diff-sign">{row.t === "add" ? "+" : row.t === "del" ? "−" : ""}</span>
              <span className="diff-code">{row.text || " "}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const EditGroup = ({ tools }) => (
  <details className="edit-group">
    <summary>
      <PencilSparklesIcon size={14} />
      <span>{tools.length === 1 ? t("edit.oneFile") : t("edit.nFiles", { n: tools.length })}</span>
      <ChevronRight size={13} className="edit-chevron" />
    </summary>
    <div className="edit-group-body">
      {tools.map((tool, idx) => (
        <details className="edit-file" key={tool.id || idx}>
          <summary>
            <span className="edit-path">{tool.result?.path || tool.args?.path}</span>
            <span className="edit-stat add">+{tool.result?.diff?.added ?? 0}</span>
            <span className="edit-stat del">−{tool.result?.diff?.removed ?? 0}</span>
            <ChevronRight size={13} className="edit-chevron" />
          </summary>
          <DiffView diff={tool.result?.diff} />
        </details>
      ))}
    </div>
  </details>
);

const ClusterRow = ({ tool }) => {
  const result = tool.result || {};
  const command = result.command || tool.args?.command;
  const label = command || tool.result?.path || tool.args?.path || getToolLabel(tool);
  return (
    <details className="cluster-row">
      <summary>
        <span className="cluster-row-label">{label}</span>
        <ChevronRight size={12} className="edit-chevron" />
      </summary>
      <div className="cluster-row-body">
        {result.content && <pre>{result.content}</pre>}
        {result.stdout && <pre>{result.stdout}</pre>}
        {result.stderr && <pre className="stderr">{result.stderr}</pre>}
        {!result.content && !result.stdout && !result.stderr && <div className="tool-meta">{getToolLabel(tool)}</div>}
      </div>
    </details>
  );
};

const CommandGroup = ({ tools, kind }) => {
  const Icon = kind === "commands" ? SquareTerminalIcon : FolderSearchIcon;
  const label = kind === "commands" ? t("cluster.commands", { n: tools.length }) : t("cluster.reads", { n: tools.length });
  return (
    <details className="cmd-group">
      <summary>
        <Icon size={14} />
        <span>{label}</span>
        <ChevronRight size={13} className="edit-chevron" />
      </summary>
      <div className="cmd-group-body">
        {tools.map((tool, idx) => <ClusterRow tool={tool} key={tool.id || idx} />)}
      </div>
    </details>
  );
};

const ApprovalForm = ({ tool, onResolve }) => {
  const result = tool.result || {};
  const isMcp = Boolean(result.mcp);
  const isWrite = Boolean(result.write);
  const isAddMcp = Boolean(result.addMcp);
  const command = result.command || tool.args?.command || "";
  const tier = result.mcpTier || result.tier || "";
  const addLine = isAddMcp ? `${result.mcpAddName}  →  ${result.mcpAddConfig?.command || ""} ${(result.mcpAddConfig?.args || []).join(" ")}`.trim() : "";
  const target = isAddMcp
    ? result.mcpAddName
    : isMcp
      ? `${result.mcpServer} · ${result.mcpTool}`
      : isWrite
        ? (tool.args?.path || result.path || "file")
        : (command || tool.name);
  const stickyOptions = Array.isArray(result.stickyOptions) ? result.stickyOptions : [];
  const optionKey = (opt) => (typeof opt === "object" ? opt.type : opt);
  const extras = stickyOptions.filter((opt) => optionKey(opt) !== "once");
  const [choice, setChoice] = useState("once");
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const optionLabel = (opt) => {
    if (typeof opt === "object" && opt.type === "prefix") {
      return t("approval.prefix", { x: opt.value || command.slice(0, 40) });
    }
    if (opt === "server-readonly") {
      return t("approval.allowReadonly", { x: result.mcpServer });
    }
    if (opt === "chat") {
      return t("approval.allowChat");
    }
    if (opt === "dangerous-scope") {
      return t("approval.allowScope");
    }
    if (opt === "session-dangerous") {
      return t("approval.trustSession", { x: result.mcpServer });
    }
    return t("approval.yes");
  };
  const submit = () => {
    if (sent) {
      return;
    }
    setSent(true);
    if (choice === "deny") {
      onResolve({ approved: false, denyFeedback: feedback.trim() });
      return;
    }
    if (choice === "once") {
      onResolve({ approved: true });
      return;
    }
    const opt = extras.find((entry) => optionKey(entry) === choice);
    onResolve({ approved: true, stickyGrant: opt && typeof opt === "object" ? { type: opt.type } : { type: choice } });
  };
  const question = isAddMcp ? t("approval.questionAddMcp", { x: target }) : (isMcp ? t("approval.questionMcp", { x: target }) : (isWrite ? t("approval.questionWrite", { x: target }) : t("approval.questionCommand")));
  return (
    <div className="approval-form">
      <div className="approval-question">
        {isAddMcp ? <Plug size={15} /> : <ShieldCheck size={15} />}
        <span>{question}</span>
        {tier && <span className={`risk-badge risk-${tier}`}>{t(`risk.${tier}`)}</span>}
      </div>
      <pre className="approval-command">{isAddMcp ? addLine : (command || target)}</pre>
      {result.reason && <div className="approval-reason">{result.reason}</div>}
      <div className="approval-options">
        <label className={choice === "once" ? "approval-option is-active" : "approval-option"}>
          <input type="radio" name="approval" checked={choice === "once"} onChange={() => setChoice("once")} />
          <span>{t("approval.yes")}</span>
        </label>
        {extras.map((opt) => {
          const key = optionKey(opt);
          return (
            <label key={key} className={choice === key ? "approval-option is-active" : "approval-option"}>
              <input type="radio" name="approval" checked={choice === key} onChange={() => setChoice(key)} />
              <span>{optionLabel(opt)}</span>
            </label>
          );
        })}
        <label className={choice === "deny" ? "approval-option is-active" : "approval-option"}>
          <input type="radio" name="approval" checked={choice === "deny"} onChange={() => setChoice("deny")} />
          <span>{t("approval.no")}</span>
        </label>
        {choice === "deny" && (
          <textarea className="approval-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder={t("approval.feedbackPlaceholder")} autoFocus />
        )}
      </div>
      <div className="approval-actions">
        <button type="button" className="approval-skip" onClick={() => { if (!sent) { setSent(true); onResolve({ approved: false }); } }}>{t("approval.skip")}</button>
        <button type="button" className="approval-submit" onClick={submit} disabled={sent}>{t("approval.submit")}</button>
      </div>
    </div>
  );
};

const ToolStep = ({ tool }) => {
  const result = tool.result || {};
  const needsPermission = result.permissionRequired;
  const Icon = getToolIcon(tool.name);
  const label = getToolLabel(tool);
  const hasListing = Array.isArray(result.files) || Array.isArray(result.directories);
  const hasBody = Boolean(needsPermission || tool.args?.command || result.error || result.reason || result.denied || Array.isArray(result.matches) || result.stdout || result.stderr || result.content || hasListing || result.verifier);
  return (
    <details className={needsPermission ? "tool-step permission" : (result.error ? "tool-step failed" : "tool-step")}>
      <summary>
        <span className="step-marker"><Icon size={14} /></span>
        <span className="step-label">{label}</span>
        {(result.mcpTier || result.tier) && <span className={`risk-badge risk-${result.mcpTier || result.tier}`}>{t(`risk.${result.mcpTier || result.tier}`)}</span>}
        {needsPermission && <span className="permission-actions"><span className="awaiting-approval">{t("tool.awaiting")}</span></span>}
      </summary>
      <div className="step-body">
        {tool.args?.command && <div className="tool-command">{tool.args.command}</div>}
        {result.error && <div className="tool-warning">{result.error}</div>}
        {result.reason && <div className="tool-warning">{result.reason}</div>}
        {result.denied && <div className="tool-warning">{result.note || t("tool.denied")}</div>}
        {Array.isArray(result.matches) && (result.matches.length
          ? <pre>{result.matches.slice(0, 100).map((m) => `${m.path}:${m.line}: ${m.text}`).join("\n")}</pre>
          : <div className="tool-meta">{t("grep.noMatches")}</div>)}
        {result.stdout && <pre>{result.stdout}</pre>}
        {result.stderr && <pre className="stderr">{result.stderr}</pre>}
        {result.content && <pre>{result.content}</pre>}
        {hasListing && ((result.directories?.length || result.files?.length)
          ? <pre>{[...(result.directories || []).map((e) => `${e.path || e}/`), ...(result.files || []).map((e) => e.path || e)].slice(0, 300).join("\n")}</pre>
          : <div className="tool-meta">{result.summary || "—"}</div>)}
        {result.verifier && <div className="tool-meta">{result.verifier.done ? t("tool.verifiedDone") : t("tool.notDone")} — {result.verifier.feedback}</div>}
        {!hasBody && <pre>{JSON.stringify(result, null, 2)}</pre>}
      </div>
    </details>
  );
};

const LiveToolStep = ({ tool }) => {
  const label = tool.path
    ? t(tool.name === "replace_in_file" ? "live.editing" : "live.creating", { x: tool.path })
    : t(tool.name === "replace_in_file" ? "live.editingGeneric" : "live.creatingGeneric");
  const lines = t("live.lines", { n: tool.lines });
  return (
    <div className="tool-step live">
      <span className="step-marker"><PencilSparklesIcon size={14} /></span>
      <span className="step-label live-label" data-shimmer-label={label}>{label}</span>
      {tool.lines > 0 && <span className="live-lines live-label" data-shimmer-label={lines}>{lines}</span>}
    </div>
  );
};

const WorkLog = ({ segments, startedAt, workMs, working, liveTool }) => {
  const [open, setOpen] = useState(working);
  const touchedRef = useRef(false);
  useEffect(() => {
    if (!working && !touchedRef.current) {
      setOpen(false);
    }
  }, [working]);
  const elapsed = useElapsedSeconds(startedAt, working);
  const blocks = groupWorkSegments(segments);
  return (
    <details className="worklog" open={open}>
      <summary className="worklog-head" onClick={(event) => { event.preventDefault(); touchedRef.current = true; setOpen(!open); }}>
        {working
          ? <span className="live-label" data-shimmer-label={t("work.workingSince", { s: elapsed })}>{t("work.workingSince", { s: elapsed })}</span>
          : <span>{t("work.worked", { time: formatWorkTime(workMs) })}</span>}
        <ChevronRight size={14} className={`worklog-chevron ${open ? "open" : ""}`} />
      </summary>
      <div className="worklog-body">
        {blocks.map((block, idx) => {
          if (block.kind === "text") {
            return <div className="narration markdown" key={idx}><MarkdownMessage content={block.content} /></div>;
          }
          if (block.kind === "edits") {
            return <EditGroup tools={block.tools} key={idx} />;
          }
          if (block.kind === "commands" || block.kind === "reads") {
            return block.tools.length === 1
              ? <ToolStep tool={block.tools[0]} key={idx} />
              : <CommandGroup tools={block.tools} kind={block.kind} key={idx} />;
          }
          return <ToolStep tool={block.tool} key={idx} />;
        })}
        {liveTool && <LiveToolStep tool={liveTool} />}
      </div>
    </details>
  );
};

const Message = ({ message, onAcceptPlan }) => {
  const sawWorkingRef = useRef(false);
  useEffect(() => {
    if (!message.done) {
      sawWorkingRef.current = true;
    }
  }, [message.done]);
  if (message.role === "user") {
    return (
      <div className="message user">
        <div className="message-surface user-surface">
          {message.attachment && (
            <div className="message-image">
              <img src={message.attachment.dataUrl} alt="" />
              <span>{message.attachment.name}</span>
            </div>
          )}
          <div className="message-text plain">{message.content}</div>
        </div>
      </div>
    );
  }
  if (message.error) {
    return (
      <div className="message assistant">
        <div className="message-surface assistant-surface error">
          <div className="message-text plain">{message.content}</div>
        </div>
      </div>
    );
  }
  if (message.segments) {
    const segs = message.segments;
    const planSeg = segs.find((seg) => seg.type === "tool" && seg.tool.result?.plan);
    const working = !message.done;
    const hasWork = segs.some((seg) => seg.type === "tool" && !seg.tool.result?.plan) || Boolean(message.liveTool);
    let workSegs = segs;
    let finalText = "";
    if (hasWork && !message.liveTool) {
      let cut = segs.length;
      while (cut > 0 && segs[cut - 1].type === "text") {
        cut -= 1;
      }
      const trailing = segs.slice(cut).filter((seg) => seg.type === "text" && (seg.content || "").trim());
      if (trailing.length) {
        workSegs = segs.slice(0, cut);
        finalText = trailing.map((seg) => seg.content).join("");
      }
    }
    return (
      <div className="message assistant">
        <div className="message-surface assistant-surface">
          {hasWork && <WorkLog segments={workSegs} startedAt={message.startedAt} workMs={message.workMs} working={working} liveTool={working ? message.liveTool : null} />}
          {planSeg && <PlanCard plan={planSeg.tool.result.plan} onAccept={onAcceptPlan} />}
          {hasWork
            ? (Boolean(finalText) && <div className="message-text markdown"><MarkdownMessage content={finalText} /></div>)
            : (working
                ? (!planSeg && <Thinking />)
                : (Boolean((message.content || "").trim()) && <div className="message-text markdown"><Typewriter key={message.id} text={message.content} animate={sawWorkingRef.current} /></div>))}
        </div>
      </div>
    );
  }
  const planTool = message.tools?.find((tool) => tool.result?.plan);
  return (
    <div className="message assistant">
      <div className="message-surface assistant-surface">
        {Boolean((message.content || "").trim()) && <div className="message-text markdown"><MarkdownMessage content={message.content} /></div>}
        {planTool && <PlanCard plan={planTool.result.plan} onAccept={onAcceptPlan} />}
        {Boolean(message.tools?.length) && <ToolTimeline tools={message.tools} />}
      </div>
    </div>
  );
};

const getToolIcon = (name = "") => {
  const lower = name.toLowerCase();
  if (lower.startsWith("mcp__") || lower === "add_mcp_server") {
    return Plug;
  }
  if (lower.includes("search") || lower.includes("grep")) {
    return Search;
  }
  if (lower.includes("write") || lower.includes("patch") || lower.includes("edit") || lower.includes("replace")) {
    return PencilSparklesIcon;
  }
  if (lower.includes("read") || lower.includes("file") || lower.includes("outline")) {
    return FileText;
  }
  if (lower.includes("web") || lower.includes("url") || lower.includes("fetch")) {
    return Globe;
  }
  if (lower.includes("command") || lower.includes("shell") || lower.includes("run")) {
    return Terminal;
  }
  return Clock;
};

const getToolLabel = (tool) => {
  const result = tool.result || {};
  const command = result.command || tool.args?.command;
  const path = tool.args?.path || tool.args?.file || result.path;
  const name = (tool.name || "").toLowerCase();
  if (name === "add_mcp_server" || result.addMcp) {
    return t("toollabel.addMcp", { x: result.mcpAddName || tool.args?.name || tool.args?.folder || "" });
  }
  if (name.startsWith("mcp__") || result.mcp) {
    const server = result.mcpServer || name.slice(5).split("__")[0];
    const mcpTool = result.mcpTool || name.slice(5).split("__").slice(1).join("__");
    return t("toollabel.mcp", { server, tool: mcpTool });
  }
  if (result.denied) {
    return t("toollabel.denied", { x: command || path || tool.name || "" });
  }
  if (command) {
    if (result.permissionRequired) {
      return t("toollabel.runCmd", { x: command });
    }
    return t("toollabel.running", { x: command });
  }
  if (name.includes("grep") || name.includes("search")) {
    return t("toollabel.grepping", { x: tool.args?.query || result.query || "" });
  }
  if (name.includes("write") && path) {
    return t("toollabel.writing", { x: path });
  }
  if ((name.includes("replace") || name.includes("edit")) && path) {
    return t("toollabel.editing", { x: path });
  }
  if (path) {
    return t("toollabel.reading", { x: path });
  }
  if (name.includes("list")) {
    return t("toollabel.listing");
  }
  return tool.name || t("toollabel.working");
};

const ToolTimeline = ({ tools }) => (
  <div className="tool-timeline">
    <div className="timeline-header">
      <ChevronDown size={14} />
      <span className="live-label" data-shimmer-label={t("timeline.activity")}>{t("timeline.activity")}</span>
    </div>
    <div className="timeline-steps">
      {tools.map((tool, index) => {
        const needsPermission = tool.result?.permissionRequired;
        const result = tool.result || {};
        const Icon = getToolIcon(tool.name);
        const label = getToolLabel(tool);
        return (
          <details key={tool.id || index} className={needsPermission ? "tool-card permission" : "tool-card"}>
            <summary>
              <span className="timeline-marker"><Icon size={14} /></span>
              <span className="tool-summary-main">
                <span className="tool-title">{label}</span>
                <span className="tool-facts">
                  {result.exitCode !== undefined && <small>exit {String(result.exitCode)}</small>}
                  {result.durationMs && <small>{result.durationMs}ms</small>}
                </span>
              </span>
              {needsPermission && (
                <span className="permission-actions">
                  <span className="awaiting-approval">{t("tool.awaiting")}</span>
                </span>
              )}
            </summary>
            <div className="tool-body">
              {tool.args?.command && <div className="tool-command">{tool.args.command}</div>}
              {result.error && <div className="tool-warning">{result.error}</div>}
              {result.reason && <div className="tool-warning">{result.reason}</div>}
              {result.cwd && <div className="tool-meta">cwd: {result.cwd}</div>}
              {Array.isArray(result.matches) && (result.matches.length
                ? <pre>{result.matches.slice(0, 100).map((m) => `${m.path}:${m.line}: ${m.text}`).join("\n")}</pre>
                : <div className="tool-meta">{t("grep.noMatches")}</div>)}
              {result.stdout && <pre>{result.stdout}</pre>}
              {result.stderr && <pre className="stderr">{result.stderr}</pre>}
              {!result.stdout && !result.stderr && !result.error && !result.matches && <pre>{JSON.stringify({ args: tool.args, result: tool.result }, null, 2)}</pre>}
            </div>
          </details>
        );
      })}
      <div className="timeline-done">
        <span className="timeline-marker done"><CircleCheck size={14} /></span>
        <span>{t("timeline.done")}</span>
      </div>
    </div>
  </div>
);

const SearchOverlay = ({ chats, query, setQuery, onClose, onOpen }) => (
  <div className="modal-backdrop command-backdrop" onMouseDown={onClose}>
    <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
      <div className="command-search">
        <Search size={18} />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} />
        <button onClick={onClose}><X size={16} /></button>
      </div>
      <div className="command-results">
        {chats.map((chat) => (
          <button key={chat.id} className="command-row" onClick={() => onOpen(chat)}>
            <MessageSquare size={16} />
            <div>
              <span>{chat.title}</span>
              <small>{chat.projectPath || t("search.noProject")} - {(chat.messages || []).map((message) => message.content).join(" ").slice(0, 120)}</small>
            </div>
          </button>
        ))}
        {!chats.length && <div className="no-results">{t("search.noResults")}</div>}
      </div>
    </div>
  </div>
);

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
];

const formatUsd = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const BalanceLine = ({ hasKey }) => {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    if (!hasKey) {
      setState({ loading: false, noKey: true });
      return () => { alive = false; };
    }
    setState({ loading: true });
    api.getBalance()
      .then((data) => { if (alive) { setState({ loading: false, data }); } })
      .catch(() => { if (alive) { setState({ loading: false, data: { error: "unavailable" } }); } });
    return () => { alive = false; };
  }, [hasKey]);
  if (state.loading) {
    return <div className="balance-line muted">…</div>;
  }
  const data = state.data || {};
  if (state.noKey || data.hasKey === false) {
    return <div className="balance-line muted">{t("settings.balanceNoKey")}</div>;
  }
  if (data.error) {
    return <div className="balance-line muted">{t("settings.balanceUnavailable")}</div>;
  }
  if (data.limit === null || data.limit === undefined) {
    return <div className="balance-line">{t("settings.balanceNoLimit")}{data.usage != null ? ` · ${t("settings.balanceSpent", { usage: formatUsd(data.usage) })}` : ""}</div>;
  }
  const remaining = data.limitRemaining != null ? data.limitRemaining : (data.limit - (data.usage || 0));
  const pct = data.limit > 0 ? Math.max(0, Math.min(100, (remaining / data.limit) * 100)) : 0;
  return (
    <div className="balance-block">
      <div className="balance-line">{t("settings.balanceLeft", { remaining: formatUsd(remaining), limit: formatUsd(data.limit) })}</div>
      <div className="balance-bar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

const RISK_OPTIONS = ["readonly", "state_change", "dangerous", "shell_system"];
const allowedRisk = (heuristic) => {
  if (heuristic === "shell_system") {
    return ["dangerous", "shell_system"];
  }
  if (heuristic === "dangerous") {
    return ["state_change", "dangerous", "shell_system"];
  }
  return RISK_OPTIONS;
};

const McpSettings = () => {
  const [servers, setServers] = useState({});
  const [status, setStatus] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", command: "", args: "", env: "" });
  const [paste, setPaste] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [trusted, setTrusted] = useState({});
  const [detectNote, setDetectNote] = useState("");
  const refresh = async () => {
    try {
      const s = await api.getSettings();
      setServers(s.mcpServers || {});
    } catch {}
    try {
      const st = await api.getMcpStatus();
      setStatus(Array.isArray(st) ? st : []);
    } catch {}
  };
  useEffect(() => {
    refresh();
    const timer = setInterval(async () => {
      try {
        const st = await api.getMcpStatus();
        setStatus(Array.isArray(st) ? st : []);
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  const persist = async (next) => {
    setServers(next);
    try {
      await api.saveSettings({ mcpServers: next });
    } catch {}
    setTimeout(refresh, 700);
  };
  const addServer = async () => {
    const name = form.name.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(name) || !form.command.trim()) {
      return;
    }
    const args = form.args.split("\n").map((x) => x.trim()).filter(Boolean);
    const env = {};
    form.env.split("\n").map((x) => x.trim()).filter(Boolean).forEach((line) => {
      const idx = line.indexOf("=");
      if (idx > 0) {
        env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    });
    const next = { ...servers, [name]: { type: "stdio", command: form.command.trim(), args, env, enabled: true } };
    setForm({ name: "", command: "", args: "", env: "" });
    setPaste("");
    setDetectNote("");
    setAdding(false);
    await persist(next);
  };
  const applyPaste = (text) => {
    setPaste(text);
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      return;
    }
    let name = form.name;
    let entry = null;
    if (obj && obj.mcpServers && typeof obj.mcpServers === "object") {
      const keys = Object.keys(obj.mcpServers);
      if (keys.length) {
        name = keys[0];
        entry = obj.mcpServers[keys[0]];
      }
    } else if (obj && (obj.command || Array.isArray(obj.args))) {
      entry = obj;
    } else if (obj && typeof obj === "object") {
      const keys = Object.keys(obj);
      if (keys.length === 1 && obj[keys[0]] && obj[keys[0]].command) {
        name = keys[0];
        entry = obj[keys[0]];
      }
    }
    if (!entry) {
      return;
    }
    const args = Array.isArray(entry.args) ? entry.args.join("\n") : "";
    const env = entry.env && typeof entry.env === "object" ? Object.entries(entry.env).map(([k, v]) => `${k}=${v}`).join("\n") : "";
    setForm({ name: String(name || "").replace(/[^a-zA-Z0-9_-]/g, "-"), command: entry.command || "", args, env });
  };
  const pickFolder = async () => {
    try {
      const d = await api.detectMcpServer();
      if (!d) {
        return;
      }
      const args = Array.isArray(d.args) ? d.args.join("\n") : "";
      const env = d.env && typeof d.env === "object" ? Object.entries(d.env).map(([k, v]) => `${k}=${v}`).join("\n") : "";
      if (d.command || d.name) {
        setForm({ name: d.name || form.name, command: d.command || "", args, env });
        setPaste("");
      }
      setDetectNote(d.note || (d.ok ? "" : t("mcp.detectFail")));
    } catch {}
  };
  const removeServer = async (name) => {
    const next = { ...servers };
    delete next[name];
    await persist(next);
  };
  const toggleEnabled = async (name) => {
    const next = { ...servers, [name]: { ...servers[name], enabled: servers[name].enabled === false } };
    await persist(next);
  };
  const setRisk = async (server, tool, tier) => {
    try {
      const st = await api.setMcpToolRisk(server, tool, tier);
      if (Array.isArray(st)) {
        setStatus(st);
      }
    } catch {}
  };
  const setToolEnabled = async (server, tool, enabled) => {
    try {
      const st = await api.setMcpToolEnabled(server, tool, enabled);
      if (Array.isArray(st)) {
        setStatus(st);
      }
    } catch {}
  };
  const toggleTrust = async (server) => {
    const value = !trusted[server];
    setTrusted({ ...trusted, [server]: value });
    try {
      await api.setMcpSessionTrust(server, value);
    } catch {}
  };
  const reconnect = async (name) => {
    try {
      const st = await api.reconnectMcp(name);
      if (Array.isArray(st)) {
        setStatus(st);
      }
    } catch {}
  };
  const statusFor = (name) => status.find((s) => s.name === name);
  const names = Object.keys(servers);
  return (
    <div className="mcp-settings">
      {names.length === 0 && !adding && <div className="mcp-empty">{t("mcp.empty")}</div>}
      {names.map((name) => {
        const cfg = servers[name];
        const st = statusFor(name);
        const badge = st?.status || (cfg.enabled === false ? "disabled" : "starting");
        const hasGated = (st?.tools || []).some((tt) => tt.tier === "dangerous" || tt.tier === "shell_system");
        return (
          <div key={name} className="mcp-server">
            <div className="mcp-server-head">
              <span className="mcp-name">{name}</span>
              <span className={`mcp-badge mcp-${badge}`}>{st?.status === "ready" ? t("mcp.status.ready", { n: st.toolCount }) : t(`mcp.status.${badge}`)}</span>
              <div className="mcp-server-actions">
                <button className="mcp-mini" onClick={() => setExpanded(expanded === name ? null : name)} disabled={!st || st.status !== "ready"}>{t("mcp.tools")}</button>
                <button className="mcp-mini" onClick={() => reconnect(name)}>{t("settings.mcpReconnect")}</button>
                <button className="mcp-mini danger" onClick={() => removeServer(name)}>{t("settings.mcpRemove")}</button>
                <span className={cfg.enabled === false ? "toggle" : "toggle is-on"} onClick={() => toggleEnabled(name)} title={cfg.enabled === false ? t("mcp.enable") : t("mcp.disable")} />
              </div>
            </div>
            {st?.error && <div className="mcp-errline">{st.error}</div>}
            {hasGated && (
              <label className="mcp-trust">
                <input type="checkbox" checked={Boolean(trusted[name])} onChange={() => toggleTrust(name)} />
                <span>{t("mcp.trustDangerous")}</span>
              </label>
            )}
            {expanded === name && st?.tools && (
              <div className="mcp-tools">
                {st.tools.map((tt) => (
                  <div key={tt.name} className="mcp-tool">
                    <input type="checkbox" checked={tt.enabled} onChange={(event) => setToolEnabled(name, tt.name, event.target.checked)} />
                    <span className="mcp-tool-name">{tt.name}</span>
                    <span className={`risk-badge risk-${tt.tier}`}>{t(`risk.${tt.tier}`)}</span>
                    <select className="mcp-risk-select" value={tt.tier} onChange={(event) => setRisk(name, tt.name, event.target.value)}>
                      {allowedRisk(tt.heuristic).map((r) => <option key={r} value={r}>{t(`risk.${r}`)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {adding ? (
        <div className="mcp-add">
          <button className="mcp-folder-pick" onClick={pickFolder}><FolderOpen size={16} /><span>{t("mcp.choosePlugin")}</span></button>
          <div className="mcp-add-help">{t("mcp.addHelp")}</div>
          {detectNote && <div className="mcp-detect-note">{detectNote}</div>}
          <div className="mcp-add-sep"><span>{t("mcp.orPaste")}</span></div>
          <textarea className="text-input mcp-area mcp-paste" placeholder={t("mcp.pastePlaceholder")} value={paste} onChange={(event) => applyPaste(event.target.value)} />
          <div className="mcp-add-sep"><span>{t("mcp.orManual")}</span></div>
          <input className="text-input" placeholder={t("settings.mcpName")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input className="text-input" placeholder={t("settings.mcpCommand")} value={form.command} onChange={(event) => setForm({ ...form, command: event.target.value })} />
          <textarea className="text-input mcp-area" placeholder={t("settings.mcpArgs")} value={form.args} onChange={(event) => setForm({ ...form, args: event.target.value })} />
          <textarea className="text-input mcp-area" placeholder={t("settings.mcpEnv")} value={form.env} onChange={(event) => setForm({ ...form, env: event.target.value })} />
          <div className="mcp-add-actions">
            <button className="mcp-mini" onClick={() => { setAdding(false); setPaste(""); setDetectNote(""); }}>{t("approval.skip")}</button>
            <button className="mcp-mini primary" onClick={addServer}>{t("settings.mcpSave")}</button>
          </div>
        </div>
      ) : (
        <button className="primary-command wide" onClick={() => setAdding(true)}><Plus size={16} /><span>{t("settings.mcpAdd")}</span></button>
      )}
    </div>
  );
};

const SettingsModal = ({ hasKey, value, setValue, onSave, onClose, lang, onLang }) => {
  const [tab, setTab] = useState("general");
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="settings-modal tabbed" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-tabs">
          <button className={tab === "general" ? "settings-tab is-active" : "settings-tab"} onClick={() => setTab("general")}><Settings size={15} /><span>{t("settings.tabGeneral")}</span></button>
          <button className={tab === "mcp" ? "settings-tab is-active" : "settings-tab"} onClick={() => setTab("mcp")}><Plug size={15} /><span>{t("settings.tabMcp")}</span></button>
        </div>
        <div className="settings-content">
          {tab === "general" ? (
            <>
              <div className="modal-title"><KeyRound size={19} />{t("settings.title")}</div>
              <label className="field-label">{t("settings.language")}</label>
              <div className="lang-switch">
                {LANGUAGES.map((item) => (
                  <button key={item.id} className={item.id === lang ? "lang-option is-active" : "lang-option"} onClick={() => onLang(item.id)}>{item.label}</button>
                ))}
              </div>
              <label className="field-label">{t("settings.apiKey")}</label>
              <input className="text-input" value={value} onChange={(event) => setValue(event.target.value)} type="password" placeholder={hasKey ? t("settings.stored") : "sk-or-v1-..."} />
              <button className="primary-command wide" onClick={onSave}><Check size={17} /><span>{t("settings.saveKey")}</span></button>
              <label className="field-label balance-label">{t("settings.balance")}</label>
              <BalanceLine hasKey={hasKey} />
            </>
          ) : (
            <>
              <div className="modal-title"><Plug size={19} />{t("settings.tabMcp")}</div>
              <McpSettings />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById("root")).render(<App />);
