import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { emptyState } from '../site/core.js';

// The app has no DOM dependency: this harness supplies the minimal browser APIs
// to exercise its actual event delegation, forms and persistence without a browser.
test('Ajustes: confirmar BORRAR and importar CSV respond to real delegated actions', async () => {
  const events=new Map(),winEvents=new Map(),storage=new Map();
  const root={innerHTML:''};
  const modal={innerHTML:'',querySelector:()=>null};
  const toast={innerText:'',classList:{add(){},remove(){}}};
  const elements=new Map([['app',root],['modal-root',modal],['toast',toast]]);
  const documentMock={
    getElementById(id){return elements.get(id)||null;},
    addEventListener(type,callback){events.set(type,callback);},
  };
  globalThis.document=documentMock;
  globalThis.window={addEventListener(type,fn){winEvents.set(type,fn);}};
  globalThis.navigator={onLine:true};
  globalThis.location={hash:'#ajustes'};
  globalThis.scrollTo=()=>{};
  globalThis.crypto=webcrypto;
  globalThis.localStorage={
    getItem(key){return storage.get(key)??null;},
    setItem(key,value){storage.set(key,String(value));},
    removeItem(key){storage.delete(key);}
  };
  globalThis.FormData=class {
    constructor(form){this.data=form.values||{};}
    get(key){return Object.hasOwn(this.data,key)?this.data[key]:null;}
    has(key){return Object.hasOwn(this.data,key);}
  };
  const seed=emptyState();
  seed.sessions.push({id:'prior',date:'2026-10-18',dayId:'push',entries:[]});
  localStorage.setItem('bilbopocket:v1',JSON.stringify(seed));
  const renderClick=(action)=>events.get('click')({
    target:{closest(selector){return selector==='[data-action]'?{dataset:{action}}:null;}},
    preventDefault(){}
  });
  const renderSubmit=(form)=>events.get('submit')({
    target:{closest(selector){return selector==='[data-form]'?form:null;}},
    preventDefault(){}
  });
  const app=await import('../site/app.js');
  assert(root.innerHTML.includes('excel-file-trigger'),'file input must be a real tappable surface');
  assert(root.innerHTML.includes('id="excel-upload"'));
  assert(!root.innerHTML.includes('data-action="pick-excel"'));
  renderClick('wipe');
  assert(modal.innerHTML.includes('data-form="wipe"'));
  assert(modal.innerHTML.includes('Escribí BORRAR'));
  assert(!modal.innerHTML.includes('onclick="event.stopPropagation()"'));
  assert(storage.has('bilbopocket:v1'),'open confirmation must not delete data');
  renderClick('close-modal');
  assert.equal(modal.innerHTML,'','cancel dialog must close');
  assert(storage.has('bilbopocket:v1'),'cancel must preserve data');
  renderClick('wipe');
  renderSubmit({dataset:{form:'wipe'},values:{verify:'BORRAR'}});
  assert(!storage.has('bilbopocket:v1'),'confirmed reset must remove all saved data');
  assert.equal(modal.innerHTML,'');
  assert.equal(location.hash,'inicio');

  location.hash='ajustes';
  winEvents.get('hashchange')();
  assert(root.innerHTML.includes('excel-file-trigger'));
  const csv='Fecha;Ejercicio;Peso;Repeticiones\\n19/10/2026;Press de banca;50;22\\n';
  const file=new File([csv.replaceAll('\\n','\n')],'import.csv',{type:'text/csv'});
  const input={id:'excel-upload',files:[file],value:'file',dataset:{}};
  await events.get('change')({target:input});
  assert(modal.innerHTML.includes('data-form="excel-import"'),'Excel selection must open preview');
  assert(modal.innerHTML.includes('Series detectadas'));
  renderSubmit({dataset:{form:'excel-import'},values:{'sheet-map-0':'bench'}});
  assert(modal.innerHTML.includes('data-action="commit-excel-import"'),'preview submit must open confirmation');
  renderClick('commit-excel-import');
  const saved=JSON.parse(localStorage.getItem('bilbopocket:v1'));
  assert.equal(saved.sessions.length,1,'a confirmed Excel import must persist exactly one series');
  assert.equal(saved.sessions[0].entries[0].bilbo.weight,50);
  assert.equal(saved.sessions[0].entries[0].bilbo.reps,22);
  assert.equal(modal.innerHTML,'');
  assert.equal(location.hash,'historial');
});
