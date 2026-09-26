"use client";
// Shows a one-shot flash message and clears the cookie once displayed.
import { useEffect, useState } from "react";
import type { Flash } from "@/lib/flash";
import { clearFlashAction } from "@/lib/flash-actions";

export function FlashMessage({ flash }: { flash: Flash | null }) {
  const [visible, setVisible] = useState(Boolean(flash));

  useEffect(() => {
    if (flash) void clearFlashAction();
  }, [flash]);

  if (!flash || !visible) return null;

  return (
    <div className={`flash flash--${flash.kind}`} role="status" aria-live="polite">
      <span>{flash.message}</span>
      <button
        type="button"
        className="flash__close"
        aria-label="Dismiss message"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  );
}
