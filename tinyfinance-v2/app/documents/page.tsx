import { pageContext } from "@/lib/access";
import { permits } from "@/lib/permissions";
import { databaseError } from "@/lib/errors";
import { allRows } from "@/lib/data";
import FinanceShell from "@/app/components/finance-shell";
import DocumentWorkspace from "@/app/components/document-workspace";
export const dynamic = "force-dynamic";
export default async function Documents() {
  const a = await pageContext();
  const { data, error, count } = await a.client
    .from("documents")
    .select("*", { count: "exact" })
    .eq("organization_id", a.org)
    .order("created_at", { ascending: false })
    .order("id")
    .range(0, 49);
  if (error) databaseError(error);
  const centers = await allRows(a.client, "cost_centers", a.org);
  const subjects = permits(a.role, "private", a.privateAccess)
    ? await allRows(a.client, "tax_subjects", a.org)
    : [];
  const { data: settings, error: settingsError } = await a.client
    .from("finance_settings")
    .select("ai_enabled")
    .eq("organization_id", a.org)
    .single();
  if (settingsError) databaseError(settingsError);
  return (
    <FinanceShell
      title="Belege"
      subtitle="Vom Original zum geprüften Buchungsvorschlag"
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      <DocumentWorkspace
        initial={data || []}
        total={count || 0}
        centers={centers as any}
        subjects={subjects as any}
        aiEnabled={!!settings?.ai_enabled}
        canEdit={permits(a.role, "write")}
      />
    </FinanceShell>
  );
}
