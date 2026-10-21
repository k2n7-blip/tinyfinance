# Sicherung und Wiederherstellung

Verantwortlich ist der Betreiber; eine Datenbankmigration installiert keinen Backupdienst. Vor Echtdaten einen extern überwachten Sicherungsplan festlegen.

- PostgreSQL: Supabase-Backups/PITR passend zum Tarif aktivieren; zusätzlich verschlüsselten logischen Export mit Schema, Daten, Rollen-/Berechtigungsdefinitionen und Migrationsstand an getrenntem Ziel sichern.
- Storage: sämtliche Originalobjekte des privaten documents-Buckets separat sichern, zusammen mit Pfad, SHA-256 und Datenbankzuordnung. Datenbankbackups enthalten keine Objektbytes.
- Auth: Supabase-konformes Wiederherstellungsverfahren einschließlich Benutzer/Faktoren verwenden. Keine privaten Schlüssel oder MFA-Geheimnisse in Git speichern.
- Datenbank und Objekte zeitlich konsistent sichern; Wartungsfenster oder abgestimmten Snapshot wählen. Aufbewahrung, Löschsperren, Verschlüsselung, getrennte Schlüssel und Alarm bei fehlender Sicherung festlegen.

Wiederherstellungsprobe in einem neuen isolierten Projekt: Datenbank und Policies einspielen, Storagebytes an identischen Pfaden wiederherstellen, alle Originalhashes überprüfen, fehlende/verwaiste Objekte melden, Rollen- und AAL2-Tests durchführen, Stichproben von Journal, Storno, Abgleich und Exportartefakten prüfen. Erst nach dokumentierter Abnahme umschalten. Recovery-Zeit und tolerierten Datenverlust messen.

Unterbrochene Uploads können eine uploading/failed-Zeile und ein bereits vorhandenes Objekt hinterlassen. Erneuter Upload derselben Datei prüft bei einem vorhandenen Objekt dessen SHA-256 und schließt die Reservierung ab, ohne Originale zu überschreiben. Bei abweichenden oder verwaisten Objekten muss ein Administrator die Zuordnung im Wartungsverfahren untersuchen. Dieser Wiederaufnahmeablauf muss noch gegen echtes Supabase Storage geprüft werden.

Audit- und Originalschutz wirken für normale Anwendungsrollen. Supabase-Projektadministratoren können Datenbank und Storage technisch verändern. Unabhängige, unveränderbare Sicherungen und eine GoBD-Verfahrensdokumentation bleiben erforderlich. Eine Wiederherstellungsprobe gegen ein echtes Supabase-Projekt wurde in dieser Cloud-Umgebung noch nicht durchgeführt.
