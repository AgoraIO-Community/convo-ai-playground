import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtectedPage = pathname === "/call" || pathname === "/call-ended";
  const isProtectedAgentApi = pathname.startsWith("/api/agent/");
  const isProtectedTeacherApi =
    pathname.startsWith("/api/teacher/") && pathname !== "/api/teacher/mcp";

  if ((isProtectedAgentApi || isProtectedTeacherApi) && !req.auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (isProtectedPage && !req.auth) {
    const url = new URL("/", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/call",
    "/call-ended",
    "/api/agent/:path*",
    "/api/teacher/:path*",
  ],
};
