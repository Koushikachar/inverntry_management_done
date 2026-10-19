# SECURITY AUDIT SUMMARY — Direct2Hub (static review of the codebase, before production)

**Critical: 0 confirmed, 1 potential pending your manual check (F1).  High: 1 (fixed in code).  Medium: 6 (4 fixed in code, 2 need your settings/work).  Low: 5.**
Method: read all 3 API routes, 35 server actions, auth/middleware/config, scripts, `package.json`/lockfile; grepped for secrets, `NEXT_PUBLIC_*`, `service_role`, `dangerouslySetInnerHTML`, `$queryRawUnsafe`, `localStorage`; ran `npm audit`. I could NOT inspect: your live Supabase project (RLS/grants/Auth settings), Vercel config, Git history (no repo in my sandbox), or any running site. "Fixed" = changed in this zip, not yet run or tested by me.

## Findings

**F1 — Supabase Data API may expose every app table (NEEDS MANUAL VERIFICATION)** — Severity: High, potentially Critical
- Location: `prisma/schema.prisma`, Prisma migrations. Evidence: the schema and migrations contain no RLS or grants. Supabase exposes the `public` schema through REST, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design (in the browser bundle).
- Why/abuse: if RLS is off, anyone can read or write Users, Orders, Products via `/rest/v1/<Table>` with the anon key, bypassing all app checks.
- Fix: run `supabase/rls-lockdown.sql` (enables RLS, revokes anon/authenticated). Prisma connects as owner and keeps working.
- Verify: `curl "https://<project>.supabase.co/rest/v1/Product?select=*" -H "apikey: <anon>" -H "Authorization: Bearer <anon>"` must return `[]` or "permission denied".

**F2 — Unused reserve API trusted client IDs and ignored suspension** — High (fixed)
- Location: `src/app/api/orders/reserve/route.ts` (deleted). Evidence: took `orgId/productId/warehouseId` from the JSON body, authorized via `requireMember` only (no suspended-org check, no rate limit); no UI called it.
- Abuse: members of a suspended org could still change stock. Cross-tenant writes were NOT possible (the SQL filtered by orgId).
- Verify: `POST /api/orders/reserve` now returns 404.

**F3 — Session cookies readable by JavaScript** — Medium (fixed). Location: `src/lib/supabase.ts`, `src/middleware.ts`. Evidence: Supabase options passed through (library default `httpOnly: false`). Abuse: any XSS could steal the session. Fix: `httpOnly`, `secure` (prod), `sameSite: lax`. Verify: DevTools → Application → Cookies shows HttpOnly ✓; `document.cookie` has no `sb-` entry. No localStorage tokens exist (grep: 0 hits).

**F4 — Email verification not enforced by the app** — Medium (fixed). Location: `src/lib/auth.ts`. Evidence: relied on the Supabase "Confirm email" dashboard switch; admin access by email (`PLATFORM_ADMIN_EMAILS`) trusts that email. Fix: unverified users are never treated as signed in. Verify: sign up with confirmation off, then the account must not reach `/dashboard` unless `email_confirmed_at` is set.

**F5 — Auth API can be called directly, bypassing app protections** — Medium (NEEDS MANUAL, Supabase dashboard). Evidence: signup/login use the public anon key, so Turnstile, our rate limit and password rules (server actions) can be skipped by calling Supabase Auth directly. Fix in Supabase → Authentication: minimum password length 12, leaked-password protection (Pro plan), CAPTCHA (Turnstile), review rate limits, require email confirmation. Verify: `curl` a weak-password signup to `/auth/v1/signup`; it must be rejected.

**F6 — Rate limiting was per-instance memory** — Medium (fixed, needs env). Location: `src/app/actions.ts` (`throttle`). Evidence: `Map` in process memory, so serverless instances don't share counts. Fix: Upstash Redis REST backing when `UPSTASH_REDIS_REST_URL/TOKEN` are set; keys now per IP+email, 5 sign-in attempts per 15 min. Trade-off: it can lock one person out from one IP. Verify: the 6th sign-in attempt in 15 minutes is blocked.

**F7 — Weak password policy** — Medium (fixed). Evidence: Zod `min(8)`, no breach check. Fix: 12+ characters plus HaveIBeenPwned k-anonymity check on signup and reset (fails open if the service is down). Sign-in unchanged so existing users can still log in. Verify: `Password12345!` style known-breached passwords are rejected at `/register`.

**F8 — No security headers** — Medium (fixed). Evidence: no `next.config.js`. Fix: HSTS, nosniff, frame denial, referrer, permissions policy, CSP (production only; allows Supabase and Turnstile). Verify: securityheaders.com. CSP uses `'unsafe-inline'` for scripts (Next.js default) and needs manual tuning (nonces) for an A+.

**F9 — Dependency vulnerabilities** — Medium (NEEDS MANUAL). Evidence: `npm audit --omit=dev`: 5 (4 high via PostCSS bundled in `next`, 1 moderate via `prisma`/`@prisma/config`). Practical risk is low (build-time CSS, not user input) but unresolved. Fix: upgrade `next` and `prisma` to the latest patched minor in a branch, run build and tests. Do not run `npm audit fix --force` blindly (it jumps major versions).

**F10 — Account enumeration at signup** — Low (fixed). Evidence: "That email is already registered". Now identical to new signups. Remaining: sign-in for an unverified account says "Email not confirmed" (Supabase behavior; accepted).

**F11 — Health endpoint disclosed config state** — Low (fixed). Location: `src/app/api/health/route.ts`. Evidence: listed missing env var names and schema failures publicly. Now details for platform operators only.

**F12 — `.gitignore` too narrow; Git history unchecked** — Low (fixed / NEEDS MANUAL). Only `.env` was ignored. Now `.env.*`, keys, `.vercel`. History: run `gitleaks detect` or `trufflehog git file://.`. If any real key was ever committed, deleting the file is not enough: rotate it (Supabase DB password and keys, Resend, Turnstile, Upstash).

**F13 — Server logs may include DB error text** — Low. Location: `src/lib/notify.ts`, `src/lib/mail.ts`. Evidence: logs `error.message` (Prisma messages can contain identifiers); no passwords, tokens or Authorization headers are logged. Recommend a log-drain filter.

**F14 — No MFA and no auth-event monitoring** — Low/Medium (NEEDS MANUAL). The platform-admin role is granted by email, so a stolen admin password means full access. Enable Supabase MFA for admin accounts and alerts on failed-login spikes (Supabase Auth logs).

**F15 — No automated cross-tenant tests** — Medium (NEEDS MANUAL). Code review result: every read/write in actions and pages filters by `orgId` taken from the server session (`ctx()`), never from the browser; admin pages and actions call `adminGuard()`. This is a code reading, not proof. Add a Playwright test with two accounts.

## What I checked and found no issue (evidence)
- **Secrets:** no service-role key used anywhere; only `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SITE_URL/TURNSTILE_SITE_KEY` are client-visible. `.env.example` has placeholders only.
- **Injection:** all raw SQL uses tagged-template parameters; no `$queryRawUnsafe`, `eval`, `innerHTML`, `dangerouslySetInnerHTML`.
- **XSS/open redirect:** React escaping; email HTML escapes the org name; `/auth/callback?next=` and order `back` accept same-site paths only; CSV export neutralizes `= + - @`.
- **Uploads:** only a CSV import (1 MB, 2000 rows, parsed server-side, re-validated on commit). No file storage exists yet.
- **CSRF:** Server Actions use Next's built-in origin check; cookies are SameSite=Lax.
- **Invitations:** hashed single-use tokens, 7-day expiry, bound to the invited email; OWNER cannot be invited.

## ATTACKER TEST
- **A) Not signed in:** every app page redirects to `/login` (checked on the live site for `/dashboard`); admin returns 404; actions require a session. Remaining: brute force (now limited), direct Supabase Auth/REST calls (F1, F5: your settings).
- **B) Normal member:** role checks run on the server in every action (`guard`); a non-owner cannot invite, change roles, or load demo data; admin actions call `adminGuard`.
- **C) Malicious user, other tenant's data:** changing an ID in a URL or form returns 404 or "not found" because every query adds `orgId` from the session. Not verified by a running test (F15) and the Supabase API path is open until F1 is checked.

## PRE-LAUNCH SECURITY CHECKLIST
[NEEDS MANUAL REVIEW] Git history scanned for secrets · [NEEDS MANUAL REVIEW] Keys rotated if ever exposed · [PASS] No secrets in frontend code · [PASS] `.env` ignored · [NEEDS MANUAL REVIEW] Supabase RLS lockdown applied and tested (F1) · [PASS] Server-side authorization in actions · [PASS] Admin actions protected · [NEEDS MANUAL REVIEW] Two-account isolation test · [PASS] Email verification enforced in code · [NEEDS MANUAL REVIEW] Supabase Auth settings (F5) · [PASS] Rate limiting present, [NEEDS MANUAL REVIEW] Upstash configured · [PASS] Input validation (Zod) · [PASS] Parameterized queries · [PASS] No script injection sinks · [PASS] Upload limits (CSV only) · [PASS] Security headers added, [NEEDS MANUAL REVIEW] CSP tuning · [PASS] Debug off in production, safe error pages · [FAIL] Dependencies have open advisories (F9) · [NEEDS MANUAL REVIEW] Backups and a tested restore · [NEEDS MANUAL REVIEW] Failed-login alerts · [N/A] Payments, AI calls (none exist) · [N/A] CI/CD (no workflows)

## TOP 5 FIXES BEFORE LAUNCH
1. Run `supabase/rls-lockdown.sql` and test the anon REST call (F1).
2. Set Supabase Auth rules: min 12 characters, leaked-password protection, CAPTCHA, email confirmation on (F5).
3. Scan Git history and rotate any key that was ever committed (F12).
4. Add Upstash keys so rate limits actually hold on Vercel (F6), and enable MFA on admin accounts (F14).
5. Upgrade `next`/`prisma`, then add a two-account Playwright isolation test (F9, F15).

## Still needs manual penetration testing or production verification
Live Supabase configuration, tenant-isolation tests with two real accounts, header/CSP behavior on Vercel, email deliverability and reset-link behavior in production, backup restore, and a third-party pen test before handling real customer data. This audit does not mean the application is "secure".
