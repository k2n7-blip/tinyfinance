import { z } from "zod";
import { cents } from "./money";
import type { Row } from "./data";
const month = z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/);
export const houseCostSchema = z
  .object({
    id: z.string().uuid().optional(),
    record_version: z.number().int().positive().optional(),
    cost_center_id: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    kind: z.enum(["fixed", "variable"]),
    amount: z
      .number()
      .finite()
      .min(0)
      .max(99999999.99)
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
        "Maximal zwei Nachkommastellen",
      ),
    starts_month: month,
    ends_month: month.nullable(),
    recurrence: z.enum(["monthly", "once"]),
    basis: z.enum(["recorded", "planned"]),
    active: z.boolean().default(true),
  })
  .strict()
  .refine(
    (r) => !r.ends_month || r.ends_month >= r.starts_month,
    "Ende liegt vor Beginn",
  )
  .refine((r) => !r.id || !!r.record_version, "Versionsnummer fehlt");
export type HouseCost = z.infer<typeof houseCostSchema>;
export type HouseMonth = {
  month: string;
  gross: number;
  refunds: number;
  fees: number;
  fixed: number;
  variable: number;
  planned: number;
  count: number;
  fixedCount: number;
  additionalCount: number;
  net: number;
};
export function houseDashboard(
  centers: Row[],
  platforms: Row[],
  costs: HouseCost[],
  year: number,
) {
  const active = platforms.filter((r) => r.status !== "cancelled");
  const groups = new Map<string, Row[]>();
  for (const row of active) {
    if (row.platform !== "Holidu" || !row.booking_reference) continue;
    const key = String(row.booking_reference);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const ambiguous = new Set(
    [...groups.values()]
      .filter((g) => g.length > 1)
      .flatMap((g) => g.map((r) => r.id)),
  );
  const included = active.filter((r) => !ambiguous.has(r.id));
  const houses = centers
    .filter(
      (c) =>
        !/(gemeinschaft|allgemein|neubau|privat)/i.test(c.name) &&
        (c.active ||
          active.some(
            (p) =>
              p.cost_center_id === c.id &&
              String(p.period_end).startsWith(String(year)),
          )),
    )
    .map((center) => {
      const months: HouseMonth[] = Array.from({ length: 12 }, (_, m) => ({
        month: `${year}-${String(m + 1).padStart(2, "0")}`,
        gross: 0,
        refunds: 0,
        fees: 0,
        fixed: 0,
        variable: 0,
        planned: 0,
        count: 0,
        fixedCount: 0,
        additionalCount: 0,
        net: 0,
      }));
      for (const p of included.filter((p) => p.cost_center_id === center.id)) {
        const row = months.find(
          (m) => m.month === String(p.period_end).slice(0, 7),
        );
        if (!row) continue;
        row.gross += cents(p.gross_amount);
        row.refunds += cents(p.refunds ?? 0);
        row.fees += cents(p.commission);
        row.count++;
      }
      for (const cost of costs.filter(
        (c) => c.active && c.cost_center_id === center.id,
      ))
        for (const row of months) {
          if (
            row.month < cost.starts_month ||
            (cost.ends_month && row.month > cost.ends_month) ||
            (cost.recurrence === "once" && row.month !== cost.starts_month)
          )
            continue;
          const amount = cents(cost.amount);
          row[cost.kind === "fixed" ? "fixed" : "variable"] += amount;
          if (cost.basis === "planned") row.planned += amount;
          if (cost.kind === "fixed") row.fixedCount++;
          row.additionalCount++;
        }
      for (const row of months)
        row.net = row.gross - row.refunds - row.fees - row.fixed - row.variable;
      return {
        id: String(center.id),
        name: String(center.name),
        code: String(center.code),
        months,
      };
    });
  const ids = new Set(houses.map((h) => h.id));
  return {
    houses,
    duplicates: active.filter(
      (p) =>
        ambiguous.has(p.id) && String(p.period_end).startsWith(String(year)),
    ).length,
    unassigned: included.filter(
      (p) =>
        !ids.has(p.cost_center_id) &&
        String(p.period_end).startsWith(String(year)),
    ).length,
  };
}
