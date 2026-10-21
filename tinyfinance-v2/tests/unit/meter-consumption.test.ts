import test from "node:test";
import assert from "node:assert/strict";
import { meterConsumption } from "../../lib/meter-consumption";
test("meter consumption keeps meters separate, sorts dates and handles three decimals", () => {
  const rows = meterConsumption([
    { id: "2", meter_id: "a", read_on: "2026-02-01", reading: "113.456" },
    { id: "1", meter_id: "a", read_on: "2026-01-01", reading: "100.123" },
    { id: "3", meter_id: "b", read_on: "2026-02-01", reading: 5 },
  ]);
  assert.deepEqual(
    rows.map((r) => r.consumption),
    [null, 13.333, null],
  );
  assert.equal(rows[1].previous_date, "2026-01-01");
});
test("falling readings are not reported as negative consumption", () => {
  const rows = meterConsumption([
    { id: "1", meter_id: "a", read_on: "2026-01-01", reading: 100 },
    { id: "2", meter_id: "a", read_on: "2026-02-01", reading: 5 },
  ]);
  assert.equal(rows[1].consumption, null);
  assert.equal(rows[1].invalid, true);
});
