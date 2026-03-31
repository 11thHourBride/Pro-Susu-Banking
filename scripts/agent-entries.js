// ═══════════════════════════════════════════════════════
//  AGENT ENTRIES MODULE — Pro Susu Banking
//  Pattern mirrors entries.js:
//  · Type 4 digits (e.g. 0001) → auto-expands to TN01-0001
//  · Or type full account number
//  · Customer name fills automatically
//  · New row only appears after amount is entered
//  · No manual "Add Row" button
// ═══════════════════════════════════════════════════════

let AE_STATE = {
  rows  : [],   // [{ id, acct, name, amount }]
  date  : '',
  notes : '',
};

// ── Get the agent record for the logged-in user ───────
function _getSessionAgent() {
  if (!currentUser) return null;
  if (currentUser.agentId)
    return AGENTS.find(a => a.id === currentUser.agentId) || null;
  const fullName = (currentUser.name || '').trim().toLowerCase();
  if (fullName) {
    const m = AGENTS.find(a =>
      (a.firstName + ' ' + a.lastName).trim().toLowerCase() === fullName);
    if (m) return m;
  }
  if (currentUser.phone) {
    const m = AGENTS.find(a => a.phone === currentUser.phone);
    if (m) return m;
  }
  if (currentUser.username) {
    const m = AGENTS.find(a =>
      (a.code || '').toLowerCase() === currentUser.username.toLowerCase());
    if (m) return m;
  }
  return null;
}

// ── Render the full agent entries page ────────────────
function renderAgentEntriesPage() {
  const wrap = document.getElementById('view-agent-entries-content') ||
               document.getElementById('view-agent-entries');
  if (!wrap) return;

  const agent = _getSessionAgent();

  if (!agent) {
    wrap.innerHTML = `
      <div class="card" style="max-width:520px;margin:40px auto;text-align:center;padding:32px">
        <div style="font-size:2rem;margin-bottom:12px">🔗</div>
        <div class="fw-600" style="font-size:1rem;margin-bottom:8px">Agent Record Not Linked</div>
        <div class="text-muted" style="font-size:.82rem;line-height:1.7">
          Your user account is not linked to an agent record.<br>
          Ask the administrator to ensure your <strong>full name</strong> in
          <em>Users &amp; Access</em> exactly matches your name in the
          <em>Agents</em> register.
        </div>
        <div class="alert alert-info" style="margin-top:16px;font-size:.78rem;text-align:left">
          Logged in as: <strong>${currentUser?.name || '—'}</strong><br>
          Agents on file: ${AGENTS.length
            ? AGENTS.map(a => a.firstName + ' ' + a.lastName).join(', ')
            : 'None registered'}
        </div>
      </div>`;
    return;
  }

  if (!AE_STATE.rows.length) AE_STATE.rows.push({ id: uid(), acct: '', name: '', amount: '' });
  if (!AE_STATE.date) AE_STATE.date = todayISO();

  wrap.innerHTML = `
    <div style="max-width:840px">

      <!-- Header -->
      <div class="flex-between mb-4" style="flex-wrap:wrap;gap:10px">
        <div>
          <div class="fw-600" style="font-size:1rem">📝 Field Collection Entry</div>
          <div class="text-muted" style="font-size:.78rem;margin-top:2px">
            ${agent.firstName} ${agent.lastName} &middot;
            <span class="agent-code">${agent.code}</span> &middot;
            💡 Type <strong>4 digits</strong> (e.g. <code>0001</code>) — expands to
            <code>${agent.code}-0001</code> automatically
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="aeClearSheet()">🗑 Clear</button>
          <button class="btn btn-outline btn-sm" onclick="aeViewHistory()">📋 History</button>
          <button class="btn btn-gold btn-sm" onclick="aeSubmitToTeller()">📤 Submit to Teller</button>
        </div>
      </div>

      <!-- Date & Notes -->
      <div class="card mb-4">
        <div class="form-row" style="margin-bottom:0">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Collection Date</label>
            <input type="date" class="form-control" id="ae-date"
              value="${AE_STATE.date}"
              onchange="AE_STATE.date=this.value">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Notes (Optional)</label>
            <input type="text" class="form-control" id="ae-notes"
              value="${AE_STATE.notes}"
              placeholder="e.g. Tuesday round, market day"
              oninput="AE_STATE.notes=this.value">
          </div>
        </div>
      </div>

      <!-- Balance summary boxes (mirrors entries.js) -->
      <div class="balance-boxes" style="margin-bottom:14px">
        <div class="bal-box posted" id="ae-box-entered">
          <div class="bl" id="ae-lbl-entered">📝 Entered</div>
          <div class="bv" id="ae-val-entered">GH₵ 0.00</div>
        </div>
        <div class="bal-box excess">
          <div class="bl">Total Entries</div>
          <div class="bv" id="ae-val-count">0</div>
        </div>
        <div class="bal-box shortage">
          <div class="bl">⚠ Not Found</div>
          <div class="bv" id="ae-val-notfound" style="color:var(--muted)">0</div>
        </div>
      </div>

      <!-- Entry Sheet -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:10px 16px;background:var(--surface2);
          border-bottom:1px solid var(--border)">
          <div class="fw-600" style="font-size:.85rem">📋 Collection Sheet</div>
          <div class="text-muted" style="font-size:.73rem;margin-top:2px">
            Enter account number → name auto-fills → enter amount → next row appears
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:32px">#</th>
                <th style="width:155px">Account No.</th>
                <th>Customer Name</th>
                <th style="width:155px">Amount (GH₵)</th>
                <th style="width:36px"></th>
              </tr>
            </thead>
            <tbody id="ae-rows"></tbody>
          </table>
        </div>
        <div style="padding:10px 16px;border-top:1px solid var(--border);
          background:var(--surface2);display:flex;justify-content:flex-end;align-items:center;gap:24px">
          <span class="text-muted" style="font-size:.76rem">
            <span id="ae-count">0</span> valid entries
          </span>
          <span>
            <span class="text-muted" style="font-size:.76rem">Total: </span>
            <span class="mono fw-600 text-gold" style="font-size:1rem" id="ae-total">GH₵ 0.00</span>
          </span>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-gold" onclick="aeSubmitToTeller()">📤 Submit to Teller</button>
      </div>
    </div>`;

  _aeBuildTable();
}

// ── Build / rebuild the full entry table ──────────────
function _aeBuildTable() {
  const tb = document.getElementById('ae-rows');
  if (!tb) return;

  tb.innerHTML = AE_STATE.rows.map((r, i) => `
    <tr id="ae-row-${r.id}">
      <td class="text-muted" style="font-size:.78rem;padding:6px 8px">${i + 1}</td>
      <td style="padding:4px 6px">
        <input type="text" id="ae-acct-${r.id}"
          class="form-control"
          style="height:34px;font-size:.82rem;font-family:'JetBrains Mono',monospace;letter-spacing:.5px"
          value="${r.acct}"
          placeholder="e.g. 0001"
          autocomplete="off" spellcheck="false">
      </td>
      <td style="padding:4px 6px">
        <input type="text" id="ae-name-${r.id}"
          class="form-control"
          style="height:34px;font-size:.82rem;background:var(--surface2)"
          value="${r.name}"
          placeholder="Auto-filled"
          readonly tabindex="-1">
      </td>
      <td style="padding:4px 6px">
        <input type="number" id="ae-amt-${r.id}"
          class="form-control"
          style="height:34px;font-size:.82rem"
          value="${r.amount || ''}"
          placeholder="0.00"
          min="0" step="0.01" tabindex="-1">
      </td>
      <td style="padding:4px 6px;text-align:center">
        ${i > 0
          ? `<button class="btn btn-danger btn-xs" tabindex="-1"
               onclick="aeRemoveRow('${r.id}')">✕</button>`
          : ''}
      </td>
    </tr>`).join('');

  AE_STATE.rows.forEach(r => _aeAttachListeners(r.id));
  // Focus account input of last row
  _aeFocusAcct(AE_STATE.rows[AE_STATE.rows.length - 1].id);
}

// ── Attach listeners to one row ───────────────────────
function _aeAttachListeners(rowId) {
  const acctEl = document.getElementById('ae-acct-' + rowId);
  const amtEl  = document.getElementById('ae-amt-'  + rowId);

  if (acctEl) {
    acctEl.addEventListener('input', function() {
      const v = this.value.trim();
      // Auto-fire on 4 digits (short code)
      if (/^\d{4}$/.test(v))                       { _aeLookup(rowId, v); return; }
      // Auto-fire on full account number format
      if (/^[A-Za-z]{2,4}\d{2}-\d{4}$/.test(v))   { _aeLookup(rowId, v); return; }
      // Clear name if user is editing
      const r = AE_STATE.rows.find(x => x.id === rowId);
      if (r && r.name) {
        r.name = '';
        const ne = document.getElementById('ae-name-' + rowId);
        if (ne) { ne.value = ''; ne.style.color = 'var(--muted)'; }
      }
    });
    acctEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const v = this.value.trim();
        if (v) _aeLookup(rowId, v);
      }
    });
  }

  if (amtEl) {
    amtEl.addEventListener('input', function() {
      const r = AE_STATE.rows.find(x => x.id === rowId);
      if (r) r.amount = parseFloat(this.value) || 0;
      _aeCalcTotals();
    });
    amtEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const amt = parseFloat(this.value) || 0;
        if (!amt || amt <= 0) {
          toast('Enter an amount before proceeding', 'warning');
          return;
        }
        const r = AE_STATE.rows.find(x => x.id === rowId);
        if (r) r.amount = amt;
        _aeAdvanceRow(rowId);
      }
    });
  }
}

// ── Lookup account number ─────────────────────────────
function _aeLookup(rowId, raw) {
  if (!raw) return;
  const agent = _getSessionAgent();
  const r     = AE_STATE.rows.find(x => x.id === rowId); if (!r) return;

  let cust = null;
  let resolved = raw.toUpperCase();

  // Short code: 1–4 digits → expand using agent code
  if (agent && /^\d{1,4}$/.test(raw)) {
    const padded = raw.padStart(4, '0');
    resolved     = `${agent.code}-${padded}`;
    cust         = CUSTOMERS.find(c => c.acctNumber === resolved);
  }

  // Fallback: full account number
  if (!cust) {
    resolved = raw.toUpperCase();
    cust     = CUSTOMERS.find(c => c.acctNumber === resolved);
  }

  r.acct = cust ? resolved : raw.toUpperCase();
  r.name = cust ? `${cust.firstName} ${cust.lastName}` : '';

  const acctEl = document.getElementById('ae-acct-' + rowId);
  const nameEl = document.getElementById('ae-name-' + rowId);

  if (acctEl) acctEl.value = r.acct;   // show expanded code

  if (nameEl) {
    if (cust) {
      nameEl.value      = r.name;
      nameEl.style.color = 'var(--success)';
    } else {
      nameEl.value      = '❌ Account not found';
      nameEl.style.color = 'var(--danger)';
    }
  }

  _aeCalcTotals();

  // Jump to amount if found
  if (cust) {
    const amtEl = document.getElementById('ae-amt-' + rowId);
    if (amtEl) { amtEl.removeAttribute('tabindex'); amtEl.focus(); amtEl.select(); }
  }
}

// ── Advance to next row (only after amount entered) ───
function _aeAdvanceRow(rowId) {
  const idx = AE_STATE.rows.findIndex(r => r.id === rowId);
  if (idx === AE_STATE.rows.length - 1) {
    // Last row — add new row only now
    AE_STATE.rows.push({ id: uid(), acct: '', name: '', amount: '' });
    _aeBuildTable();
  } else {
    _aeFocusAcct(AE_STATE.rows[idx + 1].id);
  }
}

function _aeFocusAcct(rowId) {
  setTimeout(() => {
    const el = document.getElementById('ae-acct-' + rowId);
    if (el) { el.focus(); el.select(); }
  }, 40);
}

// ── Remove a row ──────────────────────────────────────
function aeRemoveRow(id) {
  if (AE_STATE.rows.length === 1) return;
  AE_STATE.rows = AE_STATE.rows.filter(r => r.id !== id);
  _aeBuildTable();
  _aeCalcTotals();
}

// ── Live totals ───────────────────────────────────────
function _aeCalcTotals() {
  const valid    = AE_STATE.rows.filter(r => r.name && parseFloat(r.amount) > 0);
  const notFound = AE_STATE.rows.filter(r => r.acct && !r.name).length;
  const total    = valid.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const totalEl    = document.getElementById('ae-total');
  const countEl    = document.getElementById('ae-count');
  const nfEl       = document.getElementById('ae-val-notfound');
  const enteredEl  = document.getElementById('ae-val-entered');
  const cntBoxEl   = document.getElementById('ae-val-count');

  if (totalEl)   totalEl.textContent   = fmt(total);
  if (countEl)   countEl.textContent   = valid.length;
  if (nfEl)      { nfEl.textContent   = notFound; nfEl.style.color = notFound > 0 ? 'var(--danger)' : 'var(--muted)'; }
  if (enteredEl) enteredEl.textContent = fmt(total);
  if (cntBoxEl)  cntBoxEl.textContent  = valid.length;
}

// ── Clear sheet ───────────────────────────────────────
function aeClearSheet() {
  showConfirm('🗑 Clear Sheet?', 'Remove all entries and start fresh?', () => {
    AE_STATE.rows  = [{ id: uid(), acct: '', name: '', amount: '' }];
    AE_STATE.notes = '';
    renderAgentEntriesPage();
  });
}

// ── Submit to teller ───────────────────────────────────
function aeSubmitToTeller() {
  const agent = _getSessionAgent();
  if (!agent) return toast('Agent record not linked', 'error');

  const date  = document.getElementById('ae-date')?.value  || AE_STATE.date  || todayISO();
  const notes = document.getElementById('ae-notes')?.value || AE_STATE.notes || '';

  const entries = AE_STATE.rows
    .filter(r => r.acct && r.name && parseFloat(r.amount) > 0)
    .map(r => {
      const cust = CUSTOMERS.find(c => c.acctNumber === r.acct);
      return {
        customerId  : cust?.id  || null,
        acctNumber  : r.acct,
        customerName: r.name,
        type        : cust?.type || '',
        amount      : parseFloat(r.amount)
      };
    });

  if (!entries.length)
    return toast('Enter at least one account number and amount', 'error');

  // Block if any "account not found" rows with amounts exist
  const broken = AE_STATE.rows.filter(r => r.acct && !r.name && parseFloat(r.amount) > 0);
  if (broken.length)
    return toast(`${broken.length} account number(s) not found. Fix them before submitting.`, 'error');

  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);

  showConfirm(
    '📤 Submit to Teller?',
    `Submit <strong>${entries.length}</strong> entries totalling
     <strong class="mono">${fmt(totalAmount)}</strong> to the teller for confirmation?`,
    () => {
      if (!AGENT_SUBMISSIONS) window.AGENT_SUBMISSIONS = [];
      AGENT_SUBMISSIONS.unshift({
        id             : uid(),
        agentId        : agent.id,
        agentName      : `${agent.firstName} ${agent.lastName}`,
        agentCode      : agent.code,
        date, notes, entries, totalAmount,
        status         : 'pending',
        submittedAt    : new Date().toISOString(),
        submittedBy    : currentUser.name,
        confirmedAmount: null,
        confirmedBy    : null,
        confirmedAt    : null,
        tellerNotes    : '',
      });
      saveAll();
      logActivity('Agent Entry',
        `${agent.firstName} ${agent.lastName} submitted ${fmt(totalAmount)} (${entries.length} customers)`,
        totalAmount, 'pending');

      // Reset
      AE_STATE = { rows: [{ id: uid(), acct: '', name: '', amount: '' }], date: todayISO(), notes: '' };
      renderAgentEntriesPage();
      toast(`${fmt(totalAmount)} submitted to teller ✅`, 'success');
    }
  );
}

// ── History view ───────────────────────────────────────
function aeViewHistory() {
  const agent = _getSessionAgent();
  const wrap  = document.getElementById('view-agent-entries-content') ||
                document.getElementById('view-agent-entries');
  if (!wrap) return;
  const subs = (AGENT_SUBMISSIONS || []).filter(s => s.agentId === agent?.id);
  wrap.innerHTML = `
    <div style="max-width:840px">
      <div class="flex-between mb-4">
        <div class="fw-600" style="font-size:1rem">📋 Submission History</div>
        <button class="btn btn-outline btn-sm" onclick="renderAgentEntriesPage()">← Back to Sheet</button>
      </div>
      ${!subs.length ? `
        <div class="empty-state" style="padding:48px 0">
          <div class="ei">📭</div><div class="et">No submissions yet</div>
        </div>` :
        subs.map(s => {
          const badge = { pending:'<span class="badge b-yellow">⏳ Awaiting Teller</span>',
            confirmed:'<span class="badge b-blue">✅ Teller Confirmed — Awaiting Clerk</span>',
            posted:'<span class="badge b-green">✅ Finalized by Clerk</span>',
            returned:'<span class="badge b-red">↩ Returned</span>' }[s.status]
            || `<span class="badge b-gray">${s.status}</span>`;
          return `
            <div class="card mb-3">
              <div class="flex-between mb-2">
                <div>
                  <div class="fw-600">${fmtDate(s.date)}</div>
                  <div class="text-muted" style="font-size:.73rem">
                    ${s.entries.length} customers &middot; ${fmtDateTime(s.submittedAt)}
                    ${s.notes ? '&middot; ' + s.notes : ''}
                  </div>
                </div>
                <div style="text-align:right">
                  <div class="mono fw-600 text-gold">${fmt(s.totalAmount)}</div>${badge}
                </div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Account</th><th>Customer</th><th>Type</th><th>Amount</th></tr></thead>
                  <tbody>
                    ${s.entries.map(e => `
                      <tr>
                        <td class="mono text-gold" style="font-size:.78rem">${e.acctNumber}</td>
                        <td style="font-size:.82rem">${e.customerName}</td>
                        <td><span class="badge ${e.type==='susu'?'b-gold':e.type==='lending'?'b-blue':'b-green'}">${e.type||'—'}</span></td>
                        <td class="mono fw-600">${fmt(e.amount)}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
              ${s.confirmedBy ? `
                <div style="margin-top:8px;padding:7px 12px;background:rgba(46,204,138,.07);
                  border:1px solid rgba(46,204,138,.18);border-radius:6px;font-size:.78rem">
                  Confirmed by <strong>${s.confirmedBy}</strong> —
                  <strong class="mono">${fmt(s.confirmedAmount)}</strong>
                  ${s.confirmedAmount !== s.totalAmount
                    ? `<span class="${s.confirmedAmount < s.totalAmount ? 'text-danger' : 'text-warning'}">
                        (${s.confirmedAmount < s.totalAmount ? 'Shortage' : 'Excess'}:
                        ${fmt(Math.abs(s.confirmedAmount - s.totalAmount))})</span>`
                    : '<span class="text-success"> — Exact match</span>'}
                  ${s.sheetCode ? `<br>Sheet Code: <strong class="mono text-gold">${s.sheetCode}</strong>` : ''}
                  ${s.tellerNotes ? `<br>Note: ${s.tellerNotes}` : ''}
                </div>` : ''}
            </div>`; }).join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════
//  TELLER — Confirm Agent Submissions
// ══════════════════════════════════════════════════════

function renderAgentSubmissionsForTeller() {
  const el = document.getElementById('teller-agent-submissions'); if (!el) return;
  const pending   = (AGENT_SUBMISSIONS || []).filter(s => s.status === 'pending');
  const confirmed = (AGENT_SUBMISSIONS || []).filter(s => s.status === 'confirmed');
  const badge     = document.getElementById('agent-subs-badge');
  if (badge) { badge.textContent = pending.length; badge.style.display = pending.length ? '' : 'none'; }

  let html = '';

  if (!pending.length && !confirmed.length) {
    html = `<div class="empty-state" style="padding:36px 0">
      <div class="ei">📭</div><div class="et">No Pending Submissions</div>
      <div class="es">Agent field collections appear here once submitted</div>
    </div>`;
  }

  // ── Pending: needs teller action ──────────────────
  if (pending.length) {
    html += pending.map(s => `
      <div class="card mb-4">
        <div class="flex-between mb-3">
          <div>
            <div class="fw-600">${s.agentName} <span class="agent-code" style="margin-left:6px">${s.agentCode}</span></div>
            <div class="text-muted" style="font-size:.74rem">
              ${fmtDate(s.date)} &middot; ${s.entries.length} customers
              &middot; Submitted ${fmtDateTime(s.submittedAt)}
              ${s.notes ? '&middot; ' + s.notes : ''}
            </div>
          </div>
          <div style="text-align:right">
            <div class="mono fw-600 text-gold" style="font-size:1rem">${fmt(s.totalAmount)}</div>
            <span class="badge b-yellow">⏳ Pending</span>
          </div>
        </div>
        <div class="table-wrap mb-3">
          <table>
            <thead><tr><th>Account No.</th><th>Customer</th><th>Type</th><th>Amount</th></tr></thead>
            <tbody>
              ${s.entries.map(e => `<tr>
                <td class="mono text-gold" style="font-size:.78rem">${e.acctNumber}</td>
                <td style="font-size:.82rem">${e.customerName}</td>
                <td><span class="badge ${e.type==='susu'?'b-gold':e.type==='lending'?'b-blue':'b-green'}">${e.type||'—'}</span></td>
                <td class="mono fw-600">${fmt(e.amount)}</td>
              </tr>`).join('')}
              <tr style="border-top:2px solid var(--border)">
                <td colspan="3" class="fw-600">Agent Total</td>
                <td class="mono fw-600 text-gold">${fmt(s.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius)">
          <div class="fw-600" style="font-size:.82rem;margin-bottom:8px">✅ Confirm Amount Received from Agent</div>
          <div class="form-row" style="align-items:flex-end">
            <div class="form-group" style="margin-bottom:0;flex:1">
              <label class="form-label">Actual Cash Received (GH₵)</label>
              <input type="number" class="form-control" id="tc-amt-${s.id}"
                value="${s.totalAmount}" min="0" step="0.01"
                oninput="updateTellerDiff('${s.id}',${s.totalAmount})">
            </div>
            <div class="form-group" style="margin-bottom:0;flex:1">
              <label class="form-label">Difference</label>
              <div id="tc-diff-${s.id}" class="form-control" style="background:var(--surface);display:flex;align-items:center">
                <span class="text-success">✅ Exact match</span>
              </div>
            </div>
          </div>
          <div class="form-group" style="margin-top:8px;margin-bottom:0">
            <label class="form-label">Notes (Optional)</label>
            <input type="text" class="form-control" id="tc-notes-${s.id}" placeholder="e.g. Agent short by GHS 2">
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-gold btn-sm" onclick="tellerConfirmSubmission('${s.id}')">✅ Confirm &amp; Send to Entries</button>
            <button class="btn btn-outline btn-sm" onclick="tellerReturnSubmission('${s.id}')">↩ Return to Agent</button>
          </div>
        </div>
      </div>`).join('');
  }

  // ── Confirmed: already sent to accounting clerk ───
  if (confirmed.length) {
    html += `<div class="fw-600" style="font-size:.82rem;color:var(--muted);
      margin:12px 0 8px;padding-top:${pending.length ? '12px' : '0'};
      border-top:${pending.length ? '1px solid var(--border)' : 'none'}">
      ✅ Confirmed — Awaiting Clerk Finalization
    </div>`;
    html += confirmed.map(s => `
      <div style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);
        margin-bottom:8px;background:rgba(46,204,138,.04)">
        <div class="flex-between">
          <div>
            <div class="fw-600" style="font-size:.84rem">${s.agentName}
              <span class="agent-code" style="margin-left:6px">${s.agentCode}</span>
            </div>
            <div class="text-muted" style="font-size:.73rem">
              ${fmtDate(s.date)} &middot; ${s.entries.length} customers
              &middot; Confirmed by ${s.confirmedBy}
            </div>
            ${s.sheetCode ? `<div class="mono text-gold" style="font-size:.72rem;margin-top:3px">
              Sheet: ${s.sheetCode}
            </div>` : ''}
          </div>
          <div style="text-align:right">
            <div class="mono fw-600 text-gold">${fmt(s.confirmedAmount)}</div>
            <span class="badge b-blue" style="font-size:.66rem">Sent to Entries</span>
          </div>
        </div>
      </div>`).join('');
  }

  el.innerHTML = html;
}

function updateTellerDiff(id, agentTotal) {
  const confirmed = parseFloat(document.getElementById('tc-amt-' + id)?.value) || 0;
  const diff = confirmed - agentTotal;
  const el   = document.getElementById('tc-diff-' + id); if (!el) return;
  el.innerHTML = diff === 0
    ? '<span class="text-success">✅ Exact match</span>'
    : diff > 0
      ? `<span class="text-warning">⬆️ Excess: <strong>${fmt(Math.abs(diff))}</strong></span>`
      : `<span class="text-danger">⬇️ Shortage: <strong>${fmt(Math.abs(diff))}</strong></span>`;
}

function tellerConfirmSubmission(id) {
  const s = (AGENT_SUBMISSIONS || []).find(x => x.id === id); if (!s) return;
  const confirmed = parseFloat(document.getElementById('tc-amt-' + id)?.value);
  const notes     = (document.getElementById('tc-notes-' + id)?.value || '').trim();
  if (isNaN(confirmed) || confirmed < 0) return toast('Enter a valid amount', 'error');
  const diff = confirmed - s.totalAmount;
  const diffLabel = diff === 0 ? 'Exact match'
    : diff > 0 ? `Excess of ${fmt(Math.abs(diff))}` : `Shortage of ${fmt(Math.abs(diff))}`;

  showConfirm('✅ Confirm &amp; Post to Entries?',
    `Confirm <strong>${fmt(confirmed)}</strong> received from <strong>${s.agentName}</strong>?
     <br><span class="${diff < 0 ? 'text-danger' : diff > 0 ? 'text-warning' : 'text-success'}">${diffLabel}</span>
     <br><br>This will appear in <strong>Entries</strong> for the accounting clerk to finalize.`,
    () => {
      // ── Generate a unique sheet code ─────────────────
      const sheetCode = 'AG-' +
        new Date().toISOString().slice(0,10).replace(/-/g,'') +
        '-' + Math.random().toString(36).slice(2,6).toUpperCase();

      // ── Convert agent entries → entryRows format (mirrors entries.js) ──
      const entryRows = s.entries.map(e => ({
        id     : uid(),
        acct   : e.acctNumber,
        name   : e.customerName,
        amount : e.amount
      }));

      // ── Create a TELLER_STATE.collections entry (status: awaiting) ──
      // This is the ONLY record created at teller confirmation.
      // finalizeEntry() in entries.js creates the single COLLECTION_SHEETS
      // record when the clerk approves — no pre-push here avoids duplicates.
      // collectionDate preserves the AGENT'S original date so the finalized
      // sheet carries that date even if the clerk approves the next day.
      if (!TELLER_STATE.collections) TELLER_STATE.collections = [];
      const collEntry = {
        id               : uid(),
        agentId          : s.agentId,
        agentName        : s.agentName,
        agentCode        : s.agentCode,
        amount           : confirmed,
        agentAmount      : s.totalAmount,
        ref              : sheetCode,
        notes            : notes + (s.notes ? ' | ' + s.notes : ''),
        collectionDate   : s.date,   // agent's original collection date — NOT todayISO()
        time             : new Date().toISOString(),
        status           : 'awaiting',
        entryRows        : entryRows,
        source           : 'agent',
        agentSubmissionId: s.id,
        sheetCode        : sheetCode,
        excess           : diff > 0 ? Math.abs(diff) : 0,
        shortage         : diff < 0 ? Math.abs(diff) : 0,
        balanced         : diff === 0,
      };
      TELLER_STATE.collections.push(collEntry);

      // ── Mark submission as teller-confirmed ──────────
      s.status          = 'confirmed';
      s.confirmedAmount = confirmed;
      s.confirmedBy     = currentUser.name;
      s.confirmedAt     = new Date().toISOString();
      s.tellerNotes     = notes;
      s.sheetCode       = sheetCode;

      saveAll();

      logActivity('Agent Entry',
        `Teller confirmed ${fmt(confirmed)} from ${s.agentName} — Sheet ${sheetCode}${diff !== 0 ? ' (' + diffLabel + ')' : ''}. Sent to Entries for clerk approval.`,
        confirmed, 'confirmed');

      renderAgentSubmissionsForTeller();

      toast(
        `Sheet <strong>${sheetCode}</strong> created — now appears in Entries for clerk to finalize ✅`,
        'success'
      );
    });
}

function tellerReturnSubmission(id) {
  const s = (AGENT_SUBMISSIONS || []).find(x => x.id === id); if (!s) return;
  showConfirm('↩ Return to Agent?', `Return this submission from <strong>${s.agentName}</strong>?`, () => {
    s.status = 'returned'; saveAll();
    renderAgentSubmissionsForTeller();
    toast(`Returned to ${s.agentName}`, 'warning');
  });
}

function getAgentSubmissionBadgeCount() {
  return (AGENT_SUBMISSIONS || []).filter(s => s.status === 'pending').length;
}

// ═══════════════════════════════════════════════════════
//  PATCH — finalizeEntry date fix for agent collections
//  entries.js uses todayISO() for the sheet date. For
//  agent-sourced collections we override that to use the
//  original field collection date stored on the
//  collection object (coll.collectionDate), so the sheet
//  always shows when the agent actually collected, not
//  when the clerk approved it.
// ═══════════════════════════════════════════════════════
(function _patchFinalizeEntryDate() {
  // Wait for entries.js to define finalizeEntry, then wrap it
  const _tryPatch = () => {
    if (typeof finalizeEntry !== 'function') return;

    const _orig = finalizeEntry;
    window.finalizeEntry = function() {
      // If the active collection is agent-sourced, temporarily swap todayISO
      // to return the original collection date for the duration of finalization
      const coll = (TELLER_STATE.collections || [])
        .find(c => c.id === ENTRY_STATE.activeCollId);

      if (coll && coll.source === 'agent' && coll.collectionDate) {
        const _origTodayISO = window.todayISO;
        // Override todayISO() just for this call
        window.todayISO = () => coll.collectionDate;
        try {
          _orig.apply(this, arguments);
        } finally {
          // Always restore, even if finalizeEntry throws
          window.todayISO = _origTodayISO;
        }
        // After clerk finalizes, mark the agent submission as posted
        if (coll.agentSubmissionId) {
          const sub = (AGENT_SUBMISSIONS || [])
            .find(s => s.id === coll.agentSubmissionId);
          if (sub) { sub.status = 'posted'; saveAll(); }
        }
      } else {
        // Regular (non-agent) collection — unchanged behaviour
        _orig.apply(this, arguments);
      }
    };
  };

  // entries.js loads before agent-entries.js in the script order,
  // so finalizeEntry should already be defined. Try immediately,
  // then retry once after DOM is ready as a safety net.
  _tryPatch();
  document.addEventListener('DOMContentLoaded', _tryPatch);
})();