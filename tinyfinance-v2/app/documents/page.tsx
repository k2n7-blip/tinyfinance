import { databaseError } from "@/lib/errors";
import { pageContext } from "@/lib/access";
import { permits } from "@/lib/permissions";
import { allRows } from "@/lib/data";
import FinanceShell from "@/app/components/finance-shell";
import DocumentWorkspace from "@/app/components/document-workspace";
export const dynamic = "force-dynamic";
export default async function Documents() {
  const a = await pageContext();
  const active = (await allRows(a.client, "documents", a.org)).sort(
    (x, y) =>
      String(y.created_at).localeCompare(String(x.created_at)) ||
      String(x.id).localeCompare(String(y.id)),
  );
  const data = active.slice(0, 50),
    count = active.length;
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
