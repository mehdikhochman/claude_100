import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTime, formatSessionTime } from "@/lib/time";
import { StatusBadge } from "@/components/status-badge";
import { PaidToggle } from "@/components/admin/paid-toggle";

export const metadata: Metadata = { title: "Bookings · Admin" };

type Filter = "upcoming" | "cancelled" | "unpaid" | "all";

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: raw } = await searchParams;
  const filter: Filter = raw === "cancelled" || raw === "all" || raw === "unpaid" ? raw : "upcoming";
  const now = new Date();

  const where: Prisma.BookingWhereInput =
    filter === "upcoming"
      ? { status: { in: ["CONFIRMED", "WAITLISTED"] }, session: { startsAt: { gte: now } } }
      : filter === "cancelled"
        ? { status: "CANCELLED" }
        : filter === "unpaid"
          ? { status: "CONFIRMED", isPaid: false, session: { startsAt: { gte: now } } }
          : {};

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: filter === "cancelled" || filter === "all" ? { createdAt: "desc" } : { session: { startsAt: "asc" } },
    take: 300,
    include: {
      user: { select: { id: true, name: true } },
      session: { include: { class: { select: { name: true } } } },
    },
  });

  const returnTo = `/admin/bookings${filter === "upcoming" ? "" : `?filter=${filter}`}`;

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">Admin</span>
        <h1>Bookings</h1>
      </div>

      <nav className="filter-tabs mb-4" aria-label="Filter bookings">
        {(["upcoming", "cancelled", "unpaid", "all"] as Filter[]).map((f) => (
          <Link key={f} href={f === "upcoming" ? "/admin/bookings" : `/admin/bookings?filter=${f}`} aria-current={filter === f ? "page" : undefined}>
            {f === "upcoming" ? "Upcoming" : f === "cancelled" ? "Cancelled" : f === "unpaid" ? "Unpaid" : "All"}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <div className="empty">No bookings here.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Session</th>
                <th scope="col">Status</th>
                <th scope="col">Cash</th>
                <th scope="col">Booked on</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/admin/members/${b.user.id}`}>{b.user.name}</Link>
                  </td>
                  <td>
                    <Link href={`/admin/sessions/${b.sessionId}`}>{b.session.class.name}</Link>
                    <div className="small muted nowrap">{formatSessionTime(b.session.startsAt)}</div>
                  </td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td>
                    {b.status === "CONFIRMED" ? (
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        {b.isPaid ? <span className="badge badge--success">Paid</span> : <span className="badge badge--warn">Not paid</span>}
                        <PaidToggle bookingId={b.id} isPaid={b.isPaid} returnTo={returnTo} />
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="nowrap small muted">{formatDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
