import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStudioTimezone } from "@/lib/env";
import { toDateTimeLocalValue } from "@/lib/time";
import { SessionForm } from "../../session-form";

export const metadata: Metadata = { title: "Edit session · Admin" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, classes] = await Promise.all([
    prisma.session.findUnique({ where: { id }, include: { class: { select: { name: true } } } }),
    prisma.studioClass.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, isArchived: true } }),
  ]);
  if (!session) notFound();

  return (
    <div className="container--narrow" style={{ marginInline: 0 }}>
      <div className="page-head">
        <span className="eyebrow">Sessions</span>
        <h1>Edit session</h1>
        <p className="muted mb-0">Raising the capacity lets waitlisted members in automatically.</p>
      </div>
      <div className="card">
        <SessionForm
          classes={classes}
          timezone={getStudioTimezone()}
          initial={{
            id: session.id,
            classId: session.classId,
            coachName: session.coachName,
            startsAt: toDateTimeLocalValue(session.startsAt),
            capacity: session.capacity,
            bookedCount: session.bookedCount,
          }}
        />
      </div>
    </div>
  );
}
