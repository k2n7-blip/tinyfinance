import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {readRental} from '../../lib/rental-import';
test('rental source preserves every sheet, formula result, empty value and cell provenance',async()=>{
 const book=new ExcelJS.Workbook();const overview=book.addWorksheet('Übersicht');overview.getCell('A1').value='2024';
 for(const [address,value] of Object.entries({B2:'Einnahmen',C2:'Fixkosten',D2:'Kosten',F2:'Ergebnis',A3:'Haus',B3:100,C3:20,D3:10}))overview.getCell(address).value=value;
 overview.getCell('F3').value={formula:'B3-C3-D3',result:70};
 const detail=book.addWorksheet('Haus');detail.getCell('B8').value=123.456;detail.getCell('D8').value={formula:'B8*2',result:246.912};detail.mergeCells('A1:C1');detail.getCell('A1').value='Originalnotiz';detail.getCell('E10').value={richText:[{text:'AfA '},{text:'offen'}]};
 const result=await readRental(Buffer.from(await book.xlsx.writeBuffer()));
 assert.equal(result.rows[0].result,70);assert.equal(result.sheets.length,2);
 const source=result.sheets[1];assert.equal(source.rows.find(r=>r.row===8)?.cells.find(c=>c.address==='B8')?.value,123.456);
 assert.equal(source.rows.find(r=>r.row===8)?.cells.find(c=>c.address==='D8')?.formula,'B8*2');
 assert.equal(source.rows.find(r=>r.row===1)?.cells.length,1);
 assert.equal(source.rows.find(r=>r.row===10)?.cells[0].value,'AfA offen');
});
