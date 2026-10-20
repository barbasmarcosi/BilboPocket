import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, bilboRmSeries, nextPrescription, activeCycle } from '../site/core.js';
import { excelDate, scanBilboWorkbook, matchingExercise, planBilboImport } from '../site/excel-import.js';

const sheet=(name,raw)=>({name,rows:raw.map((cells,i)=>({number:i+1,cells}))});
const officialWorkbook=()=>({sheets:[sheet('Progresión Press Banca V15',[
  ['Nombre: Press de banca','1RM INICIO:',100],
  ['Fecha','Día','PESO','Repeticiones','trabajo','1RM'],
  ['27/11/2023',1,50,22,1100,83],
  ['',2,55,0,0,0],
  ['29/11/2023',3,60,22,1320,100],
  ['',4,65,'',0,0],
  ['01/12/2023',5,70,18,1260,108],
  ['CICLO 1 acumulado',null,null,62,3680,null],
  ['INCREMENTO',5],
  ['Fecha','Día','PESO','Repeticiones','trabajo','1RM'],
  ['04/12/2023',1,50,25,1250,87.5],
  ['CICLO 2 acumulado']
]) ]});
test('interpreta fechas Excel, locales e ISO sin aceptar fechas inválidas',()=>{
  assert.equal(excelDate(45257),'2023-11-27');
  assert.equal(excelDate('27/11/2023'),'2023-11-27');
  assert.equal(excelDate('2023-11-27'),'2023-11-27');
  assert.equal(excelDate('31/02/2024'),null);
  assert.equal(excelDate(''),null);
  assert.equal(excelDate(0),null);
  assert.equal(excelDate(1,true),'1904-01-02');
});
test('lee bloques V15, ciclos y excluye pesos planificados sin repeticiones',()=>{
  const scan=scanBilboWorkbook(officialWorkbook());
  assert.equal(scan.entries.length,4);
  assert.equal(scan.planned,2);
  assert.deepEqual(scan.entries.map(x=>x.cycleNumber),[1,1,1,2]);
  assert.deepEqual(scan.entries.map(x=>x.weight),[50,60,70,50]);
  assert.equal(scan.missingDates,0);
});
test('permite tablas genéricas con múltiples ejercicios, RIR y fecha de Excel',()=>{
  const scan=scanBilboWorkbook({sheets:[sheet('Mi entrenamiento',[
    ['Fecha','Ejercicio','Peso (kg)','Reps','RIR','Ciclo'],
    [45257,'Press banca',50,22,2,1],
    [45258,'Remo',70,12,1,2],
  ])]});
  assert.equal(scan.entries.length,2);
  assert.deepEqual(scan.entries.map(x=>x.date),['2023-11-27','2023-11-28']);
  assert.equal(scan.entries[1].exerciseName,'Remo');
  assert.equal(scan.entries[0].rir,2);
});
test('detecta ejercicio de una hoja clásica',()=>{
  const s=emptyState();
  assert.equal(matchingExercise('Progresión PRESS BANCA v15',s.exercises),'bench');
  assert.equal(matchingExercise('Sentadilla ciclo',s.exercises),'squat');
});
test('previsualización importa solo registros realizados y archiva ciclos',()=>{
  const state=emptyState(),scan=scanBilboWorkbook(officialWorkbook());
  const result=planBilboImport(state,scan,{fingerprint:'fixture-v15',mappings:{0:'bench'}});
  assert.equal(result.added,4);
  assert.equal(result.newCycles,2);
  assert.equal(result.state.sessions.length,4);
  assert.equal(state.sessions.length,0);
  assert(result.state.cycles.every(c=>c.status==='finished'));
  assert.deepEqual(bilboRmSeries(result.state.sessions,'bench').map(x=>x.estimatedRM),[83,99.6,107.8,87.5]);
  assert.equal(activeCycle(result.state,'bench'),null);
});
test('reimportar la misma planilla no duplica los entrenamientos ni ciclos',()=>{
  const scan=scanBilboWorkbook(officialWorkbook());
  const settings={fingerprint:'fixture-v15',mappings:{0:'bench'}};
  const first=planBilboImport(emptyState(),scan,settings);
  const second=planBilboImport(first.state,scan,settings);
  assert.equal(second.added,0);
  assert.equal(second.duplicates,4);
  assert.equal(second.newCycles,0);
  assert.equal(second.state.sessions.length,4);
});
test('no inventa fechas sin consentimiento expreso',()=>{
  const scan=scanBilboWorkbook({sheets:[sheet('Banca',[['Fecha','Día','Peso','Repeticiones'],['',1,50,20]])]});
  assert.equal(scan.missingDates,1);
  const state=emptyState();
  const skipped=planBilboImport(state,scan,{fingerprint:'f',mappings:{0:'bench'}});
  assert.equal(skipped.added,0);
  assert.equal(skipped.missingDate,1);
  const accepted=planBilboImport(state,scan,{fingerprint:'f',mappings:{0:'bench'},undatedDate:'2026-10-19'});
  assert.equal(accepted.added,1);
  assert.equal(accepted.state.sessions[0].date,'2026-10-19');
  assert.equal(accepted.state.sessions[0].entries[0].bilbo.importSource.dateAssigned,true);
  assert.equal(accepted.state.sessions[0].entries[0].bilbo.rir,null);
});
test('nunca reemplaza ni modifica los datos anteriores',()=>{
  const state=emptyState();
  state.sessions.push({id:'original',date:'2023-11-20',dayId:'push',entries:[]});
  const scan=scanBilboWorkbook(officialWorkbook());
  const imported=planBilboImport(state,scan,{fingerprint:'f',mappings:{0:'bench'}});
  assert.equal(state.sessions.length,1);
  assert.equal(imported.state.sessions[0].id,'original');
  assert.equal(imported.state.sessions.length,5);
});
test('no permite escanear planillas sin repeticiones realizadas',()=>{
  assert.throws(()=>scanBilboWorkbook({sheets:[sheet('v15',[['Peso','Repeticiones'],[50,0],[52.5,'']])]}),/No encontré/);
});

test('una misma hoja puede contener varios ejercicios correctamente',()=>{
  const scan=scanBilboWorkbook({sheets:[sheet('Gym',[
    ['Fecha','Ejercicio','Peso','Reps','RIR'],
    ['19/10/2026','Press de banca',50,23,2],
    ['19/10/2026','Remo con barra',70,12,2],
  ])]});
  const result=planBilboImport(emptyState(),scan,{fingerprint:'multisheet',mappings:{0:'bench'}});
  assert.equal(result.added,2);
  assert.deepEqual(result.state.sessions.map(x=>x.entries[0].exerciseId),['bench','row']);
});
