/**
 * Resolve rendered DATABASE_URL for a Railway project's primary app service.
 * Uses RAILWAY_TOKEN + RAILWAY_PROJECT_ID (never logs connection strings).
 */
const ENDPOINT = "https://backboard.railway.app/graphql/v2";

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

const QUERY_VARS = `
  query Varz($environmentId: String!, $projectId: String!, $serviceId: String!, $unrendered: Boolean) {
    variables(
      projectId: $projectId
      environmentId: $environmentId
      serviceId: $serviceId
      unrendered: $unrendered
    )
  }
`;

/** Shared variables for this environment when no serviceId passed (Railway omit pattern). */
const QUERY_VARS_SHARED = `
  query VarzShared($environmentId: String!, $projectId: String!, $unrendered: Boolean) {
    variables(projectId: $projectId, environmentId: $environmentId, unrendered: $unrendered)
  }
`;

function pickProductionEnv(environments = []) {
  return (
    environments.find((e) => /^production$/i.test(e.name)) ||
    environments.find((e) => /^prod$/i.test(e.name)) ||
    environments[0] ||
    null
  );
}

function candidateServices(nodes = []) {
  const svcs = nodes.map((n) => n).filter(Boolean);
  const infra = (n) =>
    /postgres|redis|mysql|mongo|database|supabase|^pg-/i.test(n || "");
  /** Postgres add-on surfaces connection strings; app vars may omit resolved URL until deploy. */
  const ordered = [
    ...svcs.filter((s) => infra(s.name || "")),
    ...svcs.filter((s) => !infra(s.name || "")),
  ];
  const primary =
    svcs.find((s) => !infra(s.name || "")) ||
    svcs[0] ||
    null;
  return { primary, ordered };
}

const URL_KEYS_PREFERENCE = [
  "DATABASE_PUBLIC_URL",
  "POSTGRES_PUBLIC_URL",
  "DATABASE_URL",
  "DATABASE_PRIVATE_URL",
  "POSTGRES_URL",
  "PRIVATE_DATABASE_URL",
];

function isPublicPgUrl(url) {
  if (
    /\.railway\.internal\b/i.test(url) ||
    /^postgres:?\/\/[^\s]+\.railway\.internal\b/i.test(url)
  ) {
    return false;
  }
  return /^postgres(ql)?:\/\//i.test(url);
}

function readFirstPostgresConn(varsObj) {
  if (!varsObj || typeof varsObj !== "object") return "";

  for (const k of URL_KEYS_PREFERENCE) {
    const du = varsObj[k];
    const url =
      typeof du === "string" ? du.trim() : "";
    if (isPublicPgUrl(url)) return url;
  }

  if (process.env.DEBUG_RAILWAY_VARS === "1") {
    try {
      const keys = JSON.stringify(Object.keys(varsObj)).slice(0, 500);
      console.error(`[railway-vars] scanned keys snippet: ${keys}`);
    } catch {
      //
    }
  }

  return "";
}

export async function resolveRailwayRenderedDatabaseUrl({
  token,
  projectId,
} = {}) {
  const tok = String(token || "").trim();
  const pid = String(projectId || "").trim();
  if (!tok || !pid) throw new Error("Railway token and project id required");

  async function gql(query, variables) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (!res.ok || json.errors?.length) {
      const msg =
        json.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json.data;
  }

  const data = await gql(QUERY_PROJECT_FULL, { id: pid });
  const project = data?.project;
  if (!project) throw new Error("Railway project not found for id");

  const environments = (project.environments?.edges || [])
    .map((e) => e.node)
    .filter(Boolean);
  const env = pickProductionEnv(environments);
  if (!env?.id)
    throw new Error("Railway environment not resolved");

  const serviceNodes = (project.services?.edges || [])
    .map((e) => e.node)
    .filter(Boolean);
  const { ordered } = candidateServices(serviceNodes);

  /** Try merged / shared vars first — many apps expose DATABASE_URL at environment scope. */
  try {
    const vd = await gql(QUERY_VARS_SHARED, {
      environmentId: env.id,
      projectId: pid,
      unrendered: false,
    });
    const url = readFirstPostgresConn(vd?.variables);
    if (url) return url;
  } catch (e) {
    if (process.env.DEBUG_RAILWAY_VARS === "1") {
      console.error("[railway-vars] shared vars query failed:", e);
    }
  }

  for (const svc of ordered) {
    if (!svc?.id) continue;
    if (process.env.DEBUG_RAILWAY_VARS === "1") {
      console.error(`[railway-vars] service "${svc.name}" (${svc.id})`);
    }
    try {
      const vd = await gql(QUERY_VARS, {
        environmentId: env.id,
        projectId: pid,
        serviceId: svc.id,
        unrendered: false,
      });
      const url = readFirstPostgresConn(vd?.variables);
      if (url) return url;

      /** Second pass: raw references (sometimes only unrendered contains the addon key). */
      const vdRaw = await gql(QUERY_VARS, {
        environmentId: env.id,
        projectId: pid,
        serviceId: svc.id,
        unrendered: true,
      });
      const url2 = readFirstPostgresConn(vdRaw?.variables);
      if (url2) return url2;
    } catch (e) {
      if (process.env.DEBUG_RAILWAY_VARS === "1") {
        console.error(`[railway-vars] vars for ${svc.name}:`, e);
      }
    }
  }

  throw new Error(
    "Could not resolve DATABASE_URL from Railway variables for this project.",
  );
}
