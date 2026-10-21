"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, cents, decimal } from "@/lib/money";
import { labels } from "@/lib/permissions";
type Row = Record<string, any>;
export default function LedgerWorkspace({
  postings,
  allocations,
  documents,
  accounts,
  centers,
  batches,
  canWrite,
  canReview,
  selectedDocument,
}: {
  postings: Row[];
  allocations: Row[];
  documents: Row[];
  accounts: Row[];
  centers: Row[];
  batches: Row[];
  canWrite: boolean;
  canReview: boolean;
  selectedDocument?: string;
}) {
  const router = useRouter();
  const now = new Date().toISOString().slice(0, 10);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Row | null>(
      selectedDocument ? blank(selectedDocument) : null,
    ),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(now.slice(0, 4) + "-01-01"),
    [to, setTo] = useState(now),
    [test, setTest] = useState(true),
    [bundle, setBundle] = useState(true),
    [reversal, setReversal] = useState<Row | null>(null),
    [reason, setReason] = useState(""),
    [reversalDate, setReversalDate] = useState(now);
  function blank(docId = "") {
    const doc = documents.find((d) => d.id === docId);
    return {
      document_id: docId,
      posting_date: doc?.invoice_date || now,
      amount: String(doc?.gross_amount ?? ""),
      debit_account_id: "",
      credit_account_id: "",
      description: doc?.vendor || "",
      vat_code: "",
      allocations: [
        {
          cost_center_id: doc?.cost_center_id || "",
          amount: String(doc?.gross_amount ?? ""),
        },
      ],
    };
  }
  async function send(payload: Row) {
    setBusy(true);
    try {
      const r = await fetch("/api/postings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setEdit(null);
      setReversal(null);
      setMessage("Gespeichert.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  const visible = postings
    .filter(
      (p) =>
        (!status || p.status === status) &&
        (!search ||
          [
            p.description,
            documents.find((d) => d.id === p.document_id)?.invoice_number,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) => b.posting_date.localeCompare(a.posting_date));
  async function download() {
    setBusy(true);
    try {
      const r = await fetch("/api/datev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, test, bundle }),
      });
      if (!r.ok) throw Error((await r.json()).error);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        (test ? "TEST_" : "") + "EXTF_TinyFinance." + (bundle ? "zip" : "csv");
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        test
          ? "Testdatei erstellt. Ein echter Kanzlei-Testimport bleibt erforderlich."
          : "Export protokolliert. Die Buchungsdatei bleibt erneut abrufbar.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  const accountName = (id: string) => {
    const a = accounts.find((a) => a.id === id);
    return a ? [a.account_number, a.description].join(" · ") : "–";
  };
  return (
    <>
      <section className="panel">
        <div className="toolbar">
          <div className="row">
            <input
              aria-label="Buchungen suchen"
              placeholder="Text oder Rechnungsnummer suchen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Buchungsstatus"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Alle Status</option>
              {["draft", "reviewed", "approved", "exported"].map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </div>
          {canWrite && (
            <button onClick={() => setEdit(blank())}>Buchungsvorschlag</button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum / Beleg</th>
                <th>Soll</th>
                <th>Haben</th>
                <th>Betrag</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.posting_date}
                    <small>
                      {
                        documents.find((d) => d.id === p.document_id)
                          ?.invoice_number
                      }
                      {p.reversal_of ? " · Storno" : ""}
                    </small>
                  </td>
                  <td>{accountName(p.debit_account_id)}</td>
                  <td>{accountName(p.credit_account_id)}</td>
                  <td>{money(p.amount)}</td>
                  <td>
                    <span className={"badge " + p.status}>
                      {labels[p.status]}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      {canWrite && ["draft", "reviewed"].includes(p.status) && (
                        <button
                          className="secondary"
                          onClick={() =>
                            setEdit({
                              ...p,
                              amount: String(p.amount),
                              allocations: allocations
                                .filter((a) => a.posting_id === p.id)
                                .map((a) => ({
                                  cost_center_id: a.cost_center_id,
                                  amount: String(a.amount),
                                })),
                            })
                          }
                        >
                          Bearbeiten
                        </button>
                      )}
                      {canReview &&
                        ["draft", "reviewed"].includes(p.status) && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              send({
                                action: "approve",
                                id: p.id,
                                version: p.version,
                              })
                            }
                          >
                            Freigeben
                          </button>
                        )}
                      {canReview &&
                        ["approved", "exported"].includes(p.status) &&
                        !p.reversal_of &&
                        !postings.some((s) => s.reversal_of === p.id) && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setReversal(p);
                              setReason("");
                            }}
                          >
                            Stornieren
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="empty-state">
            <h3>Noch keine Buchungen</h3>
            <p>
              Prüfe einen Beleg und wähle die mit deiner Kanzlei abgestimmten
              Soll- und Habenkonten.
            </p>
          </div>
        )}
      </section>
      {edit && (
        <section className="panel">
          <h2>Buchungsvorschlag</h2>
          <p className="muted">
            Die Kontierung erfolgt ausdrücklich durch dich. Keine automatische
            KI-Freigabe.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send({
                action: "save",
                payload: Object.fromEntries(
                  [
                    "id",
                    "version",
                    "document_id",
                    "posting_date",
                    "amount",
                    "debit_account_id",
                    "credit_account_id",
                    "description",
                    "vat_code",
                    "allocations",
                  ].map((key) => [key, edit[key]]),
                ),
              });
            }}
          >
            <div className="editgrid">
              <label>
                Geprüfter Beleg
                <select
                  required
                  value={edit.document_id}
                  onChange={(e) =>
                    setEdit({
                      ...blank(e.target.value),
                      id: edit.id,
                      version: edit.version,
                    })
                  }
                >
                  <option value="">Bitte wählen</option>
                  {documents
                    .filter(
                      (d) =>
                        d.review_status === "reviewed" &&
                        d.upload_status === "ready" &&
                        d.currency === "EUR",
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.invoice_number} · {d.vendor} ·{" "}
                        {money(d.gross_amount)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Buchungsdatum
                <input
                  required
                  type="date"
                  value={edit.posting_date}
                  onChange={(e) =>
                    setEdit({ ...edit, posting_date: e.target.value })
                  }
                />
              </label>
              <label>
                Buchungsbetrag
                <input
                  required
                  type="number"
                  step="0.01"
                  value={edit.amount}
                  onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                />
              </label>
              {[
                ["debit_account_id", "Sollkonto"],
                ["credit_account_id", "Habenkonto"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <select
                    required
                    value={edit[key]}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: e.target.value })
                    }
                  >
                    <option value="">Bitte wählen</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_number} · {a.description}
                        {a.approved_by_advisor ? "" : " · unbestätigt"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Buchungstext
                <input
                  required
                  maxLength={60}
                  value={edit.description || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, description: e.target.value })
                  }
                />
              </label>
              <label>
                BU-Schlüssel (mit Kanzlei abstimmen)
                <input
                  maxLength={4}
                  pattern="[0-9]*"
                  value={edit.vat_code || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, vat_code: e.target.value })
                  }
                />
              </label>
            </div>
            <h3>Kostenstellenaufteilung</h3>
            {edit.allocations.map((split: Row, index: number) => (
              <div className="row allocation-row" key={index}>
                <label>
                  Kostenstelle
                  <select
                    required
                    value={split.cost_center_id}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        allocations: edit.allocations.map(
                          (a: Row, i: number) =>
                            i === index
                              ? { ...a, cost_center_id: e.target.value }
                              : a,
                        ),
                      })
                    }
                  >
                    <option value="">Bitte wählen</option>
                    {centers
                      .filter((c) => c.active !== false)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Betrag
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={split.amount}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        allocations: edit.allocations.map(
                          (a: Row, i: number) =>
                            i === index ? { ...a, amount: e.target.value } : a,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={edit.allocations.length === 1}
                  onClick={() =>
                    setEdit({
                      ...edit,
                      allocations: edit.allocations.filter(
                        (_: Row, i: number) => i !== index,
                      ),
                    })
                  }
                >
                  Entfernen
                </button>
              </div>
            ))}
            <div className="row">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setEdit({
                    ...edit,
                    allocations: [
                      ...edit.allocations,
                      { cost_center_id: "", amount: "" },
                    ],
                  })
                }
              >
                Weitere Kostenstelle
              </button>
              <button disabled={busy}>Vorschlag speichern</button>
              <button
                type="button"
                className="quiet"
                onClick={() => setEdit(null)}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </section>
      )}
      {reversal && (
        <section className="panel">
          <h2>Stornobuchung erstellen</h2>
          <p>
            Die ursprüngliche Buchung bleibt unverändert. Eine neue Gegenbuchung
            protokolliert die Korrektur.
          </p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              send({
                action: "reverse",
                id: reversal.id,
                date: reversalDate,
                reason,
              });
            }}
          >
            <label>
              Datum
              <input
                type="date"
                required
                value={reversalDate}
                onChange={(e) => setReversalDate(e.target.value)}
              />
            </label>
            <label>
              Begründung
              <input
                required
                maxLength={60}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button disabled={busy}>Storno bestätigen</button>
            <button
              type="button"
              className="quiet"
              onClick={() => setReversal(null)}
            >
              Abbrechen
            </button>
          </form>
        </section>
      )}
      {canReview && (
        <section className="panel">
          <h2>DATEV-Buchungsstapel</h2>
          <p className="warning">
            Formatprüfung ersetzt keinen Testimport beim Steuerberater.
            Testdateien verändern den Exportstatus nicht.
          </p>
          <div className="row">
            <label>
              Von
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Bis
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={test}
                onChange={(e) => setTest(e.target.checked)}
              />
              Testdatei
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={bundle}
                onChange={(e) => setBundle(e.target.checked)}
              />
              Originale und Belegzuordnung als ZIP
            </label>
            <button disabled={busy} onClick={download}>
              Export herunterladen
            </button>
          </div>
        </section>
      )}
      {batches.length > 0 && (
        <section className="panel">
          <h2>Protokollierte Exporte</h2>
          <ul>
            {batches.map((b) => (
              <li key={b.id}>
                <a href={"/api/datev-batches/" + b.id}>
                  {b.starts_on} – {b.ends_on} ·{" "}
                  {new Date(b.created_at).toLocaleString("de-DE")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p role="status" className="feedback">
        {message}
      </p>
    </>
  );
}
