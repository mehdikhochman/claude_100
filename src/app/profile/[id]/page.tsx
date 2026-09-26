import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getScoreForUser } from "@/lib/score";
import { formatDayLong } from "@/lib/time";
import { AvatarImage } from "@/components/avatar-image";
import { ScoreCard } from "@/components/score-card";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: user ? `${user.name}` : "Member" };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [viewer, user] = await Promise.all([
    getCurrentUser(),
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, isPublic: true, createdAt: true, role: true },
    }),
  ]);
  if (!user) notFound();

  const score = await getScoreForUser(user.id);
  const isSelf = viewer?.id === user.id;
  const showDetails = user.isPublic || isSelf || viewer?.role === "ADMIN";

  // Upcoming sessions count is a "detail": only for public profiles.
  const upcomingCount = showDetails
    ? await prisma.booking.count({ where: { userId: user.id, status: "CONFIRMED", session: { startsAt: { gt: new Date() } } } })
    : null;

  return (
    <div className="container container--medium">
      <div className="page-head profile-head">
        {viewer ? (
          <AvatarImage userId={user.id} name={user.name} size="xl" />
        ) : (
          <div className="avatar avatar--xl" aria-hidden="true" style={{ display: "grid", placeItems: "center", background: "var(--forest)", color: "#fff", fontFamily: "var(--font-heading)", fontSize: "3rem" }}>
            {user.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
          </div>
        )}
        <div>
          <span className="eyebrow">Member</span>
          <h1 style={{ marginBottom: "8px" }}>
            {user.name}
            {isSelf ? <span className="muted"> (you)</span> : null}
          </h1>
          {showDetails ? (
            <p className="muted mb-0">
              Member since {formatDayLong(user.createdAt)}
              {upcomingCount !== null ? ` · ${upcomingCount} upcoming ${upcomingCount === 1 ? "session" : "sessions"}` : ""}
            </p>
          ) : (
            <p className="muted mb-0">This member keeps their profile private. Their LEGACY score is still public.</p>
          )}
        </div>
      </div>

      <div className="grid grid--2">
        <ScoreCard score={score} forest title={isSelf ? "Your LEGACY score" : "LEGACY score"} />
        {isSelf ? (
          <div className="card card--tight">
            <span className="eyebrow">This is what others see</span>
            <p className="small mb-2">Change your photo, name or privacy from your profile settings.</p>
            <Link href="/profile" className="btn btn--secondary btn--small">
              Edit profile
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
