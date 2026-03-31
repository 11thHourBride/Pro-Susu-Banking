// ═══════════════════════════════════════════════════════
//  USERS — FULL REWRITE
// ═══════════════════════════════════════════════════════

const ROLE_META = {
  admin            : { emoji:'👑', label:'Administrator',      color:'var(--gold)'    },
  manager          : { emoji:'🗂️', label:'Manager',            color:'var(--info)'    },
  accountant       : { emoji:'📊', label:'Accountant',         color:'var(--success)' },
  accounting_clerk : { emoji:'✍️', label:'Accounting Clerk',   color:'#a78bfa'        },
  teller           : { emoji:'💵', label:'Teller',             color:'var(--warning)' },
  loan_officer     : { emoji:'🏦', label:'Loan Officer',       color:'#38bdf8'        },
  monitoring_officer:{ emoji:'🔍', label:'Monitoring Officer', color:'#fb923c'        },
  auditor          : { emoji:'🔎', label:'Auditor',            color:'#e879f9'        },
  customer_service : { emoji:'🎧', label:'Customer Service',   color:'#4ade80'        },
  agent            : { emoji:'🚶', label:'Agent',              color:'var(--muted)'   },
};

function getRoleMeta(role) {
  return ROLE_META[role] || { emoji:'👤', label: role || 'User', color:'var(--muted)' };
}

function showUsersTab(tab, btn) {
  document.querySelectorAll('.usr-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('usr-panel-' + tab);
  if (panel) panel.classList.remove('hidden');
  if (btn) {
    document.querySelectorAll('#users-subtabs .sub-tab')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const renderers = {
    overview : renderUsersOverview,
    all      : renderUsersTable,
    activity : renderActivityLog,
  };
  if (renderers[tab]) renderers[tab]();
}

// ─────────────────────────────────────────
//  OVERVIEW
// ─────────────────────────────────────────
function renderUsersOverview() {
  const el = document.getElementById('usr-overview-content');
  if (!el) return;

  const total   = USERS.length;
  const active  = USERS.filter(u => u.status === 'active').length;
  const roleOrder = [
    'admin','manager','accountant','accounting_clerk',
    'teller','loan_officer','monitoring_officer',
    'auditor','customer_service','agent'
  ];

  // Count per role
  const roleCounts = {};
  USERS.forEach(u => {
    roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
  });

  // Recently active users (last login within 7 days)
  const now = Date.now();
  const recentUsers = USERS
    .filter(u => u.lastLogin && (now - new Date(u.lastLogin)) < 7 * 86400000)
    .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
    .slice(0, 5);

  el.innerHTML = `
    <!-- Summary strip -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
      gap:10px;margin-bottom:20px">
      <div class="metric-card">
        <div class="metric-sub text-muted">TOTAL USERS</div>
        <div class="metric-val">${total}</div>
        <div class="metric-sub">${active} active</div>
      </div>
      <div class="metric-card">
        <div class="metric-sub text-muted">ACTIVE</div>
        <div class="metric-val text-success">${active}</div>
      </div>
      <div class="metric-card">
        <div class="metric-sub text-muted">INACTIVE</div>
        <div class="metric-val text-danger">${total - active}</div>
      </div>
      <div class="metric-card">
        <div class="metric-sub text-muted">ROLES IN USE</div>
        <div class="metric-val">${Object.keys(roleCounts).length}</div>
      </div>
    </div>

    <!-- Role breakdown -->
    <div class="card" style="margin-bottom:18px">
      <div class="card-title" style="margin-bottom:14px">
        <span>🎭</span> Users by Role
      </div>
      <div class="role-badge-wrap">
        ${roleOrder.map(role => {
          const meta  = getRoleMeta(role);
          const count = roleCounts[role] || 0;
          const usersInRole = USERS.filter(u => u.role === role);
          return `
            <div class="role-stat-card"
              style="border-left:3px solid ${meta.color};
                     opacity:${count ? 1 : 0.45}">
              <div class="role-stat-icon">${meta.emoji}</div>
              <div>
                <div class="role-stat-name">${meta.label}</div>
                <div class="role-stat-count">${count}</div>
                <div class="role-stat-sub">
                  ${usersInRole.filter(u => u.status === 'active').length} active
                  ${count > 0
                    ? '· ' + usersInRole.map(u => u.name.split(' ')[0]).join(', ')
                    : ''}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Recently active -->
    <div class="card">
      <div class="card-title" style="margin-bottom:12px">
        <span>🕐</span> Recently Active Users
      </div>
      ${recentUsers.length
        ? recentUsers.map(u => {
            const meta = getRoleMeta(u.role);
            return `
              <div style="display:flex;align-items:center;gap:12px;
                padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="width:38px;height:38px;border-radius:50%;
                  background:var(--surface2);border:2px solid ${meta.color};
                  display:flex;align-items:center;justify-content:center;
                  font-size:1.1rem;flex-shrink:0">
                  ${meta.emoji}
                </div>
                <div style="flex:1">
                  <div class="fw-600" style="font-size:.85rem">${u.name}</div>
                  <div style="font-size:.74rem;color:var(--muted)">
                    @${u.username} · ${meta.label}
                  </div>
                </div>
                <div style="text-align:right;font-size:.74rem;color:var(--muted)">
                  ${u.lastLogin ? fmtDateTime(u.lastLogin) : 'Never'}
                </div>
              </div>`;
          }).join('')
        : `<div class="empty-state" style="padding:20px 0">
             <div class="ei">🕐</div>
             <div class="et">No recent logins in the last 7 days</div>
           </div>`}
    </div>`;
}

// ─────────────────────────────────────────
//  ADD USER
// ─────────────────────────────────────────
function addUser() {
  const name     = document.getElementById('ui-name')?.value.trim();
  const username = document.getElementById('ui-username')?.value.trim();
  const pass     = document.getElementById('ui-pass')?.value;
  const pass2    = document.getElementById('ui-pass2')?.value;
  const role     = document.getElementById('ui-role')?.value;
  const phone    = document.getElementById('ui-phone')?.value.trim();
  const email    = document.getElementById('ui-email')?.value.trim();

  if (!name || !username || !pass || !role)
    return toast('Fill in all required fields', 'error');
  if (pass !== pass2)
    return toast('Passwords do not match', 'error');
  if (SETTINGS.strongPass &&
      (pass.length < 8 || !/\d/.test(pass) || !/[a-zA-Z]/.test(pass)))
    return toast('Password must be at least 8 chars with letters and numbers', 'error');
  if (USERS.find(u => u.username === username))
    return toast('Username already exists', 'error');

  const meta = getRoleMeta(role);
  const user = {
    id          : uid(),
    name, username, password: pass, role,
    phone, email,
    status      : 'active',
    lastLogin   : '',
    dateCreated : todayISO()
  };
  USERS.push(user);
  ['ui-name','ui-username','ui-pass','ui-pass2','ui-phone','ui-email'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const roleEl = document.getElementById('ui-role');
  if (roleEl) roleEl.value = '';

  logActivity('User', `Created user: ${username} (${meta.label})`, 0, 'created');
  saveAll();
  toast(`${meta.emoji} User "${username}" created as ${meta.label}`, 'success');
}

// ─────────────────────────────────────────
//  ALL USERS
// ─────────────────────────────────────────
function renderUsersTable() {
  const el = document.getElementById('usr-all-content');
  if (!el) return;

  el.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;
        align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div class="card-title" style="margin-bottom:0">
          <span>👥</span> All Users
          <span class="badge b-gold" style="margin-left:8px">${USERS.length}</span>
        </div>
        <button class="btn btn-gold btn-sm"
          onclick="showUsersTab('add',
            document.querySelectorAll('#users-subtabs .sub-tab')[1])">
          ➕ Add User
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Last Login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${USERS.map((u, i) => {
              const meta = getRoleMeta(u.role);
              return `<tr>
                <td class="text-muted">${i + 1}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:1.1rem">${meta.emoji}</span>
                    <span class="fw-600">${u.name}</span>
                  </div>
                </td>
                <td class="mono" style="font-size:.78rem">@${u.username}</td>
                <td>
                  <span style="padding:3px 9px;border-radius:20px;font-size:.73rem;
                    font-weight:600;background:var(--surface2);
                    border:1px solid var(--border);color:${meta.color}">
                    ${meta.label}
                  </span>
                </td>
                <td style="font-size:.8rem">${u.phone || '—'}</td>
                <td style="font-size:.74rem;color:var(--muted)">
                  ${u.lastLogin ? fmtDateTime(u.lastLogin) : 'Never'}
                </td>
                <td>
                  <span class="badge ${u.status === 'active' ? 'b-green' : 'b-red'}">
                    ${u.status}
                  </span>
                </td>
                <td style="white-space:nowrap">
                  ${u.username !== 'admin'
                    ? `<button class="btn btn-outline btn-xs"
                         onclick="toggleUserStatus('${u.id}')">
                         ${u.status === 'active' ? '⏸ Disable' : '▶ Enable'}
                       </button>
                       <button class="btn btn-danger btn-xs"
                         onclick="deleteUser('${u.id}')">🗑</button>`
                    : `<span class="badge b-gold" style="font-size:.65rem">
                         🔒 Protected
                       </span>`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function toggleUserStatus(id) {
  const u = USERS.find(x => x.id === id); if (!u) return;
  u.status = u.status === 'active' ? 'inactive' : 'active';
  logActivity('User',
    `${u.status === 'active' ? 'Enabled' : 'Disabled'} user: ${u.username}`, 0, u.status);
  renderUsersTable();
  saveAll();
  toast(`User ${u.status === 'active' ? 'enabled ✅' : 'disabled ⏸'}`, 'info');
}

function deleteUser(id) {
  const u = USERS.find(x => x.id === id); if (!u) return;
  showConfirm(
    'Delete User?',
    `Permanently delete user "${u.name}" (@${u.username})? This cannot be undone.`,
    () => {
      USERS = USERS.filter(x => x.id !== id);
      logActivity('User', `Deleted user: ${u.username}`, 0, 'deleted');
      renderUsersTable();
      renderUsersOverview();
      saveAll();
      toast('User deleted', 'warning');
    });
}

// ─────────────────────────────────────────
//  ACTIVITY LOG
// ─────────────────────────────────────────
function renderActivityLog() {
  const el = document.getElementById('usr-activity-content');
  if (!el) return;

  // User options
  const userOptions = [
    '<option value="all">All Users</option>',
    ...USERS.map(u => `<option value="${u.username}">${u.name} (@${u.username})</option>`)
  ].join('');

  // Role options
  const roleOptions = [
    '<option value="all_roles">All Roles</option>',
    ...Object.entries(ROLE_META).map(([val, m]) =>
      `<option value="${val}">${m.emoji} ${m.label}</option>`)
  ].join('');

  // Action options
  const actionOptions = `
    <option value="all">All Actions</option>
    <option value="Login">Login</option>
    <option value="Logout">Logout</option>
    <option value="Customer">Customer</option>
    <option value="Deposit">Deposit</option>
    <option value="Withdrawal">Withdrawal</option>
    <option value="Withdrawal Request">Withdrawal Request</option>
    <option value="Collection">Collection</option>
    <option value="Entry">Entry</option>
    <option value="Loan">Loan</option>
    <option value="Loan Payment">Loan Payment</option>
    <option value="Transfer">Transfer</option>
    <option value="Investment">Investment</option>
    <option value="Company Investment">Company Investment</option>
    <option value="Card Replacement">Card Replacement</option>
    <option value="Accounting">Accounting</option>
    <option value="Collaboration">Collaboration</option>
    <option value="SMS">SMS</option>
    <option value="User">User</option>
    <option value="Settings">Settings</option>`;

  el.innerHTML = `
    <!-- Filters -->
    <div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">From Date</label>
          <input type="date" class="form-control" id="alog-from"
            style="min-width:140px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">To Date</label>
          <input type="date" class="form-control" id="alog-to"
            style="min-width:140px">
        </div>
        <div class="form-group" style="margin-bottom:0;min-width:170px">
          <label class="form-label">User</label>
          <select class="form-control" id="alog-user">${userOptions}</select>
        </div>
        <div class="form-group" style="margin-bottom:0;min-width:170px">
          <label class="form-label">Role</label>
          <select class="form-control" id="alog-role">${roleOptions}</select>
        </div>
        <div class="form-group" style="margin-bottom:0;min-width:170px">
          <label class="form-label">Action Type</label>
          <select class="form-control" id="alog-action">${actionOptions}</select>
        </div>
        <div style="display:flex;gap:7px;padding-bottom:1px">
          <button class="btn btn-gold btn-sm"
            onclick="applyActivityFilter()">🔍 Filter</button>
          <button class="btn btn-outline btn-sm"
            onclick="clearActivityFilter()">✕ Clear</button>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div id="alog-results"></div>`;

  // Set default date range — last 30 days
  const today = todayISO();
  const d30   = new Date(); d30.setDate(d30.getDate() - 30);
  const from30 = d30.toISOString().slice(0, 10);
  const fromEl = document.getElementById('alog-from');
  const toEl   = document.getElementById('alog-to');
  if (fromEl) fromEl.value = from30;
  if (toEl)   toEl.value   = today;

  applyActivityFilter();
}

function applyActivityFilter() {
  const fromVal   = document.getElementById('alog-from')?.value;
  const toVal     = document.getElementById('alog-to')?.value;
  const userVal   = document.getElementById('alog-user')?.value  || 'all';
  const roleVal   = document.getElementById('alog-role')?.value  || 'all_roles';
  const actionVal = document.getElementById('alog-action')?.value|| 'all';

  let logs = [...(ACTIVITY_LOG || [])].reverse();

  if (fromVal)
    logs = logs.filter(l => (l.date || l.time || '').slice(0, 10) >= fromVal);
  if (toVal)
    logs = logs.filter(l => (l.date || l.time || '').slice(0, 10) <= toVal);
  if (userVal !== 'all')
    logs = logs.filter(l => (l.by || '').toLowerCase()
      .includes(userVal.toLowerCase()));
  if (roleVal !== 'all_roles') {
    // Match by role of the user
    const meta  = getRoleMeta(roleVal);
    const usersInRole = USERS.filter(u => u.role === roleVal)
      .map(u => u.name.toLowerCase());
    logs = logs.filter(l =>
      usersInRole.some(n => (l.by || '').toLowerCase().includes(n))
    );
  }
  if (actionVal !== 'all')
    logs = logs.filter(l => (l.type || '').toLowerCase()
      .includes(actionVal.toLowerCase()));

  const el = document.getElementById('alog-results');
  if (!el) return;

  if (!logs.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:40px 0">
        <div class="ei">📋</div>
        <div class="et">No activity matches your filters</div>
        <div class="es">Try a different date range or clear the filters</div>
      </div>`;
    return;
  }

  // Action → colour map
  const actionColors = {
    login      : '#4ade80', logout     : '#94a3b8',
    customer   : '#38bdf8', deposit    : '#4ade80',
    withdrawal : '#f87171', collection : '#fbbf24',
    entry      : '#a78bfa', loan       : '#38bdf8',
    transfer   : '#fb923c', investment : '#c9a84c',
    user       : '#e879f9', settings   : '#94a3b8',
    sms        : '#4ade80', accounting : '#fbbf24',
    card       : '#fb923c', default    : '#94a3b8'
  };

  function dotColor(type) {
    const t = (type || '').toLowerCase();
    for (const [key, color] of Object.entries(actionColors)) {
      if (t.includes(key)) return color;
    }
    return actionColors.default;
  }

  // Summary bar
  const summaryMap = {};
  logs.forEach(l => {
    const k = l.type || 'Other';
    summaryMap[k] = (summaryMap[k] || 0) + 1;
  });
  const topTypes = Object.entries(summaryMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6);

  el.innerHTML = `
    <!-- Summary chips -->
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;
      align-items:center">
      <span class="text-muted" style="font-size:.76rem">
        ${logs.length} entries:
      </span>
      ${topTypes.map(([type, count]) =>
        `<span style="padding:3px 10px;border-radius:20px;font-size:.72rem;
           font-weight:600;background:var(--surface2);border:1px solid var(--border);
           color:${dotColor(type)}">
           ${type} (${count})
         </span>`).join('')}
    </div>

    <!-- Log list -->
    <div class="card" style="overflow:hidden;padding:0">
      <div style="max-height:560px;overflow-y:auto">
        ${logs.map(l => {
          const color  = dotColor(l.type);
          const amount = l.amount > 0
            ? `<span class="mono" style="font-size:.75rem;color:${color};
                 margin-left:6px">${fmt(l.amount)}</span>` : '';
          const statusBadge = l.status
            ? `<span style="padding:1px 7px;border-radius:10px;font-size:.65rem;
                 background:var(--surface2);border:1px solid var(--border);
                 margin-left:6px;color:var(--muted)">${l.status}</span>` : '';
          return `
            <div class="activity-row">
              <div class="activity-dot" style="background:${color}"></div>
              <div class="activity-time">
                ${l.time ? fmtDateTime(l.time) : (l.date || '—')}
              </div>
              <div style="flex:1">
                <span style="font-weight:600;color:${color};font-size:.79rem">
                  ${l.type || 'Action'}
                </span>
                <span style="margin-left:6px;color:var(--text2)">${l.desc || ''}</span>
                ${amount}${statusBadge}
              </div>
              <div style="font-size:.73rem;color:var(--muted);
                white-space:nowrap;padding-left:8px">
                ${l.by || '—'}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function clearActivityFilter() {
  const today = todayISO();
  const d30   = new Date(); d30.setDate(d30.getDate() - 30);
  const from30 = d30.toISOString().slice(0, 10);
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  setVal('alog-from',   from30);
  setVal('alog-to',     today);
  setVal('alog-user',   'all');
  setVal('alog-role',   'all_roles');
  setVal('alog-action', 'all');
  applyActivityFilter();
}

// ── Open Salary Withdrawal Modal ──────────────────────
// Called from agent modal and user detail view
function openSalaryWithdrawal(personId, personType) {
  const name    = getPersonName(personId, personType);
  const balance = getSalaryBalance(personId, personType);

  document.getElementById('m-sal-wd-title').textContent =
    `💸 Salary Withdrawal — ${name}`;

  document.getElementById('m-sal-wd-body').innerHTML = `
    <div style="padding:12px 14px;background:var(--gold-dim);border:1px solid rgba(201,168,76,.2);
      border-radius:var(--radius-sm);margin-bottom:16px;display:flex;
      justify-content:space-between;align-items:center">
      <div>
        <div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">
          Salary Wallet Balance
        </div>
        <div class="fw-600" style="font-size:.84rem;margin-top:2px">${name}</div>
      </div>
      <div class="mono text-gold fw-600" style="font-size:1.2rem">${fmt(balance)}</div>
    </div>

    ${balance <= 0
      ? `<div class="alert alert-warning">
           No salary has been paid into this wallet yet.
           Generate and pay out payroll first.
         </div>
         <div style="text-align:right;margin-top:14px">
           <button class="btn btn-outline" onclick="closeModal('modal-salary-withdraw')">Close</button>
         </div>`
      : `<div class="form-group">
           <label class="form-label">Withdrawal Amount (GH₵)</label>
           <input type="number" class="form-control" id="sal-wd-amount"
             placeholder="0.00" min="0.01" step="0.01" max="${balance}"
             value="${balance.toFixed(2)}">
           <div class="input-hint">Maximum: ${fmt(balance)}</div>
         </div>
         <div class="form-group">
           <label class="form-label">Payment Method</label>
           <select class="form-control" id="sal-wd-method">
             <option value="cash">💵 Cash</option>
             <option value="momo">📱 Mobile Money (MoMo)</option>
             <option value="bank">🏦 Bank Transfer</option>
             <option value="cheque">📝 Cheque</option>
           </select>
         </div>
         <div class="form-group">
           <label class="form-label">Notes
             <span class="text-muted" style="font-size:.68rem;text-transform:none;letter-spacing:0">(Optional)</span>
           </label>
           <input type="text" class="form-control" id="sal-wd-notes"
             placeholder="e.g. March salary payment">
         </div>
         <div style="display:flex;gap:9px;justify-content:flex-end;
           padding-top:14px;border-top:1px solid var(--border)">
           <button class="btn btn-outline" onclick="closeModal('modal-salary-withdraw')">Cancel</button>
           <button class="btn btn-gold" onclick="confirmSalaryWithdrawal('${personId}','${personType}')">
             💸 Withdraw Salary
           </button>
         </div>`}`;

  openModal('modal-salary-withdraw');
}

// ── Process Salary Withdrawal ─────────────────────────
function confirmSalaryWithdrawal(personId, personType) {
  const amount  = parseFloat(document.getElementById('sal-wd-amount')?.value) || 0;
  const method  = document.getElementById('sal-wd-method')?.value || 'cash';
  const notes   = document.getElementById('sal-wd-notes')?.value.trim() || '';
  const balance = getSalaryBalance(personId, personType);
  const name    = getPersonName(personId, personType);

  if (!amount || amount <= 0)    return toast('Enter a valid amount', 'error');
  if (amount > balance)          return toast(`Amount exceeds wallet balance of ${fmt(balance)}`, 'error');

  const record = {
    id: uid(), type: 'withdrawal',
    amount, method, notes,
    processedAt: new Date().toISOString(),
    processedBy: currentUser?.name || 'Admin'
  };

  if (personType === 'agent') {
    const a = AGENTS.find(x => x.id === personId); if (!a) return;
    a.salaryBalance = Math.round(((a.salaryBalance || 0) - amount) * 100) / 100;
    if (!a.salaryWithdrawals) a.salaryWithdrawals = [];
    a.salaryWithdrawals.unshift(record);
  } else {
    const u = USERS.find(x => x.id === personId); if (!u) return;
    u.salaryBalance = Math.round(((u.salaryBalance || 0) - amount) * 100) / 100;
    if (!u.salaryWithdrawals) u.salaryWithdrawals = [];
    u.salaryWithdrawals.unshift(record);
  }

  logActivity('Payroll',
    `${name} withdrew salary of ${fmt(amount)} via ${method}`,
    amount, 'withdrawn');
  saveAll();
  closeModal('modal-salary-withdraw');
  toast(`${fmt(amount)} salary withdrawal processed for ${name} ✅`, 'success');

  // Refresh payroll table if visible
  const month = document.getElementById('pay-month-sel')?.value;
  if (month) {
    const run = PAYROLL.find(p => p.month === month);
    if (run) renderPayrollTable(run);
  }
}

// ── Salary Wallet Widget HTML ─────────────────────────
// Returns an HTML string ready to embed in any modal body
// (agent modal, user detail, etc.)
function buildSalaryWidget(personId, personType) {
  const balance      = getSalaryBalance(personId, personType);
  const name         = getPersonName(personId, personType);
  const isAgent      = personType === 'agent';
  const person       = isAgent
    ? AGENTS.find(x => x.id === personId)
    : USERS.find(x => x.id === personId);
  const withdrawals  = (person?.salaryWithdrawals || []).slice(0, 5);
  const history      = (person?.salaryHistory || []).slice(0, 5);

  return `
    <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
      <div class="card-title" style="margin-bottom:12px"><span>💵</span> Salary Wallet</div>

      <!-- Balance card -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:14px 16px;background:var(--gold-dim);border:1px solid rgba(201,168,76,.2);
        border-radius:var(--radius);margin-bottom:12px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">
            Available Balance
          </div>
          <div class="mono text-gold fw-600" style="font-size:1.4rem;margin-top:2px">
            ${fmt(balance)}
          </div>
        </div>
        <button class="btn btn-gold btn-sm"
          onclick="closeModal('modal-agent');closeModal('modal-user-detail');
                   openSalaryWithdrawal('${personId}','${personType}')">
          💸 Withdraw Salary
        </button>
      </div>

      <!-- Last payouts -->
      ${history.length ? `
        <div style="font-size:.74rem;color:var(--muted);margin-bottom:6px;
          text-transform:uppercase;letter-spacing:1px">Recent Pay-ins</div>
        ${history.map(h => `
          <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border);
            font-size:.8rem">
            <div>
              <span class="fw-600">${h.monthLabel}</span>
              <span class="text-muted" style="margin-left:8px;font-size:.72rem">
                ${fmtDate(h.paidAt)}
              </span>
            </div>
            <span class="mono text-success">+ ${fmt(h.amount)}</span>
          </div>`).join('')}` : ''}

      <!-- Last withdrawals -->
      ${withdrawals.length ? `
        <div style="font-size:.74rem;color:var(--muted);margin-bottom:6px;margin-top:10px;
          text-transform:uppercase;letter-spacing:1px">Recent Withdrawals</div>
        ${withdrawals.map(w => `
          <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--border);
            font-size:.8rem">
            <div>
              <span class="fw-600">${w.method}</span>
              ${w.notes ? `<span class="text-muted" style="margin-left:6px;font-size:.72rem">${w.notes}</span>` : ''}
              <div class="text-muted" style="font-size:.72rem">${fmtDate(w.processedAt)}</div>
            </div>
            <span class="mono text-danger">− ${fmt(w.amount)}</span>
          </div>`).join('')}` : ''}

      ${!history.length && !withdrawals.length
        ? `<div class="text-muted" style="font-size:.8rem;padding:8px 0">
             No salary history yet. Generate and pay out payroll first.
           </div>` : ''}
    </div>`;
}
