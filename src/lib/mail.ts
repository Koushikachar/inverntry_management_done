type R = { ok: true; id: string } | { ok: false; error: string };
/** "ok" means the provider accepted the message, not that it was delivered. Secrets are never logged. */
export async function sendMail(a: { to: string; subject: string; html: string }): Promise<R> {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) return { ok: false, error: "Email isn't configured (set RESEND_API_KEY and MAIL_FROM)" };
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [a.to], subject: a.subject, html: a.html }) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("resend error", r.status, j?.name); return { ok: false, error: j?.message ?? `The email provider returned ${r.status}` }; }
    return { ok: true, id: j.id };
  } catch { return { ok: false, error: "Couldn't reach the email provider" }; }
}
