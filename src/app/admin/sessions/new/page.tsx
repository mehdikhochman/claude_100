import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getStudioTimezone } from "@/lib/env";
import { SessionForm } from "../session-form";

export const metadata: Metadata = { title: "New session · Admin" };

export default async function NewSessionPage() {
  const classes = await prisma.studioClass.findMany({ where: { isArchived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, isArchived: true } });
  return (
    <div className="container--narrow" style={{ marginInline: 0 }}>
      <div className="page-head">
        <span className="eyebrow">Sessions</span>
        <h1>New session</h1>
      </div>
      <div className="card">
        <SessionForm classes={classes} timezone={getStudioTimezone()} />
      </div>
    </div>
  );
}
