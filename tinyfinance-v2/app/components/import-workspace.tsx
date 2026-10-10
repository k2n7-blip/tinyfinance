"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PlatformPdfImport from "./platform-pdf-import";
export default function ImportWorkspace() {
  const router = useRouter();
  const [key, setKey] = useState("platforms"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="panel">
      <PlatformPdfImport />
      <h2>Geprüfte CSV importieren</h2>
      <p>
        Verwende die heruntergeladene Vorlage und Semikolon als Trennzeichen.
        Beträge im deutschen Format, Datum YYYY-MM-DD. Kostenstellen werden über
        ihre Nummer zugeordnet; TinyTeam-Zeiten über die hinterlegte externe
        Mitarbeiter-ID.
      </p>
      <p>
        Bestehende Referenzen werden nur bei identischem Inhalt als Dubletten
        übersprungen. Widersprüchliche Daten brechen den gesamten Import ab.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/module-import/" + key, {
              method: "POST",
              body: new FormData(e.currentTarget),
            });
            const data = await r.json();
            if (!r.ok) throw Error(data.error);
            router.refresh();
            setMessage(
              data.imported +
                " Einträge importiert; " +
                data.duplicates +
                " identische Dubletten übersprungen.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Import fehlgeschlagen.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Bereich
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="platforms">Holidu / Booking.com / Airbnb</option>
            <option value="time-entries">Genehmigte TinyTeam-Zeiten</option>
          </select>
        </label>
        <a href={"/api/module-import/" + key}>CSV-Vorlage herunterladen</a>
        <label>
          CSV-Datei
          <input type="file" name="file" accept=".csv,text/csv" required />
        </label>
        <button disabled={busy}>Datei prüfen und importieren</button>
      </form>
      <p className="feedback" role="status">
        {message}
      </p>
    </section>
  );
}
