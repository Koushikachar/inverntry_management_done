import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard"; import { ghost } from "@/components/ui";
import { db } from "@/lib/db"; import { getUser } from "@/lib/auth"; import { setOrg, signOut } from "../actions";
export default async function Suspended() {
  const user = await getUser(); if (!user) redirect("/login");
  const other = await db.membership.findMany({ where: { userId: user.id, org: { suspended: false } }, include: { org: true } });
  return <AuthCard title="Access paused" sub="This organization has been suspended by the platform. Contact support if you think this is a mistake.">
    {other.length > 0 && <div className="mb-4 space-y-2"><p className="text-sm">Switch to another organization:</p>{other.map(m => <form key={m.id} action={setOrg}><input type="hidden" name="id" value={m.orgId} /><button className={`${ghost} w-full py-2`}>{m.org.name}</button></form>)}</div>}
    <form action={signOut}><button className={`${ghost} w-full py-2`}>Sign out</button></form></AuthCard>;
}
