const cell = value => '"'+String(value??'').replaceAll('"','""')+'"';
const calendar = instant => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
export function financeTimeCsv(times, approvals, houses, month, mapping) {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Ungültiger Monat');
 const approved=new Set(approvals.filter(a=>a.freigegeben===true && String(a.monat).slice(0,7)===month).map(a=>String(a.mitarbeiter_id)));
 const lines=['TinyTeam-ID;Datum;Minuten;Kostenstellennummer;Referenz;Freigabe'];
 let skipped=0;
 for(const t of times){
  if(!t.endzeit||!approved.has(String(t.mitarbeiter_id))){skipped++;continue;}
  const worked=calendar(t.startzeit); if(worked.slice(0,7)!==month)continue;
  const pause=Number(t.pause_minuten||0), elapsed=Math.round((Date.parse(t.endzeit)-Date.parse(t.startzeit))/60000),minutes=elapsed-pause;
  if(!Number.isFinite(elapsed)||elapsed<=0||!Number.isInteger(pause)||pause<0||!Number.isInteger(minutes)||minutes<=0||minutes>1440)throw Error('Ungültige Zeitbuchung '+t.id+' – zuerst in TinyTeam korrigieren.');
  if(!t.id||!t.mitarbeiter_id)throw Error('Quell-ID fehlt.');
  const house=houses.find(h=>String(h.id)===String(t.haus_id));
  const code=String(mapping[String(t.haus_id)]||'').trim();
  if(!house||!code||!/^[A-Za-z0-9_-]{1,20}$/.test(code))throw Error('Kostenstellennummer fehlt oder ist ungültig für '+(house?.name||t.haus_id));
  lines.push([t.mitarbeiter_id,worked,minutes,code,'tinyteam:'+t.id,'approved'].map(cell).join(';'));
 }
 return {csv:'\ufeff'+lines.join('\r\n'),count:lines.length-1,skipped};
}
export async function exportFinance(db, me, month, download){
 if(me?.rolle!=='admin')throw Error('Nur für Administration.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Monat wählen.');
 const start=new Date(month+'-01T00:00:00Z');start.setUTCDate(start.getUTCDate()-1);
 const end=new Date(month+'-01T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(2);
 const [staff,houses,approvals]=await Promise.all([db.from('mitarbeiter').select('id,name,aktiv').order('name'),db.from('haeuser').select('id,name,kurzname,aktiv').order('id'),db.from('zeiterfassung_freigaben').select('mitarbeiter_id,monat,freigegeben').eq('monat',month+'-01')]);
 for(const response of [staff,houses,approvals])if(response.error)throw Error(response.error.message);
 // Paginate explicitly: Supabase's default response limit must never silently drop time entries.
 const times=[];for(let page=0;page<100;page++){
  const response=await db.from('zeiterfassung').select('id,mitarbeiter_id,haus_id,startzeit,endzeit,pause_minuten').gte('startzeit',start.toISOString()).lt('startzeit',end.toISOString()).order('id').range(page*500,page*500+499);
  if(response.error)throw Error(response.error.message);times.push(...(response.data||[]));
  if((response.data||[]).length<500)break;if(page===99)throw Error('Zu viele Zeitbuchungen für diesen Export.');
 }
 const storeKey='tinyfinance-house-map:'+me.id;
 let mapping={};try{mapping=JSON.parse(localStorage.getItem(storeKey)||'{}')}catch{}
 for(const house of houses.data||[]){
  if(!times.some(t=>String(t.haus_id)===String(house.id)))continue;
  const value=prompt('TinyFinance-Kostenstellennummer für '+house.name+' ('+(house.kurzname||house.id)+'). Auch Allgemein braucht eine eigene Zuordnung.',mapping[String(house.id)]||'');
  if(value===null)return;mapping[String(house.id)]=value.trim();
 }
 const output=financeTimeCsv(times,approvals.data||[],houses.data||[],month,mapping);
 if(!output.count)throw Error('Keine abgeschlossenen und freigegebenen Zeiten im gewählten Monat.');
 localStorage.setItem(storeKey,JSON.stringify(mapping));
 download(new Blob([output.csv],{type:'text/csv;charset=utf-8'}),'TinyFinance_Zeiten_'+month+'.csv');
 // Reference list only: no invented personnel numbers, employment contracts or employer costs.
 const employees=['TinyTeam-ID;Name;Aktiv',...(staff.data||[]).map(e=>[e.id,e.name,e.aktiv!==false].map(cell).join(';'))];
 download(new Blob(['\ufeff'+employees.join('\r\n')],{type:'text/csv;charset=utf-8'}),'TinyFinance_Mitarbeiter_Zuordnung.csv');
 alert(output.count+' genehmigte Zeitbuchungen exportiert. '+output.skipped+' offene oder nicht freigegebene Einträge ausgeschlossen. Mitarbeiter zunächst in TinyFinance anlegen und TinyTeam-ID hinterlegen; danach Zeiten unter Dateiimporte prüfen/importieren.');
}
