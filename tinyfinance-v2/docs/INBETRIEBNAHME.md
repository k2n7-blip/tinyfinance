# Testbetrieb und Freigabe

Dieser Branch erweitert den vorhandenen Code. Er ist ein Entwicklungsstand zur Abnahme. Keine Migration wurde auf dem produktiven Supabase-Projekt ausgeführt.

## Reproduzierbare Cloud-Umgebung
Arbeitsverzeichnis: tinyfinance-v2. Node 24 wurde geprüft; unterstützt wird Node ab 20.
1. npm ci --cache /workspace/.npm-cache
2. npm test
3. npm run typecheck
4. npm run test:db (Docker erforderlich; eigener PostgreSQL-17-Container ohne Netzwerk, automatische Löschung)
5. npm run build
6. npm run dev -- --hostname 0.0.0.0
Keine zusätzliche Git-Worktree nötig: jeder Cloud-Auftrag hat eine isolierte Umgebung.
npm run test:e2e prüft ausschließlich die Installation OHNE Supabase-Konfiguration und benötigt Chromium unter /usr/bin/chromium oder CHROMIUM_PATH. Für einen konfigurierten Betrieb ist diese Smoke-Suite nicht geeignet.

## Separates Supabase-Testprojekt
1. Eigenes Projekt mit derselben geeigneten Region wie der spätere Betrieb erstellen. Niemals die produktive Datenbank für Preview verwenden.
2. In einer Sicherungskopie bestehender Daten vorab prüfen: doppelte Beleg-Hashes, organisationsfremde Referenzen, unvollständige Rechnungsdaten, ungültige Zahlen und unbekannte Rollen. Die Migrationen brechen bei unvereinbaren Bestandsdaten ab; Daten nicht blind löschen oder umdeuten.
3. SQL-Dateien 001, 003, 004 und 005–013 in numerischer Reihenfolge anwenden. 002_setup_example.sql ist ein historisches Beispiel mit Platzhaltern und wird NICHT ausgeführt. Die neuen Migrationen sind einmalige Migrationen, keine beliebig wiederholbaren Setup-Skripte.
4. Authentication: öffentliche Registrierung deaktivieren; Benutzer über Supabase einladen/anlegen. Site URL und erlaubte Redirect URLs auf die konkrete Test- bzw. Preview-Adresse setzen; /auth/callback hinzufügen. SMTP für Passwortwiederherstellung konfigurieren.
5. NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY als sichere Umgebungseinträge hinterlegen. Der zweite Wert ist ein öffentlicher Anon-/Publishable-Key. Service-Role-Schlüssel niemals im Frontend oder in NEXT_PUBLIC_* verwenden.
6. Anmeldung → Einstellungen → Authenticator registrieren und Code bestätigen → Organisation anlegen. create_organization benötigt eine echte AAL2-Sitzung und legt die fünf gewünschten Kostenstellen an.
7. Administrator bestätigt Kontenrahmen, Konten, Kontenlänge, Berater-/Mandantennummer und Wirtschaftsjahr mit der Kanzlei. DATEV zunächst als Testdatei exportieren; tatsächlichen Kanzlei-Testimport erst nach erfolgreicher Prüfung bestätigen.

## Vercel Preview
Das bestehende Vercel-Projekt muss GitHub-Preview-Deployments für den neuen Branch erlauben. Root Directory: tinyfinance-v2; Build: npm run build.
Preview-spezifisch die URL und den öffentlichen Schlüssel des separaten Supabase-Testprojekts sowie TINYFINANCE_ENVIRONMENT=test setzen. Die Build-Sperre verlangt diesen Marker; der Betreiber muss zusätzlich kontrollieren, dass die URL tatsächlich zum Testprojekt gehört.
Die Produktionsvariablen und den Produktionsbranch unverändert lassen. Ein PR-Deployment ohne diese Voraussetzungen wird bewusst nicht als funktionsfähig bezeichnet.

## Optionale externe Dienste
- KI: OPENAI_API_KEY ausschließlich serverseitig; optional OPENAI_MODEL. Zusätzlich unter Organisationseinstellungen die Verarbeitung aktivieren. Kosten, AVV, Region und Übermittlung echter Finanzdaten vorher prüfen. Ohne Schlüssel bleibt manuelle Belegprüfung verfügbar. KI-Vorschläge werden separat gespeichert und ausdrücklich übernommen.
- Plattformen: normalisierte CSV-Vorlagen unter Importe. Holidu/Booking/Airbnb-Rohformate müssen anhand tatsächlicher Exporte in das dokumentierte Format überführt werden. Keine direkte API-Verbindung implementiert.
- TinyTeam: genehmigte Zeitdaten anhand der CSV-Vorlage; externe Mitarbeiter-ID und aktive Kostenstellen müssen vorhanden sein. Keine behauptete TinyTeam-API.
- Personal: CSV-Unterlagen für die Kanzlei; kein zertifizierter DATEV-Lohnimport und keine eigenständige Lohnabrechnung.
- Keine ELSTER-, CHECK24- oder Zahlungsdienst-Schnittstelle.

## Abnahme vor Echtdaten
Im realen Testprojekt mit zwei Organisationen und allen Rollen durchführen: Anmeldung/MFA/Passwortreset; Upload und Originaldownload; parallele Bearbeitung; Freigabe/Storno; private und Personalzugriffe einschließlich direkter Storage/REST-Aufrufe; Wiederholungsimporte; Teilzahlungen und Umbuchungen; DATEV-Testimport; Backup-Wiederherstellung.
Die isolierten SQL-Tests prüfen reale PostgreSQL-Policies, Trigger und RPCs mit Test-JWT-Claims. Sie ersetzen keine Prüfung von GoTrue, PostgREST und Supabase Storage im Zusammenspiel.
