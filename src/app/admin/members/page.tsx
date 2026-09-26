import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getScoresForUsers } from "@/lib/score";
import { formatDateTime } from "@/lib/time";
import { AvatarImage } from "@/components/avatar-image";

export const metadata: Metadata = { title: "Members · Admin" };

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const now = new Date();

  const members = await prisma.user.findMany({
    where: query
      ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isPublic: true,
      createdAt: true,
      _count: {
        select: {
          bookings: { where: { status: "CONFIRMED", isPaid: false, session: { startsAt: { gte: now } } } },
        },
      },
    },
  });
  const scores = await getScoresForUsers(members.map((m) => m.id));

  return (
    <div>
      <div className="page-head section-head">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Members</h1>
        </div>
        <form action="/admin/members" className="row" role="search">
          <label className="sr-only" htmlFor="q">
            Search members
          </label>
          <input id="q" name="q" className="input" placeholder="Search name, email, phone" defaultValue={query} style={{ width: "min(320px, 70vw)" }} />
          <button type="submit" className="btn btn--secondary">
            Search
          </button>
        </form>
      </div>

      {members.length === 0 ? (
        <div className="empty">No members match.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Contact</th>
                <th scope="col">LEGACY score</th>
                <th scope="col" className="num">
                  Unpaid upcoming
                </th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const score = scores.get(m.id)!;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="member-row">
                        <AvatarImage userId={m.id} name={m.name} size="sm" />
                        <div>
                          <Link href={`/admin/members/${m.id}`} style={{ fontWeight: 500 }}>
                            {m.name}
                          </Link>
                          {m.role === "ADMIN" ? <span className="badge badge--admin" style={{ marginLeft: 8 }}>Admin</span> : null}
                          {!m.isPublic ? <span className="badge badge--muted" style={{ marginLeft: 8 }}>Private</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="small">
                      {m.email}
                      {m.phone ? <div className="muted">{m.phone}</div> : null}
                    </td>
                    <td className="nowrap">
                      <strong className="tabular">{score.points}</strong> <span className="badge badge--tier">{score.tier.name}</span>
                    </td>
                    <td className="num">{m._count.bookings > 0 ? <span className="badge badge--warn">{m._count.bookings}</span> : "0"}</td>
                    <td className="nowrap small muted">{formatDateTime(m.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
