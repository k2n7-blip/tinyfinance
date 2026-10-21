import test from "node:test";
import assert from "node:assert/strict";
import {
  csvRows,
  germanAmount,
  parseBankCsv,
  parseCamt,
  parseMt940,
} from "../../lib/imports";
import { moduleImport } from "../../lib/module-imports";
const header = "Datum;Betrag;Verwendungszweck;Gegenpartei;Referenz\n";
test("German bank CSV supports quoted delimiters and multiline purposes", () => {
  const rows = parseBankCsv(
    "\uFEFF" +
      header +
      '2026-10-01;-1.234,56;"Rechnung;\nzweite Zeile";Firma;R-1',
    "EUR",
  );
  assert.equal(rows[0].amount, "-1234.56");
  assert.equal(rows[0].purpose, "Rechnung;\nzweite Zeile");
});
test("German amount conversion is strict and preserves signs", () => {
  assert.equal(germanAmount("1.234,5"), "1234.50");
  assert.equal(germanAmount("-0,01"), "-0.01");
  for (const v of ["1.23", "1,234", "NaN", "1,1.2"])
    assert.throws(() => germanAmount(v));
});
test("invalid dates, malformed rows, empty references and zero amounts reject whole bank CSV", () => {
  for (const row of [
    "2026-02-30;10,00;a;b;r",
    "2026-10-01;10,00;a;b;",
    "2026-10-01;0,00;a;b;r",
    "2026-10-01;10,00;a;b;r;extra",
  ])
    assert.throws(() => parseBankCsv(header + row, "EUR"));
});
test("duplicate headers are rejected", () =>
  assert.throws(() => csvRows("Datum;Datum\n2026-01-01;2026-01-02")));
const camt = (currency = "EUR", status = "BOOK") =>
  '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><Stmt><Id>STMT-1</Id><Acct><Id><IBAN>DE00000000000000001234</IBAN></Id></Acct><Ntry><Amt Ccy="' +
  currency +
  '">119.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts><Cd>' +
  status +
  "</Cd></Sts><BookgDt><Dt>2026-10-01</Dt></BookgDt><AcctSvcrRef>CAMT-1</AcctSvcrRef><NtryDtls><TxDtls><RmtInf><Ustrd>Invoice 1</Ustrd></RmtInf><RltdPties><Cdtr><Nm>Supplier</Nm></Cdtr></RltdPties></TxDtls></NtryDtls></Ntry></Stmt></BkToCstmrStmt></Document>";
test("CAMT.053 preserves aggregate booked amount, date, currency, party and reference", () => {
  const [row] = parseCamt(camt(), "EUR", "1234");
  assert.deepEqual(row, {
    booked_on: "2026-10-01",
    amount: "-119.00",
    currency: "EUR",
    counterparty: "Supplier",
    purpose: "Invoice 1",
    source_reference: "CAMT-1",
  });
});
test("CAMT rejects entity declarations, wrong accounts, currencies and unbooked entries", () => {
  for (const v of [
    '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]>' + camt(),
    camt("USD"),
    camt("PDNG"),
  ])
    assert.throws(() => parseCamt(v, "EUR", "1234"));
  assert.throws(() => parseCamt(camt(), "EUR", "9999"));
});
test("MT940 parses debit, reverse credit and bank reference with description", () => {
  const text =
    ":20:TEST\n:25:DE00000000000000001234\n:60F:C261001EUR1000,00\n:61:2610011002D119,00NTRFNONREF//BANK-1\n:86:Supplier invoice\n:61:261001RC10,00NTRFNONREF//BANK-2\n:86:Credit reversal\n:62F:C261002EUR871,00";
  const rows = parseMt940(text, "EUR", "1234");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].booked_on, "2026-10-02");
  assert.equal(rows[0].amount, "-119.00");
  assert.equal(rows[0].purpose, "Supplier invoice");
  assert.equal(rows[1].amount, "-10.00");
  assert.equal(rows[1].source_reference, "BANK-2");
});
test("MT940 rejects unsupported records instead of omitting them", () =>
  assert.throws(() =>
    parseMt940(":20:T\n:25:1234\n:60F:C261001EUR10,00\n:61:unsupported", "EUR"),
  ));
const center = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "100",
  active: true,
};
const employee = {
  id: "20000000-0000-4000-8000-000000000001",
  external_team_id: "team-1",
  active: true,
};
test("TinyTeam import requires approved time, known employee and active center", () => {
  const h = "TinyTeam-ID;Datum;Minuten;Kostenstellennummer;Referenz;Freigabe\n";
  const [row] = moduleImport(
    h + "team-1;2026-10-01;90;100;time-1;genehmigt",
    "time-entries",
    [center],
    [employee],
  );
  assert.equal(row.minutes, 90);
  assert.equal(row.employee_id, employee.id);
  assert.throws(() =>
    moduleImport(
      h + "team-1;2026-10-01;90;100;time-1;pending",
      "time-entries",
      [center],
      [employee],
    ),
  );
  assert.throws(() =>
    moduleImport(
      h + "unknown;2026-10-01;90;100;time-1;approved",
      "time-entries",
      [center],
      [employee],
    ),
  );
});
