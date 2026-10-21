import type {SourceSheet} from './rental-import';
export type ExcelBatch={id:string;year:number;filename:string;payload:{sheets?:SourceSheet[]}};
export type Source={import_id:string;year:number;filename:string;sheet:string;cells:string};
export type HistoricalLoan={source:Source;lender:string;as_of:string;term:string;description:string;balance:number;payment:number|null;principal:number|null;interest:number|null;warning:string};
export type HistoricalMeter={source:Source;property:string;group:string;name:string;serial:string;readings:{period:string;value:string|number|boolean;cell:string}[];note:string};
export type HistoricalNote={source:Source;property:string;category:string;text:string};
const n=(s:string)=>Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);
export function excelRecords(batches:ExcelBatch[]){
 const loans:HistoricalLoan[]=[],meters:HistoricalMeter[]=[],notes:HistoricalNote[]=[];
 for(const batch of batches){for(const sheet of batch.payload.sheets||[]){
 const source=(cells:string):Source=>({import_id:batch.id,year:batch.year,filename:batch.filename,sheet:sheet.name,cells});
 const at=(row:SourceSheet['rows'][number],column:number)=>row.cells.find(c=>c.column===column);
 if(/^Kredite$/i.test(sheet.name)){
 let lender='',asOf='';
 for(const row of sheet.rows){const b=at(row,2),c=at(row,3),a=at(row,1);const label=String(b?.value||'');
 if(/sparkasse/i.test(label)){lender='Sparkasse';asOf=label;}
 if(/^VR$/.test(label.trim())){lender='VR';asOf='Stichtag für diesen Abschnitt nicht angegeben';}
 if(typeof b?.value==='number'&&typeof c?.value==='string'&&c.value.trim().startsWith('-')){
 const text=c.value;const match=text.match(/\(([^)]+)\)/);const parts=match?.[1].match(/\d+(?:[.,]\d+)?/g)?.map(n)||[];
 let payment:number|null=null,principal:number|null=null,interest:number|null=null;
 if(parts.length===3){[payment,principal,interest]=parts;}
 const warning=payment!==null&&principal!==null&&interest!==null&&Math.abs(payment-principal-interest)>.011?'Rate stimmt nicht mit Tilgung + Zinsen überein; Original prüfen.':'';
 loans.push({source:source(row.cells.map(c=>c.address).join(', ')),lender:lender||'nicht angegeben',as_of:asOf,term:String(a?.value??''),description:text,balance:b.value,payment,principal,interest,warning});
 }else if(/Marktwert|Beleihung|Finanzierung Freiraum/.test(label))notes.push({source:source(b!.address),property:label.split(' - ')[0],category:'Bewertung / Finanzierung',text:label});
 }
 }else{
 // Keep source notes verbatim: no inferred ownership, acquisition date, tax basis or valuation.
 for(const row of sheet.rows){if(row.row>3)break;for(const cell of row.cells){if(typeof cell.value==='string'&&/Kaufpreis|Abschreibung|AfA|Nießbrauch|Whg|Laufzeit|Ferienhaus|Baujahr|Bj\s*20/i.test(cell.value))notes.push({source:source(cell.address),property:sheet.name,category:/Abschreibung|AfA/i.test(cell.value)?'Abschreibung':/Kaufpreis/i.test(cell.value)?'Erwerb':/Laufzeit/i.test(cell.value)?'Vertrag':'Objektangabe',text:cell.value});}}
 let header:SourceSheet['rows'][number]|undefined,group='';
 for(const row of sheet.rows){
 if(String(at(row,3)?.value).trim()==='Zähler'){header=row;continue;}
 if(!header)continue;
 const serial=at(row,3),name=at(row,2);
 if(!serial&&typeof name?.value==='string'&&name.value.trim()){group=name.value.trim();continue;}
 if(!serial||serial.value===null||!/^\d[\w-]{4,}$/.test(String(serial.value)))continue;
 const readings=row.cells.filter(c=>c.column>=4&&c.value!==null).map(c=>({period:String(at(header!,c.column)?.value??'nicht bezeichnet'),value:c.value!,cell:c.address}));
 const note=!name?'Bezeichnung fehlt. Registerangaben im Original beachten.':/wasser|gas|strom/i.test(String(name.value))?'Maßeinheit und Zählertyp sind im Excel nicht verbindlich angegeben.':'Zählertyp und Rückstellung prüfen; keine automatische Verbrauchsdifferenz.';
 meters.push({source:source(row.cells.map(c=>c.address).join(', ')),property:sheet.name,group,name:String(name?.value||'Bezeichnung offen'),serial:String(serial.value),readings,note});
 }
 }
 }}
 const values=new Map<string,Set<string>>();
 for(const meter of meters)for(const r of meter.readings){if(!/^20\d{2}(?:-\d{2}-\d{2})?$/.test(r.period)||typeof r.value!=='number')continue;const key=meter.property+'|'+meter.serial+'|'+r.period.slice(0,4);const set=values.get(key)||new Set<string>();set.add(String(r.value));values.set(key,set);}
 for(const meter of meters){const conflicts=meter.readings.filter(r=>(values.get(meter.property+'|'+meter.serial+'|'+r.period.slice(0,4))?.size||0)>1).map(r=>r.period);if(conflicts.length)meter.note+=' Abweichende Quellwerte für den Jahresbezug '+[...new Set(conflicts)].join(', ')+'.';}
 return {loans,meters,notes};
}
