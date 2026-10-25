import { NextResponse, type NextRequest } from "next/server";
export function middleware(request: NextRequest) {
  if (!["/conductor", "/pasajero"].includes(request.nextUrl.pathname)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname += "/";
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/conductor", "/pasajero"] };
