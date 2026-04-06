import http from "node:http";
import process from "node:process";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import puppeteer from "puppeteer";
import { renderDashboardPage } from "../src/dashboard-page.mjs";

const port = 3344;

const server = http.createServer((request, response) => {
  if (!request.url || request.url === "/" || request.url.startsWith("/?")) {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(renderDashboardPage());
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

function pickAuditValue(lhr, id) {
  const value = lhr.audits[id]?.numericValue;
  return typeof value === "number" ? Number((value / 1000).toFixed(2)) : null;
}

await new Promise((resolve, reject) => {
  server.listen(port, "127.0.0.1", (error) => {
    if (error) {
      reject(error);
      return;
    }
    resolve();
  });
});

const chrome = await launch({
  chromePath: puppeteer.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"]
});

try {
  const result = await lighthouse(`http://127.0.0.1:${port}/`, {
    port: chrome.port,
    throttlingMethod: "simulate",
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      disabled: false
    },
    throttling: {
      rttMs: 300,
      throughputKbps: 400,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 300,
      downloadThroughputKbps: 400,
      uploadThroughputKbps: 400
    },
    onlyCategories: ["performance"]
  });

  const { lhr } = result;
  const metrics = {
    performanceScore: lhr.categories.performance.score,
    firstContentfulPaintSeconds: pickAuditValue(lhr, "first-contentful-paint"),
    largestContentfulPaintSeconds: pickAuditValue(lhr, "largest-contentful-paint"),
    speedIndexSeconds: pickAuditValue(lhr, "speed-index"),
    interactiveSeconds: pickAuditValue(lhr, "interactive"),
    totalBlockingTimeSeconds: pickAuditValue(lhr, "total-blocking-time")
  };

  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
} finally {
  await chrome.kill();
  await new Promise((resolve) => server.close(resolve));
}
