import { AppError } from "./errors";
export function cents(value: unknown): number {
  const s = String(value ?? "").trim();
  if (!/^-?\d{1,10}(\.\d{1,2})?$/.test(s))
    throw new AppError(
      400,
      "Beträge müssen höchstens zwei Nachkommastellen haben.",
    );
  const [whole, fraction = ""] = s.replace("-", "").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return s.startsWith("-") ? -result : result;
}
export function decimal(value: number): string {
  if (!Number.isSafeInteger(value))
    throw new AppError(400, "Ungültiger Centbetrag.");
  return (
    (value < 0 ? "-" : "") +
    Math.floor(Math.abs(value) / 100) +
    "." +
    String(Math.abs(value) % 100).padStart(2, "0")
  );
}
export function money(value: unknown, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(
    Number(value ?? 0),
  );
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (
    !/^-?\d+(\.\d+)?$/.test(text) &&
    (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
  )
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
