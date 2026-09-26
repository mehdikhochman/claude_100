"use server";
// Admin Server Actions: classes, sessions, cash validation.
// Every change is written to the audit log with who did it.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { recordAudit } from "@/lib/audit";
import { setFlash } from "@/lib/flash";
import { promoteWaitlistToCapacity } from "@/lib/booking";
import { formatSessionTime, parseDateTimeLocal } from "@/lib/time";
import { classSchema, sessionSchema } from "@/lib/validation/admin";
import { fieldErrors, formDataToObject } from "@/lib/validation/auth";

export type AdminFormState = { errors?: Record<string, string>; values?: Record<string, string> };

/** Every admin action starts here. Members are bounced to /access-denied. */
async function requireAdminActor() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnUrl=%2Fadmin");
  if (user.role !== "ADMIN") redirect("/access-denied");
  return user;
}

function refreshAdmin() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export async function createClassAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdminActor();
  const raw = formDataToObject(formData);
  const parsed = classSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const created = await prisma.studioClass.create({ data: parsed.data });
  await recordAudit({ actorId: admin.id, action: "class.create", targetType: "StudioClass", targetId: created.id, details: { name: created.name } });
  await setFlash("success", `Class “${created.name}” created.`);
  refreshAdmin();
  redirect("/admin/classes");
}

export async function updateClassAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdminActor();
  const raw = formDataToObject(formData);
  const id = z.string().min(1).safeParse(raw.id);
  const parsed = classSchema.safeParse(raw);
  if (!id.success) return { errors: { form: "Missing class id." }, values: raw };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const existing = await prisma.studioClass.findUnique({ where: { id: id.data } });
  if (!existing) return { errors: { form: "That class no longer exists." }, values: raw };

  const updated = await prisma.studioClass.update({ where: { id: id.data }, data: parsed.data });
  await recordAudit({
    actorId: admin.id,
    action: "class.update",
    targetType: "StudioClass",
    targetId: updated.id,
    details: { name: updated.name, before: pickClassFields(existing), after: pickClassFields(updated) },
  });
  await setFlash("success", `Class “${updated.name}” updated.`);
  refreshAdmin();
  redirect("/admin/classes");
}

export async function setClassArchivedAction(formData: FormData): Promise<void> {
  const admin = await requireAdminActor();
  const id = z.string().min(1).safeParse(formData.get("id"));
  const archive = formData.get("archived") === "true";
  if (!id.success) redirect("/admin/classes");

  const existing = await prisma.studioClass.findUnique({ where: { id: id.data } });
  if (!existing) {
    await setFlash("error", "That class no longer exists.");
    redirect("/admin/classes");
  }

  await prisma.studioClass.update({ where: { id: id.data }, data: { isArchived: archive } });
  await recordAudit({
    actorId: admin.id,
    action: archive ? "class.archive" : "class.unarchive",
    targetType: "StudioClass",
    targetId: id.data,
    details: { name: existing.name },
  });
  await setFlash("success", archive ? `“${existing.name}” archived. It is hidden from members.` : `“${existing.name}” is offered again.`);
  refreshAdmin();
  redirect("/admin/classes");
}

function pickClassFields(c: { name: string; type: string; durationMinutes: number; level: string; description: string }) {
  return { name: c.name, type: c.type, durationMinutes: c.durationMinutes, level: c.level, description: c.description };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSessionAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdminActor();
  const raw = formDataToObject(formData);
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const startsAt = parseDateTimeLocal(parsed.data.startsAt);
  if (!startsAt) return { errors: { startsAt: "Pick a valid date and time." }, values: raw };
  if (startsAt <= new Date()) return { errors: { startsAt: "New sessions must start in the future." }, values: raw };

  const studioClass = await prisma.studioClass.findUnique({ where: { id: parsed.data.classId } });
  if (!studioClass || studioClass.isArchived) return { errors: { classId: "Choose an active class." }, values: raw };

  const created = await prisma.session.create({
    data: { classId: studioClass.id, coachName: parsed.data.coachName, startsAt, capacity: parsed.data.capacity },
  });
  await recordAudit({
    actorId: admin.id,
    action: "session.create",
    targetType: "Session",
    targetId: created.id,
    details: { name: studioClass.name, startsAt: formatSessionTime(startsAt), capacity: created.capacity, coach: created.coachName },
  });
  await setFlash("success", `Session created: ${studioClass.name}, ${formatSessionTime(startsAt)}.`);
  refreshAdmin();
  redirect("/admin/sessions");
}

export async function updateSessionAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdminActor();
  const raw = formDataToObject(formData);
  const id = z.string().min(1).safeParse(raw.id);
  const parsed = sessionSchema.safeParse(raw);
  if (!id.success) return { errors: { form: "Missing session id." }, values: raw };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const startsAt = parseDateTimeLocal(parsed.data.startsAt);
  if (!startsAt) return { errors: { startsAt: "Pick a valid date and time." }, values: raw };

  const existing = await prisma.session.findUnique({ where: { id: id.data }, include: { class: true } });
  if (!existing) return { errors: { form: "That session no longer exists." }, values: raw };

  if (parsed.data.capacity < existing.bookedCount) {
    return {
      errors: { capacity: `${existing.bookedCount} members are already confirmed. Capacity can't go below that.` },
      values: raw,
    };
  }

  const studioClass = await prisma.studioClass.findUnique({ where: { id: parsed.data.classId } });
  if (!studioClass) return { errors: { classId: "Choose a class." }, values: raw };

  const updated = await prisma.session.update({
    where: { id: id.data },
    data: { classId: studioClass.id, coachName: parsed.data.coachName, startsAt, capacity: parsed.data.capacity },
  });

  // More room than before? Let waitlisted members in, earliest first.
  let promoted = 0;
  if (updated.capacity > existing.capacity) {
    promoted = (await promoteWaitlistToCapacity(updated.id)).length;
  }

  await recordAudit({
    actorId: admin.id,
    action: "session.update",
    targetType: "Session",
    targetId: updated.id,
    details: {
      name: studioClass.name,
      startsAt: formatSessionTime(updated.startsAt),
      before: { class: existing.class.name, startsAt: formatSessionTime(existing.startsAt), capacity: existing.capacity, coach: existing.coachName },
      after: { class: studioClass.name, startsAt: formatSessionTime(updated.startsAt), capacity: updated.capacity, coach: updated.coachName },
      promotedFromWaitlist: promoted,
    },
  });
  await setFlash(
    "success",
    `Session updated.${promoted > 0 ? ` ${promoted} waitlisted ${promoted === 1 ? "member was" : "members were"} given a spot.` : ""}`,
  );
  refreshAdmin();
  redirect("/admin/sessions");
}

export async function deleteSessionAction(formData: FormData): Promise<void> {
  const admin = await requireAdminActor();
  const id = z.string().min(1).safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/sessions");

  const existing = await prisma.session.findUnique({
    where: { id: id.data },
    include: { class: { select: { name: true } }, _count: { select: { bookings: true } } },
  });
  if (!existing) {
    await setFlash("error", "That session no longer exists.");
    redirect("/admin/sessions");
  }

  await prisma.session.delete({ where: { id: id.data } }); // bookings cascade
  await recordAudit({
    actorId: admin.id,
    action: "session.delete",
    targetType: "Session",
    targetId: id.data,
    details: { name: existing.class.name, startsAt: formatSessionTime(existing.startsAt), bookings: existing._count.bookings },
  });
  await setFlash("success", `Session deleted (${existing.class.name}, ${formatSessionTime(existing.startsAt)}).`);
  refreshAdmin();
  redirect("/admin/sessions");
}

// ---------------------------------------------------------------------------
// Cash validation
// ---------------------------------------------------------------------------

export async function setPaidAction(formData: FormData): Promise<void> {
  const admin = await requireAdminActor();
  const returnTo = safeReturnUrl(String(formData.get("returnTo") ?? ""), "/admin/bookings");
  const bookingId = z.string().min(1).safeParse(formData.get("bookingId"));
  const isPaid = formData.get("isPaid") === "true";
  if (!bookingId.success) redirect(returnTo);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId.data },
    include: { user: { select: { name: true } }, session: { include: { class: { select: { name: true } } } } },
  });
  if (!booking) {
    await setFlash("error", "That booking no longer exists.");
    redirect(returnTo);
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { isPaid } });
  await recordAudit({
    actorId: admin.id,
    action: isPaid ? "booking.markPaid" : "booking.markUnpaid",
    targetType: "Booking",
    targetId: booking.id,
    details: { memberName: booking.user.name, name: booking.session.class.name, startsAt: formatSessionTime(booking.session.startsAt) },
  });
  await setFlash("success", `${booking.user.name} marked as ${isPaid ? "paid" : "not paid"}.`);
  refreshAdmin();
  redirect(returnTo);
}
