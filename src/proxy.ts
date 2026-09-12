import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

// Next.js 16 network-boundary convention (replaces middleware.ts).
export async function proxy(request: Request) {
  if (!auth0) return NextResponse.next();
  return await auth0.middleware(request as never);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
