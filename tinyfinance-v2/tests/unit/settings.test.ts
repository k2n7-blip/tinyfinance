import test from "node:test";
import assert from "node:assert/strict";
import { settingsPatchSchema } from "../../lib/settings";

test("AI opt-in and opt-out save without DATEV numbers and only patch consent", () => {
  for (const enabled of [true, false]) {
    assert.deepEqual(
      settingsPatchSchema.parse({ ai_enabled: enabled, record_version: 1 }),
      {
        ai_enabled: enabled,
        record_version: 1,
      },
    );
  }
});

test("AI settings reject unversioned changes and additional DATEV fields", () => {
  assert.equal(
    settingsPatchSchema.safeParse({ ai_enabled: true }).success,
    false,
  );
  assert.equal(
    settingsPatchSchema.safeParse({ ai_enabled: true, record_version: 0 })
      .success,
    false,
  );
  assert.equal(
    settingsPatchSchema.safeParse({
      ai_enabled: true,
      record_version: 1,
      advisor_number: "",
    }).success,
    false,
  );
});

test("DATEV settings still require valid numbers and retain old-client compatibility", () => {
  const payload = {
    framework: "SKR03",
    advisor_number: "1001",
    client_number: "1",
    fiscal_year_start: "2026-01-01",
    account_length: 4,
    datev_test_import_confirmed: false,
    record_version: 1,
  };
  assert.deepEqual(settingsPatchSchema.parse(payload), payload);
  assert.equal(
    settingsPatchSchema.safeParse({ ...payload, advisor_number: "" }).success,
    false,
  );
  assert.equal(
    settingsPatchSchema.safeParse({ ...payload, client_number: "0" }).success,
    false,
  );
  assert.equal(
    settingsPatchSchema.parse({ ...payload, ai_enabled: true }).ai_enabled,
    true,
  );
});
