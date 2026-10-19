import { notFound, redirect } from "next/navigation";
import { getUser, isOperator } from "./auth";
/** Every admin page and action starts here. Non-operators get a 404 so the panel's existence isn't revealed. */
export async function adminGuard() {
  const u = await getUser(); if (!u) redirect("/login");
  if (!(await isOperator(u))) notFound();
  return u;
}
