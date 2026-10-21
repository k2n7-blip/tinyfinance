# Gemeinsame TinyFinance-Version

## Ausgangspunkt
Basis ist `feat/finance-workflows` (e1d31d995108c2cf9fda12008e32e52af33e7739). Bestehende Beleg-, Bank-, Buchungs-, Immobilien- und Berichtsfunktionen bleiben erhalten. Die alten Erweiterungsmigrationen 005–007 aus PR #2 NICHT auf diese Datenbank anwenden: die produktive Datenbank hat bereits das Workflow-Schema 001–013.

## Ergänzungen
- Globale Suche mit Mandant, MFA und bestehenden RLS-Regeln. Private Daten und Personal bleiben nur für berechtigte Nutzer sichtbar. Gespeicherte Felder, kein PDF-Volltext.
- Excel-Jahresübersichten als getrennte Quell-Snapshots, kein zweiter Buchungsbestand. Versorgerverträge und Kostenvergleich. Vorhandene Immobilien/Zählerverwaltung bleibt erhalten.
- Personalmonatsübersicht und Import des unveränderten TinyTeam-v13.4.11-Einzelzeitenexports. Mitarbeiterzuordnung nach Personalnummer. Neue Zeiten pending. Wiederholungen überspringen, Änderungen blockieren; kein Schreiben nach TinyTeam.
- Holidu-Vorlage mit Vorschau, Filter und Sammelbuchung. Jede Vorbereitung muss auf eine schon vorhandene Holidu-Plattformabrechnung passen (Referenz, Kostenstelle, Brutto, Gebühren und Auszahlung). Bankbetrag und geprüftes Original erforderlich. Beim internen Buchen entsteht ein gesperrtes Journal und die bestehende Plattformabrechnung wird über die vorhandene Bankabgleichsfunktion abgeglichen. Keine neue Plattformabrechnung, keine automatische Lexware-/DATEV-Übertragung. Vorsteuer laut Original; 4300/7 %, 6600/19 %. Kein gemischter Steuersatz, Reverse Charge, Storno oder Sammelauszahlung.

## Konkrete Produktionsmigration
Datei: `supabase/migrations/20261021183814_unified_search_team_holidu.sql`.
- Vier zusätzliche Tabellen: rental_imports, utility_records, holidu_settlements, holidu_journals; RLS, eindeutige Referenzen und Indexe.
- Vier Funktionen: Suche, TinyTeam-Import, Holidu-Sammelbuchung und Schutz gebuchter Originale; zwei neue Schutztrigger.
- Bestehende Geschäftsdatensätze werden nicht per UPDATE/DELETE umgeschrieben. Erst vom Nutzer ausgelöste Importe/Buchungen legen Daten an bzw. gleichen die gewählte Plattformabrechnung ab.
- Anonyme Ausführungsrechte auf SECURITY-DEFINER-Funktionen werden entfernt; explizite Rechte angemeldeter Nutzer bleiben erhalten. Drei bestehende Triggerfunktionen erhalten einen festen search_path.
- Keine Änderung am Supabase-Projekt TinyHaeuserReinigung.

## Prüfung
50 Unit-Tests; TypeScript; Next.js-Produktionsbuild. PGlite: vollständiges Schema 001–013, bisherige RLS-Suite, additive Migration und neue Tests für Import, Dubletten, Konflikte, Suchrechte, Holidu-Journal und bestehende Bankabgleichsfunktion erfolgreich. Im PGlite-Harness wurde pgcrypto/digest für die Tests durch die native SHA256-Funktion ersetzt; keine Änderungen an Produktivdaten. PostgreSQL-Docker-Testskript für beide SQL-Testdateien ergänzt. Browser-/Produktionsprüfung steht aus.

Die produktive Migration wurde bei automatischer Prüfung abgelehnt, bevor Änderungen angewendet wurden. Sie benötigt ausdrückliche Freigabe. Produktionsvariablen im richtigen Vercel-Projekt sind bisher nur für Preview vorhanden; vor Produktion müssen die vorhandenen Werte für die Produktionsumgebung aktiviert werden. Keine Zugangswerte im Repository.
