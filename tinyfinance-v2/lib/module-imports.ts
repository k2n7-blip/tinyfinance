import { csvRows, germanAmount } from "./imports";
import { modules } from "./modules";
import { AppError } from "./errors";
import type { Row } from "./data";
export const importHeaders: Record<string, string[]> = {
  platforms: [
    "Plattform",
    "Abrechnungsreferenz",
    "Buchungsreferenz",
    "Kostenstellennummer",
    "Von",
    "Bis",
    "Bruttoumsatz",
    "Provision",
    "Erstattungen",
    "Auszahlung",
    "Bankreferenz",
    "Übernachtungen",
    "Verfügbare Nächte",
  ],
  "time-entries": [
    "TinyTeam-ID",
    "Datum",
    "Minuten",
    "Kostenstellennummer",
    "Referenz",
    "Freigabe",
  ],
};
export function moduleImport(
  text: string,
  key: string,
  centers: Row[],
  employees: Row[],
) {
  if (!importHeaders[key])
    throw new AppError(404, "Dieser Import wird nicht unterstützt.");
  return csvRows(text).map((r, index) => {
    if (importHeaders[key].some((h) => !(h.toLowerCase() in r)))
      throw new AppError(
        400,
        "Spalten stimmen nicht mit der Importvorlage überein.",
      );
    const center = centers.find(
      (c) => c.code === r.kostenstellennummer && c.active !== false,
    );
    if (!center)
      throw new AppError(
        400,
        "Kostenstelle unbekannt oder deaktiviert in Zeile " + (index + 2),
      );
    if (key === "time-entries") {
      const employee = employees.find(
        (e) => e.external_team_id === r["tinyteam-id"] && e.active,
      );
      if (!employee)
        throw new AppError(
          400,
          "Aktive TinyTeam-ID nicht gefunden in Zeile " + (index + 2),
        );
      if (
        !["approved", "freigegeben", "genehmigt"].includes(
          r.freigabe.toLowerCase(),
        )
      )
        throw new AppError(
          400,
          "Nur genehmigte TinyTeam-Zeiten dürfen importiert werden.",
        );
      return modules[key].schema.parse({
        employee_id: employee.id,
        cost_center_id: center.id,
        worked_on: r.datum,
        minutes: r.minuten,
        source_id: r.referenz,
        approval_status: "approved",
      });
    }
    return modules[key].schema.parse({
      platform: r.plattform,
      reference: r.abrechnungsreferenz,
      booking_reference: r.buchungsreferenz,
      cost_center_id: center.id,
      period_start: r.von,
      period_end: r.bis,
      gross_amount: germanAmount(r.bruttoumsatz),
      commission: germanAmount(r.provision),
      refunds: germanAmount(r.erstattungen),
      payout: germanAmount(r.auszahlung),
      payout_reference: r.bankreferenz,
      guest_nights: r["übernachtungen"],
      occupancy_nights: r["verfügbare nächte"],
      status: "draft",
    });
  });
}
