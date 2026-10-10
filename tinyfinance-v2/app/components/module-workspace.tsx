"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Field } from "@/lib/modules";
import { labels } from "@/lib/permissions";
import { money } from "@/lib/money";
type Row = Record<string, any>;
type Choice = { id: string; label: string; property_id?: string };
export default function ModuleWorkspace({
  moduleKey,
  title,
  description,
  fields,
  initial,
  total: initialTotal,
  choices,
  canEdit,
}: {
  moduleKey: string;
  title: string;
  description: string;
  fields: Field[];
  initial: Row[];
  total: number;
  choices: Record<string, Choice[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial),
    [total, setTotal] = useState(initialTotal),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Row | null>(null);
  function blank() {
    return Object.fromEntries(
      fields.map((f) => [
        f.key,
        f.kind === "boolean"
          ? true
          : f.key === "currency"
            ? "EUR"
            : f.kind === "select"
              ? f.options?.[0] || ""
              : "",
      ]),
    );
  }
  async function load(next: number) {
    setBusy(true);
    try {
      const r = await fetch(
        "/api/modules/" +
          moduleKey +
          "?page=" +
          next +
          "&search=" +
          encodeURIComponent(search),
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setRows(data.rows);
      setTotal(data.total);
      setPage(next);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      const payload = Object.fromEntries(
        fields.map((f) => [f.key, edit[f.key] ?? ""]),
      );
      if (edit.id) {
        payload.id = edit.id;
        payload.record_version = edit.record_version;
      }
      const r = await fetch("/api/modules/" + moduleKey, {
        method: edit.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setEdit(null);
      router.refresh();
      await load(page);
      setMessage("Gespeichert.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  function display(row: Row, f: Field) {
    const value = row[f.key];
    if (value === null || value === undefined || value === "") return "–";
    if (f.kind === "boolean") return value ? "Ja" : "Nein";
    if (f.kind === "relation")
      return (
        choices[f.relation || ""]?.find((c) => c.id === value)?.label ||
        "Zuordnung"
      );
    if (f.kind === "money") return money(value, row.currency || "EUR");
    return labels[String(value)] || String(value);
  }
  return (
    <>
      <section className="panel">
        <p className="muted">{description}</p>
        <div className="toolbar">
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              load(0);
            }}
          >
            <label className="sr-only" htmlFor="module-search">
              Suchen
            </label>
            <input
              id="module-search"
              placeholder="Nach Bezeichnung suchen …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button disabled={busy}>Suchen</button>
          </form>
          <a
            className="button secondary"
            href={"/api/module-export/" + moduleKey}
          >
            CSV exportieren
          </a>
          {canEdit && (
            <button
              onClick={() => {
                setEdit(blank());
                setMessage("");
              }}
            >
              Neuer Eintrag
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {fields.slice(0, 6).map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {fields.slice(0, 6).map((f) => (
                    <td key={f.key}>{display(row, f)}</td>
                  ))}
                  <td>
                    <button
                      className="secondary"
                      onClick={() => setEdit({ ...row })}
                    >
                      {canEdit ? "Bearbeiten" : "Details"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty-state">
            <h3>Noch keine Einträge</h3>
            <p>
              {search
                ? "Für diese Suche wurden keine Einträge gefunden."
                : "Hier erscheinen deine gespeicherten Daten."}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {total} Einträge · Seite {page + 1}
          </span>
          <button
            className="secondary"
            disabled={busy || page === 0}
            onClick={() => load(page - 1)}
          >
            Zurück
          </button>
          <button
            className="secondary"
            disabled={busy || (page + 1) * 50 >= total}
            onClick={() => load(page + 1)}
          >
            Weiter
          </button>
        </div>
      </section>
      {edit && (
        <section className="panel">
          <div className="row">
            <h2>{edit.id ? title + " bearbeiten" : "Neuer Eintrag"}</h2>
            <button className="quiet" onClick={() => setEdit(null)}>
              Schließen
            </button>
          </div>
          <form onSubmit={save}>
            <div className="editgrid">
              {fields.map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.kind === "boolean" ? (
                    <input
                      disabled={!canEdit}
                      type="checkbox"
                      checked={!!edit[f.key]}
                      onChange={(e) =>
                        setEdit({ ...edit, [f.key]: e.target.checked })
                      }
                    />
                  ) : f.kind === "select" || f.kind === "relation" ? (
                    <select
                      disabled={!canEdit}
                      required={f.required}
                      value={edit[f.key] ?? ""}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          [f.key]: e.target.value,
                          ...(f.key === "property_id" ? { unit_id: "" } : {}),
                        })
                      }
                    >
                      <option value="">Bitte wählen</option>
                      {f.kind === "select"
                        ? f.options?.map((o) => (
                            <option value={o} key={o}>
                              {labels[o] || o}
                            </option>
                          ))
                        : choices[f.relation || ""]
                            ?.filter(
                              (c) =>
                                f.key !== "unit_id" ||
                                c.property_id === edit.property_id,
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                    </select>
                  ) : (
                    <input
                      disabled={!canEdit}
                      required={f.required}
                      type={
                        f.kind === "date"
                          ? "date"
                          : f.kind === "money" || f.kind === "number"
                            ? "number"
                            : "text"
                      }
                      step={
                        f.kind === "money"
                          ? "0.01"
                          : f.kind === "number"
                            ? "any"
                            : undefined
                      }
                      value={edit[f.key] ?? ""}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          [f.key]: e.target.value,
                          ...(f.key === "property_id" ? { unit_id: "" } : {}),
                        })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            {canEdit && <button disabled={busy}>Speichern</button>}
            {canEdit &&
              edit.id &&
              ["properties", "property-units"].includes(moduleKey) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Diesen unbenutzten Eintrag löschen? Verknüpfte Einträge bleiben geschützt.",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      const r = await fetch("/api/modules/" + moduleKey, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: edit.id,
                          record_version: edit.record_version,
                        }),
                      });
                      const x = await r.json();
                      if (!r.ok) throw Error(x.error);
                      setEdit(null);
                      router.refresh();
                      await load(0);
                      setMessage("Eintrag gelöscht.");
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Löschen fehlgeschlagen.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Unbenutzten Eintrag löschen
                </button>
              )}
          </form>
        </section>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
    </>
  );
}
