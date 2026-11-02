"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { houseDashboard, type HouseCost } from "@/lib/house-dashboard";
import type { Row } from "@/lib/data";
const euro = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
const monthNames = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
export default function HouseDashboard({
  centers,
  platforms,
  costs,
  today,
  canEdit,
}: {
  centers: Row[];
  platforms: Row[];
  costs: HouseCost[];
  today: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [year, setYear] = useState(Number(today.slice(0, 4))),
    [month, setMonth] = useState(Number(today.slice(5, 7)) - 1),
    [selected, setSelected] = useState("all"),
    [edit, setEdit] = useState<HouseCost | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const report = useMemo(
    () => houseDashboard(centers, platforms, costs, year),
    [centers, platforms, costs, year],
  );
  const years = [
    ...new Set([
      Number(today.slice(0, 4)),
      ...platforms.map((p) => Number(String(p.period_end).slice(0, 4))),
      ...costs.map((c) => Number(c.starts_month.slice(0, 4))),
    ]),
  ]
    .filter((y) => y >= 2000 && y <= 2100)
    .sort((a, b) => b - a);
  const houses = report.houses.filter(
    (h) => selected === "all" || h.id === selected,
  );
  const rows = houses.map((h) => h.months[month]);
  const sum = (
    field:
      "gross" | "refunds" | "fees" | "fixed" | "variable" | "net" | "planned",
  ) => rows.reduce((n, r) => n + r[field], 0);
  const save = async (form: HTMLFormElement) => {
    setBusy(true);
    setMessage("");
    try {
      const f = new FormData(form);
      const amount = String(f.get("amount")).trim();
      if (!amount) throw Error("Betrag fehlt.");
      const recurrence = String(f.get("recurrence"));
      const payload = {
        ...(edit?.id
          ? { id: edit.id, record_version: edit.record_version }
          : {}),
        cost_center_id: String(f.get("cost_center_id")),
        name: String(f.get("name")),
        kind: String(f.get("kind")),
        basis: String(f.get("basis")),
        amount: Number(amount),
        starts_month: String(f.get("starts_month")),
        ends_month:
          recurrence === "once"
            ? String(f.get("starts_month"))
            : String(f.get("ends_month")) || null,
        recurrence,
        active: true,
      };
      const r = await fetch("/api/house-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Speichern fehlgeschlagen.");
      setEdit(null);
      form.reset();
      setMessage("Kosten gespeichert.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  const deactivate = async (cost: HouseCost) => {
    setBusy(true);
    try {
      const {
        id,
        record_version,
        cost_center_id,
        name,
        kind,
        amount,
        starts_month,
        ends_month,
        recurrence,
        basis,
      } = cost;
      const r = await fetch("/api/house-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          record_version,
          cost_center_id,
          name,
          kind,
          amount: Number(amount),
          starts_month,
          ends_month,
          recurrence,
          basis,
          active: false,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      router.refresh();
      setMessage("Kosteneintrag deaktiviert.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Änderung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="house-dashboard">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Deine Ferienhäuser</span>
          <h2>Einnahmen und Kosten im Monat</h2>
        </div>
      </div>
      <div className="house-filters">
        <label>
          Jahr
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          Monat
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {monthNames.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ferienhaus
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">Alle Häuser</option>
            {report.houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        Buchungsumsätze werden vollständig dem Abreise-Monat zugeordnet, auch
        bei Aufenthalten über den Monatswechsel. Zukunftsbuchungen sind
        enthalten; dies ist kein Nachweis eingegangener Bankzahlungen.
      </p>
      {report.duplicates > 0 && (
        <p className="warning">
          {report.duplicates} mehrdeutige Holidu-Abrechnungen im Jahr sind aus
          diesen Summen ausgeschlossen. <a href="/reports">Dubletten prüfen</a>
        </p>
      )}
      {report.unassigned > 0 && (
        <p className="warning">
          {report.unassigned} Abrechnungen sind keinem angezeigten Ferienhaus
          zugeordnet. <a href="/finance/platforms">Zuordnung prüfen</a>
        </p>
      )}
      {rows.some((r) => !r.fixedCount) && (
        <p className="warning">
          Für {rows.filter((r) => !r.fixedCount).length} Haus / Häuser fehlen
          Fixkosten im gewählten Monat. Diese sind im vorläufigen Überschuss
          noch nicht abgezogen.
        </p>
      )}
      <div className="house-summary panel">
        <span>
          {monthNames[month]} {year} · {houses.length} Häuser
        </span>
        <strong>{euro(sum("gross") - sum("refunds"))} Einnahmen</strong>
        <span>
          {euro(sum("fixed") + sum("fees") + sum("variable"))} erfasste /
          geplante Kosten
        </span>
        <strong
          className={sum("net") < 0 ? "house-negative" : "house-positive"}
        >
          {euro(sum("net"))} vorläufiger Überschuss
        </strong>
      </div>
      <div className="house-cards">
        {houses.map((h) => {
          const r = h.months[month],
            income = r.gross - r.refunds,
            total = r.fixed + r.fees + r.variable,
            max = Math.max(1, Math.abs(income), total);
          return (
            <article className="panel house-card" key={h.id}>
              <span className="eyebrow">Kostenstelle {h.code}</span>
              <h3>{h.name}</h3>
              <div className="house-bars">
                <span>Einnahmen {euro(income)}</span>
                <div className="house-track">
                  <div
                    style={{ width: (Math.max(0, income) / max) * 100 + "%" }}
                  />
                </div>
                <span>Kosten {euro(total)}</span>
                <div className="house-track house-cost-track">
                  <div style={{ width: (total / max) * 100 + "%" }} />
                </div>
              </div>
              <dl className="summary-list">
                <div>
                  <dt>Buchungsumsatz</dt>
                  <dd>{euro(r.gross)}</dd>
                </div>
                <div>
                  <dt>Erstattungen</dt>
                  <dd>− {euro(r.refunds)}</dd>
                </div>
                <div>
                  <dt>Fixkosten</dt>
                  <dd>{r.fixedCount ? euro(r.fixed) : "noch offen"}</dd>
                </div>
                <div>
                  <dt>Plattformprovisionen</dt>
                  <dd>{euro(r.fees)}</dd>
                </div>
                <div>
                  <dt>Weitere variable Kosten</dt>
                  <dd>{euro(r.variable)}</dd>
                </div>
                <div>
                  <dt>Davon Planwerte</dt>
                  <dd>{euro(r.planned)}</dd>
                </div>
              </dl>
              <div className="house-result">
                <span>Vorläufiger Überschuss</span>
                <strong
                  className={r.net < 0 ? "house-negative" : "house-positive"}
                >
                  {euro(r.net)}
                </strong>
              </div>
              <p className="muted">
                {r.count} Abrechnungen · {r.additionalCount} zusätzliche
                Kostenpositionen.
                {!r.fixedCount ? " Fixkosten für diesen Monat ergänzen." : ""}
              </p>
              <details>
                <summary>Alle Monate {year}</summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Monat</th>
                        <th>Einnahmen nach Erstattung</th>
                        <th>Fix</th>
                        <th>Variabel inkl. Plattform</th>
                        <th>Überschuss*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.months.map((m, i) => (
                        <tr key={m.month}>
                          <th>{monthNames[i]}</th>
                          <td>{euro(m.gross - m.refunds)}</td>
                          <td>{m.fixedCount ? euro(m.fixed) : "offen"}</td>
                          <td>{euro(m.fees + m.variable)}</td>
                          <td>{euro(m.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>Jahr gesamt*</th>
                        <td>
                          {euro(
                            h.months.reduce(
                              (n, m) => n + m.gross - m.refunds,
                              0,
                            ),
                          )}
                        </td>
                        <td>
                          {euro(h.months.reduce((n, m) => n + m.fixed, 0))}
                        </td>
                        <td>
                          {euro(
                            h.months.reduce(
                              (n, m) => n + m.fees + m.variable,
                              0,
                            ),
                          )}
                        </td>
                        <td>{euro(h.months.reduce((n, m) => n + m.net, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <p className="muted">
        * Überschuss nach bisher erfassten Kosten und ausdrücklich eingegebenen
        Planwerten. Fehlende Kosten sind darin noch nicht abgezogen. Beträge
        inkl. gegebenenfalls enthaltener Umsatzsteuer; vor Steuer und AfA.
        Kreditraten können als Liquiditätskosten erfasst werden. Es ist kein
        steuerlicher Gewinn.
      </p>
      {canEdit && (
        <details className="panel" open={!!edit}>
          <summary>Hauskosten erfassen und ändern</summary>
          <p>
            Fixkosten z. B. Kreditrate, Pacht oder Versicherung. Variable Kosten
            z. B. Reinigung, Wäsche und Reparaturen. Plattformprovisionen werden
            bereits automatisch abgezogen: nicht zusätzlich eingeben. Journal-,
            Excel- und Gemeinschaftskosten werden hier nicht automatisch addiert
            oder verteilt.
          </p>
          <form
            key={edit?.id || "new"}
            className="house-cost-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(e.currentTarget);
            }}
          >
            <label>
              Ferienhaus
              <select
                required
                name="cost_center_id"
                defaultValue={edit?.cost_center_id || report.houses[0]?.id}
              >
                {report.houses.map((h) => (
                  <option value={h.id} key={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bezeichnung
              <input
                required
                maxLength={160}
                name="name"
                defaultValue={edit?.name}
                placeholder="z. B. Reinigung oder Kreditrate"
              />
            </label>
            <label>
              Kostenart
              <select name="kind" defaultValue={edit?.kind || "fixed"}>
                <option value="fixed">Fixkosten</option>
                <option value="variable">Variable Kosten</option>
              </select>
            </label>
            <label>
              Betrag € inkl. USt.
              <input
                required
                type="number"
                min="0"
                max="99999999.99"
                step="0.01"
                name="amount"
                defaultValue={edit?.amount}
              />
            </label>
            <label>
              Häufigkeit
              <select
                name="recurrence"
                defaultValue={edit?.recurrence || "monthly"}
              >
                <option value="monthly">Monatlich wiederkehrend</option>
                <option value="once">Einzelmonat</option>
              </select>
            </label>
            <label>
              Ab / im Monat
              <input
                required
                type="month"
                name="starts_month"
                defaultValue={
                  edit?.starts_month ||
                  `${year}-${String(month + 1).padStart(2, "0")}`
                }
              />
            </label>
            <label>
              Bis Monat (leer = laufend)
              <input
                type="month"
                name="ends_month"
                defaultValue={edit?.ends_month || ""}
              />
            </label>
            <label>
              Datenstatus
              <select name="basis" defaultValue={edit?.basis || "planned"}>
                <option value="planned">Planwert</option>
                <option value="recorded">Erfasster Betrag</option>
              </select>
            </label>
            <div>
              <button disabled={busy}>Kosten speichern</button>
              {edit && (
                <button type="button" onClick={() => setEdit(null)}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Haus</th>
                  <th>Kosten</th>
                  <th>Art</th>
                  <th>Betrag</th>
                  <th>Zeitraum</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {costs
                  .filter((c) => c.active)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        {centers.find((h) => h.id === c.cost_center_id)?.name}
                      </td>
                      <td>{c.name}</td>
                      <td>{c.kind === "fixed" ? "Fix" : "Variabel"}</td>
                      <td>{euro(Math.round(Number(c.amount) * 100))}</td>
                      <td>
                        {c.starts_month} –{" "}
                        {c.recurrence === "once"
                          ? c.starts_month
                          : c.ends_month || "laufend"}
                      </td>
                      <td>{c.basis === "planned" ? "Plan" : "Erfasst"}</td>
                      <td>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEdit(c)}
                        >
                          Ändern
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void deactivate(c)}
                        >
                          Deaktivieren
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
