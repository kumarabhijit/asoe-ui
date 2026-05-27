import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/auth", "/403"];

/**
 * Middleware — PARITY-3a auth-failure branching.
 *
 * Three distinct redirect destinations, per the parity plan:
 *
 *   1. token-missing  → /login (anonymous user; benign).
 *   2. token-invalid  → /login?reason=session_expired (had a session,
 *                       the cookie is stale or the JWT can't be decoded —
 *                       the operator needs to know the session expired,
 *                       not silently land on the bare login page).
 *   3. no-role-for-tenant → /403 with explanatory copy. We do NOT
 *                       force a logout here; the user is a real, valid
 *                       Entra identity who simply lacks ASOE roles for
 *                       the active tenant. Silently logging them out
 *                       loses the audit trail of which valid identity
 *                       hit the wall.
 *
 * Token shape:
 *   - `token` is null  → branch 1.
 *   - `token` is non-null but `token.roles` is empty/missing → branch 3.
 *   - getToken throws / returns malformed → branch 2.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for auth token. Distinguish token-missing from token-invalid:
  // getToken returns null when the cookie is absent OR when it cannot
  // be decoded. We can't tell the two apart without inspecting the raw
  // cookie, so the heuristic is: "did the request carry a session
  // cookie at all?". If yes and getToken returned null, the cookie is
  // present-but-invalid (session_expired); if no, the user is
  // anonymous (missing).
  let token: Awaited<ReturnType<typeof getToken>> = null;
  let tokenInvalid = false;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch {
    tokenInvalid = true;
  }

  if (!token) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const hasSessionCookie =
      cookieHeader.includes("next-auth.session-token") ||
      cookieHeader.includes("__Secure-next-auth.session-token");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    if (tokenInvalid || hasSessionCookie) {
      loginUrl.searchParams.set("reason", "session_expired");
    }
    return NextResponse.redirect(loginUrl);
  }

  // Role-gate: a non-empty roles claim is the contract from the
  // backend (asoe2 UserProfile.roles). If it's empty, the identity
  // is real but has no ASOE role for the active tenant — send to
  // /403, do not bounce to /login.
  const roles = (token as unknown as { roles?: unknown }).roles;
  const hasRoles = Array.isArray(roles) && roles.length > 0;
  if (!hasRoles) {
    const forbiddenUrl = new URL("/403", request.url);
    forbiddenUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(forbiddenUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
