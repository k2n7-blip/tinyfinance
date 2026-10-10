export const dynamic = "force-dynamic";
export default async function Setup({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const urlPresent = !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const keyPresent = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const { reason } = await searchParams;
  const databaseMissing = reason === "database" && urlPresent && keyPresent;
  return (
    <main className="auth">
      <section className="panel">
        <span className="eyebrow">TinyFinance · Einrichtung</span>
        <h1>
          {databaseMissing
            ? "Datenbankmigrationen fehlen"
            : urlPresent && keyPresent
              ? "Einrichtung prüfen"
              : "Konfiguration fehlt"}
        </h1>
        <p>
          {databaseMissing
            ? "Die Supabase-Verbindung ist konfiguriert, aber benötigte Tabellen, Spalten oder Funktionen sind noch nicht verfügbar. Weitere Änderungen an den Umgebungsschlüsseln lösen diesen Datenbankfehler nicht."
            : "Hier siehst du, welche Supabase-Werte dieses Deployment tatsächlich erhält. Schlüsselwerte werden nicht angezeigt."}
        </p>
        <table>
          <thead>
            <tr>
              <th>Einstellung</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>NEXT_PUBLIC_SUPABASE_URL</code>
              </td>
              <td>{urlPresent ? "Vorhanden" : "Fehlt oder ist leer"}</td>
            </tr>
            <tr>
              <td>
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              </td>
              <td>{keyPresent ? "Vorhanden" : "Fehlt oder ist leer"}</td>
            </tr>
          </tbody>
        </table>
        {databaseMissing ? (
          <>
            <p>
              Öffne den SQL Editor deines separaten Supabase-Testprojekts. Dort
              müssen die Migrationen 001, 003, 004 und 005–013 in dieser
              Reihenfolge angewendet sein. Bereits erfolgreich angewendete
              Dateien nicht erneut ausführen. Die Beispieldatei 002 nicht
              ausführen.
            </p>
            <p>
              Keine Migration auf der produktiven Datenbank ausführen. Wenn eine
              Migration einen Fehler meldet, stoppe und teile die Fehlermeldung
              mit.
            </p>
            <a href="https://github.com/k2n7-blip/tinyfinance/tree/feat/finance-workflows/tinyfinance-v2/supabase">
              Migrationsdateien öffnen
            </a>
          </>
        ) : !urlPresent || !keyPresent ? (
          <p>
            Hinterlege die fehlenden Einträge im Vercel-Projekt für Preview.
            Verwende die URL und den öffentlichen Anon-/Publishable-Key
            desselben Testprojekts, keinen Service-Role-Key. Speichere und baue
            den Branch erneut.
          </p>
        ) : (
          <p>
            Beide Werte sind vorhanden. Das bestätigt ihre Anwesenheit, noch
            nicht die Gültigkeit oder den Migrationsstand. Öffne die Anmeldung
            erneut; bei einem weiteren Fehler prüfe dessen konkrete Meldung.
          </p>
        )}
        <p className="muted">
          Deployment: {process.env.VERCEL_GIT_COMMIT_REF || "lokal"} · Stand{" "}
          {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "lokal"}
        </p>
        <a href="/login">Zur Anmeldung</a>
      </section>
    </main>
  );
}
