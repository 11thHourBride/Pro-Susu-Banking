// ═══════════════════════════════════════════════════════
//  SALARY WALLET PATCH  (salary-wallet.js)
//  Injects salary balance, history and withdraw button
//  into agent modal and user overview without touching
//  agents.js or users.js.
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Wait for agents.js and users.js to finish evaluating
  setTimeout(wireSalaryWallet, 1000);
});

function wireSalaryWallet() {

  // ── 1. Agent modal ──────────────────────────────────
  // Wrap openAgentModal ONCE. On each call, clear any stale
  // wallet then inject a fresh one after the body renders.
  const origOpenAgent = window.openAgentModal;
  if (typeof origOpenAgent === 'function') {
    window.openAgentModal = function(agentId) {
      // Remove stale widget from a previous open
      const stale = document.getElementById('agent-salary-wallet');
      if (stale) stale.remove();

      origOpenAgent.call(this, agentId);

      setTimeout(() => {
        const body = document.getElementById('m-agent-body');
        if (!body) return;
        if (document.getElementById('agent-salary-wallet')) return; // safety guard
        const div = document.createElement('div');
        div.id = 'agent-salary-wallet';
        div.innerHTML = buildSalaryWidget(agentId, 'agent');
        body.appendChild(div);
      }, 80);
    };
  }

  // ── 2. Agent cards (list view) ──────────────────────
  const origRenderList = window.renderAgentList;
  if (typeof origRenderList === 'function') {
    window.renderAgentList = function(search) {
      origRenderList.call(this, search);
      setTimeout(injectAgentCardStrips, 120);
    };
  }

  // ── 3. User overview ────────────────────────────────
  const origShowUsersTab = window.showUsersTab;
  window.showUsersTab = function(tab, btn) {
    // Panel switching (mirrors the original)
    document.querySelectorAll('.usr-panel').forEach(p => p.classList.add('hidden'));
    if (btn) {
      document.querySelectorAll('#users-subtabs .sub-tab')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    const panel = document.getElementById('usr-panel-' + tab);
    if (panel) panel.classList.remove('hidden');

    if (tab === 'overview') {
      renderUsersWithWallet();
    } else if (typeof origShowUsersTab === 'function') {
      try { origShowUsersTab.call(this, tab, btn); } catch (e) { /* no-op */ }
    }
  };
}

// ── Agent card salary strip ───────────────────────────
function injectAgentCardStrips() {
  const container = document.getElementById('agent-cards');
  if (!container) return;
  Array.from(container.children).forEach((card, idx) => {
    if (card.querySelector('.ag-sal-strip')) return;
    const agent = AGENTS[idx];
    if (!agent) return;
    const balance = agent.salaryBalance || 0;
    const strip = document.createElement('div');
    strip.className = 'ag-sal-strip';
    strip.style.cssText = 'margin-top:10px;padding:9px 12px;' +
      (balance > 0 ? 'background:var(--gold-dim);border:1px solid rgba(201,168,76,.2);' :
                     'background:var(--surface2);border:1px solid var(--border);') +
      'border-radius:8px;display:flex;justify-content:space-between;align-items:center';
    strip.innerHTML =
      '<div>' +
        '<div style="font-size:.67rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Salary Wallet</div>' +
        '<div class="mono ' + (balance > 0 ? 'text-gold' : 'text-muted') + ' fw-600" style="font-size:.92rem">' + fmt(balance) + '</div>' +
      '</div>' +
      '<button class="btn btn-xs ' + (balance > 0 ? 'btn-gold' : 'btn-outline') + '" ' +
        'onclick="event.stopPropagation();openSalaryWithdrawal(\'' + agent.id + '\',\'agent\')">' +
        '\uD83D\uDCB8 ' + (balance > 0 ? 'Withdraw' : 'Wallet') +
      '</button>';
    card.appendChild(strip);
  });
}

// ── User overview with salary wallet ─────────────────
function renderUsersWithWallet() {
  const el = document.getElementById('usr-overview-content');
  if (!el) return;

  if (!USERS.length) {
    el.innerHTML = '<div class="empty-state"><div class="ei">\uD83D\uDC64</div>' +
      '<div class="et">No users yet</div>' +
      '<div class="es">Create users from the Add User tab</div></div>';
    return;
  }

  const ROLE_LABELS = {
    admin:'Administrator', accountant:'Accountant',
    accounting_clerk:'Accounting Clerk', teller:'Teller',
    loan_officer:'Loan Officer', monitoring_officer:'Monitoring Officer',
    agent:'Agent', manager:'Manager', auditor:'Auditor',
    customer_service:'Customer Service'
  };
  const ROLE_ICONS = {
    admin:'\uD83D\uDC51', accountant:'\uD83D\uDCCA', accounting_clerk:'\u270D\uFE0F',
    teller:'\uD83D\uDCB5', loan_officer:'\uD83C\uDFE6', monitoring_officer:'\uD83D\uDD0D',
    agent:'\uD83D\uDEB6', manager:'\uD83D\uDDC2\uFE0F', auditor:'\uD83D\uDD0E',
    customer_service:'\uD83C\uDFA7'
  };

  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">';

  USERS.forEach(function(u) {
    var balance  = u.salaryBalance || 0;
    var lastPay  = (u.salaryHistory || [])[0];
    var lastLogin = u.lastLogin ? fmtDateTime(u.lastLogin) : 'Never';
    var withdrawals = (u.salaryWithdrawals || []).slice(0, 3);

    html += '<div class="card">';

    // Header
    html +=
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
        '<div style="width:46px;height:46px;border-radius:50%;' +
          'background:linear-gradient(135deg,var(--gold),#a8851c);' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:1.15rem;font-weight:700;color:#08142a;flex-shrink:0">' +
          u.name.charAt(0).toUpperCase() +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="fw-600" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            u.name +
          '</div>' +
          '<div class="text-muted" style="font-size:.74rem">' +
            (ROLE_ICONS[u.role] || '\uD83D\uDC64') + ' ' +
            (ROLE_LABELS[u.role] || u.role) + ' \u00B7 @' + u.username +
          '</div>' +
        '</div>' +
        '<span class="badge ' + (u.status === 'active' ? 'b-green' : 'b-gray') + '">' +
          u.status +
        '</span>' +
      '</div>';

    // Info grid
    html +=
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.78rem;margin-bottom:14px">' +
        '<div><div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Phone</div><div>' + (u.phone || '\u2014') + '</div></div>' +
        '<div><div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Monthly Salary</div><div>' + (u.monthlySalary ? fmt(u.monthlySalary) : 'Not set') + '</div></div>' +
        '<div><div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Last Login</div><div style="font-size:.71rem">' + lastLogin + '</div></div>' +
        '<div><div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Email</div><div style="font-size:.74rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (u.email || '\u2014') + '</div></div>' +
      '</div>';

    // Salary wallet strip
    html +=
      '<div style="padding:11px 13px;' +
        (balance > 0 ? 'background:var(--gold-dim);border:1px solid rgba(201,168,76,.25);' :
                       'background:var(--surface2);border:1px solid var(--border);') +
        'border-radius:var(--radius-sm);margin-bottom:12px">' +
        '<div class="flex-between" style="align-items:center">' +
          '<div>' +
            '<div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Salary Wallet</div>' +
            '<div class="mono fw-600 ' + (balance > 0 ? 'text-gold' : 'text-muted') + '" style="font-size:1.05rem;margin-top:2px">' +
              fmt(balance) +
            '</div>' +
            (lastPay ? '<div class="text-muted" style="font-size:.7rem;margin-top:3px">Last paid: ' + fmt(lastPay.amount) + ' \u2014 ' + lastPay.monthLabel + '</div>' : '') +
          '</div>' +
          '<button class="btn btn-sm ' + (balance > 0 ? 'btn-gold' : 'btn-outline') + '" ' +
            'onclick="openSalaryWithdrawal(\'' + u.id + '\',\'staff\')">' +
            '\uD83D\uDCB8 ' + (balance > 0 ? 'Withdraw' : 'Wallet') +
          '</button>' +
        '</div>' +
      '</div>';

    // Recent withdrawals
    if (withdrawals.length) {
      html += '<div style="margin-bottom:12px">' +
        '<div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Recent Withdrawals</div>';
      withdrawals.forEach(function(w) {
        html += '<div class="flex-between" style="padding:5px 0;border-bottom:1px solid var(--border);font-size:.77rem">' +
          '<span>' + w.method + (w.notes ? ' \u2014 ' + w.notes : '') + '</span>' +
          '<span class="mono text-danger">\u2212 ' + fmt(w.amount) + '</span>' +
          '</div>';
      });
      html += '</div>';
    }

    // Action buttons
    html +=
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn btn-outline btn-xs" onclick="editUser(\'' + u.id + '\')">✏️ Edit</button>' +
        '<button class="btn btn-outline btn-xs" onclick="toggleUserStatus(\'' + u.id + '\')">' +
          (u.status === 'active' ? '\uD83D\uDD12 Deactivate' : '\u2705 Activate') +
        '</button>' +
        (u.role !== 'admin' ? '<button class="btn btn-danger btn-xs" onclick="deleteUser(\'' + u.id + '\')">\uD83D\uDDD1</button>' : '') +
      '</div>';

    html += '</div>'; // .card
  });

  html += '</div>';
  el.innerHTML = html;
}