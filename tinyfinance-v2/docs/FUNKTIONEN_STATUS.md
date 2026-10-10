# Implementierung und Prüfstand

## Implementiert
- Responsive Oberfläche, Navigation nach Rollen, Hell/Dunkel/System und Schriftgröße.
- Supabase-Sitzungen, Anmeldung, TOTP, Passwortreset und Passwortänderung; verpflichtendes Administrator-AAL2 in Anwendung und Datenbank.
- Organisationsauswahl, Rollenverwaltung, private und Personalberechtigungen, Composite Foreign Keys, RLS, serverseitige Fehlerbehandlung und Audit-Trigger.
- Mehrfachupload, Originalhash und Speicherung ohne Überschreiben, PDF/Bildvorschau, manuelle Pflichtfeldprüfung, opt-in KI-Vorschläge, Suche und Historie.
- Konten/Kostenstellen, Vorschlagsentwurf, Cent-genaue Aufteilung, Freigabe, unveränderbare freigegebene Buchungen, verknüpfte Gegenbuchung.
- DATEV EXTF-Format, Windows-1252-Prüfung, Generalumkehr, KOST1-Splits, Original-ZIP, unveränderbare Exportartefakte und Download.
- CSV/CAMT.053/MT940-Bankimporte, Wiederholungsprüfung, Teilzahlungen, Plattformabgleich und Eigenüberträge.
- Plattform-Abrechnungen über normalisierte CSV, nativen Holidu-Buchungs-CSV (bis 2000 Zeilen, direkte Spaltenzuordnung, stornierte/abweichende Zeilen gesondert prüfen) oder Holidu-Text-PDF mit Provisionsrechnung und Auszahlungsteil (lokale Texterkennung, bis 200 PDFs pro Stapel, geprüfte Vorschau, eindeutige Ferienhauszuordnung über ID/Name und im Browser je Konto/Mandant gespeicherte Zuordnungen, gemeinsamer CSV-Export, atomarer Stapelimport mit Dublettenprüfung; Original zusätzlich als Beleg archivieren). Andere PDF-Formate und Scans werden abgewiesen. Genehmigte TinyTeam-Zeitdaten über normalisierte CSV; Personalstammdaten, Zeiten, Abwesenheiten, Lohnvorbereitung.
- Private Stammdaten und Auswertungen für Immobilien, Mietvorgänge, Zinsen, Kredite, Versicherungen, Renten, Vermögen und Fristen.
- Auswertungen für Journal, offene Posten, Kostenstellen, aufgezeichnete Umsatzsteuer, Zahlungs- und Liquiditätsvorbereitung; Prognosen zeigen ihre Annahmen.

Einrichtungsfehler unterscheiden jetzt fehlende Umgebungswerte von fehlenden Datenbankmigrationen; die Einrichtungsseite zeigt nur Anwesenheitsstatus, keine Schlüsselwerte.

KI-Opt-in wird separat von DATEV-Einstellungen gespeichert; Berater- und Mandantennummer sind dafür nicht erforderlich. Versionsprüfung und Administrator-MFA bleiben erforderlich.

Der KI-Button bleibt bei deaktivierter Erkennung sichtbar und erklärt die fehlende Aktivierung. Fortschritt und Anbieterfehler erscheinen direkt am Beleg; Fehlermeldungen unterscheiden Schlüssel, Berechtigung, Guthaben und Anfragelimit, ohne Anbieter-Rohdaten auszugeben.

## Automatisiert geprüft
45 fachliche Tests: exakte Geldbeträge, Pflichtfelder und Null-USt, Berechtigungsmodell, Importspezifika und Fehlerfälle, DATEV-Formatvalidierung und Storno, Kostenstellenaufteilung, Zins-/Kreditprognosen und offene Posten.
47 PostgreSQL-17-Assertions wenden alle tatsächlichen Migrationen außer 002 an: Organisationsgrenzen, Rollen, Administrator-MFA-Claims, private/Personal- und Storage-Policies, Originalschutz, Audit-Manipulation, Versionskonflikte, Freigabe/Storno, Abgleiche, idempotente und atomare Importe sowie ungültige Zahlen.
Zwei Chromium-Smoke-Tests prüfen die fehlende Konfiguration, gesperrte Finanz-APIs, Ursprungskontrolle und Smartphone-Layout. Sie prüfen keine angemeldeten Finanzabläufe.
TypeScript und Produktionsbuild erfolgreich. Aktueller npm-Audit der Produktionsabhängigkeiten ohne bekannte Schwachstellen nach PostCSS-Override.

## Noch nicht abgenommen
Echte Supabase-Auth-/Storage-Integration, angemeldete Browserabläufe, echte KI-Antworten, Passwort-E-Mail-Zustellung, Kanzlei-Testimport, reale Plattform-/TinyTeam-Dateiformate, Vercel-Preview und Wiederherstellungsprobe. Nicht als fertig getestet markieren.

## Fachliche Grenzen
Keine GoBD-Zertifizierung, kein WORM-Archiv, kein Malware-Scanner, keine ELSTER-Abgabe, keine zertifizierte Lohnabrechnung. DATEV-Formatvalidator ersetzt keinen Kanzlei-Testimport.
Journal-Einnahmen/Ausgaben verwenden Bruttowerte; Steuerabzugsfähigkeit und EÜR-/Anlage-V-Einordnung benötigen fachliche Bestätigung. Umsatzsteuerbericht ist Vorbereitung aus erfassten Belegen, kein vollständiges Steuerregelsystem.
Buchungsfreigabe derzeit nur EUR. Fremdwährungen werden nicht automatisch umgerechnet. Auslastung zeigt erfasste Nächte, keine belastbare Quote ohne verfügbare Vermietungstage.
Kontierung ist eine manuelle Auswahl bestätigter Konten, keine automatische SKR-Klassifikation. Betrags-/Datumsabgleich liefert Vorschläge, keine ungeprüfte automatische Zuordnung.
Zinsprognosen: Actual/365, bekannte Zinsänderungen und Fälligkeit, keine unbekannten Zinseszinsen. Kredite: monatliche Zinsen und konstante eingegebene Rate. AfA basiert auf eigenen Eingaben, nicht automatischer Rechtsprüfung.

Plattformwerte werden im Überblick und getrennt je Ferienhaus in den Auswertungen angezeigt. Stornierte Abrechnungen sind ausgeschlossen; historische Aufenthalte lassen sich über einen Link vollständig auswählen. Holidu-Dubletten nach Buchungsreferenz werden zur Prüfung angezeigt, ohne Löschung oder zusätzliche Journal-/Steuerbuchungen. PDF-, native CSV- und Vorlagenimporte verwenden denselben Abgleich mit vorhandenen Referenzen; identische Inhalte überspringt die bestehende transaktionale RPC, abweichende Inhalte brechen den Import ab. Gleichzeitig erstmals importierte unterschiedliche PDF/CSV-Referenzen sind ohne zusätzliche Datenbanksperre nicht vollständig gegen Wettläufe abgesichert.
