import { NextResponse, type NextRequest } from "next/server";

/**
 * Password gate (HTTP Basic auth) for the whole app when DASHBOARD_PASSWORD is set.
 * The Vaani webhook is excluded by the matcher; it authenticates with its own secret.
 * Any username is accepted; only the password is checked.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
    } catch {
      // malformed header: fall through to the challenge
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Aangan AI Receptionist", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!api/webhooks/vaani|_next/static|_next/image|favicon.ico).*)"],
};
