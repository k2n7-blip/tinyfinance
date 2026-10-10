import { pageContext } from "@/lib/access";
import { allRows } from "@/lib/data";
import { permits } from "@/lib/permissions";
import FinanceShell from "@/app/components/finance-shell";
import BankWorkspace from "@/app/components/bank-workspace";
export const dynamic = "force-dynamic";
export default async function Bank() {
  const a = await pageContext();
  const [
    transactions,
    accounts,
    documents,
    matches,
    settlements,
    settlementMatches,
    transfers,
  ] = await Promise.all(
    [
      "bank_transactions",
      "bank_accounts",
      "documents",
      "bank_matches",
      "platform_settlements",
      "settlement_matches",
      "bank_transfers",
    ].map((t) => allRows(a.client, t, a.org)),
  );
  return (
    <FinanceShell
      title="Bank und Zahlungsabgleich"
      subtitle="Importieren, prüfen und nachvollziehbar zuordnen"
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      <BankWorkspace
        transactions={transactions}
        accounts={accounts}
        documents={documents}
        matches={matches}
        settlements={settlements}
        settlementMatches={settlementMatches}
        transfers={transfers}
        canEdit={permits(a.role, "write")}
      />
    </FinanceShell>
  );
}
