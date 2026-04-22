import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to food-app/.env.local and restart the dev server."
    );
  }
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
