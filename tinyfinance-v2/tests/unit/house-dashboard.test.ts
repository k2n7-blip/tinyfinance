import test from "node:test";
import assert from "node:assert/strict";
import {
  houseDashboard,
  houseCostSchema,
  type HouseCost,
} from "../../lib/house-dashboard";
const id = "11111111-1111-4111-8111-111111111111";
const centers = [
  { id, name: "Tinyhaus 27c", code: "110", active: true },
  { id: "shared", name: "Gemeinschaft", code: "200", active: true },
];
const booking = {
  id: "b1",
  cost_center_id: id,
  platform: "Holidu",
  booking_reference: "book1",
  period_start: "2026-01-28",
  period_end: "2026-02-02",
  status: "open",
  gross_amount: "397.64",
  refunds: "0.00",
  commission: "89.77",
};
const cost: HouseCost = {
  cost_center_id: id,
  name: "Kreditrate",
  kind: "fixed",
  amount: 100,
  starts_month: "2026-01",
  ends_month: "2026-03",
  recurrence: "monthly",
  basis: "planned",
  active: true,
};
test("each stay belongs to checkout month exactly once and fees are deducted once", () => {
  const r = houseDashboard(centers, [booking], [cost], 2026);
  assert.equal(r.houses.length, 1);
  const [jan, feb, mar, apr] = r.houses[0].months;
  assert.equal(jan.gross, 0);
  assert.equal(feb.gross, 39764);
  assert.equal(feb.fees, 8977);
  assert.equal(feb.fixed, 10000);
  assert.equal(feb.net, 20787);
  assert.equal(feb.planned, 10000);
  assert.equal(mar.fixed, 10000);
  assert.equal(apr.fixed, 0);
  assert.equal(apr.fixedCount, 0);
});
test("single-month variable costs, refunds and known zero fixed costs remain distinct", () => {
  const r = houseDashboard(
    centers,
    [{ ...booking, refunds: "7.64" }],
    [
      { ...cost, amount: 0 },
      {
        ...cost,
        kind: "variable",
        amount: 60,
        basis: "recorded",
        starts_month: "2026-02",
        ends_month: null,
        recurrence: "once",
      },
    ],
    2026,
  );
  const feb = r.houses[0].months[1];
  assert.equal(feb.net, 24023);
  assert.equal(feb.fixedCount, 1);
  assert.equal(feb.variable, 6000);
  assert.equal(r.houses[0].months[2].variable, 0);
});
test("cancelled and ambiguous Holidu bookings are excluded; unassigned revenue is reported", () => {
  const r = houseDashboard(
    centers,
    [
      booking,
      { ...booking, id: "b2" },
      {
        ...booking,
        id: "b3",
        booking_reference: "other",
        cost_center_id: "shared",
      },
      {
        ...booking,
        id: "b4",
        booking_reference: "cancelled",
        status: "cancelled",
      },
    ],
    [],
    2026,
  );
  assert.equal(r.duplicates, 2);
  assert.equal(r.unassigned, 1);
  assert.equal(r.houses[0].months[1].gross, 0);
});
test("month and currency validation rejects missing classifications, invalid periods and stale update shape", () => {
  assert(houseCostSchema.safeParse(cost).success);
  assert(
    !houseCostSchema.safeParse({ ...cost, starts_month: "2026-13" }).success,
  );
  assert(
    !houseCostSchema.safeParse({ ...cost, ends_month: "2025-12" }).success,
  );
  assert(!houseCostSchema.safeParse({ ...cost, amount: 1.001 }).success);
  assert(!houseCostSchema.safeParse({ ...cost, id }).success);
});
