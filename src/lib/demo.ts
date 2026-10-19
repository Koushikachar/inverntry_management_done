import { randomUUID, createHash } from "crypto";
import type { OrderStatus, PaymentStatus, MoveType, ReturnStatus } from "@prisma/client";
import { db } from "./db"; import { notifyLow } from "./notify";
const ago = (d: number) => new Date(Date.now() - d * 864e5), KEY = (orgId: string) => `demo:${orgId}:`;

/** Sample data for EVERY screen: products, stock, counts, orders, purchases, receipts, suppliers, returns, notifications, team invite.
 *  All rows are labelled "Demo ·" / "DEMO-" and removable. Stock balances and the ledger stay consistent. */
export async function loadDemo(orgId: string, actorId: string) {
  if (await db.product.findFirst({ where: { orgId, sku: { startsWith: "DEMO-" } } })) return { ok: false as const, error: "Sample data is already loaded. Remove it first to reload a fresh copy" };
  const w = await db.warehouse.findFirst({ where: { orgId } }); if (!w) return { ok: false as const, error: "This organization has no warehouse yet" };
  const P: [string, string, number, number, number, number][] = [["TEE-M", "Cotton Tee (M)", 499, 220, 20, 120], ["TEE-L", "Cotton Tee (L)", 499, 220, 20, 80], ["MUG", "Steel Mug", 349, 140, 15, 40], ["BAG", "Tote Bag", 299, 90, 25, 18],
    ["CAP", "Cap", 249, 80, 10, 60], ["BTL", "Water Bottle", 599, 260, 10, 8], ["NTB", "Notebook", 149, 45, 30, 200], ["PEN", "Gel Pen Pack", 99, 30, 40, 150]];
  const ids: string[] = [];
  await db.$transaction(async (tx) => {
    const prod: Record<string, { id: string; price: number; name: string }> = {}, bal: Record<string, { sellable: number; reserved: number; damaged: number }> = {}, mv: any[] = []; let seq = 0;
    const move = (productId: string, type: MoveType, qty: number, d: number, reason?: string, ref?: string) =>
      mv.push({ orgId, productId, warehouseId: w.id, type, qty, reason, sourceRef: ref, actorId, createdAt: ago(d), idempotencyKey: `${KEY(orgId)}${++seq}` });
    for (const [sku, name, price, cost, reorder, open] of P) {
      const p = await tx.product.create({ data: { orgId, sku: `DEMO-${sku}`, name: `Demo · ${name}`, price, unitCost: cost, reorderAt: reorder } });
      prod[sku] = { id: p.id, price, name: p.name }; bal[sku] = { sellable: open, reserved: 0, damaged: 0 }; ids.push(p.id); move(p.id, "OPENING", open, 14, "Demo opening stock");
    }
    let num = (await tx.order.aggregate({ where: { orgId }, _max: { number: true } }))._max.number ?? 0;
    const order = async (customer: string, status: OrderStatus, pay: PaymentStatus, d: number, items: [string, number][]) => {
      const o = await tx.order.create({ data: { orgId, number: ++num, customer, status, paymentStatus: pay, createdAt: ago(d), total: items.reduce((t, [s, q]) => t + prod[s].price * q, 0),
        lines: { create: items.map(([s, q]) => ({ productId: prod[s].id, qty: q, unitPrice: prod[s].price })) } } });
      if (status === "DRAFT") return;
      for (const [s, q] of items) { const id = prod[s].id; move(id, "RESERVE", q, d, undefined, o.id); bal[s].reserved += q;
        if (status === "DISPATCHED") { move(id, "DISPATCH", q, Math.max(d - 1, 0), undefined, o.id); bal[s].sellable -= q; bal[s].reserved -= q; }
        if (status === "CANCELLED") { move(id, "RELEASE", q, Math.max(d - 1, 0), undefined, o.id); bal[s].reserved -= q; } }
    };
    await order("Asha Traders", "DISPATCHED", "PAID", 12, [["TEE-M", 10], ["MUG", 5]]);
    await order("Lakshmi Emporium", "DISPATCHED", "PAID", 11, [["NTB", 30], ["PEN", 20]]);
    await order("Rahul Stores", "DISPATCHED", "PAID", 9, [["TEE-L", 6], ["CAP", 8]]);
    await order("Vikram Books", "DISPATCHED", "PAID", 8, [["NTB", 25]]);
    await order("Pooja Stationers", "DISPATCHED", "UNPAID", 7, [["PEN", 35], ["CAP", 5]]);
    await order("Meera Boutique", "DISPATCHED", "UNPAID", 6, [["BAG", 4], ["CAP", 6]]);
    await order("Anand Gifts", "DISPATCHED", "PARTIAL", 4, [["MUG", 6], ["BAG", 3]]);
    await order("Kiran Gifts", "DISPATCHED", "PAID", 3, [["TEE-M", 12], ["BTL", 2]]);
    await order("Farah Fashion", "DISPATCHED", "PAID", 1, [["TEE-L", 9], ["TEE-M", 7]]);
    await order("Sana Retail", "CONFIRMED", "PARTIAL", 2, [["TEE-L", 8], ["MUG", 4]]);
    await order("Dev Mart", "DRAFT", "UNPAID", 1, [["BTL", 2]]);
    await order("Online Buyer", "CANCELLED", "UNPAID", 5, [["MUG", 3]]);

    const sup = await tx.supplier.create({ data: { orgId, name: "Demo · Textiles Pvt Ltd", phone: "+91 98450 00001", email: "demo-textiles@example.com" } });
    const sup2 = await tx.supplier.create({ data: { orgId, name: "Demo · Steelworks India", phone: "+91 98450 00002", email: "demo-steel@example.com" } });
    const sup3 = await tx.supplier.create({ data: { orgId, name: "Demo · Stationery House", phone: "+91 98450 00003", email: "demo-stationery@example.com" } });
    await tx.supplier.createMany({ data: [{ orgId, name: "Demo · Packaging Co", phone: "+91 98450 00004", email: "demo-pack@example.com" }, { orgId, name: "Demo · Leather Crafts", phone: "+91 98450 00005" }] });
    const po1 = await tx.purchaseOrder.create({ data: { orgId, supplierId: sup.id, status: "PARTIAL", total: 8500, createdAt: ago(8), lines: { create: { productId: prod.BAG.id, qty: 100, received: 60, rejected: 5, unitCost: 85 } } }, include: { lines: true } });
    move(prod.BAG.id, "RECEIPT", 60, 4, "Demo partial delivery", po1.id); bal.BAG.sellable += 60;
    await tx.goodsReceipt.create({ data: { orgId, poId: po1.id, lineId: po1.lines[0].id, productId: prod.BAG.id, accepted: 60, rejected: 5, note: "5 torn straps", actorId, idempotencyKey: `${KEY(orgId)}grn1`, createdAt: ago(4) } });
    const po3 = await tx.purchaseOrder.create({ data: { orgId, supplierId: sup3.id, status: "RECEIVED", total: 4000, createdAt: ago(10), lines: { create: { productId: prod.NTB.id, qty: 100, received: 100, unitCost: 40 } } }, include: { lines: true } });
    move(prod.NTB.id, "RECEIPT", 100, 6, "Demo full delivery", po3.id); bal.NTB.sellable += 100;
    await tx.goodsReceipt.create({ data: { orgId, poId: po3.id, lineId: po3.lines[0].id, productId: prod.NTB.id, accepted: 100, rejected: 0, note: "All items checked", actorId, idempotencyKey: `${KEY(orgId)}grn2`, createdAt: ago(6) } });
    await tx.purchaseOrder.create({ data: { orgId, supplierId: sup2.id, status: "ORDERED", total: 12000, createdAt: ago(2), expectedOn: ago(-5), lines: { create: { productId: prod.BTL.id, qty: 50, unitCost: 240 } } } });

    const ret = async (sku: string, qty: number, reason: string, status: ReturnStatus, d: number) => {
      const r = await tx.return.create({ data: { orgId, productId: prod[sku].id, qty, reason, status, createdAt: ago(d) } });
      if (status === "RESTOCKED") { move(prod[sku].id, "RETURN_RESTOCK", qty, d, "Demo return restocked", r.id); bal[sku].sellable += qty; }
      if (status === "DAMAGED") { move(prod[sku].id, "DAMAGE", qty, d, "Demo return damaged", r.id); bal[sku].damaged += qty; }
    };
    await ret("TEE-L", 1, "Changed mind", "RESTOCKED", 3); await ret("BAG", 2, "Arrived damaged", "DAMAGED", 2); await ret("TEE-M", 1, "Wrong size", "PENDING", 1);

    // Stock counts and a manual adjustment (shown on Counts and Inventory)
    const cap = bal.CAP.sellable; bal.CAP.sellable -= 2; move(prod.CAP.id, "ADJUST", -2, 2, `Stock count: system ${cap}, counted ${cap - 2}`);
    const mug = bal.MUG.sellable; bal.MUG.sellable += 5; move(prod.MUG.id, "ADJUST", 5, 3, `Stock count: system ${mug}, counted ${mug + 5}`);
    bal["TEE-M"].sellable -= 3; move(prod["TEE-M"].id, "ADJUST", -3, 5, "Demo: water damage in storage");

    for (const sku of Object.keys(bal)) await tx.stockBalance.create({ data: { orgId, productId: prod[sku].id, warehouseId: w.id, ...bal[sku] } });
    await tx.stockMovement.createMany({ data: mv });
    await tx.notification.createMany({ data: [
      { orgId, kind: "discrepancy", title: "Rejected goods on delivery", body: "5 unit(s) rejected: 5 torn straps", href: "/receipts", createdAt: ago(4) },
      { orgId, kind: "return", title: `Return waiting for inspection: ${prod["TEE-M"].name}`, body: "1 unit, reason: Wrong size", href: "/returns", createdAt: ago(1) },
      { orgId, kind: "import", title: "Product import finished", body: "8 imported, 0 skipped (demo)", href: "/products", readAt: ago(10), createdAt: ago(14) }] });
    await tx.invitation.create({ data: { orgId, email: "demo-newhire@example.com", role: "ORDER_STAFF", tokenHash: createHash("sha256").update(randomUUID()).digest("hex"), expiresAt: ago(-7) } });
    await tx.auditLog.create({ data: { orgId, actorId, action: "demo.loaded" } });
  }, { timeout: 60000, maxWait: 10000 });
  await notifyLow(orgId, ids);
  return { ok: true as const };
}

/** Deletes the demo products and everything that touches them (including orders you made from them). Only ever used on demo rows. */
export async function removeDemo(orgId: string, actorId: string) {
  const ids = (await db.product.findMany({ where: { orgId, sku: { startsWith: "DEMO-" } }, select: { id: true } })).map((p) => p.id);
  if (!ids.length) return { ok: false as const, error: "There is no sample data to remove" };
  await db.$transaction(async (tx) => {
    const oids = [...new Set((await tx.orderLine.findMany({ where: { productId: { in: ids } }, select: { orderId: true } })).map((l) => l.orderId))];
    await tx.orderLine.deleteMany({ where: { orderId: { in: oids } } }); await tx.order.deleteMany({ where: { orgId, id: { in: oids } } });
    const pids = (await tx.purchaseOrder.findMany({ where: { orgId, supplier: { name: { startsWith: "Demo ·" } } }, select: { id: true } })).map((p) => p.id);
    await tx.goodsReceipt.deleteMany({ where: { orgId, OR: [{ productId: { in: ids } }, { poId: { in: pids } }] } });
    await tx.purchaseOrderLine.deleteMany({ where: { OR: [{ productId: { in: ids } }, { poId: { in: pids } }] } }); await tx.purchaseOrder.deleteMany({ where: { orgId, id: { in: pids } } });
    await tx.supplier.deleteMany({ where: { orgId, name: { startsWith: "Demo ·" } } });
    await tx.return.deleteMany({ where: { orgId, productId: { in: ids } } });
    await tx.stockMovement.deleteMany({ where: { orgId, productId: { in: ids } } }); await tx.stockBalance.deleteMany({ where: { orgId, productId: { in: ids } } });
    await tx.notification.deleteMany({ where: { orgId, OR: [{ title: { startsWith: "Low stock: Demo" } }, { kind: "discrepancy", body: { contains: "torn straps" } }, { kind: "return", title: { contains: "Demo ·" } }, { kind: "import", body: { contains: "(demo)" } }] } });
    await tx.invitation.deleteMany({ where: { orgId, email: { startsWith: "demo-" }, usedAt: null } });
    await tx.product.deleteMany({ where: { orgId, id: { in: ids } } });
    await tx.auditLog.create({ data: { orgId, actorId, action: "demo.removed" } });
  }, { timeout: 60000, maxWait: 10000 });
  return { ok: true as const };
}
