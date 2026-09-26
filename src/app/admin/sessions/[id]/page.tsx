import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatSessionTime, formatDateTime } from "@/lib/time";
import { getScoresForUsers } from "@/lib/score";
import { AvatarImage } from "@/components/avatar-image";
import { PaidToggle } from "@/components/admin/paid-toggle";
import { SpotsBadge, StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Session · Admin" };

export default async function AdminSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      class: { select: { name: true, durationMinutes: true } },
      bookings: {
        where: { status: { in: ["CONFIRMED", "WAITLISTED"] } },
        orderBy: [{ status: "asc" }, { waitlistedAt: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      },
    },
  });
  if (!session) notFound();

  const confirmed = session.bookings.filter((b) => b.status === "CONFIRMED");
  const waitlisted = session.bookings.filter((b) => b.status === "WAITLISTED");
  const scores = await getScoresForUsers(session.bookings.map((b) => b.userId));
  const returnTo = `/admin/sessions/${session.id}`;
  const unpaid = confirmed.filter((b) => !b.isPaid).length;

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">Session</span>
        <h1>{session.class.name}</h1>
        <p className="lede">
          {formatSessionTime(session.startsAt)} · with {session.coachName} · {session.class.durationMinutes} min
        </p>
        <div className="row">
          <SpotsBadge capacity={session.capacity} bookedCount={session.bookedCount} />
          <span className="badge badge--muted">
            {session.bookedCount}/{session.capacity} booked
          </span>
          {unpaid > 0 ? <span className="badge badge--warn">{unpaid} unpaid</span> : <span className="badge badge--success">All paid</span>}
          <Link href={`/admin/sessions/${session.id}/edit`} className="btn btn--ghost btn--small">
            Edit session
          </Link>
        </div>
      </div>

      <section aria-labelledby="confirmed-title" className="mb-6">
        <h2 id="confirmed-title" className="day-group__title">
          Confirmed ({confirmed.length})
        </h2>
        {confirmed.length === 0 ? (
          <p className="muted small">Nobody has booked yet.</p>
        ) : (
          <ul className="list">
            {confirmed.map((b) => (
              <li key={b.id} className="item">
                <div className="member-row item__main">
                  <AvatarImage userId={b.user.id} name={b.user.name} />
                  <div>
                    <Link href={`/admin/members/${b.user.id}`} style={{ fontWeight: 500 }}>
                      {b.user.name}
                    </Link>
                    <div className="small muted">
                      {b.user.email}
                      {b.user.phone ? ` · ${b.user.phone}` : ""} · {scores.get(b.userId)?.tier.name}
                      {b.promotedAt ? " · from waitlist" : ""}
                    </div>
                  </div>
                </div>
                <div className="item__aside">
                  {b.isPaid ? <span className="badge badge--success">Paid</span> : <span className="badge badge--warn">Not paid</span>}
                  <PaidToggle bookingId={b.id} isPaid={b.isPaid} returnTo={returnTo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="waitlist-title">
        <h2 id="waitlist-title" className="day-group__title">
          Waitlist ({waitlisted.length})
        </h2>
        {waitlisted.length === 0 ? (
          <p className="muted small">The waitlist is empty.</p>
        ) : (
          <ol className="list">
            {waitlisted.map((b, i) => (
              <li key={b.id} className="item">
                <div className="member-row item__main">
                  <span className="time-pill" style={{ fontSize: "1.2rem" }}>
                    #{i + 1}
                  </span>
                  <div>
                    <Link href={`/admin/members/${b.user.id}`} style={{ fontWeight: 500 }}>
                      {b.user.name}
                    </Link>
                    <div className="small muted">joined {b.waitlistedAt ? formatDateTime(b.waitlistedAt) : "—"}</div>
                  </div>
                </div>
                <div className="item__aside">
                  <StatusBadge status="WAITLISTED" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
