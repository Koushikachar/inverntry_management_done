# Direct2Hub
Setup: `npm i` → copy `.env.example` to `.env` → `npx prisma validate` → `npx prisma generate` → `npm run db:migrate` → `npm run dev`.
To create a platform admin: after registering, insert a Membership row with role PLATFORM_OPERATOR for your user (manual, audited).
Make yourself platform admin: `npx tsx scripts/make-operator.ts you@example.com` (after registering + onboarding).
Dev demo data: `SEED_EMAIL=you@example.com npm run db:seed` (refuses to run in production).
Built: auth pages, onboarding, products (+CSV export), inventory ledger, orders (confirm/dispatch/cancel), suppliers, PO creation, returns with inspection, analytics, settings, admin.
Not built: product images, product variants, online billing/payments, forecasting and product research. After pulling this version run: npx prisma migrate dev --name receipts_notifications_plans

Email verification (Supabase dashboard): Authentication → Providers → Email → turn "Confirm email" ON. Authentication → URL Configuration → Site URL = NEXT_PUBLIC_SITE_URL, and add `<site>/auth/callback` to Redirect URLs. Open the verification link in the same browser you registered in.

Admin panel: set PLATFORM_ADMIN_EMAILS="you@example.com" in .env (verified emails only), finish onboarding once with that account, then open /admin. (The older `scripts/make-operator.ts` also works.)

Abuse protection: login, register, password-reset, resend and invitations are rate-limited in memory (per server instance; use Redis/Upstash for hard limits on serverless). Set BOTH Turnstile keys in .env to turn on the Cloudflare check.
