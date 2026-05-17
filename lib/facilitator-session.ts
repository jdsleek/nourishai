import { createHmac, timingSafeEqual } from "crypto";

export type FacilitatorSessionPayload = {
  fid: string;
  email: string;
  exp: number; // unix seconds
};

const COOKIE = "training_fac_session";

export function facilitatorCookieName() {
  return COOKIE;
}

function getSecret(): string {
  const s = process.env.FACILITATOR_SESSION_SECRET?.trim();
  return s || "dev-only-change-facilitator-session-secret";
}

/** 14-day session */
export function sealFacilitatorSession(payload: FacilitatorSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function openFacilitatorSession(token: string | undefined): FacilitatorSessionPayload | null {
  if (!token?.includes(".")) return null;
  const [body, sig] = token.split(".") as [string, string];
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  let raw: FacilitatorSessionPayload;
  try {
    raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as FacilitatorSessionPayload;
  } catch {
    return null;
  }
  if (!raw?.fid || !raw?.email || typeof raw.exp !== "number") return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (raw.exp < nowSec) return null;
  return raw;
}

export function facilitatorSessionExpiry(): number {
  return Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
}
