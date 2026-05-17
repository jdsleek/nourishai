#!/usr/bin/env node
/**
 * Hits each grading provider with one tiny completion (Groq/OpenRouter/NVIDIA).
 * Loads `.env` then `.env.local` like other smoke scripts — never echoes keys.
 *
 * Usage from food-app/: npm run foundry:smoke-providers
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

/** @param {string} text */
function parseEnvLines(text) {
  /** @type {Record<string, string>} */
  const obj = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return obj;
}

function loadProjectEnv() {
  const fragments = [];
  for (const name of [".env", ".env.local"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    fragments.push(parseEnvLines(fs.readFileSync(p, "utf8")));
  }
  /** @type {Record<string, string>} */
  const merged = fragments.reduce((a, b) => ({ ...a, ...b }), {});
  for (const [key, val] of Object.entries(merged)) {
    const cur = process.env[key];
    if (cur === undefined || cur === "") process.env[key] = val;
  }
}

function logResult(label, preview) {
  const p = String(preview ?? "").slice(0, 200);
  console.log(`[foundry:smoke-providers] ${label}: ${p}`);
}

/**
 * @param {string} label
 * @param {string} url
 * @param {string} apiKey
 * @param {string} model
 * @param {Record<string,string>} [extraHeaders]
 */
async function pingOpenAiCompat(label, url, apiKey, model, extraHeaders = {}) {
  if (!apiKey?.trim()) {
    console.log(`[foundry:smoke-providers] SKIP ${label}: no API key`);
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 12,
      messages: [
        {
          role: "user",
          content: 'Reply with exactly JSON: {"ok":true}',
        },
      ],
    }),
  });
  const text = await res.text();
  let preview = text.slice(0, 280);
  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      preview =
        j?.error?.message ||
        j?.message ||
        `(HTTP ${res.status}) ${preview}`;
    } catch {
      preview = `(HTTP ${res.status}) ${preview}`;
    }
    logResult(`FAIL ${label}`, preview);
    return;
  }
  try {
    const j = JSON.parse(text);
    const c = String(j?.choices?.[0]?.message?.content ?? "").trim();
    logResult(`OK ${label}`, c || `(empty)`);
  } catch {
    logResult(`FAIL ${label}`, `parse:${preview}`);
  }
}

async function main() {
  loadProjectEnv();

  console.log("[foundry:smoke-providers] Probing endpoints (sanitized)...");

  const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  await pingOpenAiCompat(
    `groq(${groqModel})`,
    "https://api.groq.com/openai/v1/chat/completions",
    process.env.GROQ_API_KEY ?? "",
    groqModel,
  );

  const orModel =
    process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  /** @type {Record<string,string>} */
  const orHeaders = { "X-Title": process.env.OPENROUTER_APP_TITLE || "Smoke" };
  if (process.env.OPENROUTER_HTTP_REFERER?.trim())
    orHeaders["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER.trim();

  await pingOpenAiCompat(
    `openrouter(${orModel})`,
    "https://openrouter.ai/api/v1/chat/completions",
    process.env.OPENROUTER_API_KEY ?? "",
    orModel,
    orHeaders,
  );

  const nvModel =
    process.env.NVIDIA_CHAT_MODEL || "meta/llama-3.3-70b-instruct";
  await pingOpenAiCompat(
    `nvidia(${nvModel})`,
    "https://integrate.api.nvidia.com/v1/chat/completions",
    process.env.NVIDIA_API_KEY ?? "",
    nvModel,
  );

  console.log("[foundry:smoke-providers] Done.");
}

main().catch((e) => {
  console.error("[foundry:smoke-providers]", e);
  process.exitCode = 1;
});
