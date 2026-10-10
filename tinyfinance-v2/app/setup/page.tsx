export default function Setup() {
  return (
    <main className="auth">
      <section className="panel">
        <span className="eyebrow">TinyFinance · Einrichtung</span>
        <h1>Konfiguration fehlt</h1>
        <p>
          Für den Zugriff auf Finanzdaten werden die Supabase-Projekt-URL und
          der öffentliche Anon-/Publishable-Key benötigt.
        </p>
        <p>
          Hinterlege <code>NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> sicher in den
          Umgebungseinstellungen. Verwende keinen Service-Role-Key. Installiere
          die Datenbankmigrationen zuerst in einem separaten Testprojekt.
        </p>
        <a href="/login">Zur Anmeldung</a>
      </section>
    </main>
  );
}
