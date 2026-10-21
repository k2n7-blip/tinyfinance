# Globale Suche und Holidu-Sammelbuchung

Migration `006_holidu_search.sql` nach 001–005 ausführen. Navigation: Globale Suche und Holidu 2026.

## Suche
Sucht mit bestehenden RLS-Rechten über Belege, Bankumsätze, Kostenstellen, Immobilien, Kredite, Jahresimporte, Versorgung, Holidu-Abrechnungen und interne Holidu-Journale. Literalteilstring, 50 Treffer pro Seite. PDF-Inhalte sind ohne gespeicherten Volltext nicht durchsuchbar.

## Arbeitsablauf
1. Original hochladen, prüfen und Status „Geprüft“ setzen. Tatsächlichen Bankumsatz importieren.
2. Holidu-Abrechnung, 2026-Datum, Original, Bank, Kostenstelle und tatsächliches Bank-Sachkonto zuordnen. Gastbetrag, Nettoprovision, ausgewiesene Vorsteuer und Auszahlung eintragen. Gebühren als gemeinsame Nettoprovision.
3. Steuerbehandlung am Original bestätigen: voller Gastbetrag 7 %, Gebühren mit ausgewiesener deutscher Vorsteuer 19 %. Vorschau prüfen und Entwurf speichern.
4. Filtern, sichtbare offene Entwürfe markieren und Summen prüfen. Maximal 100 je atomarer Sammelbuchung; Listen enthalten bis zu 1.000 neueste Einträge je Datenart.
5. Auswahl ausdrücklich bestätigen und intern buchen. Journalzeilen sind danach einsehbar.

Vorlagenversion: annette-holidu-2026-v1. Erlös 4300, Aufwand 6600, Bankkonto vom Nutzer. Steuerzeilen sind semantisch benannt: konkrete Steuerkonten und DATEV-Steuerschlüssel noch nicht eingerichtet. Keine Übertragung an Lexware/DATEV und kein fertiger DATEV-Stapel.

## Prüfungen und Grenzen
- Ganzzahlige Centbeträge; Gastbetrag minus Gebühren muss exakt Auszahlung ergeben. Ausgewiesene Vorsteuer bleibt erhalten und darf höchstens einen Cent von 19 % abweichen.
- Erlös netto aus Brutto gerundet; Umsatzsteuer als ausgleichender Restbetrag.
- Original, Bank und Kostenstelle derselben Organisation; nur owner/bookkeeper schreiben.
- Buchungsfunktion sperrt Datensätze und prüft alle Belege samt Originalstatus und Bankbetrag. Bei Fehlern vollständiger Transaktionsabbruch. Bestehende Buchungen oder bestätigte Bankzuordnung blockieren.
- Eindeutige Zuordnung pro Abrechnung, Original und Bankumsatz. Keine direkte Änderung der Journalzeilen. Korrektur-/Stornofunktion noch offen.
- Kein Storno, Reverse Charge, gemischter Steuersatz, Nullauszahlung oder Sammelauszahlung mit dieser Vorlage.
- Das Nutzerbeispiel wurde lokal durchgerechnet. Ohne Original und tatsächliche Bankzuordnung wurde kein echter Beleg gebucht. Private Quelldaten bleiben außerhalb des Repositorys.

## Validierung
TypeScript und Next.js-Produktionsbuild erfolgreich. Rechenbeispiel lokal geprüft; reproduzierbarer Test: `npm run test:holidu`. Migration und Buchungsfunktion lokal mit PGlite getestet: ausgewogenes Journal, Doppelbuchung, atomarer Abbruch bei falschem Bankbetrag, fremde Organisation und gesperrte direkte Journalschreibzugriffe. Produktive Supabase-Anbindung und Browserbedienung noch nicht geprüft.
