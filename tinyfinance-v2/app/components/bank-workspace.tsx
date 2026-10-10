"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cents, decimal, money } from "@/lib/money";
type Row = Record<string, any>;
export default function BankWorkspace({
  transactions,
  accounts,
  documents,
  matches,
  settlements,
  settlementMatches,
  transfers,
  canEdit,
}: {
  transactions: Row[];
  accounts: Row[];
  documents: Row[];
  matches: Row[];
  settlements: Row[];
  settlementMatches: Row[];
  transfers: Row[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [docId, setDocId] = useState(""),
    [amount, setAmount] = useState(""),
    [kind, setKind] = useState("document"),
    [account, setAccount] = useState(""),
    [search, setSearch] = useState(""),
    [onlyOpen, setOnlyOpen] = useState(true);
  function remaining(t: Row) {
    const doc = matches
      .filter((m) => m.bank_transaction_id === t.id && m.status === "confirmed")
      .reduce((s, m) => s + cents(m.amount), 0);
    const platform = settlementMatches
      .filter((m) => m.bank_transaction_id === t.id && m.status === "confirmed")
      .reduce((s, m) => s + cents(m.amount), 0);
    const transfer = transfers.some(
      (m) =>
        m.status === "confirmed" &&
        [m.debit_transaction_id, m.credit_transaction_id].includes(t.id),
    )
      ? Math.abs(cents(t.amount))
      : 0;
    return Math.abs(cents(t.amount)) - doc - platform - transfer;
  }
  function docRemaining(d: Row) {
    return (
      cents(d.gross_amount) -
      matches
        .filter((m) => m.document_id === d.id && m.status === "confirmed")
        .reduce((s, m) => s + cents(m.amount), 0)
    );
  }
  const visible = transactions
    .filter(
      (t) =>
        (!account || t.bank_account_id === account) &&
        (!onlyOpen || remaining(t) > 0) &&
        [t.purpose, t.counterparty, t.source_reference]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.booked_on.localeCompare(a.booked_on));
  async function send(path: string, method: string, payload: Row) {
    setBusy(true);
    try {
      const r = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setSelected(null);
      setMessage("Zuordnung gespeichert.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Zuordnung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/bank-import", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setMessage(
        x.imported +
          " neue Umsätze; " +
          x.duplicates +
          " Dubletten übersprungen.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  const candidates = selected
    ? documents.filter(
        (d) =>
          d.review_status === "reviewed" &&
          d.upload_status === "ready" &&
          d.currency === selected.currency &&
          (d.direction === "income") === Number(selected.amount) > 0 &&
          docRemaining(d) > 0,
      )
    : [];
  const exact = candidates.filter(
    (d) =>
      docRemaining(d) === remaining(selected!) &&
      Math.abs(Date.parse(d.invoice_date) - Date.parse(selected!.booked_on)) <=
        14 * 86400000,
  );
  return (
    <>
      {canEdit && (
        <section className="panel">
          <h2>Bankdatei importieren</h2>
          <p className="muted">
            CSV (Semikolon), CAMT.053 oder unterstütztes MT940 · bis 2 MB, 2000
            Umsätze. Fehlerhafte Dateien werden vollständig abgelehnt.
          </p>
          {accounts.length ? (
            <form className="row" onSubmit={upload}>
              <label>
                Konto
                <select name="bank_account_id" required>
                  <option value="">Konto wählen</option>
                  {accounts
                    .filter((a) => a.active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Datei
                <input
                  type="file"
                  name="file"
                  accept=".csv,.xml,.sta,.mt940,.940"
                  required
                />
              </label>
              <button disabled={busy}>Import prüfen und speichern</button>
            </form>
          ) : (
            <p>
              Lege zuerst ein{" "}
              <Link href="/finance/bank-accounts">Bankkonto</Link> an.
            </p>
          )}
          <details>
            <summary>CSV-Spalten und Referenzen</summary>
            <p>
              Datum;Betrag;Verwendungszweck;Gegenpartei;Referenz · Datum
              YYYY-MM-DD · Betrag 1.234,56 oder -123,45 · stabile eindeutige
              Bankreferenz pro Umsatz. Konten werden getrennt geprüft.
            </p>
          </details>
        </section>
      )}
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Bankumsätze suchen"
            placeholder="Gegenpartei, Verwendungszweck, Referenz"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Bankkonto filtern"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Alle Konten</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            Nur offene Umsätze
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum / Konto</th>
                <th>Gegenpartei / Zweck</th>
                <th>Betrag</th>
                <th>Offen</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.booked_on}
                    <small>
                      {accounts.find((a) => a.id === t.bank_account_id)?.name ||
                        "Altimport ohne Konto"}
                    </small>
                  </td>
                  <td>
                    {t.counterparty || "–"}
                    <small>{t.purpose}</small>
                  </td>
                  <td>{money(t.amount, t.currency)}</td>
                  <td>{money(decimal(remaining(t)), t.currency)}</td>
                  <td>
                    {canEdit && remaining(t) > 0 && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setSelected(t);
                          setAmount(decimal(remaining(t)));
                          setDocId("");
                          setKind("document");
                        }}
                      >
                        Zuordnen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="empty-state">
            <h3>Keine passenden Bankumsätze</h3>
            <p>Importiere eine Kontodatei oder passe die Filter an.</p>
          </div>
        )}
      </section>
      {selected && (
        <section className="panel">
          <h2>
            Zahlung zuordnen · {money(selected.amount, selected.currency)}
          </h2>
          <p>
            {selected.booked_on} · {selected.counterparty} · {selected.purpose}
          </p>
          {exact.length > 0 && (
            <div className="suggestion">
              <h3>Mögliche Belege</h3>
              <p>
                Gleicher offener Betrag, gleiches Vorzeichen, Rechnungsdatum
                innerhalb von 14 Tagen. Bitte manuell prüfen.
              </p>
              {exact.map((d) => (
                <button
                  key={d.id}
                  className="secondary"
                  onClick={() => {
                    setKind("document");
                    setDocId(d.id);
                    setAmount(decimal(docRemaining(d)));
                  }}
                >
                  {d.invoice_number} · {d.vendor}
                </button>
              ))}
            </div>
          )}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (kind === "document")
                send("/api/bank-matches", "POST", {
                  transaction_id: selected.id,
                  document_id: docId,
                  amount,
                });
              else if (kind === "platform")
                send("/api/finance-matches", "POST", {
                  kind,
                  transaction_id: selected.id,
                  settlement_id: docId,
                  amount,
                });
              else {
                const other = transactions.find((t) => t.id === docId);
                send("/api/finance-matches", "POST", {
                  kind,
                  debit_transaction_id:
                    Number(selected.amount) < 0 ? selected.id : other?.id,
                  credit_transaction_id:
                    Number(selected.amount) > 0 ? selected.id : other?.id,
                });
              }
            }}
          >
            <label>
              Zuordnung
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setDocId("");
                }}
              >
                <option value="document">Beleg</option>
                {Number(selected.amount) > 0 && selected.currency === "EUR" && (
                  <option value="platform">Plattformauszahlung</option>
                )}
                <option value="transfer">Eigenübertrag</option>
              </select>
            </label>
            <label>
              Gegenposition
              <select
                required
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
              >
                <option value="">Bitte wählen</option>
                {kind === "document"
                  ? candidates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.invoice_number} · {d.vendor} · offen{" "}
                        {money(decimal(docRemaining(d)))}
                      </option>
                    ))
                  : kind === "platform"
                    ? settlements
                        .filter((s) => s.status !== "cancelled")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.platform} · {s.reference} · {money(s.payout)}
                          </option>
                        ))
                    : transactions
                        .filter(
                          (t) =>
                            t.id !== selected.id &&
                            t.bank_account_id !== selected.bank_account_id &&
                            t.currency === selected.currency &&
                            cents(t.amount) === -cents(selected.amount) &&
                            remaining(t) === Math.abs(cents(t.amount)),
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.booked_on} ·{" "}
                            {
                              accounts.find((a) => a.id === t.bank_account_id)
                                ?.name
                            }{" "}
                            · {money(t.amount)}
                          </option>
                        ))}
              </select>
            </label>
            {kind !== "transfer" && (
              <label>
                Teilbetrag
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
            <button disabled={busy}>Zuordnung bestätigen</button>
            <button
              type="button"
              className="quiet"
              onClick={() => setSelected(null)}
            >
              Abbrechen
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <h2>Abgleichprotokoll</h2>
        <ul className="task-list">
          {[
            ...matches.map((m) => ({ ...m, kind: "document" })),
            ...settlementMatches.map((m) => ({ ...m, kind: "platform" })),
            ...transfers.map((m) => ({ ...m, kind: "transfer" })),
          ].map((m: Row) => (
            <li key={m.kind + m.id}>
              <span>
                {m.kind === "document"
                  ? "Belegzuordnung"
                  : m.kind === "platform"
                    ? "Plattformauszahlung"
                    : "Eigenübertrag"}{" "}
                · {m.amount ? money(m.amount) : "Kontenübertrag"}
                <small>
                  {m.status === "confirmed" ? "Bestätigt" : "Zurückgenommen"}
                </small>
              </span>
              {canEdit && m.status === "confirmed" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    send(
                      m.kind === "document"
                        ? "/api/bank-matches"
                        : "/api/finance-matches",
                      "DELETE",
                      {
                        id: m.id,
                        ...(m.kind === "document" ? {} : { kind: m.kind }),
                      },
                    )
                  }
                >
                  Zuordnung zurücknehmen
                </button>
              )}
            </li>
          ))}
        </ul>
        {matches.length + settlementMatches.length + transfers.length === 0 && (
          <p className="muted">Noch keine bestätigten Zuordnungen.</p>
        )}
      </section>
      <p className="feedback" role="status">
        {message}
      </p>
    </>
  );
}
