import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getScoreForUser } from "@/lib/score";
import { formatDateTime, formatSessionTime } from "@/lib/time";
import { AvatarImage } from "@/components/avatar-image";
import { ScoreCard } from "@/components/score-card";
import { StatusBadge } from "@/components/status-badge";
import { PaidToggle } from "@/components/admin/paid-toggle";

export const metadata: Metadata = { title: "Member · Admin" };

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isPublic: true,
      createdAt: true,
      bookings: {
        orderBy: { session: { startsAt: "desc" } },
        include: { session: { include: { class: { select: { name: true } } } } },
      },
    },
  });
  if (!member) notFound();

  const score = await getScoreForUser(member.id);
  const returnTo = `/admin/members/${member.id}`;
  const now = new Date();

  return (
    <div>
      <div className="page-head profile-head">
        <AvatarImage userId={member.id} name={member.name} size="lg" />
        <div>
          <span className="eyebrow">Member</span>
          <h1 style={{ marginBottom: 4 }}>{member.name}</h1>
          <p className="muted mb-0 small">
            {member.email}
            {member.phone ? ` · ${member.phone}` : ""} · joined {formatDateTime(member.createdAt)}
            {member.role === "ADMIN" ? " · Admin" : ""}
            {!member.isPublic ? " · Private profile" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid--3" style={{ alignItems: "start" }}>
        <section style={{ gridColumn: "span 2" }} aria-labelledby="member-bookings">
          <h2 id="member-bookings" className="day-group__title">
            Bookings ({member.bookings.length})
          </h2>
          {member.bookings.length === 0 ? (
            <p className="muted small">No bookings yet.</p>
          ) : (
            <ul className="list">
              {member.bookings.map((b) => (
                <li key={b.id} className="item">
                  <div className="item__main">
                    <h3 className="item__title" style={{ fontSize: "1.15rem" }}>
                      <Link href={`/admin/sessions/${b.sessionId}`}>{b.session.class.name}</Link>
                    </h3>
                    <div className="item__meta">
                      {formatSessionTime(b.session.startsAt)} · {b.session.coachName}
                      {b.session.startsAt < now ? " · past" : ""}
                    </div>
                  </div>
                  <div className="item__aside">
                    <StatusBadge status={b.status} />
                    {b.status === "CONFIRMED" ? (
                      <>
                        {b.isPaid ? <span className="badge badge--success">Paid</span> : <span className="badge badge--warn">Not paid</span>}
                        <PaidToggle bookingId={b.id} isPaid={b.isPaid} returnTo={returnTo} />
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <ScoreCard score={score} forest title="LEGACY score" />
      </div>
    </div>
  );
}
