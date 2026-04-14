import { navigate, navigateBack, saveSessionAndCheckBadges, showToast, loadState } from '../app.js';
import { genId, getTodayKey } from '../utils.js';
import { db } from '../db.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const FI_KEY = 'fi_session';

const PHASES = [
  { id: 'before',      short: 'BEFORE' },
  { id: 'first_half',  short: '1ST'    },
  { id: 'half_time',   short: 'HT'     },
  { id: 'second_half', short: '2ND'    },
  { id: 'after',       short: 'AFTER'  },
];

const TRAINING_SESSIONS = [
  'Shooting', 'Passing', 'Dribbling', 'Speed Training',
  'Rhythmic Movement', 'Upper Body', 'Lower Body', 'FIFA 11+',
];

// ─── Wake lock ────────────────────────────────────────────────────────────────
let _wakeLock = null;

async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || _wakeLock) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => { _wakeLock = null; });
  } catch (_) {}
}

function releaseWakeLock() {
  if (_wakeLock) { _wakeLock.release().catch(() => {}); _wakeLock = null; }
}

// ─── Module state ─────────────────────────────────────────────────────────────
let _c              = null;
let _sess           = null;
let _fi             = null;
let _plannerId      = null;
let _editSession    = null;
let _spaceIv        = null;
let _shadowIv       = null;
let _shadowRemain   = 0;
let _jsonCache      = null;

// ─── Persistence ──────────────────────────────────────────────────────────────
function saveFi()  { localStorage.setItem(FI_KEY, JSON.stringify(_fi)); }
function clearFi() { localStorage.removeItem(FI_KEY); }

function freshFi() {
  return {
    phase: 'before',
    focalId: null,
    tallyAction: null,
    shadowPlayer: '',
    tally: { first: 0, second: 0 },
    pauses: { first: 0, second: 0 },
    htIdx: 0,
    htAnswers: {},
    afterStage: 0,
    afterAnswers: { saw: {}, learned: {}, will: {} },
    spaceOn: false,
    expandedCard: 'tally_task',
    showSummary: false,
  };
}

function fiFromEditSession(es) {
  const fd = es.fiData || {};
  return {
    ...freshFi(),
    focalId:      fd.focalPointId || null,
    tallyAction:  fd.tallyAction  || null,
    shadowPlayer: fd.shadowPlayer || '',
    tally:        fd.tally        || { first: 0, second: 0 },
    pauses:       fd.pauses       || { first: 0, second: 0 },
    htAnswers:    fd.htAnswers    || {},
    afterAnswers: fd.afterAnswers || { saw: {}, learned: {}, will: {} },
    afterStage:   2,
    phase:        'after',
    showSummary:  true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function phaseIdx(id)  { return PHASES.findIndex(p => p.id === id); }
function focalPoint()  { return (_sess?.focal_points || []).find(fp => fp.id === _fi.focalId); }
function htQuestions() { return _sess.half_time[0].questions; }
function halfKey()     { return _fi.phase === 'second_half' ? 'second' : 'first'; }

function advanceTo(phase) {
  stopIntervals();
  _fi.phase = phase;
  saveFi();
  render();
}

async function loadData() {
  if (_jsonCache) return _jsonCache;
  const r = await fetch('./u14_academy_sessions.json');
  _jsonCache = await r.json();
  return _jsonCache;
}

// ─── Interval management ─────────────────────────────────────────────────────
function stopIntervals() {
  if (_spaceIv)  { clearInterval(_spaceIv);  _spaceIv  = null; }
  if (_shadowIv) { clearInterval(_shadowIv); _shadowIv = null; }
}

function startSpaceInterval() {
  if (_spaceIv) return;
  _spaceIv = setInterval(() => {
    const card = _c?.querySelector('[data-task="find_space"]');
    if (!card) return;
    card.classList.add('fi-space-pulse');
    setTimeout(() => card?.classList.remove('fi-space-pulse'), 5000);
  }, 10 * 60 * 1000);
}

// ─── Phase bar ────────────────────────────────────────────────────────────────
function htmlPhaseBar() {
  const cur = phaseIdx(_fi.phase);
  return `<div class="fi-phase-bar">
    ${PHASES.map((p, i) => `
      <div class="fi-ps${i < cur ? ' fi-ps-done' : i === cur ? ' fi-ps-active' : ''}">
        <div class="fi-ps-dot"></div>
        <div class="fi-ps-name">${p.short}</div>
      </div>${i < PHASES.length - 1 ? '<div class="fi-ps-line"></div>' : ''}`
    ).join('')}
  </div>`;
}

// ─── Phase 1: Before ─────────────────────────────────────────────────────────
function htmlFpCard(fp) {
  const sel = _fi.focalId === fp.id;
  const svg = fp.diagram?.svg || '';
  return `
    <div class="fi-fp-card${sel ? ' fi-fp-sel' : ''}" data-fpid="${fp.id}" role="radio" aria-checked="${sel}">
      <div class="fi-fp-top">
        <div class="fi-fp-badge${sel ? ' fi-fp-badge-sel' : ''}">${fp.id}</div>
        <div class="fi-fp-info">
          <div class="fi-fp-label">${fp.label}</div>
          <div class="fi-fp-recs">⭐ ${fp.recommended_players.join(' · ')}</div>
        </div>
        <div class="fi-fp-check${sel ? ' fi-fp-check-on' : ''}">✓</div>
      </div>
      ${svg ? `<div class="fi-fp-diagram">${svg}</div>` : ''}
      <button class="fi-fp-toggle" type="button">Focus questions ▾</button>
      <div class="fi-fp-expand">
        ${fp.questions.map(q => `<div class="fi-fp-q">→ ${q}</div>`).join('')}
        <div class="fi-fp-insight">"${fp.insight}"</div>
      </div>
    </div>`;
}

function renderBefore() {
  const fps      = _sess.focal_points;
  const opts     = _sess.during_tasks.find(t => t.id === 'tally_task').options;
  const matches  = _sess.recommended_matches;
  const fp       = focalPoint();
  const canStart = !!((_fi.focalId) && _fi.tallyAction);

  _c.innerHTML = `
    <div class="fi-wrap">
      <div class="fi-sticky-top">${htmlPhaseBar()}</div>
      <div class="fi-content">

        <div class="fi-before-hdr">
          <div class="fi-badge-pill">📺 Match Intelligence</div>
          <h2 class="fi-page-title">Before Kick-off</h2>
          <p class="fi-page-sub">10 min — get set up before the match starts</p>
          <div class="fi-equip">📓 Notepad &nbsp;·&nbsp; 🖊 Pen &nbsp;·&nbsp; 📺 TV or device</div>
        </div>

        <div class="fi-section">
          <div class="fi-sec-hd">Task 1 — Choose your focal point</div>
          <p class="fi-sec-hint">Pick one to watch throughout the whole match</p>
          <div class="fi-fp-grid">
            ${fps.map(htmlFpCard).join('')}
          </div>
        </div>

        <div class="fi-section">
          <div class="fi-sec-hd">Task 2 — Choose your tally action</div>
          <p class="fi-sec-hint">Count this every time it happens — both halves</p>
          <div class="fi-pill-row">
            ${opts.map(opt => `
              <button class="fi-pill${_fi.tallyAction === opt ? ' fi-pill-on' : ''}"
                data-opt="${opt}" type="button">${opt}</button>
            `).join('')}
          </div>
        </div>

        <div class="fi-section">
          <div class="fi-sec-hd">Task 3 — Player to shadow</div>
          <p class="fi-sec-hint">Watch this player in 5-minute blocks during the match</p>
          <input id="shadow-in" class="fi-text-input" type="text"
            placeholder="e.g. Aitana Bonmatí"
            value="${_fi.shadowPlayer}"
            autocomplete="off" autocorrect="off" autocapitalize="words" />
          ${fp ? `<p class="fi-input-hint">💡 Suggested for focal point ${fp.id}: <strong>${fp.recommended_players.join(', ')}</strong></p>` : '<p class="fi-input-hint">Select a focal point to see suggestions</p>'}
        </div>

        <div class="fi-section">
          <div class="fi-sec-hd">Matches to watch for this session</div>
          <div class="fi-matches-scroll">
            ${matches.map(m => `<div class="fi-match-card">${m}</div>`).join('')}
          </div>
        </div>

        <div class="fi-start-zone">
          <button id="fi-start" class="fi-phase-btn${canStart ? '' : ' fi-phase-btn-disabled'}" ${canStart ? '' : 'disabled'}>
            Start watching ▶
          </button>
          ${!canStart ? `<p class="fi-start-hint">Select a focal point and tally action to continue</p>` : ''}
        </div>

      </div>
    </div>`;

  // Focal point selection
  _c.querySelectorAll('.fi-fp-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.fi-fp-toggle')) return;
      _fi.focalId = _fi.focalId === card.dataset.fpid ? null : card.dataset.fpid;
      saveFi();
      renderBefore();
    });
  });

  // Expand/collapse focus questions
  _c.querySelectorAll('.fi-fp-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const expand = btn.nextElementSibling;
      const open   = expand.classList.toggle('fi-fp-expand-open');
      btn.textContent = open ? 'Focus questions ▴' : 'Focus questions ▾';
    });
  });

  // Tally action pills
  _c.querySelectorAll('.fi-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      _fi.tallyAction = _fi.tallyAction === pill.dataset.opt ? null : pill.dataset.opt;
      saveFi();
      renderBefore();
    });
  });

  // Shadow player input
  _c.querySelector('#shadow-in')?.addEventListener('input', e => {
    _fi.shadowPlayer = e.target.value;
    saveFi();
  });

  // Start button
  _c.querySelector('#fi-start')?.addEventListener('click', () => {
    if (_fi.focalId && _fi.tallyAction) {
      acquireWakeLock();
      advanceTo('first_half');
    }
  });
}

// ─── Phase 2 & 4: Half ───────────────────────────────────────────────────────
function htmlCmdBar() {
  const fp       = focalPoint();
  const key      = halfKey();
  const count    = _fi.tally[key];
  const isSecond = _fi.phase === 'second_half';
  return `<div class="fi-cmd-bar">
    <div class="fi-cmd-info">
      <div class="fi-cmd-phase">${isSecond ? '2nd Half' : '1st Half'}</div>
      ${fp ? `<div class="fi-cmd-fp">${fp.id} — ${fp.label}</div>` : ''}
    </div>
    <div class="fi-cmd-tally">
      ${isSecond ? `<div class="fi-tally-1st">1st half: ${_fi.tally.first}</div>` : ''}
      <div class="fi-tally-row">
        <button class="fi-tally-minus" id="tally-minus" aria-label="Decrease tally">−</button>
        <div class="fi-tally-count" id="tally-count">${count}</div>
        <button class="fi-tally-plus" id="tally-plus" aria-label="Increase tally">+</button>
      </div>
      <div class="fi-tally-action-label">${_fi.tallyAction || 'tally'}</div>
    </div>
  </div>`;
}

function htmlTaskCard(task) {
  const open = _fi.expandedCard === task.id;
  const openClass = open ? ' fi-task-open' : '';

  switch (task.id) {
    case 'tally_task': {
      const fp = focalPoint();
      return `
        <div class="fi-task-card${openClass}" data-task="${task.id}">
          <button class="fi-task-hd" data-toggle="${task.id}">
            <span class="fi-task-icon">🔢</span>
            <span class="fi-task-title">Tally task</span>
            <span class="fi-task-chevron">${open ? '▲' : '▼'}</span>
          </button>
          <div class="fi-task-body">
            <div class="fi-task-counting">Counting: <strong>${_fi.tallyAction || '—'}</strong></div>
            ${fp ? `
              <div class="fi-task-sec-label">Your focal point questions:</div>
              ${fp.questions.map(q => `<div class="fi-task-q">→ ${q}</div>`).join('')}
            ` : ''}
          </div>
        </div>`;
    }

    case 'shadow_player': {
      return `
        <div class="fi-task-card${openClass}" data-task="${task.id}">
          <button class="fi-task-hd" data-toggle="${task.id}">
            <span class="fi-task-icon">👁</span>
            <span class="fi-task-title">Shadow ${_fi.shadowPlayer || 'a player'}</span>
            <span class="fi-task-chevron">${open ? '▲' : '▼'}</span>
          </button>
          <div class="fi-task-body">
            <div class="fi-task-counting">${_fi.shadowPlayer ? `Shadowing: <strong>${_fi.shadowPlayer}</strong>` : 'No player set'}</div>
            ${(task.cues || []).map(c => `<div class="fi-task-q">→ ${c}</div>`).join('')}
            <div id="shadow-timer-zone">
              <button class="fi-timer-btn" id="shadow-timer-btn">⏱ Start 5-min shadow block</button>
            </div>
          </div>
        </div>`;
    }

    case 'pause_rewind': {
      const key   = halfKey();
      const count = _fi.pauses[key];
      return `
        <div class="fi-task-card${openClass}" data-task="${task.id}">
          <button class="fi-task-hd" data-toggle="${task.id}">
            <span class="fi-task-icon">⏸</span>
            <span class="fi-task-title">Pause and rewind</span>
            <span class="fi-task-chevron">${open ? '▲' : '▼'}</span>
          </button>
          <div class="fi-task-body">
            <div class="fi-task-sec-label">Pause triggers:</div>
            ${(task.triggers || []).map(t => `<div class="fi-task-q">→ ${t}</div>`).join('')}
            ${(task.cues || []).map(c => `<div class="fi-task-cue">${c}</div>`).join('')}
            <button class="fi-pause-btn" id="log-pause-btn">
              + Log a pause &nbsp;<span class="fi-pause-count" id="pause-count">${count}</span>
            </button>
          </div>
        </div>`;
    }

    case 'find_space': {
      return `
        <div class="fi-task-card${openClass}" data-task="${task.id}">
          <button class="fi-task-hd" data-toggle="${task.id}">
            <span class="fi-task-icon">🔍</span>
            <span class="fi-task-title">Find the space</span>
            <span class="fi-task-chevron">${open ? '▲' : '▼'}</span>
          </button>
          <div class="fi-task-body">
            ${(task.cues || []).map(c => `<div class="fi-task-q">→ ${c}</div>`).join('')}
            <label class="fi-toggle-row">
              <span class="fi-toggle-label">Remind me every 10 min</span>
              <span class="fi-toggle-track">
                <input type="checkbox" class="fi-toggle-cb" id="space-toggle" ${_fi.spaceOn ? 'checked' : ''} />
                <span class="fi-toggle-thumb"></span>
              </span>
            </label>
          </div>
        </div>`;
    }

    default: return '';
  }
}

function renderHalf() {
  const isSecond  = _fi.phase === 'second_half';
  const nextPhase = isSecond ? 'after' : 'half_time';
  const nextLabel = isSecond ? 'Full time →' : 'Half time →';
  const tasks     = _sess.during_tasks;

  _c.innerHTML = `
    <div class="fi-wrap fi-wrap-dark">
      <div class="fi-sticky-top fi-sticky-dark">
        ${htmlPhaseBar()}
        ${htmlCmdBar()}
      </div>
      <div class="fi-content fi-content-dark">
        ${isSecond ? '' : ''}
        <div class="fi-tasks-list">
          ${tasks.map(t => htmlTaskCard(t)).join('')}
        </div>
        <div class="fi-half-foot">
          <button class="fi-phase-btn" id="fi-next-phase">${nextLabel}</button>
          <button class="fi-ghost-btn fi-back-btn" id="fi-back-phase">
            ← Back to ${isSecond ? 'Half Time' : 'Before'}
          </button>
        </div>
      </div>
    </div>`;

  // Tally +/−
  _c.querySelector('#tally-plus')?.addEventListener('click', () => {
    _fi.tally[halfKey()]++;
    saveFi();
    _c.querySelector('#tally-count').textContent = _fi.tally[halfKey()];
  });
  _c.querySelector('#tally-minus')?.addEventListener('click', () => {
    if (_fi.tally[halfKey()] > 0) _fi.tally[halfKey()]--;
    saveFi();
    _c.querySelector('#tally-count').textContent = _fi.tally[halfKey()];
  });

  // Task card expand/collapse
  _c.querySelectorAll('.fi-task-hd').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      _fi.expandedCard = _fi.expandedCard === id ? null : id;
      saveFi();
      renderHalf();
    });
  });

  // Shadow timer
  bindShadowTimer();

  // Pause log
  _c.querySelector('#log-pause-btn')?.addEventListener('click', () => {
    _fi.pauses[halfKey()]++;
    saveFi();
    const el = _c.querySelector('#pause-count');
    if (el) el.textContent = _fi.pauses[halfKey()];
  });

  // Find the space toggle
  _c.querySelector('#space-toggle')?.addEventListener('change', e => {
    _fi.spaceOn = e.target.checked;
    saveFi();
    _fi.spaceOn ? startSpaceInterval() : stopIntervals();
  });

  if (_fi.spaceOn) startSpaceInterval();

  // Next / back phase
  _c.querySelector('#fi-next-phase')?.addEventListener('click', () => advanceTo(nextPhase));
  _c.querySelector('#fi-back-phase')?.addEventListener('click', () => advanceTo(isSecond ? 'half_time' : 'before'));
}

// Shadow 5-min countdown timer
function bindShadowTimer() {
  const zone = _c?.querySelector('#shadow-timer-zone');
  const btn  = _c?.querySelector('#shadow-timer-btn');
  if (!zone || !btn) return;

  btn.addEventListener('click', () => {
    if (_shadowIv) {
      clearInterval(_shadowIv);
      _shadowIv = null;
      zone.innerHTML = '<button class="fi-timer-btn" id="shadow-timer-btn">⏱ Start 5-min shadow block</button>';
      bindShadowTimer();
      return;
    }

    _shadowRemain = 5 * 60;
    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    zone.innerHTML = `
      <div class="fi-shadow-running">
        <div class="fi-shadow-label">SHADOWING — ${_fi.shadowPlayer || 'player'}</div>
        <div class="fi-shadow-count" id="shadow-count">${fmt(_shadowRemain)}</div>
        <button class="fi-timer-btn fi-timer-stop" id="shadow-timer-btn">Stop</button>
      </div>`;
    bindShadowTimer();

    _shadowIv = setInterval(() => {
      _shadowRemain--;
      const el = _c?.querySelector('#shadow-count');
      if (el) el.textContent = fmt(_shadowRemain);
      if (_shadowRemain <= 0) {
        clearInterval(_shadowIv);
        _shadowIv = null;
        if (zone) zone.innerHTML = `
          <div class="fi-shadow-done">✅ Shadow block complete!</div>
          <button class="fi-timer-btn" id="shadow-timer-btn">⏱ Start another 5-min block</button>`;
        bindShadowTimer();
      }
    }, 1000);
  });
}

// ─── Phase 3: Half Time ───────────────────────────────────────────────────────
function renderHalftime() {
  const questions = htQuestions();
  const idx       = Math.min(_fi.htIdx, questions.length - 1);
  const total     = questions.length;
  const isLast    = idx === total - 1;

  _c.innerHTML = `
    <div class="fi-wrap">
      <div class="fi-sticky-top">${htmlPhaseBar()}</div>
      <div class="fi-content fi-content-journal">

        <div class="fi-ht-hdr">
          <div class="fi-badge-pill">⏸ Half Time</div>
          <h2 class="fi-page-title">Half-Time Reflection</h2>
          <p class="fi-page-sub">10 min — what did you notice in the first half?</p>
        </div>

        <div class="fi-ht-progress">
          <span>Question <strong>${idx + 1}</strong> of ${total}</span>
          <div class="fi-ht-bar">
            <div class="fi-ht-bar-fill" style="width:${Math.round(((idx + 1) / total) * 100)}%"></div>
          </div>
        </div>

        <div class="fi-ht-card">
          <div class="fi-ht-q-num">Q${idx + 1}</div>
          <div class="fi-ht-question">${questions[idx]}</div>
          <textarea class="fi-journal-input" id="ht-answer" rows="4"
            placeholder="Write as much or as little as you want…">${_fi.htAnswers[idx] || ''}</textarea>
        </div>

        <div class="fi-ht-nav">
          <button class="fi-nav-btn fi-nav-prev" id="ht-prev" ${idx === 0 ? 'disabled' : ''}>← Prev</button>
          ${isLast
            ? `<button class="fi-nav-btn fi-nav-next fi-phase-btn" id="ht-next">Start 2nd Half →</button>`
            : `<button class="fi-nav-btn fi-nav-next" id="ht-next">Next →</button>`
          }
        </div>

        <button class="fi-ghost-btn fi-back-btn" id="ht-back">← Back to 1st Half</button>

      </div>
    </div>`;

  function saveHtAnswer() {
    const el = _c.querySelector('#ht-answer');
    if (el) { _fi.htAnswers[idx] = el.value; saveFi(); }
  }

  _c.querySelector('#ht-answer')?.addEventListener('input', e => {
    _fi.htAnswers[idx] = e.target.value;
    saveFi();
  });

  _c.querySelector('#ht-prev')?.addEventListener('click', () => {
    saveHtAnswer();
    _fi.htIdx = Math.max(0, idx - 1);
    saveFi();
    renderHalftime();
  });

  _c.querySelector('#ht-next')?.addEventListener('click', () => {
    saveHtAnswer();
    if (isLast) {
      _fi.spaceOn      = false;
      _fi.expandedCard = 'tally_task';
      advanceTo('second_half');
    } else {
      _fi.htIdx = idx + 1;
      saveFi();
      renderHalftime();
    }
  });

  _c.querySelector('#ht-back')?.addEventListener('click', () => {
    saveHtAnswer();
    advanceTo('first_half');
  });
}

// ─── Phase 5: After ───────────────────────────────────────────────────────────
const STAGE_KEY = ['saw', 'learned', 'will'];

function renderAfter() {
  const stages   = _sess.after_stages;
  const si       = Math.min(_fi.afterStage, stages.length - 1);
  const stage    = stages[si];
  const key      = STAGE_KEY[si];
  const answers  = _fi.afterAnswers[key] || {};
  const isLast   = si === stages.length - 1;

  _c.innerHTML = `
    <div class="fi-wrap">
      <div class="fi-sticky-top">${htmlPhaseBar()}</div>
      <div class="fi-content fi-content-journal">

        <div class="fi-after-hdr">
          <div class="fi-badge-pill">📊 After the Match</div>
          <h2 class="fi-page-title">${stage.label}</h2>
          <p class="fi-page-sub">${stage.focus ? `${stage.focus} · ` : ''}${stage.duration_min} min</p>
          <div class="fi-stage-dots">
            ${stages.map((_, i) => `
              <div class="fi-stage-dot${i === si ? ' fi-dot-active' : i < si ? ' fi-dot-done' : ''}"></div>
            `).join('')}
          </div>
          <div class="fi-stage-num">Stage ${si + 1} of ${stages.length}</div>
        </div>

        <div class="fi-after-qs">
          ${stage.questions.map((q, qi) => {
            const isTallyQ    = si === 0 && qi === 3;
            const isTrainPick = si === 2 && qi === 1;
            return `
              <div class="fi-after-q-block">
                <div class="fi-after-q-label">Q${qi + 1} — ${q}</div>
                ${isTallyQ    ? htmlTallyPrefill(key, qi, answers) :
                  isTrainPick ? htmlTrainingPicker(key, qi, answers[qi] || '') :
                  `<textarea class="fi-journal-input" data-key="${key}" data-qi="${qi}" rows="3"
                    placeholder="Write your answer…">${answers[qi] || ''}</textarea>`}
              </div>`;
          }).join('')}
        </div>

        <div class="fi-after-nav">
          ${si > 0
            ? `<button class="fi-nav-btn fi-nav-prev" id="af-prev">← Prev stage</button>`
            : '<div></div>'}
          ${isLast
            ? `<button class="fi-nav-btn fi-nav-next fi-phase-btn" id="af-done">See summary →</button>`
            : `<button class="fi-nav-btn fi-nav-next" id="af-next">Next stage →</button>`}
        </div>

        ${si === 0 ? `<button class="fi-ghost-btn fi-back-btn" id="af-back">← Back to 2nd Half</button>` : ''}

      </div>
    </div>`;

  // Auto-save text areas
  _c.querySelectorAll('textarea[data-key]').forEach(ta => {
    ta.addEventListener('input', () => {
      _fi.afterAnswers[ta.dataset.key][+ta.dataset.qi] = ta.value;
      saveFi();
    });
  });

  // Training chip selection
  _c.querySelectorAll('.fi-train-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      _fi.afterAnswers[key][+chip.dataset.qi] = chip.dataset.val;
      saveFi();
      renderAfter();
    });
  });

  _c.querySelector('#af-prev')?.addEventListener('click', () => {
    _fi.afterStage = si - 1;
    saveFi();
    renderAfter();
  });
  _c.querySelector('#af-next')?.addEventListener('click', () => {
    _fi.afterStage = si + 1;
    saveFi();
    renderAfter();
  });
  _c.querySelector('#af-done')?.addEventListener('click', () => {
    _fi.showSummary = true;
    saveFi();
    renderSummary();
  });
  _c.querySelector('#af-back')?.addEventListener('click', () => advanceTo('second_half'));
}

function htmlTallyPrefill(key, qi, answers) {
  return `
    <div class="fi-tally-pf">
      <div class="fi-tally-pf-row"><span>1st half:</span> <strong>${_fi.tally.first}</strong></div>
      <div class="fi-tally-pf-row"><span>2nd half:</span> <strong>${_fi.tally.second}</strong></div>
      <div class="fi-tally-pf-total">Total: ${_fi.tally.first + _fi.tally.second}</div>
      <textarea class="fi-journal-input" data-key="${key}" data-qi="${qi}" rows="2"
        placeholder="Any notes on the pattern…">${answers[qi] || ''}</textarea>
    </div>`;
}

function htmlTrainingPicker(key, qi, currentVal) {
  return `
    <div class="fi-train-chips">
      ${TRAINING_SESSIONS.map(s => `
        <button class="fi-train-chip${currentVal === s ? ' fi-pill-on' : ''}"
          data-val="${s}" data-qi="${qi}" type="button">${s}</button>
      `).join('')}
    </div>`;
}

// ─── Summary ─────────────────────────────────────────────────────────────────
function renderSummary() {
  const fp    = focalPoint();
  const wills = _fi.afterAnswers.will;

  _c.innerHTML = `
    <div class="fi-wrap">
      <div class="fi-sticky-top">${htmlPhaseBar()}</div>
      <div class="fi-content fi-content-journal">

        <div class="fi-summary-hdr">
          <div class="fi-done-emoji">📺</div>
          <h2 class="fi-page-title">Session Summary</h2>
          <p class="fi-page-sub">Here's what you got from today's match</p>
        </div>

        <div class="fi-summary-card">
          <div class="fi-sum-row">
            <span class="fi-sum-lbl">Focal point</span>
            <span class="fi-sum-val">${fp ? `${fp.id} — ${fp.label}` : '—'}</span>
          </div>
          <div class="fi-sum-row">
            <span class="fi-sum-lbl">Tally action</span>
            <span class="fi-sum-val">${_fi.tallyAction || '—'}</span>
          </div>
          <div class="fi-sum-row">
            <span class="fi-sum-lbl">Total count</span>
            <span class="fi-sum-val">
              1st: <strong>${_fi.tally.first}</strong> &nbsp;·&nbsp; 2nd: <strong>${_fi.tally.second}</strong>
            </span>
          </div>
          <div class="fi-sum-row">
            <span class="fi-sum-lbl">Shadowed</span>
            <span class="fi-sum-val">${_fi.shadowPlayer || '—'}</span>
          </div>
          ${_fi.pauses.first + _fi.pauses.second > 0 ? `
          <div class="fi-sum-row">
            <span class="fi-sum-lbl">Pauses</span>
            <span class="fi-sum-val">
              1st: ${_fi.pauses.first} &nbsp;·&nbsp; 2nd: ${_fi.pauses.second}
            </span>
          </div>` : ''}
        </div>

        ${(wills[0] || wills[1] || wills[2]) ? `
          <div class="fi-sum-actions">
            <div class="fi-sec-hd" style="margin-bottom:10px;">What you'll do next</div>
            ${[0, 1, 2].filter(i => wills[i]).map(i => `
              <div class="fi-sum-action">
                <span class="fi-sum-num">${i + 1}</span>
                <span>${wills[i]}</span>
              </div>`).join('')}
          </div>` : ''}

        <div class="fi-save-zone">
          <button class="fi-phase-btn" id="fi-save">Save session ✓</button>
          <button class="fi-ghost-btn fi-back-btn" id="fi-back-after">← Back to review answers</button>
          <button class="fi-ghost-btn" id="fi-discard">Discard without saving</button>
        </div>

      </div>
    </div>`;

  _c.querySelector('#fi-save')?.addEventListener('click', saveSession);
  _c.querySelector('#fi-back-after')?.addEventListener('click', () => {
    _fi.showSummary = false;
    saveFi();
    renderAfter();
  });
  _c.querySelector('#fi-discard')?.addEventListener('click', () => {
    releaseWakeLock();
    clearFi();
    navigateBack();
  });
}

async function saveSession() {
  const fp = focalPoint();
  const isEdit = !!_editSession;
  const session = {
    id:        _editSession?.id    || genId(),
    date:      _editSession?.date  || getTodayKey(),
    type:      'match_watch',
    duration:  _editSession?.duration   ?? 90,
    difficulty:_editSession?.difficulty ?? 3,
    mood:      _editSession?.mood  ?? null,
    notes: [
      `Focal point: ${fp ? fp.label : '—'}`,
      `Tally (${_fi.tallyAction}): ${_fi.tally.first + _fi.tally.second} total (1st: ${_fi.tally.first}, 2nd: ${_fi.tally.second})`,
      _fi.shadowPlayer ? `Shadowed: ${_fi.shadowPlayer}` : '',
      _fi.afterAnswers.will[0] ? `Next session: ${_fi.afterAnswers.will[0]}` : '',
    ].filter(Boolean).join('\n'),
    timestamp: _editSession?.timestamp || new Date().toISOString(),
    plannerId: _editSession?.plannerId || _plannerId || null,
    fiData: {
      focalPointId: _fi.focalId,
      tallyAction:  _fi.tallyAction,
      tally:        _fi.tally,
      pauses:       _fi.pauses,
      shadowPlayer: _fi.shadowPlayer,
      htAnswers:    _fi.htAnswers,
      afterAnswers: _fi.afterAnswers,
    },
  };

  try {
    releaseWakeLock();
    await saveSessionAndCheckBadges(session);

    if (!isEdit && _plannerId) {
      const item = await db.get('planner', _plannerId);
      if (item) {
        item.done = true;
        item.sessionId = session.id;
        await db.put('planner', item);
        await loadState();
      }
    }

    clearFi();
    showToast(isEdit ? 'Match session updated! 📺' : 'Match session saved! 📺', 'success');
    navigate('home');
  } catch {
    showToast('Could not save session', 'error');
  }
}

// ─── Main renderer ────────────────────────────────────────────────────────────
function render() {
  stopIntervals();
  if (_shadowIv) { clearInterval(_shadowIv); _shadowIv = null; }

  if (_fi.showSummary)        { renderSummary();   return; }
  if (_fi.phase === 'before')      renderBefore();
  else if (_fi.phase === 'first_half')  renderHalf();
  else if (_fi.phase === 'half_time')   renderHalftime();
  else if (_fi.phase === 'second_half') renderHalf();
  else if (_fi.phase === 'after')       renderAfter();
  else renderBefore();
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function renderMatchWatch(container, params = {}) {
  _c = container;
  _plannerId   = params.plannerId   || null;
  _editSession = params.editSession || null;
  stopIntervals();

  container.innerHTML = `
    <div class="player-loading">
      <div class="player-load-ball">📺</div>
      <p>Loading session…</p>
    </div>`;

  let data;
  try {
    data = await loadData();
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">😔</span>
        <p class="empty-state-text">Could not load session data.</p>
      </div>`;
    return;
  }

  _sess = data.sessions.find(s => s.id === 'football_intelligence');
  if (!_sess) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📋</span>
        <p class="empty-state-text">Football Intelligence data not found.</p>
      </div>`;
    return;
  }

  if (_editSession?.fiData) {
    _fi = fiFromEditSession(_editSession);
  } else {
    try { _fi = JSON.parse(localStorage.getItem(FI_KEY)) || freshFi(); }
    catch { _fi = freshFi(); }
  }

  render();
}
