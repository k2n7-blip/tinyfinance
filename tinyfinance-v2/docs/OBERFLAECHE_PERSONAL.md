# Oberfläche und Personal

Die bereitgestellte Quitt-Ansicht dient als Strukturreferenz: feste Seitenleiste, Suche in der Kopfzeile, helle Flächen, ruhiger grüner Akzent und übersichtliche Kennzahlen. Bestehende TinyFinance-Funktionen bleiben erreichbar; die Navigation klappt auf kleinen Bildschirmen auf.

Personal unter /personnel zeigt vorhandene Mitarbeiter mit Personalnummer, Beschäftigungsart und externer TinyTeam-ID. Monatswahl, Gesamtstunden, freigegebene Stunden und Aufteilung nach Kostenstellen lesen die bestehenden Tabellen employees und time_entries. Freigabestatus für diese Ansicht: approved. Keine direkten Lohnzahlungen oder externe Übertragungen.

Die konkrete TinyTeam-Quellanwendung und ihre Schnittstelle sind nicht verfügbar. Deshalb keine vorgetäuschte Synchronisation. Für die tatsächliche Verbindung werden TinyTeam-Projekt/Quellcode und dessen Export- oder API-Struktur benötigt. Noch kein neuer Zeitimport oder DATEV-Lohnexport implementiert.

Keine Quitt-Kontostände oder Beispielzahlen übernommen. Typecheck und Next.js-Build prüfen die Implementierung; Browser- und Live-Datenprüfung bleiben ausstehend.
