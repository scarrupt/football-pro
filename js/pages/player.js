import { navigate, navigateBack, state } from '../app.js';
import { getSessionType }  from '../constants.js';
import { renderMatchWatch } from './match_watch.js';

// ─── Module state ─────────────────────────────────────────────────────────
let _jsonCache      = null;
let _steps          = [];
let _idx            = 0;
let _container      = null;
let _params         = {};
let _timerHandle    = null;
let _selectedModule = null;  // { id, label } of the chosen module/level
let _testAttempts   = {};    // { [testName]: { unit:'s', values:(number|null)[] } }

// ─── JSON loading ─────────────────────────────────────────────────────────
async function getSessionData() {
  if (_jsonCache) return _jsonCache;
  const resp = await fetch('./u14_academy_sessions.json');
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  _jsonCache = await resp.json();
  return _jsonCache;
}

// ─── Step builders ────────────────────────────────────────────────────────
function buildSteps(type, data, opts = {}) {
  const sess = data.sessions;

  switch (type) {
    case 'shooting':
    case 'passing': {
      const s   = sess.find(x => x.id === type);
      if (!s) return [];
      const lvl = s.levels?.[opts.levelIdx ?? 0];
      if (!lvl) return [];
      return [
        ...(lvl.activation?.length ? [{ type: 'activation', items: lvl.activation }] : []),
        ...(lvl.drills || []).map(d => ({ type: 'drill', drill: d })),
        { type: 'done', title: s.title, duration: s.duration_min },
      ];
    }

    case 'dribbling': {
      const s   = sess.find(x => x.id === 'dribbling');
      if (!s) return [];
      const mod = s.modules?.[opts.moduleIdx ?? 0];
      if (!mod) return [];
      return [
        ...(mod.activation?.length ? [{ type: 'activation', items: mod.activation }] : []),
        ...(mod.drills || []).map(d => ({ type: 'drill', drill: d })),
        ...(mod.tests  || []).map(t => ({ type: 'test',  test:  t })),
        { type: 'done', title: s.title, duration: s.duration_min },
      ];
    }

    case 'upper_body': {
      const s = sess.find(x => x.id === 'upper_body_strength');
      if (!s) return [];
      return [
        ...(s.exercises || []).map(d => ({ type: 'drill', drill: d })),
        { type: 'done', title: s.title, duration: s.duration_min },
      ];
    }

    case 'lower_body': {
      const s = sess.find(x => x.id === 'lower_body_strength');
      if (!s) return [];
      return [
        ...(s.exercises || []).map(d => ({ type: 'drill', drill: d })),
        { type: 'done', title: s.title, duration: s.duration_min },
      ];
    }

    case 'fifa11': {
      const s = sess.find(x => x.id === 'fifa_11plus');
      if (!s) return [];
      const steps = [];
      (s.parts || []).forEach(part => {
        (part.exercises || []).forEach(ex => {
          steps.push({ type: 'drill', drill: ex, sectionName: part.label });
        });
      });
      steps.push({ type: 'done', title: s.title, duration: s.duration_min });
      return steps;
    }

    case 'speed': {
      const s = sess.find(x => x.id === 'speed_training');
      if (!s) return [];
      const steps = [];
      (s.blocks || []).forEach(block => {
        if (block.exercises) {
          block.exercises.forEach(ex => {
            steps.push({ type: 'drill', drill: ex, sectionName: block.label });
          });
        } else if (block.sprints) {
          steps.push({
            type: 'sprint',
            sectionName: block.label,
            sprints:     block.sprints,
            variations:  block.start_variations || [],
          });
        }
      });
      steps.push({ type: 'done', title: s.title, duration: s.duration_min });
      return steps;
    }

    case 'rhythmic': {
      const s = sess.find(x => x.id === 'rhythmic_movement');
      if (!s) return [];
      const steps = [];
      (s.blocks || []).forEach(block => {
        (block.exercises || []).forEach(ex => {
          steps.push({ type: 'drill', drill: ex, sectionName: block.label });
        });
      });
      steps.push({ type: 'done', title: s.title, duration: s.duration_min });
      return steps;
    }

    case 'match_watch': {
      const s = sess.find(x => x.id === 'football_intelligence');
      if (!s) return [];
      return [
        ...(s.focal_points   || []).map(fp => ({ type: 'focal_point',  data: fp })),
        ...(s.during_tasks   || []).map(t  => ({ type: 'during_task',  data: t  })),
        ...(s.half_time_questions?.length
          ? [{ type: 'halftime', questions: s.half_time_questions }] : []),
        ...(s.after_stages   || []).map(a  => ({ type: 'after_stage',  data: a  })),
        { type: 'done', title: s.title, duration: s.duration_min },
      ];
    }

    default: return [];
  }
}

// ─── Reps formatter ───────────────────────────────────────────────────────
function fmtReps(d) {
  const sets = d.sets ? `${d.sets} sets` : '';
  let reps   = '';
  if      (d.reps)              reps = `${d.reps} ${d.reps_unit || 'reps'}`;
  else if (d.reps_range)        reps = `${d.reps_range[0]}–${d.reps_range[1]} reps`;
  else if (d.duration_sec)      reps = `${d.duration_sec}s hold`;
  else if (d.duration_work_sec) reps = `${d.duration_work_sec}s on / ${d.duration_rest_sec}s rest`;

  const tags = [
    d.each_side && 'each side',
    d.per_leg   && 'per leg',
    (d.feet && d.feet !== 'both') && `${d.feet} foot`,
  ].filter(Boolean).join(', ');

  const main = [sets, reps && `× ${reps}`].filter(Boolean).join(' ');
  return tags ? `${main} (${tags})` : main;
}

// ─── HTML builders for each step type ────────────────────────────────────

function htmlActivation(step) {
  return `
    <div class="player-tag">🏃 Warm Up</div>
    <h2 class="player-title">Activation</h2>
    <p class="player-hint">Complete these before your drills:</p>
    <div class="activation-list">
      ${step.items.map(it => `
        <div class="activation-item">
          <div class="activation-name">✔ ${it.name}</div>
          <div class="activation-detail">${it.detail}</div>
        </div>
      `).join('')}
    </div>`;
}

function htmlDrill(step, stepIdx) {
  const d    = step.drill;
  const reps = fmtReps(d);
  const svg  = d.diagram?.svg || '';
  return `
    ${step.sectionName ? `<div class="player-section-chip">${step.sectionName}</div>` : ''}
    ${d.acl_warning ? `<div class="player-acl">⚠️ ACL Warning — knees track over toes, never buckle inward</div>` : ''}
    ${d.requires_partner ? `<div class="player-partner-note">👥 Partner needed</div>` : ''}
    <h2 class="player-title">${d.name}</h2>
    ${reps ? `<div class="player-reps">${reps}</div>` : ''}
    ${svg ? `<div class="player-diagram">${svg}</div>` : ''}
    ${d.tempo_description ? `<div class="player-tempo">⏱ <strong>${d.tempo}</strong> — ${d.tempo_description}</div>` : ''}
    ${d.muscles?.length ? `<div class="player-muscles">💪 ${d.muscles.join(' · ')}</div>` : ''}
    ${d.beat_pattern ? `<div class="player-beat">🎵 ${d.beat_pattern}${d.bpm ? ` @ ${d.bpm} BPM` : ''}</div>` : ''}
    ${d.variations?.length ? `
      <div class="player-cues-label">Rotate through all ${d.variations.length}:</div>
      <ol class="player-cues">
        ${d.variations.map(v => `<li>${v}</li>`).join('')}
      </ol>` : ''}
    ${d.cues?.length ? `
      <div class="player-cues-label">Coaching cues:</div>
      <ul class="player-cues">
        ${d.cues.map(c => `<li>${c}</li>`).join('')}
      </ul>` : ''}
    ${(d.rest_seconds > 0) ? `
      <div class="player-rest-zone" id="rz-${stepIdx}">
        <button class="player-rest-btn" data-secs="${d.rest_seconds}">
          ⏱ Start rest timer · ${d.rest_seconds}s
        </button>
      </div>` : ''}
    ${d.duration_work_sec ? `
      <div class="player-interval-zone" id="iz-${stepIdx}">
        <button class="player-interval-btn" data-work="${d.duration_work_sec}" data-rest="${d.duration_rest_sec}">
          ⏱ Start · ${d.duration_work_sec}s work / ${d.duration_rest_sec}s rest
        </button>
      </div>` : ''}`;
}

function htmlSprint(step) {
  const sp = step.sprints;
  return `
    <div class="player-section-chip">${step.sectionName}</div>
    <h2 class="player-title">🚀 Sprints</h2>
    <div class="player-reps">${sp.count} × ${sp.distance_m}m</div>
    <div class="player-tempo">${sp.intensity}</div>
    <div class="player-tempo" style="font-weight:400;">${sp.recovery}</div>
    <div class="player-cues-label">Start variations — use a different one each sprint:</div>
    <ul class="player-cues">
      ${step.variations.map((v, i) => `<li><strong>${i + 1}.</strong> ${v}</li>`).join('')}
    </ul>`;
}

function htmlTest(step, testAttempts) {
  const t   = step.test;
  const svg = t.diagram?.svg || '';
  const numAttempts = t.attempts || 3;
  const existing    = testAttempts?.[t.name]?.values || [];

  const attemptRows = Array.from({ length: numAttempts }, (_, i) => `
    <div class="test-attempt-row">
      <span class="test-attempt-label">Attempt ${i + 1}</span>
      <input class="test-attempt-input" type="number" inputmode="decimal"
        data-test="${t.name}" data-idx="${i}"
        min="0" step="0.01" placeholder="—"
        value="${(existing[i] != null && existing[i] > 0) ? existing[i] : ''}">
      <span class="test-attempt-unit">s</span>
    </div>`).join('');

  return `
    <div class="player-tag">🧪 Timed Test</div>
    <h2 class="player-title">${t.name}</h2>
    ${t.description ? `<p class="player-hint">${t.description}</p>` : ''}
    ${svg ? `<div class="player-diagram">${svg}</div>` : ''}
    ${t.cues?.length ? `<ul class="player-cues">${t.cues.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
    <div class="test-attempts-section">
      <div class="test-attempts-label">⏱ Record your attempts</div>
      ${attemptRows}
      <div class="player-note">🏆 Best time saved automatically when you log the session</div>
    </div>`;
}

function htmlFocalPoint(step) {
  const fp  = step.data;
  const svg = fp.diagram?.svg || '';
  return `
    <div class="player-tag">📺 Focus Point ${fp.id}</div>
    <h2 class="player-title">${fp.label}</h2>
    ${svg ? `<div class="player-diagram">${svg}</div>` : ''}
    ${fp.insight ? `<div class="player-insight">"${fp.insight}"</div>` : ''}
    ${fp.questions?.length ? `
      <div class="player-cues-label">Watch for:</div>
      <ul class="player-cues">${fp.questions.map(q => `<li>${q}</li>`).join('')}</ul>` : ''}
    ${fp.recommended_players?.length
      ? `<div class="player-note">⭐ Watch: ${fp.recommended_players.join(', ')}</div>` : ''}`;
}

function htmlDuringTask(step) {
  const t = step.data;
  return `
    <div class="player-tag">📋 During Match Task</div>
    <h2 class="player-title">${t.name}</h2>
    ${t.description ? `<p class="player-hint">${t.description}</p>` : ''}
    ${t.cues?.length    ? `<ul class="player-cues">${t.cues.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
    ${t.options?.length ? `
      <div class="player-cues-label">Choose one to track:</div>
      <ul class="player-cues">${t.options.map(o => `<li>${o}</li>`).join('')}</ul>` : ''}
    ${t.triggers?.length ? `
      <div class="player-cues-label">Triggers:</div>
      <ul class="player-cues">${t.triggers.map(tr => `<li>${tr}</li>`).join('')}</ul>` : ''}`;
}

function htmlHalftime(step) {
  return `
    <div class="player-tag">⏸ Half Time</div>
    <h2 class="player-title">Half-Time Questions</h2>
    <ul class="player-cues">
      ${step.questions.map(q => `<li>${q}</li>`).join('')}
    </ul>`;
}

function htmlAfterStage(step) {
  const a = step.data;
  return `
    <div class="player-tag">📊 Post Match · ${a.duration_min} min</div>
    <h2 class="player-title">${a.label}</h2>
    ${a.focus ? `<div class="player-beat">Focus: ${a.focus}</div>` : ''}
    ${a.questions?.length
      ? `<ul class="player-cues">${a.questions.map(q => `<li>${q}</li>`).join('')}</ul>` : ''}`;
}

function htmlDone(step) {
  const name = state.settings?.playerName || 'champion';
  return `
    <div class="player-done-wrap">
      <div class="player-done-emoji">🎉</div>
      <h2 class="player-done-title">Session Complete!</h2>
      <p class="player-done-sub">Amazing work, ${name}! You crushed it! 💪</p>
      ${step.duration ? `<div class="player-done-stat">~${step.duration} minutes</div>` : ''}
      <button class="btn btn-primary btn-full" id="pdone-log">📝 Log this session</button>
      <button class="btn btn-ghost btn-full" id="pdone-exit" style="margin-top:8px;">Exit without logging</button>
    </div>`;
}

// ─── Wake lock ────────────────────────────────────────────────────────────
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

// ─── Sound ────────────────────────────────────────────────────────────────
function beep(freq = 880, startOffset = 0, duration = 0.3, volume = 0.25) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
    osc.start(ctx.currentTime + startOffset);
    osc.stop(ctx.currentTime + startOffset + duration);
    osc.onended = () => ctx.close();
  } catch (_) {}
}

function beepDone() {
  beep(660, 0,    0.12);
  beep(880, 0.18, 0.35);
}

function beepTick() {
  beep(660, 0, 0.08, 0.12);
}

// ─── Timers ───────────────────────────────────────────────────────────────
function clearTimer() {
  if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }
  releaseWakeLock();
}

function startRestTimer(secs, zoneEl) {
  clearTimer();
  acquireWakeLock();
  let remaining = secs;

  zoneEl.innerHTML = `
    <div class="rest-timer-box">
      <div class="rest-timer-label">REST</div>
      <div class="rest-timer-count" id="rt-count">${remaining}</div>
      <div class="rest-timer-sub">seconds</div>
      <button class="rest-skip-btn" id="rt-skip">Skip →</button>
    </div>`;

  zoneEl.querySelector('#rt-skip').addEventListener('click', () => {
    clearTimer();
    zoneEl.innerHTML = '<div class="rest-done-msg">✅ Rest done — continue when ready!</div>';
  });

  _timerHandle = setInterval(() => {
    remaining--;
    const el = zoneEl.querySelector('#rt-count');
    if (el) el.textContent = remaining;
    if (remaining <= 3 && remaining > 0) beepTick();
    if (remaining <= 0) {
      clearTimer();
      beepDone();
      zoneEl.innerHTML = `
        <div class="rest-done-msg">✅ Rest complete!</div>
        <button class="rest-again-btn" id="rt-again">↺ Start again · ${secs}s</button>`;
      zoneEl.querySelector('#rt-again').addEventListener('click', () => startRestTimer(secs, zoneEl));
    }
  }, 1000);
}

function startIntervalTimer(workSecs, restSecs, zoneEl) {
  clearTimer();
  acquireWakeLock();

  function runPhase(phase, secs, onDone) {
    const isWork = phase === 'work';
    let remaining = secs;

    zoneEl.innerHTML = `
      <div class="interval-timer-box interval-${phase}">
        <div class="interval-phase-label">${isWork ? 'WORK' : 'REST'}</div>
        <div class="interval-count" id="it-count">${remaining}</div>
        <div class="interval-sub">seconds</div>
        <button class="rest-skip-btn" id="it-skip">Skip →</button>
      </div>`;

    zoneEl.querySelector('#it-skip').addEventListener('click', () => {
      clearTimer();
      onDone();
    });

    _timerHandle = setInterval(() => {
      remaining--;
      const el = zoneEl.querySelector('#it-count');
      if (el) el.textContent = remaining;
      if (remaining <= 3 && remaining > 0) beepTick();
      if (remaining <= 0) { clearTimer(); beepDone(); onDone(); }
    }, 1000);
  }

  runPhase('work', workSecs, () => {
    acquireWakeLock();
    runPhase('rest', restSecs, () => {
      zoneEl.innerHTML = `
        <div class="rest-done-msg">✅ Set complete — go again!</div>
        <button class="rest-again-btn" id="it-again">↺ Start again</button>`;
      zoneEl.querySelector('#it-again').addEventListener('click', () => startIntervalTimer(workSecs, restSecs, zoneEl));
    });
  });
}

// ─── Main step renderer ───────────────────────────────────────────────────
function renderStep() {
  if (!_container || !_steps.length) return;
  clearTimer();

  const step   = _steps[_idx];
  const total  = _steps.length;
  const pct    = total > 1 ? Math.round((_idx / (total - 1)) * 100) : 100;
  const isFirst = _idx === 0;
  const isLast  = _idx === total - 1;

  _container.innerHTML = `
    <div class="player-header-bar">
      <div class="player-prog-track"><div class="player-prog-fill" style="width:${pct}%"></div></div>
      <div class="player-step-num">${_idx + 1} / ${total}</div>
    </div>
    <div class="player-card" id="pc"></div>
    <div class="player-footer-nav">
      <button class="player-nav-btn" id="p-prev" ${isFirst ? 'disabled' : ''}>← Prev</button>
      <button class="player-nav-btn player-nav-next" id="p-next" ${isLast ? 'disabled' : ''}>Next →</button>
    </div>`;

  const card = _container.querySelector('#pc');

  switch (step.type) {
    case 'activation':  card.innerHTML = htmlActivation(step);       break;
    case 'drill':       card.innerHTML = htmlDrill(step, _idx);      break;
    case 'sprint':      card.innerHTML = htmlSprint(step);           break;
    case 'test':
      card.innerHTML = htmlTest(step, _testAttempts);
      card.querySelectorAll('.test-attempt-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const testName = inp.dataset.test;
          if (!_testAttempts[testName]) _testAttempts[testName] = { unit: 's', values: [] };
          const idx = +inp.dataset.idx;
          const val = parseFloat(inp.value);
          _testAttempts[testName].values[idx] = (val > 0) ? val : null;
        });
      });
      break;
    case 'focal_point': card.innerHTML = htmlFocalPoint(step);       break;
    case 'during_task': card.innerHTML = htmlDuringTask(step);       break;
    case 'halftime':    card.innerHTML = htmlHalftime(step);         break;
    case 'after_stage': card.innerHTML = htmlAfterStage(step);       break;
    case 'done':        card.innerHTML = htmlDone(step);             break;
    default:            card.innerHTML = `<p class="player-hint">Step: ${step.type}</p>`;
  }

  // Bind rest timer
  card.querySelector('.player-rest-btn')?.addEventListener('click', e => {
    const zone = card.querySelector(`#rz-${_idx}`);
    if (zone) startRestTimer(parseInt(e.currentTarget.dataset.secs, 10), zone);
  });

  // Bind interval timer
  card.querySelector('.player-interval-btn')?.addEventListener('click', e => {
    const zone = card.querySelector(`#iz-${_idx}`);
    if (zone) startIntervalTimer(
      parseInt(e.currentTarget.dataset.work, 10),
      parseInt(e.currentTarget.dataset.rest, 10),
      zone
    );
  });

  // Bind done-screen buttons
  card.querySelector('#pdone-log')?.addEventListener('click', () => {
    clearTimer();
    navigate('log', {
      type:            _params.type,
      plannerId:       _params.plannerId || null,
      date:            _params.date     || null,
      moduleSelection: _selectedModule,
      testAttempts:    Object.keys(_testAttempts).length ? _testAttempts : null,
      fromPlayer:      _params.fromLog  || false,
      ...(_params.editSession && { editSession: _params.editSession }),
    });
  });
  card.querySelector('#pdone-exit')?.addEventListener('click', () => {
    clearTimer();
    navigateBack();
  });

  // Navigation
  _container.querySelector('#p-prev').addEventListener('click', () => {
    if (_idx > 0) { _idx--; renderStep(); }
  });
  _container.querySelector('#p-next').addEventListener('click', () => {
    if (_idx < total - 1) { _idx++; renderStep(); }
  });
}

// ─── Selection screens ────────────────────────────────────────────────────
function renderLevelSelector(type, data) {
  const s = data.sessions.find(x => x.id === type);
  if (!s?.levels?.length) {
    _steps = buildSteps(type, data, {}); _idx = 0; renderStep(); return;
  }
  _container.innerHTML = `
    <div class="player-selector">
      <div class="player-sel-title">Choose your level 🎯</div>
      <p class="player-sel-sub">${s.title}</p>
      <div class="player-level-grid">
        ${s.levels.map((lv, i) => `
          <button class="player-level-btn" data-idx="${i}" data-id="${lv.id}" data-label="${lv.label}">
            <span class="lvl-label">${lv.label}</span>
            <span class="lvl-meta">${lv.drills?.length || 0} drills</span>
          </button>`).join('')}
      </div>
    </div>`;
  _container.querySelectorAll('.player-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedModule = { id: btn.dataset.id, label: btn.dataset.label };
      _steps = buildSteps(type, data, { levelIdx: +btn.dataset.idx });
      _idx = 0; renderStep();
    });
  });
}

function renderModuleSelector(data) {
  const s = data.sessions.find(x => x.id === 'dribbling');
  if (!s?.modules?.length) {
    _steps = buildSteps('dribbling', data, {}); _idx = 0; renderStep(); return;
  }
  _container.innerHTML = `
    <div class="player-selector">
      <div class="player-sel-title">Choose a module ⚽</div>
      <p class="player-sel-sub">Pick one for today — focus beats variety!</p>
      <div class="player-module-list">
        ${s.modules.map((mod, i) => `
          <button class="player-module-btn" data-idx="${i}" data-id="${mod.id}" data-label="${mod.label}">
            <span class="mod-label">${mod.label}</span>
            <span class="mod-meta">${mod.drills?.length || 0} drills →</span>
          </button>`).join('')}
      </div>
    </div>`;
  _container.querySelectorAll('.player-module-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedModule = { id: btn.dataset.id, label: btn.dataset.label };
      _steps = buildSteps('dribbling', data, { moduleIdx: +btn.dataset.idx });
      _idx = 0; renderStep();
    });
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────
export async function renderPlayer(container, params = {}) {
  const type = params.type || '';

  // Football Intelligence has its own dedicated UI
  if (type === 'match_watch') {
    return renderMatchWatch(container, params);
  }

  _container      = container;
  _params         = params;
  _steps          = [];
  _idx            = 0;
  _selectedModule = null;
  _testAttempts   = {};
  clearTimer();

  // Pre-populate test attempts from a previously saved session
  if (params.editSession?.testResults?.length) {
    params.editSession.testResults.forEach(r => {
      _testAttempts[r.name] = { unit: r.unit || 's', values: [r.value] };
    });
  }

  container.innerHTML = `
    <div class="player-loading">
      <div class="player-load-ball">⚽</div>
      <p>Loading session…</p>
    </div>`;

  let data;
  try {
    data = await getSessionData();
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">😔</span>
        <p class="empty-state-text">Could not load session data.<br>Are you offline for the first time?</p>
      </div>`;
    return;
  }

  if (type === 'shooting' || type === 'passing') {
    const editModule = params.editSession?.modules?.[0];
    if (editModule) {
      const s = data.sessions.find(x => x.id === type);
      const levelIdx = Math.max(0, s?.levels?.findIndex(l => l.id === editModule.id) ?? 0);
      _selectedModule = editModule;
      _steps = buildSteps(type, data, { levelIdx });
      _idx = 0; renderStep();
    } else {
      renderLevelSelector(type, data);
    }
  } else if (type === 'dribbling') {
    const editModule = params.editSession?.modules?.[0];
    if (editModule) {
      const s = data.sessions.find(x => x.id === 'dribbling');
      const moduleIdx = Math.max(0, s?.modules?.findIndex(m => m.id === editModule.id) ?? 0);
      _selectedModule = editModule;
      _steps = buildSteps('dribbling', data, { moduleIdx });
      _idx = 0; renderStep();
    } else {
      renderModuleSelector(data);
    }
  } else {
    _steps = buildSteps(type, data, params);
    if (!_steps.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">📋</span>
          <p class="empty-state-text">No guided session data available for this type yet.</p>
        </div>`;
      return;
    }
    renderStep();
  }
}
