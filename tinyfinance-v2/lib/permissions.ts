export type Scope =
  "session" | "read" | "write" | "admin" | "review" | "private" | "payroll";
export function permits(
  role: string,
  scope: Scope,
  privateAccess = false,
  payrollAccess = false,
) {
  if (scope === "session" || scope === "read") return true;
  if (scope === "admin") return role === "owner";
  if (scope === "private")
    return role === "owner" || (role === "bookkeeper" && privateAccess);
  if (scope === "payroll")
    return role === "owner" || (role === "bookkeeper" && payrollAccess);
  if (scope === "review")
    return ["owner", "bookkeeper", "advisor_review"].includes(role);
  return ["owner", "bookkeeper"].includes(role);
}
export const labels: Record<string, string> = {
  owner: "Administrator",
  bookkeeper: "Buchhaltung",
  advisor_read: "Steuerberater · Lesen",
  advisor_review: "Steuerberater · Freigabe",
  viewer: "Nur-Lesen",
  pending: "Zur Prüfung",
  reviewed: "Geprüft",
  rejected: "Abgelehnt",
  approved: "Freigegeben",
  exported: "Exportiert",
  draft: "Entwurf",
  reconciled: "Abgeglichen",
  cancelled: "Storniert",
  business: "Betrieblich",
  private: "Privat",
  rental: "Vermietung",
  checking: "Girokonto",
  savings: "Tagesgeld",
  fixed: "Festgeld",
  rent: "Mieteinnahme",
  expense: "Werbungskosten",
  interest: "Darlehenszins",
  investment: "Investition",
  other: "Sonstiges",
  employee: "Angestellt",
  minijob: "Minijob",
  contractor: "Auftragnehmer",
  vacation: "Urlaub",
  sick: "Krankheit",
  open: "Offen",
  done: "Erledigt",
};
