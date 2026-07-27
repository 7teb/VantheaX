import http from "node:http";

const port = Math.max(1, Number(process.argv[2]) || 48765);

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:16px sans-serif;padding:28px;color:#222}a,button{margin:6px}code{background:#eee;padding:3px 6px}</style></head><body><h1>${title}</h1>${body}</body></html>`;

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/page2") {
    response.end(page("Page 2", `<a id="home" href="/">Home</a>`));
    return;
  }
  if (url.pathname === "/popup") {
    response.end(page("Popup target", `<code id="popup-ok">popup-ok</code>`));
    return;
  }
  if (url.pathname === "/posted") {
    response.end(page("Posted", `<code>posted</code>`));
    return;
  }
  if (url.pathname === "/redirect-safe") {
    response.writeHead(302, { Location: "/page2" });
    response.end();
    return;
  }
  if (url.pathname === "/redirect-unsafe") {
    response.writeHead(302, { Location: "file:///C:/Windows/win.ini" });
    response.end();
    return;
  }
  if (url.pathname === "/download") {
    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename=browser-fixture.txt",
    });
    response.end("blocked download");
    return;
  }
  if (url.pathname === "/permission") {
    response.end(page("Permission", `<button id="permission" onclick="navigator.geolocation.getCurrentPosition(()=>document.body.dataset.permission='granted',()=>document.body.dataset.permission='denied')">Request</button>`));
    return;
  }
  response.end(page("Browser fixture", `
    <a id="page2" href="/page2">Page 2</a>
    <a id="popup" href="/popup" target="_blank">Popup</a>
    <a id="safe-redirect" href="/redirect-safe">Safe redirect</a>
    <a id="unsafe-redirect" href="/redirect-unsafe">Unsafe redirect</a>
    <a id="download" href="/download">Download</a>
    <a id="permission-page" href="/permission">Permission</a>
    <button id="window-popup" onclick="window.open('/popup')">Window popup</button>
    <button id="push-state" onclick="history.pushState({},'', '/pushed');document.body.dataset.pushed='yes'">Push state</button>
    <form method="post" action="/posted" target="_blank"><button id="post-popup" type="submit">POST popup</button></form>
  `));
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`browser-fixture:${port}\n`);
});

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);
