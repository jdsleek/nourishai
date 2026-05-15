import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import type { FoundryGradeResult } from "@/lib/foundry-grade";

export type FoundrySubmissionRecord = {
  id: string;
  submittedAt: string;
  fellowName: string;
  subgroup: string;
  ide: string;
  prompt: string;
  output: string;
  result: FoundryGradeResult;
};

const dataDir = path.join(process.cwd(), "data");
const storeFile = path.join(dataDir, "foundry-submissions.jsonl");

export async function appendFoundrySubmission(
  entry: Omit<FoundrySubmissionRecord, "id" | "submittedAt">
): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const rec: FoundrySubmissionRecord = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    ...entry,
  };
  await appendFile(storeFile, `${JSON.stringify(rec)}\n`, "utf8");
}

export async function readFoundrySubmissionsNewestFirst(): Promise<
  FoundrySubmissionRecord[]
> {
  try {
    const raw = await readFile(storeFile, "utf8");
    const rows = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FoundrySubmissionRecord);
    return rows.reverse();
  } catch {
    return [];
  }
}
