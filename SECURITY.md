# Security checklist – pfadi-app

pfadi-app handles personal data of children and leaders (names, contact details,
possibly allergies/health notes from Drive participant lists). Treat every
change that touches login, Drive or eCamp data as security-relevant.

Run `/security-review` in Claude Code before every commit. The GitHub Action
(`.github/workflows/security-review.yml`) reviews every pull request against
the same rules (`.github/security-scan-instructions.txt`).

## 1. Authentication (Google login)
- [ ] Only `@pfadis.ch` accounts can sign in. The domain is checked **on the server**
      (verified `hd` claim / email domain in the ID token), not only via the
      `hd` hint in the login URL or in the UI.
- [ ] `email_verified` is true before an account is accepted.
- [ ] Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax` (or stricter).
- [ ] Logout really ends the session; sessions expire.

## 2. Authorization
- [ ] Every API route / server action checks the session itself – no route
      relies on the page having been protected.
- [ ] A leader only sees camps and lists they are assigned to
      (no access to other camps by changing an ID in the URL).
- [ ] Middleware matcher in Next.js covers all protected routes, including `/api/*`.

## 3. Personal data from Google Drive
- [ ] Health/allergy and contact data is only shown to people who need it.
- [ ] Participant data is never written to logs, error messages or analytics.
- [ ] Exports/downloads (xlsx/csv) require login and authorization.
- [ ] Data is not cached longer than necessary (no copies left in the container
      or in public folders).
- [ ] Drive scopes are minimal (read-only where possible, e.g. `drive.readonly`
      or `drive.file`).

## 4. eCamp integration
- [ ] eCamp is only read, never written.
- [ ] eCamp credentials/tokens live server-side only, never in client bundles.

## 5. Secrets & configuration
- [ ] No secrets in the repo: OAuth client secret, `NEXTAUTH_SECRET`/session
      secret, Drive service-account key, eCamp credentials.
- [ ] Secrets come from `.env` (gitignored) or Docker secrets; `.env.example`
      contains placeholders only.
- [ ] No secret uses the `NEXT_PUBLIC_` prefix.

## 6. Input handling & web security
- [ ] Data from Drive files (cell contents!) and eCamp is treated as untrusted:
      no `dangerouslySetInnerHTML`, no unescaped HTML.
- [ ] CSV/xlsx exports are protected against formula injection
      (cells starting with `=`, `+`, `-`, `@`).
- [ ] State-changing requests are protected against CSRF.
- [ ] Security headers set (CSP, `X-Frame-Options`/`frame-ancestors`,
      `Referrer-Policy`).

## 7. Docker Compose & deployment
- [ ] Container runs as a non-root user.
- [ ] Only the app port is exposed; internal services (DB, cache) are not
      published to the host/internet.
- [ ] HTTPS in front of the app (reverse proxy).
- [ ] Base images and npm dependencies are kept up to date (`npm audit`, Dependabot).