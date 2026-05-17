import { mkdir, appendFile, readFile, writeFile } from "fs/promises";
import path from "path";
import type { FoundryGradeResult } from "@/lib/foundry-grade";
import {
  ensureFoundrySubmissionsSchema,
  getFoundryPgPool,
  pgDeleteSubmissionById,
  pgInsertSubmission,
  pgListSubmissionsNewestFirst,
} from "@/lib/foundry-pg";

export type FoundrySubmissionRecord = {
  id: string;
  submittedAt: string;
  fellowName: string;
  subgroup: string;
  ide: string;
  prompt: string;
  output: string;
  result: FoundryGradeResult;
  /** Null → legacy built-in Foundry rubric */
  assessmentId?: string | null;
  assessmentSlug?: string | null;
  assessmentTitle?: string | null;
};

const dataDir = path.join(process.cwd(), "data");
const storeFile = path.join(dataDir, "foundry-submissions.jsonl");
const backupFile = path.join(dataDir, "foundry-submissions.db-mirror.jsonl");

async function appendJsonlLines(
  targets: readonly string[],
  line: string
): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await Promise.all(
    targets.map((f) =>
      appendFile(f, line, "utf8").catch((e) =>
        console.error(`[foundry-store] append ${path.basename(f)} failed`, e)
      )
    )
  );
}

async function readJsonlFile(fp: string): Promise<FoundrySubmissionRecord[]> {
  const raw = await readFile(fp, "utf8");
  const rows = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FoundrySubmissionRecord);
  return rows;
}

async function readJsonlFileSafe(fp: string): Promise<FoundrySubmissionRecord[]> {
  try {
    return await readJsonlFile(fp);
  } catch {
    return [];
  }
}

/** Remove submission lines with this id from mirror JSONLs (rewrite files). Returns true if at least one file lost a row. */
async function stripIdFromMirrorJsonls(id: string): Promise<boolean> {
  await mkdir(dataDir, { recursive: true });
  let stripped = false;
  for (const fp of [storeFile, backupFile]) {
    const rows = await readJsonlFileSafe(fp);
    const next = rows.filter((r) => r.id !== id);
    if (next.length !== rows.length) stripped = true;
    const body = next.length ? `${next.map((r) => JSON.stringify(r)).join("\n")}\n` : "";
    await writeFile(fp, body, "utf8");
  }
  return stripped;
}

/**
 * Removes from Postgres when configured, then rewrites local JSONLs without this id (so merges do not resurrect it).
 * @returns `{ removed: boolean }` false if nothing was deleted.
 */
export async function deleteFoundrySubmission(id: string): Promise<{ removed: boolean }> {
  const trimmed = String(id || "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return { removed: false };
  }

  let fromPg = false;
  const pool = getFoundryPgPool();

  if (pool) {
    try {
      await ensureFoundrySubmissionsSchema(pool);
      fromPg = await pgDeleteSubmissionById(pool, trimmed);
    } catch (e) {
      console.error("[foundry-store] Postgres delete failed", e);
    }
  }

  const fromFiles = await stripIdFromMirrorJsonls(trimmed);
  return { removed: fromPg || fromFiles };
}

async function readFileMerged(): Promise<FoundrySubmissionRecord[]> {
  const seen = new Set<string>();
  const out: FoundrySubmissionRecord[] = [];
  /** Prefer mirror first — often written alongside successful DB inserts. */
  const filesToTry = [backupFile, storeFile];

  await mkdir(dataDir, { recursive: true });

  for (const fp of filesToTry) {
    try {
      const rows = await readJsonlFile(fp);
      for (const rec of rows) {
        if (rec?.id && !seen.has(rec.id)) {
          seen.add(rec.id);
          out.push(rec);
        }
      }
    } catch {
      continue;
    }
  }
  out.sort((a, b) => compareSubmittedDesc(a.submittedAt, b.submittedAt));
  return out;
}

function compareSubmittedDesc(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

/** `authoritative` overwrites IDs also present in `supplementary` (e.g. Postgres over JSONL). */
function mergeDedupeSorted(
  supplementary: FoundrySubmissionRecord[],
  authoritative: FoundrySubmissionRecord[]
): FoundrySubmissionRecord[] {
  const map = new Map<string, FoundrySubmissionRecord>();
  for (const rec of supplementary) {
    if (rec?.id) map.set(rec.id, rec);
  }
  for (const rec of authoritative) {
    if (rec?.id) map.set(rec.id, rec);
  }
  return Array.from(map.values()).sort((x, y) =>
    compareSubmittedDesc(x.submittedAt, y.submittedAt)
  );
}

/** Primary append: Postgres when DATABASE_URL is set; always mirrors to JSONL as backup/fallback anchor. Falls back to file-only if Postgres fails. */
export async function appendFoundrySubmission(
  entry: Omit<FoundrySubmissionRecord, "id" | "submittedAt">
): Promise<FoundrySubmissionRecord> {
  const rec: FoundrySubmissionRecord = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    ...entry,
  };
  const line = `${JSON.stringify(rec)}\n`;
  const pool = getFoundryPgPool();

  if (pool) {
    try {
      await ensureFoundrySubmissionsSchema(pool);
      await pgInsertSubmission(pool, rec);
      await appendJsonlLines([storeFile, backupFile], line);
      return rec;
    } catch (e) {
      console.error("[foundry-store] Postgres insert failed; falling back to file only", e);
    }
  }

  await mkdir(dataDir, { recursive: true });
  await appendJsonlLines([storeFile, backupFile], line);
  return rec;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Learner lookup: grade summary only (no prompt/output). */
export async function getFoundrySubmissionGradeById(
  id: string,
): Promise<Pick<FoundrySubmissionRecord, "id" | "submittedAt" | "result"> | null> {
  const trimmed = id.trim();
  if (!UUID_RE.test(trimmed)) return null;

  const pool = getFoundryPgPool();
  if (pool) {
    try {
      await ensureFoundrySubmissionsSchema(pool);
      const { rows } = await pool.query(
        `SELECT id, submitted_at, result FROM foundry_submissions WHERE id = $1::uuid LIMIT 1`,
        [trimmed],
      );
      if (rows.length) {
        const row = rows[0] as Record<string, unknown>;
        return {
          id: String(row.id),
          submittedAt: new Date(String(row.submitted_at)).toISOString(),
          result:
            typeof row.result === "string"
              ? (JSON.parse(row.result) as FoundrySubmissionRecord["result"])
              : (row.result as FoundrySubmissionRecord["result"]),
        };
      }
    } catch (e) {
      console.error("[foundry-store] grade lookup failed", e);
    }
  }

  const all = await readFoundrySubmissionsNewestFirst();
  const hit = all.find((r) => r.id === trimmed);
  if (!hit) return null;
  return { id: hit.id, submittedAt: hit.submittedAt, result: hit.result };
}

/** Reads Postgres (newest-first) merged with JSONL backups (dedupe by id). Postgres wins on conflict. */
export async function readFoundrySubmissionsNewestFirst(): Promise<
  FoundrySubmissionRecord[]
> {
  const pool = getFoundryPgPool();
  let fromPg: FoundrySubmissionRecord[] = [];

  if (pool) {
    try {
      await ensureFoundrySubmissionsSchema(pool);
      fromPg = await pgListSubmissionsNewestFirst(pool);
    } catch (e) {
      console.error("[foundry-store] Postgres read failed; using JSONL only", e);
    }
  }

  let fromDisk: FoundrySubmissionRecord[] = [];
  try {
    fromDisk = await readFileMerged();
  } catch (e) {
    console.error("[foundry-store] JSONL read failed", e);
  }

  if (fromPg.length === 0) return fromDisk;
  const pgIds = new Set(fromPg.map((r) => r.id));
  const diskOnly = fromDisk.filter((r) => !pgIds.has(r.id));
  /** Postgres order is authoritative; append disk-only records (offline / pre-migration rows). */
  return mergeDedupeSorted(diskOnly, fromPg);
}
