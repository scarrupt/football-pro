import { navigate, state, showModal, closeModal, showToast, loadState } from '../app.js';
import { SESSION_TYPES, DAYS_SHORT, DAYS_FULL }                         from '../constants.js';
import {
  getTodayKey, getWeekKeys, getWeekStart, keyToDate, dateToKey,
  formatDayShort, isToday, isPast, genId,
} from '../utils.js';
import { db } from '../db.js';

// Module-level week offset (in weeks, relative to current week)
let weekOffset = 0;

// ─── Show Add-to-Planner Modal ────────────────────────────────────────────────

export function showAddToPlannerModal(dateKey, onAdded) {
  const dateLabel = (() => {
    if (isToday(dateKey)) return 'Today';
    const d = keyToDate(dateKey);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  })();

  const typesHtml = SESSION_TYPES.map(type => `
    <button class="planner-type-btn" data-type="${type.id}" style="--card-color:${type.color};">
      <span class="planner-type-icon">${type.icon}</span>
      <span class="planner-type-name">${type.label}</span>
    </button>
  `).join('');

  showModal(`
    <div class="modal-title">Add to ${dateLabel} 📅</div>
    <div class="modal-subtitle">Choose a session type:</div>
    <div class="planner-type-grid">
      ${typesHtml}
    </div>
    <div style="height:8px;"></div>
  `, {});

  // Bind type buttons after DOM update
  setTimeout(() => {
    document.querySelectorAll('.planner-type-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const typeId = btn.dataset.type;
        const item = {
          id:   genId(),
          date: dateKey,
          type: typeId,
          done: false,
        };
        await db.put('planner', item);
        await loadState();
        closeModal();
        if (typeof onAdded === 'function') onAdded();
      });
    });
  }, 50);
}

// ─── Show Planner Item Options Modal ─────────────────────────────────────────

function showItemOptionsModal(item, onChanged) {
  const type = SESSION_TYPES.find(t => t.id === item.type) || SESSION_TYPES[0];

  showModal(`
    <div class="modal-title">${type.icon} ${type.label}</div>
    <div class="modal-subtitle">${formatDayShort(item.date)}</div>
    <div class="modal-actions">
      ${!item.done ? `
        <button id="modal-log-btn" class="btn btn-primary btn-full">
          ⚡ Log as Done
        </button>
      ` : `
        <p style="color:var(--color-green);font-weight:700;text-align:center;">✅ Already done!</p>
      `}
      <button id="modal-delete-btn" class="btn btn-danger btn-full">
        🗑️ Remove from plan
      </button>
      <button id="modal-cancel-btn" class="btn btn-ghost btn-full">
        Cancel
      </button>
    </div>
  `, {});

  setTimeout(() => {
    document.getElementById('modal-log-btn')?.addEventListener('click', () => {
      closeModal();
      navigate('log', { type: item.type, plannerId: item.id, date: item.date });
    });

    document.getElementById('modal-delete-btn')?.addEventListener('click', async () => {
      await db.delete('planner', item.id);
      await loadState();
      closeModal();
      showToast('Removed from plan 🗑️', 'info');
      if (typeof onChanged === 'function') onChanged();
    });

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
      closeModal();
    });
  }, 50);
}

// ─── Render Day Card ──────────────────────────────────────────────────────────

function renderDayCard(container, dateKey, plannerItems, sessions, onChanged) {
  const date      = keyToDate(dateKey);
  const dayIndex  = (date.getDay() + 6) % 7; // Mon=0
  const dayName   = DAYS_FULL[dayIndex];
  const shortDate = formatDayShort(dateKey);
  const today     = isToday(dateKey);
  const past      = isPast(dateKey);

  const doneIds   = new Set(sessions.filter(s => s.plannerId).map(s => s.plannerId));
  const items     = plannerItems.filter(p => p.date === dateKey);

  const card = document.createElement('div');
  card.className = `day-card${today ? ' today' : ''}${past ? ' past' : ''}`;

  const headerHtml = `
    <div class="day-card-header">
      <div class="day-card-header-left">
        <span class="day-name">${today ? '📍 ' : ''}${dayName}</span>
        <span class="day-date">${shortDate}</span>
      </div>
      <button class="btn btn-sm ${today ? 'btn-ghost' : 'btn-secondary'} add-day-btn"
        style="${today ? 'border-color:rgba(255,255,255,0.5);color:#fff;' : ''}">
        + Add
      </button>
    </div>
  `;

  let bodyHtml = '';
  if (items.length === 0) {
    bodyHtml = `<p class="day-empty">😴 Rest day</p>`;
  } else {
    bodyHtml = items.map(item => {
      const type = SESSION_TYPES.find(t => t.id === item.type) || SESSION_TYPES[0];
      const done = doneIds.has(item.id) || item.done;
      return `
        <div class="session-pill${done ? ' done' : ''}"
             style="--pill-color:${type.color};"
             data-item-id="${item.id}">
          <span class="pill-icon">${type.icon}</span>
          <span class="pill-name">${type.label}</span>
          ${done ? '<span class="pill-check">✅</span>' : ''}
        </div>
      `;
    }).join('');
  }

  card.innerHTML = headerHtml + `<div class="day-card-body">${bodyHtml}</div>`;

  // Add button
  card.querySelector('.add-day-btn').addEventListener('click', () => {
    showAddToPlannerModal(dateKey, async () => {
      await loadState();
      onChanged();
    });
  });

  // Pill click → options
  card.querySelectorAll('.session-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const itemId   = pill.dataset.itemId;
      const itemData = plannerItems.find(p => p.id === itemId);
      if (itemData) {
        showItemOptionsModal(itemData, async () => {
          await loadState();
          onChanged();
        });
      }
    });
  });

  container.appendChild(card);
}

// ─── Render Planner Page ──────────────────────────────────────────────────────

export async function renderPlanner(container) {
  // Compute week start based on offset
  const baseDate  = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekStart = getWeekStart(baseDate);
  const weekKeys  = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekKeys.push(dateToKey(d));
  }

  const weekLabel = (() => {
    const mon = weekKeys[0];
    const sun = weekKeys[6];
    const monDate = keyToDate(mon);
    const sunDate = keyToDate(sun);
    const monStr  = monDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const sunStr  = sunDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${monStr} – ${sunStr}`;
  })();

  function reRender() {
    container.innerHTML = '';
    renderPlannerContent(container, weekKeys, weekLabel);
  }

  renderPlannerContent(container, weekKeys, weekLabel);

  function renderPlannerContent(cont, keys, label) {
    cont.innerHTML = '';

    // ── Week Navigation ──────────────────────────────────────────────────
    const weekNav = document.createElement('div');
    weekNav.className = 'week-nav';
    weekNav.innerHTML = `
      <button class="week-nav-btn" id="prev-week-btn">‹</button>
      <span class="week-nav-label">📅 ${label}</span>
      <button class="week-nav-btn" id="next-week-btn">›</button>
    `;
    cont.appendChild(weekNav);

    weekNav.querySelector('#prev-week-btn').addEventListener('click', () => {
      weekOffset--;
      navigate('planner');
    });
    weekNav.querySelector('#next-week-btn').addEventListener('click', () => {
      weekOffset++;
      navigate('planner');
    });

    // ── Day Chips Row ────────────────────────────────────────────────────
    const chipsRow = document.createElement('div');
    chipsRow.className = 'week-chips';
    keys.forEach((key, i) => {
      const count = state.plannerItems.filter(p => p.date === key).length;
      const chip  = document.createElement('div');
      chip.className = `week-chip${isToday(key) ? ' today' : ''}`;
      chip.innerHTML = `
        <span>${DAYS_SHORT[i]}</span>
        <span class="week-chip-badge ${count === 0 ? 'empty' : ''}">${count}</span>
      `;
      chipsRow.appendChild(chip);
    });
    cont.appendChild(chipsRow);

    // ── Day Cards ────────────────────────────────────────────────────────
    keys.forEach(key => {
      renderDayCard(cont, key, state.plannerItems, state.sessions, () => reRender());
    });

    // Bottom padding
    const pad = document.createElement('div');
    pad.style.height = '8px';
    cont.appendChild(pad);
  }
}
