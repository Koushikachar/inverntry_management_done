import { db } from "./db";
export const PLANS: Record<string, { label: string; products: number; members: number }> = {
  FREE: { label: "Free", products: 100, members: 3 }, GROWTH: { label: "Growth", products: 5000, members: 15 }, SCALE: { label: "Scale", products: 100000, members: 100 } };
export async function usage(orgId: string) {
  const [o, products, members, invites] = await Promise.all([db.organization.findUnique({ where: { id: orgId } }), db.product.count({ where: { orgId, archived: false } }),
    db.membership.count({ where: { orgId } }), db.invitation.count({ where: { orgId, usedAt: null, expiresAt: { gt: new Date() } } })]);
  return { plan: o?.plan ?? "FREE", ...(PLANS[o?.plan ?? "FREE"] ?? PLANS.FREE), productCount: products, memberCount: members + invites };
}
export async function checkLimit(orgId: string, kind: "products" | "members", adding: number) {
  const u = await usage(orgId);
  if (kind === "products" && u.productCount + adding > u.products) return `Your ${u.label} plan allows ${u.products} products. Ask the platform admin to upgrade your plan.`;
  if (kind === "members" && u.memberCount + adding > u.members) return `Your ${u.label} plan allows ${u.members} team members (pending invitations count).`;
  return null;
}
