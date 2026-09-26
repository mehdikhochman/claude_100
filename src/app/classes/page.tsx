import type { Metadata } from "next";
import Link from "next/link";
import { getActiveClasses } from "@/lib/queries";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const classes = await getActiveClasses();
  return (
    <div className="container">
      <div className="page-head">
        <span className="eyebrow">Our classes</span>
        <h1>Find your practice</h1>
        <p className="lede">Every class runs in small groups so the coach can see you. Pick one, or mix all three.</p>
      </div>

      {classes.length === 0 ? (
        <div className="empty">No classes are offered at the moment.</div>
      ) : (
        <div className="grid grid--3">
          {classes.map((c) => (
            <article key={c.id} className="card">
              <div className="class-card__badge-row">
                <span className="badge badge--muted">{c.type}</span>
                <span className="badge badge--muted">{c.level}</span>
              </div>
              <h2 className="card__title" style={{ fontSize: "1.8rem" }}>
                {c.name}
              </h2>
              <p className="card__meta">{c.durationMinutes} minutes</p>
              <p>{c.description}</p>
              <div className="card__foot">
                <Link href="/schedule" className="btn btn--secondary btn--small">
                  See sessions
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
