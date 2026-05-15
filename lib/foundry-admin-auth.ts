import type { NextRequest } from "next/server";

export function getFoundryAdminPassword(): string {
  return process.env.FOUNDRY_ADMIN_PASSWORD?.trim() || "10101010";
}

export function isFoundryAdminRequest(req: NextRequest): boolean {
  const expected = getFoundryAdminPassword();
  const header = req.headers.get("x-foundry-admin-password");
  return Boolean(expected && header === expected);
}
