#!/usr/bin/env node
/**
 * Parse-check the main inline script in public/day03-ai-builder.html.
 * Catches syntax errors (e.g. try without catch) before they break all deck navigation.
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "..", "public", "day03-ai-builder.html");
const html = readFileSync(htmlPath, "utf8");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
if (scripts.length < 2) {
  console.error("validate-day03-deck: expected at least 2 inline script blocks");
  process.exit(1);
}

/** Main deck logic is the larger block (second script tag). */
const mainJs = scripts.reduce((a, b) =>
  b[1].length > a[1].length ? b : a,
)[1];

try {
  new Function(mainJs);
} catch (e) {
  console.error("day03-ai-builder.html main script syntax error:");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

console.log("day03-ai-builder.html main script: syntax OK");
