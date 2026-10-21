import ExcelJS from 'exceljs';
export type SourceSheet={name:string;rows:{row:number;cells:{address:string;column:number;value:string|number|boolean|null;formula?:string}[]}[]};
export type Snapshot={property_name:string;income:number|null;fixed_costs:number|null;expenses:number|null;result:number|null;source_row:number};
export async function readRental(buffer:Buffer){
 const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as any);
 const sheet=book.worksheets.find(s=>['übersicht','allgemein'].includes(s.name.trim().toLowerCase()));
 if(!sheet)throw new Error('Blatt Übersicht oder Allgemein fehlt.');
 const number=(row:number,col:number)=>{const c=sheet.getCell(row,col);const value=c.type===ExcelJS.ValueType.Formula?c.result:c.value;return typeof value==='number'&&Number.isFinite(value)?Math.round(value*100)/100:null};
 const headers=[['B2','Einnahmen'],['C2','Fixkosten'],['D2','Kosten'],['F2','Ergebnis']];
 if(headers.some(([cell,label])=>sheet.getCell(cell).text.trim()!==label))throw new Error('Spalten der Jahresübersicht weichen von der Vorlage ab. Bitte Zuordnung prüfen.');
 const rows:Snapshot[]=[];
 sheet.eachRow((row,index)=>{if(index<3)return;const name=row.getCell(1).text.trim();if(!name||/^(gesamt|summe|ergebnis)/i.test(name))return;
 rows.push({property_name:name,income:number(index,2),fixed_costs:number(index,3),expenses:number(index,4),result:number(index,6),source_row:index});});
 if(!rows.length||rows.length>100)throw new Error('Keine eindeutige Jahresübersicht gefunden.');
 const warnings:string[]=['Werte sind gespeicherte Excel-Ergebnisse; Formeln wurden nicht neu berechnet.','Fixkosten können Tilgung enthalten. Das Ergebnis ist kein steuerlicher Gewinn.','Leere Werte bleiben unbekannt und werden nicht als null Euro gewertet.'];
 const heading=sheet.getCell('A1').text;const years=book.worksheets.map(s=>({sheet:s.name,year:s.getCell('B1').text})).filter(x=>/^20\d{2}$/.test(x.year));
 const sheets:SourceSheet[]=book.worksheets.map(source=>{const sourceRows:SourceSheet['rows']=[];source.eachRow((row,index)=>{const cells:SourceSheet['rows'][number]['cells']=[];row.eachCell((cell,column)=>{if(cell.isMerged&&cell.master.address!==cell.address)return;const raw=cell.type===ExcelJS.ValueType.Formula?cell.result:cell.value;let value:string|number|boolean|null=null;if(typeof raw==='number')value=Number.isFinite(raw)?raw:null;else if(typeof raw==='string'||typeof raw==='boolean')value=raw;else if(raw instanceof Date)value=raw.toISOString().slice(0,10);else if(raw&&typeof raw==='object'&&'richText' in raw)value=raw.richText.map(t=>t.text).join('');else if(raw&&typeof raw==='object'&&'text' in raw)value=String(raw.text);else if(raw&&typeof raw==='object'&&'error' in raw)value=String(raw.error);if(value!==null||cell.type===ExcelJS.ValueType.Formula)cells.push({address:cell.address,column,value,...(cell.type===ExcelJS.ValueType.Formula?{formula:cell.formula}:{})});});if(cells.length)sourceRows.push({row:index,cells});});return {name:source.name,rows:sourceRows};});
 return {rows,warnings,heading,sheet:sheet.name,years,sheets,format_version:2};
}
