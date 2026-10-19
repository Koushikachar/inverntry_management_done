import { redirect } from "next/navigation";
import { setPassword } from "../actions"; import { sbServer } from "@/lib/supabase"; import AuthCard from "@/components/AuthCard"; import { Err, inp, btn } from "@/components/ui";
export default async function Reset({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  if (!(await (await sbServer()).auth.getUser()).data.user) redirect("/forgot?e=" + encodeURIComponent("Your reset link has expired. Request a new one"));
  return <AuthCard title="Choose a new password"><Err e={e} />
    <form action={setPassword} className="space-y-3">
      <label className="block text-sm">New password<input name="password" type="password" minLength={12} required className={inp} autoComplete="new-password" /></label>
      <label className="block text-sm">Confirm password<input name="confirm" type="password" minLength={12} required className={inp} autoComplete="new-password" /></label>
      <button className={`${btn} w-full`}>Update password</button></form></AuthCard>;
}
