import ExcelJS from 'exceljs';
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
 return {rows,warnings,heading,sheet:sheet.name,years};
}
