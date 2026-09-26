import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { setClassArchivedAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";

export const metadata: Metadata = { title: "Classes · Admin" };

export default async function AdminClassesPage() {
  const classes = await prisma.studioClass.findMany({
    orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { sessions: { where: { startsAt: { gte: new Date() } } } } } },
  });

  return (
    <div>
      <div className="page-head section-head">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Classes</h1>
        </div>
        <Link href="/admin/classes/new" className="btn">
          New class
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="empty">No classes yet. Create the first one.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Type · Level</th>
                <th scope="col" className="num">
                  Minutes
                </th>
                <th scope="col" className="num">
                  Upcoming
                </th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div className="small muted" style={{ maxWidth: "36ch" }}>
                      {c.description.length > 90 ? c.description.slice(0, 90) + "…" : c.description}
                    </div>
                  </td>
                  <td className="nowrap">
                    {c.type} · {c.level}
                  </td>
                  <td className="num">{c.durationMinutes}</td>
                  <td className="num">{c._count.sessions}</td>
                  <td>{c.isArchived ? <span className="badge badge--muted">Archived</span> : <span className="badge badge--success">Active</span>}</td>
                  <td>
                    <div className="actions">
                      <Link href={`/admin/classes/${c.id}/edit`} className="btn btn--ghost btn--small">
                        Edit
                      </Link>
                      <ConfirmForm
                        action={setClassArchivedAction}
                        message={c.isArchived ? `Offer “${c.name}” again?` : `Archive “${c.name}”? Members won't see it or its sessions any more.`}
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="archived" value={c.isArchived ? "false" : "true"} />
                        <SubmitButton className={`btn btn--small ${c.isArchived ? "btn--secondary" : "btn--danger"}`} pendingLabel="…">
                          {c.isArchived ? "Unarchive" : "Archive"}
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
