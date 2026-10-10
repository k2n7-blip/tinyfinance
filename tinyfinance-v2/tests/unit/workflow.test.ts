import test from "node:test";
import assert from "node:assert/strict";
import { documentSchema, postingSchema, modules } from "../../lib/modules";
import { permits } from "../../lib/permissions";
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000001",
];
const document = {
  vendor: "Supplier",
  invoice_number: "RE-1",
  invoice_date: "2026-10-01",
  service_date: "2026-10-01",
  net_amount: "100.00",
  vat_amount: "19.00",
  gross_amount: "119.00",
  currency: "EUR",
  direction: "expense",
  cost_center_id: ids[0],
  review_status: "reviewed",
  version: 1,
};
test("reviewed document requires complete and arithmetically valid invoice fields", () => {
  assert.equal(documentSchema.parse(document).gross_amount, "119.00");
  for (const patch of [
    { net_amount: null },
    { vendor: null },
    { gross_amount: "120.00" },
    { invoice_date: "2026-02-30" },
    { version: 0 },
    { organization_id: ids[0] },
  ])
    assert.throws(() => documentSchema.parse({ ...document, ...patch }));
});
test("zero VAT is preserved and pending invoices may have unknown amounts", () => {
  assert.equal(
    documentSchema.parse({ ...document, vat_amount: "0", net_amount: "119" })
      .vat_amount,
    "0",
  );
  assert.equal(
    documentSchema.parse({
      ...document,
      review_status: "pending",
      net_amount: null,
      vat_amount: null,
      gross_amount: null,
    }).gross_amount,
    null,
  );
});
const posting = {
  document_id: ids[0],
  posting_date: "2026-10-01",
  amount: "119.00",
  debit_account_id: ids[1],
  credit_account_id: ids[2],
  description: "Expense",
  vat_code: "",
  allocations: [
    { cost_center_id: ids[0], amount: "60.00" },
    { cost_center_id: ids[1], amount: "59.00" },
  ],
};
test("posting splits must sum exactly and reference distinct cost centers", () => {
  assert.equal(postingSchema.parse(posting).allocations.length, 2);
  assert.throws(() =>
    postingSchema.parse({
      ...posting,
      allocations: [{ cost_center_id: ids[0], amount: "118.99" }],
    }),
  );
  assert.throws(() =>
    postingSchema.parse({ ...posting, credit_account_id: ids[1] }),
  );
  assert.throws(() => postingSchema.parse({ ...posting, id: ids[2] }));
});
test("roles protect administration, private data, personnel and review actions", () => {
  assert.equal(permits("viewer", "write"), false);
  assert.equal(permits("advisor_review", "review"), true);
  assert.equal(permits("advisor_review", "private", true, true), false);
  assert.equal(permits("bookkeeper", "admin"), false);
  assert.equal(permits("bookkeeper", "private", true), true);
  assert.equal(permits("bookkeeper", "payroll", false, false), false);
});
test("platform gross minus fees and refunds must equal payout", () => {
  const row = {
    platform: "Holidu",
    reference: "H-1",
    booking_reference: null,
    cost_center_id: ids[0],
    period_start: "2026-10-01",
    period_end: "2026-10-10",
    gross_amount: "1000.00",
    commission: "100.00",
    refunds: "50.00",
    payout: "850.00",
    payout_reference: null,
    guest_nights: 4,
    occupancy_nights: 10,
    status: "draft",
  };
  assert.equal(modules.platforms.schema.parse(row).payout, "850.00");
  assert.throws(() =>
    modules.platforms.schema.parse({ ...row, payout: "900.00" }),
  );
  assert.throws(() =>
    modules.platforms.schema.parse({ ...row, guest_nights: 11 }),
  );
  assert.throws(() =>
    modules.platforms.schema.parse({ ...row, organization_id: ids[0] }),
  );
});
test("interest actual taxes cannot exceed the gross credit", () => {
  assert.throws(() =>
    modules["interest-entries"].schema.parse({
      interest_account_id: ids[0],
      value_date: "2026-10-01",
      gross_interest: "10.00",
      tax_withheld: "9.00",
      solidarity_withheld: "2.00",
      notes: null,
    }),
  );
});
