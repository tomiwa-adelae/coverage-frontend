import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Signed-in visitors are sent home from these.
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"]
// Reachable either way (a reset link may be opened while still signed in).
const PUBLIC_PATHS = [...GUEST_ONLY, "/reset-password"]

// Cheap presence check only; the API verifies the tokens on every request.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const signedIn =
    request.cookies.has("cov_access") || request.cookies.has("cov_refresh")
  const isPublic = PUBLIC_PATHS.includes(pathname)

  if (!signedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (signedIn && GUEST_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-z]+$).*)"],
}
