"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db"; import { adminGuard } from "@/lib/admin";
/** Suspending locks every member of the org out until reactivated. Always audited, with a reason. */
export async function setSuspended(fd: FormData) {
  const op = await adminGuard(), id = String(fd.get("id")), suspend = fd.get("suspend") === "1", reason = String(fd.get("reason") ?? "").trim().slice(0, 300);
  const back = (q: string) => redirect(`/admin/orgs/${id}?${q}`);
  if (id === "platform") back("e=" + encodeURIComponent("The platform organization can't be suspended"));
  if (suspend && reason.length < 3) back("e=" + encodeURIComponent("Give a reason (at least 3 characters)"));
  await db.$transaction([db.organization.update({ where: { id }, data: { suspended: suspend } }),
    db.auditLog.create({ data: { orgId: id, actorId: op.id, action: suspend ? "org.suspended" : "org.reactivated", detail: { reason } } })]);
  revalidatePath("/admin"); back("ok=" + encodeURIComponent(suspend ? "Organization suspended" : "Organization reactivated"));
}

export async function setPlan(fd: FormData) {
  const op = await adminGuard(), id = String(fd.get("id")), plan = String(fd.get("plan"));
  if (!["FREE", "GROWTH", "SCALE"].includes(plan)) redirect(`/admin/orgs/${id}?e=${encodeURIComponent("Unknown plan")}`);
  await db.$transaction([db.organization.update({ where: { id }, data: { plan } }), db.auditLog.create({ data: { orgId: id, actorId: op.id, action: "org.plan_changed", detail: { plan } } })]);
  revalidatePath(`/admin/orgs/${id}`); redirect(`/admin/orgs/${id}?ok=${encodeURIComponent("Plan updated")}`);
}
