# TinyFinance — umfassender Bauplan und Abnahme

## Ziel
Private, intern genutzte Finanz- und Buchhaltungsvorbereitung. Keine eigene Steuerberatung oder gesetzlich verbindliche Lohnabrechnung. 2026 bleibt der bisherige Steuerberater verantwortlich, Übergang frühestens nach Tests 2027.

## Daten- und Rollenmodell
- Organization: betrieblicher Mandant; später getrennte weitere Unternehmen. Steuerpflichtige und private Vermietung als eigene `tax_subjects`; keine Vermischung von steuerlichen Buchungskreisen.
- `memberships`: owner, bookkeeper, advisor_read, advisor_review. Auth per Supabase; Rollen über RLS.
- Dokumente: unveränderliche Originale, Hash, Rechnungseigenschaften, Zuordnung, Review; spätere Belegversionen und Belegketten erforderlich.
- Bank: importierte Originalumsätze, eindeutige Referenzen, Matching; keine Zahlungsauslösung.
- Buchungen: Entwurf, geprüft, freigegeben, exportiert; Soll/Haben, Steuerlogik, Periodensperren und Kostenstellen-Splits nach Kanzleivorgaben.
- Personal: TinyTeam externe IDs, Zeiten, Freigaben, Abwesenheiten, Lohnarten, Monatsabschlüsse; keine Meldungen ohne zugelassenes Lohnsystem.
- Vermögen: Konten, Freistellungsaufträge, Zinsen, Kapitalertragsteuer, Immobilien, Darlehen, Versicherungen, Renteninformationen.

## Vorgesehene Verarbeitung
1. Upload: Dateisignatur, SHA-256, Organisation, private Speicherung, Dublette bei identischem Inhalt.
2. KI-Auslesung (noch nicht gebaut): asynchron, OCR und strukturierte Felder mit Quelle/Confidence; datensparsame EU-Verarbeitung und AVV prüfen.
3. Dubletten (später): gleiche Rechnungsnummer + Lieferant + Betrag; keine automatische Löschung.
4. Kontierung (später): Kanzlei-bestätigter SKR03/04-Kontenplan, USt-Regeln, Objekt-Zuordnung und Prüfstatus; niemals KI automatisch freigeben.
5. Holidu/Booking (später): Buchung und Haus, Bruttoumsatz, Gebühren, Storno, Erstattung, Auszahlung, Steuer; getrennte Nachweise und Clearing-Konto.
6. Bank (CSV-Basis gebaut): später CAMT.053/MT940 und Abgleich nach Betrag, Datum, Gegenpartei, Verwendungszweck; Mehrfach-/Teilzahlungen.
7. DATEV (später): Format und Mandanten-/Beraternummer mit Kanzlei festlegen, Rechnungswesen Buchungsstapel plus Belegbilder und Kostenstellen testen; derzeit nur Prüfliste CSV.
8. Lohn (später): TinyTeam -> freigegebene Zeitdaten -> DATEV-kompatible Bewegungsdaten/CSV -> Kanzlei oder Lohnsoftware -> endgültige Kosten zurück. Krankenkassen, DRV, Minijob-Zentrale, Finanzamt über zertifiziertes System.
9. Privat (später): Mietobjekte, Anlage V, AfA, Zinsen, Kapitalerträge, gemeinsame ESt, Belege und Fristen. Keine bestätigte CHECK24-API.

## Noch erforderliche Schutzmaßnahmen vor Echtdaten-Produktivbetrieb
- Cross-tenant Foreign Keys und Rollenrechte über alle Relationen hart absichern; RLS-Penetrationstests, keine offenen Policies.
- Schreibschutz und Unveränderbarkeit der Originale, Aufbewahrung/Löschkonzept, revisionssichere Auditierung, Export- und Wiederherstellungstests, GoBD-Verfahrensdokumentation.
- Datenschutz-Folgenprüfung soweit erforderlich, AVV, Hosting-Region, Subprozessoren, MFA, Einladungs-/Entzugsprozess, Zugriff auf sensible Mitarbeiterdaten gesondert.
- Storage-Virenscan und PDF-Sanitization, Upload-Ratenbegrenzung, Monitoring, Alarmierung, Fehlerbehandlung, periodische Datenbankbackups.
- DATEV-Testimport, Abstimmung Kontenrahmen, Umsatzsteuer und Kanzleifreigabe.

## Abnahmetests vor produktivem Einsatz
- Ein Beleg zwei Mal hochladen -> Dublettenwarnung; zwei unterschiedliche Belege mit gleicher Summe -> nicht fälschlich gesperrt.
- Fremdnutzer und Beraterrolle -> kein Zugriff auf nicht freigegebene Bereiche oder Upload; Supabase Storage RLS testen.
- CSV mit deutscher Dezimaldarstellung, doppelte Referenz, fehlerhafte Zeile, negative Beträge, Export Excel prüfen.
- Holidu-Sammelauszahlung auf drei Häuser + Plattformgebühr + Erstattung abstimmen.
- DATEV-Import bei Kanzlei ohne Feldverschiebung und mit Belegverknüpfung bestätigen.
- Monatsabschluss, Änderungshistorie, Storno, Backups und Wiederherstellung demonstrieren.
