import Link from "next/link";
import { Pager } from "@/components/ui";
import { Shell } from "@/components/Shell"; import { Err, Panel, Table, inp, btn, ghost } from "@/components/ui";
import { db } from "@/lib/db"; import { ctx } from "@/lib/ctx"; import { createOrder, orderAct } from "../actions";
export const dynamic = "force-dynamic";
const next: Record<string, [string, string][]> = { DRAFT: [["confirm", "Confirm & reserve"], ["cancel", "Cancel"]], CONFIRMED: [["dispatch", "Dispatch"], ["cancel", "Cancel"]] };
export default async function Orders({ searchParams }: { searchParams: Promise<{ e?: string; page?: string }> }) {
  const c = await ctx(), { e, page } = await searchParams, pg = Math.max(1, Number(page) || 1);
  const [os, ps] = await Promise.all([db.order.findMany({ where: { orgId: c.orgId }, orderBy: { number: "desc" }, skip: (pg - 1) * 25, take: 26, include: { lines: { include: { product: true } } } }), db.product.findMany({ where: { orgId: c.orgId, archived: false } })]);
  return <Shell title="Orders" active="Orders" admin={c.op}><Err e={e} />
    <Panel title="New order"><form action={createOrder} className="space-y-3">
      <label className="block text-sm sm:max-w-xs">Customer<input name="customer" required className={inp} /></label>
      {[1,2,3,4,5].map(i => <div key={i} className="grid gap-3 sm:grid-cols-[1fr_120px]"><select name={`p${i}`} aria-label={`Product ${i}`} defaultValue="" className={inp}><option value="">{i === 1 ? "Choose a product" : "Add another product (optional)"}</option>{ps.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select>
        <input name={`q${i}`} type="number" min={1} defaultValue={1} aria-label={`Quantity ${i}`} className={inp} /></div>)}
      <button className={btn}>Create draft</button></form></Panel>
    <Table head={["#","Customer","Items","Total","Status","Actions"]} empty="No orders yet. Create a draft above." rows={os.slice(0, 25).map(o => [<Link key="n" href={`/orders/${o.id}`} className="font-semibold text-brand underline">#{o.number}</Link>, o.customer, o.lines.map(l => `${l.qty}× ${l.product.name}`).join(", "), `₹${o.total}`, o.status,
      <div key="a" className="flex gap-2">{(next[o.status] ?? []).map(([a, l]) => <form key={a} action={orderAct}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="act" value={a} /><button className={ghost}>{l}</button></form>)}</div>])} /><Pager page={pg} hasNext={os.length > 25} /></Shell>;
}
