export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function databaseError(error: {
  code?: string;
  message: string;
}): never {
  if (error.code === "23505")
    throw new AppError(409, "Dieser Eintrag ist bereits vorhanden.");
  if (error.code === "23503")
    throw new AppError(
      400,
      "Die Zuordnung ist ungültig oder gehört zu einem anderen Mandanten.",
    );
  if (error.code === "42501")
    throw new AppError(
      403,
      "Für diese Aktion fehlen Berechtigung oder Zwei-Faktor-Anmeldung.",
    );
  if (["42P01", "42703", "PGRST202"].includes(error.code || ""))
    throw new AppError(
      503,
      "Die Datenbank muss mit den aktuellen Migrationen aktualisiert werden.",
    );
  throw new AppError(
    400,
    "Die Änderung wurde abgelehnt. Bitte Pflichtfelder, Zuordnungen und Buchungsstatus prüfen.",
  );
}
