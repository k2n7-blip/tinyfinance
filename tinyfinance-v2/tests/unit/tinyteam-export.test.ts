import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
async function adapter() {
  const code = await readFile(
    new URL(
      "../../../integrations/tinyteam/tinyfinance-export.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  return import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
}
test("TinyTeam export keeps approved closed minutes, source IDs and Berlin calendar date", async () => {
  const { financeTimeCsv } = await adapter();
  const time = {
    id: 12,
    mitarbeiter_id: "person",
    haus_id: 3,
    startzeit: "2026-06-30T22:30:00Z",
    endzeit: "2026-06-30T23:30:00Z",
    pause_minuten: 10,
  };
  const result = financeTimeCsv(
    [
      time,
      { ...time, id: 13, endzeit: null },
      { ...time, id: 14, mitarbeiter_id: "unapproved" },
    ],
    [{ mitarbeiter_id: "person", monat: "2026-07-01", freigegeben: true }],
    [{ id: 3, name: "Haus" }],
    "2026-07",
    { "3": "100" },
  );
  assert.equal(result.count, 1);
  assert.equal(result.skipped, 2);
  assert.match(
    result.csv,
    /"person";"2026-07-01";"50";"100";"tinyteam:12";"approved"/,
  );
  assert.throws(
    () =>
      financeTimeCsv(
        [time],
        [{ mitarbeiter_id: "person", monat: "2026-07-01", freigegeben: true }],
        [{ id: 3 }],
        "2026-07",
        {},
      ),
    /Kostenstellennummer/,
  );
  assert.throws(
    () =>
      financeTimeCsv(
        [{ ...time, pause_minuten: 90 }],
        [{ mitarbeiter_id: "person", monat: "2026-07-01", freigegeben: true }],
        [{ id: 3 }],
        "2026-07",
        { "3": "100" },
      ),
    /Ungültige Zeit/,
  );
});
