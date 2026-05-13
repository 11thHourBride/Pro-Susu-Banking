// ═══════════════════════════════════════════════════════
//  TELLER
// ═══════════════════════════════════════════════════════

// Ensure floatRequests exists on TELLER_STATE
if (!TELLER_STATE.floatRequests) TELLER_STATE.floatRequests = [];

function updateTellerStats() {
  const ts  = TELLER_STATE;
  const coll = ts.collections.reduce((s, c) => s + c.amount, 0);
  const wd   = ts.withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0);
  const exp  = ts.expenses.reduce((s, e) => s + e.amount, 0);
  const cash = Math.max(0, ts.startOfDay + coll - wd - exp);
  const pend = ts.withdrawals.filter(w => w.status === 'pending');
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('t-sod',    fmt(ts.startOfDay));
  setTxt('t-sod-s',  ts.startOfDayTime ? 'Received at ' + fmtTime(ts.startOfDayTime) : 'Not received');
  setTxt('t-cash',   fmt(cash));
  setTxt('t-coll',   ts.collections.length);
  setTxt('t-coll-s', fmt(coll) + ' total');
  setTxt('t-pend',   pend.length);
  setTxt('t-pend-s', fmt(pend.reduce((s, w) => s + w.amount, 0)) + ' total');
}

function cashAtHand() {
  const ts = TELLER_STATE;
  return Math.max(0,
    ts.startOfDay
    + ts.collections.reduce((s, c) => s + c.amount, 0)
    - ts.withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0)
    - ts.expenses.reduce((s, e) => s + e.amount, 0)
  );
}

// ══════════════════════════════════════════════════════
//  FLOAT PANEL — role-aware dispatcher
// ══════════════════════════════════════════════════════
function renderFloatPanel() {
  const el = document.getElementById('float-panel-content');
  if (!el) return;
  const isAdmin = ['admin', 'accountant'].includes(currentUser?.role);
  if (isAdmin) renderSendFloatUI(el);
  else         renderReceiveFloatUI(el);
}

// ── Admin / Accountant: Send Float ───────────────────
function renderSendFloatUI(el) {
  if (!TELLER_STATE.floatRequests) TELLER_STATE.floatRequests = [];

  const tellers = USERS.filter(u => u.role === 'teller' && u.status === 'active');

  let tellerSelectHTML;
  if (tellers.length > 1) {
    tellerSelectHTML = `
      <div class="form-group">
        <label class="form-label">Send To <span class="req">*</span></label>
        <select class="form-control" id="sf-teller">
          <option value="">-- Select Teller --</option>
          ${tellers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
      </div>`;
  } else if (tellers.length === 1) {
    tellerSelectHTML = `
      <div class="form-group">
        <label class="form-label">Sending To</label>
        <div style="padding:9px 13px;background:var(--gold-dim);border:1px solid rgba(201,168,76,.2);
          border-radius:8px;font-size:.84rem;font-weight:600;color:var(--gold-light)">
          👤 ${tellers[0].name}
        </div>
        <input type="hidden" id="sf-teller" value="${tellers[0].id}">
      </div>`;
  } else {
    tellerSelectHTML = `
      <div class="alert alert-warning" style="margin-bottom:12px">
        ⚠️ No active teller accounts found. Create a teller user first.
      </div>
      <input type="hidden" id="sf-teller" value="">`;
  }

  el.innerHTML = `
    <div class="grid-2" style="align-items:start">

      <!-- Send Float Form -->
      <div class="card">
        <div class="card-title"><span>📤</span> Send Float to Teller</div>

        <div style="padding:10px 14px;background:rgba(74,144,217,.08);border:1px solid rgba(74,144,217,.18);
          border-radius:var(--radius-sm);margin-bottom:14px;font-size:.8rem">
          <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">From (Sender)</div>
          <div class="fw-600" style="color:var(--info)">${currentUser?.name || 'Administrator'}</div>
          <div class="text-muted" style="font-size:.72rem">${currentUser?.role || 'admin'}</div>
        </div>

        ${tellerSelectHTML}

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Float Amount (GH₵) <span class="req">*</span></label>
            <input type="number" class="form-control" id="sf-amount" placeholder="0.00" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">Float Date <span class="req">*</span></label>
            <input type="date" class="form-control" id="sf-date" value="${todayISO()}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes
            <span class="text-muted" style="font-size:.68rem;text-transform:none;letter-spacing:0">(Optional)</span>
          </label>
          <input type="text" class="form-control" id="sf-notes" placeholder="Any additional instructions...">
        </div>

        ${tellers.length > 0
          ? `<button class="btn btn-gold" onclick="sendFloat()">📤 Send Float</button>`
          : `<button class="btn btn-gold" disabled style="opacity:.5">📤 Send Float</button>`}
      </div>

      <!-- Sent Float History -->
      <div class="card">
        <div class="card-title"><span>📋</span> Float History</div>
        ${renderSentFloatHistoryHTML()}
      </div>
    </div>`;
}

function renderSentFloatHistoryHTML() {
  const requests = (TELLER_STATE.floatRequests || []);
  if (!requests.length) {
    return `<div class="empty-state" style="padding:24px 0">
      <div class="ei">📋</div>
      <div class="et">No floats sent yet</div>
    </div>`;
  }
  return `<div class="table-wrap" style="max-height:300px;overflow-y:auto">
    <table>
      <thead>
        <tr>
          <th>Date</th><th>To</th><th>Amount</th><th>Sent By</th><th>Status</th><th>Confirmed</th>
        </tr>
      </thead>
      <tbody>
        ${[...requests].reverse().map(r => `<tr>
          <td style="font-size:.76rem;white-space:nowrap">${fmtDate(r.date)}</td>
          <td style="font-size:.82rem">${r.tellerName || '—'}</td>
          <td class="mono text-gold">${fmt(r.amount)}</td>
          <td style="font-size:.76rem;color:var(--muted)">${r.sentBy}</td>
          <td><span class="badge ${r.status === 'confirmed' ? 'b-green' : 'b-yellow'}">
            ${r.status}
          </span></td>
          <td style="font-size:.72rem;color:var(--muted)">
            ${r.confirmedAt ? fmtDateTime(r.confirmedAt) : '—'}
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function sendFloat() {
  if (!TELLER_STATE.floatRequests) TELLER_STATE.floatRequests = [];

  const tellerId = document.getElementById('sf-teller')?.value;
  const amount   = parseFloat(document.getElementById('sf-amount')?.value) || 0;
  const date     = document.getElementById('sf-date')?.value || todayISO();
  const notes    = document.getElementById('sf-notes')?.value.trim() || '';

  if (!tellerId) return toast('Select a teller to send to', 'error');
  if (!amount || amount <= 0) return toast('Enter a valid float amount', 'error');
  if (!date)    return toast('Select a float date', 'error');

  const teller = USERS.find(u => u.id === tellerId);
  if (!teller)  return toast('Teller not found', 'error');

  // Prevent duplicate pending float for same teller and date
  const existing = TELLER_STATE.floatRequests.find(
    r => r.tellerId === tellerId && r.date === date && r.status === 'pending'
  );
  if (existing) {
    return toast(`A pending float already exists for ${teller.name} on ${fmtDate(date)}`, 'warning');
  }

  const req = {
    id         : uid(),
    amount,
    date,
    notes,
    sentBy     : currentUser?.name || 'Admin',
    sentById   : currentUser?.id   || '',
    sentByRole : currentUser?.role || 'admin',
    tellerId   : teller.id,
    tellerName : teller.name,
    status     : 'pending',
    sentAt     : new Date().toISOString(),
    confirmedAt: null,
    confirmedBy: null
  };

  TELLER_STATE.floatRequests.push(req);
  logActivity('Float', `${fmt(amount)} float sent to ${teller.name}`, amount, 'pending');
  saveAll();
  renderFloatPanel();
  if (typeof updateDashboard === 'function') updateDashboard();
  toast(`${fmt(amount)} float sent to ${teller.name} for ${fmtDate(date)} ✅`, 'success');
}

// ── Teller: Confirm Float Receipt ────────────────────
function renderReceiveFloatUI(el) {
  if (!TELLER_STATE.floatRequests) TELLER_STATE.floatRequests = [];

  const myPending = TELLER_STATE.floatRequests.filter(r =>
    r.status === 'pending' &&
    (r.tellerId === currentUser?.id || !r.tellerId)
  );

  // Float is "already received for today" only if confirmed today AND no new pending floats
  const confirmedToday = TELLER_STATE.startOfDayDate === todayISO() && TELLER_STATE.startOfDay > 0;
  const alreadyReceived = confirmedToday && myPending.length === 0;

  if (alreadyReceived) {
    el.innerHTML = `
      <div class="grid-2" style="align-items:start">
        <div class="card">
          <div class="card-title"><span>✅</span> Float Confirmed</div>
          <div class="alert alert-info">Today's float has been confirmed.</div>
          <div style="display:flex;flex-direction:column;gap:9px;margin-top:12px;font-size:.84rem">
            <div class="flex-between">
              <span class="text-muted">Sent By</span>
              <span class="fw-600 text-gold">${TELLER_STATE.startOfDaySource || '—'}</span>
            </div>
            <div class="flex-between">
              <span class="text-muted">Float Balance</span>
              <span class="mono text-gold fw-600" style="font-size:1.05rem">${fmt(TELLER_STATE.startOfDay)}</span>
            </div>
            <div class="flex-between">
              <span class="text-muted">Confirmed At</span>
              <span style="font-size:.78rem">${fmtDateTime(TELLER_STATE.startOfDayTime)}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span>💰</span> Cash at Hand Summary</div>
          <div id="float-summary-display">${buildCashSummaryHTML()}</div>
        </div>
      </div>`;
    return;
  }

  // confirmedToday but has NEW pending top-up float(s) — show them
  if (confirmedToday && myPending.length > 0) {
    el.innerHTML = `
      <div class="grid-2" style="align-items:start">
        <div class="card">
          <div class="card-title"><span>⬆️</span> Float Top-Up Waiting</div>
          <div class="alert alert-warning" style="margin-bottom:12px">
            Admin sent an additional float. Confirm to top up your balance.
          </div>
          <div style="display:flex;flex-direction:column;gap:9px;font-size:.84rem;margin-bottom:14px">
            <div class="flex-between">
              <span class="text-muted">Current Float Balance</span>
              <span class="mono text-gold fw-600">${fmt(TELLER_STATE.startOfDay)}</span>
            </div>
          </div>
          ${myPending.map(r => `
            <div style="padding:12px;background:var(--surface2);border:1px solid rgba(201,168,76,.3);
              border-radius:var(--radius);margin-bottom:10px">
              <div class="flex-between mb-2">
                <div>
                  <div class="fw-600">${fmt(r.amount)} <span class="text-muted" style="font-size:.78rem">top-up</span></div>
                  <div class="text-muted" style="font-size:.74rem">From ${r.sentBy} · ${fmtDate(r.date)}</div>
                  ${r.notes ? `<div class="text-muted" style="font-size:.72rem">${r.notes}</div>` : ''}
                </div>
                <div class="text-muted" style="font-size:.72rem">${fmtDateTime(r.sentAt)}</div>
              </div>
              <div style="font-size:.78rem;color:var(--gold);margin-bottom:8px">
                New balance after confirmation: <strong class="mono">${fmt(TELLER_STATE.startOfDay + r.amount)}</strong>
              </div>
              <button class="btn btn-gold btn-sm" onclick="confirmFloatReceipt('${r.id}')">
                ✅ Confirm Top-Up of ${fmt(r.amount)}
              </button>
            </div>`).join('')}
        </div>
        <div class="card">
          <div class="card-title"><span>💰</span> Cash at Hand Summary</div>
          <div id="float-summary-display">${buildCashSummaryHTML()}</div>
        </div>
      </div>`;
    return;
  }

  if (!myPending.length) {
    el.innerHTML = `
      <div class="grid-2" style="align-items:start">
        <div class="card">
          <div class="card-title"><span>⏳</span> Awaiting Float</div>
          <div class="empty-state" style="padding:44px 0">
            <div class="ei">📩</div>
            <div class="et">No Float Sent Yet</div>
            <div class="es">Waiting for admin or accountant to send today's float</div>
          </div>
        </div>
        <div class="card">
          <div class="card-title"><span>💰</span> Cash at Hand Summary</div>
          <div class="empty-state" style="padding:24px 0">
            <div class="ei">🏦</div>
            <div class="et">No Float Received</div>
            <div class="es">Confirm float to see summary</div>
          </div>
        </div>
      </div>`;
    return;
  }

  // Show pending floats for confirmation
  el.innerHTML = `
    <div class="grid-2" style="align-items:start">
      <div class="card">
        <div class="card-title"><span>📩</span> Incoming Float — Confirm Receipt</div>
        ${myPending.map(r => `
          <div style="background:var(--gold-dim);border:1px solid rgba(201,168,76,.25);
            border-radius:var(--radius);padding:16px;margin-bottom:12px">
            <div style="display:flex;flex-direction:column;gap:9px;font-size:.84rem;margin-bottom:16px">
              <div class="flex-between">
                <span class="text-muted">From</span>
                <span class="fw-600 text-gold">${r.sentBy}
                  <span class="badge b-blue" style="font-size:.6rem;margin-left:6px">${r.sentByRole || 'admin'}</span>
                </span>
              </div>
              <div class="flex-between">
                <span class="text-muted">Float Amount</span>
                <span class="mono fw-600 text-gold" style="font-size:1.15rem">${fmt(r.amount)}</span>
              </div>
              <div class="flex-between">
                <span class="text-muted">Float Date</span>
                <span class="fw-600">${fmtDate(r.date)}</span>
              </div>
              <div class="flex-between">
                <span class="text-muted">Sent At</span>
                <span style="font-size:.76rem;color:var(--muted)">${fmtDateTime(r.sentAt)}</span>
              </div>
              ${r.notes ? `
                <div class="flex-between">
                  <span class="text-muted">Notes</span>
                  <span style="font-size:.8rem">${r.notes}</span>
                </div>` : ''}
            </div>
            <button class="btn btn-gold w-full"
              onclick="confirmFloatReceipt('${r.id}')">
              ✅ Confirm Receipt of ${fmt(r.amount)}
            </button>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title"><span>💰</span> Cash at Hand Summary</div>
        <div class="empty-state" style="padding:24px 0">
          <div class="ei">🏦</div>
          <div class="et">Confirm float to see summary</div>
        </div>
      </div>
    </div>`;
}

function confirmFloatReceipt(reqId) {
  if (!TELLER_STATE.floatRequests) TELLER_STATE.floatRequests = [];
  const req = TELLER_STATE.floatRequests.find(r => r.id === reqId);
  if (!req) return toast('Float request not found', 'error');
  if (req.status === 'confirmed') return toast('This float has already been confirmed', 'warning');

  // If a float was already confirmed today, this is a top-up — ADD to existing balance
  const isTopUp = TELLER_STATE.startOfDayDate === todayISO() && TELLER_STATE.startOfDay > 0;
  TELLER_STATE.startOfDay       = (isTopUp ? TELLER_STATE.startOfDay : 0) + req.amount;
  TELLER_STATE.startOfDaySource = req.sentBy;
  TELLER_STATE.startOfDayTime   = new Date().toISOString();
  TELLER_STATE.startOfDayDate   = todayISO(); // stamp today so next check is date-aware

  req.status      = 'confirmed';
  req.confirmedAt = new Date().toISOString();
  req.confirmedBy = currentUser?.name || 'Teller';

  logActivity('Float',
    `${fmt(req.amount)} ${isTopUp ? 'top-up float' : 'float'} confirmed by ${currentUser?.name} (sent by ${req.sentBy})`,
    req.amount, 'confirmed'
  );
  saveAll();
  updateTellerStats();
  renderFloatPanel();
  if (typeof updateDashboard === 'function') updateDashboard();
  toast(
    `${fmt(req.amount)} float ${isTopUp ? 'top-up ' : ''}confirmed from ${req.sentBy} ✅` +
    (isTopUp ? ` — Float balance now: ${fmt(TELLER_STATE.startOfDay)}` : ''),
    'success'
  );
}

// ── Cash at Hand summary HTML helper ─────────────────
function buildCashSummaryHTML() {
  const ts = TELLER_STATE;
  if (!ts.startOfDay) {
    return `<div class="empty-state" style="padding:24px 0">
      <div class="ei">🏦</div><div class="et">No Float Received</div></div>`;
  }
  const coll = ts.collections.reduce((s, c) => s + c.amount, 0);
  const wd   = ts.withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0);
  const exp  = ts.expenses.reduce((s, e) => s + e.amount, 0);
  return `<div style="display:flex;flex-direction:column;gap:10px;font-size:.85rem">
    <div class="flex-between"><span class="text-muted">Start of Day</span><span class="mono text-gold">${fmt(ts.startOfDay)}</span></div>
    <div class="flex-between"><span class="text-muted">+ Collections</span><span class="mono text-success">+ ${fmt(coll)}</span></div>
    <div class="flex-between"><span class="text-muted">− Withdrawals Paid</span><span class="mono text-danger">− ${fmt(wd)}</span></div>
    <div class="flex-between"><span class="text-muted">− Expenses</span><span class="mono text-danger">− ${fmt(exp)}</span></div>
    <hr class="divider" style="margin:4px 0">
    <div class="flex-between fw-600">
      <span>Cash at Hand</span>
      <span class="mono text-gold" style="font-size:1.05rem">${fmt(cashAtHand())}</span>
    </div>
    <div style="padding:9px 12px;background:var(--gold-dim);border:1px solid var(--border);border-radius:8px;margin-top:4px">
      <div class="text-muted" style="font-size:.7rem">FROM</div>
      <div class="fw-600">${ts.startOfDaySource || '—'}</div>
      <div class="text-muted" style="font-size:.7rem;margin-top:2px">${fmtDateTime(ts.startOfDayTime)}</div>
    </div>
  </div>`;
}

function refreshFloatSummary() {
  const el = document.getElementById('float-summary-display');
  if (el) el.innerHTML = buildCashSummaryHTML();
}

// ══════════════════════════════════════════════════════
//  AGENT SELECTORS
// ══════════════════════════════════════════════════════
function populateAgentSelectors() {
  ['ci-agent','cu-agent','cu-agent-b','lni-agent'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const val = el.value;
    el.innerHTML = '<option value="">-- Select Agent --</option>'
      + AGENTS.map(a =>
          `<option value="${a.id}">${a.firstName} ${a.lastName} (${a.code})</option>`
        ).join('');
    el.value = val;
  });
}

// ══════════════════════════════════════════════════════
//  COLLECTIONS
// ══════════════════════════════════════════════════════
function postCollection() {
  if (!TELLER_STATE.startOfDay) return toast('Receive float first', 'error');
  const collDate = document.getElementById('ci-date').value;
  const agentId  = document.getElementById('ci-agent').value;
  const amt      = parseFloat(document.getElementById('ci-amount').value);
  const ref      = document.getElementById('ci-ref').value.trim();
  const notes    = document.getElementById('ci-notes').value.trim();
  if (!collDate) return toast('Select a collection date', 'error');
  if (!agentId)  return toast('Select an agent', 'error');
  if (!amt || amt <= 0) return toast('Enter valid amount', 'error');
  const agent = AGENTS.find(a => a.id === agentId);
  const coll = {
    id: uid(), agentId,
    agentName: agent ? `${agent.firstName} ${agent.lastName} (${agent.code})` : 'Unknown',
    amount: amt, ref, notes,
    collectionDate: collDate,
    time: new Date().toISOString(),
    status: 'awaiting', entryId: null
  };
  TELLER_STATE.collections.push(coll);
  ['ci-date','ci-agent','ci-amount','ci-ref','ci-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.tagName === 'SELECT' ? el.value = '' : el.value = '';
  });
  const dateEl = document.getElementById('ci-date');
  if (dateEl) dateEl.value = todayISO();
  updateTellerStats(); renderTellerCollList(); refreshFloatSummary();
  logActivity('Collection', 'Posted for ' + coll.agentName + ' [' + collDate + ']', amt, 'awaiting');
  saveAll();
  toast(fmt(amt) + ' collection posted for ' + (agent?.firstName || 'agent') + ' — ' + fmtDate(collDate), 'success');
}

function renderTellerCollList() {
  populateAgentSelectors();
  const el    = document.getElementById('t-coll-list');
  const colls = TELLER_STATE.collections;
  if (!colls.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px 0">
      <div class="ei">📭</div><div class="et">No Collections</div></div>`;
    return;
  }
  el.innerHTML = colls.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;
      margin-bottom:7px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
      <div>
        <div class="fw-600" style="font-size:.83rem">${c.agentName}</div>
        <div class="text-muted" style="font-size:.73rem">${c.ref || 'No route'} · ${fmtTime(c.time)}</div>
      </div>
      <div style="text-align:right">
        <div class="mono text-gold" style="font-size:.88rem">${fmt(c.amount)}</div>
        <span class="badge ${c.status === 'awaiting' ? 'b-yellow' : 'b-green'}">
          ${c.status === 'awaiting' ? 'Awaiting Entry' : 'Entered'}
        </span>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════
//  ACCOUNT LOOKUP
// ══════════════════════════════════════════════════════
function lookupAcct(val, fbId, nameId) {
  const fb = document.getElementById(fbId), nm = document.getElementById(nameId);
  if (!fb || !nm) return;
  const key = val.trim().toUpperCase();
  if (!key) { fb.innerHTML = ''; nm.value = ''; return; }
  const cust = CUSTOMERS.find(c => c.acctNumber === key);
  if (cust) {
    fb.innerHTML = `<div class="input-success">✅ ${cust.firstName} ${cust.lastName} · ${cust.phone || 'No phone'}</div>`;
    nm.value = `${cust.firstName} ${cust.lastName}`;
  } else {
    fb.innerHTML = `<div class="input-error">❌ Account not found</div>`;
    nm.value = '';
  }
  if (fbId === 'cri-fb') {
    const bd = document.getElementById('cri-balance-display');
    if (bd && cust) bd.innerHTML = `<div class="alert alert-info">Balance: <strong>${fmt(cust.balance || 0)}</strong>. After fee: <strong>${fmt((cust.balance || 0) - SETTINGS.cardFee)}</strong></div>`;
    else if (bd) bd.innerHTML = '';
  }
}

// ══════════════════════════════════════════════════════
//  WITHDRAWALS (legacy quick-pay, kept for internal use)
// ══════════════════════════════════════════════════════
function queueWd()  { _processWd('pending'); }
function payWdNow() { _processWd('paid'); }

function _processWd(status) {
  const acct  = document.getElementById('wi-acct')?.value.trim().toUpperCase();
  const name  = document.getElementById('wi-name')?.value.trim();
  const amt   = parseFloat(document.getElementById('wi-amount')?.value);
  const clerk = document.getElementById('wi-clerk')?.value.trim();
  const notes = document.getElementById('wi-notes')?.value.trim();
  if (!acct || !name) return toast('Verify account first', 'error');
  if (!amt || amt <= 0) return toast('Enter valid amount', 'error');
  if (!clerk) return toast('Enter clerk name', 'error');
  if (status === 'paid' && cashAtHand() < amt) return toast('Insufficient cash at hand!', 'error');
  const wd = { id: uid(), acct, name, amount: amt, clerk, notes, time: new Date().toISOString(), status };
  TELLER_STATE.withdrawals.push(wd);
  ['wi-acct','wi-name','wi-amount','wi-clerk','wi-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  if (document.getElementById('wi-fb')) document.getElementById('wi-fb').innerHTML = '';
  updateTellerStats(); renderWdTable(); refreshFloatSummary();
  logActivity('Withdrawal', name + ' (' + acct + ')', amt, status); saveAll();
  toast('Withdrawal ' + (status === 'paid' ? 'paid' : 'queued') + ' — ' + fmt(amt), 'success');
}

function payWd(id) {
  const wd = TELLER_STATE.withdrawals.find(w => w.id === id); if (!wd) return;
  if (cashAtHand() < wd.amount) return toast('Insufficient cash!', 'error');
  wd.status = 'paid'; updateTellerStats(); renderWdTable(); refreshFloatSummary(); saveAll();
  toast(fmt(wd.amount) + ' paid to ' + wd.name, 'success');
}

function initWithdrawalsPanel() {
  renderWdTab(currentWdTab || 'pending');
}

function renderWdTable() {
  renderWdTab(currentWdTab || 'pending');
  updateTellerStats();
}

// ══════════════════════════════════════════════════════
//  EXPENSES
// ══════════════════════════════════════════════════════
function recordExpense() {
  const desc  = document.getElementById('ei-desc').value.trim();
  const amt   = parseFloat(document.getElementById('ei-amount').value);
  const cat   = document.getElementById('ei-cat').value;
  const payee = document.getElementById('ei-payee').value.trim();
  if (!desc) return toast('Enter description', 'error');
  if (!amt || amt <= 0) return toast('Enter valid amount', 'error');
  if (cashAtHand() < amt) return toast('Insufficient cash at hand!', 'error');
  const exp = { id: uid(), desc, category: cat, amount: amt, payee, time: new Date().toISOString() };
  TELLER_STATE.expenses.push(exp);
  ['ei-desc','ei-amount','ei-payee'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  updateTellerStats(); renderExpensesTable(); refreshFloatSummary();
  logActivity('Expense', desc + (payee ? ' → ' + payee : ''), amt, 'recorded'); saveAll();
  toast(fmt(amt) + ' expense recorded', 'success');
}

function renderExpensesTable() {
  const tb   = document.getElementById('exp-tbody');
  const exps = TELLER_STATE.expenses;
  const total = exps.reduce((s, e) => s + e.amount, 0);
  const totEl = document.getElementById('exp-total-d');
  if (totEl) totEl.textContent = fmt(total);
  if (!exps.length) {
    tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:20px">No expenses</td></tr>';
    return;
  }
  const catIcons = { operational:'🏢', transport:'🚗', stationery:'📝', utilities:'💡', other:'📌' };
  tb.innerHTML = exps.map((e, i) =>
    `<tr>
      <td class="text-muted">${i + 1}</td>
      <td>${e.desc}${e.payee ? ` <span class="text-muted" style="font-size:.73rem">→ ${e.payee}</span>` : ''}</td>
      <td>${catIcons[e.category] || '📌'} ${e.category}</td>
      <td class="mono text-danger">${fmt(e.amount)}</td>
      <td class="text-muted" style="font-size:.76rem">${fmtTime(e.time)}</td>
    </tr>`
  ).join('');
}

// ══════════════════════════════════════════════════════
//  DENOMINATION COUNTER (Close Day)
// ══════════════════════════════════════════════════════
const DENOMS_DEF = [
  {id:'d200',v:200},{id:'d100',v:100},{id:'d50',v:50},{id:'d20',v:20},
  {id:'d10',v:10},{id:'d5',v:5},{id:'d2',v:2},{id:'d1',v:1},
  {id:'dc50',v:.5},{id:'dc20',v:.2},{id:'dc10',v:.1},{id:'dc5',v:.05}
];

function calcDenoms() {
  let total = 0;
  DENOMS_DEF.forEach(d => {
    const qty = parseFloat(document.getElementById(d.id)?.value) || 0;
    const sub = qty * d.v; total += sub;
    const t = document.getElementById(d.id + '-t');
    if (t) t.textContent = `= GH₵ ${sub.toFixed(2)}`;
  });
  const g = document.getElementById('denom-grand');
  if (g) g.textContent = fmt(total);
}

function previewClose() {
  const counted  = DENOMS_DEF.reduce((s, d) => s + (parseFloat(document.getElementById(d.id)?.value) || 0) * d.v, 0);
  const expected = cashAtHand();
  const diff     = counted - expected;
  document.getElementById('cp-exp').textContent  = fmt(expected);
  document.getElementById('cp-phys').textContent = fmt(counted);
  const de = document.getElementById('cp-diff');
  de.textContent = (diff >= 0 ? '+' : '') + fmt(diff);
  de.className   = 'mono fw-600 ' + (diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-gold');
  document.getElementById('close-preview').classList.remove('hidden');
}

function closeDay() {
  const counted  = DENOMS_DEF.reduce((s, d) => s + (parseFloat(document.getElementById(d.id)?.value) || 0) * d.v, 0);
  if (!counted) return toast('Count denominations first', 'warning');
  const expected = cashAtHand();
  const diff     = counted - expected;
  const rec = {
    date        : todayISO(),
    float       : TELLER_STATE.startOfDay,
    collections : TELLER_STATE.collections.reduce((s, c) => s + c.amount, 0),
    collCount   : TELLER_STATE.collections.length,
    withdrawals : TELLER_STATE.withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0),
    expenses    : TELLER_STATE.expenses.reduce((s, e) => s + e.amount, 0),
    cashAtClose : counted,
    expected,
    diff,
    status      : 'Closed',
    timestamp   : new Date().toISOString(),
    closedBy    : currentUser?.name || 'Teller'
  };
  TELLER_STATE.history.unshift(rec);
  TELLER_STATE.dayClosed = true;
  logActivity('Close Day',
    `Day closed by ${rec.closedBy} · diff: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`,
    counted, diff >= 0 ? 'surplus' : 'shortage'
  );
  saveAll();
  renderTellerHistory('today');
  toast('Day closed successfully ✨', 'success');

  // Auto-navigate to relevant tab
  if (diff > 0) {
    const btn = document.querySelector('#view-teller .sub-tab[onclick*="\'excess\'"]');
    if (btn) { showSubTab('t', 'excess', btn); renderExcessTab(); }
    toast(`📈 Surplus of ${fmt(diff)} — check Excess tab`, 'info', 4500);
  } else if (diff < 0) {
    const btn = document.querySelector('#view-teller .sub-tab[onclick*="\'shortage\'"]');
    if (btn) { showSubTab('t', 'shortage', btn); renderShortageTab(); }
    toast(`📉 Shortage of ${fmt(Math.abs(diff))} — check Shortage tab`, 'warning', 4500);
  }
}

// ══════════════════════════════════════════════════════
//  EXCESS TAB
// ══════════════════════════════════════════════════════
function renderExcessTab() {
  const el = document.getElementById('t-excess'); if (!el) return;
  const records     = TELLER_STATE.history.filter(r => r.diff > 0);
  const totalExcess = records.reduce((s, r) => s + r.diff, 0);

  if (!records.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title"><span>📈</span> Excess Records</div>
        <div class="empty-state" style="padding:44px 0">
          <div class="ei">📈</div>
          <div class="et">No Excess Records</div>
          <div class="es">Days where counted cash exceeds expected balance will appear here</div>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:14px 16px;background:rgba(46,204,138,.07);border:1px solid rgba(46,204,138,.18);
      border-radius:var(--radius);margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div>
        <div class="fw-600" style="color:var(--success)">📈 Total Excess — All Time</div>
        <div class="text-muted" style="font-size:.74rem;margin-top:2px">${records.length} record(s) with surplus</div>
      </div>
      <div class="mono text-success fw-600" style="font-size:1.4rem">${fmt(totalExcess)}</div>
    </div>
    <div class="card">
      <div class="card-title"><span>📈</span> Excess Records (Positive Difference)</div>
      <div class="alert alert-info" style="margin-bottom:12px">
        Days where the physical cash counted was <strong>more than</strong> the expected balance.
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Float</th><th>Collections</th><th>Withdrawals</th>
              <th>Expenses</th><th>Expected</th><th>Counted</th>
              <th style="color:var(--success)">Excess (+)</th><th>Closed By</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => `<tr>
              <td style="font-size:.78rem;white-space:nowrap">${r.date}</td>
              <td class="mono">${fmt(r.float)}</td>
              <td class="mono text-success">${fmt(r.collections)}</td>
              <td class="mono text-danger">${fmt(r.withdrawals)}</td>
              <td class="mono text-danger">${fmt(r.expenses)}</td>
              <td class="mono">${fmt(r.expected)}</td>
              <td class="mono">${fmt(r.cashAtClose)}</td>
              <td class="mono fw-600 text-success">+ ${fmt(r.diff)}</td>
              <td style="font-size:.75rem;color:var(--muted)">${r.closedBy || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════
//  SHORTAGE TAB
// ══════════════════════════════════════════════════════
function renderShortageTab() {
  const el = document.getElementById('t-shortage'); if (!el) return;
  const records       = TELLER_STATE.history.filter(r => r.diff < 0);
  const totalShortage = records.reduce((s, r) => s + Math.abs(r.diff), 0);

  if (!records.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title"><span>📉</span> Shortage Records</div>
        <div class="empty-state" style="padding:44px 0">
          <div class="ei">📉</div>
          <div class="et">No Shortage Records</div>
          <div class="es">Days where counted cash falls short of expected balance will appear here</div>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:14px 16px;background:rgba(232,93,93,.07);border:1px solid rgba(232,93,93,.18);
      border-radius:var(--radius);margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div>
        <div class="fw-600" style="color:var(--danger)">📉 Total Shortage — All Time</div>
        <div class="text-muted" style="font-size:.74rem;margin-top:2px">${records.length} record(s) with deficit</div>
      </div>
      <div class="mono text-danger fw-600" style="font-size:1.4rem">− ${fmt(totalShortage)}</div>
    </div>
    <div class="card">
      <div class="card-title"><span>📉</span> Shortage Records (Negative Difference)</div>
      <div style="padding:10px 14px;background:rgba(232,93,93,.07);border:1px solid rgba(232,93,93,.18);
        border-radius:var(--radius-sm);margin-bottom:12px;font-size:.8rem;color:var(--danger)">
        ⚠️ Days where counted cash was <strong>less than</strong> the expected balance. Investigate each shortage.
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Float</th><th>Collections</th><th>Withdrawals</th>
              <th>Expenses</th><th>Expected</th><th>Counted</th>
              <th style="color:var(--danger)">Shortage (−)</th><th>Closed By</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => `<tr>
              <td style="font-size:.78rem;white-space:nowrap">${r.date}</td>
              <td class="mono">${fmt(r.float)}</td>
              <td class="mono text-success">${fmt(r.collections)}</td>
              <td class="mono text-danger">${fmt(r.withdrawals)}</td>
              <td class="mono text-danger">${fmt(r.expenses)}</td>
              <td class="mono">${fmt(r.expected)}</td>
              <td class="mono">${fmt(r.cashAtClose)}</td>
              <td class="mono fw-600 text-danger">− ${fmt(Math.abs(r.diff))}</td>
              <td style="font-size:.75rem;color:var(--muted)">${r.closedBy || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════════════════════
function renderTellerHistory(filter) {
  const tb  = document.getElementById('thist-tbody');
  let recs  = [...TELLER_STATE.history];
  const now = new Date();
  if (filter === 'today') recs = recs.filter(r => r.date === todayISO());
  else if (filter === 'week') {
    const ws = new Date(now); ws.setDate(now.getDate() - now.getDay());
    recs = recs.filter(r => new Date(r.timestamp) >= ws);
  } else if (filter === 'month') {
    recs = recs.filter(r => {
      const d = new Date(r.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (filter === 'year') {
    recs = recs.filter(r => new Date(r.timestamp).getFullYear() === now.getFullYear());
  }
  if (!recs.length) {
    tb.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">No history</td></tr>';
    return;
  }
  tb.innerHTML = recs.map(r => {
    const diffColor = r.diff > 0 ? 'var(--success)' : r.diff < 0 ? 'var(--danger)' : 'var(--gold)';
    const diffSign  = r.diff > 0 ? '📈 +' : r.diff < 0 ? '📉 ' : '';
    return `<tr>
      <td style="font-size:.78rem">${r.date}</td>
      <td class="mono text-gold">${fmt(r.float)}</td>
      <td class="mono text-success">${fmt(r.collections)} <span class="text-muted">(${r.collCount})</span></td>
      <td class="mono text-danger">${fmt(r.withdrawals)}</td>
      <td class="mono text-danger">${fmt(r.expenses)}</td>
      <td class="mono">
        ${fmt(r.cashAtClose)}
        <span style="font-size:.7rem;color:${diffColor};margin-left:4px">
          (${diffSign}${r.diff.toFixed(2)})
        </span>
      </td>
      <td><span class="badge b-green">${r.status}</span></td>
    </tr>`;
  }).join('');
}

function filterTellerHist(f, btn) {
  document.querySelectorAll('#t-history .btn-sm').forEach(b => { b.className = 'btn btn-sm btn-outline'; });
  btn.className = 'btn btn-sm btn-gold';
  renderTellerHistory(f);
}
