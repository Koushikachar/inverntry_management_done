import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db"; import { getUser } from "./auth";
/** Best-effort: one unread low-stock alert per product until someone reads it. Never blocks the user's action. */
export async function notifyLow(orgId: string, productIds: string[]) {
  try {
    for (const id of new Set(productIds)) {
      const p = await db.product.findFirst({ where: { id, orgId } }); if (!p) continue;
      const b = await db.stockBalance.aggregate({ where: { orgId, productId: id }, _sum: { sellable: true, reserved: true } });
      const avail = (b._sum.sellable ?? 0) - (b._sum.reserved ?? 0), href = `/products/${id}`;
      if (avail > p.reorderAt || (await db.notification.findFirst({ where: { orgId, kind: "low_stock", href, readAt: null } }))) continue;
      await db.notification.create({ data: { orgId, kind: "low_stock", title: `Low stock: ${p.name}`, body: `${avail} available (reorder level ${p.reorderAt})`, href } });
    }
  } catch (e) { console.error("notifyLow failed", (e as Error).message); }
}
export const unreadCount = cache(async () => {
  const u = await getUser(); if (!u) return 0;
  try { // a badge must never take a whole page down (e.g. notifications table not migrated yet)
    const pick = (await cookies()).get("org")?.value, ms = await db.membership.findMany({ where: { userId: u.id } });
    const m = ms.find((x) => x.orgId === pick) ?? ms.find((x) => x.role !== "PLATFORM_OPERATOR") ?? ms[0];
    return m ? await db.notification.count({ where: { orgId: m.orgId, readAt: null } }) : 0;
  } catch (e) { console.error("unreadCount failed", (e as Error).message); return 0; }
});
