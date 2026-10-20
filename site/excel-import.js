import { uid, localDate, number } from './core.js';

const normalize = value => String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const numeric = value => {
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string')return null;
  let v=value.trim().replace(/\s/g,'');
  if (!/^[-+]?[\d.,]+$/.test(v) || !v) return null;
  if(v.includes(',')&&v.includes('.'))v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replaceAll('.','').replace(',','.'):v.replaceAll(',','');
  else if(v.includes(','))v=v.replace(',','.');
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
function strictDate(year,month,day){
  if(year<1900||year>2100||month<1||month>12||day<1||day>31)return null;
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day?date.toISOString().slice(0,10):null;
}
export function excelDate(value,date1904=false){
  if(typeof value==='number' && Number.isFinite(value) && value>=1 && value<=100000){
    const serial=Math.floor(value)+(date1904?1462:0);
    const d=new Date(Date.UTC(1899,11,30)+serial*86400000);
    return strictDate(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());
  }
  const v=String(value??'').trim();
  if(!v)return null;
  let m=v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s].*)?$/);
  if(m)return strictDate(+m[1],+m[2],+m[3]);
  m=v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[\s].*)?$/);
  if(m)return strictDate(m[3].length===2?2000+Number(m[3]):+m[3],+m[2],+m[1]);
  return null;
}
const findIndex=(cells,matcher)=>cells.findIndex(x=>matcher(normalize(x)));
function columns(cells){
  const weight=findIndex(cells,x=>/^peso($|\s)|^carga($|\s)|^kg$/.test(x));
  const reps=findIndex(cells,x=>/^(repeticiones|repeticion|reps|rep|repetitions)($|\s)/.test(x));
  if(weight<0||reps<0)return null;
  return {
    weight,reps,
    date:findIndex(cells,x=>x==='fecha'||x==='date'||x==='dia fecha'),
    exercise:findIndex(cells,x=>x==='ejercicio'||x==='exercise'||x==='movimiento'),
    cycle:findIndex(cells,x=>x==='ciclo'||x==='cycle'),
    rir:findIndex(cells,x=>x==='rir'||x==='repeticiones en reserva'),
    day:findIndex(cells,x=>x==='dia'||x==='sesion')
  };
}
export function scanBilboWorkbook(workbook){
  if(!workbook?.sheets?.length)throw new Error('No se encontraron hojas con datos.');
  const entries=[],info=[];
  for(const [sheetIndex,sheet] of workbook.sheets.entries()){
    let current=null,cycle=1,seenHeaders=0,planned=0,rejected=0;
    const rows=sheet.rows||[];
    let hint=sheet.name;
    for(const row of rows.slice(0,18)){
      const text=(row.cells||[]).filter(x=>x!==null&&x!==undefined).map(String).join(' ');
      if(/nombre\s*:/i.test(text)&&/press|banca|sentadilla|fondos|remo|dominadas/i.test(text))hint+=' '+text;
    }
    for(const row of rows){
      const cells=row.cells||[],text=cells.map(x=>String(x??'')).join(' ');
      const header=columns(cells);
      if(header){current=header;seenHeaders++;continue;}
      const summary=text.match(/\bciclo\s*(\d+)\s*(?:acumulado|total|finalizad|terminad)/i);
      if(summary){cycle=Number(summary[1])+1;current=null;continue;}
      const title=text.match(/^\s*ciclo\s*(\d+)\s*$/i);
      if(title){cycle=Number(title[1]);continue;}
      if(!current)continue;
      const weight=numeric(cells[current.weight]);
      const reps=numeric(cells[current.reps]);
      // Template rows with planned weight and 0/empty reps are NOT completed sessions.
      if(weight!==null && weight>0 && (reps===null||reps===0)){planned++;continue;}
      if(weight===null||reps===null||weight<=0||reps<=0)continue;
      if(weight>2000||!Number.isInteger(reps)||reps>500){rejected++;continue;}
      const rawCycle=current.cycle>=0?numeric(cells[current.cycle]):null;
      const cycleNumber=rawCycle&&Number.isInteger(rawCycle)&&rawCycle>0&&rawCycle<=100?rawCycle:cycle;
      const rawDate=current.date>=0?cells[current.date]:null;
      const date=excelDate(rawDate,!!sheet.date1904);
      const rir=current.rir>=0?numeric(cells[current.rir]):null;
      entries.push({
        sheetIndex,sheet:sheet.name,row:row.number,cycleNumber,weight,reps,
        date,dateMissing:!date,dayNumber:current.day>=0?numeric(cells[current.day]):null,
        exerciseName:current.exercise>=0?String(cells[current.exercise]??'').trim():null,
        rir:rir!==null&&rir>=0&&rir<=20?rir:null
      });
    }
    info.push({index:sheetIndex,name:sheet.name,hint,headers:seenHeaders,planned,rejected,count:entries.filter(x=>x.sheetIndex===sheetIndex).length});
  }
  if(entries.length>10000)throw new Error('El Excel tiene demasiadas sesiones. Dividilo en archivos más pequeños.');
  if(!entries.length)throw new Error('No encontré series realizadas. Necesito columnas Peso y Repeticiones con valores mayores que cero.');
  return {entries,sheets:info,missingDates:entries.filter(x=>x.dateMissing).length,planned:info.reduce((n,x)=>n+x.planned,0)};
}
export function matchingExercise(hint,exercises) {
  const clean=normalize(hint);
  const exact=exercises.find(e=>clean===normalize(e.name));
  if(exact)return exact.id;
  const patterns=[
    [/press.*banca|banca|bench/,/banca|bench/],
    [/press.*inclinado|incline/,/inclina/],
    [/press.*militar|ohp/,/militar/],
    [/fondos|dips/,/fondo/],
    [/sentadilla|squat/,/sentadilla/],
    [/dominadas|pull.?ups/,/dominada/],
    [/remo|row/,/remo/]
  ];
  for(const [pattern,match] of patterns)if(pattern.test(clean)){const ex=exercises.find(e=>match.test(normalize(e.name)));if(ex)return ex.id;}
  return null;
}
function duplicateKey(date,exerciseId,weight,reps,cycle) {return [date,exerciseId,Number(weight),Number(reps),cycle??''].join('|');}
export function planBilboImport(state,scan,options) {
  const copy=structuredClone(state);
  const fingerprints=new Set(copy.sessions.flatMap(s=>(s.entries||[]).map(e=>e.bilbo?.importSource?.key).filter(Boolean)));
  const existing=new Set(copy.sessions.flatMap(s=>(s.entries||[]).filter(e=>e.bilbo).map(e=>duplicateKey(s.date,e.exerciseId,e.bilbo.weight,e.bilbo.reps,e.bilbo.importSource?.cycleNumber))));
  const mappings=options?.mappings??{},assign=options?.undatedDate?excelDate(options.undatedDate):null;
  const source=String(options?.fingerprint??'').slice(0,128);
  if(!source)throw new Error('Falta identificar el archivo de origen.');
  if(options?.undatedDate && !assign)throw new Error('La fecha asignada no es válida.');
  const byGroup=new Map();
  const accepted=[];let duplicates=0,missingDate=0,invalidMapping=0;
  for(const item of scan.entries){
    // In a generic sheet, a populated exercise column takes precedence over the sheet mapping.
    // Unknown exercise labels fall back to the explicit user-selected sheet mapping.
    const exerciseId=(item.exerciseName?matchingExercise(item.exerciseName,copy.exercises):null)||mappings[item.sheetIndex];
    if(!copy.exercises.some(x=>x.id===exerciseId)){invalidMapping++;continue;}
    const date=item.date||assign;
    if(!date){missingDate++;continue;}
    const key=`${source}:${item.sheetIndex}:${item.row}`;
    const natural=duplicateKey(date,exerciseId,item.weight,item.reps,item.cycleNumber);
    if(fingerprints.has(key)||existing.has(natural)){duplicates++;continue;}
    fingerprints.add(key);existing.add(natural);
    accepted.push({...item,exerciseId,date,key,assignedDate:!item.date});
    const groupKey=`${item.sheetIndex}|${exerciseId}|${item.cycleNumber}`;
    if(!byGroup.has(groupKey))byGroup.set(groupKey,[]);
    byGroup.get(groupKey).push(accepted[accepted.length-1]);
  }
  let newCycles=0;
  const cycleMap=new Map();
  for(const [key,items] of byGroup){
    const [sheetIndex,exerciseId,originalCycle]=key.split('|');
    const previous=copy.cycles.find(c=>c.importSource?.fingerprint===source&&c.importSource?.sheetIndex===Number(sheetIndex)&&c.importSource?.cycleNumber===Number(originalCycle)&&c.exerciseId===exerciseId);
    if(previous){cycleMap.set(key,previous.id);continue;}
    const sorted=items.map(r=>r.weight).sort((a,b)=>a-b);
    const diffs=sorted.slice(1).map((v,i)=>v-sorted[i]).filter(x=>x>0);
    const increment=diffs.length?Math.min(...diffs):copy.exercises.find(e=>e.id===exerciseId)?.increment||2.5;
    const cycleNum=copy.cycles.filter(c=>c.exerciseId===exerciseId).reduce((n,c)=>Math.max(n,c.number||0),0)+1;
    const id=uid();
    copy.cycles.push({
      id,exerciseId,number:cycleNum,status:'finished',startDate:items.map(x=>x.date).sort()[0],
      closedAt:items.map(x=>x.date).sort().at(-1),startLoad:sorted[0],increment,minReps:15,
      importSource:{fingerprint:source,sheetIndex:Number(sheetIndex),cycleNumber:Number(originalCycle)}
    });
    cycleMap.set(key,id);newCycles++;
  }
  accepted.forEach((item,index)=>{
    const cycleId=cycleMap.get(`${item.sheetIndex}|${item.exerciseId}|${item.cycleNumber}`);
    const firstDay=copy.days.find(d=>d.exerciseIds.includes(item.exerciseId))||copy.days[0];
    if(!firstDay)throw new Error('Necesitás al menos un día de entrenamiento.');
    const recordedAt=`${item.date}T12:00:00.000Z`;
    copy.sessions.push({
      id:uid(),dayId:firstDay.id,date:item.date,startedAt:recordedAt,completedAt:recordedAt,
      imported:true,importSource:{key:item.key,sheet:item.sheet,row:item.row},
      notes:item.assignedDate?'Importado de Excel: fecha original ausente; se asignó la fecha indicada al importar.':'Importado de Excel: fecha original registrada.',
      entries:[{id:uid(),exerciseId:item.exerciseId,notes:`Origen: hoja "${item.sheet}", fila ${item.row}, ciclo ${item.cycleNumber}.`,
        extras:[],bilbo:{cycleId,weight:item.weight,reps:item.reps,rir:item.rir,speed:'sin_dato',
          importSource:{key:item.key,cycleNumber:item.cycleNumber,dateAssigned:item.assignedDate}}
      }]
    });
  });
  return {state:copy,added:accepted.length,duplicates,missingDate,invalidMapping,newCycles};
}
