import Link from "next/link";
export default function SiteFooter() {
  return <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-ink/70">
    <span>© {new Date().getFullYear()} Direct2Hub</span><nav className="flex gap-5" aria-label="Legal"><Link href="/privacy" className="underline">Privacy</Link><Link href="/terms" className="underline">Terms</Link><Link href="/login" className="underline">Sign in</Link></nav></footer>;
}
