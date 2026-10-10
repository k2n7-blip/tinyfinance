# TinyFinance – Next.js / Supabase

Zusammenhängender Entwicklungsstand für Belege, Buchhaltung, Bankabgleich, Ferienvermietung, Personalvorbereitung und private Finanzen. Der bestehende Code wurde erweitert; die Produktion wurde nicht verändert.

Start im Verzeichnis tinyfinance-v2 mit Node 20+: npm ci, npm test, npm run typecheck, npm run build und npm run dev. Ohne Supabase-Konfiguration erscheint eine Einrichtungsseite; es werden keine Finanzdaten erfunden.

- [Testprojekt, Cloud-Setup und Vercel Preview](docs/INBETRIEBNAHME.md)
- [Implementierung, Tests und verbleibende Grenzen](docs/FUNKTIONEN_STATUS.md)
- [Architektur und Sicherheitsmodell](docs/ARCHITEKTUR.md)
- [Backup und Wiederherstellung](docs/BACKUP.md)

Migrationen zuerst im separaten Testprojekt anwenden. Ein erfolgreicher Build ersetzt keine vollständige fachliche und Sicherheitsabnahme. DATEV benötigt einen tatsächlichen Testimport mit der Kanzlei; Personal- und Steuerdaten sind Vorbereitung, keine zertifizierte Abrechnung oder Steuerabgabe.
