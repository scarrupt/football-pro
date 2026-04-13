import { db } from './db.js';
import { renderHome }       from './pages/home.js';
import { renderPlanner }    from './pages/planner.js';
import { renderLog }        from './pages/log.js';
import { renderProgress }   from './pages/progress.js';
import { renderBadgesPage } from './pages/badges_page.js';
import { renderPlayer }     from './pages/player.js';
import { checkAndAwardBadges } from './badges.js';
import { BADGE_DEFINITIONS }   from './constants.js';
import { calculateStreak }     from './utils.js';
import { initNotifications }   from './notifications.js';

// ─── Shared Application State ────────────────────────────────────────────────

export const state = {
  currentPage:  'home',
  sessions:     [],
  plannerItems: [],
  earnedBadges: [],
  settings:     {},
  streak:       0,
  routeParams:  {},
};

// Navigation history stack (module-private)
const _navHistory = [];
let _bypassHistory = false;

// ─── Page Titles ──────────────────────────────────────────────────────────────

const PAGE_TITLES = {
  home:        '',
  planner:     'My Week 📅',
  log:         'Log Session ⚡',
  progress:    'My Progress 📊',
  badges_page: 'My Badges ⭐',
  player:      'Guided Session ▶',
};

// ─── Navigation ───────────────────────────────────────────────────────────────

export async function navigate(page, params = {}) {
  if (!_bypassHistory) {
    _navHistory.push({ page: state.currentPage, params: { ...state.routeParams } });
  }
  _bypassHistory    = false;
  state.currentPage = page;
  state.routeParams = params;

  // Update nav active states (only main tabs, not log)
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Back button: show on log and player pages
  const backBtn = document.getElementById('back-btn');
  if (page === 'log' || page === 'player') {
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
  }

  // Page title
  const titleEl = document.getElementById('page-title');
  titleEl.textContent = PAGE_TITLES[page] || '';

  // Render page
  const content = document.getElementById('page-content');
  content.innerHTML = '';
  content.className = 'page-content';

  switch (page) {
    case 'home':        await renderHome(content, params);        break;
    case 'planner':     await renderPlanner(content, params);     break;
    case 'log':         await renderLog(content, params);         break;
    case 'progress':    await renderProgress(content, params);    break;
    case 'badges_page': await renderBadgesPage(content, params);  break;
    case 'player':      await renderPlayer(content, params);      break;
    default:            await renderHome(content, params);
  }

  // Animate in
  content.classList.add('fade-in');
}

export async function navigateBack() {
  const prev = _navHistory.pop();
  _bypassHistory = true;
  await navigate(prev?.page || 'home', prev?.params || {});
}

// ─── Modal ────────────────────────────────────────────────────────────────────

let _modalOnClose = null;

export function showModal(contentHtml, options = {}) {
  _modalOnClose = options.onClose || null;
  const overlay = document.getElementById('modal-overlay');
  const body    = document.getElementById('modal-body');
  body.innerHTML = contentHtml;
  overlay.classList.remove('hidden');
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
  if (_modalOnClose) {
    _modalOnClose();
    _modalOnClose = null;
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const icons  = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3000);
}

// ─── State Loading ────────────────────────────────────────────────────────────

export async function loadState() {
  const [sessions, plannerItems, earnedBadges, settingsArr] = await Promise.all([
    db.getAll('sessions'),
    db.getAll('planner'),
    db.getAll('badges'),
    db.getAll('settings'),
  ]);

  state.sessions     = sessions     || [];
  state.plannerItems = plannerItems || [];
  state.earnedBadges = earnedBadges || [];

  // Convert settings array to key/value map
  state.settings = {};
  (settingsArr || []).forEach(s => { state.settings[s.key] = s.value; });

  // Recalculate streak
  state.streak = calculateStreak(state.sessions);
}

// ─── Delete Session ───────────────────────────────────────────────────────

export async function deleteSession(id) {
  await db.delete('sessions', id);
}

// ─── Save Session + Badge Check ───────────────────────────────────────────────

export async function saveSessionAndCheckBadges(session) {
  await db.put('sessions', session);
  await loadState();

  // Check for new badges
  const newBadgeIds = checkAndAwardBadges(state.sessions, state.earnedBadges, state.streak);

  for (const badgeId of newBadgeIds) {
    const badgeDef = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    await db.put('badges', {
      id:       badgeId,
      earnedAt: new Date().toISOString(),
    });
    if (badgeDef) {
      showToast(`${badgeDef.icon} Badge unlocked: ${badgeDef.name}!`, 'success');
    }
  }

  // Reload state to include newly saved badges
  if (newBadgeIds.length > 0) {
    await loadState();
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function showOnboarding() {
  showModal(`
    <div class="onboarding-hero">
      <span class="onboarding-ball">⚽</span>
      <div class="onboarding-title">Welcome to Football Pro!</div>
      <p class="onboarding-sub">Your personal training companion 🌟</p>
    </div>
    <p style="font-size:0.9rem; color:var(--color-text-muted); margin-bottom:4px;">What's your name?</p>
    <input
      id="player-name-input"
      class="form-input"
      type="text"
      placeholder="e.g. Sophia"
      maxlength="30"
      autocomplete="given-name"
    />
    <button id="onboarding-save-btn" class="btn btn-primary btn-full">
      Let's Go! 🚀
    </button>
  `, { onClose: null });

  // Bind save button
  setTimeout(() => {
    const saveBtn = document.getElementById('onboarding-save-btn');
    const input   = document.getElementById('player-name-input');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      const name = (input?.value || '').trim();
      if (!name) {
        input?.focus();
        return;
      }
      await db.put('settings', { key: 'playerName', value: name });
      state.settings.playerName = name;
      closeModal();
      // Re-render home to show the greeting
      await navigate('home');
    });

    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveBtn.click();
    });

    input?.focus();
  }, 100);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    // Open DB
    await db.open();

    // Load state
    await loadState();

    // Bottom nav clicks
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) navigate(page);
      });
    });

    // FAB → log
    document.getElementById('quick-log-btn').addEventListener('click', () => {
      navigate('log');
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', navigateBack);

    // Modal overlay click to close
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) {
        closeModal();
      }
    });

    // Init notifications (schedule reminder if enabled)
    await initNotifications();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('SW registration failed:', err);
      });
    }

    // Hide splash and show app after 600ms
    setTimeout(async () => {
      const splash    = document.getElementById('splash');
      const header    = document.getElementById('app-header');
      const content   = document.getElementById('page-content');
      const nav       = document.getElementById('bottom-nav');

      splash.classList.add('hidden');
      header.classList.remove('hidden');
      content.classList.remove('hidden');
      nav.classList.remove('hidden');

      // Navigate to home
      await navigate('home');

      // Show onboarding if no player name
      if (!state.settings.playerName) {
        showOnboarding();
      }
    }, 600);

  } catch (err) {
    console.error('App init error:', err);
  }
}

init();
