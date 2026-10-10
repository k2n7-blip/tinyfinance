import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { AppError } from "./errors";
import { cents, decimal, validDate } from "./money";
export type BankRow = {
  booked_on: string;
  amount: string;
  currency: string;
  counterparty: string;
  purpose: string;
  source_reference: string;
};
function fail(message: string): never {
  throw new AppError(400, message);
}
export function csvRows(text: string): Record<string, string>[] {
  if (Buffer.byteLength(text) > 2_000_000) fail("CSV-Datei ist zu groß.");
  try {
    const rows = parse(text, {
      bom: true,
      delimiter: ";",
      columns: (headers: string[]) => {
        if (
          new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
        )
          fail("Doppelte Spaltennamen.");
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      cast: false,
    }) as Record<string, string>[];
    if (!rows.length || rows.length > 2000)
      fail("Erforderlich: 1 bis 2000 Datenzeilen.");
    const header = Object.keys(rows[0]);
    if (new Set(header.map((x) => x.toLowerCase())).size !== header.length)
      fail("Doppelte Spaltennamen.");
    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    fail(
      "Ungültige CSV: Semikolon als Trennzeichen verwenden; jede Zeile muss gleich viele Spalten haben.",
    );
  }
}
export function germanAmount(value: string): string {
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(value))
    fail("Ungültiger deutscher Betrag: " + value.slice(0, 30));
  return decimal(cents(value.replace(/\./g, "").replace(",", ".")));
}
export function parseBankCsv(text: string, currency: string): BankRow[] {
  return csvRows(text).map((row, index) => {
    const required = [
      "datum",
      "betrag",
      "verwendungszweck",
      "gegenpartei",
      "referenz",
    ];
    if (required.some((key) => !(key in row)))
      fail("CSV-Spalten: Datum;Betrag;Verwendungszweck;Gegenpartei;Referenz");
    if (!validDate(row.datum)) fail("Ungültiges Datum in Zeile " + (index + 2));
    if (!row.referenz || row.referenz.length > 200)
      fail("Jede Zeile benötigt eine eindeutige Referenz.");
    const amount = germanAmount(row.betrag);
    if (cents(amount) === 0) fail("Bankumsatz darf nicht null sein.");
    return {
      booked_on: row.datum,
      amount,
      currency,
      counterparty: row.gegenpartei,
      purpose: row.verwendungszweck,
      source_reference: row.referenz,
    };
  });
}
const list = (v: any): any[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const str = (v: any): string =>
  typeof v === "object" ? String(v?.["#text"] ?? "") : String(v ?? "");
export function parseCamt(
  text: string,
  expectedCurrency: string,
  last4?: string | null,
): BankRow[] {
  if (Buffer.byteLength(text) > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(text))
    fail("Nicht unterstütztes oder zu großes XML.");
  if (XMLValidator.validate(text) !== true) fail("Ungültiges CAMT-XML.");
  const xml = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
  }).parse(text);
  const statements = list(xml.Document?.BkToCstmrStmt?.Stmt);
  if (!statements.length) fail("Nur CAMT.053-Kontoauszüge werden unterstützt.");
  const output: BankRow[] = [];
  for (const statement of statements) {
    const iban = str(statement.Acct?.Id?.IBAN);
    if (
      last4 &&
      (!iban || iban.slice(-4).toUpperCase() !== last4.toUpperCase())
    )
      fail("CAMT gehört nicht zum ausgewählten Konto.");
    const statementId = str(statement.Id);
    if (!statementId) fail("CAMT-Auszug benötigt eine ID.");
    for (const [index, entry] of list(statement.Ntry).entries()) {
      const status = str(entry.Sts?.Cd || entry.Sts);
      if (status !== "BOOK")
        fail("CAMT enthält nicht gebuchte oder unbekannte Einträge.");
      const booked = str(entry.BookgDt?.Dt || entry.BookgDt?.DtTm).slice(0, 10);
      if (!validDate(booked)) fail("Ungültiges CAMT-Buchungsdatum.");
      const currency = entry.Amt?.["@_Ccy"];
      if (currency !== expectedCurrency)
        fail("CAMT-Währung passt nicht zum Konto.");
      const direction = str(entry.CdtDbtInd);
      if (!["CRDT", "DBIT"].includes(direction))
        fail("Unbekannte CAMT-Buchungsrichtung.");
      const amount = decimal(
        cents(str(entry.Amt)) * (direction === "DBIT" ? -1 : 1),
      );
      if (cents(amount) === 0) fail("Nullbetrag in CAMT.");
      const details = list(entry.NtryDtls?.TxDtls);
      // Preserve the bank's booked aggregate; never manufacture a split without amounts.
      const refs = details
        .map((d) => str(d.Refs?.EndToEndId))
        .filter((r) => r && r !== "NOTPROVIDED");
      const party = details
        .map((d) => str(d.RltdPties?.Cdtr?.Nm || d.RltdPties?.Dbtr?.Nm))
        .filter(Boolean)
        .join(" / ");
      const purpose = details
        .flatMap((d) => list(d.RmtInf?.Ustrd).map(str))
        .join(" / ");
      const bankRef = str(
        entry.AcctSvcrRef ||
          entry.NtryRef ||
          (details.length === 1 ? details[0].Refs?.AcctSvcrRef : ""),
      );
      if (!bankRef)
        fail(
          "CAMT-Eintrag besitzt keine stabile Bankreferenz. Bitte normalisierte CSV verwenden.",
        );
      const reference =
        bankRef ||
        createHash("sha256")
          .update(
            statementId +
              "|" +
              iban +
              "|" +
              index +
              "|" +
              str(entry.Amt) +
              "|" +
              direction,
          )
          .digest("hex");
      output.push({
        booked_on: booked,
        amount,
        currency,
        counterparty: party,
        purpose: [purpose, ...refs].filter(Boolean).join(" · "),
        source_reference: reference,
      });
    }
  }
  if (!output.length || output.length > 2000)
    fail("CAMT benötigt 1 bis 2000 gebuchte Einträge.");
  return output;
}
export function parseMt940(
  text: string,
  expectedCurrency: string,
  last4?: string | null,
): BankRow[] {
  if (Buffer.byteLength(text) > 2_000_000) fail("MT940-Datei ist zu groß.");
  const statements = text
    .replace(/\r/g, "")
    .split(/(?=^:20:)/m)
    .filter((s) => s.trim());
  const rows: BankRow[] = [];
  for (const statement of statements) {
    const statementId = statement.match(/^:20:(.+)$/m)?.[1]?.trim();
    const account = statement.match(/^:25:(.+)$/m)?.[1]?.trim();
    if (!statementId || !account)
      fail("MT940-Auszug benötigt Referenz und Kontonummer.");
    if (last4 && account.slice(-4).toUpperCase() !== last4.toUpperCase())
      fail("MT940 gehört nicht zum ausgewählten Konto.");
    const currency = statement.match(/^:60[FM]:[CD]\d{6}([A-Z]{3})/m)?.[1];
    if (currency !== expectedCurrency)
      fail("MT940-Währung passt nicht zum Konto.");
    const entries = [
      ...statement.matchAll(
        /^:61:([^\n]+)([\s\S]*?)(?=^:61:|^:62[FM]:|(?![\s\S]))/gm,
      ),
    ];
    for (const [index, entry] of entries.entries()) {
      const match = entry[1].match(
        /^(\d{6})(\d{4})?(R?[CD])([A-Z])?(\d+,\d{1,2})N[A-Z0-9]{3}([^/]*)(?:\/\/(.+))?$/,
      );
      if (!match)
        fail(
          "Nicht unterstützter MT940-Umsatz. Bitte CAMT oder normalisierte CSV verwenden.",
        );
      const yy = Number(match[1].slice(0, 2));
      let year = yy >= 70 ? 1900 + yy : 2000 + yy;
      let monthDay = match[1].slice(2);
      if (match[2]) {
        monthDay = match[2];
        const delta =
          Number(monthDay.slice(0, 2)) - Number(match[1].slice(2, 4));
        if (delta > 6) year--;
        if (delta < -6) year++;
      }
      const booked =
        year + "-" + monthDay.slice(0, 2) + "-" + monthDay.slice(2);
      if (!validDate(booked)) fail("Ungültiges MT940-Buchungsdatum.");
      const sign = ["D", "RC"].includes(match[3]) ? -1 : 1;
      const amount = decimal(cents(germanAmount(match[5])) * sign);
      const purpose = entry[2].replace(/^:86:/m, "").trim();
      const ref =
        match[7]?.trim() ||
        createHash("sha256")
          .update(statementId + "|" + account + "|" + index + "|" + entry[1])
          .digest("hex");
      rows.push({
        booked_on: booked,
        amount,
        currency,
        counterparty: "",
        purpose,
        source_reference: ref,
      });
    }
  }
  if (!rows.length || rows.length > 2000)
    fail("MT940 benötigt 1 bis 2000 unterstützte Umsätze.");
  return rows;
}
export function parseBank(
  text: string,
  filename: string,
  currency: string,
  last4?: string | null,
) {
  if (/\.xml$/i.test(filename) || text.trim().startsWith("<"))
    return parseCamt(text, currency, last4);
  if (/\.(sta|mt940|940)$/i.test(filename) || /^:20:/m.test(text))
    return parseMt940(text, currency, last4);
  return parseBankCsv(text, currency);
}
