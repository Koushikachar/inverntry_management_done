import { notFound } from "next/navigation";
import { Shell, Stat } from "@/components/Shell"; import { Err, Panel, Table, inp, btn, ghost } from "@/components/ui";
import { db } from "@/lib/db"; import { ctx } from "@/lib/ctx"; import { updateProduct, setArchived } from "../../actions";
export const dynamic = "force-dynamic";
export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; ok?: string }> }) {
  const c = await ctx(), { id } = await params, { e, ok } = await searchParams;
  const p = await db.product.findFirst({ where: { id, orgId: c.orgId }, include: { balances: true } }); if (!p) notFound();
  const mv = await db.stockMovement.findMany({ where: { orgId: c.orgId, productId: id }, orderBy: { createdAt: "desc" }, take: 30 });
  const s = (k: "sellable" | "reserved" | "damaged") => p.balances.reduce((t, b) => t + b[k], 0), can = ["OWNER", "INVENTORY_MANAGER"].includes(c.role);
  const F = ([n, l, v, t]: string[]) => <label key={n} className="text-sm">{l}<input name={n} defaultValue={v} required={n !== "hsn"} type={t} step="any" min={t === "number" ? 0 : undefined} disabled={!can} className={inp} /></label>;
  return <Shell title={p.name} active="Products" admin={c.op}><Err e={e} />{ok && <p role="status" className="glass px-4 py-2 text-sm text-brand">{ok}</p>}
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4"><Stat label="Sellable" value={s("sellable")} /><Stat label="Reserved" value={s("reserved")} /><Stat label="Available" value={s("sellable") - s("reserved")} /><Stat label="Damaged" value={s("damaged")} tone="warn" /></div>
    <Panel title={`Details · ${p.sku}${p.archived ? " · archived" : ""}`}><form action={updateProduct} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><input type="hidden" name="id" value={p.id} />
      {[["name","Name",p.name,"text"],["hsn","HSN code",p.hsn ?? "","text"],["price","Selling price (₹)",String(p.price),"number"],["cost","Unit cost (₹)",String(p.unitCost),"number"],["reorder","Reorder level",String(p.reorderAt),"number"]].map(F)}
      {can && <div className="flex items-end gap-2"><button className={btn}>Save changes</button></div>}</form>
      {can && <form action={setArchived} className="mt-3"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="archived" value={p.archived ? "0" : "1"} /><button className={ghost}>{p.archived ? "Restore product" : "Archive product"}</button></form>}</Panel>
    <h2 className="font-semibold">Stock history</h2>
    <Table head={["When","Type","Qty","Reason"]} empty="No stock activity yet." rows={mv.map(m => [m.createdAt.toLocaleString("en-IN"), m.type, m.qty, m.reason ?? "—"])} /></Shell>;
}
