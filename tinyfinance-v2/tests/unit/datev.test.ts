import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeBytes,
  validateExtf,
  parseCsv,
  BUCHUNGSSTAPEL_COLUMNS,
} from "@seamless-engineering/datev-extf";
import { datevFile } from "../../lib/datev";
const settings = {
  advisor_number: "12345",
  client_number: "1",
  fiscal_year_start: "2026-01-01",
  account_length: 4,
  framework: "SKR03",
};
const postings = [
  {
    id: "p",
    document_id: "d",
    posting_date: "2026-10-01",
    amount: "119.00",
    debit_account_id: "a",
    credit_account_id: "b",
    vat_code: "",
    description: "Prüfung; Büro",
    currency: "EUR",
  },
];
const allocations = [
  { posting_id: "p", cost_center_id: "c", amount: "60" },
  { posting_id: "p", cost_center_id: "c2", amount: "59" },
];
const accounts = [
  {
    id: "a",
    account_number: "4900",
    framework: "SKR03",
    approved_by_advisor: true,
  },
  {
    id: "b",
    account_number: "1200",
    framework: "SKR03",
    approved_by_advisor: true,
  },
];
const docs = [
    {
      id: "d",
      invoice_number: "RE-2026-1",
      currency: "EUR",
      service_date: "2026-10-01",
    },
  ],
  centers = [
    { id: "c", code: "100" },
    { id: "c2", code: "110" },
  ];
test("DATEV format validates, encodes umlauts and preserves cent-accurate split rows", () => {
  const result = datevFile(
    settings,
    postings,
    allocations,
    accounts,
    docs,
    centers,
    "2026-10-01",
    "2026-10-31",
    new Date("2026-10-10T12:00:00Z"),
  );
  const decoded = decodeBytes(result.bytes);
  assert.equal(validateExtf(decoded).findings.length, 0);
  const rows = parseCsv(decoded.text, ";").rows;
  assert.equal(rows.length, 4);
  assert.equal(rows[2].cells[0].value, "60,00");
  assert.equal(rows[3].cells[0].value, "59,00");
  assert.equal(rows[2].cells[36].value, "100");
  assert.equal(rows[2].cells[13].value, "Prüfung; Büro");
  assert.equal(result.rows, 2);
});
test("DATEV reversal uses original accounts and Generalumkehr rather than a second normal expense", () => {
  const p = {
    ...postings[0],
    debit_account_id: "b",
    credit_account_id: "a",
    reversal_of: "original",
  };
  const rows = parseCsv(
    decodeBytes(
      datevFile(
        settings,
        [p],
        allocations,
        accounts,
        docs,
        centers,
        "2026-10-01",
        "2026-10-31",
      ).bytes,
    ).text,
    ";",
  ).rows;
  const idx = (BUCHUNGSSTAPEL_COLUMNS as readonly string[]).indexOf(
    "Generalumkehr (GU)",
  );
  assert.equal(rows[2].cells[6].value, "4900");
  assert.equal(rows[2].cells[7].value, "1200");
  assert.equal(rows[2].cells[idx].value, "1");
});
test("DATEV rejects missing allocations, invalid references, unsupported currencies and lossy encoding", () => {
  assert.throws(() =>
    datevFile(
      settings,
      postings,
      [],
      accounts,
      docs,
      centers,
      "2026-10-01",
      "2026-10-31",
    ),
  );
  assert.throws(() =>
    datevFile(
      settings,
      postings,
      allocations,
      accounts,
      [{ ...docs[0], invoice_number: "!bad_reference" }],
      centers,
      "2026-10-01",
      "2026-10-31",
    ),
  );
  assert.throws(() =>
    datevFile(
      settings,
      postings,
      allocations,
      accounts,
      [{ ...docs[0], currency: "USD" }],
      centers,
      "2026-10-01",
      "2026-10-31",
    ),
  );
  assert.throws(() =>
    datevFile(
      settings,
      [{ ...postings[0], description: "Unzulässig 🚀" }],
      allocations,
      accounts,
      docs,
      centers,
      "2026-10-01",
      "2026-10-31",
    ),
  );
});
