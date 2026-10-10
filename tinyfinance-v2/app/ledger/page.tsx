import { pageContext } from "@/lib/access";
import { allRows } from "@/lib/data";
import { permits } from "@/lib/permissions";
import FinanceShell from "@/app/components/finance-shell";
import LedgerWorkspace from "@/app/components/ledger-workspace";
export const dynamic = "force-dynamic";
export default async function Ledger({
  searchParams,
}: {
  searchParams: Promise<{ document?: string }>;
}) {
  const a = await pageContext();
  const [postings, allocations, documents, accounts, centers, batches] =
    await Promise.all(
      [
        "postings",
        "posting_allocations",
        "documents",
        "chart_accounts",
        "cost_centers",
        "export_batches",
      ].map((t) => allRows(a.client, t, a.org)),
    );
  return (
    <FinanceShell
      title="Buchungsjournal"
      subtitle="Vorschlag, Freigabe, Storno und DATEV-Übergabe"
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      <LedgerWorkspace
        postings={postings}
        allocations={allocations}
        documents={documents}
        accounts={accounts}
        centers={centers}
        batches={batches.map(({ data_base64, ...r }) => r)}
        canWrite={permits(a.role, "write")}
        canReview={permits(a.role, "review")}
        selectedDocument={(await searchParams).document}
      />
    </FinanceShell>
  );
}
