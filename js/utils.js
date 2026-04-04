/**
 * Returns 'YYYY-MM-DD' for today (local time)
 */
export function getTodayKey() {
  return dateToKey(new Date());
}

/**
 * Returns 'YYYY-MM-DD' for any Date object (local time)
 */
export function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a Date object (local midnight) from 'YYYY-MM-DD' string
 */
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Returns the Monday of the week containing the given date.
 * Adjusts so Monday is day 0.
 */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Convert to Mon=0 .. Sun=6
  const offset = (day === 0) ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns array of 7 date keys (Mon–Sun) for the week containing dateKey
 */
export function getWeekKeys(dateKey) {
  const monday = getWeekStart(keyToDate(dateKey));
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.push(dateToKey(d));
  }
  return keys;
}

/**
 * Formats a date key as "Monday 4 April 2026"
 */
export function formatDayFull(dateKey) {
  const date = keyToDate(dateKey);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats a date key as "4 Apr"
 */
export function formatDayShort(dateKey) {
  const date = keyToDate(dateKey);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Returns true if dateKey is today
 */
export function isToday(dateKey) {
  return dateKey === getTodayKey();
}

/**
 * Returns true if dateKey is strictly in the past
 */
export function isPast(dateKey) {
  return dateKey < getTodayKey();
}

/**
 * Formats minutes as "1h 30m" or "45m"
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Generates a unique ID using crypto.randomUUID() or fallback
 */
export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Returns the ISO week identifier 'YYYY-WW' for a date
 */
export function getWeekId(date) {
  // ISO week: week containing Thursday of the year
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday in current week: ISO week starts on Monday
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  // Jan 4 is always in week 1
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  const year = d.getFullYear();
  return `${year}-${String(weekNum).padStart(2, '0')}`;
}

/**
 * Calculates current streak from sessions array.
 * A streak is consecutive days (including today) each having at least 1 session.
 * sessions: array of session objects with a `date` property ('YYYY-MM-DD')
 */
export function calculateStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0;

  // Build a Set of unique date keys
  const datesWithSession = new Set(sessions.map(s => s.date));

  const today = getTodayKey();
  let streak = 0;
  let current = keyToDate(today);

  // Walk backwards from today
  while (true) {
    const key = dateToKey(current);
    if (datesWithSession.has(key)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
