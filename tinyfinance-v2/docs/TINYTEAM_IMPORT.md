# TinyTeam v13.4.11 → TinyFinance

Die hochgeladene TinyTeam-Anwendung wurde nur gelesen. Keine Änderungen an App, Supabase-Tabellen oder Daten von TinyTeam. Keine externen Verbindungsversuche mit Zugangsdaten aus dem ZIP.

Vorhandenen Export nutzen: TinyTeam → Admin → Auswertungen → Monatsbericht → DATEV-Zeitenexport → Einzelzeiten CSV. Personalnummern vorher in TinyTeam eintragen; diese werden dort nur im aktuellen Browser gespeichert. Monatssummen-CSV eignet sich nicht für diesen Import.

TinyFinance: Migration 007_tinyteam_import.sql nach 001–006 ausführen. Unter Personal Datei laden, Vorschau prüfen, jedes Haus einer Kostenstelle zuordnen und bestätigen. Personalnummern werden mit vorhandenen Mitarbeitern abgeglichen; fehlende Mitarbeiter werden mit Anzeigenamen angelegt. Keine Personalnummer aus dem Namen erraten.

Quellformat geprüft im ZIP: Abrechnungsmonat, Personalnummer, Mitarbeiter, Datum, Haus, Taetigkeit, Beginn, Ende, Pause_Minuten, Netto_Minuten, Netto_Stunden, Notiz, Zeit_ID. Die App exportiert nur abgeschlossene Zeiten, jedoch nicht zwingend lohnseitig freigegebene Zeiten. Deshalb bleiben importierte Zeiten in TinyFinance pending. Netto_Minuten wird übernommen; Pausen nicht doppelt abgezogen. Personen-ID ist im vorhandenen CSV nicht enthalten; Zuordnung deshalb über Personalnummer. Nicht mehr als einen TinyTeam-Datenbestand mit diesem Importkanal verwenden.

Datei bis 2 MB, maximal 2.000 Einzelzeiten pro Import. Eindeutige Zeit-ID verhindert doppelte Übernahme. Bereits vorhandene, geänderte Zeiten brechen den ganzen Import zur gesonderten Prüfung ab. Keine automatische Löschung oder Korrektur. Identische Wiederholungen werden übersprungen. Import ist transaktional und pro Organisation gesperrt. Nur owner/bookkeeper dürfen importieren; Kostenstellen müssen zur gewählten Organisation gehören.

Parser lokal geprüft mit BOM, CSV-Anführungszeichen, Semikolon im Namen, Kalenderdatum, fehlender Personalnummer, negativen Minuten und doppelten Zeit-IDs. Migration und Funktion mit PGlite geprüft: Mitarbeiteranlage, Import, Wiederholung, Konflikt, Rollback, Organisationsprüfung und pending-Status. TypeScript und Produktionsbuild erfolgreich. Live-Supabase und Bedienung im Browser noch nicht geprüft.

Dies ist eine Export/Import-Verbindung, keine automatische Synchronisation und noch kein geprüfter DATEV-Lohnimport.
