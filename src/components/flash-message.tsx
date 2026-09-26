"use client";
// Shows a one-shot flash message exactly once per browser tab.
//
// The server can only tell us "here is the latest flash"; it cannot forget it
// for us without a round trip that could race the next action. So the client
// keeps the list of flash timestamps it has already shown in sessionStorage
// and skips repeats. The decision is made on the client only (after
// hydration) to avoid a server/client mismatch.
import { useEffect, useState, useSyncExternalStore } from "react";
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
    const next = [...readShown().filter((n) => n !== at), at].slice(-20); // keep the list tiny
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode etc.): worst case the flash shows twice.
  }
}

// "Are we on the client, after hydration?" — false during SSR and hydration.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

type Decision = { at: number; show: boolean };

export function FlashMessage({ flash }: { flash: Flash | null }) {
  const isClient = useIsClient();
  const [decision, setDecision] = useState<Decision | null>(null);

  // A new flash arrived (or the first one, once we are on the client): decide
  // whether it has already been shown in this tab. Adjusting state during
  // render like this is the React-sanctioned way to derive state from props.
  if (isClient && flash && decision?.at !== flash.at) {
    setDecision({ at: flash.at, show: !readShown().includes(flash.at) });
  }

  useEffect(() => {
    if (decision?.show) rememberShown(decision.at);
  }, [decision]);

  const visible = decision?.show && flash && flash.at === decision.at ? flash : decision?.show ? lastFlash(flash, decision) : null;
  if (!visible) return null;

  return (
    <div className={`flash flash--${visible.kind}`} role="status" aria-live="polite">
      <span>{visible.message}</span>
      <button
        type="button"
        className="flash__close"
        aria-label="Dismiss message"
        onClick={() => setDecision({ at: visible.at, show: false })}
      >
        ×
      </button>
    </div>
  );
}

/**
 * When the server re-renders us with `flash = null` (e.g. after a cookie
 * change) we keep showing the message we decided on, so remember its content.
 */
const remembered = new Map<number, Flash>();
function lastFlash(flash: Flash | null, decision: Decision): Flash | null {
  if (flash) remembered.set(flash.at, flash);
  return remembered.get(decision.at) ?? null;
}
