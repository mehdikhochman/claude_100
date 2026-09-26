import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getScoresForUsers } from "@/lib/score";
import { formatSessionTime } from "@/lib/time";
import { AvatarImage } from "@/components/avatar-image";
import { SpotsBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Who's coming" };

export default async function SessionMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(`/sessions/${id}/members`);

  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      startsAt: true,
      coachName: true,
      capacity: true,
      bookedCount: true,
      class: { select: { name: true, durationMinutes: true } },
      bookings: {
        where: { status: "CONFIRMED" },
        orderBy: { createdAt: "asc" },
        select: { userId: true, user: { select: { id: true, name: true, isPublic: true } } },
      },
    },
  });
  if (!session) notFound();

  // Only people in the session (or the studio team) may see the list.
  const isAttending = session.bookings.some((b) => b.userId === viewer.id);
  if (!isAttending && viewer.role !== "ADMIN") {
    return (
      <div className="container container--narrow error-page">
        <span className="eyebrow eyebrow--clay">Members only</span>
        <h1 style={{ fontSize: "2.4rem" }}>Book this session to see who&apos;s coming.</h1>
        <p className="lede" style={{ marginInline: "auto" }}>
          The attendee list is shared with people in the class.
        </p>
        <Link href="/schedule" className="btn">
          Back to the schedule
        </Link>
      </div>
    );
  }

  const scores = await getScoresForUsers(session.bookings.map((b) => b.userId));

  return (
    <div className="container container--medium">
      <div className="page-head">
        <span className="eyebrow">Who&apos;s coming</span>
        <h1>{session.class.name}</h1>
        <p className="lede">
          {formatSessionTime(session.startsAt)} · with {session.coachName} · {session.class.durationMinutes} min
        </p>
        <SpotsBadge capacity={session.capacity} bookedCount={session.bookedCount} />
      </div>

      <ul className="list" aria-label="Attendees">
        {session.bookings.map((b) => {
          const score = scores.get(b.userId)!;
          return (
            <li key={b.userId} className="item">
              <div className="member-row item__main">
                <AvatarImage userId={b.user.id} name={b.user.name} />
                <div>
                  <Link href={`/profile/${b.user.id}`} style={{ fontWeight: 500 }}>
                    {b.user.name}
                    {b.user.id === viewer.id ? " (you)" : ""}
                  </Link>
                  <div className="small muted">{score.points} points</div>
                </div>
              </div>
              <div className="item__aside">
                <span className="badge badge--tier">{score.tier.name}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6">
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
    </div>
  );
}
