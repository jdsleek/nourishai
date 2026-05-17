#!/usr/bin/env node
/**
 * Training platform smoke / E2E checks (read-only; no test rows created).
 *
 * Start the app first, e.g. after `npm run build`:
 *   npm run start -- -p 3999
 * Then:
 *   E2E_BASE_URL=http://127.0.0.1:3999 node scripts/e2e-verify-training-platform.mjs
 *
 * Optional: point at production
 *   E2E_BASE_URL=https://your-app.up.railway.app node scripts/e2e-verify-training-platform.mjs
 *
 * If DATABASE_URL is set in the environment while this script runs, extra DB-backed
 * expectations are asserted (e.g. unknown course slug → 404 on class-hub).
 *
 * No cleanup is required: this script does not create facilitators or submissions.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FOOD_APP = join(__dirname, "..");

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = join(FOOD_APP, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

loadEnvFiles();

const BASE = (
  process.env.E2E_BASE_URL ||
  process.env.BASE_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");
const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 45000);

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

async function fetchWithTimeout(url, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      return r;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

async function check(name, fn) {
  process.stdout.write(`  • ${name} … `);
  try {
    await fn();
    console.log("ok");
  } catch (e) {
    console.log("FAIL");
    throw e;
  }
}

async function main() {
  console.log(`E2E_BASE_URL=${BASE}`);
  console.log(`DATABASE_URL in env (for extra checks): ${HAS_DB ? "yes" : "no"}\n`);

  process.stdout.write("  • warmup (cold dev compile if any) … ");
  await fetchWithTimeout(`${BASE}/`).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  console.log("ok");

  await check("GET / (rewritten deck HTML)", async () => {
    const r = await fetchWithTimeout(`${BASE}/`, {
      headers: { Accept: "text/html" },
    });
    assert(r.ok, `status ${r.status}`);
    const t = await r.text();
    assert(
      /FOUNDRY|Foundry|SUBMIT TO THE FOUNDRY|portal/i.test(t),
      "missing deck markers",
    );
  });

  await check("GET /foundry/day03 (deck HTML)", async () => {
    const r = await fetchWithTimeout(`${BASE}/foundry/day03`);
    assert(r.ok, `status ${r.status}`);
    const t = await r.text();
    assert(/assessment/i.test(t) && /URLSearchParams/.test(t), "missing deck script");
  });

  await check("GET /foundry/day03?assessment=e2e-fake-slug (HTML still serves)", async () => {
    const r = await fetchWithTimeout(
      `${BASE}/foundry/day03?assessment=e2e-fake-slug-not-real`,
    );
    assert(r.ok, `status ${r.status}`);
  });

  await check("GET /class (learner hub page)", async () => {
    const r = await fetchWithTimeout(`${BASE}/class`, {
      headers: { Accept: "text/html" },
    });
    assert(r.ok, `status ${r.status}`);
    const t = await r.text();
    assert(/Class hub|class hub/i.test(t), "missing Class hub title");
  });

  await check("GET /class?course=fake-e2e-slug-zz (page renders)", async () => {
    const r = await fetchWithTimeout(
      `${BASE}/class?course=fake-e2e-slug-zz999`,
      { headers: { Accept: "text/html" } },
    );
    assert(r.ok, `status ${r.status}`);
  });

  await check("GET /training/facilitator/login", async () => {
    const r = await fetchWithTimeout(`${BASE}/training/facilitator/login`);
    assert(r.ok, `status ${r.status}`);
    const t = await r.text();
    assert(/Facilitator|Trainer|sign-in/i.test(t), "missing login copy");
  });

  await check("GET /api/foundry/assessment-config (default deck)", async () => {
    const r = await fetchWithTimeout(`${BASE}/api/foundry/assessment-config`);
    assert(r.ok, `status ${r.status}`);
    const j = await r.json();
    assert(typeof j.submissionsOpen === "boolean", "submissionsOpen");
    assert(Array.isArray(j.subgroups), "subgroups");
  });

  await check("GET /api/foundry/class-hub (no slug)", async () => {
    const r = await fetchWithTimeout(`${BASE}/api/foundry/class-hub`);
    assert(r.ok, `status ${r.status}`);
    const j = await r.json();
    assert(j.deckHref && j.deckHref.startsWith("/"), "deckHref");
    assert(j.workbookPath === "/class-workbook", "workbookPath");
  });

  if (HAS_DB) {
    await check("GET /api/foundry/class-hub?slug=zzze2e-no-such-course-999 (404)", async () => {
      const r = await fetchWithTimeout(
        `${BASE}/api/foundry/class-hub?slug=zzze2e-no-such-course-999`,
      );
      assert(r.status === 404, `expected 404 got ${r.status}`);
      const j = await r.json();
      assert(j.error === "UNKNOWN_COURSE", "error code");
    });
  } else {
    await check("GET /api/foundry/class-hub?slug=x (503 without DATABASE_URL)", async () => {
      const r = await fetchWithTimeout(`${BASE}/api/foundry/class-hub?slug=x`);
      assert(r.status === 503, `expected 503 got ${r.status}`);
      const j = await r.json();
      assert(j.error === "DATABASE_UNAVAILABLE", "error code");
    });
  }

  await check("GET /api/foundry/my-submission without id param (400)", async () => {
    const r = await fetchWithTimeout(`${BASE}/api/foundry/my-submission`);
    assert(r.status === 400, `expected 400 got ${r.status}`);
  });

  await check("GET /api/foundry/my-submission?id=bad-uuid-shape (404)", async () => {
    const r = await fetchWithTimeout(
      `${BASE}/api/foundry/my-submission?id=not-a-uuid`,
    );
    assert(r.status === 404, `expected 404 got ${r.status}`);
  });

  await check("POST /api/foundry/grade missing body fields (400)", async () => {
    const r = await fetchWithTimeout(`${BASE}/api/foundry/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(r.status === 400, `expected 400 got ${r.status}`);
  });

  console.log("\nAll automated checks passed.");
  console.log(
    "(Grading-with-LLM and facilitator cookie flows need DATABASE_URL + keys; run manually in staging.)",
  );
}

main().catch((e) => {
  console.error("\n", e.message || e);
  process.exit(1);
});
