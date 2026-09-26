import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <div className="container error-page">
      <span className="eyebrow eyebrow--clay">403</span>
      <h1>Members only, this way.</h1>
      <p className="lede" style={{ marginInline: "auto" }}>
        That page is reserved for the studio team. Your bookings are waiting on your dashboard.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: "24px" }}>
        <Link href="/dashboard" className="btn">
          Go to my dashboard
        </Link>
        <Link href="/" className="btn btn--ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
