export { auth as proxy } from "@/auth";

export const config = {
  // everything except the login page, Auth.js routes, health check and static assets.
  // api/drive/upload checks the session itself: going through the proxy would buffer the whole upload.
  matcher: ["/((?!login|api/auth|api/health|api/drive/upload|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
