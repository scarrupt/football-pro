import { navigate, navigateBack, state, showToast, saveSessionAndCheckBadges, loadState } from '../app.js';
import { SESSION_TYPES, MOODS } from '../constants.js';
import { getTodayKey, genId, formatDayFull } from '../utils.js';
import { db } from '../db.js';

const DURATION_PRESETS  = [20, 30, 45, 60, 90];
const DIFFICULTY_LABELS = ['', 'Easy', 'Medium', 'Hard', 'Very Hard', 'Max Effort'];
const POSITIONS         = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];
const DRILL_FOCUS_OPTS  = ['Passing', 'Finishing', 'Pressing', 'Set pieces', 'Defending', 'Fitness'];

// ─── Step 1: Type selection ───────────────────────────────────────────────

function renderTypeSelection(container, onSelected) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="section-title" style="margin-top:16px;">What did you train? 💪</div>
    <div class="type-grid" id="type-grid"></div>`;

  const grid = wrap.querySelector('#type-grid');
  SESSION_TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'type-card';
    btn.style.setProperty('--card-color', t.color);
    btn.innerHTML = `<span class="type-card-icon">${t.icon}</span><span class="type-card-label">${t.label}</span>`;
    btn.addEventListener('click', () => onSelected(t.id));
    grid.appendChild(btn);
  });

  container.appendChild(wrap);
}

// ─── Extra fields for Team Training ──────────────────────────────────────

function renderTeamExtras(form, state) {
  const sec = document.createElement('div');
  sec.className = 'form-section extra-section';
  sec.innerHTML = `
    <div class="extra-section-title">👥 Team Training Details</div>
    <label class="form-label">Position played</label>
    <div class="position-row" id="pos-row">
      ${POSITIONS.map(p => `
        <button class="position-btn${state.position === p ? ' selected' : ''}" data-pos="${p}">${p}</button>
      `).join('')}
    </div>
    <label class="form-label" style="margin-top:12px;">Coach feedback (optional)</label>
    <textarea id="coach-feedback" class="form-textarea" rows="2"
      placeholder="What did the coach say?">${state.coachFeedback || ''}</textarea>
    <label class="form-label" style="margin-top:12px;">Training focus (optional)</label>
    <div class="focus-chips" id="focus-chips">
      ${DRILL_FOCUS_OPTS.map(f => `
        <button class="focus-chip${(state.drillsFocus || []).includes(f) ? ' selected' : ''}" data-focus="${f}">${f}</button>
      `).join('')}
    </div>
  `;
  form.appendChild(sec);

  sec.querySelectorAll('.position-btn').forEach(b => {
    b.addEventListener('click', () => {
      sec.querySelectorAll('.position-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      state.position = b.dataset.pos;
    });
  });
  sec.querySelectorAll('.focus-chip').forEach(b => {
    b.addEventListener('click', () => {
      b.classList.toggle('selected');
      state.drillsFocus = [...sec.querySelectorAll('.focus-chip.selected')].map(x => x.dataset.focus);
    });
  });
  sec.querySelector('#coach-feedback').addEventListener('input', e => {
    state.coachFeedback = e.target.value.trim();
  });
}

// ─── Extra fields for Match ───────────────────────────────────────────────

function renderMatchExtras(form, state) {
  const sec = document.createElement('div');
  sec.className = 'form-section extra-section';
  sec.innerHTML = `
    <div class="extra-section-title">🏆 Match Details</div>
    <label class="form-label">Opponent (optional)</label>
    <input id="opponent-input" class="form-input" type="text" placeholder="e.g. City FC"
      value="${state.opponent || ''}" maxlength="50">
    <label class="form-label" style="margin-top:12px;">Result</label>
    <div class="result-row" id="result-row">
      <button class="result-btn win${state.result === 'win' ? ' selected' : ''}" data-res="win">Win 🏆</button>
      <button class="result-btn draw${state.result === 'draw' ? ' selected' : ''}" data-res="draw">Draw 🤝</button>
      <button class="result-btn loss${state.result === 'loss' ? ' selected' : ''}" data-res="loss">Loss 💪</button>
    </div>
    <label class="form-label" style="margin-top:12px;">Score</label>
    <div class="score-row">
      <input id="score-for" class="score-input" type="number" min="0" max="99"
        placeholder="Us" value="${state.scoreFor ?? ''}">
      <span class="score-sep">:</span>
      <input id="score-against" class="score-input" type="number" min="0" max="99"
        placeholder="Them" value="${state.scoreAgainst ?? ''}">
    </div>
    <label class="form-label" style="margin-top:12px;">Your goals</label>
    <div class="stepper-row">
      <button class="stepper-btn" id="goals-minus">−</button>
      <span class="stepper-val" id="goals-val">${state.goalsScored ?? 0}</span>
      <button class="stepper-btn" id="goals-plus">+</button>
    </div>
    <label class="form-label" style="margin-top:12px;">Position played</label>
    <div class="position-row" id="match-pos-row">
      ${POSITIONS.map(p => `
        <button class="position-btn${state.position === p ? ' selected' : ''}" data-pos="${p}">${p}</button>
      `).join('')}
    </div>
  `;
  form.appendChild(sec);

  sec.querySelector('#opponent-input').addEventListener('input', e => { state.opponent = e.target.value.trim(); });
  sec.querySelectorAll('.result-btn').forEach(b => {
    b.addEventListener('click', () => {
      sec.querySelectorAll('.result-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      state.result = b.dataset.res;
    });
  });
  sec.querySelector('#score-for').addEventListener('input', e => { state.scoreFor = parseInt(e.target.value) || 0; });
  sec.querySelector('#score-against').addEventListener('input', e => { state.scoreAgainst = parseInt(e.target.value) || 0; });

  let goals = state.goalsScored ?? 0;
  sec.querySelector('#goals-minus').addEventListener('click', () => {
    if (goals > 0) { goals--; sec.querySelector('#goals-val').textContent = goals; state.goalsScored = goals; }
  });
  sec.querySelector('#goals-plus').addEventListener('click', () => {
    goals++; sec.querySelector('#goals-val').textContent = goals; state.goalsScored = goals;
  });
  sec.querySelectorAll('.position-btn').forEach(b => {
    b.addEventListener('click', () => {
      sec.querySelectorAll('.position-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      state.position = b.dataset.pos;
    });
  });
}

// ─── Step 2: Details form ─────────────────────────────────────────────────

function renderDetailsForm(container, params) {
  const editSession     = params.editSession || null;
  const typeId          = params.type || editSession?.type || 'dribbling';
  const typeObj         = SESSION_TYPES.find(t => t.id === typeId) || SESSION_TYPES[0];
  const dateKey         = params.date || editSession?.date || getTodayKey();
  const isEdit          = !!editSession;

  // Mutable form state (pre-filled if editing)
  let selectedDuration   = editSession?.duration   ?? 45;
  let customDuration     = null;
  let showCustom         = false;
  let selectedDifficulty = editSession?.difficulty ?? 3;
  let selectedMood       = editSession?.mood        ?? 3;
  // From player: pre-populated module and attempt scores
  const moduleSelection = params.moduleSelection || null;
  const testAttempts    = params.testAttempts    || null;

  // Extra-field state objects (mutated by extra-field renderers)
  const teamState  = {
    position:     editSession?.position     || null,
    coachFeedback:editSession?.coachFeedback|| '',
    drillsFocus:  editSession?.drillsFocus  || [],
  };
  const matchState = {
    opponent:     editSession?.opponent     || '',
    result:       editSession?.result       || null,
    scoreFor:     editSession?.scoreFor     ?? null,
    scoreAgainst: editSession?.scoreAgainst ?? null,
    goalsScored:  editSession?.goalsScored  ?? 0,
    position:     editSession?.position     || null,
  };

  const form = document.createElement('div');
  form.className = 'log-form';

  // ── Type banner with Guide button ────────────────────────────────────
  form.innerHTML = `
    <div class="log-type-banner" style="background:${typeObj.color};">
      <span class="log-type-banner-icon">${typeObj.icon}</span>
      <div style="flex:1;">
        <div>${typeObj.label}</div>
        <div style="font-size:0.78rem;opacity:0.85;font-weight:500;">${formatDayFull(dateKey)}</div>
      </div>
      ${isEdit ? '<div class="edit-badge">✏️ Editing</div>'
               : `<button class="guide-chip-btn" id="open-guide-btn">▶ Guide</button>`}
    </div>`;

  // ── Duration ─────────────────────────────────────────────────────────
  const durSec = document.createElement('div');
  durSec.className = 'form-section';
  const activeDur = DURATION_PRESETS.includes(selectedDuration) ? selectedDuration : null;
  durSec.innerHTML = `
    <label class="form-label">⏱️ Duration</label>
    <div class="duration-grid" id="dur-grid">
      ${DURATION_PRESETS.map(m => `
        <button class="duration-btn${m === activeDur ? ' selected' : ''}" data-min="${m}">${m}m</button>
      `).join('')}
      <button class="duration-btn${!activeDur ? ' selected' : ''}" id="cust-dur-btn">Custom</button>
    </div>
    <div id="cust-dur-wrap" style="display:${activeDur ? 'none' : 'flex'};padding:8px 16px 0;">
      <input id="cust-dur-in" class="duration-custom-input" type="number" min="1" max="360"
        placeholder="mins" value="${!activeDur ? selectedDuration : ''}">
      <span style="font-size:.85rem;color:var(--color-text-muted);margin-left:8px;">minutes</span>
    </div>`;
  form.appendChild(durSec);

  // ── Difficulty stars ──────────────────────────────────────────────────
  const diffSec = document.createElement('div');
  diffSec.className = 'form-section';
  diffSec.innerHTML = `
    <label class="form-label">⭐ Effort level</label>
    <div class="rating-stars" id="stars-row">
      ${[1,2,3,4,5].map(i => `
        <span class="star${i <= selectedDifficulty ? ' lit' : ''}" data-val="${i}" role="button">⭐</span>
      `).join('')}
    </div>
    <div class="rating-label" id="diff-label">${DIFFICULTY_LABELS[selectedDifficulty]}</div>`;
  form.appendChild(diffSec);

  // ── Mood ──────────────────────────────────────────────────────────────
  const moodSec = document.createElement('div');
  moodSec.className = 'form-section';
  moodSec.innerHTML = `
    <label class="form-label">😊 How did you feel?</label>
    <div class="mood-row" id="mood-row">
      ${MOODS.map(m => `
        <button class="mood-btn${m.id === selectedMood ? ' selected' : ''}" data-mood="${m.id}">
          <span class="mood-emoji">${m.emoji}</span>
          <span class="mood-label">${m.label}</span>
        </button>`).join('')}
    </div>`;
  form.appendChild(moodSec);

  // ── Type-specific extra fields ────────────────────────────────────────
  if (typeId === 'team_training') renderTeamExtras(form, teamState);
  if (typeId === 'match')         renderMatchExtras(form, matchState);

  // ── Module (read-only, from player or edit) ───────────────────────────
  const modulesToShow = moduleSelection ? [moduleSelection] : (editSession?.modules || null);
  if (modulesToShow?.length) {
    const modSec = document.createElement('div');
    modSec.className = 'form-section';
    modSec.innerHTML = `
      <label class="form-label">📚 Module</label>
      <div class="detail-stats-row">
        ${modulesToShow.map(m => `
          <span class="detail-stat-chip" style="border-left:3px solid ${typeObj.color};">${m.label}</span>
        `).join('')}
      </div>`;
    form.appendChild(modSec);
  }

  // ── Test Results (read-only, from player or edit) ─────────────────────
  const attemptEntries = testAttempts
    ? Object.entries(testAttempts).filter(([, d]) => d.values?.some(v => v > 0))
    : [];
  if (attemptEntries.length) {
    const testSec = document.createElement('div');
    testSec.className = 'form-section';
    testSec.innerHTML = `
      <label class="form-label">🧪 Test Results</label>
      <div class="test-attempts-summary">
        ${attemptEntries.map(([name, d]) => {
          const valid = d.values.filter(v => v != null && v > 0);
          const best  = Math.min(...valid);
          return `
            <div class="test-summary-block">
              <div class="test-summary-name">${name}</div>
              <div class="test-summary-values">Attempts: ${valid.map(v => v.toFixed(2) + 's').join(' · ')}</div>
              <div class="test-summary-best">🏆 Best: ${best.toFixed(2)}s</div>
            </div>`;
        }).join('')}
      </div>`;
    form.appendChild(testSec);
  } else if (editSession?.testResults?.length) {
    const testSec = document.createElement('div');
    testSec.className = 'form-section';
    testSec.innerHTML = `
      <label class="form-label">🧪 Test Results</label>
      <div class="test-attempts-summary">
        ${editSession.testResults.map(r => `
          <div class="test-summary-block">
            <div class="test-summary-name">${r.name}</div>
            <div class="test-summary-best">🏆 Best: ${Number(r.value).toFixed(2)}${r.unit}</div>
          </div>`).join('')}
      </div>`;
    form.appendChild(testSec);
  }

  // ── Notes ─────────────────────────────────────────────────────────────
  const notesSec = document.createElement('div');
  notesSec.className = 'form-section';
  notesSec.innerHTML = `
    <label class="form-label">📝 Notes (optional)</label>
    <textarea id="session-notes" class="form-textarea" rows="3"
      placeholder="What went well? What to improve? Coach feedback…">${editSession?.notes || ''}</textarea>`;
  form.appendChild(notesSec);

  // ── Save button ───────────────────────────────────────────────────────
  const saveSec = document.createElement('div');
  saveSec.style.cssText = 'padding:24px 16px 8px;';
  saveSec.innerHTML = `
    <button id="save-btn" class="btn btn-primary btn-full">
      ${isEdit ? 'Update Session ✏️' : 'Save Session 🎉'}
    </button>`;
  form.appendChild(saveSec);
  container.appendChild(form);

  // ── Bind Guide button ─────────────────────────────────────────────────
  form.querySelector('#open-guide-btn')?.addEventListener('click', () => {
    navigate('player', { type: typeId });
  });

  // ── Bind Duration ─────────────────────────────────────────────────────
  const durGrid     = form.querySelector('#dur-grid');
  const custWrap    = form.querySelector('#cust-dur-wrap');
  const custInput   = form.querySelector('#cust-dur-in');

  if (!activeDur) { showCustom = true; customDuration = selectedDuration; }

  durGrid.addEventListener('click', e => {
    const btn = e.target.closest('.duration-btn');
    if (!btn) return;
    durGrid.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (btn.id === 'cust-dur-btn') {
      showCustom = true; custWrap.style.display = 'flex'; custInput.focus();
      selectedDuration = null;
    } else {
      showCustom = false; custWrap.style.display = 'none';
      selectedDuration = parseInt(btn.dataset.min, 10); customDuration = null;
    }
  });
  custInput.addEventListener('input', () => { customDuration = parseInt(custInput.value, 10) || null; });

  // ── Bind Stars ────────────────────────────────────────────────────────
  const starsRow = form.querySelector('#stars-row');
  const diffLabel = form.querySelector('#diff-label');
  starsRow.addEventListener('click', e => {
    const star = e.target.closest('.star');
    if (!star) return;
    selectedDifficulty = parseInt(star.dataset.val, 10);
    starsRow.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('lit', i < selectedDifficulty));
    diffLabel.textContent = DIFFICULTY_LABELS[selectedDifficulty] || '';
  });

  // ── Bind Mood ─────────────────────────────────────────────────────────
  form.querySelector('#mood-row').addEventListener('click', e => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;
    selectedMood = parseInt(btn.dataset.mood, 10);
    form.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // ── Bind Save ─────────────────────────────────────────────────────────
  form.querySelector('#save-btn').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;

    const duration  = showCustom ? (customDuration || 45) : (selectedDuration || 45);
    const notesVal  = form.querySelector('#session-notes').value.trim();

    // Compute modules and test results to save
    const modulesToSave = moduleSelection ? [moduleSelection]
                        : (editSession?.modules?.length ? editSession.modules : null);

    const finalTestResults = testAttempts
      ? attemptEntries.map(([name, d]) => {
          const valid = d.values.filter(v => v != null && v > 0);
          const unit  = d.unit || 's';
          const best  = unit === 's' ? Math.min(...valid) : Math.max(...valid);
          return { name, value: best, unit };
        })
      : (editSession?.testResults || []);

    const session = {
      id:         editSession?.id || genId(),
      type:       typeId,
      date:       dateKey,
      duration,
      difficulty: selectedDifficulty,
      mood:       selectedMood,
      notes:      notesVal,
      timestamp:  editSession?.timestamp || new Date().toISOString(),
      plannerId:  editSession?.plannerId || params.plannerId || null,
      // extras
      ...(typeId === 'team_training' && {
        position:     teamState.position,
        coachFeedback: teamState.coachFeedback,
        drillsFocus:  teamState.drillsFocus,
      }),
      ...(typeId === 'match' && {
        opponent:    matchState.opponent,
        result:      matchState.result,
        scoreFor:    matchState.scoreFor,
        scoreAgainst:matchState.scoreAgainst,
        goalsScored: matchState.goalsScored,
        position:    matchState.position,
      }),
      ...(modulesToSave?.length      && { modules:     modulesToSave     }),
      ...(finalTestResults.length    && { testResults: finalTestResults  }),
    };

    await saveSessionAndCheckBadges(session);

    // Persist all raw attempt values to the testAttempts store
    if (testAttempts) {
      for (const [testName, d] of Object.entries(testAttempts)) {
        const valid = (d.values || []).filter(v => v != null && v > 0);
        if (valid.length) {
          await db.put('testAttempts', {
            id:        genId(),
            sessionId: session.id,
            date:      dateKey,
            testName,
            unit:      d.unit || 's',
            values:    valid,
          });
        }
      }
    }

    if (params.plannerId && !editSession) {
      const item = await db.get('planner', params.plannerId);
      if (item) {
        item.done = true; item.sessionId = session.id;
        await db.put('planner', item);
        await loadState();
      }
    }

    showToast(isEdit ? 'Session updated! ✏️' : 'Session logged! 🎉', 'success');
    navigateBack();
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────

export async function renderLog(container, params = {}) {
  params = params || {};

  if (params.editSession) {
    // Edit mode — skip type selection
    renderDetailsForm(container, params);
  } else if (params.type) {
    renderDetailsForm(container, params);
  } else {
    renderTypeSelection(container, typeId => {
      container.innerHTML = '';
      renderDetailsForm(container, { ...params, type: typeId });
    });
  }
}
