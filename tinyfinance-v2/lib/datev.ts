import {
  BUCHUNGSSTAPEL_COLUMNS,
  writeBuchungsstapel,
  parseCsv,
  quote,
  validateExtf,
  encodeCp1252,
  decodeBytes,
  fitsCp1252,
  cleanBeleg1,
  formatFinding,
} from "@seamless-engineering/datev-extf";
import { AppError } from "./errors";
import { cents } from "./money";
import type { Row } from "./data";
export function datevFile(
  settings: Row,
  postings: Row[],
  allocations: Row[],
  accounts: Row[],
  documents: Row[],
  centers: Row[],
  from: string,
  to: string,
  created = new Date(),
) {
  if (!postings.length)
    throw new AppError(
      400,
      "Keine freigegebenen Buchungen im gewählten Zeitraum.",
    );
  if (!settings.advisor_number || !settings.client_number)
    throw new AppError(
      400,
      "Berater- und Mandantennummer fehlen in den Einstellungen.",
    );
  const rows = postings.flatMap((p) => {
    const doc = documents.find((d) => d.id === p.document_id);
    const debit = accounts.find((a) => a.id === p.debit_account_id),
      credit = accounts.find((a) => a.id === p.credit_account_id);
    if (!doc || !debit?.approved_by_advisor || !credit?.approved_by_advisor)
      throw new AppError(400, "Beleg oder bestätigte Konten fehlen.");
    if (doc.currency !== "EUR" || p.currency !== "EUR")
      throw new AppError(400, "DATEV-Export unterstützt aktuell nur EUR.");
    if (
      debit.framework !== settings.framework ||
      credit.framework !== settings.framework
    )
      throw new AppError(400, "Kontenrahmen stimmt nicht überein.");
    if (
      debit.account_number.length !== settings.account_length ||
      credit.account_number.length !== settings.account_length
    )
      throw new AppError(400, "Kontenlänge stimmt nicht überein.");
    if (
      !doc.invoice_number ||
      cleanBeleg1(doc.invoice_number) !== doc.invoice_number
    )
      throw new AppError(
        400,
        "Rechnungsnummer ist für DATEV-Belegfeld 1 nicht zulässig: " +
          doc.invoice_number,
      );
    const parts = allocations.filter((a) => a.posting_id === p.id);
    if (
      !parts.length ||
      parts.reduce((s, a) => s + cents(a.amount), 0) !== cents(p.amount)
    )
      throw new AppError(400, "Kostenstellenaufteilung ist unvollständig.");
    return parts.map((part) => {
      const center = centers.find((c) => c.id === part.cost_center_id);
      if (!center) throw new AppError(400, "Kostenstelle fehlt.");
      const date = p.posting_date;
      return {
        amount: cents(part.amount),
        side: "S" as const,
        account: p.reversal_of ? credit.account_number : debit.account_number,
        contra: p.reversal_of ? debit.account_number : credit.account_number,
        key: p.vat_code,
        day: Number(date.slice(8)),
        month: Number(date.slice(5, 7)),
        beleg1: doc.invoice_number,
        text: p.description || "",
        center: center.code,
        doc,
        p,
      };
    });
  });
  const base = writeBuchungsstapel(
    {
      berater: settings.advisor_number,
      mandant: settings.client_number,
      wjStart: settings.fiscal_year_start.replaceAll("-", ""),
      skl: settings.account_length,
      from: from.replaceAll("-", ""),
      to: to.replaceAll("-", ""),
      label: "TinyFinance",
      skr: settings.framework === "SKR04" ? "04" : "03",
      created,
    },
    rows,
  );
  const parsed = parseCsv(base, ";").rows;
  const output = parsed
    .slice(0, 2)
    .map((r) =>
      r.cells.map((c) => (c.quoted ? quote(c.value) : c.value)).join(";"),
    );
  const column = (name: string) =>
    (BUCHUNGSSTAPEL_COLUMNS as readonly string[]).indexOf(name);
  parsed.slice(2).forEach((row, index) => {
    const fields = row.cells.map((c) => (c.quoted ? quote(c.value) : c.value));
    const data = rows[index];
    fields[column("KOST1 - Kostenstelle")] = quote(data.center);
    fields[column("Generalumkehr (GU)")] = data.p.reversal_of ? "1" : "0";
    const fullDate = (v: string) => v.slice(8) + v.slice(5, 7) + v.slice(0, 4);
    fields[column("Leistungsdatum")] = data.doc.service_date
      ? fullDate(data.doc.service_date)
      : "";
    fields[column("Datum Zuord. Steuerperiode")] = data.doc.service_date
      ? fullDate(data.p.posting_date)
      : "";
    // Original assignment is in the manifest; no public, unauthenticated document URLs.
    output.push(fields.join(";"));
  });
  const text = output.join("\r\n") + "\r\n";
  if (!fitsCp1252(text))
    throw new AppError(
      400,
      "DATEV unterstützt die verwendeten Sonderzeichen nicht (Windows-1252). Bitte Buchungstext prüfen.",
    );
  const bytes = encodeCp1252(text);
  const report = validateExtf(decodeBytes(bytes));
  const errors = report.findings.filter((f) => f.severity === "error");
  if (errors.length)
    throw new AppError(
      400,
      errors.map((f) => formatFinding(f, "de")).join(" "),
    );
  if (report.findings.length)
    throw new AppError(
      400,
      "DATEV-Plausibilitätsprüfung: " +
        report.findings.map((f) => formatFinding(f, "de")).join(" "),
    );
  return { bytes, text, rows: rows.length };
}
