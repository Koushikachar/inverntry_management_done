import Link from "next/link";
import { unreadCount } from "@/lib/notify";
const nav = ["Dashboard","Products","Inventory","Counts","Orders","Purchases","Receipts","Suppliers","Returns","Analytics","Notifications","Settings"];
const href = (n: string) => (n === "Dashboard" ? "/dashboard" : `/${n.toLowerCase()}`);
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const tabs: [string, string, string][] = [["Home", "Dashboard", "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"], ["Stock", "Inventory", "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3zM3 7.5l9 4.5 9-4.5M12 12v9"],
  ["Orders", "Orders", "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6"], ["Alerts", "Notifications", "M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"]];
const more = ["Products","Counts","Purchases","Receipts","Suppliers","Returns","Analytics","Settings"];
const quick: [string, string][] = [["New order", "/orders"], ["Add product", "/products"], ["Adjust stock", "/inventory"], ["Count stock", "/counts"], ["Receive goods", "/purchases"]];
const badge = (n: number, cls = "") => n > 0 ? <span className={`rounded-full bg-turmeric px-1.5 text-xs font-semibold text-ink ${cls}`}>{n}</span> : null;

function Links({ active, admin, unread }: { active: string; admin?: boolean; unread: number }) {
  return <>{nav.map((n) => <Link key={n} href={href(n)} className={`flex items-center justify-between whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${active === n ? "bg-white/20 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : "text-white/70 hover:bg-white/10"}`}>{n}{n === "Notifications" && badge(unread, "ml-2")}</Link>)}
    {admin && <Link href="/admin" className={`mt-2 whitespace-nowrap rounded-xl border border-turmeric/60 px-3 py-2 text-sm text-turmeric transition hover:bg-turmeric/10 ${active === "Admin" ? "bg-turmeric/15" : ""}`}>Platform admin</Link>}</>;
}

/** Phone layout: thumb-reach bottom tab bar, a "More" sheet, and a floating quick-action button. No JavaScript needed. */
function MobileNav({ active, admin, unread }: { active: string; admin?: boolean; unread: number }) {
  const inMore = more.includes(active) || active === "Admin", sheet = "glass-dark absolute right-0 bottom-[calc(100%+.75rem)] w-64 p-2";
  return <>
    <details key={`q-${active}`} className="fixed right-4 z-30 md:hidden" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
      <summary aria-label="Quick actions" className="grid h-14 w-14 cursor-pointer list-none place-items-center rounded-full bg-gradient-to-b from-teal-400 to-brand text-3xl leading-none text-white shadow-[0_8px_24px_rgba(15,118,110,.5)] transition active:scale-95">+</summary>
      <div className={`${sheet} flex flex-col`}><p className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-white/60">Quick actions</p>{quick.map(([l, h]) => <Link key={l} href={h} className="rounded-xl px-3 py-3 text-sm hover:bg-white/10">{l}</Link>)}</div>
    </details>
    <nav aria-label="Main" className="glass-dark fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 items-stretch px-1.5 pt-1.5 md:hidden" style={{ paddingBottom: "calc(.375rem + env(safe-area-inset-bottom))" }}>
      {tabs.map(([l, n, d]) => <Link key={l} href={href(n)} aria-current={active === n ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${active === n ? "bg-white/20 font-semibold" : "text-white/70"}`}><Icon d={d} />{l}
        {n === "Notifications" && badge(unread, "absolute right-2.5 top-0 !px-1 text-[10px]")}</Link>)}
      <details key={`m-${active}`} className="relative">
        <summary className={`flex cursor-pointer list-none flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${inMore ? "bg-white/20 font-semibold" : "text-white/70"}`}><Icon d="M5 12h.01M12 12h.01M19 12h.01" />More</summary>
        <div className={`${sheet} grid grid-cols-2 gap-1`}>{more.map((n) => <Link key={n} href={href(n)} className={`rounded-xl px-3 py-3 text-sm ${active === n ? "bg-white/20 font-semibold" : "hover:bg-white/10"}`}>{n}</Link>)}
          {admin && <Link href="/admin" className="col-span-2 rounded-xl border border-turmeric/60 px-3 py-3 text-center text-sm text-turmeric">Platform admin</Link>}</div>
      </details>
    </nav></>;
}

export async function Shell({ title, active, admin, children }: { title: string; active: string; admin?: boolean; children: React.ReactNode }) {
  const unread = await unreadCount();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_minmax(0,1fr)] md:gap-4 md:p-4">
      <header className="mx-4 mt-4 md:hidden"><Link href="/dashboard" className="text-lg font-bold">Direct<span className="text-turmeric">2</span>Hub</Link></header>
      <aside className="glass-dark hidden p-5 md:sticky md:top-4 md:block md:h-[calc(100vh-2rem)] md:overflow-y-auto">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight">Direct<span className="text-turmeric">2</span>Hub</Link>
        <nav aria-label="Main" className="mt-6 flex flex-col gap-1"><Links active={active} admin={admin} unread={unread} /></nav>
      </aside>
      <main className="min-w-0 p-4 pb-40 md:p-2 md:pb-2"><h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1><div className="mt-4 space-y-5 md:mt-6 md:space-y-6">{children}</div></main>
      <MobileNav active={active} admin={admin} unread={unread} />
    </div>
  );
}
export function Stat({ label, value, hint, tone = "brand" }: { label: string; value: string | number; hint?: string; tone?: "brand" | "warn" }) {
  return <div className="glass p-4 md:p-5">
    <div className="flex items-center gap-2 text-sm text-ink/60"><span className={`h-2 w-2 shrink-0 rounded-full ${tone === "warn" ? "bg-turmeric" : "bg-brand"}`} />{label}</div>
    <div className="mt-2 break-words text-2xl font-bold tabular-nums tracking-tight sm:text-3xl md:text-4xl">{value}</div>
    {hint && <div className="mt-1 text-xs text-ink/60">{hint}</div>}</div>;
}
