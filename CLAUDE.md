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
├── css/app.css             # All styles (1600+ lines, CSS custom properties throughout)
├── u14_academy_sessions.json  # Training programme reference data (see README.md)
└── js/
    ├── app.js              # Entry: state, navigate(), showModal(), showToast(), loadState(), init()
    ├── db.js               # IndexedDB wrapper (open, get, getAll, getByIndex, getRange, put, delete, count)
    ├── constants.js        # SESSION_TYPES, MOODS, BADGE_DEFINITIONS, MOTIVATIONAL_QUOTES
    ├── utils.js            # Date helpers, formatDuration, genId, calculateStreak
    ├── badges.js           # checkAndAwardBadges(sessions, badges, streak) → new badge IDs[]
    └── pages/
        ├── home.js         # Dashboard: greeting, streak, today's plan, quick-start row, quote
        ├── planner.js      # Weekly planner + showAddToPlannerModal(dateKey, callback)
        ├── log.js          # Session logging form (type picker → details → save)
        ├── progress.js     # Stats, SVG bar chart, training mix, recent sessions
        └── badges_page.js  # Badge grid (earned/locked states)
```

## Architecture

**State:** `state` object in `app.js` holds everything in memory. Call `loadState()` to refresh from IndexedDB after any write. All pages import `state` directly.

**Navigation:** `navigate(page, params)` in `app.js` swaps page content and updates the bottom nav. Pages are strings: `'home'`, `'planner'`, `'log'`, `'progress'`, `'badges_page'`. The `log` page accepts `params: { type?, plannerId?, date? }`.

**Modals:** `showModal(html, options)` / `closeModal()` in `app.js` drives a single slide-up modal sheet. Planner uses this for type-picking and item actions.

**Session logging flow:**
1. User taps FAB `+` → `navigate('log')` — no pre-selected type
2. User taps "Log it →" on a planner item → `navigate('log', { type, plannerId, date })`
3. `log.js` skips the type picker if `params.type` is set
4. On save: calls `saveSessionAndCheckBadges(session)` in `app.js`, which saves to DB, reloads state, checks badges, shows toasts

**Planner ↔ Log interaction:** A planner item has `{ id, date, type, done, sessionId }`. When a session is logged with a `plannerId`, `log.js` updates `planner.done = true` and `planner.sessionId = session.id` in the DB.

**Badge system:** `checkAndAwardBadges` in `badges.js` runs after every session save. It checks all 12 badge conditions against the current sessions array + streak. Returns newly earned IDs that haven't been saved to the `badges` store yet.

**Streak calculation:** `calculateStreak(sessions)` in `utils.js` counts consecutive days backwards from today where at least one session was logged.

## Data schemas

```javascript
// IndexedDB stores:
sessions: { id, date:'YYYY-MM-DD', type, duration, difficulty, mood, notes, timestamp, plannerId? }
planner:  { id, date:'YYYY-MM-DD', type, done, sessionId? }
badges:   { id, earned:true, earnedDate:ISO }
settings: { key:'playerName', value:'...' } | { key:'streak', value:{current,longest,lastDate} }
```

## Training data (u14_academy_sessions.json)

See `README.md` for full schema reference. Key notes:
- All distances in metres (fields ending `_ft` are feet)
- `acl_warning: true` must always render a visible warning in any UI
- `dribbling` has 6 modules — player picks one per session
- `football_intelligence` has no sets/reps — it is a structured guide
- `fifa_11plus` has a `pre_match_protocol` field — separate mode
- FIFA 11+ requires minimum 2× per week for effectiveness
