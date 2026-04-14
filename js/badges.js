import { BADGE_DEFINITIONS } from './constants.js';
import { getWeekId } from './utils.js';

/**
 * The 9 core training types required for the 'all_types' badge
 */
const ALL_TRAINING_TYPE_IDS = [
  'dribbling', 'passing', 'shooting', 'speed',
  'upper_body', 'lower_body', 'rhythmic', 'fifa11', 'match_watch',
];

/**
 * Check all badge conditions and return array of newly earned badge IDs.
 *
 * @param {Array} sessions     - All logged sessions
 * @param {Array} earnedBadges - Already earned badge records (each has an `id`)
 * @param {number} streak      - Current training streak (days)
 * @returns {string[]}         - Newly earned badge IDs
 */
export function checkAndAwardBadges(sessions, earnedBadges, streak) {
  const alreadyEarned = new Set(earnedBadges.map(b => b.id));
  const newlyEarned   = [];

  function check(id, condition) {
    if (!alreadyEarned.has(id) && condition) {
      newlyEarned.push(id);
    }
  }

  // Exclude rest days from training session counts
  const trainingSessions = sessions.filter(s => s.type !== 'rest');

  // first_session
  check('first_session', trainingSessions.length >= 1);

  // streak badges
  check('streak_3',  streak >= 3);
  check('streak_7',  streak >= 7);
  check('streak_14', streak >= 14);

  // session count badges
  check('sessions_10', trainingSessions.length >= 10);
  check('sessions_25', trainingSessions.length >= 25);
  check('sessions_50', trainingSessions.length >= 50);

  // matches_5
  const matchCount = sessions.filter(s => s.type === 'match').length;
  check('matches_5', matchCount >= 5);

  // all_types: tried all 9 training types at least once
  const triedTypes = new Set(sessions.map(s => s.type));
  const allTypesEarned = ALL_TRAINING_TYPE_IDS.every(t => triedTypes.has(t));
  check('all_types', allTypesEarned);

  // fifa11_week: 2+ fifa11 sessions in any single calendar week
  if (!alreadyEarned.has('fifa11_week')) {
    const fifa11Sessions = sessions.filter(s => s.type === 'fifa11');
    const weekCounts = {};
    for (const s of fifa11Sessions) {
      const wid = getWeekId(new Date(s.date + 'T00:00:00'));
      weekCounts[wid] = (weekCounts[wid] || 0) + 1;
    }
    const hasFifa11Week = Object.values(weekCounts).some(c => c >= 2);
    check('fifa11_week', hasFifa11Week);
  }

  // perfect_week: every day Mon–Sun in any week has at least 1 session
  if (!alreadyEarned.has('perfect_week')) {
    // Group sessions by week, then by date
    const weekDates = {};
    for (const s of sessions) {
      const wid = getWeekId(new Date(s.date + 'T00:00:00'));
      if (!weekDates[wid]) weekDates[wid] = new Set();
      weekDates[wid].add(s.date);
    }
    // A perfect week has sessions on all 7 days
    const hasPerfectWeek = Object.values(weekDates).some(dateSet => dateSet.size >= 7);
    check('perfect_week', hasPerfectWeek);
  }

  // early_bird: any session was logged before 8am (check timestamp)
  if (!alreadyEarned.has('early_bird')) {
    const hasEarlySession = sessions.some(s => {
      if (!s.timestamp) return false;
      const d = new Date(s.timestamp);
      return d.getHours() < 8;
    });
    check('early_bird', hasEarlySession);
  }

  return newlyEarned;
}
