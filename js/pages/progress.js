import { state, navigate, showModal, closeModal, showToast, loadState, deleteSession } from '../app.js';
import { SESSION_TYPES, MOODS, DAYS_SHORT } from '../constants.js';
import {
  getTodayKey, getWeekKeys, formatDuration, formatDayFull, isToday, isPast, keyToDate,
} from '../utils.js';

const DIFF_STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

// ─── Session Detail Modal ─────────────────────────────────────────────────

function showSessionDetailModal(session) {
  const type    = SESSION_TYPES.find(t => t.id === session.type) || SESSION_TYPES[0];
  const moodObj = MOODS.find(m => m.id === session.mood);
  const dateStr = formatDayFull(session.date);

  const matchExtras = session.type === 'match' ? `
    ${session.opponent ? `<div class="detail-row"><span>vs</span><strong>${session.opponent}</strong></div>` : ''}
    ${session.result ? `
      <div class="detail-row">
        <span>Result</span>
        <strong class="result-chip result-${session.result}">${session.result.toUpperCase()}</strong>
      </div>` : ''}
    ${(session.scoreFor != null && session.scoreAgainst != null) ? `
      <div class="detail-row"><span>Score</span><strong>${session.scoreFor} – ${session.scoreAgainst}</strong></div>` : ''}
    ${session.goalsScored != null ? `
      <div class="detail-row"><span>Goals</span><strong>${session.goalsScored}</strong></div>` : ''}
    ${session.position ? `<div class="detail-row"><span>Position</span><strong>${session.position}</strong></div>` : ''}
  ` : '';

  const teamExtras = session.type === 'team_training' ? `
    ${session.position ? `<div class="detail-row"><span>Position</span><strong>${session.position}</strong></div>` : ''}
    ${session.drillsFocus?.length ? `
      <div class="detail-row"><span>Focus</span><strong>${session.drillsFocus.join(', ')}</strong></div>` : ''}
    ${session.coachFeedback ? `
      <div class="detail-notes"><strong>Coach:</strong> ${session.coachFeedback}</div>` : ''}
  ` : '';

  const testExtras = session.testResults?.length ? `
    <div class="detail-guided">
      <div class="detail-guided-label">🧪 Test results</div>
      ${session.testResults.map(r => `
        <div class="pb-row">
          <span class="pb-row-date">${r.name}</span>
          <span class="pb-row-val">${r.unit === 's' ? r.value.toFixed(2) : r.value}${r.unit}</span>
        </div>`).join('')}
    </div>` : '';

  const guideExtras = session.modules?.length ? `
    <div class="detail-guided">
      <div class="detail-guided-label">📚 Module / Level</div>
      <div class="detail-stats-row">
        ${session.modules.map(m => `<span class="detail-stat-chip">${m.label}</span>`).join('')}
      </div>
    </div>` : '';

  showModal(`
    <div class="session-detail-header" style="background:${type.color};">
      <span class="session-detail-icon">${type.icon}</span>
      <div>
        <div class="session-detail-type">${type.label}</div>
        <div class="session-detail-date">${dateStr}</div>
      </div>
    </div>
    <div class="session-detail-body">
      <div class="detail-stats-row">
        <div class="detail-stat-chip">⏱️ ${formatDuration(session.duration)}</div>
        ${session.difficulty ? `<div class="detail-stat-chip">${DIFF_STARS[session.difficulty]}</div>` : ''}
        ${moodObj ? `<div class="detail-stat-chip">${moodObj.emoji} ${moodObj.label}</div>` : ''}
      </div>
      ${session.notes ? `<div class="detail-notes">${session.notes}</div>` : ''}
      ${matchExtras}
      ${teamExtras}
      ${testExtras}
      ${guideExtras}
    </div>
    <div class="detail-actions">
      <button class="btn btn-secondary" id="detail-edit-btn" style="flex:1;">✏️ Edit</button>
      <button class="btn detail-delete-btn" id="detail-delete-btn" style="flex:1;">🗑️ Delete</button>
    </div>
  `);

  document.getElementById('detail-edit-btn')?.addEventListener('click', () => {
    closeModal();
    navigate('log', { editSession: session });
  });

  document.getElementById('detail-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    await deleteSession(session.id);
    await loadState();
    closeModal();
    showToast('Session deleted', 'info');
    await navigate('progress');
  });
}

// ─── This Week Summary ────────────────────────────────────────────────────

function renderWeekSummary(container) {
  const todayKey     = getTodayKey();
  const weekKeys     = getWeekKeys(todayKey);
  const weekSessions = state.sessions.filter(s => weekKeys.includes(s.date));

  const totalSessions = weekSessions.length;
  const totalMinutes  = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const matchCount    = weekSessions.filter(s => s.type === 'match').length;

  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">This Week 📆</div>`;

  const statRow = document.createElement('div');
  statRow.className = 'stat-row';
  statRow.innerHTML = `
    <div class="stat-card">
      <span class="stat-icon">🏃</span>
      <span class="stat-value">${totalSessions}</span>
      <span class="stat-label">Sessions</span>
    </div>
    <div class="stat-card">
      <span class="stat-icon">⏱️</span>
      <span class="stat-value">${(totalMinutes / 60).toFixed(1)}h</span>
      <span class="stat-label">Hours</span>
    </div>
    <div class="stat-card">
      <span class="stat-icon">🏆</span>
      <span class="stat-value">${matchCount}</span>
      <span class="stat-label">Matches</span>
    </div>`;
  section.appendChild(statRow);

  const emojiRow = document.createElement('div');
  emojiRow.className = 'day-emoji-row';
  emojiRow.style.marginBottom = '16px';
  weekKeys.forEach((key, i) => {
    const has      = state.sessions.some(s => s.date === key);
    const todayMk  = isToday(key);
    const chip     = document.createElement('div');
    chip.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border-radius:8px;flex:1;${todayMk ? 'background:var(--color-primary-pale);' : ''}`;
    chip.innerHTML = `
      <span style="font-size:1.3rem;">${has ? '✅' : '⬜'}</span>
      <span style="font-size:0.62rem;font-weight:700;color:${todayMk ? 'var(--color-primary)' : 'var(--color-text-muted)'};">${DAYS_SHORT[i]}</span>`;
    emojiRow.appendChild(chip);
  });
  section.appendChild(emojiRow);
  container.appendChild(section);
}

// ─── Weekly Chart ─────────────────────────────────────────────────────────

function renderWeeklyChart(container) {
  const weekKeys   = getWeekKeys(getTodayKey());
  const dayMinutes = weekKeys.map(key =>
    state.sessions.filter(s => s.date === key).reduce((sum, s) => sum + (s.duration || 0), 0));
  const maxMinutes = Math.max(...dayMinutes, 1);

  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">Activity Chart 📊</div>`;

  const chartCard = document.createElement('div');
  chartCard.className = 'chart-container';
  const barsRow = document.createElement('div');
  barsRow.className = 'chart-bars';

  weekKeys.forEach((key, i) => {
    const mins  = dayMinutes[i];
    const pct   = Math.round((mins / maxMinutes) * 100);
    const today = isToday(key);
    const col   = document.createElement('div');
    col.className = 'chart-col';
    col.innerHTML = `
      ${mins > 0 ? `<span class="chart-min-label">${formatDuration(mins)}</span>` : '<span class="chart-min-label" style="opacity:0;">—</span>'}
      <div class="chart-bar${today ? ' today' : ''}${mins > 0 ? ' has-data' : ''}" style="height:${Math.max(pct, 4)}%;"></div>
      <span class="chart-day-label${today ? ' today' : ''}">${DAYS_SHORT[i]}</span>`;
    barsRow.appendChild(col);
  });

  chartCard.appendChild(barsRow);
  section.appendChild(chartCard);
  container.appendChild(section);
}

// ─── Streak Card ──────────────────────────────────────────────────────────

function renderStreakCard(container) {
  const streak = state.streak;
  let longest  = streak;
  if (state.sessions.length > 0) {
    const dates = [...new Set(state.sessions.map(s => s.date))].sort();
    let cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i] + 'T00:00:00') - new Date(dates[i-1] + 'T00:00:00')) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
      if (cur > longest) longest = cur;
    }
  }

  const msg = streak === 0 ? "Start training today to begin your streak! 💪"
    : streak < 3  ? "Keep going — you're building momentum! 🌱"
    : streak < 7  ? "Amazing consistency! Keep it up! ⚡"
    : streak < 14 ? "You're on fire! Don't break the chain! 🔥"
    : "Incredible — you're a training machine! 🏆";

  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">Streak 🔥</div>`;
  const card = document.createElement('div');
  card.className = 'streak-card';
  card.innerHTML = `
    <div class="streak-flame">🔥</div>
    <div class="streak-count">${streak}</div>
    <div class="streak-label">day${streak !== 1 ? 's' : ''} in a row</div>
    <div class="streak-best">Best: ${longest} day${longest !== 1 ? 's' : ''}</div>
    <div class="streak-msg">${msg}</div>`;
  section.appendChild(card);
  container.appendChild(section);
}

// ─── Training Mix ─────────────────────────────────────────────────────────

function renderTrainingMix(container) {
  if (!state.sessions.length) return;
  const counts = {};
  state.sessions.forEach(s => { counts[s.type] = (counts[s.type] || 0) + 1; });
  const sorted   = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCount = sorted[0]?.[1] || 1;

  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">Training Mix 🎯</div>`;
  const card = document.createElement('div');
  card.className = 'card'; card.style.margin = '0 16px 12px';
  const body = document.createElement('div'); body.className = 'card-body';

  sorted.forEach(([typeId, count]) => {
    const type = SESSION_TYPES.find(t => t.id === typeId) || SESSION_TYPES[0];
    const pct  = Math.round((count / maxCount) * 100);
    const row  = document.createElement('div');
    row.className = 'mix-row';
    row.innerHTML = `
      <span class="mix-icon">${type.icon}</span>
      <div class="mix-info">
        <div class="mix-name">${type.label}</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill thin" style="width:${pct}%;--fill-color:${type.color};"></div>
        </div>
      </div>
      <span class="mix-count">${count}</span>`;
    body.appendChild(row);
  });

  card.appendChild(body); section.appendChild(card); container.appendChild(section);
}

// ─── Personal Bests ───────────────────────────────────────────────────────

function renderPersonalBests(container) {
  const allResults = [];
  state.sessions.forEach(s => {
    (s.testResults || []).forEach(r => {
      if (r.name && r.value > 0) allResults.push({ ...r, date: s.date });
    });
  });
  if (!allResults.length) return;

  // Group by test name, sort each group chronologically
  const byName = {};
  allResults.forEach(r => { (byName[r.name] = byName[r.name] || []).push(r); });
  Object.values(byName).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));

  // Order tests by most recent activity
  const testNames = Object.keys(byName).sort(
    (a, b) => byName[b].at(-1).date.localeCompare(byName[a].at(-1).date)
  );

  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">Personal Bests 🏆</div>`;
  const card = document.createElement('div');
  card.className = 'card'; card.style.margin = '0 16px 16px';
  const body = document.createElement('div'); body.className = 'card-body';

  testNames.forEach((name, idx) => {
    const entries  = byName[name];
    const unit     = entries[0].unit || 's';
    const isTimed  = unit === 's';
    const pb       = entries.reduce(
      (best, r) => (isTimed ? r.value < best.value : r.value > best.value) ? r : best,
      entries[0]
    );
    const delta    = isTimed
      ? entries[0].value - entries.at(-1).value   // positive = faster (better)
      : entries.at(-1).value - entries[0].value;  // positive = more reps (better)
    const improving = delta > 0.005;
    const trendColor = improving ? 'var(--color-green)' : delta < -0.005 ? '#EF4444' : 'var(--color-text-muted)';
    const trendText  = entries.length < 2
      ? 'First attempt — keep going! 💪'
      : improving
        ? `↑ ${Math.abs(delta).toFixed(2)}${unit} better than first`
        : delta < -0.005
          ? `↓ ${Math.abs(delta).toFixed(2)}${unit} from first`
          : 'Consistent — holding steady';

    const block = document.createElement('div');
    block.className = idx > 0 ? 'pb-block pb-block--border' : 'pb-block';

    const recent = entries.slice(-5).reverse();
    block.innerHTML = `
      <div class="pb-header">
        <span class="pb-name">🧪 ${name}</span>
        <span class="pb-best-chip">🏆 ${isTimed ? pb.value.toFixed(2) : pb.value}${unit}</span>
      </div>
      <div class="pb-trend" style="color:${trendColor};">${trendText}</div>
      <div class="pb-history">
        ${recent.map(r => {
          const isPB = r.value === pb.value;
          const d    = keyToDate(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return `<div class="pb-row${isPB ? ' pb-row--pb' : ''}">
            <span class="pb-row-date">${d}</span>
            <span class="pb-row-val">${isTimed ? r.value.toFixed(2) : r.value}${unit}</span>
            ${isPB ? `<span class="pb-row-badge">PB</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    body.appendChild(block);
  });

  card.appendChild(body);
  section.appendChild(card);
  container.appendChild(section);
}

// ─── Recent Sessions ──────────────────────────────────────────────────────

function renderRecentSessions(container) {
  const sorted = [...state.sessions]
    .sort((a, b) => (b.timestamp || b.date) > (a.timestamp || a.date) ? 1 : -1);
  if (!sorted.length) return;

  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">Session History 📋</div>`;
  const card = document.createElement('div');
  card.className = 'card'; card.style.margin = '0 16px 16px';

  let lastDate = null;

  sorted.forEach(session => {
    const type = SESSION_TYPES.find(t => t.id === session.type) || SESSION_TYPES[0];
    const mood = session.mood ? (MOODS.find(m => m.id === session.mood)?.emoji || '') : '';
    const stars = DIFF_STARS[session.difficulty] || '';

    if (session.date !== lastDate) {
      lastDate = session.date;
      const header = document.createElement('div');
      header.className = 'session-list-date-header';
      header.textContent = isToday(session.date) ? 'Today' : formatDayFull(session.date);
      card.appendChild(header);
    }

    const item = document.createElement('div');
    item.className = 'session-list-item session-list-item--clickable';
    item.setAttribute('role', 'button');
    item.innerHTML = `
      <div class="session-list-icon" style="background:${type.color}20;">${type.icon}</div>
      <div class="session-list-info">
        <div class="session-list-name">${type.label}</div>
        <div class="session-list-meta">
          <span>⏱️ ${formatDuration(session.duration)}</span>
          ${stars ? `<span>${stars}</span>` : ''}
          ${session.notes ? `<span class="session-list-notes-preview">${session.notes}</span>` : ''}
        </div>
      </div>
      <div class="session-list-right">
        <div class="session-list-mood">${mood}</div>
      </div>`;

    item.addEventListener('click', () => showSessionDetailModal(session));
    card.appendChild(item);
  });

  section.appendChild(card);
  container.appendChild(section);
}

// ─── Entry point ─────────────────────────────────────────────────────────

export async function renderProgress(container) {
  if (!state.sessions.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state'; empty.style.marginTop = '40px';
    empty.innerHTML = `
      <span class="empty-state-icon">📊</span>
      <p class="empty-state-text">No sessions logged yet!<br>Start training to see your progress 💪</p>`;
    container.appendChild(empty);
    return;
  }

  renderWeekSummary(container);
  renderWeeklyChart(container);
  renderStreakCard(container);
  renderTrainingMix(container);
  renderPersonalBests(container);
  renderRecentSessions(container);

  const pad = document.createElement('div'); pad.style.height = '8px';
  container.appendChild(pad);
}
