import Link from "next/link";
import { resendVerification } from "../actions";
import AuthCard from "@/components/AuthCard";
import { Err, inp, ghost } from "@/components/ui";
export default async function Verify({ searchParams }: { searchParams: Promise<{ email?: string; e?: string; ok?: string }> }) {
  const { email = "", e, ok } = await searchParams;
  return <AuthCard title="Check your email" sub={email ? `We sent a verification link to ${email}. Open it in this browser to finish signing up.` : "Open the verification link we emailed you."}>
    <Err e={e} />{ok && <p role="status" className="rounded-lg bg-brand/10 px-4 py-2 text-sm text-brand">A new link was sent. Check your spam folder too.</p>}
    <form action={resendVerification} className="mt-3 space-y-3"><label className="block text-sm">Email<input name="email" type="email" required defaultValue={email} className={inp} /></label>
      <button className={`${ghost} w-full py-2`}>Send the link again</button></form>
    <p className="mt-5 text-sm text-ink/70">Verified already? <Link href="/login" className="font-semibold text-brand underline">Sign in</Link></p></AuthCard>;
}
