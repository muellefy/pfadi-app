/**
 * The Content-Security-Policy of every page. Scripts only run when they carry this
 * request's nonce (Next.js adds it to its own scripts), so an injected <script>
 * or onclick=… does nothing. 'strict-dynamic' lets those trusted scripts load the
 * rest of the app's chunks. Dev mode needs 'unsafe-eval' for React's debugging.
 */
export function contentSecurityPolicy(nonce: string, dev = false): string {
  return [
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self' https://accounts.google.com",
  ].join("; ");
}

/** A fresh random nonce per request (base64, as CSP expects). */
export const newNonce = () => btoa(crypto.randomUUID());
