import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClassForm } from "../../class-form";

export const metadata: Metadata = { title: "Edit class · Admin" };

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.studioClass.findUnique({ where: { id } });
  if (!c) notFound();

  return (
    <div className="container--narrow" style={{ marginInline: 0 }}>
      <div className="page-head">
        <span className="eyebrow">Classes</span>
        <h1>Edit {c.name}</h1>
        {c.isArchived ? <span className="badge badge--muted">Archived</span> : null}
      </div>
      <div className="card">
        <ClassForm initial={{ id: c.id, name: c.name, type: c.type, durationMinutes: c.durationMinutes, level: c.level, description: c.description }} />
      </div>
    </div>
  );
}
