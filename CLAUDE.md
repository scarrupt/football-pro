# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Progressive Web App (PWA) for a 13-year-old football (soccer) player to track training, plan her week, and monitor progress. It works fully offline — all data is stored in IndexedDB, all assets are cached by the Service Worker. No build step, no dependencies, no backend.

## Running the app

A local HTTP server is required (ES modules + Service Worker need an HTTP origin, not `file://`):

```bash
# Python (built-in)
python3 -m http.server 8080

# Node.js
npx serve .

# Then open: http://localhost:8080
```

The app is installable as a PWA ("Add to Home Screen") once served over HTTPS or localhost.

## File structure

```
fpip/
├── index.html              # App shell: splash, header, page-content, bottom nav, modal, toasts
├── manifest.json           # PWA manifest (purple theme, SVG icon)
├── sw.js                   # Service Worker — cache-first, pre-caches all static assets
├── icons/icon.svg          # App icon (gradient background + ⚽)
├── css/app.css             # All styles (CSS custom properties throughout)
├── u14_academy_sessions.json  # Training programme reference data (see README.md)
└── js/
    ├── app.js              # Entry: state, navigate(), navigateBack(), showModal(), showToast(), loadState(), init()
    ├── db.js               # IndexedDB wrapper (open, get, getAll, getByIndex, getRange, put, delete, count)
    ├── constants.js        # SESSION_TYPES, TRAINING_TYPES, MOODS, BADGE_DEFINITIONS, MOTIVATIONAL_QUOTES
    ├── utils.js            # Date helpers, formatDuration, genId, calculateStreak
    ├── badges.js           # checkAndAwardBadges(sessions, badges, streak) → new badge IDs[]
    ├── notifications.js    # Training reminder notifications (schedules daily reminder at configured time)
    ├── export.js           # Exports all IndexedDB data as downloadable JSON backup
    └── pages/
        ├── home.js         # Dashboard: greeting, streak, today's plan, quick-start row, quote
        ├── planner.js      # Weekly planner + showAddToPlannerModal(dateKey, callback)
        ├── log.js          # Session logging form (type picker → details → save)
        ├── progress.js     # Stats, SVG bar chart, training mix, personal bests, session history
        ├── badges_page.js  # Badge grid (earned/locked states)
        ├── player.js       # Guided session player: step rendering, level/module selector, rest/interval timers, wake lock
        └── match_watch.js  # Football Intelligence UI: phase-based guide (before/1st half/HT/2nd half/after)
```

## Architecture

**State:** `state` object in `app.js` holds everything in memory. Call `loadState()` to refresh from IndexedDB after any write. All pages import `state` directly.

**Navigation:** `navigate(page, params)` pushes to an internal `_navHistory` stack and swaps page content. `navigateBack()` pops the stack and returns to the previous page. Pages are strings: `'home'`, `'planner'`, `'log'`, `'progress'`, `'badges_page'`, `'player'`. The `log` page accepts `params: { type?, plannerId?, date?, editSession? }`.

**Modals:** `showModal(html, options)` / `closeModal()` in `app.js` drives a single slide-up modal sheet. Planner uses this for type-picking and item actions.

**Session logging flow:**
1. User taps FAB `+` → `navigate('log')` — no pre-selected type
2. User taps "Log it →" on a planner item → `navigate('log', { type, plannerId, date })`
3. User taps "✏️ Edit session" on a done planner item → `navigate('log', { editSession: session })`
4. `log.js` skips the type picker if `params.type` or `params.editSession` is set
5. On save: calls `saveSessionAndCheckBadges(session)` in `app.js`, which saves to DB, reloads state, checks badges, shows toasts, then calls `navigateBack()`
6. Save button is disabled immediately on click to prevent double-submission

**Planner ↔ Log interaction:** A planner item has `{ id, date, type, done, sessionId }`. When a session is logged with a `plannerId`, `log.js` updates `planner.done = true` and `planner.sessionId = session.id` in the DB. Tapping a done planner item shows a session summary modal (duration, difficulty stars, mood, guided sessions used, notes) with an "✏️ Edit session" button.

**Guided session player:** `player.js` renders a step-by-step exercise guide loaded from `u14_academy_sessions.json`. On completion, the done screen offers "📝 Log this session" → `navigate('log', { type })` or "Exit without logging" → `navigateBack()`. `match_watch.js` handles Football Intelligence as a special phase-based UI.

**Badge system:** `checkAndAwardBadges` in `badges.js` runs after every session save. It checks all 12 badge conditions against the current sessions array + streak. Returns newly earned IDs that haven't been saved to the `badges` store yet.

**Streak calculation:** `calculateStreak(sessions)` in `utils.js` counts consecutive days backwards from today where at least one session was logged.

## Constants

- `SESSION_TYPES` — all session types including match, team_training, rest (used for type pickers and colour coding)
- `TRAINING_TYPES` — SESSION_TYPES filtered to exclude match, team_training, rest — the 9 types that have guided sessions in `u14_academy_sessions.json`

## Data schemas

```javascript
// IndexedDB stores:
sessions: {
  id, date:'YYYY-MM-DD', type, duration, difficulty, mood, notes, timestamp,
  plannerId?,           // links to a planner item
  guidedSessions?,      // string[] — TRAINING_TYPES ids of guided sessions used
  testResults?,         // { name:string, value:number, unit:'s'|'reps'|'m' }[]
  // match/team_training extras (if applicable):
  opponent?, result?, goalsFor?, goalsAgainst?, playerGoals?, playerAssists?,
}
planner:  { id, date:'YYYY-MM-DD', type, done, sessionId? }
badges:   { id, earned:true, earnedDate:ISO }
settings: { key:'playerName', value:'...' } | { key:'streak', value:{current,longest,lastDate} }
         | { key:'notificationsEnabled', value:boolean } | { key:'reminderTime', value:'HH:MM' }
```

## Progress tab

- **Personal Bests** section: collects all `session.testResults` across sessions, groups by test name, shows 🏆 PB chip, trend delta from first to latest, and last 5 attempts with PB rows highlighted in gold. For unit `'s'` (seconds), lower is better; for `'reps'`/`'m'`, higher is better.
- **Session History** (formerly "Recent Sessions"): shows all sessions (no cap), grouped by date with `isToday()` / `formatDayFull()` headers.

## Training data (u14_academy_sessions.json)

See `README.md` for full schema reference. Key notes:
- All distances in metres (fields ending `_ft` are feet)
- `acl_warning: true` must always render a visible warning in any UI
- `dribbling` has 6 modules — player picks one per session; each module has one timed test (seconds, lower=better)
- `football_intelligence` has no sets/reps — it is a structured guide handled by `match_watch.js`
- `fifa_11plus` has a `pre_match_protocol` field — separate mode
- FIFA 11+ requires minimum 2× per week for effectiveness
- Only `dribbling` modules have embedded tests in the training data; other session types have no tests
