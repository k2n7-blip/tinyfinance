import test from "node:test";
import assert from "node:assert/strict";
import { cents, decimal, validDate, csvCell } from "../../lib/money";
test("money preserves exact cents, including zero and negatives", () => {
  for (const [input, expected] of [
    ["0", 0],
    ["0.10", 10],
    ["1.01", 101],
    ["-119.00", -11900],
    ["999999999.99", 99999999999],
  ] as const)
    assert.equal(cents(input), expected);
  for (const value of [0, 1, -1, 100, 11900, 99999999999])
    assert.equal(cents(decimal(value)), value);
});
test("invalid precision, NaN, scientific notation and locale ambiguity are rejected", () => {
  for (const v of ["NaN", "Infinity", "1e3", "1.001", "1,00", "", "abc"])
    assert.throws(() => cents(v));
});
test("calendar dates reject impossible days, including non-leap February", () => {
  assert.equal(validDate("2024-02-29"), true);
  for (const v of ["2026-02-29", "2026-04-31", "2026-13-01", "26-01-01"])
    assert.equal(validDate(v), false);
});
test("CSV formula injection is neutralized and quotes are doubled", () => {
  assert.equal(
    csvCell('=HYPERLINK("https://evil")'),
    '"\'=HYPERLINK(""https://evil"")"',
  );
  assert.equal(csvCell("  +cmd"), '"\'  +cmd"');
  assert.equal(csvCell("A;B"), '\"A;B\"');
});
