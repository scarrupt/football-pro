import { db } from './db.js';

let _scheduledTimer = null;

// ─── Init (called on app start) ───────────────────────────────────────────

export async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const [enabledRec, timeRec] = await Promise.all([
    db.get('settings', 'notificationsEnabled'),
    db.get('settings', 'reminderTime'),
  ]);
  if (!enabledRec?.value) return;
  _scheduleForToday(timeRec?.value ?? '16:00');
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

export async function getNotificationSettings() {
  const [en, tm] = await Promise.all([
    db.get('settings', 'notificationsEnabled'),
    db.get('settings', 'reminderTime'),
  ]);
  return { enabled: en?.value ?? false, time: tm?.value ?? '16:00' };
}

export async function saveNotificationSettings({ enabled, time }) {
  await Promise.all([
    db.put('settings', { key: 'notificationsEnabled', value: enabled }),
    db.put('settings', { key: 'reminderTime',         value: time  }),
  ]);
  _clearTimer();
  if (enabled && Notification.permission === 'granted') _scheduleForToday(time);
}

// ─── Private ──────────────────────────────────────────────────────────────

function _clearTimer() {
  if (_scheduledTimer !== null) { clearTimeout(_scheduledTimer); _scheduledTimer = null; }
}

function _scheduleForToday(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const now    = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const delay  = target.getTime() - now.getTime();
  if (delay <= 0) return;
  _scheduledTimer = setTimeout(_fire, delay);
}

function _fire() {
  _scheduledTimer = null;
  if (Notification.permission !== 'granted') return;
  new Notification('⚽ Time to train!', {
    body:  "Your training session is waiting. Let's go! 💪",
    icon:  './icons/icon.svg',
    badge: './icons/icon.svg',
    tag:   'fpip-reminder',
  });
}
