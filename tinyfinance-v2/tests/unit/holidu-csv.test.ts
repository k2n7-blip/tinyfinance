import test from "node:test";
import assert from "node:assert/strict";
import { holiduBookingsCsv } from "../../lib/holidu-csv";
const header =
  "Booking ID,Payout Type,Property Name,Property ID,Paid by Guest,Check In,Check Out,Booking Status,Invoice Amount,Payout,Withheld amounts due to Cedolare Secca";
const line =
  '1234,BOOKING_PAYOUT,"Lodge, North",5678,397.64,2026-01-01,2026-01-04,CONFIRMED,89.77,307.87,';
test("Native Holidu CSV handles quoted names, English decimal amounts, stays and property IDs", () => {
  const [entry] = holiduBookingsCsv("\uFEFF" + header + "\n" + line);
  assert.deepEqual(entry.accommodation, { id: "5678", name: "Lodge, North" });
  assert.equal(entry.suggestion?.reference, "HOLIDU-BOOKING-1234");
  assert.equal(entry.suggestion?.commission, "89.77");
  assert.equal(entry.suggestion?.guest_nights, 3);
});
test("Holidu CSV isolates cancellations and incompatible financial rows without importing invented refunds", () => {
  const entries = holiduBookingsCsv(
    header +
      "\n" +
      line +
      "\n" +
      line.replace("CONFIRMED", "CANCELLED") +
      "\n" +
      line.replace("307.87", "300.00"),
  );
  assert.equal(entries.filter((e) => e.suggestion).length, 1);
  assert.equal(entries.filter((e) => e.error).length, 2);
  assert.throws(() => holiduBookingsCsv("other,headers\n1,2"));
});
