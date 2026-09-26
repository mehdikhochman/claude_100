// Signed session token (JWT, HS256) — the only thing stored in the cookie.
// This file has no database or Next.js imports so the proxy can use it too.
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret } from "../env";

export const SESSION_COOKIE = "legacy_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type Role = "MEMBER" | "ADMIN";
export type SessionPayload = { userId: string; role: Role };

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret());
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Returns the payload, or null when the token is missing, tampered or expired. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    const role = payload.role === "ADMIN" ? "ADMIN" : "MEMBER";
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}
