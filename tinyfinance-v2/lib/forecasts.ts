import { AppError } from "./errors";
import { cents, validDate } from "./money";
const round = (n: bigint, d: bigint) => Number((n + d / 2n) / d);
export function forecastInterest(
  balance: unknown,
  rate: number,
  history: { effective_on: string; rate_annual: number }[],
  from: string,
  to: string,
  maturity?: string | null,
) {
  if (
    !validDate(from) ||
    !validDate(to) ||
    from >= to ||
    Date.parse(to) - Date.parse(from) > 732 * 86400000
  )
    throw new AppError(400, "Ungültiger Prognosezeitraum.");
  const principal = cents(balance);
  if (principal < 0 || rate < 0 || rate > 100)
    throw new AppError(400, "Ungültiges Guthaben oder Zins.");
  const sorted = [...history].sort((a, b) =>
    a.effective_on.localeCompare(b.effective_on),
  );
  let numerator = 0n,
    days = 0;
  for (let day = Date.parse(from); day < Date.parse(to); day += 86400000) {
    const date = new Date(day).toISOString().slice(0, 10);
    if (maturity && date >= maturity) break;
    const effective =
      sorted.filter((r) => r.effective_on <= date).at(-1)?.rate_annual ?? rate;
    if (
      !Number.isFinite(Number(effective)) ||
      Number(effective) < 0 ||
      Number(effective) > 100
    )
      throw new AppError(400, "Ungültiger Zinssatz.");
    numerator +=
      BigInt(principal) * BigInt(Math.round(Number(effective) * 10000));
    days++;
  }
  return { grossCents: round(numerator, 365000000n), days };
}
export function forecastLoan(
  balance: unknown,
  annualRate: number,
  payment: unknown,
  months = 12,
) {
  let remaining = cents(balance);
  const monthly = cents(payment);
  if (
    remaining < 0 ||
    monthly < 0 ||
    annualRate < 0 ||
    annualRate > 100 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 360
  )
    throw new AppError(400, "Ungültige Kreditparameter.");
  const rows: {
    month: number;
    interest: number;
    payment: number;
    principal: number;
    balance: number;
  }[] = [];
  for (let month = 1; month <= months && remaining > 0; month++) {
    const interest = round(
      BigInt(remaining) * BigInt(Math.round(annualRate * 10000)),
      12000000n,
    );
    const actual = Math.min(monthly, remaining + interest);
    remaining = remaining + interest - actual;
    rows.push({
      month,
      interest,
      payment: actual,
      principal: actual - interest,
      balance: remaining,
    });
  }
  return rows;
}
export function subtractMonths(date: string, months: number) {
  if (!validDate(date) || !Number.isInteger(months) || months < 0)
    throw new AppError(400, "Ungültige Kündigungsfrist.");
  const source = new Date(date);
  const first = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() - months, 1),
  );
  const days = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(source.getUTCDate(), days));
  return first.toISOString().slice(0, 10);
}
export function addMonths(date: string, months: number) {
  if (!validDate(date)) throw new AppError(400, "Ungültiges Datum.");
  const source = new Date(date);
  const first = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const days = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(source.getUTCDate(), days));
  return first.toISOString().slice(0, 10);
}
