// Admin audit log: who did what, when. Written from admin Server Actions.
import type { Prisma } from "@/generated/prisma/client";
import { prisma as defaultPrisma, type PrismaClient } from "./db";

export type AuditAction =
  | "class.create"
  | "class.update"
  | "class.archive"
  | "class.unarchive"
  | "session.create"
  | "session.update"
  | "session.delete"
  | "booking.markPaid"
  | "booking.markUnpaid";

export type AuditTargetType = "StudioClass" | "Session" | "Booking" | "User";

export async function recordAudit(
  entry: {
    actorId: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string | null;
    details?: Record<string, unknown>;
  },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Human wording for the audit log table. */
export function describeAudit(action: string, details: unknown): string {
  const d = (details ?? {}) as Record<string, unknown>;
  const name = typeof d.name === "string" ? `“${d.name}”` : "";
  const member = typeof d.memberName === "string" ? d.memberName : "a member";
  switch (action) {
    case "class.create":
      return `Created class ${name}`;
    case "class.update":
      return `Edited class ${name}`;
    case "class.archive":
      return `Archived class ${name}`;
    case "class.unarchive":
      return `Restored class ${name}`;
    case "session.create":
      return `Created session ${name}${typeof d.startsAt === "string" ? ` on ${d.startsAt}` : ""}`;
    case "session.update":
      return `Edited session ${name}${typeof d.startsAt === "string" ? ` on ${d.startsAt}` : ""}`;
    case "session.delete":
      return `Deleted session ${name}${typeof d.startsAt === "string" ? ` on ${d.startsAt}` : ""}${
        typeof d.bookings === "number" ? ` (${d.bookings} bookings removed)` : ""
      }`;
    case "booking.markPaid":
      return `Marked ${member} as paid${name ? ` for ${name}` : ""}`;
    case "booking.markUnpaid":
      return `Marked ${member} as not paid${name ? ` for ${name}` : ""}`;
    default:
      return action;
  }
}
