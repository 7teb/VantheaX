const explicitScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const loopbackHost = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#].*)?$/i;
const hostWithPort = /^(?:\[[0-9A-Fa-f:]+\]|[^/\s:]+):\d+(?:[/?#].*)?$/;
const dottedHost = /^[^\s.]+(?:\.[^\s.]+)+(?:[/?#].*)?$/;

export const displayBrowserUrl = (value) => value === "about:blank" ? "" : String(value || "");

export const normalizeBrowserUrl = (value) => {
  const input = String(value || "").trim();
  if (!input) {
    return null;
  }
  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      return url.protocol === "http:" || url.protocol === "https:" ? input : null;
    } catch {
      return null;
    }
  }
  if (input === "about:blank") {
    return input;
  }
  if (loopbackHost.test(input)) {
    return `http://${input}`;
  }
  if (hostWithPort.test(input)) {
    return `https://${input}`;
  }
  if (explicitScheme.test(input)) {
    return null;
  }
  if (dottedHost.test(input)) {
    return `https://${input}`;
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
};
