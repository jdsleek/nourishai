#!/usr/bin/env node
/**
 * Push GROQ_API_KEY + GROQ_MODEL to the NourishAI Railway service only.
 * Uses the same GraphQL as vault/scripts/railway-push-env.mjs
 *
 * Env (e.g. Training Classes Project/.env + food-app/.env.local):
 *   RAILWAY_TOKEN     — account token (dashboard → account → tokens)
 *   GROQ_API_KEY, GROQ_MODEL
 *   NOURISHAI_RAILWAY_PROJECT_ID — optional; if unset, picks a project whose name matches /nourishai/i
 */
import { readFileSync, existsSync } from 'fs';
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

/** Account tokens often return empty for `me { projects }` and `projects { }` — use workspaces. */
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

async function main() {
  const gsk = process.env.GROQ_API_KEY || '';
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  if (!gsk) {
    console.error('GROQ_API_KEY is empty. Set it in .env or food-app/.env.local');
    process.exit(1);
  }

  let projectId = process.env.NOURISHAI_RAILWAY_PROJECT_ID || '';
  let project = null;

  if (projectId) {
    const data = await gql(QUERY_PROJECT_FULL, { id: projectId });
    project = data.project;
    if (!project) {
      console.error('No project for NOURISHAI_RAILWAY_PROJECT_ID');
      process.exit(1);
    }
  } else {
    const data = await gql(QUERY_WORKSPACES_PROJECTS);
    const nodes =
      data?.me?.workspaces?.flatMap((w) =>
        (w.team?.projects?.edges || []).map((e) => e.node).filter(Boolean),
      ) || [];
    project = pickNourishaiProject(nodes);
    if (!project) {
      console.error(
        'No project with a "nourishai" service (or name) found. Set NOURISHAI_RAILWAY_PROJECT_ID=… in .env',
      );
      console.error('Project names seen:', nodes.map((p) => p.name).join(', ') || '(none)');
      process.exit(1);
    }
    projectId = project.id;
  }

  const env = pickEnvironment(project);
  const service = pickService(project);
  if (!env || !service) {
    console.error('Could not resolve environment or service.');
    process.exit(1);
  }

  console.log('Target:', {
    projectId,
    projectName: project.name,
    environmentId: env.id,
    serviceId: service.id,
    serviceName: service.name,
  });

  await gql(MUTATION_UPSERT, {
    input: {
      projectId,
      environmentId: env.id,
      serviceId: service.id,
      replace: false,
      variables: {
        GROQ_API_KEY: gsk,
        GROQ_MODEL: model,
      },
    },
  });

  console.log('Done. GROQ_API_KEY and GROQ_MODEL set on Railway. Redeploy if variables did not trigger automatically.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
