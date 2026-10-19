import { randomUUID } from "crypto";
import { Shell } from "@/components/Shell"; import { Err, Panel, Table, inp, btn } from "@/components/ui";
import { db } from "@/lib/db"; import { ctx } from "@/lib/ctx"; import { adjustStock } from "../actions";
export const dynamic = "force-dynamic";
export default async function Inventory({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const c = await ctx(), { e } = await searchParams;
  const [bal, mv, ps] = await Promise.all([db.stockBalance.findMany({ where: { orgId: c.orgId }, include: { product: true, warehouse: true } }),
    db.stockMovement.findMany({ where: { orgId: c.orgId }, orderBy: { createdAt: "desc" }, take: 25 }), db.product.findMany({ where: { orgId: c.orgId, archived: false }, orderBy: { name: "asc" } })]);
  const name = Object.fromEntries(bal.map(b => [b.productId, b.product.name]));
  return <Shell title="Inventory" active="Inventory" admin={c.op}><Err e={e} />
    {["OWNER", "INVENTORY_MANAGER"].includes(c.role) && <Panel title="Adjust stock"><form action={adjustStock} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="key" value={randomUUID()} />
      <label className="text-sm">Product<select name="productId" required className={inp}>{ps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm">Change<select name="dir" className={inp}><option value="add">Add units</option><option value="remove">Remove units</option></select></label>
      <label className="text-sm">Quantity<input name="qty" type="number" min={1} required className={inp} /></label>
      <label className="text-sm">Reason<input name="reason" required minLength={3} placeholder="e.g. cycle count" className={inp} /></label>
      <div className="self-end"><button className={`${btn} w-full`}>Record adjustment</button></div></form></Panel>}
    <Table head={["Product","Warehouse","Sellable","Reserved","Available","Damaged"]} empty="No stock yet. Add a product with opening stock." rows={bal.map(b => [b.product.name, b.warehouse.name, b.sellable, b.reserved, <b key="a">{b.sellable - b.reserved}</b>, b.damaged])} />
    <h2 className="font-semibold">Stock ledger (latest 25)</h2>
    <Table head={["When","Product","Type","Qty","Reason"]} empty="No movements yet." rows={mv.map(m => [m.createdAt.toLocaleString("en-IN"), name[m.productId] ?? "—", m.type, m.qty, m.reason ?? "—"])} /></Shell>;
}
