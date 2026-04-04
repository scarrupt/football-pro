import { state, showToast, loadState, navigate } from '../app.js';
import { BADGE_DEFINITIONS }                     from '../constants.js';
import { requestPermission, getNotificationSettings, saveNotificationSettings } from '../notifications.js';
import { exportData, importData }                from '../export.js';

function fmtEarnedDate(iso) {
  if (!iso) return '';
  return 'Earned ' + new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isRecent(iso) {
  return iso && (Date.now() - new Date(iso).getTime()) < 7 * 86400000;
}

// ─── Badge grid ───────────────────────────────────────────────────────────

function renderBadges(container) {
  const earnedMap = {};
  state.earnedBadges.forEach(b => { earnedMap[b.id] = b.earnedAt || null; });

  const totalEarned = Object.keys(earnedMap).length;
  const totalBadges = BADGE_DEFINITIONS.length;
  const pct         = totalBadges > 0 ? Math.round((totalEarned / totalBadges) * 100) : 0;

  // Summary
  const summaryEl = document.createElement('div');
  summaryEl.className = 'badges-summary';
  summaryEl.style.flexDirection = 'column';
  summaryEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;width:100%;">
      <span style="font-size:1.8rem;">🏅</span>
      <div style="flex:1;">
        <div style="font-size:1rem;font-weight:800;color:var(--color-primary);">${totalEarned} / ${totalBadges} badges earned</div>
        <div class="progress-bar-wrap" style="margin-top:6px;">
          <div class="progress-bar-fill" style="width:${pct}%;"></div>
        </div>
      </div>
      <span style="font-size:1rem;font-weight:700;color:var(--color-amber);">${pct}%</span>
    </div>`;
  container.appendChild(summaryEl);

  // Recently earned
  const recentlyEarned = BADGE_DEFINITIONS.filter(b => earnedMap[b.id] && isRecent(earnedMap[b.id]));
  if (recentlyEarned.length > 0) {
    const recentSection = document.createElement('div');
    recentSection.className = 'recently-earned-section';
    recentSection.innerHTML = `
      <div class="recently-earned-title">🌟 Recently Earned!</div>
      <div class="recently-earned-list">
        ${recentlyEarned.map(b => `
          <div class="recently-earned-chip"><span>${b.icon}</span><span>${b.name}</span></div>
        `).join('')}
      </div>`;
    container.appendChild(recentSection);
  }

  // All badges grid
  const gridTitle = document.createElement('div');
  gridTitle.className = 'section-title';
  gridTitle.textContent = 'All Badges';
  container.appendChild(gridTitle);

  const grid = document.createElement('div');
  grid.className = 'badge-grid';
  BADGE_DEFINITIONS.forEach(def => {
    const earnedAt = earnedMap[def.id] || null;
    const earned   = !!earnedAt;
    const recent   = earned && isRecent(earnedAt);
    const card     = document.createElement('div');
    card.className = `badge-card${earned ? ' earned' : ' locked'}${recent ? ' recent-glow' : ''}`;
    card.innerHTML = `
      <div class="badge-icon" style="position:relative;">
        ${def.icon}
        ${!earned ? '<span class="badge-lock">🔒</span>' : ''}
      </div>
      <div class="badge-name">${def.name}</div>
      <div class="badge-desc">${def.desc}</div>
      ${earned ? `<div class="badge-date">${fmtEarnedDate(earnedAt)}</div>` : ''}`;
    grid.appendChild(card);
  });
  container.appendChild(grid);

  if (totalEarned < totalBadges) {
    const remaining = totalBadges - totalEarned;
    const enc = document.createElement('div');
    enc.style.cssText = 'text-align:center;padding:8px 20px 8px;color:var(--color-text-muted);font-size:0.85rem;';
    enc.innerHTML = `<span style="font-size:1.5rem;display:block;margin-bottom:6px;">✨</span>${remaining} badge${remaining !== 1 ? 's' : ''} to go! Keep training! 💪`;
    container.appendChild(enc);
  }
}

// ─── Notifications settings ───────────────────────────────────────────────

async function renderNotificationSettings(container) {
  const settings    = await getNotificationSettings();
  const permission  = 'Notification' in window ? Notification.permission : 'unsupported';
  const supported   = permission !== 'unsupported';

  const TIME_OPTIONS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00',
    '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];

  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">🔔 Notifications</div>`;

  const card = document.createElement('div');
  card.className = 'card'; card.style.margin = '0 16px 12px';
  const body = document.createElement('div'); body.className = 'card-body';

  if (!supported) {
    body.innerHTML = `<p style="color:var(--color-text-muted);font-size:.85rem;padding:4px 0;">Notifications are not supported in this browser.</p>`;
    card.appendChild(body); section.appendChild(card); container.appendChild(section);
    return;
  }

  body.innerHTML = `
    <div class="notif-row">
      <div>
        <div class="notif-row-label">Daily training reminder</div>
        <div class="notif-row-sub">${permission === 'granted' ? '✅ Permission granted' : permission === 'denied' ? '🚫 Blocked — enable in browser settings' : '⚠️ Permission not yet granted'}</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="notif-toggle" ${settings.enabled && permission === 'granted' ? 'checked' : ''} ${permission !== 'granted' ? 'disabled' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="notif-time-row" id="notif-time-row" style="${settings.enabled && permission === 'granted' ? '' : 'opacity:.4;pointer-events:none;'}">
      <label class="form-label" style="margin-bottom:6px;">Reminder time</label>
      <select id="notif-time-sel" class="notif-time-select">
        ${TIME_OPTIONS.map(t => `<option value="${t}" ${t === settings.time ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>
    ${permission === 'default' ? `<button class="btn btn-secondary btn-full" id="notif-perm-btn" style="margin-top:12px;">Allow notifications</button>` : ''}`;

  card.appendChild(body); section.appendChild(card); container.appendChild(section);

  // Bind toggle
  body.querySelector('#notif-toggle')?.addEventListener('change', async e => {
    const enabled = e.target.checked;
    const time    = body.querySelector('#notif-time-sel')?.value || '16:00';
    await saveNotificationSettings({ enabled, time });
    body.querySelector('#notif-time-row').style.cssText = enabled ? '' : 'opacity:.4;pointer-events:none;';
    showToast(enabled ? 'Reminder set! 🔔' : 'Reminder off', 'info');
  });

  body.querySelector('#notif-time-sel')?.addEventListener('change', async e => {
    const enabled = body.querySelector('#notif-toggle')?.checked || false;
    await saveNotificationSettings({ enabled, time: e.target.value });
    if (enabled) showToast('Reminder updated 🔔', 'info');
  });

  body.querySelector('#notif-perm-btn')?.addEventListener('click', async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      showToast('Notifications allowed! 🔔', 'success');
      await navigate('badges_page');
    } else {
      showToast('Permission denied', 'error');
    }
  });
}

// ─── Export / Import ──────────────────────────────────────────────────────

function renderDataSection(container) {
  const section = document.createElement('div');
  section.innerHTML = `<div class="section-title">📦 My Data</div>`;

  const card = document.createElement('div');
  card.className = 'card'; card.style.margin = '0 16px 16px';
  const body = document.createElement('div'); body.className = 'card-body';
  body.innerHTML = `
    <p style="font-size:.85rem;color:var(--color-text-muted);margin-bottom:12px;">
      Back up your sessions and progress, or restore from a previous backup.
    </p>
    <div class="data-btn-row">
      <button class="btn btn-secondary" id="export-btn" style="flex:1;">📥 Export backup</button>
      <button class="btn btn-secondary" id="import-btn" style="flex:1;">📤 Import backup</button>
    </div>
    <input type="file" id="import-file-in" accept=".json" style="display:none;">
    <div id="data-status" style="margin-top:10px;font-size:.8rem;color:var(--color-text-muted);min-height:18px;"></div>`;

  card.appendChild(body); section.appendChild(card); container.appendChild(section);

  body.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      await exportData();
      showToast('Backup downloaded! 📥', 'success');
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    }
  });

  const importBtn  = body.querySelector('#import-btn');
  const fileInput  = body.querySelector('#import-file-in');
  const statusDiv  = body.querySelector('#data-status');

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    fileInput.value = '';
    importBtn.disabled = true;
    statusDiv.textContent = 'Importing…';
    try {
      const result = await importData(file);
      await loadState();
      statusDiv.textContent = `Imported ${result.sessions} sessions, ${result.planner} plan items, ${result.badges} badges.`;
      showToast(`Imported ${result.sessions} sessions! 🎉`, 'success');
    } catch (err) {
      statusDiv.textContent = 'Error: ' + err.message;
      showToast('Import failed: ' + err.message, 'error');
    } finally {
      importBtn.disabled = false;
    }
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────

export async function renderBadgesPage(container) {
  renderBadges(container);
  await renderNotificationSettings(container);
  renderDataSection(container);

  // Bottom padding
  const pad = document.createElement('div'); pad.style.height = '12px';
  container.appendChild(pad);
}
