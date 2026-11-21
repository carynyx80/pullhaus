import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (process.env.COUNTRY_BLOCK_ENABLED !== "true") return NextResponse.next();
  const blocked = (process.env.BLOCKED_COUNTRIES || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const country = (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "").toUpperCase();
  if (country && blocked.includes(country) && !req.nextUrl.pathname.startsWith("/unavailable")) {
    return NextResponse.rewrite(new URL("/unavailable", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
