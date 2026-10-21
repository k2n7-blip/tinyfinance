export function aiProviderMessage(status: number, code?: string): string {
  if (status === 401)
    return "Der OpenAI-API-Schlüssel wurde abgelehnt. Bitte den serverseitigen OPENAI_API_KEY in Vercel prüfen.";
  if (status === 403)
    return "Das OpenAI-Projekt hat keine Berechtigung für diese Erkennung. Bitte die API- und Modellberechtigungen prüfen.";
  if (status === 429 && code === "insufficient_quota")
    return "Für die OpenAI-API fehlt verfügbares Guthaben oder das Budget ist ausgeschöpft. Bitte API-Abrechnung und Projektbudget prüfen; ein ChatGPT-Abo enthält kein API-Guthaben.";
  if (status === 429)
    return "Das OpenAI-Anfragelimit ist erreicht. Bitte später erneut versuchen.";
  if (status === 404 || code === "model_not_found")
    return "Das konfigurierte OpenAI-Modell ist nicht verfügbar. Bitte OPENAI_MODEL und den Modellzugriff prüfen.";
  if (status === 400 || status === 413)
    return "OpenAI hat das Dokument oder die Erkennungsanfrage abgelehnt. Bitte Dateiformat, Dateigröße und Modellunterstützung prüfen.";
  return "Der KI-Anbieter ist momentan nicht verfügbar. Bitte später erneut versuchen.";
}
