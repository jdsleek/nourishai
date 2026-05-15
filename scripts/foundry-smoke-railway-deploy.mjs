#!/usr/bin/env node
/**
 * Hits the **deployed** NourishAI Railway app only (no local DATABASE_URL).
 * Resolves HTTPS origin via RAILWAY_TOKEN + GraphQL (same discovery as railway:set-groq).
 *
 * Usage (from food-app/):
 *   npm run foundry:smoke:railway-deploy
 *
 * Env (typically in Training Classes Project/.env):
 *   RAILWAY_TOKEN
 * Optional: FOUNDRY_ADMIN_PASSWORD (default 10101010)
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const FOOD_APP = join(__dirname, "..");

const ENDPOINT = "https://backboard.railway.com/graphql/v2";

function tryLoadTok() {
  for (const p of [
    join(REPO_ROOT, ".env"),
    join(FOOD_APP, ".env.local"),
    join(REPO_ROOT, "vault", ".env"),
  ]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t.startsWith("RAILWAY_TOKEN=")) continue;
      let v = t.slice(14).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      if (v) return v;
    }
  }
  return "";
}

async function gql(tok, query, variables = {}) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await r.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const QUERY_WORKSPACE = `
  query {
    me {
      workspaces {
        team {
          projects { edges { node { id name environments { edges { node { id name } } }
            services { edges { node { id name } } } } } }
        }
      }
    }
  }
`;

const Q_ENV_INSTANCES = `
  query E($id: String!) {
    environment(id: $id) {
      id name
      serviceInstances {
        edges {
          node {
            serviceName
            domains {
              serviceDomains { domain }
              customDomains { domain }
            }
            latestDeployment { url staticUrl }
          }
        }
      }
    }
  }
`;

function pickEnv(project) {
  const envs = (project.environments?.edges || []).map((e) => e.node).filter(Boolean);
  return (
    envs.find((e) => /^production$/i.test(e.name)) ||
    envs.find((e) => /^prod$/i.test(e.name)) ||
    envs[0]
  );
}

function pickProj(nodes) {
  return (
    nodes.find((p) => {
      const svcs = (p.services?.edges || []).map((e) => e.node?.name).join(" ");
      return /nourishai/i.test(svcs) || /nourishai/i.test(p.name || "");
    }) ||
    nodes.find((p) => /nourish/i.test(p.name || "")) ||
    null
  );
}

function originFromInstance(n) {
  if (/postgres|redis|mongo|mysql/i.test(String(n.serviceName))) return "";
  const domains = [...(n.domains?.serviceDomains || []), ...(n.domains?.customDomains || [])]
    .map((d) => d.domain)
    .filter(Boolean);
  let u = n.latestDeployment?.url || n.latestDeployment?.staticUrl || "";
  if (typeof u === "string" && u.startsWith("http")) {
    try {
      return new URL(u).origin;
    } catch {
      /* ignore */
    }
  }
  if (!u && domains.length) return `https://${domains[0]}`;
  if (domains.length && !String(u || "").startsWith("http"))
    return `https://${domains[0]}`;
  return "";
}

async function resolveDeployedOrigin(tok) {
  const ws = await gql(tok, QUERY_WORKSPACE);
  const nodes =
    ws?.me?.workspaces?.flatMap((w) =>
      (w.team?.projects?.edges || []).map((e) => e.node).filter(Boolean),
    ) || [];
  const proj = pickProj(nodes);
  if (!proj) throw new Error("No nourish / nourishai Railway project discovered.");
  const env = pickEnv(proj);
  if (!env?.id) throw new Error("No environment on project.");

  const data = await gql(tok, Q_ENV_INSTANCES, { id: env.id });
  const instances =
    data.environment?.serviceInstances?.edges?.map((e) => e.node).filter(Boolean) || [];

  const hosts = [];

  for (const n of instances) {
    const o = originFromInstance(n);
    if (o) hosts.push(`${n.serviceName || "?"}→${o}`);
  }

  for (const n of instances) {
    const o = originFromInstance(n);
    if (o && !String(n.serviceName || "").includes("postgres")) return { origin: o, hosts };
  }
  throw new Error(`No non-database origin found. Seen: ${hosts.join("; ") || "(none)"}`);
}

const SAMPLE_PROMPT =
  `Role: You are a test architect.` +
  ` Task: Design a trivial API.` +
  ` Context: Smoke cohort.` +
  ` Constraints: Minimal stack only.` +
  ` Output Format: Markdown sections Frontend, Backend, Database, Flow.`;

const SAMPLE_OUTPUT =
  `### Frontend Stack\nReact SPA on Vite.` +
  ` ### Backend API\nREST with Node.` +
  ` ### Database Schema\nPostgres tables users(id), items(id,user_id).` +
  ` ### Data Flow\nBrowser calls API, API queries DB, JSON response.` +
  ` Extra padding exceeds eighty chars for Railway smoke validator okay.`;

async function main() {
  const tok = tryLoadTok() || process.env.RAILWAY_TOKEN?.trim();
  if (!tok) {
    console.error(
      "Set RAILWAY_TOKEN in Training Classes Project/.env or food-app/.env.local (account token)."
    );
    process.exit(1);
  }

  const { origin, hosts } = await resolveDeployedOrigin(tok);
  console.log("Railway HTTPS origin:", origin);
  if (hosts.length) console.log("Discovered origins:", hosts.join(" · "));
  console.log(
    "(If wrong, export FOUNDRY_SMOKE_BASE=https://… and use scripts/foundry-smoke-test.mjs --api --grade.)\n",
  );

  const ADMIN_PW = process.env.FOUNDRY_ADMIN_PASSWORD?.trim() || "10101010";

  const adminUrl = new URL("/api/foundry/admin/submissions", origin);
  console.log("[1]", adminUrl.pathname);
  let r = await fetch(adminUrl, { headers: { "x-foundry-admin-password": ADMIN_PW } });
  let text = await r.text();
  if (!r.ok) {
    console.error("Admin failed:", r.status, text.slice(0, 400));
    process.exit(1);
  }
  const before = JSON.parse(text).submissions?.length ?? -1;

  const gradeUrl = new URL("/api/foundry/grade", origin);
  console.log("[2]", gradeUrl.pathname);
  r = await fetch(gradeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Railway Smoke " + Date.now(),
      subgroup: "Zion",
      prompt: SAMPLE_PROMPT,
      output: SAMPLE_OUTPUT,
    }),
  });
  text = await r.text();
  const graded = JSON.parse(text);
  if (!r.ok) {
    console.error("Grade failed:", r.status, text.slice(0, 600));
    process.exit(1);
  }
  console.log(
    `[2] ok=${graded.ok} score=${graded.result?.total_score}/20 persisted=${graded.persisted}`,
  );

  console.log("[3]", adminUrl.pathname, "again");
  r = await fetch(adminUrl, { headers: { "x-foundry-admin-password": ADMIN_PW } });
  const afterObj = await r.json();
  const after = afterObj.submissions?.length ?? -1;

  if (graded.persisted && after !== before + 1) {
    console.error(
      `Expected submissions ${before}+1=${before + 1} after persisted grade; got ${after}.`,
    );
    process.exit(1);
  }
  console.log("[3] submissions:", before, "→", after, graded.persisted ? "(persisted ✓)" : "");

  console.log("\nRailway deploy smoke PASSED.");

  console.log(
    "\nNote: a test submission row was written to Postgres; remove from admin UI if undesired.",
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
