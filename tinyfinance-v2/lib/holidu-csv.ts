import { parse } from "csv-parse/sync";
import { AppError } from "./errors";
import { modules } from "./modules";
import { cents, decimal } from "./money";
import type { holiduSettlement } from "./platform-pdf";
type Entry = {
  filename: string;
  accommodation: { id: string; name: string };
  suggestion?: ReturnType<typeof holiduSettlement>;
  error?: string;
};
export function holiduBookingsCsv(text: string): Entry[] {
  if (Buffer.byteLength(text) > 2_000_000)
    throw new AppError(413, "CSV bis 2 MB erforderlich.");
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      bom: true,
      delimiter: ",",
      columns: (headers: string[]) => {
        if (new Set(headers).size !== headers.length) throw Error("headers");
        return headers;
      },
      trim: true,
      skip_empty_lines: true,
      relax_column_count: false,
    });
  } catch {
    throw new AppError(
      400,
      "Ungültiger Holidu-CSV-Export. Kommagetrennte Originaldatei verwenden.",
    );
  }
  if (!records.length || records.length > 2000)
    throw new AppError(400, "1 bis 2000 Buchungen erforderlich.");
  const required = [
    "Booking ID",
    "Payout Type",
    "Property Name",
    "Property ID",
    "Paid by Guest",
    "Check In",
    "Check Out",
    "Booking Status",
    "Invoice Amount",
    "Payout",
    "Withheld amounts due to Cedolare Secca",
  ];
  if (required.some((key) => !(key in records[0])))
    throw new AppError(
      400,
      "Spalten entsprechen nicht dem Holidu-Buchungsexport.",
    );
  return records.map((r, i) => {
    const accommodation = { id: r["Property ID"], name: r["Property Name"] };
    const base = {
      filename: `Zeile ${i + 2} · Buchung ${r["Booking ID"]}`,
      accommodation,
    };
    try {
      if (
        r["Payout Type"] !== "BOOKING_PAYOUT" ||
        r["Booking Status"] !== "CONFIRMED"
      )
        throw Error(
          "Stornierte Buchung oder anderer Auszahlungstyp: gesondert prüfen.",
        );
      if (!/^\d+$/.test(r["Booking ID"]) || !/^\d+$/.test(accommodation.id))
        throw Error("Ungültige Buchungs- oder Unterkunfts-ID.");
      const money = (key: string) => {
        if (!/^\d+(?:\.\d{1,2})?$/.test(r[key]))
          throw Error("Ungültiger Betrag: " + key);
        return decimal(cents(r[key]));
      };
      if (cents(r["Withheld amounts due to Cedolare Secca"] || "0") !== 0)
        throw Error("Einbehaltene Steuern bitte gesondert erfassen.");
      const row = modules.platforms.schema.parse({
        platform: "Holidu",
        reference: "HOLIDU-BOOKING-" + r["Booking ID"],
        booking_reference: r["Booking ID"],
        cost_center_id: "11111111-1111-4111-8111-111111111111",
        period_start: r["Check In"],
        period_end: r["Check Out"],
        gross_amount: money("Paid by Guest"),
        commission: money("Invoice Amount"),
        refunds: "0.00",
        payout: money("Payout"),
        payout_reference: null,
        guest_nights: Math.round(
          (Date.parse(r["Check Out"]) - Date.parse(r["Check In"])) / 86400000,
        ),
        occupancy_nights: null,
        status: "draft",
      });
      const { cost_center_id: _center, ...suggestion } = row;
      return { ...base, suggestion };
    } catch (error) {
      return {
        ...base,
        error:
          error instanceof Error
            ? "issues" in error
              ? "Datum oder Summen ungültig; Buchung gesondert prüfen."
              : error.message
            : "Buchung nicht lesbar.",
      };
    }
  });
}
