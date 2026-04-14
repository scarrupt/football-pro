import { db } from './db.js';

/**
 * Exports all user data to a downloadable JSON backup file.
 */
export async function exportData() {
  const [sessions, planner, badges, settings] = await Promise.all([
    db.getAll('sessions'),
    db.getAll('planner'),
    db.getAll('badges'),
    db.getAll('settings'),
  ]);

  const payload = {
    appVersion: '1.2',
    exportedAt: new Date().toISOString(),
    sessions,
    planner,
    badges,
    settings,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `football-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Imports a backup JSON file into IndexedDB (merges, existing records are overwritten).
 * Returns { sessions, planner, badges } import counts.
 */
export async function importData(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error('Invalid JSON file — could not parse');
  }
  if (!Array.isArray(payload.sessions)) {
    throw new Error('Invalid backup: missing sessions array');
  }

  const ops = [
    ...(payload.sessions || []).map(r => db.put('sessions', r)),
    ...(payload.planner  || []).map(r => db.put('planner',  r)),
    ...(payload.badges   || []).map(r => db.put('badges',   r)),
    ...(payload.settings || []).map(r => db.put('settings', r)),
  ];
  await Promise.all(ops);

  return {
    sessions: (payload.sessions || []).length,
    planner:  (payload.planner  || []).length,
    badges:   (payload.badges   || []).length,
  };
}
