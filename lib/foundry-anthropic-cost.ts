/**
 * Reference cost in USD assuming Anthropic public API rates (Sonnet-tier order of magnitude).
 * Override with env vars if Anthropic publishes new list prices — this is used only for dashboards.
 */

function parseUsdPerMTok(raw: string | undefined, fallback: number): number {
  const n = parseFloat(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Default ≈ Claude 3.5 Sonnet class public list pricing (USD per million input tokens). */
const DEFAULT_ANTHROPIC_INPUT_PER_MTOK = 3;
/** Default USD per million output tokens. */
const DEFAULT_ANTHROPIC_OUTPUT_PER_MTOK = 15;

export function getAnthropicRefRatesUsdPerMTok(): {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  label: string;
} {
  const inputUsdPerMTok = parseUsdPerMTok(
    process.env.FOUNDRY_ANTHROPIC_REF_INPUT_PER_MTOK_USD,
    DEFAULT_ANTHROPIC_INPUT_PER_MTOK,
  );
  const outputUsdPerMTok = parseUsdPerMTok(
    process.env.FOUNDRY_ANTHROPIC_REF_OUTPUT_PER_MTOK_USD,
    DEFAULT_ANTHROPIC_OUTPUT_PER_MTOK,
  );
  const label =
    process.env.FOUNDRY_ANTHROPIC_REF_PRICING_LABEL?.trim() ||
    "Configurable Sonnet‑tier Anthropic reference (FOUNDRY_ANTHROPIC_REF_*_PER_MTOK_USD)";
  return { inputUsdPerMTok, outputUsdPerMTok, label };
}

export function anthropicEquivalentUsd(promptTokens: number, completionTokens: number): number {
  const { inputUsdPerMTok, outputUsdPerMTok } = getAnthropicRefRatesUsdPerMTok();
  const inp = Number(promptTokens);
  const out = Number(completionTokens);
  if (!Number.isFinite(inp) || !Number.isFinite(out)) return 0;
  return (
    (Math.max(0, inp) / 1e6) * inputUsdPerMTok +
    (Math.max(0, out) / 1e6) * outputUsdPerMTok
  );
}
