import test from "node:test";
import assert from "node:assert/strict";
import { holiduSettlement } from "../../lib/platform-pdf";
import { modules } from "../../lib/modules";
const example = `Holidu Hosts GmbH Rechnung für Provisionsgebühren Nummer TEST-001 von 01.01.2026
Buchungs ID: 12345 Plattform: Booking.com Check-in/out: 01.01.2026 - 04.01.2026 Anzahl der Nächte: 3
Rechnungsbetrag € 89,77 Vom Gast gezahlter Gesamtbetrag 6 € 397,64
Zusätzlich einbehaltene Steuern 7 - € 0,00 Netto-Auszahlung € 307,87`;
test("Holidu PDF keeps gross fees including VAT and does not confuse booking channel with issuer", () => {
  const result = holiduSettlement(example);
  assert.equal(result.platform, "Holidu");
  assert.equal(result.commission, "89.77");
  assert.equal(result.gross_amount, "397.64");
  assert.equal(result.payout, "307.87");
  assert.equal(result.period_start, "2026-01-01");
  assert.equal(result.guest_nights, 3);
  modules.platforms.schema.parse({
    ...result,
    cost_center_id: "11111111-1111-4111-8111-111111111111",
  });
});
test("Holidu parser rejects missing fields, other layouts and non-balancing or tax deductions", () => {
  for (const text of [
    example.replace("397,64", "400,00"),
    example.replace("0,00", "1,00"),
    example.replace("Netto-Auszahlung", "Auszahlung"),
    example.replace("Holidu Hosts GmbH", "Other"),
  ])
    assert.throws(() => holiduSettlement(text));
});

import { orderedPdfText } from "../../lib/pdf-text";
test("PDF reading order reconstructs labels, amounts and superscript footnotes", async () => {
  const item = (str: string, x: number, y: number) => ({
    str,
    transform: [1, 0, 0, 1, x, y],
  });
  const document = {
    numPages: 1,
    getPage: async () => ({
      getTextContent: async () => ({
        items: [
          item("€ 397,64", 300, 100),
          item("6", 200, 105),
          item("Vom Gast gezahlter Gesamtbetrag", 0, 100),
          item("Netto-Auszahlung", 0, 80),
          item("€ 307,87", 300, 80),
        ],
      }),
    }),
  };
  const text = await orderedPdfText(
    document as unknown as Parameters<typeof orderedPdfText>[0],
  );
  assert.equal(
    text,
    "Vom Gast gezahlter Gesamtbetrag 6 € 397,64\nNetto-Auszahlung € 307,87",
  );
});

import {
  holiduAccommodation,
  assignAccommodation,
} from "../../lib/platform-pdf";
test("Holidu accommodation IDs and exact names enable unambiguous assignment", () => {
  const accommodation = holiduAccommodation(
    "ID, name der Unterkunft: 1234, Lodge Check-in/out: 01.01.2026",
  );
  assert.deepEqual(accommodation, { id: "1234", name: "Lodge" });
  const centers = [
    { id: "a", code: "1234", name: "Lodge" },
    { id: "b", code: "other", name: "Other" },
  ];
  assert.equal(assignAccommodation(accommodation, centers, {}), "a");
  assert.equal(
    assignAccommodation(accommodation, centers, { "1234": "b" }),
    "b",
  );
  assert.equal(
    assignAccommodation({ id: "unknown", name: "missing" }, centers, {}),
    "",
  );
  assert.equal(
    assignAccommodation(
      { id: "unknown", name: "Lodge" },
      [...centers, { id: "c", code: "c", name: "Lodge" }],
      {},
    ),
    "",
  );
  assert.equal(
    assignAccommodation(accommodation, centers, { "1234": "deleted" }),
    "a",
  );
});

import { platformSettlementCsv } from "../../lib/platform-csv";
import { moduleImport } from "../../lib/module-imports";
test("Exported settlement CSV round trips through existing import with cents and empty optional nights", () => {
  const row = holiduSettlement(example);
  const center = {
    id: "11111111-1111-4111-8111-111111111111",
    code: "HOUSE1",
    active: true,
  };
  const csv = platformSettlementCsv([
    { ...row, cost_center_code: center.code },
  ]);
  assert.deepEqual(moduleImport(csv, "platforms", [center], []), [
    { ...row, cost_center_id: center.id },
  ]);
});
