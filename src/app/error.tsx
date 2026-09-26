"use client";
// Friendly error boundary for anything unexpected in a page.
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container error-page">
      <span className="eyebrow eyebrow--clay">Something went wrong</span>
      <h1>Let&apos;s take a breath.</h1>
      <p className="lede" style={{ marginInline: "auto" }}>
        An unexpected error happened on our side. Nothing was booked or cancelled by mistake — please try again.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: "24px" }}>
        <button type="button" className="btn" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn btn--ghost">
          Home
        </Link>
      </div>
      {error.digest ? <p className="small muted mt-4">Reference: {error.digest}</p> : null}
    </div>
  );
}
