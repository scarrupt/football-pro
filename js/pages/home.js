import { navigate, state, loadState } from '../app.js';
import { SESSION_TYPES, MOTIVATIONAL_QUOTES } from '../constants.js';
import { getTodayKey, formatDayFull }          from '../utils.js';
import { showAddToPlannerModal }               from './planner.js';

/**
 * Returns a greeting based on current hour
 */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Returns a deterministic quote for today (changes daily)
 */
function getTodayQuote() {
  const todayKey = getTodayKey();
  const seed = parseInt(todayKey.replace(/-/g, ''), 10) % MOTIVATIONAL_QUOTES.length;
  return MOTIVATIONAL_QUOTES[Math.abs(seed) % MOTIVATIONAL_QUOTES.length];
}

/**
 * Renders the Today's Plan section
 */
function renderTodayPlan(container) {
  const todayKey     = getTodayKey();
  const todayItems   = state.plannerItems.filter(p => p.date === todayKey);
  const doneIds      = new Set(state.sessions.filter(s => s.plannerId).map(s => s.plannerId));

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="section-title">
      Today's Plan 📋
      <button class="btn btn-sm btn-secondary" id="add-today-btn" style="margin-left:auto;">+ Add</button>
    </div>
    <div class="card" style="margin:0 16px 12px;">
      <div id="today-plan-list"></div>
    </div>
  `;

  const list = section.querySelector('#today-plan-list');

  if (todayItems.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:20px;">
        <span class="empty-state-icon">📋</span>
        <p class="empty-state-text">Nothing planned yet!<br>Add something to train today 💪</p>
      </div>
    `;
  } else {
    todayItems.forEach(item => {
      const type  = SESSION_TYPES.find(t => t.id === item.type) || SESSION_TYPES[0];
      const done  = doneIds.has(item.id);
      const row   = document.createElement('div');
      row.className = 'plan-item-card';
      row.innerHTML = `
        <span class="plan-dot" style="background:${type.color};"></span>
        <span class="plan-item-icon">${type.icon}</span>
        <span class="plan-item-name" style="${done ? 'text-decoration:line-through;color:var(--color-text-muted);' : ''}">${type.label}</span>
        ${done
          ? `<span class="plan-item-done-check">✅</span>`
          : `<button class="btn btn-sm btn-secondary log-plan-btn" data-id="${item.id}" data-type="${item.type}" data-date="${item.date}">Log it →</button>`
        }
      `;
      if (!done) {
        row.querySelector('.log-plan-btn').addEventListener('click', () => {
          navigate('log', { type: item.type, plannerId: item.id, date: item.date });
        });
      }
      list.appendChild(row);
    });
  }

  // Add to today button
  section.querySelector('#add-today-btn').addEventListener('click', () => {
    showAddToPlannerModal(todayKey, async () => {
      await loadState();
      await navigate('home');
    });
  });

  container.appendChild(section);
}

/**
 * Renders the Quick Start horizontal scroll row
 */
function renderQuickStart(container) {
  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">Quick Start ⚡</div>`;

  const scrollRow = document.createElement('div');
  scrollRow.className = 'quick-scroll';

  SESSION_TYPES.forEach(type => {
    const card = document.createElement('button');
    card.className = 'quick-type-card';
    card.style.setProperty('--card-color', type.color);
    card.innerHTML = `
      <span class="quick-type-icon">${type.icon}</span>
      <span class="quick-type-label">${type.label}</span>
    `;
    card.addEventListener('click', () => {
      navigate('log', { type: type.id });
    });
    scrollRow.appendChild(card);
  });

  section.appendChild(scrollRow);
  container.appendChild(section);
}

/**
 * Main render function for the Home page
 */
export async function renderHome(container) {
  container.classList.add('home-page');

  const name     = state.settings.playerName || 'Player';
  const greeting = getGreeting();
  const todayStr = formatDayFull(getTodayKey());
  const streak   = state.streak;
  const quote    = getTodayQuote();

  // ── Hero Card ──────────────────────────────────────────────────────────────
  const hero = document.createElement('div');
  hero.className = 'home-hero';
  hero.innerHTML = `
    <div class="hero-greeting">${greeting}, ${name}! 👋</div>
    <div class="hero-date">${todayStr}</div>
    <div class="hero-streak">
      <span class="hero-streak-flame">🔥</span>
      <span>${streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''} streak!` : 'Start your streak today!'}</span>
    </div>
  `;
  container.appendChild(hero);

  // ── Today's Plan ──────────────────────────────────────────────────────────
  renderTodayPlan(container);

  // ── Quick Start ──────────────────────────────────────────────────────────
  renderQuickStart(container);

  // ── Motivational Quote ───────────────────────────────────────────────────
  const quoteCard = document.createElement('div');
  quoteCard.className = 'quote-card';
  quoteCard.innerHTML = `<p class="quote-text">${quote}</p>`;
  container.appendChild(quoteCard);
}
