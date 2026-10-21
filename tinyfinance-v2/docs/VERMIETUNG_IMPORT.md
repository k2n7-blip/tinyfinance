# Immobilien-Erweiterung

## Einrichtung
1. Abhängigkeiten installieren (`npm install`). ExcelJS liest XLSX-Dateien auf dem Server.
2. `supabase/005_rental_utilities.sql` nach den Migrationen 001–004 im vorhandenen Supabase-Projekt ausführen.
3. Next.js bauen (`npm run typecheck`, `npm run build`) und über den bestehenden Vercel-Prozess bereitstellen.
4. Dashboard → Immobilien & Jahresimport öffnen.

## Unterstützter Umfang
- XLSX-Jahresübersichten der bereitgestellten Vorlagen 2022–2025; kompatible 2026-Vorlagen mit denselben Spalten.
- Explizite Jahreswahl, Vorschau, Warnung vor abweichenden Tabellenjahren, Dublettenschutz nach Organisation/Jahr/Dateiinhalt.
- Gespeicherte Excel-Formelergebnisse; leere oder nicht numerische Werte bleiben unbekannt.
- Jahresvergleich pro unverändertem Bereichsnamen. Bei mehreren Importen pro Jahr zählt der zuletzt gespeicherte Stand. Keine automatische Zusammenführung umbenannter Objekte.
- Private Positionen, Solar, ITSH und Immobilien bleiben getrennte Bereiche. Keine Summen aus gemischten Bereichen.
- Zählerstände samt Datum, Register, Versorgung und Einheit; Differenzberechnung ohne Jahreshochrechnung.
- Versorgerverträge mit Laufzeit, Preisbindung, Kündigungshinweis und Jahreskosten aus eingegebenem Vergleichsverbrauch.
- Organisationszugriff über bestehende Supabase-Mitgliedschaften und RLS; Schreiben nur für owner/bookkeeper.

## Grenzen
Keine automatische Übernahme der Detailblätter, Einzelbelege, Kreditraten, Zählerstände oder Nebenkostenabrechnungen. Kein steuerlicher Gewinn, keine automatische Buchung und keine Live-Tarifabfrage. Die Quelldatei bleibt beim Nutzer; gespeichert werden Übersichts-Snapshots und Datei-Hash, nicht das vollständige XLSX-Original.

## Prüfung
Die vier hochgeladenen XLSX-Dateien wurden direkt als ZIP/XML gelesen: alle verwenden B2 Einnahmen, C2 Fixkosten, D2 Kosten und F2 Ergebnis. 2025/Kammberg 27C hat in B1 noch das Jahr 2024. Keine privaten Quelldateien oder Beträge wurden ins Repository übernommen.

Typecheck, Produktionsbuild (Next.js 15.5.28) und ExcelJS-Laufzeitprüfung mit allen vier Quelldateien erfolgreich; ungültige Dateien werden abgewiesen. Datenbankintegration ist noch ausstehend. Vor Produktionsübernahme diese Checks und einen Testimport je Jahr ausführen; dabei Wiederholungsimport, Leserechte und Organisationsgrenzen prüfen. Die Migration wurde nicht auf einer produktiven Datenbank ausgeführt.
