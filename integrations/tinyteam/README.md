# TinyTeam → TinyFinance

Für die hochgeladene TinyTeam-Version 13.3.3 ist ein Exportadapter vorbereitet. Er nutzt die vorhandene Admin-Anmeldung und Supabase-Berechtigungen. Kein zusätzlicher Schlüssel und kein Service-Role-Key werden im Browser benötigt.

1. `tinyfinance-export.mjs` neben `app.js` in TinyTeam ablegen.
2. In der Monatsbericht-Ansicht diesen Button ergänzen:

```html
<button onclick="exportTinyFinance()">Für TinyFinance exportieren</button>
```

3. Folgende Funktion an `app.js` anhängen:

```js
async function exportTinyFinance(){
  try {
    const adapter=await import('./tinyfinance-export.mjs');
    await adapter.exportFinance(db,me,document.getElementById('rm')?.value,downloadBlob);
  } catch(e){alert(e.message||'Export fehlgeschlagen.');}
}
```

4. TinyTeam über den bisherigen Vercel-Upload-Prozess neu bereitstellen. Es gibt keine neue Datenbankmigration für TinyTeam.
5. Im Monatsbericht Monat wählen, Zeiten prüfen/freigeben, „Für TinyFinance exportieren“ wählen und Haus → TinyFinance-Kostenstellennummer bestätigen. „Allgemein“ ebenfalls explizit zuordnen. Die Zuordnung wird je Admin in diesem Browser gespeichert.
6. Mitarbeiter in TinyFinance unter Mitarbeiter anlegen und die IDs aus `TinyFinance_Mitarbeiter_Zuordnung.csv` als externe TinyTeam-ID hinterlegen. Personalnummer, Beschäftigungsart und tatsächliche Arbeitgeberkosten separat prüfen. Die Mitarbeiterdatei ist eine Zuordnungsliste, kein automatischer Stammdatenimport.
7. Zeitdatei unter TinyFinance → Dateiimporte → TinyTeam-Zeiten zunächst prüfen und dann importieren. Identische Quellen werden übersprungen; veränderte bestehende Zeiten werden als Konflikt abgelehnt.

Der Export enthält nur abgeschlossene Zeiten freigegebener Mitarbeiter-Monate. Kalenderdatum und Freigabemonat folgen Europe/Berlin. Ungültige Zeiten werden nicht still korrigiert. Es wird kein Lohn aus dem Stundenlohn berechnet. Die Adapterdatei lädt keine Notizen, Adressen oder Zugangsdaten. Dies ist eine monatliche Datei-Schnittstelle; keine laufende Server-Synchronisation. Noch nicht auf dem echten TinyTeam-Deployment ausgeführt.
