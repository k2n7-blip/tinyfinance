# TinyFinance v0.2 — Next.js / Supabase

Dies ist eine **echte serverbasierte Entwicklungsbasis**, noch **keine produktionsreife Buchhaltung**. Die erste Version umfasst Login, geschützten Belegupload in privaten Supabase Storage, exakte SHA-256-Dublettenprüfung, Kostenstellen, CSV-Bankimport und eine CSV-Prüfliste für den Steuerberater. KI-OCR, Kontierung, vollständige Kostenrechnung, DATEV-Buchungsstapel, TinyTeam, Lohn, private Steuern und Vermögen sind konzeptionell vorbereitet, aber **nicht implementiert**.

## Inbetriebnahme
1. Privates GitHub-Repository `tinyfinance` erstellen und den Inhalt dieses Ordners hochladen (nicht die ZIP als einzige Datei).
2. Supabase: neues Projekt (EU-Region), SQL `supabase/001_initial.sql` im SQL Editor ausführen. SQL-Sicherheitsprüfung und RLS-Tests vor echten Daten durchführen.
3. In Supabase Authentication einen Benutzer anlegen. `supabase/002_setup_example.sql` lesen, Platzhalter-UUID durch die echte Auth-User-ID ersetzen und dann einmal ausführen. Niemals echte UUID oder Schlüssel committen.
4. Vercel: Repository importieren, Environment Variables gemäß `.env.example` setzen. Publishable/Anon Key, **nie** service_role Key im Frontend. Deploy.
5. In `/login` anmelden, einen Testbeleg hochladen, dieselbe Datei erneut hochladen (409 erwartet), CSV importieren, Prüfliste exportieren.
6. Für Bankimport: `Datum;Betrag;Verwendungszweck;Gegenpartei;Referenz`, Datum `YYYY-MM-DD`, Betrag `123,45` oder `-123,45`. CSV wird nicht als Kontoauszug revisionssicher archiviert.

## Sicherheits- und fachliche Grenzen
- Keine öffentliche Registrierung. Für Berater eigene Einladung/Rolle; bestehende RLS erlaubt Berater-Lesezugriff auf Organisationsdaten und muss vor echter Nutzung nach Datenklassen eingeschränkt werden.
- Aktuell kein unveränderbares GoBD-Archiv; nicht als einziges Belegarchiv einsetzen.
- Keine automatische DATEV-Buchung, keine steuerliche EÜR, keine Lohn- oder Steueranmeldung.
- Die Dashboard-Zähler zeigen nur die letzten 20 Belege bzw. 10 Umsätze, nicht Gesamtzahlen.
- Kostenstellen-Zuordnung wird gespeichert, ist noch keine validierte Kostenrechnung.
- Ein SQL-Schema allein garantiert keine Mandantentrennung; siehe offene Punkte in `docs/ARCHITEKTUR.md`.

## Lokaler Start
`npm install` und `npm run dev` (Node.js 20+). Für Vercel Build `npm run build`. Konfiguration in `.env.local`, nicht committen.
