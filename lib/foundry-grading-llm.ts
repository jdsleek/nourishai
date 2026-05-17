/**
 * Foundry grading: Groq, OpenRouter, and NVIDIA NIM (OpenAI-compatible).
 * Tries providers in FOUNDRY_GRADING_PROVIDER_ORDER; each provider may retry
 * transient failures (429 / 5xx / empty body) with backoff.
 * Keys only via env — never bundled to the browser.
 */

import Groq from "groq-sdk";
import { getGroq, GROQ_MODEL } from "@/lib/groq";

export type FoundryGradeTokenMeter = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** When the provider omitted billing counts (~4 chars per token heuristic). */
  inferred: boolean;
};

export type GradingProviderMeta = {
  provider: "groq" | "openrouter" | "nvidia";
  model: string;
  usage: FoundryGradeTokenMeter;
};

type ChatResp = {
  ok: boolean;
  content?: string;
  status: number;
  bodyPreview?: string;
  /** From OpenAI-compatible `usage`, when present */
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Per-provider tries for the same upstream (429/empty/5xx). Default 3. Range 1–8. */
function gradeLlmAttempts(): number {
  const raw = parseInt(process.env.FOUNDRY_GRADE_LLM_ATTEMPTS ?? "", 10);
  if (!Number.isFinite(raw)) return 3;
  return Math.min(Math.max(raw, 1), 8);
}

function backoffMs(attemptIndex: number): number {
  const base = 450 * Math.pow(2, attemptIndex);
  const cap = Math.min(base, 8000);
  const jitter = Math.floor(Math.random() * 260);
  return cap + jitter;
}

function scrubForLogSnippet(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function normalizeTokenCount(n: unknown): number {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v);
}

function buildTokenMeter(
  apiPrompt: unknown,
  apiCompletion: unknown,
  apiTotal: unknown,
  userContent: string,
  assistantContent: string,
): FoundryGradeTokenMeter {
  let promptTokens = normalizeTokenCount(apiPrompt);
  let completionTokens = normalizeTokenCount(apiCompletion);
  let totalTokens = normalizeTokenCount(apiTotal);
  let inferred = false;

  if (!promptTokens) {
    promptTokens = Math.max(1, Math.ceil(userContent.length / 4));
    inferred = true;
  }
  if (!completionTokens) {
    completionTokens = Math.max(1, Math.ceil(String(assistantContent).length / 4));
    inferred = true;
  }
  const sumPc = promptTokens + completionTokens;
  if ((!totalTokens || totalTokens < sumPc) && promptTokens && completionTokens) {
    totalTokens = Math.max(sumPc, totalTokens || 0);
  }
  if (!totalTokens) {
    totalTokens = sumPc;
    inferred = true;
  }

  return { promptTokens, completionTokens, totalTokens, inferred };
}

function groqErrStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const o = err as { status?: number; response?: { status?: number } };
  if (typeof o.status === "number") return o.status;
  const r = o.response?.status;
  if (typeof r === "number") return r;
  return undefined;
}

function groqRetriesForError(st: number | undefined): boolean {
  if (st === undefined) return true;
  if (st === 413) return false;
  if (st === 400 || st === 401 || st === 403 || st === 404) return false;
  if (st === 429) return true;
  if (st >= 500) return true;
  return false;
}

/** HTTP layer: retry same provider on rate limits / empty / upstream instability. */
function openAiResponseShouldRetry(
  resp: ChatResp,
  attemptIdx: number,
  maxAttempts: number
): boolean {
  if (attemptIdx >= maxAttempts - 1) return false;

  // Success path with content exits before this helper is used.

  if (resp.ok) {
    const empty =
      !resp.content || !(resp.bodyPreview ?? "").trim() ||
      resp.bodyPreview === "(empty assistant)";
    return empty;
  }

  const s = resp.status;
  if (s === 413 || s === 400 || s === 401 || s === 403 || s === 404)
    return false;
  if (s === 429 || s === 408 || s === 529) return true;
  if (s >= 500 && s !== 501) return true;
  return false;
}

async function chatOpenAiCompatibleOnce(params: {
  url: string;
  apiKey: string;
  model: string;
  userContent: string;
  maxTokens: number;
  extraHeaders?: Record<string, string>;
}): Promise<ChatResp> {
  const res = await fetch(params.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0,
      max_tokens: params.maxTokens,
      messages: [{ role: "user", content: params.userContent }],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let preview = text.slice(0, 400);
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      preview = String(j?.error?.message ?? preview);
    } catch {
      /* keep preview */
    }
    return { ok: false, status: res.status, bodyPreview: preview };
  }

  try {
    const json = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const content = json?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content)
      return { ok: false, status: res.status, bodyPreview: "(empty assistant)" };
    const u = json.usage;
    return {
      ok: true,
      status: res.status,
      content,
      promptTokens: normalizeTokenCount(u?.prompt_tokens),
      completionTokens: normalizeTokenCount(u?.completion_tokens),
      totalTokens: normalizeTokenCount(u?.total_tokens),
    };
  } catch {
    return { ok: false, status: res.status, bodyPreview: text.slice(0, 200) };
  }
}

async function chatOpenAiCompatibleWithRetries(
  label: string,
  params: {
    url: string;
    apiKey: string;
    model: string;
    userContent: string;
    maxTokens: number;
    extraHeaders?: Record<string, string>;
  }
): Promise<ChatResp> {
  const maxAttempts = gradeLlmAttempts();
  let last!: ChatResp;
  const charLen = params.userContent.length;

  for (let a = 0; a < maxAttempts; a++) {
    last = await chatOpenAiCompatibleOnce(params);
    if (
      last.ok &&
      typeof last.content === "string" &&
      last.content.length > 0
    ) {
      if (a > 0) {
        console.info(
          "[foundry/grader]",
          JSON.stringify({
            provider: label,
            event: "recovered_after_retry",
            attempt: a + 1,
            promptChars: charLen,
          })
        );
      }
      return last;
    }

    const retry = openAiResponseShouldRetry(last, a, maxAttempts);
    console.warn(
      "[foundry/grader]",
      JSON.stringify({
        provider: label,
        event: retry ? "retry" : "give_up_attempts",
        attempt: a + 1,
        maxAttempts,
        httpStatus: last.status,
        detail: scrubForLogSnippet(last.bodyPreview ?? "(no preview)", 180),
      })
    );
    if (!retry) break;
    await sleep(backoffMs(a));
  }

  return last;
}

const KNOWN_PROVIDERS = new Set(["groq", "openrouter", "nvidia"]);

function sanitizedProviderOrder(): string[] {
  const raw = providerOrderRaw();
  return [...new Set(raw.filter((id) => KNOWN_PROVIDERS.has(id)))];
}

function providerOrderRaw(): string[] {
  const raw =
    process.env.FOUNDRY_GRADING_PROVIDER_ORDER?.trim().toLowerCase() ||
    "openrouter,nvidia,groq";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function hasCredentialFor(provider: string): boolean {
  if (provider === "groq") return !!process.env.GROQ_API_KEY?.trim();
  if (provider === "openrouter")
    return !!process.env.OPENROUTER_API_KEY?.trim();
  if (provider === "nvidia") return !!process.env.NVIDIA_API_KEY?.trim();
  return false;
}

export function summarizeFoundryGradeEnv(): string {
  const configured = sanitizedProviderOrder().filter(hasCredentialFor);
  return configured.length
    ? `providers with keys (${configured.join(", ")})`
    : "no LLM keys set (need GROQ_API_KEY / OPENROUTER_API_KEY / NVIDIA_API_KEY)";
}

async function groqGrade(
  userContent: string,
  maxTokens: number
): Promise<{ content: string; meta: GradingProviderMeta } | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null;

  const groq: Groq = getGroq();
  const maxAttempts = gradeLlmAttempts();

  let lastCatch: unknown;
  const charLen = userContent.length;

  for (let a = 0; a < maxAttempts; a++) {
    try {
      const res = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: userContent }],
      });
      const raw = res.choices[0]?.message?.content?.trim() || "";
      if (raw) {
        const u =
          (
            res as unknown as {
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
              };
            }
          ).usage ?? {};
        const usage = buildTokenMeter(
          u.prompt_tokens,
          u.completion_tokens,
          u.total_tokens,
          userContent,
          raw,
        );
        if (a > 0) {
          console.info(
            "[foundry/grader]",
            JSON.stringify({
              provider: "groq",
              event: "recovered_after_retry",
              attempt: a + 1,
              promptChars: charLen,
            })
          );
        }
        return {
          content: raw,
          meta: { provider: "groq", model: GROQ_MODEL, usage },
        };
      }

      const willRetry = a < maxAttempts - 1;
      console.warn(
        "[foundry/grader]",
        JSON.stringify({
          provider: "groq",
          event: willRetry ? "retry_empty" : "give_up_attempts_empty",
          attempt: a + 1,
          maxAttempts,
          promptChars: charLen,
        })
      );
      if (!willRetry) break;
      await sleep(backoffMs(a));
    } catch (e) {
      lastCatch = e;
      const st = groqErrStatus(e);
      if (st === 413 || !groqRetriesForError(st))
        throw e;

      console.warn(
        "[foundry/grader]",
        JSON.stringify({
          provider: "groq",
          event: "retry_after_error",
          attempt: a + 1,
          maxAttempts,
          httpStatus: st ?? "(none)",
          detail: scrubForLogSnippet(e instanceof Error ? e.message : String(e), 180),
        })
      );
      if (a >= maxAttempts - 1) throw e;
      await sleep(backoffMs(a));
    }
  }

  if (lastCatch)
    console.warn(
      "[foundry/grader]",
      JSON.stringify({
        provider: "groq",
        event: "empty_after_retries",
        message: "falling through to next provider",
        promptChars: charLen,
      })
    );
  return null;
}

async function openRouterGrade(
  userContent: string,
  maxTokens: number
): Promise<{ content: string; meta: GradingProviderMeta } | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;

  const model =
    process.env.OPENROUTER_MODEL?.trim() ||
    "meta-llama/llama-3.3-70b-instruct:free";

  const site = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "NourishAI Foundry";

  const extraHeaders: Record<string, string> = {};
  if (site) extraHeaders["HTTP-Referer"] = site;
  extraHeaders["X-Title"] = title;

  const r = await chatOpenAiCompatibleWithRetries("openrouter", {
    url: OPENROUTER_URL,
    apiKey: key,
    model,
    userContent,
    maxTokens,
    extraHeaders,
  });

  if (!r.ok || !r.content)
    throw new Error(
      `OpenRouter failed (${r.status}): ${r.bodyPreview ?? "unknown"}`
    );

  const usage = buildTokenMeter(
    r.promptTokens,
    r.completionTokens,
    r.totalTokens,
    userContent,
    r.content,
  );
  return { content: r.content, meta: { provider: "openrouter", model, usage } };
}

async function nvidiaGrade(
  userContent: string,
  maxTokens: number
): Promise<{ content: string; meta: GradingProviderMeta } | null> {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) return null;

  const model =
    process.env.NVIDIA_CHAT_MODEL?.trim() ||
    "meta/llama-3.3-70b-instruct";

  const r = await chatOpenAiCompatibleWithRetries("nvidia", {
    url: NVIDIA_URL,
    apiKey: key,
    model,
    userContent,
    maxTokens,
  });

  if (!r.ok || !r.content)
    throw new Error(
      `NVIDIA failed (${r.status}): ${r.bodyPreview ?? "unknown"}`
    );

  const usage = buildTokenMeter(
    r.promptTokens,
    r.completionTokens,
    r.totalTokens,
    userContent,
    r.content,
  );
  return { content: r.content, meta: { provider: "nvidia", model, usage } };
}

/** Heuristic when every provider failed due to oversized prompts / quotas. */
export function gradeFailureLooksLikeTokenLimit(msg: string): boolean {
  return /\b413\b|(status\s*[:(]?\s*)?529\b| tpm|tokens?\s+(per\s+)?minute|minute\s+tpm|tokens?\s*meter|burst\s+tpm|requests?\s*(per\s+)?minute|rpm\b|quota|token\s*limit|context\s*(length|window)|maximum\s+context|prompt\s+is\s+too\s+long|too_many_tokens|max_tokens|context\s+(length\s+)?(exceeded|overflow)/i.test(
    msg
  );
}

/**
 * Sends the grading rubric blob to chat models in provider order until one returns text.
 */
export async function runFoundryGradeWithFallbacks(params: {
  userContent: string;
  maxTokens: number;
}): Promise<{ content: string; meta: GradingProviderMeta; errors?: string[] }> {
  const { userContent, maxTokens } = params;
  const order = sanitizedProviderOrder();

  console.info(
    "[foundry/grader]",
    JSON.stringify({
      event: "start",
      chain: order.filter(hasCredentialFor),
      maxAttemptsPerProvider: gradeLlmAttempts(),
      promptChars: userContent.length,
    })
  );

  if (!order.length) {
    throw new Error(
      "FOUNDRY_GRADING_PROVIDER_ORDER contains no recognized providers " +
        "(use groq, openrouter, nvidia)."
    );
  }
  if (!order.some(hasCredentialFor)) {
    throw new Error(
      "No grading API keys configured. Set one or more: GROQ_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY."
    );
  }

  const errors: string[] = [];

  for (const p of order) {
    if (!hasCredentialFor(p)) continue;
    console.info("[foundry/grader]", JSON.stringify({ event: "try_provider", provider: p }));
    try {
      if (p === "groq") {
        try {
          const g = await groqGrade(userContent, maxTokens);
          if (g)
            return { ...g, errors: errors.length ? errors : undefined };
        } catch (e) {
          const st = groqErrStatus(e);
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`groq${st ? `(${st})` : ""}: ${msg}`);
          continue;
        }
        continue;
      }

      if (p === "openrouter") {
        const o = await openRouterGrade(userContent, maxTokens);
        if (o)
          return { ...o, errors: errors.length ? errors : undefined };
        continue;
      }

      if (p === "nvidia") {
        const n = await nvidiaGrade(userContent, maxTokens);
        if (n)
          return { ...n, errors: errors.length ? errors : undefined };
        continue;
      }
    } catch (e) {
      const msg =
        `${p}: ` + (e instanceof Error ? e.message : JSON.stringify(e));
      errors.push(msg);
      console.warn(
        "[foundry/grader]",
        JSON.stringify({
          event: "provider_failed",
          provider: p,
          detail: scrubForLogSnippet(msg, 220),
        })
      );
    }
  }

  console.error("[foundry/grader]", JSON.stringify({ event: "all_failed", steps: errors.length }));

  throw new Error(
    `All grading providers failed.${errors.map((x) => "\n- " + x).join("")}`
  );
}
