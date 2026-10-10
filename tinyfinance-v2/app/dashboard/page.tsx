import Link from "next/link";
import { pageContext } from "@/lib/access";
import { databaseError } from "@/lib/errors";
import { money } from "@/lib/money";
import FinanceShell from "@/app/components/finance-shell";
export const dynamic = "force-dynamic";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const a = await pageContext();
  const { data: totals, error } = await a.client.rpc("dashboard_totals", {
    org: a.org,
  });
  if (error) databaseError(error);
  const { data: org } = await a.client
    .from("organizations")
    .select("name")
    .eq("id", a.org)
    .single();
  const { data: docs, error: docsError } = await a.client
    .from("documents")
    .select("id,original_filename,review_status,created_at")
    .eq("organization_id", a.org)
    .eq("review_status", "pending")
    .eq("upload_status", "ready")
    .order("created_at", { ascending: false })
    .limit(5);
  if (docsError) databaseError(docsError);
  return (
    <FinanceShell
      title="Überblick"
      subtitle={org?.name || "Dein Mandant"}
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      {(await searchParams).denied && (
        <p className="warning">
          Du hast keine Berechtigung für den angeforderten Bereich.
        </p>
      )}
      <section className="hero-strip">
        <div>
          <span className="eyebrow">Alles an einem Ort</span>
          <h2>Mehr Überblick. Weniger offene Aufgaben.</h2>
          <p>Prüfe deine Belege und gleiche Zahlungen ab.</p>
        </div>
        <Link className="button" href="/documents">
          Belege verwalten →
        </Link>
      </section>
      <div className="cards">
        {[
          ["Belege gesamt", totals?.documents, "/documents"],
          ["Zur Prüfung", totals?.pending, "/documents"],
          ["Freigegebene Buchungen", totals?.postings, "/ledger"],
          ["Offene Bankumsätze", totals?.unmatched, "/bank"],
        ].map(([label, value, href]) => (
          <Link className="card stat-card" href={String(href)} key={label}>
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
            <small>Alle zugänglichen Daten des Mandanten</small>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Nächste Belegprüfungen</h2>
            <Link href="/documents">Alle Belege →</Link>
          </div>
          {docs?.length ? (
            <ul className="task-list">
              {docs.map((d) => (
                <li key={d.id}>
                  <span>
                    {d.original_filename}
                    <small>
                      {new Date(d.created_at).toLocaleDateString("de-DE")}
                    </small>
                  </span>
                  <span className="badge pending">Zur Prüfung</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <h3>Keine offenen Belegprüfungen</h3>
              <p>Neue Originale kannst du unter Belege hochladen.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Plattformen</h2>
          <dl className="summary-list">
            <div>
              <dt>Bruttoumsatz erfasst</dt>
              <dd>{money(totals?.platform_gross)}</dd>
            </div>
            <div>
              <dt>Provisionen erfasst</dt>
              <dd>{money(totals?.platform_fees)}</dd>
            </div>
          </dl>
          <p className="muted">
            Summe deiner erfassten Abrechnungen; kein geschätzter Umsatz.
          </p>
          <Link href="/finance/platforms">Abrechnungen verwalten →</Link>
        </section>
      </div>
      <section className="panel">
        <h2>Deine Arbeitsbereiche</h2>
        <div className="quick-links">
          <Link href="/ledger">Buchungen und DATEV</Link>
          <Link href="/bank">Import und Zahlungsabgleich</Link>
          <Link href="/reports">Kostenstellen und Auswertungen</Link>
          <Link href="/settings">Sicherheit und Verwaltung</Link>
        </div>
      </section>
    </FinanceShell>
  );
}
