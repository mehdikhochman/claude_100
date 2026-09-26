"use server";
// Server Actions the member-facing buttons call. Thin wrappers: check who is
// logged in, call the engine, leave a flash message, go back where they were.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeReturnUrl } from "./auth/return-url";
import { getCurrentUser } from "./auth/session";
import { bookSession, cancelBooking, joinWaitlist, markPromotionSeen } from "./booking";
import { setFlash } from "./flash";

const idSchema = z.string().min(1).max(64);

async function requireActionUser(returnTo: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(returnTo)}`);
  return user;
}

function readReturnTo(formData: FormData, fallback: string): string {
  const raw = formData.get("returnTo");
  return safeReturnUrl(typeof raw === "string" ? raw : null, fallback);
}

export async function bookAction(formData: FormData): Promise<void> {
  const returnTo = readReturnTo(formData, "/schedule");
  const user = await requireActionUser(returnTo);
  const sessionId = idSchema.safeParse(formData.get("sessionId"));
  if (!sessionId.success) {
    await setFlash("error", "That session could not be found.");
    redirect(returnTo);
  }

  const result = await bookSession(user.id, sessionId.data);
  if (result.ok) {
    await setFlash("success", "You're booked. See you on the mat.");
  } else if (result.reason === "SESSION_FULL") {
    await setFlash("info", "That last spot just went. You can join the waitlist instead.");
  } else {
    await setFlash("error", result.message);
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}

export async function joinWaitlistAction(formData: FormData): Promise<void> {
  const returnTo = readReturnTo(formData, "/schedule");
  const user = await requireActionUser(returnTo);
  const sessionId = idSchema.safeParse(formData.get("sessionId"));
  if (!sessionId.success) {
    await setFlash("error", "That session could not be found.");
    redirect(returnTo);
  }

  const result = await joinWaitlist(user.id, sessionId.data);
  if (result.ok && result.kind === "waitlisted") {
    await setFlash(
      "success",
      `You're on the waitlist (position ${result.position}). If a spot opens, it's yours automatically.`,
    );
  } else if (result.ok) {
    await setFlash("success", "A spot had just opened — you're booked!");
  } else {
    await setFlash("error", result.message);
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}

export async function cancelAction(formData: FormData): Promise<void> {
  const returnTo = readReturnTo(formData, "/dashboard");
  const user = await requireActionUser(returnTo);
  const bookingId = idSchema.safeParse(formData.get("bookingId"));
  if (!bookingId.success) {
    await setFlash("error", "That booking could not be found.");
    redirect(returnTo);
  }

  const result = await cancelBooking(user.id, bookingId.data);
  if (result.ok && result.kind === "left_waitlist") {
    await setFlash("success", "You've left the waitlist.");
  } else if (result.ok) {
    await setFlash("success", "Booking cancelled. Your spot has been freed.");
  } else {
    await setFlash("error", result.message);
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}

export async function dismissPromotionAction(formData: FormData): Promise<void> {
  const returnTo = readReturnTo(formData, "/dashboard");
  const user = await requireActionUser(returnTo);
  const bookingId = idSchema.safeParse(formData.get("bookingId"));
  if (bookingId.success) await markPromotionSeen(user.id, bookingId.data);
  revalidatePath("/", "layout");
  redirect(returnTo);
}
