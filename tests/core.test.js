import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, activeCycle, nextPrescription, workoutForDay, finalizeWorkout, sessionVolume, weeklyVolume, validateBackup, localDate, estimateBilbo1RM, bilboRmSeries } from '../site/core.js';
const withCycle = () => { const s=emptyState(); s.cycles.push({id:'c1',exerciseId:'bench',status:'active',startLoad:50,increment:2.5,minReps:15}); return s; };
const done = (reps, rir=2, speed='explosiva') => ({ id:'s',date:localDate(),dayId:'push',entries:[{exerciseId:'bench',bilbo:{cycleId:'c1',weight:50,reps,rir,speed},extras:[{weight:40,reps:10,rir:2}]}]});
test('el estado inicial no inventa sesiones',()=>assert.equal(emptyState().sessions.length,0));
test('inicio del ciclo prescribe carga inicial',()=>assert.equal(nextPrescription(activeCycle(withCycle(),'bench'), []).weight,50));
test('aumenta únicamente tras serie suficiente y controlada',()=>assert.deepEqual([nextPrescription(withCycle().cycles[0],[done(25)]).status,nextPrescription(withCycle().cycles[0],[done(25)]).weight],['increase',52.5]));
test('mantiene carga ante fallo o pérdida de velocidad',()=> { assert.equal(nextPrescription(withCycle().cycles[0],[done(25,0)]).status,'hold');assert.equal(nextPrescription(withCycle().cycles[0],[done(25,2,'lenta')]).status,'hold'); });
test('revisión de ciclo con límite de repeticiones',()=>assert.equal(nextPrescription(withCycle().cycles[0],[done(15)]).status,'review'));
test('sesiones de otros ciclos no contaminan progresión',()=>{const s=done(25);s.entries[0].bilbo.cycleId='old';assert.equal(nextPrescription(withCycle().cycles[0],[s]).status,'start');});
test('borrador arrastra estructura del día, pero no repeticiones',()=>{const s=withCycle();s.sessions=[done(30)];const draft=workoutForDay(s,'push');assert.equal(draft.entries[0].bilbo.weight,52.5);assert.equal(draft.entries[0].bilbo.reps,'');});
test('finalización filtra series incompletas',()=>{const s=withCycle();const d=workoutForDay(s,'push');d.entries[0].bilbo.reps=27;const out=finalizeWorkout(s,d);assert.equal(out.entries.length,1);assert.equal(out.entries[0].bilbo.reps,27);});
test('la carga total contempla bilbo y complementarias',()=>assert.equal(sessionVolume(done(20)), 1400));
test('un backup corrupto se rechaza',()=>assert.throws(()=>validateBackup({schemaVersion:1,cycles:[]})));
test('volumen semanal cero sin registros',()=>assert.equal(weeklyVolume([]).reduce((n,w)=>n+w.volume,0),0));

test('dos sesiones el mismo día se ordenan por finalización real',()=>{const before=done(25),after=done(24);before.id='z';after.id='a';before.completedAt='2026-10-19T13:00:00Z';after.completedAt='2026-10-19T14:00:00Z';after.entries[0].bilbo.weight=52.5;assert.equal(nextPrescription(withCycle().cycles[0],[before,after]).weight,55);});

test('RM Bilbo coincide con ejemplos de la hoja Excel', () => {
  assert.equal(estimateBilbo1RM(50, 22), 83);
  assert.equal(estimateBilbo1RM(60, 22), 99.6);
  assert.equal(estimateBilbo1RM(70, 18), 107.8);
});
test('RM Bilbo acepta decimales de carga pero no entradas incompletas', () => {
  assert.equal(estimateBilbo1RM(52.5, 20), 84);
  for (const [weight, reps] of [[0, 20], [-20, 15], ['abc', 12], [50, ''], [50, 0], [50, -1], [50, 2.5], [50, 501]])
    assert.equal(estimateBilbo1RM(weight, reps), null);
});
test('la RM usa las repeticiones realmente registradas, sin inventar repeticiones de RIR', () => {
  assert.equal(estimateBilbo1RM(done(25, 2).entries[0].bilbo.weight, 25), 87.5);
});
test('la serie de RM respeta ejercicio, ciclo y orden temporal', () => {
  const a=done(22), b=done(18), other=done(30);
  a.id='a'; a.completedAt='2026-10-19T11:00:00Z';
  b.id='b'; b.completedAt='2026-10-19T12:00:00Z'; b.entries[0].bilbo.weight=65;
  other.id='z'; other.entries[0].exerciseId='row';
  assert.deepEqual(bilboRmSeries([b, other, a], 'bench', 'c1').map(x=>x.estimatedRM), [83,100.1]);
  assert.deepEqual(bilboRmSeries([b, other, a], 'row', 'c1').map(x=>x.estimatedRM), [95]);
  assert.equal(bilboRmSeries([b], 'bench', 'otro').length, 0);
});
test('la RM inválida o ausente no se inventa en el historial', () => {
  const s=done(20); s.entries[0].bilbo.reps='';
  assert.equal(bilboRmSeries([s], 'bench').length, 0);
});
