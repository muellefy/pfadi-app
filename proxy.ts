import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";

/** The only page that opens without a login. */
const LOGIN = "/login";

/**
 * Runs before every page: sends people without a session to the login page,
 * and sets the Content-Security-Policy with a fresh nonce. Next.js reads the
 * nonce from the request header and puts it on its own scripts.
 */
export const proxy = auth((req) => {
  const { pathname, href } = req.nextUrl;
  if (!req.auth?.user && pathname !== LOGIN) {
    // same redirect Auth.js builds itself
    const login = req.nextUrl.clone();
    login.pathname = LOGIN;
    login.searchParams.set("callbackUrl", href);
    return NextResponse.redirect(login);
  }

  const csp = contentSecurityPolicy(newNonce(), process.env.NODE_ENV === "development");
  const headers = new Headers(req.headers);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
});

export const config = {
  // everything except Auth.js routes, health check and static assets.
  // api/drive/upload checks the session itself: going through the proxy would buffer the whole upload.
  matcher: ["/((?!api/auth|api/health|api/drive/upload|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
