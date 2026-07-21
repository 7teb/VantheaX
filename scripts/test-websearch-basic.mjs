import fs from "node:fs";

const src = fs.readFileSync("D:/VantheaX/electron/main.js", "utf8");

const cut = (a, b) => {
  const s = src.indexOf(a);
  const e = src.indexOf(b, s);
  if (s === -1 || e === -1) {
    throw new Error(`anchor missing: ${a}`);
  }
  return src.slice(s, e);
};

const body = cut("const tavilyBase =", "\nconst executeTool =");

let passed = 0;
let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};

const build = ({ tavily, answer, sleepImpl }) => {
  const factory = new Function(
    "fetchWithRetry", "decryptText", "classifierModel", "geminiSafetySettings", "fetchOpenRouter", "sleep",
    `${body}\nreturn { runWebSearch, walkWebSources, webSourceHost, webSearchSiteDwellMs };`,
  );
  return factory(
    async (url, init) => ({ ok: true, status: 200, json: async () => tavily(url, JSON.parse(init.body)) }),
    () => "tavily-key",
    "classifier",
    [],
    async () => ({ choices: [{ message: { content: answer() } }] }),
    sleepImpl,
  );
};

const sources = (n) => ({
  results: Array.from({ length: n }, (_, i) => ({ title: `Result ${i + 1}`, url: `https://site${i + 1}.example.com/docs/page`, content: `body ${i + 1}` })),
});

// webSourceHost
{
  const api = build({ tavily: () => sources(1), answer: () => "a", sleepImpl: async () => {} });
  check("host plain", api.webSourceHost("https://spotify.com/x"), "spotify.com");
  check("host sub", api.webSourceHost("https://developer.spotify.com/documentation/web-api"), "developer.spotify.com");
  check("host www kept", api.webSourceHost("https://www.merriam-webster.com/a/b"), "www.merriam-webster.com");
  check("host port kept", api.webSourceHost("http://localhost:3000/x"), "localhost:3000");
  check("host garbage", api.webSourceHost("not a url"), "");
  check("host empty", api.webSourceHost(""), "");
  check("dwell", api.webSearchSiteDwellMs, 2500);
}

// walkWebSources emits one event per source, spaced by the dwell
{
  let now = 0;
  const stamps = [];
  const api = build({ tavily: () => sources(1), answer: () => "a", sleepImpl: async (ms) => { now += ms; } });
  const seen = [];
  await api.walkWebSources(
    [{ url: "https://a.com/x" }, { url: "bad" }, { url: "https://b.com/y" }],
    "q",
    (e) => { seen.push(e); stamps.push(now); },
    null,
  );
  check("walk skips unparseable", seen.map((e) => e.site), ["a.com", "b.com"]);
  check("walk marks depth", seen.map((e) => e.depth), ["basic", "basic"]);
  check("walk carries query", seen.map((e) => e.query), ["q", "q"]);
  check("walk spacing", stamps, [0, 2500]);
}

// walkWebSources stops on abort
{
  const controller = new AbortController();
  const api = build({ tavily: () => sources(1), answer: () => "a", sleepImpl: async () => {} });
  const seen = [];
  await api.walkWebSources(
    [{ url: "https://a.com" }, { url: "https://b.com" }, { url: "https://c.com" }],
    "q",
    (e) => { seen.push(e.site); if (seen.length === 2) { controller.abort(); } },
    controller.signal,
  );
  check("walk aborts", seen, ["a.com", "b.com"]);
}

const settings = (over = {}) => ({ tavilyKey: "enc", webSearch: { enabled: true, maxResults: 5, searchDepth: "basic", topic: "general", ...over } });

// basic run: progress order is query first, then every site, and the tool waits for the walk
{
  let now = 0;
  const api = build({ tavily: () => sources(3), answer: () => "the answer", sleepImpl: async (ms) => { now += ms; } });
  const seen = [];
  const result = await api.runWebSearch(settings(), { query: "spotify api values" }, (e) => seen.push({ ...e, at: now }));
  check("basic first event is the query", [seen[0].query, seen[0].site], ["spotify api values", undefined]);
  check("basic walks every site", seen.slice(1).map((e) => e.site), ["site1.example.com", "site2.example.com", "site3.example.com"]);
  check("basic site timing", seen.slice(1).map((e) => e.at), [0, 2500, 5000]);
  check("basic waits for the walk", now, 7500);
  check("basic result depth", result.depth, "basic");
  check("basic result answer", result.answer, "the answer");
  check("basic result sources", result.sources.length, 3);
}

// advanced run: no site walk at all, no added delay
{
  let now = 0;
  const api = build({ tavily: () => sources(4), answer: () => "the answer", sleepImpl: async (ms) => { now += ms; } });
  const seen = [];
  const result = await api.runWebSearch(settings({ searchDepth: "advanced" }), { query: "q" }, (e) => seen.push(e));
  check("advanced emits only the query", seen.length, 1);
  check("advanced marks depth", seen[0].depth, "advanced");
  check("advanced adds no delay", now, 0);
  check("advanced result depth", result.depth, "advanced");
}

// an answer-model failure still surfaces as an error, and is not an unhandled rejection
{
  const api = build({ tavily: () => sources(2), answer: () => { throw new Error("model exploded"); }, sleepImpl: async () => {} });
  let unhandled = null;
  process.on("unhandledRejection", (e) => { unhandled = e; });
  const result = await api.runWebSearch(settings(), { query: "q" }, () => {});
  await new Promise((r) => setImmediate(r));
  check("answer failure becomes an error", result.error, "Web search failed: model exploded");
  check("answer failure keeps depth", result.depth, "basic");
  check("no unhandled rejection", unhandled, null);
}

// zero results short-circuits before the walk
{
  const api = build({ tavily: () => sources(0), answer: () => "unused", sleepImpl: async () => { throw new Error("must not sleep"); } });
  const seen = [];
  const result = await api.runWebSearch(settings(), { query: "q" }, (e) => seen.push(e));
  check("empty result skips the walk", seen.length, 1);
  check("empty result answer", result.answer, "No web results were found for this query.");
  check("empty result depth", result.depth, "basic");
}

// early errors still carry depth so the renderer picks the right card
{
  const api = build({ tavily: () => sources(1), answer: () => "a", sleepImpl: async () => {} });
  const off = await api.runWebSearch({ tavilyKey: "enc", webSearch: { enabled: false, searchDepth: "basic" } }, { query: "q" }, () => {});
  check("disabled carries depth", off.depth, "basic");
  const noQuery = await api.runWebSearch(settings(), { query: "   " }, () => {});
  check("empty query carries depth", noQuery.depth, "basic");
  const advOff = await api.runWebSearch({ tavilyKey: "enc", webSearch: { enabled: false, searchDepth: "advanced" } }, { query: "q" }, () => {});
  check("disabled advanced carries depth", advOff.depth, "advanced");
}

// the url-extract path also walks, using the urls the model passed
{
  let now = 0;
  const api = build({
    tavily: (url) => (url.endsWith("/extract")
      ? { results: [{ url: "https://developer.spotify.com/documentation/web-api", raw_content: "x" }] }
      : sources(1)),
    answer: () => "a",
    sleepImpl: async (ms) => { now += ms; },
  });
  const seen = [];
  const result = await api.runWebSearch(settings(), { query: "q", urls: ["https://developer.spotify.com/documentation/web-api"] }, (e) => seen.push(e));
  check("extract path walks", seen.slice(1).map((e) => e.site), ["developer.spotify.com"]);
  check("extract path depth", result.depth, "basic");
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
