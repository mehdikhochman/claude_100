import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getBookingsForUser } from "@/lib/queries";
import { formatSessionTime, formatDateTime } from "@/lib/time";
import { StatusBadge, PaidBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "My bookings" };

export default async function BookingsPage() {
  const user = await requireUser("/bookings");
  const bookings = await getBookingsForUser(user.id);
  const now = new Date();

  // Soonest upcoming first, then history newest first.
  const upcoming = bookings.filter((b) => b.session.startsAt > now);
  const past = bookings.filter((b) => b.session.startsAt <= now).reverse();

  return (
    <div className="container container--medium">
      <div className="page-head">
        <span className="eyebrow">History</span>
        <h1>My bookings</h1>
        <p className="lede">Every session you&apos;ve booked, waitlisted or cancelled.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="empty">
          You haven&apos;t booked anything yet. <Link href="/schedule">See the schedule</Link>.
        </div>
      ) : (
        <>
          <Section title="Upcoming" rows={upcoming} emptyText="Nothing upcoming." />
          <Section title="Past" rows={past} emptyText="No past sessions yet." />
        </>
      )}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof getBookingsForUser>>[number];

function Section({ title, rows, emptyText }: { title: string; rows: Row[]; emptyText: string }) {
  return (
    <section className="section mt-0" aria-label={title}>
      <h2 className="day-group__title">{title}</h2>
      {rows.length === 0 ? (
        <p className="muted small">{emptyText}</p>
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">When</th>
                <th scope="col">Status</th>
                <th scope="col">Payment</th>
                <th scope="col">Booked on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td data-label="Session">
                    <strong>{b.session.class.name}</strong>
                    <div className="small muted">with {b.session.coachName}</div>
                  </td>
                  <td className="nowrap" data-label="When">{formatSessionTime(b.session.startsAt)}</td>
                  <td data-label="Status">
                    <StatusBadge status={b.status} />
                  </td>
                  <td data-label="Payment">{b.status === "CONFIRMED" ? <PaidBadge isPaid={b.isPaid} /> : <span className="muted">—</span>}</td>
                  <td className="nowrap small muted" data-label="Booked">{formatDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
