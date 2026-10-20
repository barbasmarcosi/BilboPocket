import test from 'node:test';
import assert from 'node:assert/strict';
import { readExcelWorkbook } from '../site/excel-reader.js';
import { scanBilboWorkbook } from '../site/excel-import.js';

test('CSV exportado desde Excel se lee sin enviar datos a la red',async()=>{
 const csv='Fecha;Ejercicio;Peso;Repeticiones;RIR\n19/10/2026;Press de banca;52,5;22;2\n20/10/2026;Press de banca;55;20;2\n';
 const file=new File([csv],'bilbo.csv',{type:'text/csv'});
 const book=await readExcelWorkbook(file);
 const scan=scanBilboWorkbook(book);
 assert.equal(book.kind,'csv');
 assert.equal(scan.entries.length,2);
 assert.equal(scan.entries[0].weight,52.5);
 assert.equal(scan.entries[1].date,'2026-10-20');
});
test('rechaza formato Excel antiguo y extensiones ajenas con errores explicativos',async()=>{
 await assert.rejects(()=>readExcelWorkbook(new File(['legacy'],'viejo.xls')),/\.xls antiguo/);
 await assert.rejects(()=>readExcelWorkbook(new File(['invalid'],'otro.pdf')),/Seleccioná un archivo/);
});
test('rechaza un XLSX que no es un ZIP',async()=>{
 await assert.rejects(()=>readExcelWorkbook(new File(['not a zip'],'falso.xlsx')),/no es un Excel XLSX/);
});
test('CSV con comillas y separadores embebidos no desconfigura columnas',async()=>{
 const file=new File(['Fecha,Ejercicio,Peso,Reps\n2026-10-19,"Press, banca",50,22\n'],'comillas.csv');
 const result=await readExcelWorkbook(file);
 assert.deepEqual(result.sheets[0].rows[1].cells,['2026-10-19','Press, banca','50','22']);
});
