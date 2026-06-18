import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/store(.*)",
  "/track(.*)",
  "/mainwebsite(.*)",
  "/api/checkout(.*)",
  "/api/store(.*)",
  "/api/orders/track(.*)",
  "/api/webhooks(.*)",
  "/admin/sign-in(.*)",
  "/admin/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  if (isAdminRoute(req)) {
    const { userId } = await auth();

    if (!userId) {
      const signInUrl = new URL("/admin/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }

    // ADMIN_EMAILS allowlist check
    const allowedEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length > 0) {
      const { sessionClaims } = await auth();
      const email = (
        (sessionClaims?.email as string) ||
        ""
      ).toLowerCase();

      if (!allowedEmails.includes(email)) {
        return NextResponse.redirect(new URL("/admin/sign-in?error=unauthorized", req.url));
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
