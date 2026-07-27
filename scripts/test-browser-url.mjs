import assert from "node:assert/strict";
import { displayBrowserUrl, normalizeBrowserUrl } from "../src/browser/browser-url.js";

const cases = [
  ["example.com", "https://example.com"],
  ["https://a.de/x?y=1", "https://a.de/x?y=1"],
  ["http://a.de", "http://a.de"],
  ["localhost:5173", "http://localhost:5173"],
  ["localhost", "http://localhost"],
  ["127.0.0.1:3000", "http://127.0.0.1:3000"],
  ["[::1]:5173", "http://[::1]:5173"],
  ["https://localhost:5173", "https://localhost:5173"],
  ["example.com:8080/pfad", "https://example.com:8080/pfad"],
  ["192.168.1.10:3000", "https://192.168.1.10:3000"],
  ["javascript:alert(1)", null],
  ["file:///C:/", null],
  ["data:text/html,x", null],
  ["chrome://settings", null],
  ["ws://x", null],
  ["", null],
  ["   ", null],
  ["  example.com  ", "https://example.com"],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeBrowserUrl(input), expected, input);
}

assert.equal(normalizeBrowserUrl("wie spaet ist es"), "https://duckduckgo.com/?q=wie%20spaet%20ist%20es");
assert.equal(displayBrowserUrl("about:blank"), "");
assert.equal(displayBrowserUrl("https://x.de"), "https://x.de");

process.stdout.write("browser-url: ok\n");
