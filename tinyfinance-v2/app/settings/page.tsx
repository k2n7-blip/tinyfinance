import Link from "next/link";
import { pageContext } from "@/lib/access";
import { databaseError } from "@/lib/errors";
import Preferences from "@/app/components/preferences";
import Security from "@/app/components/security";
import FinanceShell from "@/app/components/finance-shell";
import AdminSettings from "@/app/components/admin-settings";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const a = await pageContext("session");
  let settings = null,
    members: any[] = [];
  if (a.role === "owner" && !a.mfaRequired) {
    const result = await a.client
      .from("finance_settings")
      .select("*")
      .eq("organization_id", a.org)
      .single();
    if (result.error) databaseError(result.error);
    settings = result.data;
    const membership = await a.client
      .from("memberships")
      .select("*")
      .eq("organization_id", a.org);
    if (membership.error) databaseError(membership.error);
    members = membership.data || [];
  }
  return (
    <FinanceShell
      title="Einstellungen"
      subtitle="Darstellung, Sicherheit und Verwaltung"
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      {a.mfaRequired && (
        <p className="warning">
          Bitte bestätige zuerst deine Zwei-Faktor-Anmeldung. Finanzdaten sind
          bis dahin gesperrt.
        </p>
      )}
      <Preferences />
      <Security />
      {settings && (
        <>
          <AdminSettings initial={settings} members={members} />
          <section className="panel">
            <h2>Kostenstellen und Kontenplan</h2>
            <div className="row">
              <Link href="/finance/cost-centers">Kostenstellen verwalten</Link>
              <Link href="/finance/accounts">Kontenplan verwalten</Link>
            </div>
          </section>
        </>
      )}
    </FinanceShell>
  );
}
