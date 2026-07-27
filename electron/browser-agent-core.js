const interactiveRoles = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
]);

const contentRoles = new Set([
  "article",
  "caption",
  "cell",
  "columnheader",
  "definition",
  "dialog",
  "document",
  "heading",
  "img",
  "list",
  "listitem",
  "main",
  "paragraph",
  "region",
  "row",
  "rowheader",
  "statictext",
  "table",
  "term",
]);

export const browserToolNames = new Set([
  "browser_tabs",
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_key",
  "browser_scroll",
  "browser_wait",
  "browser_visual_analyze",
  "browser_visual_click",
]);

export const browserReadTools = new Set([
  "browser_snapshot",
  "browser_visual_analyze",
]);

export const allowedBrowserKeys = new Set([
  "Enter",
  "Escape",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Backspace",
  "Delete",
]);

export const allowedBrowserModifiers = new Set(["Control", "Alt", "Shift", "Meta"]);

export const normalizeBrowserTarget = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  if (raw === "about:blank") {
    return raw;
  }
  const loopback = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#].*)?$/i;
  const hostWithPort = /^(?:\[[0-9A-Fa-f:]+\]|[^/\s:]+):\d+(?:[/?#].*)?$/;
  if (loopback.test(raw)) {
    return `http://${raw}`;
  }
  if (hostWithPort.test(raw)) {
    return `https://${raw}`;
  }
  if (/\s/.test(raw) && !/^https?:\/\//i.test(raw)) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`;
  }
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = /^(localhost|\[::1\]|127(?:\.\d{1,3}){3})(:\d+)?(?:\/|$)/i.test(candidate)
      ? `http://${candidate}`
      : `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

export const normalizeBrowserRef = (value) => {
  const raw = String(value || "").trim();
  const bracketed = raw.match(/^\[([^\]]+)\]$/);
  const candidate = bracketed ? bracketed[1] : raw;
  const match = candidate.match(/^b(\d+)$/i) || candidate.match(/^ref[_-]?(\d+)$/i);
  if (!match) {
    return candidate;
  }
  const index = Number(match[1]);
  return Number.isSafeInteger(index) && index > 0 ? `b${index}` : candidate;
};

const axValue = (value) => {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return value;
};

const axState = (value) => {
  if (value === "mixed") {
    return value;
  }
  return value === true || value === "true" || value === 1;
};

export const axPropertyMap = (node) => {
  const values = new Map();
  for (const entry of Array.isArray(node?.properties) ? node.properties : []) {
    values.set(String(entry?.name || ""), axValue(entry?.value));
  }
  return values;
};

export const readAxNode = (node) => {
  const role = String(axValue(node?.role) || "").toLowerCase();
  const name = String(axValue(node?.name) || "").replace(/\s+/g, " ").trim();
  const description = String(axValue(node?.description) || "").replace(/\s+/g, " ").trim();
  const value = String(axValue(node?.value) || "").replace(/\s+/g, " ").trim();
  const properties = axPropertyMap(node);
  const protectedField = Boolean(properties.get("protected"))
    || properties.get("autocomplete") === "current-password"
    || properties.get("autocomplete") === "new-password";
  return {
    axNodeId: String(node?.nodeId || ""),
    backendDOMNodeId: Number(node?.backendDOMNodeId) || 0,
    frameId: String(node?.frameId || ""),
    ignored: Boolean(node?.ignored),
    role,
    name,
    description,
    value: protectedField ? "" : value,
    protected: protectedField,
    disabled: Boolean(properties.get("disabled")),
    checked: properties.has("checked") ? axState(properties.get("checked")) : undefined,
    selected: properties.has("selected") ? axState(properties.get("selected")) : undefined,
    expanded: properties.has("expanded") ? axState(properties.get("expanded")) : undefined,
    focused: Boolean(properties.get("focused")),
    level: Number(properties.get("level")) || 0,
  };
};

export const shouldIncludeAxNode = (entry, interactiveOnly = false) => {
  if (!entry || entry.ignored || !entry.role) {
    return false;
  }
  if (interactiveRoles.has(entry.role)) {
    return Boolean(entry.name || entry.value || entry.role === "textbox" || entry.role === "searchbox");
  }
  if (interactiveOnly) {
    return false;
  }
  if (!contentRoles.has(entry.role)) {
    return false;
  }
  return Boolean(entry.name || entry.value || entry.description);
};

const quoteSnapshotText = (value) => JSON.stringify(String(value || "").slice(0, 800));

export const formatAxEntry = (entry, ref = "") => {
  const prefix = ref ? `[${ref}] ` : "";
  const text = entry.name || entry.value || entry.description;
  const states = [];
  if (entry.protected) {
    states.push("protected");
  }
  if (entry.disabled) {
    states.push("disabled");
  }
  if (entry.checked !== undefined) {
    states.push(entry.checked === "mixed" ? "mixed" : (entry.checked ? "checked" : "unchecked"));
  }
  if (entry.selected !== undefined) {
    states.push(entry.selected ? "selected" : "unselected");
  }
  if (entry.expanded !== undefined) {
    states.push(entry.expanded ? "expanded" : "collapsed");
  }
  if (entry.level) {
    states.push(`level=${entry.level}`);
  }
  return `${prefix}${entry.role}${text ? ` ${quoteSnapshotText(text)}` : ""}${states.length ? ` ${states.join(" ")}` : ""}`;
};

export const publicBrowserArgs = (name, args) => {
  const source = args && typeof args === "object" ? args : {};
  if (name !== "browser_type") {
    return source;
  }
  const text = String(source.text || "");
  return {
    ...source,
    text: "[REDACTED]",
    text_length: text.length,
  };
};

export const sanitizeBrowserToolCall = (call) => {
  if (!call?.function || !browserToolNames.has(call.function.name)) {
    return call;
  }
  let args = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {}
  return {
    ...call,
    function: {
      ...call.function,
      arguments: JSON.stringify(publicBrowserArgs(call.function.name, args)),
    },
  };
};

export const normalizedVisionBox = (box) => {
  if (!Array.isArray(box) || box.length !== 4) {
    return null;
  }
  const values = box.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const top = Math.max(0, Math.min(1, values[0]));
  const left = Math.max(0, Math.min(1, values[1]));
  const bottom = Math.max(top, Math.min(1, values[2]));
  const right = Math.max(left, Math.min(1, values[3]));
  if (bottom - top < 0.002 || right - left < 0.002) {
    return null;
  }
  return [top, left, bottom, right];
};

export const bitmapDifference = (left, right) => {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length || !left.length) {
    return 1;
  }
  let total = 0;
  for (let index = 0; index < left.length; index += 4) {
    total += Math.abs(left[index] - right[index]);
    total += Math.abs(left[index + 1] - right[index + 1]);
    total += Math.abs(left[index + 2] - right[index + 2]);
  }
  return total / ((left.length / 4) * 3 * 255);
};

export const collectFrameTree = (frameTree, sessionId = "") => {
  const frames = new Map();
  const visit = (entry, parentId = "") => {
    const frame = entry?.frame;
    if (!frame?.id) {
      return;
    }
    frames.set(frame.id, {
      frameId: frame.id,
      parentId: frame.parentId || parentId,
      url: String(frame.url || ""),
      sessionId,
    });
    for (const child of Array.isArray(entry.childFrames) ? entry.childFrames : []) {
      visit(child, frame.id);
    }
  };
  visit(frameTree);
  return frames;
};
