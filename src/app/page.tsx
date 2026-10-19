import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { Bricolage_Grotesque } from "next/font/google";
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"] });
const features = [
  ["Never oversell", "Confirming an order reserves stock in one step. Two people can't promise the same last unit."],
  ["A trail for every unit", "Receipts, reservations, dispatches and returns are written to a ledger that is never edited, only added to."],
  ["Receive what actually arrives", "Purchase orders don't touch stock. Count goods in, partial deliveries included, and the shelf updates."],
  ["Returns are inspected first", "Restock the good ones, move the damaged ones aside. Nothing becomes sellable by accident."],
  ["Bring your catalog", "Import products from a CSV, see every row that needs fixing, then confirm."],
  ["Your team, your rules", "Invite staff by email as managers, order staff, accountants or analysts. Each sees only their business."],
];
const flow = [["Order confirmed", "25 units move from available to reserved."], ["Order dispatched", "The reservation turns into a deduction from the shelf."], ["Return arrives", "It waits for inspection. Good stock returns, damaged stock stays out."]];
export default function Home() {
  return (
    <div className="text-ink">
      <header className="glass sticky top-3 z-10 mx-3 mt-3 flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 md:mx-auto md:px-6 md:py-3">
        <div className="whitespace-nowrap text-lg font-bold md:text-xl">Direct<span className="text-turmeric">2</span>Hub</div>
        <nav className="flex items-center gap-1 whitespace-nowrap text-sm md:gap-3"><a href="#how" className="hidden px-2 hover:underline sm:block">How it works</a>
          <Link href="/login" className="px-2 py-2 hover:underline">Sign in</Link>
          <Link href="/register" className="rounded-lg bg-ink px-3 py-2 font-semibold text-white transition-colors hover:bg-brandDark md:px-4"><span className="sm:hidden">Sign up</span><span className="hidden sm:inline">Create account</span></Link></nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className={`${display.className} text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl`}>Know what you can actually sell.</h1>
          <p className="mt-6 max-w-lg text-lg text-ink/70">Inventory software for Indian sellers, wholesalers and distributors. It separates what is on the shelf from what is already promised, and keeps a record of every change.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-lg bg-brand px-6 py-3 font-semibold text-white transition-colors hover:bg-brandDark">Create your account</Link>
            <Link href="/login" className="glass px-6 py-3 font-medium transition-colors hover:bg-white/60">Sign in</Link></div>
        </div>
        <div className="rounded-2xl glass-dark p-6" aria-label="Example stock calculation">
          <div className="flex items-baseline justify-between text-sm text-white/60"><span>Cotton Tee M</span><span>Example</span></div>
          <div className="mt-4 flex items-end gap-3"><span className={`${display.className} text-7xl font-extrabold leading-none tabular-nums`}>75</span><span className="pb-2 text-white/70">available to sell</span></div>
          <p className="mt-2 text-sm text-white/60">100 sellable − 25 reserved</p>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/10"><div className="bg-brand" style={{ width: "75%" }} /><div className="bg-turmeric" style={{ width: "25%" }} /></div>
          <div className="mt-2 flex justify-between text-xs text-white/60"><span>Available</span><span>Reserved</span></div>
          <ul className="mt-6 divide-y divide-white/10 text-sm">{[["Goods received", "+100"], ["Order #1042 confirmed", "25 reserved"], ["Return inspected: damaged", "2 set aside"]].map(([a, b]) =>
            <li key={a} className="flex justify-between py-2.5"><span>{a}</span><span className="tabular-nums text-white/70">{b}</span></li>)}</ul>
        </div>
      </section>

      <section className="glass mx-3 my-6 max-w-6xl md:mx-auto">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className={`${display.className} text-3xl font-extrabold leading-tight md:text-4xl`}>The boring parts, done carefully.</h2>
          <dl className="divide-y divide-white/70">{features.map(([t, d]) => <div key={t} className="grid gap-1 py-5 sm:grid-cols-[220px_1fr] sm:gap-6"><dt className="font-semibold">{t}</dt><dd className="text-ink/70">{d}</dd></div>)}</dl>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className={`${display.className} text-3xl font-extrabold md:text-4xl`}>Follow one sale</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">{flow.map(([t, d], i) => <li key={t} className="border-l-4 border-brand pl-5"><div className="font-semibold">Step {i + 1}: {t}</div><p className="mt-1 text-ink/70">{d}</p></li>)}</ol>
      </section>

      <section className="glass-dark mx-3 my-8 max-w-6xl md:mx-auto"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-14">
        <p className={`${display.className} max-w-md text-3xl font-extrabold leading-tight`}>Start with your own products today.</p>
        <Link href="/register" className="rounded-lg bg-turmeric px-6 py-3 font-semibold text-ink transition-all hover:brightness-110">Create your account</Link></div></section>
      <SiteFooter />
    </div>
  );
}
