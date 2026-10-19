import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { signIn } from "../actions";
import AuthCard from "@/components/AuthCard";
import Turnstile from "@/components/Turnstile";
import { Err, inp, btn } from "@/components/ui";
export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  if (await getUser()) redirect("/dashboard"); // already signed in
  return <AuthCard title="Welcome back" sub="Sign in to your stock."><Err e={e} />
    <form action={signIn} className="mt-3 space-y-3"><label className="block text-sm">Email<input name="email" type="email" required className={inp} autoComplete="email" /></label>
      <label className="block text-sm">Password<input name="password" type="password" minLength={8} required className={inp} autoComplete="current-password" /></label>
      <Turnstile /><button className={`${btn} w-full`}>Sign in</button></form>
    <p className="mt-4 text-sm"><Link href="/forgot" className="text-brand underline">Forgot password?</Link></p>
    <p className="mt-5 text-sm text-ink/70">New here? <Link href="/register" className="font-semibold text-brand underline">Create an account</Link></p></AuthCard>;
}
