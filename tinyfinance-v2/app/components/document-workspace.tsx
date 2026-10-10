"use client";
import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/money";
import { labels } from "@/lib/permissions";
type Doc = Record<string, any>;
type Center = { id: string; code: string; name: string; active?: boolean };
const fields = [
  ["vendor", "Lieferant", "text"],
  ["invoice_number", "Rechnungsnummer", "text"],
  ["invoice_date", "Rechnungsdatum", "date"],
  ["service_date", "Leistungsdatum", "date"],
  ["net_amount", "Netto", "number"],
  ["vat_amount", "Umsatzsteuer", "number"],
  ["gross_amount", "Brutto", "number"],
  ["currency", "Währung", "text"],
] as const;
export default function DocumentWorkspace({
  initial,
  centers,
  subjects = [],
  canEdit = true,
  aiEnabled = false,
  total: initialTotal = initial.length,
}: {
  initial: Doc[];
  centers: Center[];
  subjects?: { id: string; name: string }[];
  canEdit?: boolean;
  aiEnabled?: boolean;
  total?: number;
}) {
  const [docs, setDocs] = useState(initial),
    [selected, setSelected] = useState<Doc | null>(null),
    [busy, setBusy] = useState(false),
    [extracting, setExtracting] = useState(false),
    [message, setMessage] = useState(""),
    [trash, setTrash] = useState(false),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [center, setCenter] = useState(""),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(initialTotal),
    [history, setHistory] = useState<Doc[]>([]),
    [autoAi, setAutoAi] = useState(false);
  async function load(next = page) {
    const r = await fetch(
      "/api/documents?page=" +
        next +
        "&trash=" +
        (trash ? "1" : "0") +
        "&q=" +
        encodeURIComponent(query) +
        "&status=" +
        status +
        "&center=" +
        center,
    );
    const x = await r.json();
    if (!r.ok) throw Error(x.error);
    setDocs(x.rows);
    setTotal(x.total);
    setPage(next);
  }
  async function open(doc: Doc) {
    setSelected({ ...doc });
    setMessage("");
    setHistory([]);
    try {
      const r = await fetch("/api/audit?document=" + doc.id);
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setHistory(x.rows);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verlauf nicht verfügbar.");
    }
  }
  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const payload = Object.fromEntries([
        ...fields.map(([key]) => [
          key,
          selected[key] === "" ? null : (selected[key] ?? null),
        ]),
        ["cost_center_id", selected.cost_center_id || null],
        ["review_status", selected.review_status],
        ["version", selected.version],
        ["direction", selected.direction],
      ]);
      const r = await fetch("/api/documents/" + selected.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      await open(x.row);
      await load();
      setMessage("Gespeichert.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function extract(id: string) {
    const r = await fetch("/api/documents/" + id + "/extract", {
      method: "POST",
      signal: AbortSignal.timeout(90000),
    });
    const x = await r.json();
    if (!r.ok) throw Error(x.error);
    return x;
  }
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMessage("Originale werden gespeichert …");
    try {
      const r = await fetch("/api/documents", {
        method: "POST",
        body: new FormData(form),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      const messages: string[] = x.results.map(
        (v: any) =>
          v.filename + ": " + (v.status === 201 ? "gespeichert" : v.error),
      );
      if (autoAi) {
        for (const doc of x.results.filter((v: any) => v.status === 201)) {
          try {
            await extract(doc.id);
            messages.push(
              doc.filename + ": KI-Vorschlag zur Prüfung gespeichert.",
            );
          } catch (e) {
            messages.push(
              doc.filename +
                ": " +
                (e instanceof Error ? e.message : "KI fehlgeschlagen."),
            );
          }
        }
      }
      form.reset();
      await load(0);
      setMessage(messages.join("\n"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  const missing = selected
    ? fields
        .filter(
          ([key]) =>
            selected[key] === null ||
            selected[key] === undefined ||
            selected[key] === "",
        )
        .map(([, label]) => label)
    : [];
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={trash}
          onChange={async (e) => {
            const enabled = e.target.checked;
            setTrash(enabled);
            setSelected(null);
            setPage(0);
            try {
              const r = await fetch(
                "/api/documents?trash=" + (enabled ? "1" : "0"),
              );
              const x = await r.json();
              if (!r.ok) throw Error(x.error);
              setDocs(x.rows);
              setTotal(x.total);
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Liste nicht verfügbar.",
              );
            }
          }}
        />{" "}
        Papierkorb anzeigen
      </label>
      {canEdit && (
        <section className="panel upload-panel">
          <h2>Originale sicher ablegen</h2>
          <p className="muted">
            Bis zu 20 PDF-, JPG- oder PNG-Dateien · je 10 MB, zusammen 40 MB.
            Originale werden nicht überschrieben.
          </p>
          <form className="stack" onSubmit={upload}>
            <label>
              Dateien
              <input
                name="file"
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg"
                required
              />
            </label>
            <div className="row">
              <label>
                Kostenstelle
                <select name="cost_center_id">
                  <option value="">Später zuordnen</option>
                  {centers
                    .filter((c) => c.active !== false)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                </select>
              </label>
              {subjects.length > 0 && (
                <label>
                  Geschützter Steuerbereich
                  <select name="tax_subject_id">
                    <option value="">Betrieblicher Beleg</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {aiEnabled && (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={autoAi}
                    onChange={(e) => setAutoAi(e.target.checked)}
                  />
                  Nach Upload automatisch KI-Vorschläge anfordern (externer
                  Anbieter)
                </label>
              )}
              <button disabled={busy}>Belege hochladen</button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="toolbar">
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await load(0);
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Suche fehlgeschlagen.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              aria-label="Dateiname suchen"
              placeholder="Dateiname suchen …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Belegstatus"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Alle Status</option>
              {["pending", "reviewed", "rejected"].map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Kostenstelle filtern"
              value={center}
              onChange={(e) => setCenter(e.target.value)}
            >
              <option value="">Alle Kostenstellen</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
            <button disabled={busy}>Filtern</button>
          </form>
          <a className="button secondary" href="/api/export">
            Prüfliste CSV
          </a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Original</th>
                <th>Lieferant</th>
                <th>Datum</th>
                <th>Brutto</th>
                <th>Status</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.original_filename}</td>
                  <td>{d.vendor || "Noch nicht erfasst"}</td>
                  <td>{d.invoice_date || "–"}</td>
                  <td>
                    {d.gross_amount === null
                      ? "–"
                      : money(d.gross_amount, d.currency)}
                  </td>
                  <td>
                    <span className={"badge " + d.review_status}>
                      {d.upload_status === "ready"
                        ? labels[d.review_status]
                        : d.upload_status === "failed"
                          ? "Upload fehlgeschlagen"
                          : "Upload läuft"}
                    </span>
                  </td>
                  <td>
                    <button className="secondary" onClick={() => open(d)}>
                      Prüfen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!docs.length && (
          <div className="empty-state">
            <h3>Keine Belege gefunden</h3>
            <p>Lade eigene Originale hoch oder passe die Filter an.</p>
          </div>
        )}
        <div className="pagination">
          <span>
            {total} Belege · Seite {page + 1}
          </span>
          {[
            [-1, "Zurück"],
            [1, "Weiter"],
          ].map(([step, label]) => (
            <button
              key={label}
              className="secondary"
              disabled={
                busy || (step === -1 ? page === 0 : (page + 1) * 50 >= total)
              }
              onClick={async () => {
                try {
                  await load(page + Number(step));
                } catch (e) {
                  setMessage(String(e));
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <section className="panel">
          <div className="row">
            <h2>{selected.original_filename}</h2>
            <button className="quiet" onClick={() => setSelected(null)}>
              Schließen
            </button>
          </div>
          <div className="document-layout">
            <div>
              <a
                href={"/api/documents/" + selected.id}
                target="_blank"
                rel="noreferrer"
              >
                Original separat öffnen ↗
              </a>
              {selected.upload_status === "ready" &&
                (selected.mime_type === "application/pdf" ? (
                  <iframe
                    className="document-preview"
                    title="Originalbeleg"
                    src={"/api/documents/" + selected.id}
                  />
                ) : (
                  <img
                    className="document-preview"
                    alt="Originalbeleg"
                    src={"/api/documents/" + selected.id}
                  />
                ))}
            </div>
            <div>
              <p className="muted">
                KI-Ergebnisse bleiben unverbindliche Vorschläge. Vergleiche
                sämtliche Angaben mit dem Original.
              </p>
              {missing.length > 0 && (
                <p className="warning">
                  Fehlende Angaben: {missing.join(", ")}
                </p>
              )}
              <div className="editgrid">
                {fields.map(([key, label, type]) => (
                  <label key={key}>
                    {label}
                    <input
                      disabled={!canEdit || !!selected?.discarded_at}
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      value={selected[key] ?? ""}
                      onChange={(e) =>
                        setSelected({ ...selected, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Art
                  <select
                    disabled={!canEdit || !!selected?.discarded_at}
                    value={selected.direction}
                    onChange={(e) =>
                      setSelected({ ...selected, direction: e.target.value })
                    }
                  >
                    <option value="expense">Eingangsrechnung / Ausgabe</option>
                    <option value="income">Ausgangsrechnung / Einnahme</option>
                  </select>
                </label>
                <label>
                  Kostenstelle
                  <select
                    disabled={!canEdit || !!selected?.discarded_at}
                    value={selected.cost_center_id || ""}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        cost_center_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Nicht zugeordnet</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Prüfstatus
                  <select
                    disabled={!canEdit || !!selected?.discarded_at}
                    value={selected.review_status}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        review_status: e.target.value,
                      })
                    }
                  >
                    {["pending", "reviewed", "rejected"].map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!canEdit ? (
                <p className="muted">
                  Die KI-Erkennung kann nur durch Administratoren oder die
                  Buchhaltung gestartet werden.
                </p>
              ) : !aiEnabled ? (
                <p className="warning" id="ai-availability">
                  Die KI-Erkennung ist für diesen Mandanten noch nicht
                  aktiviert. Öffne{" "}
                  <Link href="/settings">
                    Einstellungen → KI-Belegerkennung
                  </Link>
                  , setze den Haken und klicke „KI-Einstellung speichern“. Öffne
                  danach diesen Beleg erneut.
                </p>
              ) : null}
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !selected.discarded_at &&
                      !window.confirm(
                        "Diesen Beleg in den Papierkorb verschieben? Das Original bleibt erhalten.",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      const r = await fetch("/api/documents/" + selected.id, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          version: selected.version,
                          restore: !!selected.discarded_at,
                        }),
                      });
                      const x = await r.json();
                      if (!r.ok) throw Error(x.error);
                      setSelected(null);
                      await load(0);
                      setMessage(
                        selected.discarded_at
                          ? "Beleg wiederhergestellt."
                          : "Beleg in den Papierkorb verschoben.",
                      );
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Aktion fehlgeschlagen.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {selected.discarded_at
                    ? "Beleg wiederherstellen"
                    : "Beleg in Papierkorb"}
                </button>
              )}
              {canEdit && (
                <div className="row">
                  <button
                    disabled={busy || !!selected.discarded_at}
                    onClick={save}
                  >
                    Änderungen speichern
                  </button>
                  <button
                    className="secondary"
                    disabled={busy || !aiEnabled || !!selected.discarded_at}
                    onClick={async () => {
                      setBusy(true);
                      setExtracting(true);
                      setMessage(
                        "Beleg wird ausgelesen … Das kann bis zu einer Minute dauern.",
                      );
                      try {
                        const x = await extract(selected.id);
                        setSelected(x.row);
                        setMessage(x.notice);
                      } catch (e) {
                        setMessage(
                          e instanceof Error &&
                            (e.name === "TimeoutError" ||
                              e.name === "AbortError")
                            ? "Die Erkennung hat zu lange gedauert. Bitte neu laden und den Belegstatus prüfen."
                            : e instanceof Error
                              ? e.message
                              : "KI fehlgeschlagen.",
                        );
                      } finally {
                        setExtracting(false);
                        setBusy(false);
                      }
                    }}
                  >
                    {extracting ? "Erkennung läuft …" : "KI-Erkennung"}
                  </button>
                  {selected.review_status === "reviewed" && (
                    <Link
                      className="button secondary"
                      href={"/ledger?document=" + selected.id}
                    >
                      Buchungsvorschlag erstellen
                    </Link>
                  )}
                </div>
              )}
              <p className="feedback" role="status">
                {message || selected.extraction_error}
              </p>
              {selected.extraction_suggestion?.fields && (
                <section className="suggestion">
                  <h3>KI-Vorschlag · noch ungeprüft</h3>
                  <dl>
                    {fields.map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>
                          {String(
                            selected.extraction_suggestion.fields[key] ??
                              "Unbekannt",
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {canEdit && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setSelected({
                          ...selected,
                          ...Object.fromEntries(
                            Object.entries(
                              selected.extraction_suggestion.fields,
                            ).filter(([, v]) => v !== null),
                          ),
                          review_status: "pending",
                        });
                        setMessage(
                          "Vorschlag in die Eingabefelder übernommen. Bitte prüfen und speichern.",
                        );
                      }}
                    >
                      Vorschlag zur manuellen Prüfung übernehmen
                    </button>
                  )}
                </section>
              )}
            </div>
          </div>
          <h3>Bearbeitungshistorie</h3>
          <ul className="timeline">
            {history.map((h) => (
              <li key={h.id}>
                <time>{new Date(h.at).toLocaleString("de-DE")}</time> ·{" "}
                {h.action === "INSERT" ? "Erfasst" : "Geändert"} · Benutzer{" "}
                {h.actor_id?.slice(0, 8) || "System"}
                {h.details?.after && (
                  <p>
                    {fields
                      .filter(
                        ([key]) =>
                          h.details?.before?.[key] !== h.details?.after?.[key],
                      )
                      .map(
                        ([key, label]) =>
                          label + ": " + String(h.details.after[key] ?? "–"),
                      )
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!selected && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
    </>
  );
}
