"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
/** Direct2Hub sets only essential cookies (sign-in session, active organization), so this is a notice, not a tracking opt-in. Remembers dismissal in this browser only. */
export default function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem("d2h-cookie-notice")); } catch { setShow(true); } }, []);
  if (!show) return null;
  return <div role="region" aria-label="Cookie notice" className="glass-dark fixed inset-x-3 bottom-24 z-40 flex flex-wrap items-center justify-between gap-3 p-4 text-sm md:inset-x-auto md:bottom-4 md:right-4 md:max-w-md">
    <p>We use only essential cookies to keep you signed in. No tracking or advertising cookies. <Link href="/privacy" className="underline">Details</Link></p>
    <button onClick={() => { try { localStorage.setItem("d2h-cookie-notice", "1"); } catch {} setShow(false); }} className="min-h-10 rounded-xl bg-white/15 px-4 py-2 font-semibold transition hover:bg-white/25">Got it</button></div>;
}
