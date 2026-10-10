"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <section className="panel">
        <h1>Dieser Bereich ist gerade nicht verfügbar</h1>
        <p>
          Bitte prüfe die Datenbankeinrichtung und deine Sitzung. Deine bereits
          gespeicherten Daten bleiben erhalten.
        </p>
        <div className="row">
          <button onClick={reset}>Erneut versuchen</button>
          <a href="/settings">Einrichtung und Sicherheit</a>
          <a href="/dashboard">Zum Überblick</a>
        </div>
      </section>
    </main>
  );
}
