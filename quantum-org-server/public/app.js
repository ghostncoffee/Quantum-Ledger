(function () {
  const TOKEN_KEY       = 'clan-data-server-token';
  const FAST_REFRESH_MS = 60_000;  // health + stats + activity — every 60 s
  const SLOW_REFRESH_MS = 300_000; // members, ships, blueprints, leaderboard — every 5 min

  const authGate   = document.getElementById('auth-gate');
  const dashboard  = document.getElementById('dashboard');
  const tokenInput = document.getElementById('token-input');
  const tokenSave  = document.getElementById('token-save');
  const authStatus = document.getElementById('auth-status');

  let token = localStorage.getItem(TOKEN_KEY) || '';
  let fastTimer = null;
  let slowTimer = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setStatus(msg, kind) {
    authStatus.textContent = msg;
    authStatus.className = kind || '';
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts && opts.headers) },
    });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function fmtUec(n) {
    if (n == null || n === 0) return '—';
    return Number(n).toLocaleString() + ' UEC';
  }

  function renderRows(tbodyId, emptyId, rows, mapper) {
    const tbody = document.querySelector('#' + tbodyId + ' tbody');
    const emptyEl = document.getElementById(emptyId);
    tbody.innerHTML = '';
    if (!rows || !rows.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    for (const row of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = mapper(row);
      tbody.appendChild(tr);
    }
  }

  // ── Tab navigation ─────────────────────────────────────────────────────────

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'settings') loadSettings();
    });
  });

  // ── Member approval ────────────────────────────────────────────────────────

  async function setMemberStatus(id, status) {
    try {
      await api('/api/members/' + id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      refreshSlow();
    } catch (e) { handleAuthError(e); }
  }

  function renderPending(pending) {
    const section = document.getElementById('pending-section');
    const badge   = document.getElementById('pending-badge');

    if (!pending.length) {
      section.hidden = true;
      badge.hidden = true;
      return;
    }

    section.hidden = false;
    badge.hidden = false;
    badge.textContent = pending.length;

    renderRows('pending-table', null, pending, m =>
      '<td>' + esc(m.username) + '</td>' +
      '<td>' + fmtTime(m.first_seen) + '</td>' +
      '<td>' + fmtTime(m.last_seen) + '</td>' +
      '<td>' +
        '<button class="btn-approve" onclick="window.__approve(\'' + esc(m.id) + '\')">Approve</button>' +
        '<button class="btn-reject"  onclick="window.__reject(\''  + esc(m.id) + '\')">Reject</button>'  +
      '</td>'
    );
  }

  // Expose approve/reject to onclick handlers inside renderRows HTML
  window.__approve = id => setMemberStatus(id, 'approved');
  window.__reject  = id => setMemberStatus(id, 'rejected');

  // ── Settings ───────────────────────────────────────────────────────────────

  async function loadSettings() {
    try {
      const settings = await api('/api/settings');
      document.getElementById('setting-clan-name').value = settings.clanName ?? '';
    } catch (e) { handleAuthError(e); }
  }

  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          clanName: document.getElementById('setting-clan-name').value.trim(),
        }),
      });
      const saved = document.getElementById('settings-saved');
      saved.hidden = false;
      setTimeout(() => { saved.hidden = true; }, 2500);
      // Reflect clan name change immediately in the header
      const name = document.getElementById('setting-clan-name').value.trim();
      if (name) document.getElementById('clan-title').textContent = name;
    } catch (e) { handleAuthError(e); }
  });

  // ── Data refresh ───────────────────────────────────────────────────────────

  function handleAuthError(e) {
    if (e.status === 401) {
      stopPolling();
      localStorage.removeItem(TOKEN_KEY);
      token = '';
      dashboard.hidden = true;
      authGate.hidden = false;
      setStatus('Invalid auth token.', 'error');
      return true;
    }
    return false;
  }

  // Runs every 60 s — health, stats, activity feed
  async function refreshFast() {
    try {
      const [health, clanStats, activity] = await Promise.all([
        api('/api/health'),
        api('/api/stats/clan?period=week'),
        api('/api/stats/activity/recent?limit=50'),
      ]);

      const clanName = health.clanName || 'Clan Server';
      document.getElementById('clan-title').textContent = clanName;
      document.title = clanName + ' — Dashboard';

      document.getElementById('server-info').innerHTML =
        '<span>' + esc(health.serverId) + '</span> · uptime ' +
        Math.floor(health.uptimeSeconds / 60) + 'm';

      document.getElementById('stats-row').innerHTML = [
        ['Members',          health.memberCount],
        ['Active this week', clanStats.activeMembers],
        ['Sessions (week)',  clanStats.sessionCount],
      ].map(([label, value]) =>
        '<div class="stat">' +
          '<div class="value">' + esc(value) + '</div>' +
          '<div class="label">' + esc(label) + '</div>' +
        '</div>'
      ).join('');

      renderRows('activity-table', 'activity-empty', activity, a =>
        '<td>' + fmtTime(a.occurred_at) + '</td>' +
        '<td>' + esc(a.username || '—') + '</td>' +
        '<td>' + esc(a.activity_type) + '</td>' +
        '<td>' + esc(a.description) + '</td>' +
        '<td class="amount">' + (a.amount ? fmtUec(a.amount) : '—') + '</td>'
      );

      authGate.hidden = true;
      dashboard.hidden = false;
    } catch (e) { handleAuthError(e); }
  }

  // Runs every 5 min — members (all statuses), ships, blueprints, leaderboard
  async function refreshSlow() {
    try {
      const [allMembers, ships, blueprints, leaderboard] = await Promise.all([
        api('/api/members?status=all&limit=500'),
        api('/api/members/ships'),
        api('/api/blueprints'),
        api('/api/leaderboard/sessions?period=week&limit=10'),
      ]);

      const pending  = (allMembers || []).filter(m => m.status === 'pending');
      const approved = (allMembers || []).filter(m => m.status === 'approved');

      renderPending(pending);

      renderRows('leaderboard-table', 'leaderboard-empty', leaderboard.entries, e =>
        '<td class="rank">' + esc(e.rank) + '</td>' +
        '<td>' + esc(e.username) + '</td>' +
        '<td>' + esc(e.value) + '</td>'
      );

      renderRows('members-table', 'members-empty', approved, m =>
        '<td>' + esc(m.username) + '</td>' +
        '<td>' + esc(m.session_count) + '</td>' +
        '<td>' + esc(m.ship_count) + '</td>' +
        '<td>' + fmtTime(m.first_seen) + '</td>' +
        '<td>' + fmtTime(m.last_seen) + '</td>'
      );

      renderRows('ships-table', 'ships-empty', ships, s =>
        '<td>' + esc(s.name) + '</td>' +
        '<td>' + esc(s.type) + '</td>' +
        '<td>' + (s.scu_capacity ? esc(s.scu_capacity) : '—') + '</td>' +
        '<td>' + esc(s.count) + '</td>'
      );

      renderRows('blueprints-table', 'blueprints-empty', blueprints, b =>
        '<td>' + esc(b.product_name) + '</td>' +
        '<td>' + esc((b.members || []).length) + '</td>' +
        '<td>' + esc((b.members || []).join(', ')) + '</td>'
      );
    } catch (e) { handleAuthError(e); }
  }

  function startPolling() {
    stopPolling();
    refreshSlow();
    refreshFast();
    slowTimer = setInterval(refreshSlow, SLOW_REFRESH_MS);
    fastTimer = setInterval(refreshFast, FAST_REFRESH_MS);
  }

  function stopPolling() {
    if (fastTimer) { clearInterval(fastTimer); fastTimer = null; }
    if (slowTimer) { clearInterval(slowTimer); slowTimer = null; }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  tokenSave.addEventListener('click', () => {
    const value = tokenInput.value.trim();
    if (!value) { setStatus('Enter a token.', 'error'); return; }
    token = value;
    localStorage.setItem(TOKEN_KEY, token);
    setStatus('Connecting…', '');
    startPolling();
  });

  tokenInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') tokenSave.click();
  });

  if (token) {
    tokenInput.value = token;
    startPolling();
  }
})();
