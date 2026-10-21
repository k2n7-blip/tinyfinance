import test from "node:test";
import assert from "node:assert/strict";
import {
  forecastInterest,
  forecastLoan,
  subtractMonths,
  addMonths,
} from "../../lib/forecasts";
import {
  ledgerReport,
  openDocuments,
  paidPreparation,
} from "../../lib/reporting";
test("Actual/365 interest honors leap days and rounds at end of period", () => {
  assert.equal(
    forecastInterest("10000", 3.65, [], "2026-01-01", "2027-01-01").grossCents,
    36500,
  );
  assert.equal(
    forecastInterest("10000", 3.65, [], "2024-02-28", "2024-03-01").grossCents,
    200,
  );
});
test("known rate changes and maturity split the forecast", () => {
  assert.equal(
    forecastInterest(
      "10000",
      3.65,
      [{ effective_on: "2026-01-02", rate_annual: 7.3 }],
      "2026-01-01",
      "2026-01-03",
    ).grossCents,
    300,
  );
  assert.equal(
    forecastInterest(
      "10000",
      3.65,
      [],
      "2026-01-01",
      "2026-01-04",
      "2026-01-02",
    ).grossCents,
    100,
  );
});
test("loan payment reduces principal after monthly interest and caps final payment", () => {
  const rows = forecastLoan("1000", 12, "600", 2);
  assert.deepEqual(rows[0], {
    month: 1,
    interest: 1000,
    payment: 60000,
    principal: 59000,
    balance: 41000,
  });
  assert.deepEqual(rows[1], {
    month: 2,
    interest: 410,
    payment: 41410,
    principal: 41000,
    balance: 0,
  });
});
test("negative amortization is visible instead of being silently clamped", () => {
  const [row] = forecastLoan("1000", 12, "5", 1);
  assert.equal(row.principal, -500);
  assert.equal(row.balance, 100500);
});
test("month arithmetic clamps at actual calendar month ends", () => {
  assert.equal(subtractMonths("2026-03-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(subtractMonths("2026-01-31", 3), "2025-10-31");
});
test("journal reports include immutable reversal as counter-entry and exclude drafts", () => {
  const accounts = [
      { id: "expense", kind: "expense" },
      { id: "bank", kind: "bank" },
    ],
    docs = [{ id: "doc", vat_amount: "19", direction: "expense" }];
  const original = {
    id: "p",
    status: "approved",
    posting_date: "2026-10-01",
    document_id: "doc",
    amount: "119",
    debit_account_id: "expense",
    credit_account_id: "bank",
  };
  const reverse = {
    ...original,
    id: "r",
    posting_date: "2026-10-02",
    debit_account_id: "bank",
    credit_account_id: "expense",
    reversal_of: "p",
  };
  const result = ledgerReport(
    [original, reverse, { ...original, id: "draft", status: "draft" }],
    [
      { posting_id: "p", cost_center_id: "c", amount: "119" },
      { posting_id: "r", cost_center_id: "c", amount: "119" },
    ],
    accounts,
    docs,
    "2026-01-01",
    "2026-12-31",
  );
  assert.equal(result.expense, 0);
  assert.equal(result.inputVat, 0);
  assert.equal(result.byCenter.get("c")?.expense, 0);
  assert.deepEqual(result.byAccount.get("bank"), {
    debit: 11900,
    credit: 11900,
  });
});
test("open items respect partial and rejected matches; paid report uses bank dates", () => {
  const docs = [
      {
        id: "doc",
        gross_amount: "119",
        review_status: "reviewed",
        direction: "expense",
      },
    ],
    matches = [
      {
        document_id: "doc",
        bank_transaction_id: "t",
        amount: "50",
        status: "confirmed",
      },
      { document_id: "doc", amount: "69", status: "rejected" },
    ];
  assert.equal(openDocuments(docs, matches)[0].remaining, 6900);
  assert.equal(
    paidPreparation(
      docs,
      matches,
      [{ id: "t", booked_on: "2026-10-02" }],
      "2026-10-01",
      "2026-10-31",
    ).expense,
    5000,
  );
  assert.equal(
    paidPreparation(
      docs,
      matches,
      [{ id: "t", booked_on: "2026-11-01" }],
      "2026-10-01",
      "2026-10-31",
    ).expense,
    0,
  );
});
