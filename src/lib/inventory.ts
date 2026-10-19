import { db } from "./db";
type Dup = { ok: true; replay: true };
/** A concurrent retry with the same idempotency key loses on the unique index; its transaction rolls back, so nothing is applied twice. */
async function dupSafe<T>(f: () => Promise<T>): Promise<T | Dup> {
  try { return await f(); } catch (e: any) { if (e?.code === "P2002") return { ok: true, replay: true }; throw e; }
}

/** Reserve stock atomically: the conditional UPDATE only succeeds while sellable − reserved >= qty. */
export function reserveStock(a: { orgId: string; productId: string; warehouseId: string; qty: number; actorId: string; orderId: string; key: string }) {
  return dupSafe(() => db.$transaction(async (tx) => {
    if (await tx.stockMovement.findUnique({ where: { idempotencyKey: a.key } })) return { ok: true as const, replay: true as const };
    const n = await tx.$executeRaw`UPDATE "StockBalance" SET reserved = reserved + ${a.qty}
      WHERE "orgId"=${a.orgId} AND "productId"=${a.productId} AND "warehouseId"=${a.warehouseId} AND sellable - reserved >= ${a.qty}`;
    if (n === 0) return { ok: false as const, error: "Not enough available stock" };
    await tx.stockMovement.create({ data: { orgId: a.orgId, productId: a.productId, warehouseId: a.warehouseId, type: "RESERVE", qty: a.qty, actorId: a.actorId, sourceRef: a.orderId, idempotencyKey: a.key } });
    return { ok: true as const, replay: false as const };
  }));
}

/** Receive goods against a PO line. Accepted units enter stock; rejected units are recorded but never counted. Retry-safe. */
export function receiveLine(a: { orgId: string; lineId: string; warehouseId: string; qty: number; rejected?: number; note?: string; actorId: string; key: string }) {
  const rej = a.rejected ?? 0;
  return dupSafe(() => db.$transaction(async (tx) => {
    if (await tx.goodsReceipt.findUnique({ where: { idempotencyKey: a.key } })) return { ok: true as const, replay: true as const };
    if (a.qty + rej < 1) return { ok: false as const, error: "Enter an accepted or a rejected quantity" };
    const line = await tx.purchaseOrderLine.findFirst({ where: { id: a.lineId, po: { orgId: a.orgId } }, include: { po: true } });
    if (!line) return { ok: false as const, error: "Purchase order line not found" };
    if (line.po.status !== "ORDERED" && line.po.status !== "PARTIAL") return { ok: false as const, error: "This purchase order isn't open for receiving" };
    const n = await tx.$executeRaw`UPDATE "PurchaseOrderLine" SET received = received + ${a.qty}, rejected = rejected + ${rej} WHERE id=${a.lineId} AND received + ${a.qty} <= qty`;
    if (n === 0) return { ok: false as const, error: "You can't accept more than was ordered" };
    if (a.qty > 0) {
      await tx.stockBalance.upsert({ where: { productId_warehouseId: { productId: line.productId, warehouseId: a.warehouseId } },
        update: { sellable: { increment: a.qty } }, create: { orgId: a.orgId, productId: line.productId, warehouseId: a.warehouseId, sellable: a.qty } });
      await tx.stockMovement.create({ data: { orgId: a.orgId, productId: line.productId, warehouseId: a.warehouseId, type: "RECEIPT", qty: a.qty, actorId: a.actorId, sourceRef: line.poId, idempotencyKey: `grn:${a.key}` } });
    }
    await tx.goodsReceipt.create({ data: { orgId: a.orgId, poId: line.poId, lineId: a.lineId, productId: line.productId, accepted: a.qty, rejected: rej, note: a.note || null, actorId: a.actorId, idempotencyKey: a.key } });
    if (rej > 0) await tx.notification.create({ data: { orgId: a.orgId, kind: "discrepancy", title: "Rejected goods on delivery", body: `${rej} unit(s) rejected${a.note ? `: ${a.note}` : ""}`, href: "/receipts" } });
    const all = await tx.purchaseOrderLine.findMany({ where: { poId: line.poId } });
    await tx.purchaseOrder.update({ where: { id: line.poId }, data: { status: all.every((l) => l.received >= l.qty) ? "RECEIVED" : "PARTIAL" } });
    return { ok: true as const, replay: false as const };
  }));
}

/** Reserve every line of an order in ONE transaction: all lines are reserved or none are. */
export async function reserveMany(a: { orgId: string; warehouseId: string; actorId: string; orderId: string; lines: { id: string; productId: string; qty: number }[] }) {
  try {
    return await db.$transaction(async (tx) => {
      for (const l of [...a.lines].sort((x, y) => x.productId.localeCompare(y.productId))) { // stable order avoids deadlocks
        if (await tx.stockMovement.findUnique({ where: { idempotencyKey: `res:${l.id}` } })) continue;
        const n = await tx.$executeRaw`UPDATE "StockBalance" SET reserved = reserved + ${l.qty} WHERE "orgId"=${a.orgId} AND "productId"=${l.productId} AND "warehouseId"=${a.warehouseId} AND sellable - reserved >= ${l.qty}`;
        if (n === 0) throw new Error("STOCK:" + l.productId);
        await tx.stockMovement.create({ data: { orgId: a.orgId, productId: l.productId, warehouseId: a.warehouseId, type: "RESERVE", qty: l.qty, actorId: a.actorId, sourceRef: a.orderId, idempotencyKey: `res:${l.id}` } });
      }
      return { ok: true as const };
    });
  } catch (e: any) {
    if (e?.message?.startsWith("STOCK:")) { const p = await db.product.findUnique({ where: { id: e.message.slice(6) } }); return { ok: false as const, error: `Not enough available stock for ${p?.name ?? "a product"}` }; }
    if (e?.code === "P2002") return { ok: true as const };
    throw e;
  }
}
