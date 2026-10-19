import { uid, localDate, number, fmt, escapeHTML as esc, formatDate, emptyState, activeCycle, nextPrescription, workoutForDay, finalizeWorkout, stats, sessionVolume, sessionSets, allBilboSets, bilboRmSeries, estimateBilbo1RM, weeklyVolume, validateBackup, starterExercises } from './core.js';
import { loadState, saveState, exportState } from './store.js';

let state = loadState();
let page = location.hash.replace('#','') || 'inicio';
let selectedDay = state.draft?.dayId || state.days[0]?.id;
let selectedChart = state.exercises[0]?.id;
let selectedHistoryDay = 'all';
let restUntil = null;
let deferredInstall = null;
const root = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastNode = document.getElementById('toast');
const appName = 'BilboPocket';

const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/>',
  dumbbell:'<path d="M6.5 6.5 17.5 17.5M4 9l5-5m6 16 5-5M3 12l9-9m0 18 9-9"/>',
  chart:'<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
  history:'<path d="M3 12a9 9 0 1 1 3 6.7"/><path d="M3 4v5h5M12 7v5l4 2"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19 13.5a7 7 0 0 0 0-3l2-1-2-4-2.2 1A7 7 0 0 0 14.5 5L14 2h-4l-.5 3a7 7 0 0 0-2.3 1.5l-2.2-1-2 4 2 1a7 7 0 0 0 0 3l-2 1 2 4 2.2-1A7 7 0 0 0 9.5 19l.5 3h4l.5-3a7 7 0 0 0 2.3-1.5l2.2 1 2-4-2-1Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', chevron:'<path d="m9 18 6-6-6-6"/>', check:'<path d="m4 12 5 5L20 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>', target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>', trophy:'<path d="M7 4h10v8a5 5 0 0 1-10 0V4ZM7 6H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4M12 17v4m-4 0h8"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>', upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  trash:'<path d="M4 7h16M10 3h4m-8 4 1 14h10l1-14M10 11v6m4-6v6"/>', info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
  pause:'<path d="M8 5v14m8-14v14"/>', refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  edit:'<path d="m15 5 4 4M4 20l4-1 12-12-4-4L4 15Z"/>', offline:'<path d="m2 2 20 20M5 9a12 12 0 0 1 13-2M8 12a8 8 0 0 1 7-1m-3 7h.01"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>', menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
};
const svg = (key, size = 19) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icons[key] || icons.target}</svg>`;
const u = () => state.settings.units;
const ex = id => state.exercises.find(x => x.id === id);
const day = id => state.days.find(d => d.id === id);
const numeric = (v, max = 99999) => Math.max(0, Math.min(max, number(v)));
const inputNum = (name, label, value, extra = '') => `<div class="field"><label for="${esc(name)}">${esc(label)}</label><input id="${esc(name)}" name="${esc(name)}" type="number" inputmode="decimal" min="0" step="any" value="${esc(value ?? '')}" ${extra}></div>`;
const options = (items, selected) => items.map(x => `<option value="${esc(x[0])}" ${x[0] === selected ? 'selected' : ''}>${esc(x[1])}</option>`).join('');
const actionButton = (action,label,variant='secondary',extra='') => `<button class="btn ${variant}" type="button" data-action="${action}" ${extra}>${label}</button>`;
const header = (title, desc, right = '') => `<div class="header"><div><h1>${title}</h1><p>${desc}</p></div>${right}</div>`;
const noData = (title, detail, button = '') => `<div class="empty"><div class="empty-symbol">✳</div><h3>${title}</h3><p>${detail}</p>${button}</div>`;
function persist() { if (!saveState(state)) toast('No se pudo guardar: almacenamiento lleno o bloqueado'); }
function toast(message) { toastNode.innerText=message;toastNode.classList.add('toast');clearTimeout(toastNode._timer);toastNode._timer=setTimeout(()=>toastNode.classList.remove('toast'),3500); }
function setPage(p) { page=p;location.hash=p;render();scrollTo({top:0,behavior:'instant'}); }
const nav = [{id:'inicio',label:'Inicio',icon:'home'},{id:'entrenar',label:'Entrenar',icon:'dumbbell'},{id:'ciclos',label:'Ciclos',icon:'refresh'},{id:'historial',label:'Historial',icon:'history'},{id:'analisis',label:'Progreso',icon:'chart'},{id:'ajustes',label:'Ajustes',icon:'settings'}];
function navItem(n, side = false) { return `<a class="${side?'navlink':''} ${page===n.id?'active':''}" href="#${n.id}">${svg(n.icon)}<span>${n.label}</span></a>`; }
function render() {
  page = ['inicio','entrenar','ciclos','historial','analisis','ajustes','guia'].includes(page) ? page : 'inicio';
  const views = {inicio: dashboard,entrenar: training,ciclos: cycles,historial: history,analisis: analysis,ajustes: settings,guia: guide};
  root.innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><div class="brand-logo">B</div><span>Bilbo<span>Pocket</span></span></div><nav class="side-nav" aria-label="Navegación principal">${nav.map(n=>navItem(n,true)).join('')}</nav><div class="sidebar-bottom"><div class="online-pill"><span class="dot"></span><span class="network">${navigator.onLine?'Disponible sin conexión':'Modo sin conexión'}</span></div><p class="smallprint" style="margin-top:14px">Tus datos quedan en este dispositivo.<br>Hacé un respaldo desde Ajustes.</p></div></aside><main class="main"><div class="topbar"><div><div class="eyebrow">TU ESPACIO DE ENTRENAMIENTO</div><div class="mini-top">${new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</div></div><div class="top-actions"><div class="online-pill" id="network-top">${svg(navigator.onLine?'check':'offline',13)} ${navigator.onLine?'Online':'Offline'}</div><div class="avatar">${esc((state.settings.userName || 'B').slice(0,1).toUpperCase())}</div></div></div>${views[page]()}<footer class="footer">BilboPocket · Tu entrenamiento, tus decisiones · Datos privados en tu dispositivo</footer></main></div><nav class="mobile-nav" aria-label="Navegación móvil">${nav.filter(n=>n.id!=='ajustes').map(n=>navItem(n)).join('')}<a href="#ajustes" class="${page==='ajustes'?'active':''}">${svg('settings')}<span>Ajustes</span></a></nav><div id="timer-slot"></div>`;
  updateTimer();
}
function dashboard() {
  const s = stats(state);
  const latest = [...state.sessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  const active = state.cycles.filter(c=>c.status==='active');
  const welcome = state.settings.userName ? `, ${esc(state.settings.userName)}` : '';
  return `<div class="stack">
    <section class="hero"><div><div class="eyebrow">TU PROGRESO EMPIEZA HOY</div><div class="hero-title">Una serie más cerca de tu mejor versión${welcome}.</div><p>Entrená con intención. Registrá cada repetición. Construí progresos que puedas medir.</p><div class="button-row">${actionButton('go-train',`${svg('bolt')} ${state.draft?'Continuar entrenamiento':'Empezar entrenamiento'}`)}${actionButton('go-cycles','Mis ciclos','secondary')}</div></div><div class="hero-art"><div class="hero-ring"></div></div></section>
    <section class="grid3"><div class="stat"><div class="mini-icon">${svg('activity')}</div><div class="stat-value">${fmt(s.workouts)}</div><div class="stat-label">Entrenamientos completados</div></div><div class="stat"><div class="mini-icon">${svg('calendar')}</div><div class="stat-value">${fmt(s.workoutsThisWeek)}</div><div class="stat-label">Sesiones esta semana</div></div><div class="stat"><div class="mini-icon">${svg('target')}</div><div class="stat-value">${fmt(s.bilboSets)}</div><div class="stat-label">Series Bilbo registradas</div></div></section>
    <div class="two-col"><section class="card"><div class="card-title"><h2>Ciclos activos</h2>${actionButton('go-cycles',`${svg('plus')} Gestionar`,'ghost')}</div>${active.length? active.slice(0,5).map(c=>{const p=nextPrescription(c,state.sessions);return `<div class="record"><div><strong>${esc(ex(c.exerciseId)?.name||'Ejercicio eliminado')}</strong><small>Ciclo ${c.number} · ${fmt(c.increment)} ${u()} por paso</small></div><div class="record-right"><strong>${fmt(p.weight)} ${u()}</strong><small>${esc(p.label)}</small></div></div>`;}).join(''):noData('Todavía no tenés ciclos','Creá tu primer ciclo para recibir sugerencias de carga. ',actionButton('new-cycle','Crear primer ciclo','secondary'))}</section>
    <section class="card"><div class="card-title"><h2>Últimas sesiones</h2>${actionButton('go-history','Ver todas','ghost')}</div>${latest.length?latest.map(s=>`<div class="record"><div><strong>${esc(day(s.dayId)?.name||'Entrenamiento')}</strong><small>${formatDate(s.date)} · ${sessionSets(s)} series</small></div><div class="record-right"><strong>${fmt(sessionVolume(s))} ${u()}</strong><small>Volumen total</small></div></div>`).join(''):noData('El historial empieza acá','Todavía no registraste entrenamientos. Tu primera sesión va a aparecer acá.')}</section></div>
    <section class="card"><div class="card-title"><h2>La esencia del método</h2><span class="pill">Velocidad · Control · Progresión</span></div><div class="grid3"><div><div class="subheading">01 · Explosividad</div><p class="section-note">Intención de máxima velocidad en la fase concéntrica, sin perder control.</p></div><div><div class="subheading">02 · Margen</div><p class="section-note">No busques el fallo. Anotá el RIR y observá la calidad de las repeticiones.</p></div><div><div class="subheading">03 · Registro</div><p class="section-note">Compará las series por carga y ciclo, sin perseguir progresiones automáticas.</p></div></div><div class="divider"></div>${actionButton('go-guide','Leer guía de uso y método','ghost')}</section>
  </div>`;
}
function training() {
  if (!state.days.length) return header('Entrenar','Configurá un día de entrenamiento')+noData('Sin días disponibles','Creá un día desde Ajustes',actionButton('go-settings','Ir a ajustes'));
  const draft = state.draft;
  if (!draft) return `<div class="stack">${header('Hora de entrenar','Elegí tu día y empezá. Recuperamos la estructura de tu última sesión.')}
    <div class="eyebrow">SELECCIONÁ TU ENTRENAMIENTO</div><div class="grid2">${state.days.map(d => `<button class="day-card ${selectedDay===d.id?'active':''}" data-action="choose-day" data-id="${esc(d.id)}"><div class="day-symbol">${esc(d.emoji||'↗')}</div><span><strong>${esc(d.name)}</strong><small>${d.exerciseIds.length} ejercicios · ${state.sessions.filter(s=>s.dayId===d.id).length} sesiones</small></span><span class="arrow">${svg('chevron')}</span></button>`).join('')}</div>
    <div class="card"><div class="card-title"><h3>Tu próximo entrenamiento</h3><span class="pill muted">${esc(day(selectedDay)?.name||'')}</span></div>${(day(selectedDay)?.exerciseIds||[]).map(id=>`<div class="record"><strong>${esc(ex(id)?.name||'Ejercicio')}</strong><small>${esc(nextPrescription(activeCycle(state,id),state.sessions).weight===null?'Sin ciclo': `${fmt(nextPrescription(activeCycle(state,id),state.sessions).weight)} ${u()} sugeridos`)}</small></div>`).join('')||'<p class="smallprint">Agregá ejercicios a este día desde Ajustes.</p>'}<div style="margin-top:20px">${actionButton('start-workout',`${svg('bolt')} Comenzar sesión`,'',` ${day(selectedDay)?.exerciseIds.length?'':'disabled'}`)}</div></div></div>`;
  const planned = draft.entries.length;
  const completed = draft.entries.filter(e => e.bilbo?.reps>0 || e.extras.some(x=>x.reps>0)).length;
  return `<div class="stack">${header('Sesión en curso',`${esc(day(draft.dayId)?.name||'Entrenamiento')} · ${formatDate(draft.date)}`,actionButton('discard-workout','Descartar','ghost'))}
    <div class="card"><div class="eyeline"><div><strong>${completed} de ${planned} ejercicios con registros</strong><p class="section-note">Los cambios se guardan automáticamente en este dispositivo.</p></div><span class="pill">En curso</span></div><div style="background:#334134;height:6px;border-radius:9px;overflow:hidden;margin-top:13px"><div style="width:${planned?100*completed/planned:0}%;height:100%;background:var(--accent);transition:width .2s"></div></div></div>
    <div>${draft.entries.map((e,i)=>exerciseCard(e,i)).join('')}</div>
    <div class="card"><div class="field"><label for="session-notes">Notas de la sesión</label><textarea id="session-notes" data-draft-notes rows="2" placeholder="¿Cómo te sentiste? Técnica, energía, molestias...">${esc(draft.notes||'')}</textarea></div><div class="form-actions">${actionButton('add-exercise-to-workout',`${svg('plus')} Ejercicio`,'secondary')}${actionButton('finish-workout',`${svg('check')} Finalizar sesión`)}</div></div>
    <p class="smallprint">El peso de cada serie Bilbo es editable; las sugerencias son orientativas. La app no aumenta cargas automáticamente ni considera el fallo como objetivo.</p></div>`;
}
function exerciseCard(e,i) {
  const exercise = ex(e.exerciseId);
  const c = activeCycle(state,e.exerciseId);
  const recommendation = nextPrescription(c,state.sessions);
  const liveRm = estimateBilbo1RM(e.bilbo.weight,e.bilbo.reps);
  const warning = c && e.bilbo.cycleId!==c.id ? 'Esta serie pertenece al ciclo anterior' : recommendation.label;
  return `<div class="card exercise-card"><div class="card-title"><div class="exercise-head"><div class="exercise-num">${i+1}</div><div><strong>${esc(exercise?.name||'Ejercicio eliminado')}</strong><small>${esc(exercise?.category||'Personalizado')} ${c?`· Ciclo ${c.number}`:'· Sin ciclo'}</small></div></div><button class="icon-btn" aria-label="Quitar ejercicio" title="Quitar ejercicio" data-action="remove-exercise" data-id="${esc(e.id)}">${svg('trash')}</button></div>
    <div class="bilbo-panel"><div class="bilbo-panel-head"><strong>${svg('bolt',14)} SERIE BILBO</strong><small>Potencia + control</small></div><div class="series-grid">
    <div class="field"><label>Peso (${u()})</label><input aria-label="Carga Bilbo ${esc(exercise?.name||'')}" type="number" min="0" max="5000" step="0.25" inputmode="decimal" data-eid="${esc(e.id)}" data-part="bilbo" data-key="weight" value="${esc(e.bilbo.weight??'')}"></div>
    <div class="field"><label>Reps</label><input aria-label="Repeticiones Bilbo ${esc(exercise?.name||'')}" type="number" min="1" max="500" step="1" inputmode="numeric" data-eid="${esc(e.id)}" data-part="bilbo" data-key="reps" placeholder="—" value="${esc(e.bilbo.reps??'')}"></div>
    <div class="field"><label>RIR</label><input aria-label="RIR Bilbo" type="number" min="0" max="20" step="1" data-eid="${esc(e.id)}" data-part="bilbo" data-key="rir" value="${esc(e.bilbo.rir??2)}"></div>
    <div class="field speed-field"><label>Velocidad</label><select aria-label="Calidad de velocidad" data-eid="${esc(e.id)}" data-part="bilbo" data-key="speed">${options([['explosiva','Explosiva'],['estable','Controlada'],['lenta','Lenta']],e.bilbo.speed)}</select></div></div>
    <div class="hint-box" style="margin-top:12px"><strong>${c?`Objetivo ≥ ${c.minReps} reps · `:'Ciclo no configurado · '}</strong>${esc(warning)}${c && recommendation.weight!==null?` · Próxima carga sugerida: ${fmt(recommendation.weight)} ${u()}`:''}</div><p class="smallprint" style="margin:12px 2px 0">1RM estimada: <strong data-rm-for="${esc(e.id)}">${liveRm===null?'—':`${fmt(liveRm)} ${u()}`}</strong><span> · calculada por repeticiones, sin ajustar RIR</span></p></div>
    <div class="extras-head"><strong>Series complementarias</strong>${actionButton('add-extra',`${svg('plus')} Agregar`,'ghost',`data-id="${esc(e.id)}"`)}</div><div class="series-row"><small>#</small><small>Peso (${u()})</small><small>Reps</small><small>RIR</small><small></small></div>${e.extras.map((x,j)=>`<div class="series-row"><span class="series-index">${j+1}</span>${['weight','reps','rir'].map(k=>`<input aria-label="${k} serie ${j+1}" type="number" min="0" step="${k==='weight'?'0.25':'1'}" inputmode="decimal" data-eid="${esc(e.id)}" data-part="extras" data-index="${j}" data-key="${k}" placeholder="—" value="${esc(x[k]??'')}">`).join('')}<button class="icon-btn" title="Eliminar serie" aria-label="Eliminar serie complementaria" data-action="remove-extra" data-id="${esc(e.id)}" data-index="${j}">${svg('trash')}</button></div>`).join('')}
    <div class="button-row" style="margin-top:14px">${actionButton('rest-timer',`${svg('clock')} Descanso ${fmt(state.settings.restSeconds/60)} min`,'secondary')}</div></div>`;
}
function cycles() {
  const active = state.cycles.filter(c=>c.status==='active');
  const finished = state.cycles.filter(c=>c.status==='finished').sort((a,b)=>b.closedAt.localeCompare(a.closedAt));
  return `<div class="stack">${header('Mis ciclos','Planificá y medí cada progresión, ejercicio por ejercicio.',actionButton('new-cycle',`${svg('plus')} Nuevo ciclo`))}<div class="hint-box"><strong>Regla orientativa:</strong> si superás el mínimo de repeticiones con buena velocidad y RIR, se sugiere sumar el incremento configurado. Con caída clara de velocidad o RIR 0 se mantiene la carga. Si llegás al mínimo, revisá el cierre del ciclo.</div>
    <div class="section-head"><h2>En progreso</h2><span class="pill">${active.length} activos</span></div>${active.length?`<div class="grid2">${active.map(c=>cycleCard(c)).join('')}</div>`:noData('No tenés ciclos activos','Elegí un ejercicio, una carga inicial y el incremento que quieras evaluar.',actionButton('new-cycle',`${svg('plus')} Crear ciclo`))}
    <div class="section-head"><h2>Ciclos anteriores</h2></div>${finished.length?`<div class="card">${finished.map(c=>`<div class="record"><div><strong>${esc(ex(c.exerciseId)?.name||'Ejercicio')} · Ciclo ${c.number}</strong><small>${formatDate(c.startDate)} — ${formatDate(c.closedAt)}</small></div><span class="pill muted">${allBilboSets(state.sessions,c.exerciseId,c.id).length} series</span></div>`).join('')}</div>`:noData('Sin ciclos cerrados','Los ciclos finalizados van a quedar acá para futuras comparaciones.')}</div>`;
}
function cycleCard(c) {
  const sets = allBilboSets(state.sessions,c.exerciseId,c.id);
  const p = nextPrescription(c,state.sessions);
  return `<div class="card"><div class="card-title"><div><div class="subheading" style="margin-bottom:5px">CICLO ${c.number}</div><h3>${esc(ex(c.exerciseId)?.name||'Ejercicio')}</h3></div><span class="pill ${p.status==='review'?'warn':''}">${p.status==='review'?'Revisar':'Activo'}</span></div><div class="eyeline"><div><p class="section-note">Próxima carga sugerida</p><div class="stat-value" style="margin:3px 0">${fmt(p.weight)} <span style="font-size:15px">${u()}</span></div></div><div><p class="section-note">Sesiones</p><div class="stat-value" style="margin:3px 0">${sets.length}</div></div></div><div class="hint-box" style="margin:15px 0">${esc(p.label)} · mínimo ${c.minReps} reps · incremento ${fmt(c.increment)} ${u()}</div><div class="button-row">${actionButton('close-cycle','Cerrar ciclo','secondary',`data-id="${esc(c.id)}"`)}${actionButton('edit-cycle','Editar','ghost',`data-id="${esc(c.id)}"`)}</div></div>`;
}
function history() {
  const sessions = [...state.sessions].filter(s=>selectedHistoryDay==='all'||s.dayId===selectedHistoryDay).sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="stack">${header('Historial','Todas tus sesiones y tu trabajo registrado.')}
    <div class="select-row"><label for="filter-day" class="smallprint">Filtrar por día</label><select id="filter-day" data-filter="history"><option value="all">Todos los días</option>${options(state.days.map(d=>[d.id,d.name]),selectedHistoryDay)}</select></div>
    ${sessions.length?`<div class="stack">${sessions.map(s=>`<article class="card"><div class="card-title"><div><div class="subheading" style="margin-bottom:5px">${formatDate(s.date)}</div><h3>${esc(day(s.dayId)?.name||'Entrenamiento')}</h3></div><span class="pill">${sessionSets(s)} series</span></div><div class="grid2" style="margin-bottom:14px"><div><div class="section-note">Volumen</div><strong>${fmt(sessionVolume(s))} ${u()}</strong></div><div><div class="section-note">Ejercicios</div><strong>${s.entries.length}</strong></div></div><details><summary style="color:var(--accent);cursor:pointer;font-weight:700;font-size:13px">Ver detalles de la sesión</summary><div style="margin-top:12px">${s.entries.map(e=>`<div class="record"><div><strong>${esc(ex(e.exerciseId)?.name||'Ejercicio')}</strong><small>${e.bilbo?`Bilbo: ${fmt(e.bilbo.weight)} ${u()} × ${e.bilbo.reps} · RIR ${e.bilbo.rir} · 1RM estimada: ${fmt(estimateBilbo1RM(e.bilbo.weight,e.bilbo.reps))} ${u()}`:'Sin Bilbo'}${e.extras.length?` · ${e.extras.length} complementarias`:''}</small><small>${e.extras.map(x=>`${fmt(x.weight)}×${x.reps}`).join(' · ')}</small></div></div>`).join('')}${s.notes?`<p class="smallprint">${esc(s.notes)}</p>`:''}</div></details><div class="form-actions">${actionButton('delete-session',`${svg('trash')} Eliminar`,'ghost',`data-id="${esc(s.id)}"`)}</div></article>`).join('')}</div>`:noData('No hay sesiones para mostrar','Cambiá el filtro o registrá tu primer entrenamiento.',actionButton('go-train','Entrenar'))}</div>`;
}
function lineChart(data) {
  if (data.length < 1) return noData('Aún no hay puntos para graficar','Guardá una serie Bilbo y empezá a seguir tu evolución.');
  const w=640,h=228,left=41,right=22,top=20,bottom=35;
  const vals=data.flatMap(d=>[d.weight,d.reps]); const max=Math.max(10,...vals); const min=0;
  const x=i=>left+(data.length===1?(w-left-right)/2:i*(w-left-right)/(data.length-1));
  const y=v=>top+(1-v/(max||1))*(h-top-bottom);
  const line=k=>data.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(d[k]).toFixed(2)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Curvas de carga y repeticiones por sesión">${[0,1,2,3,4].map(i=>{const py=top+i*(h-top-bottom)/4;return `<line x1="${left}" x2="${w-right}" y1="${py}" y2="${py}" stroke="#354036" stroke-dasharray="4 5"/><text class="chart-label" x="${left-8}" y="${py+4}" text-anchor="end">${fmt(max*(4-i)/4)}</text>`;}).join('')}<path class="chart-line" d="${line('weight')}"/><path class="chart-line chart-secondary" d="${line('reps')}"/>${data.map((d,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(d.weight)}" r="4.7"/><circle class="chart-dot chart-secondary" cx="${x(i)}" cy="${y(d.reps)}" r="4"/><text class="chart-label" x="${x(i)}" y="${h-10}" text-anchor="middle">${esc(d.date.slice(5).replace('-','/'))}</text>`).join('')}</svg><div class="legend"><span><i></i>Carga (${u()})</span><span><i class="orange"></i>Repeticiones</span></div><p class="smallprint" style="margin-top:6px">Ambas series usan la misma escala numérica para visualizar tendencias, no para comparar unidades.</p>`;
}
function rmChart(data) {
  if (!data.length) return noData('Todavía no hay estimaciones', 'Registrá una serie Bilbo válida en este ejercicio.');
  const w=640,h=228,left=50,right=20,top=24,bottom=40;
  const values=data.map(d=>d.estimatedRM);
  const min=Math.floor((Math.min(...values)-Math.max(3,(Math.max(...values)-Math.min(...values))*.15))/5)*5;
  const max=Math.ceil((Math.max(...values)+Math.max(3,(Math.max(...values)-Math.min(...values))*.15))/5)*5;
  const lo=Math.max(0,min),span=Math.max(1,max-lo);
  const x=i=>left+(data.length===1?(w-left-right)/2:i*(w-left-right)/(data.length-1));
  const y=v=>top+(max-v)/span*(h-top-bottom);
  const path=data.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(d.estimatedRM).toFixed(2)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución de la 1RM estimada en kilogramos">${[0,1,2,3,4].map(i=>{const v=max-i*span/4,py=y(v);return `<line x1="${left}" x2="${w-right}" y1="${py}" y2="${py}" stroke="#354036" stroke-dasharray="4 5"/><text class="chart-label" x="${left-9}" y="${py+4}" text-anchor="end">${fmt(v)}</text>`;}).join('')}<path class="chart-line" d="${path}"/>${data.map((d,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(d.estimatedRM)}" r="5"><title>${esc(d.date)} · ${fmt(d.estimatedRM)} kg · ${fmt(d.weight)} kg × ${d.reps} reps</title></circle>${(i%2===0 || i===data.length-1)?`<text class="chart-label" x="${x(i)}" y="${h-12}" text-anchor="middle">${esc(d.date.slice(5).replace('-','/'))}</text>`:''}`).join('')}</svg>`;
}
function barChart(values) {
  const max=Math.max(1,...values.map(x=>x.volume)); const w=620,h=160; const bw=44,gap=(w-36-values.length*bw)/(values.length-1||1);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Volumen semanal de entrenamiento">${values.map((d,i)=>{const x=18+i*(bw+gap),bh=105*d.volume/max;return `<rect x="${x}" y="${120-bh}" width="${bw}" height="${bh}" rx="7" class="chart-bar" opacity="${d.volume?1:.22}"/><text x="${x+bw/2}" y="139" class="chart-label" text-anchor="middle">${d.label}</text>`;}).join('')}</svg>`;
}
function analysis() {
  const selectedEx = ex(selectedChart) || state.exercises[0];
  const sets=selectedEx?allBilboSets(state.sessions,selectedEx.id):[];
  const s=stats(state);
  const bestWeight = sets.length?Math.max(...sets.map(x=>x.weight)):0;
  const bestReps = sets.length?Math.max(...sets.map(x=>x.reps)):0;
  const last = sets.at(-1);
  const rms = selectedEx ? bilboRmSeries(state.sessions, selectedEx.id) : [];
  const rmLast = rms.at(-1), rmBest = rms.length ? Math.max(...rms.map(x=>x.estimatedRM)) : null;
  const rmChange = rmLast && rms.length>1 ? rmLast.estimatedRM-rms[0].estimatedRM : null;
  return `<div class="stack">${header('Tu progreso','Los números detrás de cada entrenamiento.')}
    <div class="grid3"><div class="stat"><div class="mini-icon">${svg('trophy')}</div><div class="stat-value">${fmt(s.volume)}</div><div class="stat-label">Volumen acumulado (${u()})</div></div><div class="stat"><div class="mini-icon">${svg('calendar')}</div><div class="stat-value">${fmt(s.uniqueDays)}</div><div class="stat-label">Días entrenados</div></div><div class="stat"><div class="mini-icon">${svg('target')}</div><div class="stat-value">${fmt(state.cycles.filter(c=>c.status==='finished').length)}</div><div class="stat-label">Ciclos completados</div></div></div>
    <div class="card"><div class="card-title"><h2>Evolución por ejercicio</h2></div><div class="select-row"><label for="chart-ex">Ejercicio</label><select id="chart-ex" data-filter="chart">${options(state.exercises.map(e=>[e.id,e.name]),selectedEx?.id)}</select></div><div style="margin-top:22px">${lineChart(sets.slice(-12))}</div><div class="divider"></div><div class="grid3"><div><div class="section-note">Mayor carga Bilbo</div><h2>${sets.length?`${fmt(bestWeight)} ${u()}`:'—'}</h2></div><div><div class="section-note">Máximas repeticiones</div><h2>${sets.length?fmt(bestReps):'—'}</h2></div><div><div class="section-note">Última serie</div><h2>${last?`${fmt(last.weight)} × ${last.reps}`:'—'}</h2></div></div></div>
    <div class="card"><div class="card-title"><h2>Evolución de la 1RM estimada</h2><span class="pill muted">Serie Bilbo</span></div>
    <p class="section-note">Fórmula de las planillas Bilbo: peso × (1 + 0,03 × repeticiones). Una estimación orientativa, no tu 1RM real. El RIR no modifica el cálculo; compará sesiones con técnica y esfuerzo similares.</p>
    <div style="margin-top:20px">${rmChart(rms.slice(-12))}</div><div class="divider"></div>
    <div class="grid3"><div><div class="section-note">Última 1RM estimada</div><h2>${rmLast?`${fmt(rmLast.estimatedRM)} ${u()}`:'—'}</h2></div><div><div class="section-note">Mejor 1RM estimada</div><h2>${rmBest===null?'—':`${fmt(rmBest)} ${u()}`}</h2></div><div><div class="section-note">Variación desde el primer registro</div><h2>${rmChange===null?'—':`${rmChange>0?'+':''}${fmt(rmChange)} ${u()}`}</h2></div></div></div>
    <div class="card"><div class="card-title"><h2>Volumen semanal</h2><span class="pill muted">8 semanas</span></div>${barChart(weeklyVolume(state.sessions))}<p class="section-note">Suma de peso × repeticiones de todas las series registradas; no es una estimación de fuerza máxima.</p></div>
    <div class="card"><div class="card-title"><h2>Comparación de ciclos</h2></div>${selectedEx && state.cycles.filter(c=>c.exerciseId===selectedEx.id).length?state.cycles.filter(c=>c.exerciseId===selectedEx.id).map(c=>{const arr=allBilboSets(state.sessions,c.exerciseId,c.id);return `<div class="record"><div><strong>Ciclo ${c.number} · ${c.status==='active'?'Activo':'Finalizado'}</strong><small>${arr.length} sesiones · desde ${formatDate(c.startDate)}</small></div><div class="record-right"><strong>${arr.length?`${fmt(Math.max(...arr.map(s=>s.weight)))} ${u()}`:'—'}</strong><small>Mayor carga registrada</small></div></div>`;}).join(''):noData('Sin ciclos para comparar','Configurá un ciclo en este ejercicio para analizarlo a lo largo del tiempo.')}</div></div>`;
}
function settings() {
  return `<div class="stack">${header('Ajustes','Personalizá tu entrenamiento y protegé tu historial.')}
    <div class="card"><div class="card-title"><h2>Preferencias</h2></div><form data-form="preferences"><div class="form-grid"><div class="field"><label for="userName">Tu nombre (opcional)</label><input id="userName" name="userName" maxlength="40" placeholder="Cómo querés que te llamemos" value="${esc(state.settings.userName||'')}"></div><div class="field"><label for="restSeconds">Descanso (segundos)</label><input id="restSeconds" name="restSeconds" type="number" min="30" max="1200" step="15" value="${state.settings.restSeconds}"></div></div><div class="form-actions"><button class="btn" type="submit">Guardar preferencias</button></div></form><p class="smallprint">Las cargas se muestran en kg. Para evitar conversiones accidentales de datos históricos, esta versión usa una única unidad.</p></div>
    <div class="card"><div class="card-title"><h2>Días de entrenamiento</h2>${actionButton('new-day',`${svg('plus')} Nuevo día`,'secondary')}</div>${state.days.map(d=>`<div class="list-row"><div><strong>${esc(d.emoji||'↗')} ${esc(d.name)}</strong><small>${d.exerciseIds.map(id=>ex(id)?.name).filter(Boolean).join(' · ')||'Sin ejercicios'}</small></div><div class="list-row-actions">${actionButton('edit-day','Editar','ghost',`data-id="${esc(d.id)}"`)}</div></div>`).join('')}</div>
    <div class="card"><div class="card-title"><h2>Catálogo de ejercicios</h2>${actionButton('new-exercise',`${svg('plus')} Agregar`,'secondary')}</div>${state.exercises.map(e=>`<div class="list-row"><div><strong>${esc(e.name)}</strong><small>${esc(e.category)} · incremento sugerido ${fmt(e.increment)} ${u()}</small></div>${actionButton('edit-exercise','Editar','ghost',`data-id="${esc(e.id)}"`)}</div>`).join('')}</div>
    <div class="card"><div class="card-title"><h2>Respaldo y privacidad</h2><span class="pill">Local-first</span></div><p class="smallprint">Tus registros se guardan en el navegador de este dispositivo. Borrar datos del navegador, cambiar de celular o usar modo privado puede eliminarlos. Exportá copias regularmente: no hay sincronización entre dispositivos.</p><div class="button-row" style="margin-top:18px">${actionButton('backup',`${svg('download')} Exportar respaldo`)}<label class="btn secondary" for="backup-file">${svg('upload')} Importar respaldo</label><input type="file" id="backup-file" accept="application/json,.json" style="position:absolute;width:1px;height:1px;opacity:0"></div><div class="divider"></div>${actionButton('wipe','Borrar todos los datos','danger')}</div>
    <div class="card"><div class="card-title"><h2>Instalar y usar sin conexión</h2></div><p class="smallprint">Una vez abierta online, la PWA guarda sus recursos para funcionar sin conexión. En iPhone: Compartir → Añadir a pantalla de inicio. En Android, usá «Instalar aplicación» desde el navegador.</p><div class="button-row" style="margin-top:16px">${actionButton('install','Instalar aplicación','secondary')}${actionButton('go-guide','Leer guía del método','ghost')}</div></div></div>`;
}
function guide() {
  const guideItems=[['Prepará una carga razonable','Como orientación habitual se parte de una carga submáxima (frecuentemente alrededor de la mitad del 1RM). Ajustá según tu capacidad real.'],['Buscá intención explosiva','Ejecutá cada repetición con técnica controlada y máxima velocidad concéntrica voluntaria. Frená cuando se degrade la calidad.'],['Dejá repeticiones en reserva','La serie Bilbo no exige llegar al fallo. Registrá RIR y sensación de velocidad.'],['Progresá con criterio','La app sugiere aumentos configurables entre sesiones si los datos son favorables; no reemplaza tu juicio.'],['Cerrá y repetí el ciclo','Si llegás al umbral mínimo de reps, evaluá cerrar el ciclo y planificar el siguiente. Guardamos cada ciclo para compararlo.'],['Completá tu sesión','Las series complementarias también cuentan para el historial y el volumen total.']];
  return `<div class="stack">${header('Guía BilboPocket','Entendé cómo usamos los datos de tu entrenamiento.',actionButton('go-train','Entrenar'))}<div class="card"><div class="card-title"><h2>Una progresión consciente</h2></div>${guideItems.map((x,i)=>`<div class="guide-step"><div class="guide-index">${i+1}</div><div><strong>${x[0]}</strong><p>${x[1]}</p></div></div>`).join('')}<div class="hint-box warning">Esto es una herramienta de seguimiento, no un programa médico ni una prescripción individual. Pará ante dolor o signos de lesión y adaptá el entrenamiento a tu situación.</div></div><p class="smallprint">Esta aplicación es independiente y no está afiliada a Bilbo Team ni a Jesús Varela. Para profundizar, consultá <a class="subtle-link" href="https://bilboteam.com/" target="_blank" rel="noopener noreferrer">las explicaciones oficiales</a>.</p></div>`;
}
function showModal(title, body) {
  modalRoot.innerHTML=`<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" onclick="event.stopPropagation()"><div class="card-title"><h2>${esc(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Cerrar">×</button></div>${body}</div></div>`;
  modalRoot.querySelector('input,select,button')?.focus();
}
function hideModal() {modalRoot.innerHTML='';}
function cycleModal(id) {
  const old = state.cycles.find(c=>c.id===id);
  const first = state.exercises[0];
  showModal(old?'Editar ciclo':'Nuevo ciclo',`<form data-form="cycle" data-id="${esc(id||'')}"><div class="form-grid">
    <div class="field wide"><label>Ejercicio</label><select name="exerciseId" ${old?'disabled':''} required>${options(state.exercises.map(e=>[e.id,e.name]),old?.exerciseId||first?.id)}</select></div>
    ${inputNum('startLoad',`Carga inicial (${u()})`,old?.startLoad??'','min="0.25" required')}${inputNum('increment',`Incremento (${u()})`,old?.increment??2.5,'min="0.25" required')}
    ${inputNum('minReps','Mínimo de repeticiones',old?.minReps??15,'min="1" max="100" required')}
    <div class="field"><label>Referencia 1RM (opcional)</label><input type="number" inputmode="decimal" step="0.25" min="0" name="oneRM" placeholder="Solo como ayuda" id="one-rm"></div></div><p class="smallprint" id="rm-hint" style="margin-top:10px">El umbral y los incrementos son editables. No usaremos un 1RM estimado automáticamente.</p>
    <div class="form-actions"><button class="btn secondary" type="button" data-action="close-modal">Cancelar</button><button class="btn" type="submit">${old?'Guardar cambios':'Crear ciclo'}</button></div></form>`);
}
function dayModal(id) {
  const d=day(id);
  showModal(d?'Editar día':'Nuevo día',`<form data-form="day" data-id="${esc(id||'')}"><div class="field"><label>Nombre del día</label><input type="text" name="name" maxlength="45" value="${esc(d?.name||'')}" placeholder="Ej. Torso A" required></div><div class="field" style="margin-top:12px"><label>Identificador visual</label><select name="emoji">${options([['↗','↗ Empuje'],['↙','↙ Tirón'],['⚡','⚡ Piernas'],['◎','◎ General'],['◆','◆ Día especial']],d?.emoji||'↗')}</select></div><div class="subheading" style="margin-top:20px">Ejercicios en este día</div><div class="checkbox-list">${state.exercises.map(e=>`<label class="check-row"><input type="checkbox" name="exerciseIds" value="${esc(e.id)}" ${d?.exerciseIds.includes(e.id)?'checked':''}><span>${esc(e.name)}</span></label>`).join('')}</div><div class="form-actions">${d?actionButton('delete-day','Eliminar día','danger',`data-id="${esc(d.id)}"`):''}<button class="btn" type="submit">Guardar día</button></div></form>`);
}
function exerciseModal(id) {
  const e=ex(id);
  showModal(e?'Editar ejercicio':'Nuevo ejercicio',`<form data-form="exercise" data-id="${esc(id||'')}"><div class="form-grid"><div class="field wide"><label>Nombre</label><input name="name" maxlength="60" value="${esc(e?.name||'')}" placeholder="Ej. Press con mancuernas" required></div><div class="field"><label>Grupo</label><input name="category" maxlength="35" value="${esc(e?.category||'General')}" required></div>${inputNum('increment',`Incremento (${u()})`,e?.increment??2.5,'min="0.25" required')}${inputNum('defaultExtras','Complementarias habituales',e?.defaultExtras??2,'min="0" max="12" required')}</div><div class="form-actions">${e?actionButton('delete-exercise','Eliminar','danger',`data-id="${esc(e.id)}"`):''}<button type="submit" class="btn">Guardar ejercicio</button></div></form>`);
}
function addWorkoutExerciseModal(){const current=new Set(state.draft.entries.map(x=>x.exerciseId));showModal('Agregar ejercicio',`<div class="stack">${state.exercises.filter(e=>!current.has(e.id)).map(e=>`<button class="day-card" data-action="insert-workout-exercise" data-id="${esc(e.id)}"><span><strong>${esc(e.name)}</strong><small>${esc(e.category)}</small></span><span class="arrow">${svg('plus')}</span></button>`).join('')||'<p class="smallprint">Ya agregaste todos los ejercicios del catálogo.</p>'}</div>`);}
function confirmAction(message) {return window.confirm(message);}
function finishWorkout() {
  try { const finished=finalizeWorkout(state,state.draft);state.sessions.push(finished);state.draft=null;persist();restUntil=null;toast('Sesión guardada correctamente');setPage('historial'); }
  catch(err) {toast(err.message);}
}
function makeExtra() {return {weight:'',reps:'',rir:2};}
function handleAction(button) {
  const act=button.dataset.action,id=button.dataset.id;
  if (act==='close-modal'){hideModal();return;}
  if (act==='go-train') return setPage('entrenar');
  if (act==='go-cycles') return setPage('ciclos');
  if (act==='go-history') return setPage('historial');
  if (act==='go-settings') return setPage('ajustes');
  if (act==='go-guide') return setPage('guia');
  if (act==='choose-day'){selectedDay=id;render();return;}
  if (act==='start-workout'){try{state.draft=workoutForDay(state,selectedDay);persist();render();}catch(e){toast(e.message);}return;}
  if (act==='discard-workout'){if(confirmAction('¿Descartar el entrenamiento en curso? Los datos del borrador se perderán.')){state.draft=null;persist();render();}return;}
  if (act==='finish-workout') return finishWorkout();
  if (act==='add-extra'){const entry=state.draft?.entries.find(e=>e.id===id);if(entry){entry.extras.push(makeExtra());persist();render();}return;}
  if (act==='remove-extra'){const entry=state.draft?.entries.find(e=>e.id===id);if(entry){entry.extras.splice(+button.dataset.index,1);persist();render();}return;}
  if (act==='remove-exercise'){if(confirmAction('¿Quitar este ejercicio de la sesión?')){state.draft.entries=state.draft.entries.filter(e=>e.id!==id);persist();render();}return;}
  if (act==='add-exercise-to-workout') return addWorkoutExerciseModal();
  if (act==='insert-workout-exercise'){const current=state.draft;const c=activeCycle(state,id);const p=nextPrescription(c,state.sessions);current.entries.push({id:uid(),exerciseId:id,bilbo:{cycleId:c?.id||null,weight:p.weight??0,reps:'',rir:2,speed:'explosiva'},extras:Array.from({length:ex(id)?.defaultExtras??2},makeExtra),notes:''});persist();hideModal();render();return;}
  if (act==='new-cycle') return cycleModal();
  if (act==='edit-cycle') return cycleModal(id);
  if (act==='close-cycle'){if(confirmAction('¿Cerrar este ciclo? Quedará disponible en el historial de ciclos.')){const c=state.cycles.find(x=>x.id===id);if(c){c.status='finished';c.closedAt=localDate();persist();render();}}return;}
  if (act==='new-day') return dayModal();
  if (act==='edit-day') return dayModal(id);
  if (act==='delete-day'){if(state.days.length===1){toast('Necesitás al menos un día de entrenamiento');return;}if(confirmAction('¿Eliminar este día? El historial guardado no se elimina.')){state.days=state.days.filter(d=>d.id!==id);if(selectedDay===id)selectedDay=state.days[0]?.id;persist();hideModal();render();}return;}
  if (act==='new-exercise')return exerciseModal();
  if (act==='edit-exercise')return exerciseModal(id);
  if (act==='delete-exercise'){if(state.sessions.some(s=>s.entries.some(e=>e.exerciseId===id))||state.cycles.some(c=>c.exerciseId===id)){toast('Este ejercicio tiene historial o ciclos. No se puede eliminar.');return;}if(confirmAction('¿Eliminar este ejercicio del catálogo y de los días de entrenamiento?')){state.exercises=state.exercises.filter(e=>e.id!==id);state.days.forEach(d=>d.exerciseIds=d.exerciseIds.filter(x=>x!==id));persist();hideModal();render();}return;}
  if (act==='delete-session'){if(confirmAction('¿Eliminar esta sesión definitivamente? No se puede deshacer salvo importando un respaldo.')){state.sessions=state.sessions.filter(s=>s.id!==id);persist();render();}return;}
  if (act==='rest-timer'){restUntil=Date.now()+state.settings.restSeconds*1000;updateTimer();return;}
  if (act==='stop-timer'){restUntil=null;updateTimer();return;}
  if (act==='backup'){const blob=new Blob([exportState(state)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`bilbopocket-respaldo-${localDate()}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Respaldo descargado');return;}
  if (act==='wipe'){if(confirmAction('Vas a borrar todo el historial, ciclos y ajustes de este dispositivo. ¿Continuar?') && confirmAction('Última confirmación: ¿borrar todos los datos?')){state=emptyState();selectedDay=state.days[0]?.id;persist();toast('Datos restablecidos');setPage('inicio');}return;}
  if (act==='install'){if(deferredInstall){deferredInstall.prompt();deferredInstall.userChoice.then(()=>{deferredInstall=null;});}else{toast('En iOS: Compartir → Añadir a pantalla de inicio. En Android: menú → Instalar.');}return;}
}
function handleForm(form) {
  const f=new FormData(form);const id=form.dataset.id;
  if(form.dataset.form==='preferences') {
    state.settings.userName=String(f.get('userName')||'').trim().slice(0,40);
    state.settings.restSeconds=Math.max(30,Math.min(1200,number(f.get('restSeconds'),150)));
    persist();toast('Preferencias guardadas');render();return;
  }
  if(form.dataset.form==='cycle') {
    const exerciseId=id?state.cycles.find(c=>c.id===id)?.exerciseId:String(f.get('exerciseId'));
    if(!ex(exerciseId)){toast('Elegí un ejercicio válido');return;}
    const startLoad=number(f.get('startLoad')),increment=number(f.get('increment')),minReps=number(f.get('minReps'));
    if(startLoad<=0||increment<=0||minReps<1||minReps>100){toast('Ingresá carga e incremento mayores que cero');return;}
    if(id) {const c=state.cycles.find(c=>c.id===id);if(!c)return;Object.assign(c,{startLoad,increment,minReps});}
    else {const active=activeCycle(state,exerciseId);if(active){if(!confirmAction('Hay un ciclo activo para este ejercicio. ¿Cerrarlo y empezar uno nuevo?'))return;active.status='finished';active.closedAt=localDate();}
      const n=state.cycles.filter(c=>c.exerciseId===exerciseId).reduce((v,c)=>Math.max(v,c.number),0)+1;
      state.cycles.push({id:uid(),exerciseId,number:n,status:'active',startDate:localDate(),startLoad,increment,minReps});
    }
    persist();hideModal();render();toast('Ciclo guardado');return;
  }
  if(form.dataset.form==='day') {
    const name=String(f.get('name')||'').trim();if(!name){toast('Ingresá un nombre');return;}
    const exerciseIds=f.getAll('exerciseIds').filter(x=>!!ex(x));
    if(id){const d=day(id);if(!d)return;Object.assign(d,{name,emoji:String(f.get('emoji')||'↗'),exerciseIds});}
    else state.days.push({id:uid(),name,emoji:String(f.get('emoji')||'↗'),exerciseIds});
    persist();hideModal();render();toast('Día guardado');return;
  }
  if(form.dataset.form==='exercise') {
    const name=String(f.get('name')||'').trim(),category=String(f.get('category')||'').trim();const increment=number(f.get('increment')),defaultExtras=number(f.get('defaultExtras'));
    if(!name||!category||increment<=0||defaultExtras<0||defaultExtras>12){toast('Revisá los datos del ejercicio');return;}
    if(id){const e=ex(id);if(!e)return;Object.assign(e,{name,category,increment,defaultExtras});}
    else state.exercises.push({id:uid(),name,category,increment,defaultExtras});
    persist();hideModal();render();toast('Ejercicio guardado');return;
  }
}

document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button){event.preventDefault();handleAction(button);}});
document.addEventListener('submit',event=>{const form=event.target.closest('[data-form]');if(form){event.preventDefault();handleForm(form);}});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='one-rm'){const n=number(el.value);const hint=document.getElementById('rm-hint');if(hint)hint.textContent=n>0?`Como referencia, el 50 % del 1RM equivale a ${fmt(n*.5)} ${u()}. Elegí tu carga inicial según tus sensaciones.`:'No calculamos el 1RM automáticamente.';}
  if(el.dataset.draftNotes!==undefined && state.draft){state.draft.notes=el.value;persist();return;}
  if(!state.draft||!el.dataset.eid)return;
  const entry=state.draft.entries.find(e=>e.id===el.dataset.eid);if(!entry)return;
  const target=el.dataset.part==='bilbo'?entry.bilbo:entry.extras[+el.dataset.index];if(!target)return;
  target[el.dataset.key]=el.value;persist();
  if(el.dataset.part==='bilbo' && ['weight','reps'].includes(el.dataset.key)){
    const node=Array.from(document.querySelectorAll('[data-rm-for]')).find(x=>x.dataset.rmFor===entry.id);
    if(node){const value=estimateBilbo1RM(entry.bilbo.weight,entry.bilbo.reps);node.textContent=value===null?'—':`${fmt(value)} ${u()}`;}
  }
});
document.addEventListener('change', async event=>{
  const el=event.target;
  if(el.dataset.filter==='history'){selectedHistoryDay=el.value;render();}
  if(el.dataset.filter==='chart'){selectedChart=el.value;render();}
  if(el.id==='backup-file' && el.files?.[0]){
    try {
      if(el.files[0].size>12*1024*1024)throw new Error('El respaldo supera los 12 MB');
      const raw=await el.files[0].text();const incoming=validateBackup(JSON.parse(raw));
      if(!confirmAction('¿Reemplazar TODOS los datos de este dispositivo por este respaldo? Se perderán los datos locales actuales que no estén en ese archivo.'))return;
      state=incoming;selectedDay=state.days[0]?.id;selectedChart=state.exercises[0]?.id;persist();render();toast('Respaldo importado');
    }catch(error){toast(error instanceof SyntaxError?'El archivo no es un JSON válido':error.message);}
  }
});
window.addEventListener('hashchange',()=>{page=location.hash.replace('#','')||'inicio';render();});
window.addEventListener('keydown',event=>{if(event.key==='Escape')hideModal();});
window.addEventListener('online',()=>render());window.addEventListener('offline',()=>render());
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;});
function updateTimer(){const slot=document.getElementById('timer-slot');if(!slot)return;if(!restUntil){slot.innerHTML='';return;}const seconds=Math.max(0,Math.ceil((restUntil-Date.now())/1000));if(!seconds){restUntil=null;slot.innerHTML='';navigator.vibrate?.([150,80,150]);toast('Descanso terminado');return;}slot.innerHTML=`<div class="timer-float" role="timer" aria-label="Descanso restante"><div>${svg('clock')} <strong>Descanso</strong></div><span class="timer-num">${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}</span><button class="icon-btn" aria-label="Cancelar temporizador" data-action="stop-timer">×</button></div>`;}
setInterval(updateTimer,1000);
render();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(error=>console.warn('Service worker:',error)));}