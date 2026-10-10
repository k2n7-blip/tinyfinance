import { pageContext } from "@/lib/access";
import { allRows, type Row } from "@/lib/data";
import { permits } from "@/lib/permissions";
import { date } from "@/lib/modules";
import { cents, decimal, money } from "@/lib/money";
import {
  forecastInterest,
  forecastLoan,
  subtractMonths,
  addMonths,
} from "@/lib/forecasts";
import { ledgerReport, openDocuments, paidPreparation } from "@/lib/reporting";
import FinanceShell from "@/app/components/finance-shell";
export const dynamic = "force-dynamic";
const moneyCents = (v: number) => money(decimal(v));
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const a = await pageContext();
  const params = await searchParams;
  const now = new Date().toISOString().slice(0, 10);
  const from = date.parse(params.from || now.slice(0, 4) + "-01-01"),
    to = date.parse(params.to || now);
  const [
    postings,
    allocations,
    accounts,
    docs,
    centers,
    transactions,
    matches,
    platforms,
    bankAccounts,
    transfers,
  ] = await Promise.all(
    [
      "postings",
      "posting_allocations",
      "chart_accounts",
      "documents",
      "cost_centers",
      "bank_transactions",
      "bank_matches",
      "platform_settlements",
      "bank_accounts",
      "bank_transfers",
    ].map((t) => allRows(a.client, t, a.org)),
  );
  const report = ledgerReport(postings, allocations, accounts, docs, from, to),
    open = openDocuments(docs, matches),
    paid = paidPreparation(
      docs,
      matches,
      transactions.filter((t) => t.currency === "EUR"),
      from,
      to,
    );
  const selectedPlatforms = platforms.filter(
    (p) =>
      p.status !== "cancelled" && p.period_start <= to && p.period_end >= from,
  );
  const cash = transactions.filter(
    (t) =>
      t.currency === "EUR" &&
      t.booked_on >= from &&
      t.booked_on <= to &&
      !transfers.some(
        (x) =>
          x.status === "confirmed" &&
          [x.debit_transaction_id, x.credit_transaction_id].includes(t.id),
      ),
  );
  const cashTotal = cash.reduce((s, t) => s + cents(t.amount), 0),
    days = Math.max(1, (Date.parse(to) - Date.parse(from)) / 86400000 + 1);
  let privateData: Record<string, Row[]> = {};
  if (permits(a.role, "private", a.privateAccess)) {
    const tables = [
      "properties",
      "rental_entries",
      "interest_accounts",
      "interest_rate_history",
      "interest_entries",
      "loans",
      "insurance_contracts",
      "pension_records",
      "assets",
      "tax_subjects",
    ];
    const rows = await Promise.all(
      tables.map((t) => allRows(a.client, t, a.org)),
    );
    privateData = Object.fromEntries(tables.map((t, i) => [t, rows[i]]));
  }
  let timeEntries: Row[] = [],
    employees: Row[] = [];
  if (permits(a.role, "payroll", false, a.payrollAccess)) {
    [timeEntries, employees] = await Promise.all(
      ["time_entries", "employees"].map((t) => allRows(a.client, t, a.org)),
    );
  }
  const pensionLatest = [...(privateData.pension_records || [])]
    .sort((x, y) => String(y.record_date).localeCompare(String(x.record_date)))
    .filter(
      (p, i, arr) =>
        arr.findIndex(
          (r) =>
            r.contract_name === p.contract_name &&
            r.tax_subject_id === p.tax_subject_id,
        ) === i,
    );
  const assetsTotal =
    (privateData.properties || []).reduce(
      (s, p) =>
        s +
        Math.round(
          (cents(p.estimated_value || 0) * Number(p.ownership_percent)) / 100,
        ),
      0,
    ) +
    (privateData.interest_accounts || []).reduce(
      (s, r) => s + cents(r.balance),
      0,
    ) +
    (privateData.assets || []).reduce((s, r) => s + cents(r.value || 0), 0) +
    pensionLatest.reduce((s, r) => s + cents(r.capital_value || 0), 0) +
    bankAccounts
      .filter((b) => b.account_type !== "savings" && b.currency === "EUR")
      .reduce((s, b) => s + cents(b.balance || 0), 0);
  const loanTotal = (privateData.loans || []).reduce(
    (s, r) => s + cents(r.balance || 0),
    0,
  );
  return (
    <FinanceShell
      title="Auswertungen"
      subtitle="Gespeicherte Daten und nachvollziehbare Annahmen"
      role={a.role}
      privateAccess={a.privateAccess}
      payrollAccess={a.payrollAccess}
    >
      <section className="panel">
        <form className="row">
          <label>
            Von
            <input type="date" name="from" defaultValue={from} required />
          </label>
          <label>
            Bis
            <input type="date" name="to" defaultValue={to} required />
          </label>
          <button>Zeitraum anwenden</button>
        </form>
        <p className="muted">
          Buchungswerte sind Bruttowerte aus freigegebenen Buchungen und
          Stornos. Die Kontenart im bestätigten Kontenplan bestimmt Einnahmen
          und Ausgaben.
        </p>
      </section>
      <div className="cards">
        {[
          ["Gebuchte Einnahmen", report.income],
          ["Gebuchte Ausgaben", report.expense],
          ["USt auf Ausgangsbelegen", report.outputVat],
          ["USt auf Eingangsbelegen", report.inputVat],
        ].map(([label, value]) => (
          <section className="card" key={label}>
            <span>{label}</span>
            <strong>{moneyCents(Number(value))}</strong>
          </section>
        ))}
      </div>
      <p className="warning">
        Umsatzsteuer- und EÜR-Vorbereitung: keine Steueranmeldung, keine Aussage
        über Vorsteuerabzug, Soll-/Istversteuerung oder steuerliche
        Abzugsfähigkeit. Fachliche Prüfung bleibt erforderlich.
      </p>
      <section className="panel">
        <h2>Kostenstellenrechnung</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kostenstelle</th>
                <th>Einnahmen brutto</th>
                <th>Ausgaben brutto</th>
                <th>Saldo</th>
                <th>Arbeitskosten-Vorbereitung</th>
              </tr>
            </thead>
            <tbody>
              {centers.map((c) => {
                const sums = report.byCenter.get(c.id) || {
                  income: 0,
                  expense: 0,
                };
                const labour = timeEntries
                  .filter(
                    (t) =>
                      t.cost_center_id === c.id &&
                      t.approval_status === "approved" &&
                      t.worked_on >= from &&
                      t.worked_on <= to,
                  )
                  .reduce(
                    (s, t) =>
                      s +
                      Math.round(
                        (cents(
                          employees.find((e) => e.id === t.employee_id)
                            ?.hourly_cost || 0,
                        ) *
                          t.minutes) /
                          60,
                      ),
                    0,
                  );
                return (
                  <tr key={c.id}>
                    <td>
                      {c.code} · {c.name}
                    </td>
                    <td>{moneyCents(sums.income)}</td>
                    <td>{moneyCents(sums.expense)}</td>
                    <td>{moneyCents(sums.income - sums.expense)}</td>
                    <td>
                      {timeEntries.length
                        ? moneyCents(labour)
                        : "Keine zugänglichen Zeitdaten"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Arbeitskosten = genehmigte Minuten × hinterlegte Stundenkosten / 60,
          pro Zeitzeile auf Cent gerundet. Nicht zusätzlich als Buchung erfasst.
        </p>
      </section>
      <div className="report-grid">
        <section className="panel">
          <h2>Zugeordnete Zahlungen · EÜR-Vorbereitung</h2>
          <dl className="summary-list">
            <div>
              <dt>Einnahmen brutto</dt>
              <dd>{moneyCents(paid.income)}</dd>
            </div>
            <div>
              <dt>Ausgaben brutto</dt>
              <dd>{moneyCents(paid.expense)}</dd>
            </div>
          </dl>
          <p className="muted">
            Nur bestätigte EUR-Belegzuordnungen, nach Bankbuchungsdatum. Andere
            Währungen werden nicht umgerechnet. Steuerzahlungen, Abschreibungen
            und fachliche Korrekturen separat prüfen.
          </p>
        </section>
        <section className="panel">
          <h2>Plattformen · erfasste Abrechnungen</h2>
          <dl className="summary-list">
            {[
              ["Brutto", "gross_amount"],
              ["Provisionen", "commission"],
              ["Erstattungen", "refunds"],
              ["Auszahlungen", "payout"],
            ].map(([label, key]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {moneyCents(
                    selectedPlatforms.reduce(
                      (s, p) => s + cents(p[key] || 0),
                      0,
                    ),
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Abrechnungsperioden, die den Zeitraum berühren, werden vollständig
            berücksichtigt; keine tägliche Umsatzverteilung.
          </p>
          {selectedPlatforms
            .filter((p) => p.occupancy_nights > 0)
            .map((p) => (
              <p key={p.id}>
                {p.reference}:{" "}
                {Math.round(
                  (Number(p.guest_nights) / Number(p.occupancy_nights)) * 100,
                )}{" "}
                % Auslastung der angegebenen verfügbaren Nächte
              </p>
            ))}
        </section>
      </div>
      <section className="panel">
        <h2>Offene Posten · aktueller Stand</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Beleg</th>
                <th>Lieferant / Kunde</th>
                <th>Art</th>
                <th>Offen</th>
              </tr>
            </thead>
            <tbody>
              {open.map((d) => (
                <tr key={d.id}>
                  <td>{d.invoice_number}</td>
                  <td>{d.vendor}</td>
                  <td>
                    {d.direction === "income" ? "Forderung" : "Verbindlichkeit"}
                  </td>
                  <td>{money(decimal(d.remaining), d.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!open.length && (
          <p className="muted">Keine offenen geprüften Belege.</p>
        )}
      </section>
      <section className="panel">
        <h2>Kontensalden · Buchungsjournal</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Konto</th>
                <th>Soll</th>
                <th>Haben</th>
                <th>Soll − Haben</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const r = report.byAccount.get(account.id) || {
                  debit: 0,
                  credit: 0,
                };
                return (
                  <tr key={account.id}>
                    <td>
                      {account.account_number} · {account.description}
                    </td>
                    <td>{moneyCents(r.debit)}</td>
                    <td>{moneyCents(r.credit)}</td>
                    <td>{moneyCents(r.debit - r.credit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Cashflow-Szenario</h2>
        {cash.length ? (
          <>
            <p className="muted">
              Fortschreibung des durchschnittlichen täglichen Nettocashflows vom{" "}
              {from} bis {to}, einschließlich aller zugänglichen EUR-Konten,
              ohne bestätigte Eigenüberträge. Keine zusätzlichen
              Vertragszahlungen angenommen. Die Werte zeigen eine Veränderung,
              keinen behaupteten Kontostand.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Horizont ab heute</th>
                    <th>Kumulierte Veränderung</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 3, 6, 12].map((month) => {
                    const future = addMonths(now, month),
                      forecastDays =
                        (Date.parse(future) - Date.parse(now)) / 86400000;
                    return (
                      <tr key={month}>
                        <td>
                          {month} Monat{month > 1 ? "e" : ""}
                        </td>
                        <td>
                          {moneyCents(
                            Math.round((cashTotal / days) * forecastDays),
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">
            Ohne importierte historische Umsätze wird keine Cashflow-Prognose
            erstellt.
          </p>
        )}
      </section>
      {privateData.interest_accounts && (
        <>
          <section className="panel">
            <h2>Vermögensbilanz · eingegebene Werte</h2>
            <dl className="summary-list">
              <div>
                <dt>Vermögenswerte</dt>
                <dd>{moneyCents(assetsTotal)}</dd>
              </div>
              <div>
                <dt>Restschulden</dt>
                <dd>{moneyCents(loanTotal)}</dd>
              </div>
              <div>
                <dt>Nettovermögen</dt>
                <dd>{moneyCents(assetsTotal - loanTotal)}</dd>
              </div>
            </dl>
            <p className="muted">
              Immobilien anteilig nach Eigentumsquote; letzter Vorsorgestand pro
              Vertrag; Zinskonten separat, Bankkonten der Art Tagesgeld nicht
              nochmals gezählt. Fehlende Bewertungen sind nicht berücksichtigt.
              Keine Live-Bewertung.
            </p>
          </section>
          <section className="panel">
            <h2>Zinsen und Einlagensicherung</h2>
            <p className="muted">
              Konstantes eingegebenes Guthaben, taggenau Actual/365, ohne
              Zinseszins. Bekannte Zinsänderungen werden berücksichtigt;
              Prognose endet bei Fälligkeit / Aktionsende. Steuerabzüge werden
              nur als tatsächlich erfasste Werte ausgewiesen.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Konto / Bank</th>
                    <th>Guthaben</th>
                    <th>Nächster Monat brutto</th>
                    <th>Nächste 12 Monate brutto</th>
                    <th>Freistellungsauftrag</th>
                    <th>Erfasste Nettozinsen im Zeitraum</th>
                  </tr>
                </thead>
                <tbody>
                  {privateData.interest_accounts.map((r) => {
                    const history = privateData.interest_rate_history.filter(
                      (h) => h.interest_account_id === r.id,
                    ) as any;
                    const month = forecastInterest(
                        r.balance,
                        Number(r.rate_annual || 0),
                        history,
                        now,
                        addMonths(now, 1),
                        r.maturity_on,
                      ),
                      year = forecastInterest(
                        r.balance,
                        Number(r.rate_annual || 0),
                        history,
                        now,
                        addMonths(now, 12),
                        r.maturity_on,
                      );
                    const actual = privateData.interest_entries
                      .filter(
                        (e) =>
                          e.interest_account_id === r.id &&
                          e.value_date >= from &&
                          e.value_date <= to,
                      )
                      .reduce(
                        (s, e) =>
                          s +
                          cents(e.gross_interest) -
                          cents(e.tax_withheld || 0) -
                          cents(e.solidarity_withheld || 0),
                        0,
                      );
                    return (
                      <tr key={r.id}>
                        <td>
                          {r.name}
                          <small>
                            {r.bank_name} ·{" "}
                            {r.maturity_on || "Keine Fälligkeit angegeben"}
                          </small>
                        </td>
                        <td>{money(r.balance)}</td>
                        <td>{moneyCents(month.grossCents)}</td>
                        <td>{moneyCents(year.grossCents)}</td>
                        <td>{money(r.allowance_allocated)}</td>
                        <td>{moneyCents(actual)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {Object.entries(
              Object.groupBy(privateData.interest_accounts, (r) => r.bank_name),
            ).map(([bank, rows]) => {
              const held = rows?.reduce((s, r) => s + cents(r.balance), 0) || 0;
              return (
                <p key={bank} className={held > 10000000 ? "warning" : "muted"}>
                  {bank}: erfasstes Guthaben {moneyCents(held)} · Vergleich mit
                  100.000 € gesetzlicher Standardsicherung je Person und
                  Institut. Bankmarken, weitere Konten und Sonderfälle selbst
                  prüfen.
                </p>
              );
            })}
            {privateData.tax_subjects.map((s) => {
              const allowance = privateData.interest_accounts
                .filter((r) => r.tax_subject_id === s.id)
                .reduce((v, r) => v + cents(r.allowance_allocated || 0), 0);
              return (
                <p
                  key={s.id}
                  className={
                    allowance > cents(s.saver_allowance || 1000)
                      ? "warning"
                      : "muted"
                  }
                >
                  {s.name}: Freistellungsaufträge {moneyCents(allowance)};
                  hinterlegter Sparer-Pauschbetrag{" "}
                  {money(s.saver_allowance ?? 1000)}. Andere Kapitalerträge und
                  gemeinsame Bankmarken sind zusätzlich zu prüfen.
                </p>
              );
            })}
          </section>
          <section className="panel">
            <h2>Immobilien · Anlage-V-Vorbereitung</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Objekt</th>
                    <th>Mieten</th>
                    <th>Werbungskosten</th>
                    <th>Darlehenszinsen</th>
                    <th>AfA-Modell pro Jahr</th>
                  </tr>
                </thead>
                <tbody>
                  {privateData.properties.map((p) => {
                    const entries = privateData.rental_entries.filter(
                      (r) =>
                        r.property_id === p.id &&
                        r.booked_on >= from &&
                        r.booked_on <= to,
                    );
                    const sum = (kind: string) =>
                      entries
                        .filter((r) => r.kind === kind)
                        .reduce((s, r) => s + cents(r.amount), 0);
                    const afa = Math.round(
                      (((cents(p.depreciable_basis || 0) *
                        Number(p.depreciation_rate || 0)) /
                        100) *
                        Number(p.ownership_percent)) /
                        100,
                    );
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{moneyCents(sum("rent"))}</td>
                        <td>{moneyCents(sum("expense"))}</td>
                        <td>{moneyCents(sum("interest"))}</td>
                        <td>{moneyCents(afa)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted">
              AfA-Modell = eingegebene Bemessungsgrundlage × angegebener
              Jahressatz × Eigentumsquote. Keine Prüfung von Gebäudeanteil,
              Erwerbsjahr, zeitanteiliger AfA oder Sonderregelungen.
              Mietbuchungen werden als eingegebener eigener Anteil behandelt.
            </p>
            <a href="/api/module-export/rental-entries">
              Objektbuchungen exportieren
            </a>
          </section>
          <section className="panel">
            <h2>Kredite · Tilgungsmodell</h2>
            {privateData.loans.map((l) => {
              const rows = forecastLoan(
                l.balance || 0,
                Number(l.interest_rate || 0),
                l.monthly_payment || 0,
              );
              return (
                <div key={l.id}>
                  <h3>
                    {l.lender} · Zinsbindung bis{" "}
                    {l.fixed_until || "nicht angegeben"}
                  </h3>
                  <p className="muted">
                    Konstanter nominaler Jahreszins / 12, konstante Rate,
                    monatliche Zinsrundung auf Cent. Nach Ende der Zinsbindung
                    ist der Zinssatz unbekannt; keine Prognose einer
                    Anschlussfinanzierung.
                  </p>
                  {rows.some((r) => r.principal < 0) && (
                    <p className="warning">
                      Die Rate deckt die angenommenen Zinsen nicht. Die
                      Restschuld steigt.
                    </p>
                  )}
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Monat</th>
                          <th>Rate</th>
                          <th>Zinsen</th>
                          <th>Tilgung</th>
                          <th>Restschuld</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.month}>
                            <td>{r.month}</td>
                            <td>{moneyCents(r.payment)}</td>
                            <td>{moneyCents(r.interest)}</td>
                            <td>{moneyCents(r.principal)}</td>
                            <td>{moneyCents(r.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {!privateData.loans.length && (
              <p className="muted">Noch keine Kredite erfasst.</p>
            )}
          </section>
          <section className="panel">
            <h2>Versicherungsfristen</h2>
            <ul className="task-list">
              {privateData.insurance_contracts.map((i) => (
                <li key={i.id}>
                  <span>
                    {i.name} · {i.provider}
                    <small>Jahresbeitrag {money(i.annual_premium || 0)}</small>
                  </span>
                  <span>
                    {i.renewal_on
                      ? "Kündigungsmodell: " +
                        subtractMonths(
                          i.renewal_on,
                          i.cancellation_notice_months,
                        )
                      : "Keine Verlängerung angegeben"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted">
              Kündigungsmodell = Verlängerungsdatum minus angegebene
              Monatsfrist, auf Monatsende begrenzt. Vertrag und Zugang der
              Kündigung selbst prüfen.
            </p>
          </section>
        </>
      )}
    </FinanceShell>
  );
}
