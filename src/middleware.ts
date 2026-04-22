import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Don't redirect the login page to itself
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    // Admin routes require authentication
    if (pathname.startsWith("/admin")) {
      if (!token) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Allow login page without auth
        if (pathname === "/admin/login") {
          return true;
        }

        // Admin routes require auth
        if (pathname.startsWith("/admin")) {
          return !!token;
        }

        // All other routes are public
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/admin/:path*"],
};
