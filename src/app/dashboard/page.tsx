import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getBookingsForUser, type MemberBooking } from "@/lib/queries";
import { getScoreForUser } from "@/lib/score";
import { isCancellable } from "@/lib/booking";
import { cancelAction, dismissPromotionAction } from "@/lib/booking-actions";
import { formatSessionTime } from "@/lib/time";
import { ScoreCard } from "@/components/score-card";
import { StatusBadge, PaidBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const now = new Date();
  const [bookings, score] = await Promise.all([getBookingsForUser(user.id), getScoreForUser(user.id)]);

  const upcoming = bookings.filter((b) => b.status === "CONFIRMED" && b.session.startsAt > now);
  const waitlisted = bookings.filter((b) => b.status === "WAITLISTED" && b.session.startsAt > now);
  const cancelled = bookings.filter((b) => b.status === "CANCELLED");
  const promotions = upcoming.filter((b) => b.promotedAt && !b.promotionSeenAt);

  return (
    <div className="container">
      <div className="page-head">
        <span className="eyebrow">Dashboard</span>
        <h1>Hello, {user.name.split(" ")[0]}.</h1>
        <p className="lede">
          {upcoming.length === 0
            ? "Nothing booked yet — the schedule is waiting."
            : `You have ${upcoming.length} upcoming ${upcoming.length === 1 ? "session" : "sessions"}.`}
        </p>
      </div>

      {promotions.map((b) => (
        <div key={b.id} className="notice notice--promoted mb-6" role="status">
          <span className="eyebrow">Good news</span>
          <h3>You&apos;re in! A spot opened up in {b.session.class.name}.</h3>
          <p className="mb-0">{formatSessionTime(b.session.startsAt)} with {b.session.coachName}. We moved you off the waitlist.</p>
          <form action={dismissPromotionAction}>
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="returnTo" value="/dashboard" />
            <SubmitButton className="btn btn--small" pendingLabel="…">
              Got it
            </SubmitButton>
          </form>
        </div>
      ))}

      <div className="grid grid--3" style={{ alignItems: "start" }}>
        <div style={{ gridColumn: "span 2" }} className="stack">
          <section aria-labelledby="upcoming-title">
            <div className="section-head">
              <h2 id="upcoming-title" style={{ fontSize: "1.8rem" }}>
                Upcoming
              </h2>
              <Link href="/schedule" className="btn btn--secondary btn--small">
                Book another
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="empty">
                No upcoming bookings. <Link href="/schedule">Browse the schedule</Link>.
              </div>
            ) : (
              <ul className="list">
                {upcoming.map((b) => (
                  <BookingItem key={b.id} booking={b} now={now} />
                ))}
              </ul>
            )}
          </section>

          {waitlisted.length > 0 ? (
            <section aria-labelledby="waitlist-title">
              <h2 id="waitlist-title" style={{ fontSize: "1.8rem" }}>
                On the waitlist
              </h2>
              <ul className="list">
                {waitlisted.map((b) => (
                  <BookingItem key={b.id} booking={b} now={now} />
                ))}
              </ul>
            </section>
          ) : null}

          {cancelled.length > 0 ? (
            <section aria-labelledby="cancelled-title">
              <h2 id="cancelled-title" style={{ fontSize: "1.8rem" }}>
                Cancelled
              </h2>
              <ul className="list">
                {cancelled.map((b) => (
                  <BookingItem key={b.id} booking={b} now={now} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="stack">
          <ScoreCard score={score} forest />
          <div className="card card--tight">
            <span className="eyebrow">Good to know</span>
            <p className="small mb-0">
              Pay in cash when you arrive. Cancellations are free up to 2 hours before the session; after that the spot
              stays yours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingItem({ booking: b, now }: { booking: MemberBooking; now: Date }) {
  const upcoming = b.session.startsAt > now;
  const canCancel = b.status === "CONFIRMED" && isCancellable(b.session.startsAt, now);
  return (
    <li className="item">
      <div className="item__main">
        <h3 className="item__title">{b.session.class.name}</h3>
        <div className="item__meta">
          {formatSessionTime(b.session.startsAt)} · with {b.session.coachName} · {b.session.class.durationMinutes} min
        </div>
      </div>
      <div className="item__aside">
        <StatusBadge status={b.status} />
        {b.status === "CONFIRMED" ? <PaidBadge isPaid={b.isPaid} /> : null}
        {b.status === "CONFIRMED" && upcoming ? (
          <Link href={`/sessions/${b.session.id}/members`} className="btn btn--ghost btn--small">
            Who&apos;s coming
          </Link>
        ) : null}
        {canCancel ? (
          <ConfirmForm action={cancelAction} message="Cancel this booking? Your spot will go to the next person.">
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="returnTo" value="/dashboard" />
            <SubmitButton className="btn btn--danger btn--small" pendingLabel="Cancelling…">
              Cancel
            </SubmitButton>
          </ConfirmForm>
        ) : b.status === "CONFIRMED" && upcoming ? (
          <span className="small muted nowrap">Cancellation closed</span>
        ) : null}
        {b.status === "WAITLISTED" ? (
          <form action={cancelAction}>
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="returnTo" value="/dashboard" />
            <SubmitButton className="btn btn--ghost btn--small" pendingLabel="Leaving…">
              Leave waitlist
            </SubmitButton>
          </form>
        ) : null}
        {b.status === "CANCELLED" && upcoming ? (
          <Link href="/schedule" className="btn btn--secondary btn--small">
            Book again
          </Link>
        ) : null}
      </div>
    </li>
  );
}
