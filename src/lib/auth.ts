import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Role } from "@prisma/client";
import { db } from "./db";

async function loadUser() {
  const store = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data } = await sb.auth.getUser(); // validated by Supabase, not trusted from the cookie
  const au = data.user; if (!au?.email || !au.email_confirmed_at) return null; // unverified emails are never treated as signed in
  // Signed in with Supabase but no app row yet (e.g. never finished onboarding): create it instead of bouncing to /login.
  const found = await db.user.findUnique({ where: { authId: au.id } }); if (found) return found;
  const email = au.email.toLowerCase(), old = await db.user.findUnique({ where: { email } });
  if (old) return au.email_confirmed_at ? db.user.update({ where: { id: old.id }, data: { authId: au.id } }) : null; // same verified email, e.g. after a Supabase project change
  try { return await db.user.create({ data: { authId: au.id, email, name: (au.user_metadata?.name as string) ?? null } }); }
  catch { return db.user.findUnique({ where: { authId: au.id } }); } // lost a race with a parallel request
}

/** Server-side tenant + role guard. orgId comes from the DB membership, never from the client. */
export async function requireMember(orgId: string, allowed: Role[]) {
  const user = await getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  const m = await db.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId } } });
  if (!m || !allowed.includes(m.role)) throw new Response("Forbidden", { status: 403 });
  return { user, role: m.role, orgId };
}

export const isAdminEmail = (e?: string | null) => !!e && (process.env.PLATFORM_ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).includes(e.toLowerCase());
export async function isOperator(user: { id: string; email: string }) {
  return isAdminEmail(user.email) || !!(await db.membership.findFirst({ where: { userId: user.id, role: "PLATFORM_OPERATOR" } }));
}
export async function requireOperator() {
  const user = await getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  if (!(await isOperator(user))) throw new Response("Forbidden", { status: 403 });
  return user;
}

export const getUser = cache(loadUser); // one Supabase lookup per request
