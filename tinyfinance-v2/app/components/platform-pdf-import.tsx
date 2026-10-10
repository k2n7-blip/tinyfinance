"use client";
import { useState } from "react";
type Suggestion = {
  platform: string;
  reference: string;
  booking_reference: string;
  period_start: string;
  period_end: string;
  gross_amount: string;
  commission: string;
  refunds: string;
  payout: string;
  guest_nights: number;
};
export default function PlatformPdfImport() {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [centers, setCenters] = useState<
    { id: string; name: string; active?: boolean }[]
  >([]);
  const [center, setCenter] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(body: BodyInit, headers?: HeadersInit) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/platform-pdf", {
        method: "POST",
        body,
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      return data;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Import fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack">
      <h2>Holidu-Abrechnung aus PDF importieren</h2>
      <p>
        Text-PDF mit Provisionsrechnung und Auszahlungsteil, bis 3 MB. Die
        Erkennung erfolgt ohne OpenAI. Das Original wird hier nicht als Beleg
        archiviert; lade es zusätzlich unter Belege hoch.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setSuggestion(null);
          setCenter("");
          const data = await request(new FormData(e.currentTarget));
          if (data) {
            setSuggestion(data.suggestion);
            setCenters(
              data.centers.filter(
                (c: { active?: boolean }) => c.active !== false,
              ),
            );
          }
        }}
      >
        <label>
          PDF-Datei
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            disabled={busy}
          />
        </label>
        <button disabled={busy}>
          {busy ? "Wird verarbeitet …" : "PDF auslesen"}
        </button>
      </form>
      {suggestion && (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = await request(
              JSON.stringify({ ...suggestion, cost_center_id: center }),
              { "Content-Type": "application/json" },
            );
            if (data) {
              setSuggestion(null);
              setMessage(
                `${data.imported} Abrechnung importiert; ${data.duplicates} identische Dubletten übersprungen.`,
              );
            }
          }}
        >
          <h3>Erkannte Angaben prüfen</h3>
          <p>
            Holidu bleibt die abrechnende Plattform, auch bei einer
            Booking.com-Buchung. Gebühren enthalten Umsatzsteuer; Auszahlung ist
            der erwartete Betrag vor weiteren Kontoanpassungen.
          </p>
          {(
            [
              ["reference", "Abrechnungsreferenz"],
              ["booking_reference", "Buchungsreferenz"],
              ["period_start", "Von"],
              ["period_end", "Bis"],
              ["gross_amount", "Gastzahlung"],
              ["commission", "Gebühren inkl. Umsatzsteuer"],
              ["refunds", "Erstattungen"],
              ["payout", "Erwartete Auszahlung"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required
                value={suggestion[key]}
                onChange={(e) =>
                  setSuggestion({ ...suggestion, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            Ferienhaus
            <select
              required
              value={center}
              onChange={(e) => setCenter(e.target.value)}
            >
              <option value="">Bitte auswählen</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" required /> Angaben mit dem PDF verglichen
          </label>
          <button disabled={busy}>Geprüfte Abrechnung importieren</button>
        </form>
      )}
      <p role="status" className="feedback">
        {message}
      </p>
    </section>
  );
}
