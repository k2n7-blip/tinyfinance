import { notFound } from "next/navigation";
import { pageContext } from "@/lib/access";
import { modules } from "@/lib/modules";
import { permits } from "@/lib/permissions";
import { databaseError } from "@/lib/errors";
import { allRows } from "@/lib/data";
import FinanceShell from "@/app/components/finance-shell";
import ModuleWorkspace from "@/app/components/module-workspace";
export const dynamic = "force-dynamic";
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: key } = await params;
  const mod = modules[key];
  if (!mod) notFound();
  const a = await pageContext(mod.scope === "admin" ? "read" : mod.scope);
  const { data, error, count } = await a.client
    .from(mod.table)
    .select("*", { count: "exact" })
    .eq("organization_id", a.org)
    .order("id")
    .range(0, 49);
  if (error) databaseError(error);
  const choices: Record<string, { id: string; label: string }[]> = {};
  for (const rel of new Set(
    mod.fields.map((f) => f.relation).filter(Boolean) as string[],
  )) {
    const table = rel === "documents" ? "documents" : modules[rel]?.table;
    if (!table) continue;
    const rows = await allRows(a.client, table, a.org);
    choices[rel] = rows.map((r) => ({
      id: r.id,
      label: [
        r.code || r.account_number,
        r.name || r.original_filename || r.description || r.provider,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  }
  return (
    <FinanceShell
      title={mod.title}
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      <ModuleWorkspace
        moduleKey={key}
        title={mod.title}
        description={mod.description}
        fields={mod.fields}
        initial={data || []}
        total={count || 0}
        choices={choices}
        canEdit={permits(
          a.role,
          mod.scope === "read" ? "write" : mod.scope,
          a.privateAccess,
          a.payrollAccess,
        )}
      />
      {["platforms", "time-entries"].includes(key) && (
        <section className="panel">
          <h2>CSV-Import</h2>
          <p>
            Die geprüfte Importvorlage und erforderlichen Spalten findest du in
            der Betriebsdokumentation.
          </p>
          <a href={"/imports?module=" + key}>Datei importieren</a>
        </section>
      )}
    </FinanceShell>
  );
}
