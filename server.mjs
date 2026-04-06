import http from "node:http";
import { renderDashboardPage } from "./src/dashboard-page.mjs";

const port = Number(process.env.PORT || 3000);

const server = http.createServer((request, response) => {
  if (!request.url || request.url === "/" || request.url.startsWith("/?")) {
    const html = renderDashboardPage();
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(html);
    return;
  }

  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`site-monitor dashboard listening on http://127.0.0.1:${port}\n`);
});
