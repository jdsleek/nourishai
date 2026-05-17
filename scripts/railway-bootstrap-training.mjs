#!/usr/bin/env node
/**
 * One-shot (from your laptop):
 *   1) Upsert FACILITATOR_SESSION_SECRET on the NourishAI Next.js Railway service via GraphQL
 *      (needs RAILWAY_TOKEN account token — never committed).
 *   2) `railway link` this directory to project + primary app service (non-interactive).
 *   3) `railway run npm run facilitator:demo-seed` — runs locally while DATABASE_URL is
 *      injected so the demo facilitator row lands in Railway Postgres.
 *
 * Prereqs: Railway CLI installed (`npm i -g @railway/cli`), logged in or RAILWAY_TOKEN set.
 *
 * Env (loads parent .env, vault/.env, food-app/.env, food-app/.env.local same as railway-set-groq):
 *   RAILWAY_TOKEN — required for GraphQL + CLI
 *   NOURISHAI_RAILWAY_PROJECT_ID — optional; fallback: project matching /nourishai/i
 *   FACILITATOR_SESSION_SECRET — optional; if missing or too short a new secret is generated
 *
 * Flags:
 *   --vars-only — push secret only (no railway link / no seed)
 *   --print-secret — echo generated FACILITATOR_SESSION_SECRET (unsafe for shared CI logs)
 */
import { randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function tryLoadEnvFile(p) {
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (val === '') continue;
    process.env[key] = val;
  }
}

tryLoadEnvFile(join(root, '..', '.env'));
tryLoadEnvFile(join(root, '..', 'vault', '.env'));
tryLoadEnvFile(join(root, '.env'));
tryLoadEnvFile(join(root, '.env.local'));

const ENDPOINT = 'https://backboard.railway.com/graphql/v2';

const QUERY_WORKSPACES_PROJECTS = `
  query {
    me {
      workspaces {
        team {
          projects {
            edges {
              node {
                id
                name
                environments { edges { node { id name } } }
                services { edges { node { id name } } }
              }
            }
          }
        }
      }
    }
  }
`;

const QUERY_PROJECT_FULL = `
  query ProjectFull($id: String!) {
    project(id: $id) {
      id
      name
      environments { edges { node { id name } } }
      services { edges { node { id name } } }
    }
  }
`;

const MUTATION_UPSERT = `
  mutation Upsert($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }
`;

async function gql(query, variables = {}) {
  const tok = process.env.RAILWAY_TOKEN;
  if (!tok) throw new Error('Set RAILWAY_TOKEN (Railway account token).');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

function pickEnvironment(project) {
  const envs = (project.environments?.edges || []).map((e) => e.node).filter(Boolean);
  return (
    envs.find((e) => /^production$/i.test(e.name)) ||
    envs.find((e) => /^prod$/i.test(e.name)) ||
    envs[0]
  );
}

function pickService(project) {
  const svcs = (project.services?.edges || []).map((e) => e.node).filter(Boolean);
  const skip = (n) => /postgres|redis|mysql|mongo/i.test(n);
  return svcs.find((s) => !skip(s.name)) || svcs[0];
}

function pickNourishaiProject(nodes) {
  return (
    nodes.find((p) => {
      const svcs = (p.services?.edges || []).map((e) => e.node?.name).join(' ');
      return /nourishai/i.test(svcs) || /nourishai/i.test(p.name || '');
    }) ||
    nodes.find((p) => /nourish/i.test(p.name || '')) ||
    null
  );
}

function railwaySpawn(args, label) {
  const r = spawnSync('railway', args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.error) {
    console.error(`[railway-bootstrap] Railway CLI spawn failed (${label}). Is \`railway\` installed?`, r.error.message);
    return false;
  }
  if ((r.status ?? 1) !== 0) {
    console.error(`[railway-bootstrap] Command failed (${label}): exit ${r.status ?? '?'}`);
    return false;
  }
  return true;
}

async function main() {
  const varsOnly = process.argv.includes('--vars-only');
  const printSecret = process.argv.includes('--print-secret');

  const MIN_SECRET = 32;
  const fromEnv = process.env.FACILITATOR_SESSION_SECRET?.trim() || '';
  let secret = fromEnv;
  let usedGenerated = false;
  if (secret.length < MIN_SECRET) {
    secret = randomBytes(32).toString('hex'); // 64 hex chars
    usedGenerated = true;
  }

  let projectId = process.env.NOURISHAI_RAILWAY_PROJECT_ID || '';
  let project = null;

  if (projectId) {
    const data = await gql(QUERY_PROJECT_FULL, { id: projectId });
    project = data.project;
    if (!project) throw new Error('No project for NOURISHAI_RAILWAY_PROJECT_ID');
  } else {
    const data = await gql(QUERY_WORKSPACES_PROJECTS);
    const nodes =
      data?.me?.workspaces?.flatMap((w) =>
        (w.team?.projects?.edges || []).map((e) => e.node).filter(Boolean),
      ) || [];
    project = pickNourishaiProject(nodes);
    if (!project) {
      console.error(
        'No nourishai-named project/service. Set NOURISHAI_RAILWAY_PROJECT_ID in .env',
      );
      process.exit(1);
    }
    projectId = project.id;
  }

  const env = pickEnvironment(project);
  const service = pickService(project);
  if (!env || !service) {
    console.error('Could not resolve environment or Next.js service.');
    process.exit(1);
  }

  console.log('[railway-bootstrap] Target:', {
    projectId,
    projectName: project.name,
    environment: env.name,
    environmentId: env.id,
    serviceName: service.name,
    serviceId: service.id,
  });

  await gql(MUTATION_UPSERT, {
    input: {
      projectId,
      environmentId: env.id,
      serviceId: service.id,
      replace: false,
      variables: { FACILITATOR_SESSION_SECRET: secret },
    },
  });

  console.log('[railway-bootstrap] FACILITATOR_SESSION_SECRET set on Railway (primary app service).');
  if (printSecret && usedGenerated) {
    console.log('[railway-bootstrap] Generated secret (pipe to file; do not share):');
    console.log(secret);
  } else if (usedGenerated) {
    console.log(
      '[railway-bootstrap] A new cookie secret was generated. View in Railway → Variables, or rerun locally with --print-secret on your own laptop only.',
    );
  }

  if (varsOnly) {
    console.log('[railway-bootstrap] --vars-only done. Deploy; then optionally run seed below.');
    console.log('');
    console.log(`  railway link -p "${projectId}" -s "${service.name}" -e "${env.name}"`);
    console.log('  railway run npm run facilitator:demo-seed');
    return;
  }

  const linked = railwaySpawn(
    ['link', '-p', projectId, '-s', service.name, '-e', env.name],
    'railway link',
  );
  if (!linked) {
    console.error('');
    console.error('[railway-bootstrap] Link failed — run manually:');
    console.error(
      `  cd food-app && railway link -p "${projectId}" -s "${service.name}" -e "${env.name}"`,
    );
    process.exitCode = 1;
    return;
  }

  const seeded = railwaySpawn(['run', 'npm', 'run', 'facilitator:demo-seed'], 'facilitator:demo-seed');
  if (!seeded) {
    console.error(
      '[railway-bootstrap] DB seed failed. After deploy settles, retry: railway run npm run facilitator:demo-seed',
    );
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('[railway-bootstrap] Next: wait for Railway deploy if variables kicked a rebuild.');
  console.log('  Login → /training/facilitator/login');
  console.log('  Email    → nourishai-demo-facilitator@example.local');
  console.log('  Password → DemoCoach2026! (or DEMO_FACILITATOR_PASSWORD you set locally before seed)');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
