export { auth as middleware } from "@/auth";

export const config = {
  // everything except the login page, Auth.js routes, health check and static assets
  matcher: ["/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
