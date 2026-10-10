import { z } from "zod";
import { validDate, cents } from "./money";
import type { Scope } from "./access";
export type Field = {
  key: string;
  label: string;
  kind?:
    "text" | "date" | "money" | "number" | "boolean" | "select" | "relation";
  required?: boolean;
  options?: string[];
  relation?: string;
};
export type Module = {
  title: string;
  group: string;
  table: string;
  scope: Scope;
  description: string;
  fields: Field[];
  schema: z.ZodTypeAny;
};
const text = (max = 200) => z.string().trim().min(1).max(max);
const nullable = (schema: z.ZodTypeAny) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    schema.nullable(),
  );
export const date = z.string().refine(validDate, "Ungültiges Kalenderdatum");
export const amount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => {
    try {
      return Math.abs(cents(v)) <= 100000000000;
    } catch {
      return false;
    }
  }, "Ungültiger Betrag");
const positive = amount.refine(
  (v) => Number(v) > 0,
  "Muss größer als null sein",
);
const nonnegative = amount.refine(
  (v) => Number(v) >= 0,
  "Darf nicht negativ sein",
);
const rate = z.coerce
  .number()
  .min(0)
  .max(100)
  .refine((v) => Number(v.toFixed(4)) === v, "Maximal vier Nachkommastellen");
const id = z.string().uuid();
const f = (
  key: string,
  label: string,
  kind: Field["kind"] = "text",
  required = true,
  options?: string[],
  relation?: string,
): Field => ({ key, label, kind, required, options, relation });
const rel = (key: string, label: string, relation: string, required = true) =>
  f(key, label, "relation", required, undefined, relation);
const define = (
  title: string,
  group: string,
  table: string,
  scope: Scope,
  description: string,
  fields: Field[],
  schema: z.ZodTypeAny,
): Module => ({ title, group, table, scope, description, fields, schema });
export const modules: Record<string, Module> = {
  "cost-centers": define(
    "Kostenstellen",
    "Betrieb",
    "cost_centers",
    "admin",
    "Historische Zuordnungen bleiben erhalten. Deaktivieren statt löschen.",
    [
      f("code", "Nummer"),
      f("name", "Bezeichnung"),
      f("active", "Aktiv", "boolean"),
    ],
    z
      .object({
        code: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
        name: text(120),
        active: z.boolean(),
      })
      .strict(),
  ),
  accounts: define(
    "Kontenplan",
    "Buchhaltung",
    "chart_accounts",
    "admin",
    "Konten und Steuerkennzeichen mit der Kanzlei abstimmen. Erst bestätigte Konten dürfen freigegeben werden.",
    [
      f("account_number", "Kontonummer"),
      f("description", "Bezeichnung"),
      f("framework", "Kontenrahmen", "select", true, ["SKR03", "SKR04"]),
      f("kind", "Kontenart", "select", true, [
        "asset",
        "liability",
        "income",
        "expense",
        "bank",
      ]),
      f("approved_by_advisor", "Von der Kanzlei bestätigt", "boolean"),
    ],
    z
      .object({
        account_number: z.string().regex(/^\d{4,8}$/),
        description: text(120),
        framework: z.enum(["SKR03", "SKR04"]),
        kind: z.enum(["asset", "liability", "income", "expense", "bank"]),
        approved_by_advisor: z.boolean(),
      })
      .strict(),
  ),
  "bank-accounts": define(
    "Bankkonten",
    "Betrieb",
    "bank_accounts",
    "read",
    "Mehrere Konten mit getrennten Importreferenzen. Private Konten sind besonders geschützt.",
    [
      f("name", "Kontobezeichnung"),
      f("iban_last4", "Letzte vier IBAN-Zeichen", "text", false),
      f("currency", "Währung"),
      f("account_type", "Bereich", "select", true, [
        "business",
        "checking",
        "private",
        "savings",
      ]),
      f("active", "Aktiv", "boolean"),
    ],
    z
      .object({
        name: text(120),
        iban_last4: nullable(z.string().regex(/^[A-Za-z0-9]{4}$/)),
        currency: z.string().regex(/^[A-Z]{3}$/),
        account_type: z.enum(["business", "checking", "private", "savings"]),
        active: z.boolean(),
      })
      .strict(),
  ),
  platforms: define(
    "Plattformabrechnungen",
    "Betrieb",
    "platform_settlements",
    "read",
    "Bruttoumsatz, Provision, Erstattung und Auszahlung getrennt erfassen. CSV-Import und geprüfter Holidu-PDF-Import unter Dateiimporte.",
    [
      f("platform", "Plattform", "select", true, [
        "Holidu",
        "Booking.com",
        "Airbnb",
      ]),
      f("reference", "Abrechnungsreferenz"),
      f("booking_reference", "Buchungsreferenz", "text", false),
      rel("cost_center_id", "Ferienhaus", "cost-centers"),
      f("period_start", "Von", "date"),
      f("period_end", "Bis", "date"),
      f("gross_amount", "Bruttoumsatz", "money"),
      f("commission", "Provision", "money"),
      f("refunds", "Erstattungen", "money"),
      f("payout", "Auszahlung", "money"),
      f("payout_reference", "Bankreferenz", "text", false),
      f("guest_nights", "Übernachtungen", "number", false),
      f("occupancy_nights", "Verfügbare Nächte", "number", false),
      f("status", "Status", "select", true, [
        "draft",
        "reconciled",
        "cancelled",
      ]),
    ],
    z
      .object({
        platform: z.enum(["Holidu", "Booking.com", "Airbnb"]),
        reference: text(200),
        booking_reference: nullable(text()),
        cost_center_id: id,
        period_start: date,
        period_end: date,
        gross_amount: nonnegative,
        commission: nonnegative,
        refunds: nonnegative,
        payout: nonnegative,
        payout_reference: nullable(text()),
        guest_nights: nullable(z.coerce.number().int().min(0).max(100000)),
        occupancy_nights: nullable(z.coerce.number().int().min(0).max(100000)),
        status: z.enum(["draft", "reconciled", "cancelled"]),
      })
      .strict()
      .refine((v) => v.period_end >= v.period_start, "Ungültiger Zeitraum")
      .refine(
        (v) =>
          cents(v.gross_amount) - cents(v.commission) - cents(v.refunds) ===
          cents(v.payout),
        "Brutto − Provision − Erstattung muss Auszahlung ergeben",
      )
      .refine(
        (v) =>
          v.guest_nights === null ||
          v.occupancy_nights === null ||
          v.guest_nights <= v.occupancy_nights,
        "Belegte Nächte überschreiten verfügbare Nächte",
      ),
  ),
  "tax-subjects": define(
    "Steuerbereiche",
    "Privat",
    "tax_subjects",
    "private",
    "Private Finanzen und Vermietung erhalten eigene Steuerbereiche.",
    [
      f("name", "Bezeichnung"),
      f("subject_type", "Bereich", "select", true, [
        "business",
        "private",
        "rental",
      ]),
      f("saver_allowance", "Sparer-Pauschbetrag", "money"),
    ],
    z
      .object({
        name: text(120),
        subject_type: z.enum(["business", "private", "rental"]),
        saver_allowance: nonnegative,
      })
      .strict(),
  ),
  properties: define(
    "Immobilien",
    "Privat",
    "properties",
    "private",
    "Objekt mit einzelnen Nutzungseinheiten. Gemeinsame Kosten bleiben am Objekt; Einheiten separat unter Immobilien-Einheiten anlegen. Keine automatische steuerliche Kostenverteilung.",
    [
      f("name", "Objekt"),
      rel("tax_subject_id", "Steuerbereich", "tax-subjects"),
      f("address", "Adresse", "text", false),
      f("usage_type", "Nutzung", "select", true, [
        "mixed",
        "rental",
        "private",
        "business",
      ]),
      f("estimated_value", "Geschätzter Wert", "money", false),
      f("ownership_percent", "Eigentumsanteil %", "number"),
      f("acquired_on", "Erwerbsdatum", "date", false),
      f("depreciable_basis", "AfA-Bemessungsgrundlage", "money", false),
      f("depreciation_rate", "AfA-Satz %", "number", false),
      f("active", "Aktiv", "boolean"),
      f("notes", "Notizen", "text", false),
    ],
    z
      .object({
        name: text(120),
        tax_subject_id: id,
        address: nullable(text()),
        usage_type: z.enum(["mixed", "rental", "private", "business"]),
        active: z.boolean().default(true),
        estimated_value: nullable(nonnegative),
        ownership_percent: rate.refine((v) => v > 0),
        acquired_on: nullable(date),
        depreciable_basis: nullable(nonnegative),
        depreciation_rate: nullable(rate),
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
  "property-units": define(
    "Immobilien-Einheiten",
    "Privat",
    "property_units",
    "private",
    "Einheiten einem Objekt zuordnen. Selbstnutzung, feste Vermietung, Ferienwohnung und Monteurvermietung getrennt erfassen. Flächen dienen als Grundlage einer später fachlich geprüften Kostenverteilung.",
    [
      rel("property_id", "Immobilie", "properties"),
      f("name", "Einheit"),
      f("usage_type", "Nutzung", "select", true, [
        "owner_occupied",
        "long_term_rental",
        "holiday_rental",
        "workers_rental",
      ]),
      f("area_sqm", "Fläche m²", "number", false),
      f("active", "Aktiv", "boolean"),
      f("notes", "Notizen", "text", false),
    ],
    z
      .object({
        property_id: id,
        name: text(120),
        usage_type: z.enum([
          "owner_occupied",
          "long_term_rental",
          "holiday_rental",
          "workers_rental",
        ]),
        area_sqm: nullable(positive),
        active: z.boolean(),
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
  "property-files": define(
    "Hausakte",
    "Privat",
    "property_files",
    "private",
    "Verträge, Wartungen, Versicherungen und andere Vorgänge am Haus dokumentieren. Ein vorhandener Beleg kann verknüpft werden.",
    [
      rel("property_id", "Immobilie", "properties"),
      rel("unit_id", "Einheit (optional)", "property-units", false),
      f("title", "Titel"),
      f("category", "Kategorie", "select", true, [
        "contract",
        "maintenance",
        "insurance",
        "other",
      ]),
      f("recorded_on", "Datum", "date"),
      f("notes", "Inhalt / Notizen", "text", false),
      rel("document_id", "Beleg", "documents", false),
    ],
    z
      .object({
        property_id: id,
        unit_id: nullable(id),
        title: text(200),
        category: z.enum(["contract", "maintenance", "insurance", "other"]),
        recorded_on: date,
        notes: nullable(text(10000)),
        document_id: nullable(id),
      })
      .strict(),
  ),
  "property-meters": define(
    "Zähler",
    "Privat",
    "property_meters",
    "private",
    "Zähler frei anlegen und dem Haus oder einer Einheit zuordnen. Bei Zählerwechsel einen neuen Zähler anlegen und den bisherigen deaktivieren; Stände verschiedener Zähler werden nicht verrechnet.",
    [
      rel("property_id", "Immobilie", "properties"),
      rel("unit_id", "Einheit (leer = Hauszähler)", "property-units", false),
      f("name", "Bezeichnung"),
      f("serial_number", "Zählernummer", "text", false),
      f("medium", "Medium (z. B. Wasser, Strom, Wärme)"),
      f("measurement_unit", "Maßeinheit (z. B. m³, kWh)"),
      f("active", "Aktiv", "boolean"),
      f("notes", "Notizen", "text", false),
    ],
    z
      .object({
        property_id: id,
        unit_id: nullable(id),
        name: text(120),
        serial_number: nullable(text(120)),
        medium: text(80),
        measurement_unit: text(20),
        active: z.boolean(),
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
  "meter-readings": define(
    "Zählerstände",
    "Privat",
    "meter_readings",
    "private",
    "Ablesedatum und kumulierten Zählerstand eintragen. Verbrauch ergibt sich nur zwischen zwei Ablesungen desselben Zählers. Dies ist die Datengrundlage für Nebenkosten, noch keine fertige Nebenkostenabrechnung.",
    [
      rel("meter_id", "Zähler", "property-meters"),
      f("read_on", "Ablesedatum", "date"),
      f("reading", "Zählerstand", "number"),
      f("notes", "Notizen", "text", false),
    ],
    z
      .object({
        meter_id: id,
        read_on: date,
        reading: z.coerce
          .number()
          .finite()
          .min(0)
          .max(999999999999)
          .refine(
            (v) => Number(v.toFixed(3)) === v,
            "Maximal drei Nachkommastellen",
          ),
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
  "rental-entries": define(
    "Miet- und Objektbuchungen",
    "Privat",
    "rental_entries",
    "private",
    "Miete, Werbungskosten, Darlehenszinsen und Investitionen getrennt dokumentieren. Keine automatische Steuererklärung.",
    [
      rel("property_id", "Immobilie", "properties"),
      rel("unit_id", "Einheit (leer = Gesamtobjekt)", "property-units", false),
      f("booked_on", "Datum", "date"),
      f("kind", "Art", "select", true, [
        "rent",
        "expense",
        "interest",
        "investment",
      ]),
      f("amount", "Betrag", "money"),
      f("description", "Beschreibung"),
      rel("document_id", "Beleg", "documents", false),
    ],
    z
      .object({
        property_id: id,
        unit_id: nullable(id),
        booked_on: date,
        kind: z.enum(["rent", "expense", "interest", "investment"]),
        amount: positive,
        description: text(),
        document_id: nullable(id),
      })
      .strict(),
  ),
  interest: define(
    "Tagesgeld und Festgeld",
    "Privat",
    "interest_accounts",
    "private",
    "Prognose: taggenau Actual/365, ohne Zinseszins, bei konstantem Guthaben. Historische Raten werden berücksichtigt.",
    [
      f("name", "Kontobezeichnung"),
      f("bank_name", "Bank"),
      rel("tax_subject_id", "Steuerbereich", "tax-subjects"),
      f("account_type", "Kontoart", "select", true, ["savings", "fixed"]),
      f("balance", "Guthaben", "money"),
      f("rate_annual", "Aktueller Jahreszins %", "number"),
      f("allowance_allocated", "Freistellungsauftrag", "money"),
      f("maturity_on", "Fälligkeit / Aktionsende", "date", false),
    ],
    z
      .object({
        name: text(120),
        bank_name: text(120),
        tax_subject_id: id,
        account_type: z.enum(["savings", "fixed"]),
        balance: nonnegative,
        rate_annual: rate,
        allowance_allocated: nonnegative,
        maturity_on: nullable(date),
      })
      .strict(),
  ),
  "interest-rates": define(
    "Zinsänderungen",
    "Privat",
    "interest_rate_history",
    "private",
    "Wirksamkeitsdatum und Zinssatz pro Konto.",
    [
      rel("interest_account_id", "Zinskonto", "interest"),
      f("effective_on", "Gültig ab", "date"),
      f("rate_annual", "Jahreszins %", "number"),
    ],
    z
      .object({
        interest_account_id: id,
        effective_on: date,
        rate_annual: rate,
      })
      .strict(),
  ),
  "interest-entries": define(
    "Zinsgutschriften",
    "Privat",
    "interest_entries",
    "private",
    "Tatsächliche Bruttozinsen, Kapitalertragsteuer und Solidaritätszuschlag.",
    [
      rel("interest_account_id", "Zinskonto", "interest"),
      f("value_date", "Valuta", "date"),
      f("gross_interest", "Bruttozins", "money"),
      f("tax_withheld", "Kapitalertragsteuer", "money"),
      f("solidarity_withheld", "Solidaritätszuschlag", "money"),
      f("notes", "Notizen", "text", false),
    ],
    z
      .object({
        interest_account_id: id,
        value_date: date,
        gross_interest: nonnegative,
        tax_withheld: nonnegative,
        solidarity_withheld: nonnegative,
        notes: nullable(text(2000)),
      })
      .strict()
      .refine(
        (v) =>
          cents(v.tax_withheld) + cents(v.solidarity_withheld) <=
          cents(v.gross_interest),
        "Steuern überschreiten Bruttozins",
      ),
  ),
  loans: define(
    "Kredite",
    "Privat",
    "loans",
    "private",
    "Restschuld, Monatsrate und Ende der Zinsbindung. Prognosen setzen konstanten Zins und konstante Rate voraus.",
    [
      rel("property_id", "Immobilie", "properties"),
      f("lender", "Kreditgeber"),
      f("balance", "Restschuld", "money"),
      f("interest_rate", "Jahreszins %", "number"),
      f("monthly_payment", "Monatsrate", "money"),
      f("fixed_until", "Zinsbindung bis", "date", false),
    ],
    z
      .object({
        property_id: id,
        lender: text(120),
        balance: nonnegative,
        interest_rate: rate,
        monthly_payment: nonnegative,
        fixed_until: nullable(date),
      })
      .strict(),
  ),
  insurance: define(
    "Versicherungen",
    "Privat",
    "insurance_contracts",
    "private",
    "Verträge, Beiträge und Kündigungsfristen. Vertragliche Sonderregelungen selbst prüfen.",
    [
      f("name", "Vertrag"),
      f("provider", "Versicherer"),
      rel("tax_subject_id", "Steuerbereich", "tax-subjects"),
      f("policy_reference", "Vertragsnummer", "text", false),
      f("annual_premium", "Jahresbeitrag", "money"),
      f("renewal_on", "Verlängerung", "date", false),
      f("cancellation_notice_months", "Kündigungsfrist Monate", "number"),
    ],
    z
      .object({
        name: text(120),
        provider: text(120),
        tax_subject_id: id,
        policy_reference: nullable(text()),
        annual_premium: nonnegative,
        renewal_on: nullable(date),
        cancellation_notice_months: z.coerce.number().int().min(0).max(36),
      })
      .strict(),
  ),
  "insurance-payments": define(
    "Versicherungszahlungen",
    "Privat",
    "insurance_payments",
    "private",
    "Gezahlte Beiträge getrennt vom Vertragsbeitrag dokumentieren.",
    [
      rel("insurance_contract_id", "Vertrag", "insurance"),
      f("paid_on", "Bezahlt am", "date"),
      f("amount", "Betrag", "money"),
      f("notes", "Notizen", "text", false),
    ],
    z
      .object({
        insurance_contract_id: id,
        paid_on: date,
        amount: positive,
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
  pensions: define(
    "Rente und Vorsorge",
    "Privat",
    "pension_records",
    "private",
    "Werte aus Renteninformationen und Vorsorgeverträgen, keine garantierte Rentenprognose.",
    [
      rel("tax_subject_id", "Steuerbereich", "tax-subjects"),
      f("contract_name", "Vertrag"),
      f("record_date", "Stand", "date"),
      f("monthly_estimate", "Monatliche Prognose", "money"),
      f("capital_value", "Kapitalwert", "money", false),
      f("source", "Quelle"),
      f("notes", "Annahmen / Notizen", "text", false),
    ],
    z
      .object({
        tax_subject_id: id,
        contract_name: text(120),
        record_date: date,
        monthly_estimate: nonnegative,
        capital_value: nullable(nonnegative),
        source: text(),
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
  assets: define(
    "Vermögenswerte",
    "Privat",
    "assets",
    "private",
    "Weitere Vermögenswerte. Immobilien- und Kontowerte in den jeweiligen Modulen pflegen.",
    [
      f("name", "Bezeichnung"),
      rel("tax_subject_id", "Steuerbereich", "tax-subjects"),
      f("kind", "Art", "select", true, ["investment", "other"]),
      f("value", "Geschätzter Wert", "money"),
      f("notes", "Annahmen", "text", false),
    ],
    z
      .object({
        name: text(120),
        tax_subject_id: id,
        kind: z.enum(["investment", "other"]),
        value: nonnegative,
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
  deadlines: define(
    "Steuerfristen",
    "Privat",
    "tax_deadlines",
    "private",
    "Eigene Fristen verwalten. Keine automatisch behaupteten gesetzlichen Fristen.",
    [
      rel("tax_subject_id", "Steuerbereich", "tax-subjects"),
      f("due_on", "Fällig am", "date"),
      f("kind", "Beschreibung"),
      f("status", "Status", "select", true, ["open", "done"]),
    ],
    z
      .object({
        tax_subject_id: id,
        due_on: date,
        kind: text(),
        status: z.enum(["open", "done"]),
      })
      .strict(),
  ),
  employees: define(
    "Mitarbeiter",
    "Personal",
    "employees",
    "payroll",
    "Lohnvorbereitung für den Steuerberater; kein produktives Abrechnungssystem.",
    [
      f("name", "Name"),
      f("external_team_id", "TinyTeam-ID", "text", false),
      f("personnel_number", "Personalnummer"),
      f("employment_type", "Beschäftigung", "select", true, [
        "employee",
        "minijob",
        "contractor",
      ]),
      f("hourly_cost", "Arbeitskosten pro Stunde", "money"),
      f("active", "Aktiv", "boolean"),
    ],
    z
      .object({
        name: text(120),
        external_team_id: nullable(text()),
        personnel_number: text(30),
        employment_type: z.enum(["employee", "minijob", "contractor"]),
        hourly_cost: nonnegative,
        active: z.boolean(),
      })
      .strict(),
  ),
  "time-entries": define(
    "Arbeitszeiten",
    "Personal",
    "time_entries",
    "payroll",
    "Nur freigegebene Zeiten werden ausgewertet. CSV-Import genehmigter TinyTeam-Zeiten.",
    [
      rel("employee_id", "Mitarbeiter", "employees"),
      rel("cost_center_id", "Kostenstelle", "cost-centers"),
      f("worked_on", "Arbeitstag", "date"),
      f("minutes", "Minuten", "number"),
      f("source_id", "Importreferenz"),
      f("approval_status", "Freigabe", "select", true, [
        "pending",
        "approved",
        "rejected",
      ]),
    ],
    z
      .object({
        employee_id: id,
        cost_center_id: id,
        worked_on: date,
        minutes: z.coerce.number().int().min(1).max(1440),
        source_id: text(),
        approval_status: z.enum(["pending", "approved", "rejected"]),
      })
      .strict(),
  ),
  absences: define(
    "Urlaub und Fehlzeiten",
    "Personal",
    "absences",
    "payroll",
    "Freigaben und Zeiträume dokumentieren. Keine medizinischen Diagnosen erfassen.",
    [
      rel("employee_id", "Mitarbeiter", "employees"),
      f("starts_on", "Von", "date"),
      f("ends_on", "Bis", "date"),
      f("kind", "Art", "select", true, ["vacation", "sick", "other"]),
      f("status", "Status", "select", true, [
        "pending",
        "approved",
        "rejected",
      ]),
    ],
    z
      .object({
        employee_id: id,
        starts_on: date,
        ends_on: date,
        kind: z.enum(["vacation", "sick", "other"]),
        status: z.enum(["pending", "approved", "rejected"]),
      })
      .strict()
      .refine((v) => v.ends_on >= v.starts_on, "Ungültiger Zeitraum"),
  ),
  "payroll-items": define(
    "Lohnvorbereitung",
    "Personal",
    "payroll_items",
    "payroll",
    "Lohnarten, Zuschüsse und Sachbezüge fachlich prüfen. Kein bestätigter DATEV-Lohnimport.",
    [
      rel("employee_id", "Mitarbeiter", "employees"),
      f("period_month", "Monat (erster Tag)", "date"),
      f("wage_type", "Lohnart / Zuschuss"),
      f("amount", "Betrag", "money"),
      f("notes", "Notizen", "text", false),
    ],
    z
      .object({
        employee_id: id,
        period_month: date.refine(
          (v) => v.endsWith("-01"),
          "Ersten Tag des Monats wählen",
        ),
        wage_type: text(120),
        amount,
        notes: nullable(text(2000)),
      })
      .strict(),
  ),
};
export const documentSchema = z
  .object({
    vendor: nullable(text()),
    invoice_number: nullable(text()),
    invoice_date: nullable(date),
    service_date: nullable(date),
    net_amount: nullable(nonnegative),
    vat_amount: nullable(nonnegative),
    gross_amount: nullable(positive),
    currency: z.string().regex(/^[A-Z]{3}$/),
    direction: z.enum(["expense", "income"]),
    cost_center_id: nullable(id),
    review_status: z.enum(["pending", "reviewed", "rejected"]),
    version: z.number().int().positive(),
  })
  .strict()
  .refine(
    (v) =>
      v.net_amount === null ||
      v.vat_amount === null ||
      v.gross_amount === null ||
      cents(v.net_amount) + cents(v.vat_amount) === cents(v.gross_amount),
    "Netto + Umsatzsteuer muss Brutto ergeben",
  )
  .refine(
    (v) =>
      v.review_status !== "reviewed" ||
      [
        v.vendor,
        v.invoice_number,
        v.invoice_date,
        v.service_date,
        v.net_amount,
        v.vat_amount,
        v.gross_amount,
      ].every((x) => x !== null),
    "Für geprüfte Belege fehlen Pflichtangaben",
  );
export const postingSchema = z
  .object({
    id: id.optional(),
    version: z.number().int().positive().optional(),
    document_id: id,
    posting_date: date,
    amount: positive,
    debit_account_id: id,
    credit_account_id: id,
    description: text(60),
    vat_code: z.string().regex(/^\d{0,4}$/),
    allocations: z
      .array(z.object({ cost_center_id: id, amount: positive }).strict())
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (v) => v.debit_account_id !== v.credit_account_id,
    "Soll und Haben müssen verschieden sein",
  )
  .refine(
    (v) =>
      v.allocations.reduce((s, a) => s + cents(a.amount), 0) ===
      cents(v.amount),
    "Kostenstellenaufteilung muss den Buchungsbetrag ergeben",
  )
  .refine(
    (v) =>
      new Set(v.allocations.map((a) => a.cost_center_id)).size ===
      v.allocations.length,
    "Kostenstelle doppelt",
  )
  .refine((v) => !v.id || !!v.version, "Versionsnummer fehlt");
