import { emptyState, validateBackup } from './core.js';
const KEY = 'bilbopocket:v1';
export function loadState() {
  try { const raw = localStorage.getItem(KEY); return raw ? validateBackup(JSON.parse(raw)) : emptyState(); }
  catch(e) { console.warn('No se pudo recuperar la información:', e); return emptyState(); }
}
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch(e) { console.error('Error guardando:', e); return false; }
}
export function exportState(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}
export { KEY as STORAGE_KEY };
