import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPlatformRows,
  platformReport,
} from "../../lib/platform-reporting";
const row = {
  platform: "Holidu",
  booking_reference: "123",
  reference: "PDF-1",
  cost_center_id: "house1",
  period_start: "2026-01-01",
  period_end: "2026-01-04",
  gross_amount: "397.64",
  commission: "89.77",
  refunds: "0.00",
  payout: "307.87",
  status: "draft",
};
test("Platform totals reconcile by center, exclude cancelled entries and obey report period", () => {
  const result = platformReport(
    [
      row,
      {
        ...row,
        reference: "2",
        booking_reference: "124",
        cost_center_id: "house2",
      },
      { ...row, status: "cancelled" },
      { ...row, period_start: "2023-01-01", period_end: "2023-01-04" },
    ],
    "2026-01-01",
    "2026-12-31",
  );
  assert.deepEqual(result.total, {
    count: 2,
    gross: 79528,
    fees: 17954,
    refunds: 0,
    payout: 61574,
  });
  assert.equal(result.byCenter.get("house1")?.gross, 39764);
  assert.equal(result.byCenter.get("house2")?.payout, 30787);
});
test("Holidu CSV and PDF reuse booking reference identity without modifying originals or financial values", () => {
  const input = { ...row, reference: "HOLIDU-BOOKING-123" };
  const resolved = canonicalPlatformRows([input], [row]);
  assert.equal(resolved[0].reference, "PDF-1");
  assert.equal(input.reference, "HOLIDU-BOOKING-123");
  assert.equal(resolved[0].commission, "89.77");
  const batch = canonicalPlatformRows([row, input], []);
  assert.equal(batch[0].reference, batch[1].reference);
  assert.throws(() =>
    canonicalPlatformRows([input], [row, { ...row, reference: "second" }]),
  );
});
test("Reports expose multiple active Holidu booking references for review", () => {
  assert.equal(
    platformReport([row, { ...row, reference: "another" }]).duplicates.length,
    1,
  );
  assert.equal(
    platformReport([row, { ...row, status: "cancelled" }]).duplicates.length,
    0,
  );
});
