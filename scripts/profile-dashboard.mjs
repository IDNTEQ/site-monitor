import { performance } from "node:perf_hooks";
import { renderDashboardPage } from "../src/dashboard-page.mjs";

const startedAt = performance.now();
const html = renderDashboardPage();
const durationMs = performance.now() - startedAt;
const bytes = Buffer.byteLength(html, "utf8");

process.stdout.write(`Dashboard HTML bytes: ${bytes}\n`);
process.stdout.write(`Dashboard render time: ${durationMs.toFixed(2)}ms\n`);

if (bytes > 140000) {
  throw new Error(`Dashboard HTML exceeded 140000 byte budget: ${bytes}`);
}

if (durationMs > 120) {
  throw new Error(`Dashboard render exceeded 120ms local budget: ${durationMs.toFixed(2)}ms`);
}
