import Link from "next/link"; import SiteFooter from "./SiteFooter";
export default function Legal({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><header className="mx-auto max-w-3xl px-6 pt-6"><Link href="/" className="text-lg font-bold">Direct<span className="text-turmeric">2</span>Hub</Link></header>
    <main className="glass mx-3 my-6 max-w-3xl space-y-4 p-6 text-sm leading-relaxed md:mx-auto md:p-10"><h1 className="text-3xl font-bold">{title}</h1>
      <p className="rounded-xl bg-turmeric/20 p-3 text-xs">Template. Have a qualified lawyer review and complete this before launch. It is not legal advice and does not claim compliance with any law.</p>{children}</main><SiteFooter /></div>;
}
