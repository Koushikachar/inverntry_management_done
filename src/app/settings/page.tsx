import { Shell } from "@/components/Shell"; import { Err, Panel, Table, inp, btn, ghost } from "@/components/ui";
import { db } from "@/lib/db"; import { usage } from "@/lib/plan"; import { ctx } from "@/lib/ctx"; import { signOut, inviteStaff, setOrg, changeRole, removeMember, loadSample, removeSample } from "../actions";
const ROLES = ["OWNER","INVENTORY_MANAGER","ORDER_STAFF","ACCOUNTANT","ANALYST"];
export const dynamic = "force-dynamic";
export default async function Settings({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const c = await ctx(), { e, ok } = await searchParams, u = await usage(c.orgId);
  const [staff, pend] = await Promise.all([db.membership.findMany({ where: { orgId: c.orgId }, include: { user: true } }), db.invitation.findMany({ where: { orgId: c.orgId, usedAt: null, expiresAt: { gt: new Date() } } })]);
  return <Shell title="Settings" active="Settings" admin={c.op}><Err e={e} />{ok && <p role="status" className="rounded-lg bg-brand/10 px-4 py-2 text-sm text-brand">{ok}</p>}
    <Panel title="Account"><dl className="space-y-1 text-sm"><div>Business: <b>{c.orgName}</b></div><div>Email: <b>{c.user.email}</b></div><div>Role: <b>{c.role}</b></div></dl>
      <form action={signOut} className="mt-4"><button className={ghost}>Sign out</button></form></Panel>
    <Panel title={`Plan: ${u.label}`}><p className="text-sm">{u.productCount} of {u.products} products · {u.memberCount} of {u.members} team members (invitations included)</p><p className="mt-1 text-xs text-ink/60">Plans are changed by the platform admin. Online payment isn't available yet.</p></Panel>
    {c.role === "OWNER" && <Panel title="Sample data"><p className="text-sm text-ink/70">Add demo products, orders, a supplier, purchase orders and a return so you can try every screen. Everything is labelled "Demo" and can be removed.</p>
      <div className="mt-3 flex flex-wrap gap-2"><form action={loadSample}><button className={btn}>Load sample data</button></form><form action={removeSample}><button className={ghost}>Remove sample data</button></form></div>
      <p className="mt-2 text-xs text-ink/60">Removing also deletes any orders you created using the demo products.</p></Panel>}
    <Panel title="Your organizations"><div className="flex flex-wrap gap-2">{c.orgs.map(o => o.id === c.orgId ? <span key={o.id} className="rounded-lg bg-brand px-3 py-1 text-sm text-white">{o.name} (active)</span> :
      <form key={o.id} action={setOrg}><input type="hidden" name="id" value={o.id} /><button className={ghost}>{o.name}</button></form>)}<a href="/onboarding" className={ghost}>Create another organization</a></div></Panel>
    <h2 className="font-semibold">Team</h2>
    <Table head={["Name / email","Role"]} empty="No members." rows={[...staff.map(s => [s.user.email, s.role]), ...pend.map(i => [`${i.email} (invited)`, i.role])]} />
    {c.role === "OWNER" && <Panel title="Invite a team member"><form action={inviteStaff} className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">Email<input name="email" type="email" required className={inp} /></label>
      <label className="text-sm">Role<select name="role" className={inp}>{["INVENTORY_MANAGER","ORDER_STAFF","ACCOUNTANT","ANALYST"].map(r => <option key={r}>{r}</option>)}</select></label>
      <div className="self-end"><button className={btn}>Send invitation</button></div></form></Panel>}</Shell>;
}
