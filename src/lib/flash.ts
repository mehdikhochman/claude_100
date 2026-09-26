// One-shot "flash" messages ("Booked!", "Cancelled.") shown on the next page.
//
// How it works: a Server Action calls setFlash() right before it redirects.
// The value goes into a short-lived httpOnly cookie; the root template reads
// it on the next render and hands it to <FlashMessage>, which remembers which
// flashes (by `at`) it has already shown so nothing is displayed twice.
// Nothing ever needs to delete the cookie — it expires by itself.
import { cookies } from "next/headers";

const FLASH_COOKIE = "legacy_flash";
/** Lifetime of a flash. Long enough to survive a redirect, short enough to fade. */
const FLASH_TTL_MS = 30_000;

export type FlashKind = "success" | "error" | "info";
/** `at` (ms since epoch) makes each flash unique so the client can dedupe. */
export type Flash = { kind: FlashKind; message: string; at: number };

export async function setFlash(kind: FlashKind, message: string): Promise<void> {
  const store = await cookies();
  const flash: Flash = { kind, message, at: Date.now() };
  store.set(FLASH_COOKIE, JSON.stringify(flash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(FLASH_TTL_MS / 1000),
  });
}

/** The current flash, or null when there is none or it has gone stale. */
export async function readFlash(): Promise<Flash | null> {
  const store = await cookies();
  const raw = store.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Flash>;
    if (typeof parsed.message !== "string" || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > FLASH_TTL_MS) return null;
    const kind: FlashKind = parsed.kind === "error" || parsed.kind === "info" ? parsed.kind : "success";
    return { kind, message: parsed.message, at: parsed.at };
  } catch {
    return null;
  }
}
