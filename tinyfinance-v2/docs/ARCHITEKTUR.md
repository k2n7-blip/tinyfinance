# Architektur und Sicherheitsmodell

Next.js App Router verwendet Supabase SSR für Sitzungs-Cookies. Middleware erneuert Auth, serverseitiges getContext validiert den Nutzer, die explizite Organisation, Rolle und AAL. API-Routen prüfen Ursprung, Eingabe und Bereich; RLS bildet die zweite Zugriffsschicht ohne Service-Role im Anwendungsbetrieb.

Administratoren benötigen AAL2 für Organisationsdaten. Eigene Mitgliedschaftsmetadaten bleiben für Anmeldung/2FA-Einrichtung sichtbar. Buchhaltung erhält private oder Personalbereiche nur mit ausdrücklich erteiltem Flag; Berater und Leser erhalten diese Bereiche nicht. Berater-Freigabe ist getrennt vom Schreibrecht.

Jede organisationsübergreifende Fachrelation ist durch zusammengesetzte Fremdschlüssel abgesichert. Fachmodule verwenden optimistische record_version; zentrale Journal-, Import-, Zahlungs- und Exportoperationen laufen als transaktionale RPCs. Interne Definer-Helfer haben festen search_path und keine öffentlich ausführbaren Bankrestbetrags-/Zugriffsfunktionen.

Originalbelege werden über eindeutigen Organisationshash reserviert. Storage erlaubt nur zum reservierten Beleg gehörende neue Objekte; keine Anwendungsrolle darf Originale überschreiben oder löschen. Private Belege folgen der privaten Zugriffsklasse. Rechnungsprüfung verändert die Originaldatei nicht. Bei Freigabe werden Vollständigkeit, Kontenbestätigung, Währung, Betrag und Kostenstellen geprüft. Änderungen freigegebener Buchungen erfolgen über verknüpfte Gegenbuchung.

Audit-Ereignisse werden ausschließlich von Datenbanktriggern geschrieben; Anwendungskonten können keine Ereignisse fälschen. Projektadministrator-Zugriffe liegen außerhalb dieses Schutzes. Separate unveränderbare Sicherungen sind für eine belastbare Aufbewahrung erforderlich.

KI läuft optional serverseitig und speichert ausschließlich einen Vorschlag. Finanzdaten werden erst nach menschlicher Übernahme und separater Freigabe verbindlich. Plattform- und Personalimporte verwenden dokumentierte, validierte CSV statt unbestätigter APIs.

Siehe FUNKTIONEN_STATUS.md für tatsächlichen Prüfstand und BACKUP.md für Wiederherstellung. Im Testprojekt müssen direkte Supabase-REST-/Storage-Zugriffe mit echten Auth-Tokens zusätzlich geprüft werden. Schutzmaßnahmen wie Rate-Limits, Malwareprüfung, Monitoring, periodische Abschlüsse und vollständige Steuerregeln sind vor Echtdaten weiter zu ergänzen.
