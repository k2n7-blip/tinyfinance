import { meterConsumption } from "@/lib/meter-consumption";
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
  if (
    error &&
    ["42P01", "PGRST205"].includes(error.code) &&
    [
      "property-units",
      "property-files",
      "property-meters",
      "meter-readings",
    ].includes(key)
  )
    return (
      <FinanceShell
        title={mod.title}
        role={a.role}
        privateAccess={a.privateAccess}
        payrollAccess={a.payrollAccess}
      >
        <section className="panel">
          <h2>Immobilienbereich einrichten</h2>
          <p>
            Die neuen Tabellen fehlen noch. Migration 012 und anschließend 013
            einmal im separaten Supabase-Testprojekt ausführen. Bereits
            angewendete Dateien nicht erneut ausführen.
          </p>
          <a href="https://github.com/k2n7-blip/tinyfinance/tree/feat/finance-workflows/tinyfinance-v2/supabase">
            Migrationsdateien öffnen
          </a>
        </section>
      </FinanceShell>
    );
  if (error) databaseError(error);
  const propertyRows = [
    "property-units",
    "property-files",
    "property-meters",
    "meter-readings",
  ].includes(key)
    ? await allRows(a.client, "properties", a.org)
    : [];
  const meterRows =
    key === "meter-readings"
      ? await allRows(a.client, "property_meters", a.org)
      : [];
  const consumption =
    key === "meter-readings"
      ? meterConsumption(
          (await allRows(a.client, "meter_readings", a.org)) as any,
        )
      : [];
  const choices: Record<
    string,
    { id: string; label: string; property_id?: string }[]
  > = {};
  for (const rel of new Set(
    mod.fields.map((f) => f.relation).filter(Boolean) as string[],
  )) {
    const table = rel === "documents" ? "documents" : modules[rel]?.table;
    if (!table) continue;
    const rows = await allRows(a.client, table, a.org);
    choices[rel] = rows.map((r) => ({
      id: r.id,
      property_id: r.property_id,
      label: [
        propertyRows.find((p) => p.id === r.property_id)?.name,
        r.serial_number,
        r.code || r.account_number,
        r.name || r.original_filename || r.description || r.provider,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  }
  const excelHistory = key === "properties" ? await allRows(a.client,"rental_imports",a.org) : [];
  const excelObjects = Array.from(new Set(excelHistory.flatMap(batch => (batch.payload?.rows || []).filter((r:any) => /^(Kammberg |Fuchskuhle |Schulendammer Weg |Am Mühlenbach )/.test(r.property_name)).map((r:any) => String(r.property_name))))).sort() as string[];
  return (
    <FinanceShell
      title={mod.title}
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      {[
        "properties",
        "property-units",
        "property-files",
        "property-meters",
        "meter-readings",
      ].includes(key) && (
        <nav className="panel" aria-label="Immobilienbereiche">
          <a href="/finance/properties">Immobilien</a>
          {" · "}
          <a href="/finance/property-units">Einheiten</a>
          {" · "}
          <a href="/finance/property-files">Hausakte</a>
          {" · "}
          <a href="/finance/property-meters">Zähler</a>
          {" · "}
          <a href="/finance/meter-readings">Zählerstände</a>
        </nav>
      )}
      {key === "properties" && excelObjects.length > 0 && <section className="panel"><h2>Immobilien aus deinen Excel-Jahren</h2><p>Historische Quellübersichten wurden übernommen. Kaufdaten, Eigentumsanteile und Nutzungsarten werden daraus nicht geraten; die vollständigen Objektstammdaten kannst du darunter ergänzen.</p><p><a href="/rental">Alle Jahresübersichten 2022–2025 ansehen</a></p><div className="table-wrap"><table><thead><tr><th>Objekt laut Excel</th><th>Vorhandene Jahre</th></tr></thead><tbody>{excelObjects.map(name => <tr key={name}><td>{name}</td><td>{excelHistory.filter(batch => batch.payload?.rows?.some((r:any) => r.property_name === name)).map(batch => batch.year).sort().join(", ")}</td></tr>)}</tbody></table></div></section>}
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
      {key === "meter-readings" && (
        <section className="panel">
          <h2>Verbrauch zwischen Ablesungen</h2>
          <p>
            Für die erste Ablesung fehlt ein Vergleichsstand. Keine Hochrechnung
            oder automatische Kostenverteilung.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Haus / Zähler</th>
                  <th>Von</th>
                  <th>Bis</th>
                  <th>Verbrauch</th>
                </tr>
              </thead>
              <tbody>
                {consumption.map((r) => {
                  const meter = meterRows.find((m) => m.id === r.meter_id);
                  return (
                    <tr key={r.id}>
                      <td>
                        {
                          propertyRows.find((p) => p.id === meter?.property_id)
                            ?.name
                        }{" "}
                        · {meter?.name}
                      </td>
                      <td>{r.previous_date || "—"}</td>
                      <td>{r.read_on}</td>
                      <td>
                        {r.invalid
                          ? "Stand prüfen"
                          : r.consumption === null
                            ? "—"
                            : r.consumption.toLocaleString("de-DE", {
                                maximumFractionDigits: 3,
                              }) +
                              " " +
                              (meter?.measurement_unit || "")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
