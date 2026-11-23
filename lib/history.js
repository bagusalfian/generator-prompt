// Riwayat prompt di localStorage — fungsi murni yang menerima objek storage
// (window.localStorage di aplikasi, mock di pengujian runtime).

export const HISTORY_KEY = 'generator-prompt-riwayat-v1';
export const MAX_HISTORY = 20;

export function loadHistory(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.id === 'string' && Array.isArray(e.prompts),
    );
  } catch {
    return [];
  }
}

export function saveHistory(storage, list) {
  if (!storage) return false;
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function addHistoryEntry(list, entry) {
  const next = [entry, ...list].slice(0, MAX_HISTORY);
  return next;
}

export function removeHistoryEntry(list, id) {
  return list.filter((e) => e.id !== id);
}

export function makeHistoryEntry({ judul, prompts }) {
  return {
    id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    judul: (judul || '').trim() || 'Tanpa judul',
    tanggal: new Date().toISOString(),
    jumlahAdegan: prompts.length,
    prompts,
  };
}
