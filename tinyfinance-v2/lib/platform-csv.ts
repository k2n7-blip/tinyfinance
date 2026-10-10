import { csvCell } from "./money";
export const platformCsvHeaders = [
  "Plattform",
  "Abrechnungsreferenz",
  "Buchungsreferenz",
  "Kostenstellennummer",
  "Von",
  "Bis",
  "Bruttoumsatz",
  "Provision",
  "Erstattungen",
  "Auszahlung",
  "Bankreferenz",
  "Übernachtungen",
  "Verfügbare Nächte",
];
export function platformSettlementCsv(rows: Record<string, unknown>[]) {
  const money = (value: unknown) => String(value).replace(".", ",");
  return (
    "\uFEFF" +
    platformCsvHeaders.map(csvCell).join(";") +
    "\r\n" +
    rows
      .map((s) =>
        [
          s.platform,
          s.reference,
          s.booking_reference,
          s.cost_center_code,
          s.period_start,
          s.period_end,
          money(s.gross_amount),
          money(s.commission),
          money(s.refunds),
          money(s.payout),
          s.payout_reference || "",
          s.guest_nights ?? "",
          s.occupancy_nights ?? "",
        ]
          .map(csvCell)
          .join(";"),
      )
      .join("\r\n") +
    "\r\n"
  );
}
