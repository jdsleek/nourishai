import { cookies } from "next/headers";
import {
  facilitatorCookieName,
  openFacilitatorSession,
} from "@/lib/facilitator-session";

export function facilitatorFromCookie(): { fid: string; email: string } | null {
  const token = cookies().get(facilitatorCookieName())?.value;
  const p = openFacilitatorSession(token);
  if (!p) return null;
  return { fid: p.fid, email: p.email };
}
