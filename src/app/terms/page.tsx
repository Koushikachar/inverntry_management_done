import Legal from "@/components/Legal";
export const metadata = { title: "Terms & conditions" };
export default function Terms() {
  return <Legal title="Terms & conditions"><p>Last updated: [date]. These terms are between you and [company name].</p>
    <h2 className="text-lg font-semibold">Using Direct2Hub</h2><p>You may use the service for lawful business inventory management. You are responsible for the accuracy of the data you enter and for keeping your sign-in details secret.</p>
    <h2 className="text-lg font-semibold">Your data</h2><p>You own your business data. You grant us permission to store and process it to run the service.</p>
    <h2 className="text-lg font-semibold">Acceptable use</h2><p>Do not attempt to access other organizations' data, disrupt the service, or use it to break the law. We may suspend accounts that do.</p>
    <h2 className="text-lg font-semibold">Plans and payment</h2><p>Plan limits apply to products and team size. [Describe pricing and billing once payments are added.]</p>
    <h2 className="text-lg font-semibold">Availability and liability</h2><p>The service is provided "as is". [A lawyer should complete the liability, governing-law and termination clauses.]</p></Legal>;
}
