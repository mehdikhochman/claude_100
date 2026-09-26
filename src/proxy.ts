// Runs before every matched request (Next.js 16 "proxy", formerly middleware).
//
// Job: keep anonymous visitors out of member pages and members out of /admin,
// remembering where they were headed (?returnUrl=…). Pages re-check on the
// server too, this is just the fast first line.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

const ADMIN_PREFIX = "/admin";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith(ADMIN_PREFIX) && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything that needs a login. /profile/[id] (public profile) is NOT
  // listed on purpose — only the exact /profile settings page is protected.
  matcher: [
    "/dashboard/:path*",
    "/bookings/:path*",
    "/profile",
    "/sessions/:path*",
    "/avatar/:path*",
    "/admin/:path*",
  ],
};
