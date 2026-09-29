import { NextResponse, type NextRequest } from "next/server";
import { requireLogin } from "@/lib/server-auth";

/** Require HTTP Basic Auth for the parent admin area; all other routes are public. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/tasks")) {
    const denied = requireLogin(request);
    if (denied) return denied;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/tasks", "/tasks/:path*"],
};
