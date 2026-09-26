// Server-side session helpers: read/write the auth cookie and load the
// current user. Use these from Server Components, Server Actions and Route
// Handlers. (The proxy uses token.ts directly.)
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from "./token";

/** The user fields pages are allowed to see. Never the password hash. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
  isPublic: true,
  createdAt: true,
} as const;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "MEMBER" | "ADMIN";
  avatarUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
};

export async function setSessionCookie(user: { id: string; role: "MEMBER" | "ADMIN" }): Promise<void> {
  const token = await createSessionToken({ userId: user.id, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * The logged-in user, or null. Cached per request so layouts, pages and
 * components can all call it without repeating the database query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.userId }, select: publicUserSelect });
});

/** Redirect to /login (remembering where the user was) unless logged in. */
export async function requireUser(returnUrl: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  return user;
}

/** Like requireUser, but members are sent to /access-denied. */
export async function requireAdmin(returnUrl: string): Promise<CurrentUser> {
  const user = await requireUser(returnUrl);
  if (user.role !== "ADMIN") redirect("/access-denied");
  return user;
}
