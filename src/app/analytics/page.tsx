import { Shell, Stat } from "@/components/Shell";
import { db } from "@/lib/db"; import { ctx } from "@/lib/ctx";
export const dynamic = "force-dynamic";
export default async function Analytics() {
  const c = await ctx();
  const [lines, ps] = await Promise.all([db.orderLine.findMany({ where: { order: { orgId: c.orgId, status: { in: ["DISPATCHED", "DELIVERED"] } } } }), db.product.findMany({ where: { orgId: c.orgId } })]);
  const cost = Object.fromEntries(ps.map(p => [p.id, Number(p.unitCost)])), nm = Object.fromEntries(ps.map(p => [p.id, p.name]));
  const by: Record<string, number> = {}; let rev = 0, cogs = 0;
  for (const l of lines) { const r = Number(l.unitPrice) * l.qty; rev += r; cogs += (cost[l.productId] ?? 0) * l.qty; by[l.productId] = (by[l.productId] ?? 0) + r; }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8), max = top[0]?.[1] ?? 1;
  return <Shell title="Analytics" active="Analytics" admin={c.op}>
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Revenue (dispatched)" value={`₹${rev.toFixed(0)}`} hint="Price × qty, before returns" /><Stat label="Cost of goods" value={`₹${cogs.toFixed(0)}`} /><Stat label="Gross profit" value={`₹${(rev - cogs).toFixed(0)}`} hint="Revenue − cost of goods" /></div>
    <section className="glass p-5"><h2 className="font-semibold">Top products by revenue</h2>
      {top.length === 0 ? <p className="mt-2 text-sm text-ink/60">No dispatched orders yet. Dispatch an order to see sales here.</p> :
        <ul className="mt-3 space-y-2">{top.map(([id, v]) => <li key={id} className="text-sm"><div className="flex justify-between"><span>{nm[id]}</span><span className="tabular-nums">₹{v.toFixed(0)}</span></div>
          <div className="mt-1 h-2 rounded bg-mist"><div className="h-2 rounded bg-brand" style={{ width: `${(v / max) * 100}%` }} /></div></li>)}</ul>}</section></Shell>;
}
