import type { Row } from "./data";
import { cents } from "./money";
import { AppError } from "./errors";
export function canonicalPlatformRows(rows: Row[], existing: Row[]) {
  const references = new Map<string, string>();
  return rows.map((input) => {
    const row = { ...input };
    if (row.platform !== "Holidu" || !row.booking_reference) return row;
    const allMatches = existing.filter(
      (r) =>
        r.platform === "Holidu" &&
        r.booking_reference === row.booking_reference,
    );
    const activeMatches = allMatches.filter((r) => r.status !== "cancelled");
    const matches = activeMatches.length ? activeMatches : allMatches;
    if (matches.length > 1)
      throw new AppError(
        409,
        "Mehrere vorhandene Holidu-Abrechnungen für Buchung " +
          row.booking_reference +
          ": zuerst Dubletten prüfen.",
      );
    row.reference =
      matches.length === 1
        ? String(matches[0].reference)
        : references.get(row.booking_reference) || row.reference;
    references.set(row.booking_reference, row.reference);
    return row;
  });
}
export function platformReport(
  rows: Row[],
  from = "0000-01-01",
  to = "9999-12-31",
) {
  const selected = rows.filter(
    (r) =>
      r.status !== "cancelled" && r.period_start <= to && r.period_end >= from,
  );
  const sums = () => ({ count: 0, gross: 0, fees: 0, refunds: 0, payout: 0 });
  const total = sums();
  const byCenter = new Map<string, ReturnType<typeof sums>>();
  for (const row of selected) {
    const center = byCenter.get(row.cost_center_id) || sums();
    for (const target of [total, center]) {
      target.count++;
      target.gross += cents(row.gross_amount);
      target.fees += cents(row.commission);
      target.refunds += cents(row.refunds);
      target.payout += cents(row.payout);
    }
    byCenter.set(row.cost_center_id, center);
  }
  const bookings = new Map<string, Row[]>();
  for (const row of rows.filter(
    (r) =>
      r.platform === "Holidu" &&
      r.booking_reference &&
      r.status !== "cancelled",
  )) {
    const group = bookings.get(row.booking_reference) || [];
    group.push(row);
    bookings.set(row.booking_reference, group);
  }
  const duplicates = [...bookings.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([booking, group]) => ({
      booking,
      references: group.map((r) => String(r.reference)),
    }));
  return { selected, total, byCenter, duplicates };
}
