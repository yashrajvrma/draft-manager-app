import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next.js 16 renamed Middleware to Proxy. This is an *optimistic* auth check:
// it only looks for the presence of the session cookie to gate page routes.
// Real authorization still happens in each API route via getSession().
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = getSessionCookie(request);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, static assets, and Next internals.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
