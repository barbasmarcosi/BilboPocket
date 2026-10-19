export const SCHEMA_VERSION = 1;

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const localDate = (iso = new Date()) => {
  const d = iso instanceof Date ? iso : new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
export const number = (value, fallback = 0) => {
  if (value === '' || value === undefined || value === null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
export const roundTo = (n, digits = 2) => Number(n.toFixed(digits));
export const fmt = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(number(n));
export const escapeHTML = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const formatDate = (iso) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(iso).slice(0,10)}T12:00:00`));

export const starterExercises = [
  { id: 'bench', name: 'Press de banca', category: 'Pecho', increment: 2.5, defaultExtras: 2 },
  { id: 'incline', name: 'Press inclinado', category: 'Pecho', increment: 2.5, defaultExtras: 2 },
  { id: 'ohp', name: 'Press militar', category: 'Hombro', increment: 1.25, defaultExtras: 2 },
  { id: 'dips', name: 'Fondos', category: 'Pecho', increment: 2.5, defaultExtras: 2 },
  { id: 'row', name: 'Remo con barra', category: 'Espalda', increment: 2.5, defaultExtras: 2 },
  { id: 'pulldown', name: 'Jalón al pecho', category: 'Espalda', increment: 2.5, defaultExtras: 2 },
  { id: 'squat', name: 'Sentadilla', category: 'Piernas', increment: 2.5, defaultExtras: 2 },
  { id: 'legpress', name: 'Prensa', category: 'Piernas', increment: 5, defaultExtras: 2 },
  { id: 'curl', name: 'Curl de bíceps', category: 'Brazos', increment: 1, defaultExtras: 2 },
];
export const starterDays = [
  { id: 'push', name: 'Empuje', emoji: '↗', exerciseIds: ['bench', 'incline', 'ohp', 'dips'] },
  { id: 'pull', name: 'Tirón', emoji: '↙', exerciseIds: ['row', 'pulldown', 'curl'] },
  { id: 'legs', name: 'Piernas', emoji: '⚡', exerciseIds: ['squat', 'legpress'] },
];
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { units: 'kg', restSeconds: 150, userName: '', onboardingDone: false },
    exercises: structuredClone(starterExercises),
    days: structuredClone(starterDays),
    cycles: [], sessions: [], draft: null,
  };
}
export function allBilboSets(sessions, exerciseId, cycleId = null) {
  return sessions.flatMap(s => (s.entries || [])
    .filter(e => e.exerciseId === exerciseId && e.bilbo && (cycleId === null || e.bilbo.cycleId === cycleId))
    .map(e => ({ ...e.bilbo, date: s.date, completedAt: s.completedAt ?? s.startedAt ?? `${s.date}T00:00:00`, sessionId: s.id })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.completedAt.localeCompare(b.completedAt) || String(a.sessionId).localeCompare(String(b.sessionId)));
}
// Fórmula utilizada en ejemplos publicados de la planilla Bilbo: carga × (1 + 0,03 × repeticiones).
// No se ajusta por RIR. Es una estimación orientativa, no una prueba directa del 1RM.
export function estimateBilbo1RM(weight, reps) {
  const w = Number(weight), r = Number(reps);
  if (!Number.isFinite(w) || w <= 0 || !Number.isInteger(r) || r < 1 || r > 500) return null;
  return roundTo(w * (1 + 0.03 * r));
}
export function bilboRmSeries(sessions, exerciseId, cycleId = null) {
  return allBilboSets(sessions, exerciseId, cycleId).flatMap(set => {
    const estimatedRM = estimateBilbo1RM(set.weight, set.reps);
    return estimatedRM === null ? [] : [{ ...set, estimatedRM }];
  });
}

export function activeCycle(state, exerciseId) {
  return state.cycles.find(c => c.exerciseId === exerciseId && c.status === 'active') ?? null;
}
export function nextPrescription(cycle, sessions) {
  if (!cycle) return { status: 'unconfigured', label: 'Sin ciclo configurado', weight: null };
  const sets = allBilboSets(sessions, cycle.exerciseId, cycle.id);
  const last = sets.at(-1);
  if (!last) return { status: 'start', label: 'Inicio del ciclo', weight: cycle.startLoad, last: null };
  if (last.reps <= cycle.minReps) return { status: 'review', label: 'Evaluá cerrar el ciclo', weight: last.weight, last };
  if (last.rir < 1 || last.speed === 'lenta') return { status: 'hold', label: 'Repetí la carga y priorizá técnica', weight: last.weight, last };
  return { status: 'increase', label: `Sugerencia: +${fmt(cycle.increment)} kg`, weight: roundTo(last.weight + cycle.increment), last };
}
export function sessionVolume(session) {
  return roundTo((session.entries || []).reduce((total, e) => total + (e.bilbo ? number(e.bilbo.weight) * number(e.bilbo.reps) : 0) + (e.extras || []).reduce((t, s) => t + number(s.weight) * number(s.reps), 0), 0));
}
export function sessionSets(session) {
  return (session.entries || []).reduce((t, e) => t + (e.bilbo?.reps > 0 ? 1 : 0) + (e.extras || []).filter(x => x.reps > 0).length, 0);
}
export function stats(state) {
  const sets = state.sessions.flatMap(s => s.entries.flatMap(e => e.bilbo?.reps > 0 ? [e.bilbo] : []));
  const sorted = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const dates = new Set(state.sessions.map(x => x.date));
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0,0,0,0); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const workoutsThisWeek = state.sessions.filter(s => new Date(`${s.date}T12:00:00`) >= weekStart).length;
  return { workouts: state.sessions.length, bilboSets: sets.length, volume: state.sessions.reduce((t,s) => t + sessionVolume(s), 0), workoutsThisWeek, uniqueDays: dates.size, last: sorted[0] ?? null };
}
export function workoutForDay(state, dayId, now = new Date()) {
  const day = state.days.find(d => d.id === dayId);
  if (!day) throw new Error('Día inválido');
  const last = [...state.sessions].filter(s => s.dayId === dayId).sort((a,b) => b.date.localeCompare(a.date))[0];
  const exIds = [...day.exerciseIds];
  if (last) for (const e of last.entries) if (state.exercises.some(x => x.id === e.exerciseId) && !exIds.includes(e.exerciseId)) exIds.push(e.exerciseId);
  return {
    id: uid(), dayId, date: localDate(now), startedAt: now.toISOString(), notes: '',
    entries: exIds.map(exerciseId => {
      const ex = state.exercises.find(x => x.id === exerciseId);
      const cycle = activeCycle(state, exerciseId);
      const suggestion = nextPrescription(cycle, state.sessions);
      const old = last?.entries.find(e => e.exerciseId === exerciseId);
      return { id: uid(), exerciseId, bilbo: { cycleId: cycle?.id ?? null, weight: suggestion.weight ?? old?.bilbo?.weight ?? 0, reps: '', rir: 2, speed: 'explosiva' },
        extras: (old?.extras?.length ? old.extras : Array.from({length: ex?.defaultExtras ?? 2}, () => ({weight: '', reps: '', rir: 2}))).map(x => ({ weight: x.weight, reps: '', rir: x.rir ?? 2 })), notes: '' };
    }),
  };
}
export function validateSet(s) {
  return s && Number.isFinite(+s.weight) && +s.weight >= 0 && Number.isInteger(+s.reps) && +s.reps >= 1 && +s.reps <= 500 && Number.isFinite(+s.rir) && +s.rir >= 0 && +s.rir <= 20;
}
export function finalizeWorkout(state, draft) {
  if (!draft?.entries?.length) throw new Error('Agregá al menos un ejercicio');
  const entries = draft.entries.map(e => {
    const b = validateSet(e.bilbo) && +e.bilbo.weight > 0 ? { ...e.bilbo, weight: +e.bilbo.weight, reps: +e.bilbo.reps, rir: +e.bilbo.rir } : null;
    const extras = (e.extras || []).filter(x => validateSet(x) && +x.weight > 0).map(x => ({ weight: +x.weight, reps: +x.reps, rir: +x.rir }));
    return { id: e.id, exerciseId: e.exerciseId, bilbo: b, extras, notes: String(e.notes || '').slice(0, 1000) };
  }).filter(x => x.bilbo || x.extras.length);
  if (!entries.length) throw new Error('Registrá al menos una serie con carga y repeticiones válidas');
  return { id: draft.id, date: draft.date, dayId: draft.dayId, startedAt: draft.startedAt, completedAt: new Date().toISOString(), notes: String(draft.notes || '').slice(0, 2000), entries };
}
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object' || obj.schemaVersion !== SCHEMA_VERSION) throw new Error('Respaldo incompatible con esta versión');
  if (!Array.isArray(obj.exercises) || !Array.isArray(obj.days) || !Array.isArray(obj.cycles) || !Array.isArray(obj.sessions)) throw new Error('Estructura del respaldo inválida');
  if (obj.exercises.length > 1000 || obj.sessions.length > 30000 || obj.days.length > 1000 || obj.cycles.length > 5000) throw new Error('Respaldo demasiado grande');
  if (!obj.settings || !Array.isArray(obj.days?.[0]?.exerciseIds ?? []) || obj.sessions.some(s => !Array.isArray(s.entries))) throw new Error('Datos incompletos');
  return obj;
}
export function weeklyVolume(sessions, weeks = 8) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(d); start.setDate(start.getDate() - i * 7);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const volume = sessions.filter(s => {
      const date = new Date(`${s.date}T12:00:00`); return date >= start && date < end;
    }).reduce((t,s) => t + sessionVolume(s), 0);
    out.push({ label: `${start.getDate()}/${start.getMonth()+1}`, volume });
  }
  return out;
}
