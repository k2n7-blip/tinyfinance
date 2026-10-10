"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignAccommodation } from "@/lib/platform-pdf";
import { platformSettlementCsv } from "@/lib/platform-csv";
type Settlement = {
  platform: string;
  reference: string;
  booking_reference: string;
  period_start: string;
  period_end: string;
  gross_amount: string;
  commission: string;
  refunds: string;
  payout: string;
  payout_reference: null;
  guest_nights: number;
  occupancy_nights: null;
  status: string;
};
type Center = { id: string; name: string; code: string; active?: boolean };
type Entry = {
  filename: string;
  suggestion?: Settlement;
  accommodation?: { id: string; name: string };
  center: string;
  error?: string;
  scope?: string;
};
export default function PlatformPdfImport() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const ready = entries.filter((e) => e.suggestion && e.center && !e.error);
  function choose(index: number, center: string) {
    const entry = entries[index];
    let updated = entries.map((e, i) =>
      i === index ||
      (entry.accommodation?.id &&
        e.accommodation?.id === entry.accommodation.id)
        ? { ...e, center }
        : e,
    );
    setEntries(updated);
    setConfirmed(false);
    if (entry.scope && entry.accommodation?.id) {
      try {
        const key = "tf-holidu-mapping:" + entry.scope;
        const saved = JSON.parse(localStorage.getItem(key) || "{}");
        saved[entry.accommodation.id] = center;
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        setMessage(
          "Zuordnung gilt für diesen Stapel. Der Browser konnte sie nicht für spätere Importe speichern.",
        );
      }
    }
  }
  function csv() {
    const rows = ready.map((e) => ({
      ...e.suggestion,
      cost_center_code: centers.find((c) => c.id === e.center)!.code,
    }));
    const url = URL.createObjectURL(
      new Blob([platformSettlementCsv(rows)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "holidu-abrechnungen.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="stack">
      <h2>Holidu-CSV oder PDFs gesammelt importieren</h2>
      <p>
        Original-Holidu-CSV bis 2000 Buchungen oder bis zu 200 Text-PDFs,
        jeweils bis 3 MB. Ohne KI: Unterkunfts-ID oder eindeutiger
        Ferienhausname ordnen automatisch zu. Einmal ausgewählte Zuordnungen
        werden in diesem Browser für dein Konto und diesen Mandanten
        gespeichert. Unbekannte Ferienhäuser bitte zuordnen. Originale
        zusätzlich unter Belege archivieren.
      </p>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const files = new FormData(event.currentTarget)
            .getAll("file")
            .filter((f): f is File => f instanceof File);
          if (files.length > 200) {
            setMessage("Bitte höchstens 200 PDFs pro Stapel auswählen.");
            return;
          }
          setBusy(true);
          setEntries([]);
          setConfirmed(false);
          const results: Entry[] = [];
          try {
            for (const [index, file] of files.entries()) {
              setMessage(`Lese ${index + 1} von ${files.length}: ${file.name}`);
              try {
                if (file.size > 3_000_000) throw Error("PDF größer als 3 MB.");
                const form = new FormData();
                form.set("file", file);
                const response = await fetch("/api/platform-pdf", {
                  method: "POST",
                  body: form,
                  signal: AbortSignal.timeout(60000),
                });
                const data = await response.json();
                if (!response.ok) throw Error(data.error);
                const active = data.centers.filter(
                  (c: Center) => c.active !== false,
                );
                setCenters(active);
                let remembered: Record<string, string> = {};
                try {
                  remembered = JSON.parse(
                    localStorage.getItem(
                      "tf-holidu-mapping:" + data.mappingScope,
                    ) || "{}",
                  );
                } catch {}
                for (const entry of data.entries || [
                  {
                    filename: file.name,
                    suggestion: data.suggestion,
                    accommodation: data.accommodation,
                  },
                ]) {
                  results.push({
                    ...entry,
                    center: entry.suggestion
                      ? assignAccommodation(
                          entry.accommodation,
                          active,
                          remembered,
                        )
                      : "",
                    scope: data.mappingScope,
                  });
                }
              } catch (error) {
                results.push({
                  filename: file.name,
                  center: "",
                  error:
                    error instanceof Error
                      ? error.message
                      : "PDF nicht lesbar.",
                });
              }
              setEntries([...results]);
            }
            setMessage(
              `${results.filter((e) => e.suggestion).length} Abrechnungen ausgelesen; ${results.filter((e) => e.error).length} Fehler. Zuordnung und Beträge prüfen.`,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Holidu-CSV oder PDF-Dateien
          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf,.csv,text/csv"
            multiple
            required
            disabled={busy}
          />
        </label>
        <button disabled={busy}>
          {busy ? "Wird verarbeitet …" : "Dateien auslesen"}
        </button>
      </form>
      {entries.length > 0 && (
        <>
          <p>
            Der Original-CSV-Export benötigt keine Umformatierung. Bereits
            vorhandene Buchungen verwenden ihre vorhandene Abrechnungsreferenz;
            widersprüchliche Daten brechen den Import ab. Gebühren enthalten
            Umsatzsteuer. Auszahlungen sind erwartete Beträge vor weiteren
            Kontoanpassungen. Fehlerhafte oder nicht zugeordnete Dateien werden
            nicht übernommen.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>PDF / Referenz</th>
                  <th>Unterkunft</th>
                  <th>Zeitraum</th>
                  <th>Gastzahlung</th>
                  <th>Gebühren</th>
                  <th>Auszahlung</th>
                  <th>Ferienhaus</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td>
                      {e.filename}
                      <br />
                      {e.suggestion?.reference}
                      {e.error && <p role="alert">{e.error}</p>}
                    </td>
                    <td>
                      {e.accommodation?.name}
                      <br />
                      {e.accommodation?.id}
                    </td>
                    <td>
                      {e.suggestion?.period_start}
                      <br />
                      {e.suggestion?.period_end}
                    </td>
                    <td>{e.suggestion?.gross_amount}</td>
                    <td>{e.suggestion?.commission}</td>
                    <td>{e.suggestion?.payout}</td>
                    <td>
                      {e.suggestion && (
                        <select
                          aria-label={"Ferienhaus für " + e.filename}
                          value={e.center}
                          disabled={busy}
                          onChange={(event) => choose(i, event.target.value)}
                        >
                          <option value="">Bitte zuordnen</option>
                          {centers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
            />{" "}
            Angaben und Zuordnungen der {ready.length} übernehmbaren
            Abrechnungen geprüft
          </label>
          <button disabled={busy || !confirmed || !ready.length} onClick={csv}>
            Geprüfte Abrechnungen als CSV herunterladen
          </button>
          <button
            disabled={busy || !confirmed || !ready.length}
            onClick={async () => {
              setBusy(true);
              try {
                const response = await fetch("/api/platform-pdf", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(
                    ready.map((e) => ({
                      ...e.suggestion,
                      cost_center_id: e.center,
                    })),
                  ),
                });
                const data = await response.json();
                if (!response.ok) throw Error(data.error);
                router.refresh();
                setMessage(
                  `${data.imported} Abrechnungen importiert; ${data.duplicates} identische Dubletten übersprungen.`,
                );
                setEntries(entries.filter((e) => !ready.includes(e)));
                setConfirmed(false);
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Import fehlgeschlagen.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Geprüfte Abrechnungen gesammelt importieren
          </button>
        </>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
    </section>
  );
}
