import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { describeAudit } from "@/lib/audit";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit log · Admin" };

export default async function AdminAuditPage() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { id: true, name: true } } },
  });

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">Admin</span>
        <h1>Audit log</h1>
        <p className="lede">Who changed what in the admin area. The 200 most recent entries.</p>
      </div>

      {entries.length === 0 ? (
        <div className="empty">Nothing recorded yet. Admin actions will appear here.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">What</th>
                <th scope="col">Type</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap small muted">{formatDateTime(e.createdAt)}</td>
                  <td>{e.actor ? <Link href={`/admin/members/${e.actor.id}`}>{e.actor.name}</Link> : <span className="muted">Deleted admin</span>}</td>
                  <td>{describeAudit(e.action, e.details)}</td>
                  <td>
                    <span className="badge badge--muted">{e.action}</span>
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
