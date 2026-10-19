"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ctx } from "@/lib/ctx";
import { reserveMany, receiveLine } from "@/lib/inventory";
import { notifyLow } from "@/lib/notify";
import { checkPassword } from "@/lib/password";
import { loadDemo, removeDemo } from "@/lib/demo";
import { checkLimit } from "@/lib/plan";
import { cookies, headers } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { sendMail } from "@/lib/mail";
import { getUser } from "@/lib/auth";
import { sbServer } from "@/lib/supabase";
import type { Role } from "@prisma/client";

const fail = (p: string, m: string) => redirect(`${p}?e=${encodeURIComponent(m)}`);
const STOCK: Role[] = ["OWNER", "INVENTORY_MANAGER"], SALES: Role[] = ["OWNER", "INVENTORY_MANAGER", "ORDER_STAFF"], BUY: Role[] = ["OWNER", "INVENTORY_MANAGER", "ACCOUNTANT"];
async function guard(roles: Role[], back: string) { const c = await ctx(); if (!roles.includes(c.role)) fail(back, "You don't have permission for this action"); return c; }
const wh = (orgId: string) => db.warehouse.findFirstOrThrow({ where: { orgId } });
const creds = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function signIn(fd: FormData) {
  await gate("/login", fd, "login", 5);
  const p = creds.safeParse(Object.fromEntries(fd)); if (!p.success) fail("/login", "Enter a valid email and a password of 8+ characters");
  const { error } = await (await sbServer()).auth.signInWithPassword(p.data!);
  if (error) { if (/not confirmed/i.test(error.message)) redirect(`/verify?email=${encodeURIComponent(p.data!.email)}&e=${encodeURIComponent("Verify your email first. We can send the link again")}`); fail("/login", error.message); }
  redirect("/dashboard");
}
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL;
export async function signUp(fd: FormData) {
  await gate("/register", fd, "register", 5);
  const p = z.object({ name: z.string().trim().min(2), email: z.string().trim().email(), password: z.string().min(12), confirm: z.string() }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/register", "Enter your name, a valid email and a password of 12+ characters");
  if (p.data!.password !== p.data!.confirm) fail("/register", "The two passwords don't match");
  const weak = await checkPassword(p.data!.password); if (weak) fail("/register", weak);
  const { data, error } = await (await sbServer()).auth.signUp({ email: p.data!.email, password: p.data!.password, options: { data: { name: p.data!.name }, emailRedirectTo: `${SITE()}/auth/callback` } });
  if (error) fail("/register", error.message);
  // An already-registered email gets exactly the same response as a new one (no account enumeration).
  if (data.session) redirect("/onboarding"); // email confirmation is switched off in Supabase
  redirect(`/verify?email=${encodeURIComponent(p.data!.email)}`);
}
export async function resendVerification(fd: FormData) {
  await throttle("/verify", `resend:${await ip()}`, 5);
  const email = z.string().email().safeParse(fd.get("email")); if (!email.success) fail("/register", "Enter a valid email");
  const { error } = await (await sbServer()).auth.resend({ type: "signup", email: email.data!, options: { emailRedirectTo: `${SITE()}/auth/callback` } });
  const q = encodeURIComponent(email.data!);
  redirect(error ? `/verify?email=${q}&e=${encodeURIComponent(error.message)}` : `/verify?email=${q}&ok=1`);
}
export async function signOut() { await (await sbServer()).auth.signOut(); redirect("/login"); }

export async function createOrg(fd: FormData) {
  const { data } = await (await sbServer()).auth.getUser(); const au = data.user; if (!au) redirect("/login");
  const name = z.string().trim().min(2).safeParse(fd.get("name")); if (!name.success) fail("/onboarding", "Enter your business name");
  await db.$transaction(async (tx) => {
    const u = await tx.user.upsert({ where: { authId: au.id }, update: {}, create: { authId: au.id, email: au.email!, name: (au.user_metadata?.name as string) ?? null } });
    await tx.organization.create({ data: { name: name.data!, warehouses: { create: { name: "Main warehouse" } }, members: { create: { userId: u.id, role: "OWNER" } } } });
  });
  redirect("/dashboard");
}

export async function addProduct(fd: FormData) {
  const c = await guard(STOCK, "/products");
  const p = z.object({ sku: z.string().trim().min(1), name: z.string().trim().min(1), price: z.coerce.number().min(0), cost: z.coerce.number().min(0),
    reorder: z.coerce.number().int().min(0), opening: z.coerce.number().int().min(0) }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/products", `Check the ${String(p.error.issues[0].path[0])} field`);
  const d = p.data!, w = await wh(c.orgId);
  const lim = await checkLimit(c.orgId, "products", 1); if (lim) fail("/products", lim);
  try {
    await db.$transaction(async (tx) => {
      const pr = await tx.product.create({ data: { orgId: c.orgId, sku: d.sku, name: d.name, price: d.price, unitCost: d.cost, reorderAt: d.reorder } });
      await tx.stockBalance.create({ data: { orgId: c.orgId, productId: pr.id, warehouseId: w.id, sellable: d.opening } });
      if (d.opening > 0) await tx.stockMovement.create({ data: { orgId: c.orgId, productId: pr.id, warehouseId: w.id, type: "OPENING", qty: d.opening, actorId: c.user.id, idempotencyKey: `open:${pr.id}` } });
    });
  } catch (e: any) { if (e.code === "P2002") fail("/products", `SKU "${d.sku}" already exists in your catalog`); throw e; }
  revalidatePath("/products"); redirect("/products");
}

export async function addSupplier(fd: FormData) {
  const c = await guard(BUY, "/suppliers");
  const p = z.object({ name: z.string().trim().min(1), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")) }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/suppliers", "Enter a supplier name and a valid email");
  await db.supplier.create({ data: { orgId: c.orgId, name: p.data!.name, phone: p.data!.phone || null, email: p.data!.email || null } });
  revalidatePath("/suppliers"); redirect("/suppliers");
}
export async function addPO(fd: FormData) {
  const c = await guard(BUY, "/purchases");
  const p = z.object({ supplierId: z.string(), productId: z.string(), qty: z.coerce.number().int().positive(), unitCost: z.coerce.number().min(0), expectedOn: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/purchases", "Choose a supplier and product, then enter quantity and unit cost");
  const d = p.data!;
  const [s, pr] = await Promise.all([db.supplier.findFirst({ where: { id: d.supplierId, orgId: c.orgId } }), db.product.findFirst({ where: { id: d.productId, orgId: c.orgId } })]);
  if (!s || !pr) fail("/purchases", "Supplier or product not found");
  await db.purchaseOrder.create({ data: { orgId: c.orgId, supplierId: s!.id, status: "ORDERED", total: d.qty * d.unitCost, expectedOn: d.expectedOn ? new Date(d.expectedOn) : null,
    lines: { create: { productId: pr!.id, qty: d.qty, unitCost: d.unitCost } } } });
  revalidatePath("/purchases"); redirect("/purchases");
}
/** Stock only changes here, when goods are actually received. Safe to retry (same key) and to double-click. */
export async function receivePO(fd: FormData) {
  const c = await guard(STOCK, "/purchases");
  const p = z.object({ lineId: z.string(), qty: z.coerce.number().int().min(0), rejected: z.coerce.number().int().min(0).default(0), note: z.string().trim().max(300).optional(), key: z.string().min(8) }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/purchases", "Enter whole numbers for the accepted and rejected quantities");
  const r = await receiveLine({ orgId: c.orgId, warehouseId: (await wh(c.orgId)).id, actorId: c.user.id, ...p.data! });
  if (!r.ok) fail("/purchases", r.error);
  revalidatePath("/purchases"); revalidatePath("/inventory"); redirect("/purchases");
}

export async function createOrder(fd: FormData) {
  const c = await guard(SALES, "/orders");
  const customer = z.string().trim().min(1).safeParse(fd.get("customer")); if (!customer.success) fail("/orders", "Enter a customer name");
  const want = new Map<string, number>();
  for (let i = 1; i <= 5; i++) {
    const id = String(fd.get(`p${i}`) ?? ""), q = Number(fd.get(`q${i}`)); if (!id) continue;
    if (!Number.isInteger(q) || q < 1) fail("/orders", `Line ${i}: quantity must be a whole number, 1 or more`);
    want.set(id, (want.get(id) ?? 0) + q);
  }
  if (!want.size) fail("/orders", "Add at least one product");
  const prs = await db.product.findMany({ where: { id: { in: [...want.keys()] }, orgId: c.orgId, archived: false } });
  if (prs.length !== want.size) fail("/orders", "One of the products wasn't found");
  await db.$transaction(async (tx) => {
    const last = await tx.order.aggregate({ where: { orgId: c.orgId }, _max: { number: true } });
    await tx.order.create({ data: { orgId: c.orgId, number: (last._max.number ?? 0) + 1, customer: customer.data!, total: prs.reduce((t, p) => t + Number(p.price) * want.get(p.id)!, 0),
      lines: { create: prs.map((p) => ({ productId: p.id, qty: want.get(p.id)!, unitPrice: p.price })) } } });
  });
  revalidatePath("/orders"); redirect("/orders");
}

export async function orderAct(fd: FormData) {
  const c = await guard(SALES, "/orders"), b0 = String(fd.get("back") ?? ""), back = /^\/orders(\/[\w-]+)?$/.test(b0) ? b0 : "/orders";
  const act = String(fd.get("act")), o = await db.order.findFirst({ where: { id: String(fd.get("id")), orgId: c.orgId }, include: { lines: true } });
  if (!o) fail(back, "Order not found");
  const w = await wh(c.orgId), O = o!;
  if (act === "confirm" && O.status === "DRAFT") {
    const r = await reserveMany({ orgId: c.orgId, warehouseId: w.id, actorId: c.user.id, orderId: O.id, lines: O.lines.map(l => ({ id: l.id, productId: l.productId, qty: l.qty })) });
    if (!r.ok) fail(back, `Order #${O.number}: ${r.error}`);
    await db.order.update({ where: { id: O.id }, data: { status: "CONFIRMED" } });
  } else if (act === "dispatch" && O.status === "CONFIRMED") {
    await db.$transaction(async (tx) => { for (const l of O.lines) {
      const n = await tx.$executeRaw`UPDATE "StockBalance" SET sellable=sellable-${l.qty}, reserved=reserved-${l.qty} WHERE "orgId"=${c.orgId} AND "productId"=${l.productId} AND "warehouseId"=${w.id} AND reserved>=${l.qty}`;
      if (n === 0) throw new Error("Reservation missing");
      await tx.stockMovement.create({ data: { orgId: c.orgId, productId: l.productId, warehouseId: w.id, type: "DISPATCH", qty: l.qty, actorId: c.user.id, sourceRef: O.id, idempotencyKey: `disp:${l.id}` } }); }
      await tx.order.update({ where: { id: O.id }, data: { status: "DISPATCHED" } }); });
  } else if (act === "cancel" && (O.status === "DRAFT" || O.status === "CONFIRMED")) {
    await db.$transaction(async (tx) => {
      if (O.status === "CONFIRMED") for (const l of O.lines) {
        await tx.$executeRaw`UPDATE "StockBalance" SET reserved=reserved-${l.qty} WHERE "orgId"=${c.orgId} AND "productId"=${l.productId} AND "warehouseId"=${w.id} AND reserved>=${l.qty}`;
        await tx.stockMovement.create({ data: { orgId: c.orgId, productId: l.productId, warehouseId: w.id, type: "RELEASE", qty: l.qty, actorId: c.user.id, sourceRef: O.id, idempotencyKey: `rel:${l.id}` } }); }
      await tx.order.update({ where: { id: O.id }, data: { status: "CANCELLED" } }); });
  } else fail(back, O.status === "DISPATCHED" ? "Dispatched orders can't be cancelled. Log a return instead" : "That action isn't valid for this order's status");
  await notifyLow(c.orgId, O.lines.map(l => l.productId));
  revalidatePath("/orders"); revalidatePath(back); redirect(back);
}

export async function logReturn(fd: FormData) {
  const c = await guard(SALES, "/returns");
  const p = z.object({ productId: z.string(), qty: z.coerce.number().int().positive(), reason: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/returns", "Choose a product and quantity");
  if (!(await db.product.findFirst({ where: { id: p.data!.productId, orgId: c.orgId } }))) fail("/returns", "Product not found");
  await db.return.create({ data: { orgId: c.orgId, productId: p.data!.productId, qty: p.data!.qty, reason: p.data!.reason || null } });
  revalidatePath("/returns"); redirect("/returns");
}
/** Returns are inspected first: only RESTOCK adds sellable stock; DAMAGED goes to non-sellable. */
export async function inspectReturn(fd: FormData) {
  const c = await guard(STOCK, "/returns"), w = await wh(c.orgId), id = String(fd.get("id")), restock = fd.get("d") === "RESTOCK";
  await db.$transaction(async (tx) => {
    const r = await tx.return.findFirst({ where: { id, orgId: c.orgId, status: "PENDING" } }); if (!r) return;
    const claim = await tx.return.updateMany({ where: { id, status: "PENDING" }, data: { status: restock ? "RESTOCKED" : "DAMAGED" } }); if (claim.count !== 1) return;
    await tx.stockBalance.updateMany({ where: { orgId: c.orgId, productId: r.productId, warehouseId: w.id }, data: restock ? { sellable: { increment: r.qty } } : { damaged: { increment: r.qty } } });
    await tx.stockMovement.create({ data: { orgId: c.orgId, productId: r.productId, warehouseId: w.id, type: restock ? "RETURN_RESTOCK" : "DAMAGE", qty: r.qty, actorId: c.user.id, sourceRef: id, idempotencyKey: `ret:${id}` } });
  });
  revalidatePath("/returns"); redirect("/returns");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function inviteStaff(fd: FormData) {
  const c = await guard(["OWNER"], "/settings");
  await throttle("/settings", `invite:${c.user.id}`, 10, 3600_000);
  const lim = await checkLimit(c.orgId, "members", 1); if (lim) fail("/settings", lim);
  const p = z.object({ email: z.string().trim().email(), role: z.enum(["INVENTORY_MANAGER", "ORDER_STAFF", "ACCOUNTANT", "ANALYST"]) }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/settings", "Enter a valid email and choose a role");
  const token = randomBytes(32).toString("hex");
  const inv = await db.invitation.create({ data: { orgId: c.orgId, email: p.data!.email.toLowerCase(), role: p.data!.role, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 864e5) } });
  const link = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${token}`;
  const m = await sendMail({ to: inv.email, subject: `You're invited to ${c.orgName} on Direct2Hub`,
    html: `<p>You've been invited to join <b>${esc(c.orgName)}</b> as ${inv.role.replace("_", " ").toLowerCase()}.</p><p><a href="${link}">Accept invitation</a> (valid for 7 days)</p>` });
  if (!m.ok) { await db.invitation.delete({ where: { id: inv.id } }); fail("/settings", `Invitation not sent: ${m.error}`); }
  await db.auditLog.create({ data: { orgId: c.orgId, actorId: c.user.id, action: "staff.invited", detail: { email: inv.email, role: inv.role } } });
  redirect(`/settings?ok=${encodeURIComponent(`Email accepted by the provider for ${inv.email}. If it doesn't arrive, check spam.`)}`);
}

export async function acceptInvite(fd: FormData) {
  const au = (await (await sbServer()).auth.getUser()).data.user; if (!au) redirect("/login");
  const inv = await db.invitation.findUnique({ where: { tokenHash: hash(String(fd.get("token"))) } });
  if (!inv || inv.usedAt || inv.expiresAt < new Date()) fail("/onboarding", "This invitation is invalid or has expired");
  if (inv!.email !== au.email?.toLowerCase()) fail("/onboarding", "Sign in with the email address the invitation was sent to");
  await db.$transaction(async (tx) => {
    const claim = await tx.invitation.updateMany({ where: { id: inv!.id, usedAt: null }, data: { usedAt: new Date() } }); if (claim.count !== 1) return;
    const u = await tx.user.upsert({ where: { authId: au.id }, update: {}, create: { authId: au.id, email: au.email!, name: (au.user_metadata?.name as string) ?? null } });
    await tx.membership.upsert({ where: { userId_orgId: { userId: u.id, orgId: inv!.orgId } }, update: {}, create: { userId: u.id, orgId: inv!.orgId, role: inv!.role } });
  });
  (await cookies()).set("org", inv!.orgId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

export async function setOrg(fd: FormData) {
  const user = await getUser(); if (!user) redirect("/login"); const id = String(fd.get("id"));
  if (!(await db.membership.findFirst({ where: { userId: user.id, orgId: id } }))) fail("/settings", "You're not a member of that organization");
  (await cookies()).set("org", id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

const ROLES5 = ["OWNER", "INVENTORY_MANAGER", "ORDER_STAFF", "ACCOUNTANT", "ANALYST"] as const;
export async function requestReset(fd: FormData) {
  await gate("/forgot", fd, "reset", 5);
  const email = z.string().trim().email().safeParse(fd.get("email")); if (!email.success) fail("/forgot", "Enter a valid email");
  await (await sbServer()).auth.resetPasswordForEmail(email.data!, { redirectTo: `${SITE()}/auth/callback?next=/reset` });
  redirect("/forgot?sent=1"); // same answer whether or not the account exists
}
export async function setPassword(fd: FormData) {
  const p = z.object({ password: z.string().min(12), confirm: z.string() }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/reset", "Use a password of 12+ characters"); if (p.data!.password !== p.data!.confirm) fail("/reset", "The two passwords don't match");
  const weak = await checkPassword(p.data!.password); if (weak) fail("/reset", weak);
  const { error } = await (await sbServer()).auth.updateUser({ password: p.data!.password }); if (error) fail("/reset", error.message);
  redirect("/dashboard");
}
export async function adjustStock(fd: FormData) {
  const c = await guard(STOCK, "/inventory");
  const p = z.object({ productId: z.string(), dir: z.enum(["add", "remove"]), qty: z.coerce.number().int().positive(), reason: z.string().trim().min(3), key: z.string().min(8) }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/inventory", "Choose a product and a whole quantity, and give a reason (3+ characters)");
  const d = p.data!, w = await wh(c.orgId), delta = d.dir === "add" ? d.qty : -d.qty;
  try {
    await db.$transaction(async (tx) => {
      if (!(await tx.product.findFirst({ where: { id: d.productId, orgId: c.orgId } }))) throw new Error("NOPRODUCT");
      await tx.stockBalance.upsert({ where: { productId_warehouseId: { productId: d.productId, warehouseId: w.id } }, update: {}, create: { orgId: c.orgId, productId: d.productId, warehouseId: w.id } });
      const n = await tx.$executeRaw`UPDATE "StockBalance" SET sellable = sellable + ${delta} WHERE "orgId"=${c.orgId} AND "productId"=${d.productId} AND "warehouseId"=${w.id} AND sellable + ${delta} >= reserved`;
      if (n === 0) throw new Error("NEG");
      await tx.stockMovement.create({ data: { orgId: c.orgId, productId: d.productId, warehouseId: w.id, type: "ADJUST", qty: delta, reason: d.reason, actorId: c.user.id, idempotencyKey: `adj:${d.key}` } });
    });
  } catch (e: any) {
    if (e.message === "NEG") fail("/inventory", "That would take sellable stock below the quantity already reserved");
    if (e.message === "NOPRODUCT") fail("/inventory", "Product not found");
    if (e.code !== "P2002") throw e; // P2002 = same adjustment submitted twice; already applied
  }
  await notifyLow(c.orgId, [d.productId]);
  revalidatePath("/inventory"); redirect("/inventory");
}
export async function updateProduct(fd: FormData) {
  const id = String(fd.get("id")), back = `/products/${id}`, c = await guard(STOCK, back);
  const p = z.object({ name: z.string().trim().min(1), hsn: z.string().trim().optional(), price: z.coerce.number().min(0), cost: z.coerce.number().min(0), reorder: z.coerce.number().int().min(0) }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail(back, `Check the ${String(p.error.issues[0].path[0])} field`);
  const r = await db.product.updateMany({ where: { id, orgId: c.orgId }, data: { name: p.data!.name, hsn: p.data!.hsn || null, price: p.data!.price, unitCost: p.data!.cost, reorderAt: p.data!.reorder } });
  if (!r.count) fail("/products", "Product not found");
  revalidatePath("/products"); redirect(`${back}?ok=${encodeURIComponent("Saved")}`);
}
export async function setArchived(fd: FormData) {
  const id = String(fd.get("id")), c = await guard(STOCK, `/products/${id}`), archived = fd.get("archived") === "1";
  await db.product.updateMany({ where: { id, orgId: c.orgId }, data: { archived } });
  revalidatePath("/products"); redirect(archived ? "/products" : `/products/${id}?ok=${encodeURIComponent("Restored")}`);
}
export async function changeRole(fd: FormData) {
  const c = await guard(["OWNER"], "/settings");
  const p = z.object({ id: z.string(), role: z.enum(ROLES5) }).safeParse(Object.fromEntries(fd)); if (!p.success) fail("/settings", "Choose a valid role");
  const m = await db.membership.findFirst({ where: { id: p.data!.id, orgId: c.orgId } }); if (!m) fail("/settings", "Member not found");
  if (m!.userId === c.user.id) fail("/settings", "You can't change your own role");
  await db.$transaction([db.membership.update({ where: { id: m!.id }, data: { role: p.data!.role } }), db.auditLog.create({ data: { orgId: c.orgId, actorId: c.user.id, action: "staff.role_changed", detail: { membership: m!.id, to: p.data!.role } } })]);
  revalidatePath("/settings"); redirect("/settings");
}
export async function removeMember(fd: FormData) {
  const c = await guard(["OWNER"], "/settings"), id = String(fd.get("id"));
  const m = await db.membership.findFirst({ where: { id, orgId: c.orgId } }); if (!m) fail("/settings", "Member not found");
  if (m!.userId === c.user.id) fail("/settings", "You can't remove yourself");
  await db.$transaction([db.membership.delete({ where: { id } }), db.auditLog.create({ data: { orgId: c.orgId, actorId: c.user.id, action: "staff.removed", detail: { membership: id } } })]);
  revalidatePath("/settings"); redirect("/settings");
}

// ---- abuse protection -------------------------------------------------------------------
// In-memory limiter: per server instance only. On Vercel/serverless use a shared store (e.g. Upstash Redis) for hard limits.
const hits = new Map<string, number[]>();
async function throttle(path: string, key: string, max: number, ms = 60_000) {
  const url = process.env.UPSTASH_REDIS_REST_URL, tok = process.env.UPSTASH_REDIS_REST_TOKEN; let n: number | null = null;
  if (url && tok) { // shared store (Upstash Redis REST): limits hold across serverless instances
    try { const r: any = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${tok}` }, body: JSON.stringify([["INCR", `rl:${key}`], ["PEXPIRE", `rl:${key}`, ms, "NX"]]) }).then((x) => x.json()); n = Number(r?.[0]?.result); } catch { n = null; }
  }
  if (n !== null && !Number.isNaN(n)) { if (n > max) fail(path, "Too many attempts. Please wait a few minutes and try again."); return; }
  const now = Date.now(), arr = (hits.get(key) ?? []).filter((t) => now - t < ms); // fallback: per-instance memory
  if (arr.length >= max) fail(path, "Too many attempts. Please wait a few minutes and try again.");
  arr.push(now); hits.set(key, arr); if (hits.size > 5000) hits.clear();
}
async function ip() { return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local"; }
/** Rate limit, then verify the Cloudflare Turnstile token when TURNSTILE_SECRET_KEY is set. */
async function gate(path: string, fd: FormData, name: string, max: number) {
  const who = await ip(), em = String(fd.get("email") ?? "").toLowerCase().slice(0, 100);
  await throttle(path, `${name}:${who}:${em}`, max, 15 * 60_000); await throttle(path, `${name}:${who}`, max * 4, 15 * 60_000);
  const secret = process.env.TURNSTILE_SECRET_KEY; if (!secret) return;
  const r: any = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret, response: String(fd.get("cf-turnstile-response") ?? ""), remoteip: await ip() }) }).then((x) => x.json()).catch(() => ({ success: false }));
  if (!r.success) fail(path, "Please complete the human-verification check and try again.");
}

/** Physical count: sets sellable stock to the counted number via a compare-and-set, so a concurrent stock change can't be overwritten. */
export async function recordCount(fd: FormData) {
  const c = await guard(STOCK, "/counts");
  const p = z.object({ productId: z.string(), counted: z.coerce.number().int().min(0), key: z.string().min(8) }).safeParse(Object.fromEntries(fd));
  if (!p.success) fail("/counts", "Choose a product and enter the counted quantity (a whole number, 0 or more)");
  const d = p.data!, w = await wh(c.orgId); let msg = "";
  try {
    await db.$transaction(async (tx) => {
      const b = await tx.stockBalance.findFirst({ where: { orgId: c.orgId, productId: d.productId, warehouseId: w.id } }); if (!b) throw new Error("NOBAL");
      const delta = d.counted - b.sellable;
      if (delta === 0) { msg = "The count matches the system. No adjustment needed."; return; }
      if (d.counted < b.reserved) throw new Error("RES");
      const n = await tx.$executeRaw`UPDATE "StockBalance" SET sellable=${d.counted} WHERE id=${b.id} AND sellable=${b.sellable}`; if (n === 0) throw new Error("CHANGED");
      await tx.stockMovement.create({ data: { orgId: c.orgId, productId: d.productId, warehouseId: w.id, type: "ADJUST", qty: delta, reason: `Stock count: system ${b.sellable}, counted ${d.counted}`, actorId: c.user.id, idempotencyKey: `cnt:${d.key}` } });
      msg = `Adjusted by ${delta > 0 ? "+" : ""}${delta} to match your count.`;
    });
  } catch (e: any) {
    if (e.message === "NOBAL") fail("/counts", "That product has no stock record yet");
    if (e.message === "RES") fail("/counts", "The counted quantity is below the units already reserved for orders. Resolve those orders first");
    if (e.message === "CHANGED") fail("/counts", "Stock changed while you were counting. Check the system quantity and count again");
    if (e.code === "P2002") msg = "That count was already recorded."; else throw e;
  }
  revalidatePath("/counts"); revalidatePath("/inventory"); redirect(`/counts?ok=${encodeURIComponent(msg)}`);
}

export async function setPayment(fd: FormData) {
  const c = await guard([...SALES, "ACCOUNTANT"], "/orders"), id = String(fd.get("id"));
  const st = z.enum(["UNPAID", "PARTIAL", "PAID", "REFUNDED"]).safeParse(fd.get("status")); if (!st.success) fail(`/orders/${id}`, "Choose a payment status");
  await db.order.updateMany({ where: { id, orgId: c.orgId }, data: { paymentStatus: st.data! } });
  revalidatePath(`/orders/${id}`); redirect(`/orders/${id}`);
}
export async function readNotification(fd: FormData) {
  const c = await ctx(), id = String(fd.get("id")), n = await db.notification.findFirst({ where: { id, orgId: c.orgId } });
  if (n && !n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  redirect(n?.href && n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/notifications");
}
export async function readAll() {
  const c = await ctx(); await db.notification.updateMany({ where: { orgId: c.orgId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications"); redirect("/notifications");
}

const done = (m: string) => redirect(`/settings?ok=${encodeURIComponent(m)}`);
export async function loadSample() {
  const c = await guard(["OWNER"], "/settings"), r = await loadDemo(c.orgId, c.user.id);
  if (!r.ok) fail("/settings", r.error);
  revalidatePath("/", "layout"); done("Sample data added. Open the Dashboard, Orders and Inventory to explore it.");
}
export async function removeSample() {
  const c = await guard(["OWNER"], "/settings"), r = await removeDemo(c.orgId, c.user.id);
  if (!r.ok) fail("/settings", r.error);
  revalidatePath("/", "layout"); done("Sample data removed.");
}
