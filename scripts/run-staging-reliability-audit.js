#!/usr/bin/env node

import { readFileSync } from "node:fs";
import process from "node:process";

import {
  createStagingReliabilityAudit,
  formatTextAuditReport
} from "../src/worker/reliability/stagingReliabilityAudit.js";

function printUsage() {
  console.error("Usage: node scripts/run-staging-reliability-audit.js <audit.json> [--format json]");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const jsonFormat = args.includes("--format") && args[args.indexOf("--format") + 1] === "json";
  const path = args.find((argument) => !argument.startsWith("--"));

  if (!path) {
    printUsage();
    process.exit(1);
  }

  return {
    path,
    format: jsonFormat ? "json" : "text"
  };
}

function main() {
  const { path, format } = parseArgs(process.argv);
  const rawInput = readFileSync(path, "utf8");
  const payload = JSON.parse(rawInput);
  const report = createStagingReliabilityAudit(payload);

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatTextAuditReport(report)}\n`);
}

main();
