// One-shot "flash" messages ("Booked!", "Cancelled.") shown on the next page.
// Stored in a short-lived httpOnly cookie set by a Server Action right before
// it redirects; the layout reads it and the <FlashMessage> component clears it.
import { cookies } from "next/headers";

const FLASH_COOKIE = "legacy_flash";

export type FlashKind = "success" | "error" | "info";
export type Flash = { kind: FlashKind; message: string };

export async function setFlash(kind: FlashKind, message: string): Promise<void> {
  const store = await cookies();
  store.set(FLASH_COOKIE, JSON.stringify({ kind, message }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60,
  });
}

export async function readFlash(): Promise<Flash | null> {
  const store = await cookies();
  const raw = store.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Flash>;
    if (typeof parsed.message !== "string") return null;
    const kind: FlashKind =
      parsed.kind === "error" || parsed.kind === "info" ? parsed.kind : "success";
    return { kind, message: parsed.message };
  } catch {
    return null;
  }
}

export async function clearFlash(): Promise<void> {
  const store = await cookies();
  store.delete(FLASH_COOKIE);
}
