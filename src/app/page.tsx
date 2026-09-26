import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveClasses, getUpcomingSessions } from "@/lib/queries";
import { SessionList } from "@/components/session-list";

const MARQUEE_ITEMS = [
  "Pilates",
  "Hot Mat Pilates",
  "Run Club",
  "Abidjan",
  "Small groups",
  "Breathe · Align · Move",
  "Cash at the studio",
  "Every level welcome",
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const [classes, sessions] = await Promise.all([getActiveClasses(), getUpcomingSessions({ viewerId: user?.id, limit: 4 })]);

  return (
    <>
      <section className="container hero" aria-labelledby="hero-title">
        <span className="eyebrow eyebrow--clay">A movement studio in Abidjan</span>
        <h1 id="hero-title">
          Movement, <em>refined.</em>
        </h1>
        <p className="lede">
          Pilates, Hot Mat Pilates and Run Club in small, unhurried groups. Book a spot in seconds, pay in cash at the
          studio.
        </p>
        <div className="hero__actions">
          <Link href="/schedule" className="btn">
            See the schedule
          </Link>
          {user ? (
            <Link href="/dashboard" className="btn btn--ghost">
              My dashboard
            </Link>
          ) : (
            <Link href="/register" className="btn btn--ghost">
              Create an account
            </Link>
          )}
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="marquee__item">
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className="container section" aria-labelledby="classes-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">What we teach</span>
            <h2 id="classes-title">Three ways to move</h2>
          </div>
          <Link href="/classes">All classes →</Link>
        </div>
        <div className="grid grid--3">
          {classes.map((c) => (
            <article key={c.id} className="card">
              <div className="class-card__badge-row">
                <span className="badge badge--muted">{c.type}</span>
                <span className="badge badge--muted">{c.level}</span>
              </div>
              <h3 className="card__title">{c.name}</h3>
              <p className="card__meta">{c.durationMinutes} minutes</p>
              <p className="mb-0">{c.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section">
        <figure className="quote">
          <blockquote>“Strength is quiet. It shows up as the ease with which you carry yourself out the door.”</blockquote>
          <figcaption>
            <cite>— Maya, founder &amp; head coach</cite>
          </figcaption>
        </figure>
      </section>

      <section className="container section" aria-labelledby="next-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">Coming up</span>
            <h2 id="next-title">Next sessions</h2>
          </div>
          <Link href="/schedule">Full schedule →</Link>
        </div>
        <SessionList sessions={sessions} viewerId={user?.id ?? null} returnTo="/" />
      </section>

      {!user ? (
        <section className="container section">
          <div className="cta">
            <span className="eyebrow eyebrow--clay">Join LEGACY</span>
            <h2>Your first session is a sign-up away.</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              No memberships, no credits. Create an account, book what suits you, pay when you arrive.
            </p>
            <Link href="/register" className="btn">
              Create your account
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
