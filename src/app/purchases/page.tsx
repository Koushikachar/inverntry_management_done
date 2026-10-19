import { randomUUID } from "crypto";
import { Shell } from "@/components/Shell"; import { Err, Panel, Table, inp, btn, ghost } from "@/components/ui";
import { db } from "@/lib/db"; import { ctx } from "@/lib/ctx"; import { addPO, receivePO } from "../actions";
export const dynamic = "force-dynamic";
export default async function Purchases({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const c = await ctx(), { e } = await searchParams;
  const [pos, ss, ps] = await Promise.all([db.purchaseOrder.findMany({ where: { orgId: c.orgId }, include: { supplier: true, lines: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.supplier.findMany({ where: { orgId: c.orgId } }), db.product.findMany({ where: { orgId: c.orgId, archived: false } })]);
  const nm = Object.fromEntries(ps.map(p => [p.id, p.name]));
  const rows = pos.flatMap(po => po.lines.map(l => { const left = l.qty - l.received, open = (po.status === "ORDERED" || po.status === "PARTIAL") && left > 0;
    return [po.supplier.name, nm[l.productId], l.qty, l.received, l.rejected, po.status, open ?
      <form key={l.id} action={receivePO} className="grid min-w-[220px] grid-cols-2 gap-2"><input type="hidden" name="lineId" value={l.id} /><input type="hidden" name="key" value={randomUUID()} />
        <label className="text-xs">Accepted<input name="qty" type="number" min={0} max={left} defaultValue={left} className={inp} /></label><label className="text-xs">Rejected<input name="rejected" type="number" min={0} defaultValue={0} className={inp} /></label>
        <input name="note" placeholder="Note (damaged, wrong item…)" aria-label="Note" className={`${inp} col-span-2`} /><button className={`${ghost} col-span-2 py-2`}>Record receipt</button></form> : "—"]; }));
  return <Shell title="Purchases" active="Purchases" admin={c.op}><Err e={e} />
    <Panel title="New purchase order"><p className="mb-3 text-sm text-ink/60">Stock only increases when you receive goods below, not when you create the order.</p>
      <form action={addPO} className="grid gap-3 sm:grid-cols-5">
        <label className="text-sm">Supplier<select name="supplierId" required className={inp}>{ss.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">Product<select name="productId" required className={inp}>{ps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="text-sm">Quantity<input name="qty" type="number" min={1} required className={inp} /></label>
        <label className="text-sm">Unit cost (₹)<input name="unitCost" type="number" min={0} step="any" required className={inp} /></label>
        <div className="self-end"><button className={btn}>Create PO</button></div></form></Panel>
    <Table head={["Supplier","Product","Ordered","Accepted","Rejected","Status","Receive goods"]} empty="No purchase orders yet." rows={rows} /></Shell>;
}
