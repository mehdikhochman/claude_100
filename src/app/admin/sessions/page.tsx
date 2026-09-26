import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatSessionTime } from "@/lib/time";
import { deleteSessionAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";
import { SpotsBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Sessions · Admin" };

type Filter = "upcoming" | "past";

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = rawFilter === "past" ? "past" : "upcoming";
  const now = new Date();

  const sessions = await prisma.session.findMany({
    where: filter === "upcoming" ? { startsAt: { gte: now } } : { startsAt: { lt: now } },
    orderBy: { startsAt: filter === "upcoming" ? "asc" : "desc" },
    take: 200,
    include: {
      class: { select: { name: true, isArchived: true } },
      _count: { select: { bookings: { where: { status: "WAITLISTED" } } } },
    },
  });

  return (
    <div>
      <div className="page-head section-head">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Sessions</h1>
        </div>
        <Link href="/admin/sessions/new" className="btn">
          New session
        </Link>
      </div>

      <div className="row row--between mb-4">
        <nav className="filter-tabs" aria-label="Filter sessions">
          <Link href="/admin/sessions" aria-current={filter === "upcoming" ? "page" : undefined}>
            Upcoming
          </Link>
          <Link href="/admin/sessions?filter=past" aria-current={filter === "past" ? "page" : undefined}>
            Past
          </Link>
        </nav>
        <span className="small muted">Sessions cannot be cancelled — only edited or deleted.</span>
      </div>

      {sessions.length === 0 ? (
        <div className="empty">No {filter} sessions.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Class</th>
                <th scope="col">Coach</th>
                <th scope="col">Spots</th>
                <th scope="col" className="num">
                  Waitlist
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="nowrap">
                    <Link href={`/admin/sessions/${s.id}`}>{formatSessionTime(s.startsAt)}</Link>
                  </td>
                  <td>
                    {s.class.name}
                    {s.class.isArchived ? <span className="badge badge--muted" style={{ marginLeft: 8 }}>Archived class</span> : null}
                  </td>
                  <td>{s.coachName}</td>
                  <td className="nowrap">
                    <span className="tabular">
                      {s.bookedCount}/{s.capacity}
                    </span>{" "}
                    <SpotsBadge capacity={s.capacity} bookedCount={s.bookedCount} />
                  </td>
                  <td className="num">{s._count.bookings}</td>
                  <td>
                    <div className="actions">
                      <Link href={`/admin/sessions/${s.id}`} className="btn btn--ghost btn--small">
                        Members
                      </Link>
                      <Link href={`/admin/sessions/${s.id}/edit`} className="btn btn--ghost btn--small">
                        Edit
                      </Link>
                      <ConfirmForm
                        action={deleteSessionAction}
                        message={`Delete this ${s.class.name} session on ${formatSessionTime(s.startsAt)}? All ${s.bookedCount} bookings on it will be removed. This cannot be undone.`}
                      >
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton className="btn btn--danger btn--small" pendingLabel="Deleting…">
                          Delete
                        </SubmitButton>
                      </ConfirmForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
