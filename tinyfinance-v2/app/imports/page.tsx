import { pageContext } from "@/lib/access";
import FinanceShell from "@/app/components/finance-shell";
import ImportWorkspace from "@/app/components/import-workspace";
export const dynamic = "force-dynamic";
export default async function Imports() {
  const a = await pageContext();
  return (
    <FinanceShell
      title="Dateiimporte"
      subtitle="Plattformabrechnungen und genehmigte TinyTeam-Zeiten"
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      <ImportWorkspace />
    </FinanceShell>
  );
}
