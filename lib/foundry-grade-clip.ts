/**
 * Groq free tier rejects huge single chat requests (~12k TPM for Llama 3.3 70B).
 * Clip only what we send TO the model. Full originals are still persisted on success.
 */

function envInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 120 ? n : fallback;
}

function clipWithMiddleGap(text: string, maxChars: number): {
  clipped: string;
  omitted: number;
} {
  if (text.length <= maxChars) {
    return { clipped: text, omitted: 0 };
  }

  const markerTpl = (
    omit: number
  ) => `\n\n… About ${omit.toLocaleString()} characters omitted here (submission too long for the grader quota). Judge the excerpts before & after …\n\n`;

  /** Binary-ish search-ish: reserve ~10% slack for overhead */
  const target = Math.max(320, Math.floor(maxChars * 0.94));
  let h = Math.floor(target * 0.55);
  let t = Math.max(80, target - h);
  while (true) {
    const marker = markerTpl(Math.max(text.length - h - t, 0));
    if (h + marker.length + t <= maxChars) {
      const clipped = text.slice(0, h) + marker + text.slice(-t);
      return { clipped, omitted: text.length - h - t };
    }
    h = Math.max(80, Math.floor(h * 0.88));
    t = Math.max(80, Math.floor(t * 0.88));
    if (h + t + 220 > maxChars) {
      /** Hard fallback: head-only */
      return {
        clipped: text.slice(0, maxChars - 40) + "\n… [truncated head-only]",
        omitted: Math.max(text.length - maxChars, 0),
      };
    }
  }
}

export function clipFoundryBodiesForGroq(
  promptFull: string,
  outputFull: string
): {
  promptForModel: string;
  outputForModel: string;
  truncated: boolean;
  omittedCharsPrompt: number;
  omittedCharsOutput: number;
} {
  const maxPrompt = envInt(process.env.FOUNDRY_GRADE_MAX_PROMPT_CHARS, 4500);
  const maxOutput = envInt(process.env.FOUNDRY_GRADE_MAX_OUTPUT_CHARS, 6500);

  const p = clipWithMiddleGap(promptFull, maxPrompt);
  const o = clipWithMiddleGap(outputFull, maxOutput);

  return {
    promptForModel: p.clipped,
    outputForModel: o.clipped,
    truncated: p.omitted + o.omitted > 0,
    omittedCharsPrompt: p.omitted,
    omittedCharsOutput: o.omitted,
  };
}
