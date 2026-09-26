"use server";
// Profile Server Actions: photo upload/removal, name and privacy changes.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { setFlash } from "@/lib/flash";
import { deleteAvatar, processAvatar, storeAvatar } from "@/lib/avatar";

export type ProfileFormState = { errors?: Record<string, string>; values?: Record<string, string> };

const nameSchema = z.string().trim().min(2, "Enter your full name.").max(80, "That name is a little long (80 characters max).");

async function requireProfileUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnUrl=%2Fprofile");
  return user;
}

export async function updateNameAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireProfileUser();
  const raw = formData.get("name");
  const parsed = nameSchema.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) {
    return { errors: { name: parsed.error.issues[0]?.message ?? "Enter your name." }, values: { name: String(raw ?? "") } };
  }
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data } });
  await setFlash("success", "Name updated.");
  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function setPrivacyAction(formData: FormData): Promise<void> {
  const user = await requireProfileUser();
  const isPublic = formData.get("isPublic") === "true";
  await prisma.user.update({ where: { id: user.id }, data: { isPublic } });
  await setFlash("success", isPublic ? "Your profile is now public." : "Your profile is now private. Your LEGACY score stays visible.");
  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function uploadAvatarAction(formData: FormData): Promise<void> {
  const user = await requireProfileUser();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    await setFlash("error", "Choose a photo to upload.");
    redirect("/profile");
  }

  let message: string | null = null;
  try {
    const processed = await processAvatar(file);
    const previous = (await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } }))?.avatarUrl ?? null;
    const ref = await storeAvatar(user.id, processed, previous);
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: ref } });
  } catch (error) {
    message = error instanceof Error ? error.message : "We couldn't save that photo.";
  }

  await setFlash(message ? "error" : "success", message ?? "Photo updated.");
  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function removeAvatarAction(): Promise<void> {
  const user = await requireProfileUser();
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  if (current?.avatarUrl) {
    await deleteAvatar(current.avatarUrl);
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  }
  await setFlash("success", "Photo removed.");
  revalidatePath("/", "layout");
  redirect("/profile");
}
