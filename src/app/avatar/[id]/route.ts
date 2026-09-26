// Serves a member's avatar (login required). Falls back to an initials SVG
// when there is no photo, the file is missing, or the member is private.
//
// Caching: the browser must re-check every time (a new photo should show up
// immediately), but re-checks are cheap thanks to the ETag — unchanged photos
// get a tiny 304 instead of the bytes.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { initialsSvg, readAvatar } from "@/lib/avatar";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Login required", { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, avatarUrl: true, isPublic: true },
  });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const canSeePhoto = user.isPublic || viewer.id === id || viewer.role === "ADMIN";
  const source = canSeePhoto && user.avatarUrl ? user.avatarUrl : `initials:${user.name}`;
  const etag = `"${createHash("sha1").update(source).digest("hex")}"`;

  const headers = {
    ETag: etag,
    "Cache-Control": "private, no-cache",
    Vary: "Cookie",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  if (canSeePhoto && user.avatarUrl) {
    const file = await readAvatar(user.avatarUrl);
    if (file) {
      return new NextResponse(file.body, { headers: { ...headers, "Content-Type": file.contentType } });
    }
  }

  return new NextResponse(initialsSvg(user.name), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
