# TinyFinance – Einstellungen und Sicherheit

## Installation
1. Projektdateien in das bestehende private GitHub-Repository `tinyfinance` hochladen. Die Dateien liegen weiterhin im Ordner `tinyfinance-v2`.
2. In Supabase im SQL Editor **nur** `supabase/003_settings.sql` ausführen, sofern `001_initial.sql` bereits ausgeführt wurde. Nicht das initiale Schema erneut ausführen.
3. Supabase Authentication > URL Configuration: Site URL und Redirect URLs für die Vercel-Domain inklusive `/reset-password` konfigurieren. SMTP und E-Mail-Zustellung für Passwort-Reset prüfen.
4. In Vercel Root Directory `tinyfinance-v2` beibehalten, Variablen wie bisher. Deployment starten.
5. Nach dem Login unter Einstellungen Design, Schriftgröße, Kostenstellen, Passwortwechsel und MFA testen.

## Sicherheitsgrenzen
- MFA ist für den Nutzer aktivierbar, aber noch nicht serverseitig für alle sensiblen Endpunkte erzwungen. Vor echtem Finanzdatenbetrieb AAL2-Checks auf allen Server-Routen einbauen.
- Recovery-Code-/Admin-Recovery-Prozess fehlt; ohne diesen kann der Verlust des Authenticator-Geräts zur Kontosperre führen.
- Die bestehenden Datenbank-RLS-Policies und die Zuordnung organisationsübergreifender Fremdschlüssel müssen separat geprüft werden.
- Keine GoBD-Freigabe; bestehende CSV-Prüfliste ist kein DATEV-Buchungsstapel.
- Die App enthält noch keine produktive KI-Belegerkennung.
