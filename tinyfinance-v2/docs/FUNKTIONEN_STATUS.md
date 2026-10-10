# TinyFinance – ehrlicher Funktionsstatus

## Direkt nutzbar nach Einrichtung und Prüfung
- Anmeldung mit Supabase, Rollen über memberships
- Privater Belegupload (PDF, JPG, PNG) und SHA-256-Dateidublettenprüfung
- Belegliste, Original öffnen, Belegdaten manuell ändern, Kostenstelle und Prüfstatus speichern
- KI-Extraktion für PDF und Bilder per OpenAI Responses API **nur nach Konfiguration von OPENAI_API_KEY**; Ergebnisse sind Vorschläge, keine Kontierung
- Kostenstellenverwaltung, Hell/Dunkel, Schriftgröße, Passwortwechsel und TOTP-Einrichtung (siehe Sicherheitshinweis)
- CSV-Bankimport und CSV-Belegprüfliste; keine geprüfte DATEV-Buchungsdatei

## Datenbankmodelle vorhanden, produktive Oberfläche / Schnittstelle noch nicht fertig
- Bankkonten, Zinskonten, Freistellungsaufträge (in interest_accounts), Zinsbuchungen
- Versicherungen, Immobilien, Darlehen, Rentenaufzeichnungen
- Plattformabrechnungen (Holidu / Booking), Lohn-/TinyTeam-Import, Steuerfristen
- Buchungssätze, DATEV-Konten, Verteilungsschlüssel, Bankmatching

## Noch NICHT fertig / nicht als produktiv bewerben
- Automatische sichere Bankanbindung, CAMT/MT940, verlässliches Matching
- DATEV-Buchungsstapel mit validiertem Import, ELSTER-Übermittlung, GoBD-Testat
- Vollständige Umsatzsteuerlogik und geprüfte automatische Kontierung
- Automatischer Holidu-/Booking-Import, TinyTeam-Synchronisierung
- Rechtssichere Lohnabrechnung / Sozialversicherungsmeldungen
- Verpflichtende MFA serverseitig, Security Audit, revisionssicheres Archiv, Backup-Restore-Test

## Betrieb
- Keine echten Finanz- oder Personaldaten ohne RLS-/Storage-Test, MFA-Durchsetzung und Backup-Konzept.
- KI überträgt Belegdaten an einen externen API-Anbieter. Datenschutz und Auftragsverarbeitung vor Nutzung klären.
- Keine privaten API-Schlüssel in GitHub. Nur Vercel-Servervariable OPENAI_API_KEY.
