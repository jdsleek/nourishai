import Groq from "groq-sdk";

let client: Groq | null = null;

export function getGroq(): Groq {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to food-app/.env.local (or Railway Variables) and restart the server."
    );
  }
  if (!client) client = new Groq({ apiKey: key });
  return client;
}

export const GROQ_MODEL =
  process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
