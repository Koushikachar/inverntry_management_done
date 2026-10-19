import Link from "next/link"; import { notFound } from "next/navigation";
import { Shell, Stat } from "@/components/Shell"; import { Err, Panel, Table, ghost, inp } from "@/components/ui";
import { db } from "@/lib/db"; import { ctx } from "@/lib/ctx"; import { orderAct, setPayment } from "../../actions";
export const dynamic = "force-dynamic";
const next: Record<string, [string, string][]> = { DRAFT: [["confirm", "Confirm & reserve stock"], ["cancel", "Cancel order"]], CONFIRMED: [["dispatch", "Dispatch"], ["cancel", "Cancel & release stock"]] };
const hint: Record<string, string> = { DRAFT: "Draft orders don't hold stock.", CONFIRMED: "Stock is reserved. Dispatching deducts it from the shelf.", DISPATCHED: "Shipped. Stock was deducted. To take goods back, log a return.", CANCELLED: "Cancelled. Any reservation was released.", DELIVERED: "Delivered." };
export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const c = await ctx(), { id } = await params, { e } = await searchParams;
  const o = await db.order.findFirst({ where: { id, orgId: c.orgId }, include: { lines: { include: { product: true } } } }); if (!o) notFound();
  const mv = await db.stockMovement.findMany({ where: { orgId: c.orgId, sourceRef: id }, orderBy: { createdAt: "asc" } });
  const names = Object.fromEntries(o.lines.map(l => [l.productId, l.product.name]));
  return <Shell title={`Order #${o.number}`} active="Orders" admin={c.op}><Err e={e} />
    <Link href="/orders" className="text-sm text-brand underline">← All orders</Link>
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4"><Stat label="Status" value={o.status} /><Stat label="Customer" value={o.customer} /><Stat label="Total" value={`₹${o.total}`} /><Stat label="Payment" value={o.paymentStatus} /></div>
    <Panel title="Next step"><p className="mb-3 text-sm text-ink/70">{hint[o.status]}</p><div className="flex flex-wrap gap-2">{(next[o.status] ?? []).map(([a, l]) =>
      <form key={a} action={orderAct}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="act" value={a} /><input type="hidden" name="back" value={`/orders/${o.id}`} /><button className={ghost}>{l}</button></form>)}{!next[o.status] && <span className="text-sm text-ink/60">No actions available.</span>}</div></Panel>
    <Panel title="Payment"><form action={setPayment} className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={o.id} />
      <select name="status" defaultValue={o.paymentStatus} aria-label="Payment status" className={`${inp} w-44`}>{["UNPAID","PARTIAL","PAID","REFUNDED"].map(x => <option key={x}>{x}</option>)}</select><button className={ghost}>Update payment status</button></form></Panel>
    <h2 className="font-semibold">Items</h2>
    <Table head={["Product","Qty","Unit price","Line total"]} empty="No items." rows={o.lines.map(l => [l.product.name, l.qty, `₹${l.unitPrice}`, `₹${(Number(l.unitPrice) * l.qty).toFixed(2)}`])} />
    <h2 className="font-semibold">Stock effects of this order</h2>
    <Table head={["When","Product","Event","Qty"]} empty="No stock has moved for this order yet." rows={mv.map(m => [m.createdAt.toLocaleString("en-IN"), names[m.productId] ?? "—", m.type, m.qty])} /></Shell>;
}
