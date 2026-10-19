import Legal from "@/components/Legal";
export const metadata = { title: "Privacy policy" };
export default function Privacy() {
  return <Legal title="Privacy policy"><p>Last updated: [date]. Operator: [company name, address, contact email].</p>
    <h2 className="text-lg font-semibold">What we collect</h2><p>Account data (name, email), the business data you enter (products, stock, orders, suppliers, team members) and basic technical logs. We do not sell personal data.</p>
    <h2 className="text-lg font-semibold">Cookies</h2><p>Essential cookies only: one keeps you signed in and one remembers your active organization. We do not use advertising or tracking cookies.</p>
    <h2 className="text-lg font-semibold">Who processes data for us</h2><p>Hosting (Vercel), database and sign-in (Supabase), email delivery (Resend), and bot protection (Cloudflare Turnstile, if enabled). Passwords are checked against a public breach list using a privacy-preserving method; the password itself is never sent.</p>
    <h2 className="text-lg font-semibold">Your choices</h2><p>You can ask us to access, correct or delete your data at [contact email]. Organization owners can remove team members and sample data in Settings.</p>
    <h2 className="text-lg font-semibold">Retention and security</h2><p>We keep data while your account is active. Access is restricted by organization and role, and the database is backed up. No system is perfectly secure.</p></Legal>;
}
