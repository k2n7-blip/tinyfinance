import { AppError } from "./errors";
import { cents } from "./money";

export function holiduSettlement(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  if (!/Holidu Hosts GmbH/.test(normalized))
    throw new AppError(
      400,
      "Aktuell werden Holidu-Provisionsabrechnungen mit Auszahlungsteil unterstützt.",
    );
  const required = (pattern: RegExp, label: string) => {
    const match = normalized.match(pattern);
    if (!match)
      throw new AppError(
        400,
        label +
          " konnte nicht eindeutig erkannt werden. Bitte CSV oder manuelle Erfassung verwenden.",
      );
    return match;
  };
  const amount = (pattern: RegExp, label: string) =>
    required(pattern, label)[1].replace(/\./g, "").replace(",", ".");
  const reference = required(
    /Rechnung für Provisionsgebühren Nummer ([A-Za-z0-9-]+) von/,
    "Abrechnungsreferenz",
  )[1];
  const booking_reference = required(
    /Buchungs ID:\s*(\d+)/,
    "Buchungsreferenz",
  )[1];
  const dates = required(
    /Check-in\/out:\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/,
    "Aufenthalt",
  );
  const iso = (date: string) => date.split(".").reverse().join("-");
  const gross_amount = amount(
    /Vom Gast gezahlter Gesamtbetrag(?:\s+6)?\s*€\s*([\d.,]+)/,
    "Gastzahlung",
  );
  const commission = amount(
    /Rechnungsbetrag\s*€\s*([\d.,]+)/,
    "Gebühren einschließlich Umsatzsteuer",
  );
  const payout = amount(/Netto-Auszahlung\s*€\s*([\d.,]+)/, "Auszahlung");
  const tax = amount(
    /Zusätzlich einbehaltene Steuern(?:\s+7)?\s*-?\s*€\s*([\d.,]+)/,
    "Einbehaltene Steuern",
  );
  if (
    cents(tax) !== 0 ||
    cents(gross_amount) - cents(commission) !== cents(payout)
  )
    throw new AppError(
      400,
      "Diese Abrechnung enthält weitere Abzüge oder widersprüchliche Summen. Bitte manuell erfassen; Abzüge werden nicht als Erstattung umgedeutet.",
    );
  return {
    platform: "Holidu" as const,
    reference,
    booking_reference,
    period_start: iso(dates[1]),
    period_end: iso(dates[2]),
    gross_amount,
    commission,
    refunds: "0.00",
    payout,
    payout_reference: null,
    guest_nights: Number(
      required(/Anzahl der Nächte:\s*(\d+)/, "Übernachtungen")[1],
    ),
    occupancy_nights: null,
    status: "draft" as const,
  };
}

export function holiduAccommodation(text: string) {
  const match = text
    .replace(/\s+/g, " ")
    .match(
      /ID, name der Unterkunft:\s*(\d+),\s*(.*?)\s+(?:Check-in\/out:|Einheiten-ID\(s\):)/,
    );
  return { id: match?.[1] || "", name: match?.[2]?.trim() || "" };
}
export function assignAccommodation(
  accommodation: { id: string; name: string },
  centers: { id: string; name: string; code: string }[],
  remembered: Record<string, string>,
) {
  const saved =
    accommodation.id &&
    centers.find((c) => c.id === remembered[accommodation.id]);
  if (saved) return saved.id;
  const candidates = centers.filter(
    (c) =>
      (accommodation.id && c.code === accommodation.id) ||
      (accommodation.name &&
        c.name.trim().toLowerCase() ===
          accommodation.name.trim().toLowerCase()),
  );
  return candidates.length === 1 ? candidates[0].id : "";
}
