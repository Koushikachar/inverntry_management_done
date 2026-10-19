import { Shell } from "@/components/Shell";
import { Pager, Err, Panel, Table, inp, btn, ghost } from "@/components/ui";
import Link from "next/link";
import { db } from "@/lib/db"; import { ctx } from "@/lib/ctx"; import { addProduct } from "../actions";
export const dynamic = "force-dynamic";
export default async function Products({ searchParams }: { searchParams: Promise<{ e?: string; q?: string; archived?: string; page?: string }> }) {
  const c = await ctx(), { e, q, archived, page } = await searchParams, arch = archived === "1", pg = Math.max(1, Number(page) || 1);
  const ps = await db.product.findMany({ where: { orgId: c.orgId, archived: arch, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, skip: (pg - 1) * 25, take: 26 });
  return <Shell title="Products" active="Products" admin={c.op}><Err e={e} />
    <Panel title="Add product"><form action={addProduct} className="grid gap-3 sm:grid-cols-3">
      {[["sku","SKU"],["name","Name"],["price","Selling price (₹)"],["cost","Unit cost (₹)"],["reorder","Reorder level"],["opening","Opening stock"]].map(([n, l]) =>
        <label key={n} className="text-sm">{l}<input name={n} required type={["sku","name"].includes(n) ? "text" : "number"} min={0} step="any" defaultValue={["reorder","opening"].includes(n) ? 0 : undefined} className={inp} /></label>)}
      <div className="sm:col-span-3"><button className={btn}>Save product</button></div></form></Panel>
    <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Search name or SKU" className={inp} /><button className={ghost}>Search</button><a href={arch ? "/products" : "/products?archived=1"} className={ghost}>{arch ? "Hide archived" : "Show archived"}</a><a href="/products/import" className={ghost}>Import CSV</a><a href="/api/products/export" className={ghost}>Export CSV</a></form>
    <Table head={["SKU","Name","Price","Cost","Reorder at"]} empty="No products yet. Add your first product above." rows={ps.slice(0, 25).map(p => [p.sku, <Link key="n" href={`/products/${p.id}`} className="font-medium text-brand underline">{p.name}</Link>, `₹${p.price}`, `₹${p.unitCost}`, p.reorderAt])} /><Pager page={pg} hasNext={ps.length > 25} params={{ q, archived }} /></Shell>;
}
