"use client";
// Shows a one-shot flash message exactly once per browser tab.
//
// The server can only tell us "here is the latest flash"; it cannot forget it
// for us without a round trip that could race the next action. So the client
// keeps the list of flash timestamps it has already shown in sessionStorage
// and skips repeats. Rendering happens after mount to avoid a hydration
// mismatch between server (no storage) and client.
import { useEffect, useState } from "react";
import type { Flash } from "@/lib/flash";

const STORAGE_KEY = "legacy:flashes-shown";

function readShown(): number[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function rememberShown(at: number) {
  try {
    const next = [...readShown(), at].slice(-20); // keep the list tiny
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode etc.): worst case the flash shows twice.
  }
}

export function FlashMessage({ flash }: { flash: Flash | null }) {
  const [visible, setVisible] = useState<Flash | null>(null);
  const incomingAt = flash?.at ?? null;

  useEffect(() => {
    if (!flash) return;
    if (readShown().includes(flash.at)) return; // already displayed in this tab
    rememberShown(flash.at);
    setVisible(flash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `at` identifies the flash
  }, [incomingAt]);

  if (!visible) return null;

  return (
    <div className={`flash flash--${visible.kind}`} role="status" aria-live="polite">
      <span>{visible.message}</span>
      <button type="button" className="flash__close" aria-label="Dismiss message" onClick={() => setVisible(null)}>
        ×
      </button>
    </div>
  );
}
