# TinyFinance Sammelupdate

**Einspielen:** Inhalt von `tinyfinance-v2` ins gleichnamige GitHub-Verzeichnis übernehmen. Vercel Root Directory bleibt `tinyfinance-v2`. Nicht einfach das ZIP als Unterordner hochladen.

**Datenbank:** 001_initial.sql muss bereits installiert sein. Falls noch nicht geschehen, 003_settings.sql und danach 004_finance_modules.sql im Supabase SQL Editor ausführen. 004 ist nur das Datenmodell für spätere Module.

**Vercel Environment Variables:** NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY (bereits vorhanden). Optional `OPENAI_API_KEY` als Secret für serverseitige KI-Extraktion. Optional `OPENAI_MODEL` als Config (Standard gpt-4.1-mini). Nach Änderung redeployen.

**Neu:** Dokument öffnen, Daten korrigieren, Prüfstatus und Kostenstelle speichern, KI-Erkennung manuell auslösen. Der Upload selbst startet keine KI, damit Kosten und Datenschutz kontrollierbar bleiben.

**Prüfablauf:** Login → Beleg hochladen → Original öffnen → Daten ändern → speichern → Seite neu laden → Daten erhalten? → KI nur bei API-Key → RLS mit zweitem Nutzer testen.

**Wichtig:** Nicht alle diskutierten Module sind funktionsfähig; siehe docs/FUNKTIONEN_STATUS.md. DATEV und Lohn bleiben Vorbereitung. Kein Ersatz für Steuerberater oder zertifizierte Lohnabrechnung. Build und Laufzeit müssen vor Produktion separat getestet werden.
