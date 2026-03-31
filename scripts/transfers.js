// ═══════════════════════════════════════════════════════
//  TRANSFERS
// ═══════════════════════════════════════════════════════

// ── Local loader helpers (drives the shared #global-loader overlay) ──
function trfShowLoader(msg, sub) {
  const el  = document.getElementById('global-loader');
  const msg_el = document.getElementById('gl-message');
  const sub_el = document.getElementById('gl-sub');
  if (msg_el) msg_el.textContent = msg || 'Processing...';
  if (sub_el) sub_el.textContent = sub || '';
  if (el) el.style.display = 'flex';
}
function trfHideLoader() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
}

// ── Date field snippet injected into every form type ──
function trfDateField(defaultVal) {
  return `
    <div class="form-group">
      <label class="form-label">Transfer Date <span class="req">*</span></label>
      <input type="date" class="form-control" id="trf-date"
        value="${defaultVal || todayISO()}"
        max="${todayISO()}">
    </div>`;
}

function renderTransferForm() {
  const type = document.getElementById('tri-type')?.value || 'excess';
  const body = document.getElementById('transfer-form-body');
  if (!body) return;
  const agentOptions = AGENTS.map(a =>
    `<option value="${a.id}">${a.firstName} ${a.lastName} (${a.code})</option>`
  ).join('');

  if (type === 'excess') {
    const excessSheets = COLLECTION_SHEETS.filter(s => (s.excess || 0) > 0);
    const sheetOptions = excessSheets.length
      ? excessSheets.map(s =>
          `<option value="${s.id}">
             ${s.code} — ${s.agentName} — Excess: ${fmt(s.excess)} (${fmtDate(s.date)})
           </option>`).join('')
      : `<option value="">No sheets with excess found</option>`;

    body.innerHTML = `
      <div style="background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);
        border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;
        font-size:.82rem">
        💡 Transfer excess cash from a finalized sheet directly into a customer's account balance.
      </div>

      ${trfDateField()}

      <div class="form-group">
        <label class="form-label">Select Sheet with Excess</label>
        <select class="form-control" id="trf-sheet"
          onchange="onExcessSheetChange()">
          <option value="">-- Select Sheet --</option>
          ${sheetOptions}
        </select>
      </div>

      <div id="trf-sheet-info" style="display:none;margin-bottom:12px;
        padding:10px 14px;background:var(--gold-dim);border:1px solid var(--border);
        border-radius:var(--radius-sm);font-size:.82rem">
      </div>

      <div class="form-group">
        <label class="form-label">Credit To — Customer Account No.</label>
        <input type="text" class="form-control" id="trf-acct"
          placeholder="e.g. TN01-0001"
          oninput="lookupExcessCust(this.value)">
      </div>
      <div id="trf-cust-fb" style="margin-bottom:10px;font-size:.8rem"></div>

      <div class="form-group">
        <label class="form-label">Amount to Transfer (GH₵)</label>
        <input type="number" class="form-control" id="trf-amount"
          placeholder="0.00" min="0" step="0.01"
          oninput="validateExcessAmount()">
        <div id="trf-amount-warn"
          style="font-size:.74rem;color:var(--danger);margin-top:4px;display:none">
          ⚠️ Amount exceeds available excess
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Reason / Narration</label>
        <input type="text" class="form-control" id="trf-reason"
          placeholder="e.g. Excess from sheet credited to customer">
      </div>

      <button class="btn btn-gold" onclick="saveTransfer()">
        ✅ Transfer Excess to Customer
      </button>`;

  } else if (type === 'wd_reversal') {
    body.innerHTML = `
      <div class="alert alert-warning">Reverse an incorrect or duplicate withdrawal.</div>

      ${trfDateField()}

      <div class="form-group">
        <label class="form-label">Account Number</label>
        <input type="text" class="form-control" id="trf-acct"
          placeholder="Customer account number"
          oninput="lookupAcct(this.value,'trf-fb','trf-cname')">
      </div>
      <div id="trf-fb"></div>
      <div class="form-group">
        <label class="form-label">Customer Name</label>
        <input type="text" class="form-control" id="trf-cname"
          readonly placeholder="Auto-filled">
      </div>
      <div class="form-group">
        <label class="form-label">Amount (GH₵)</label>
        <input type="number" class="form-control" id="trf-amount"
          placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Reason</label>
        <input type="text" class="form-control" id="trf-reason"
          placeholder="Reason for reversal">
      </div>
      <button class="btn btn-gold" onclick="saveTransfer()">✅ Record Reversal</button>`;

  } else if (type === 'customer') {
    body.innerHTML = `
      <div class="alert alert-info">Transfer a customer from one agent to another.</div>

      ${trfDateField()}

      <div class="form-group">
        <label class="form-label">Account Number</label>
        <input type="text" class="form-control" id="trf-acct"
          placeholder="Customer account number"
          oninput="lookupAcct(this.value,'trf-fb','trf-cname')">
      </div>
      <div id="trf-fb"></div>
      <div class="form-group">
        <label class="form-label">Customer Name</label>
        <input type="text" class="form-control" id="trf-cname"
          readonly placeholder="Auto-filled">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">From Agent</label>
          <select class="form-control" id="trf-from">
            <option value="">-- From Agent --</option>${agentOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">To Agent</label>
          <select class="form-control" id="trf-to-agent">
            <option value="">-- To Agent --</option>${agentOptions}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason</label>
        <input type="text" class="form-control" id="trf-reason"
          placeholder="Reason for transfer">
      </div>
      <button class="btn btn-gold" onclick="saveTransfer()">✅ Transfer Customer</button>`;

  } else if (type === 'transaction') {
    body.innerHTML = `
      <div class="alert alert-warning">
        Move a transaction to the correct customer and reverse from original.
      </div>

      ${trfDateField()}

      <div class="form-group">
        <label class="form-label">From Account (Incorrect)</label>
        <input type="text" class="form-control" id="trf-acct"
          placeholder="Account number">
      </div>
      <div class="form-group">
        <label class="form-label">To Account (Correct)</label>
        <input type="text" class="form-control" id="trf-to"
          placeholder="Account number">
      </div>
      <div class="form-group">
        <label class="form-label">Amount (GH₵)</label>
        <input type="number" class="form-control" id="trf-amount"
          placeholder="0.00" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Reason</label>
        <input type="text" class="form-control" id="trf-reason"
          placeholder="Reason for correction">
      </div>
      <button class="btn btn-gold" onclick="saveTransfer()">✅ Transfer &amp; Correct</button>`;
  }
}

// ── Excess sheet change handler ──
function onExcessSheetChange() {
  const sheetId = document.getElementById('trf-sheet')?.value;
  const infoEl  = document.getElementById('trf-sheet-info');
  const amtEl   = document.getElementById('trf-amount');
  if (!sheetId || !infoEl) { if (infoEl) infoEl.style.display = 'none'; return; }

  const sheet = COLLECTION_SHEETS.find(s => s.id === sheetId);
  if (!sheet) return;

  infoEl.style.display = 'block';
  infoEl.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:14px">
      <div><span class="text-muted">Sheet Code: </span>
        <span class="mono text-gold fw-600">${sheet.code}</span></div>
      <div><span class="text-muted">Agent: </span>${sheet.agentName}</div>
      <div><span class="text-muted">Date: </span>${fmtDate(sheet.date)}</div>
      <div><span class="text-muted">Posted: </span>
        <span class="mono">${fmt(sheet.posted || 0)}</span></div>
      <div><span class="text-muted">Available Excess: </span>
        <span class="mono text-success fw-600">${fmt(sheet.excess || 0)}</span></div>
    </div>`;

  if (amtEl) amtEl.value = (sheet.excess || 0).toFixed(2);
  validateExcessAmount();
}

// ── Customer lookup for excess transfer ──
function lookupExcessCust(val) {
  const key = val.trim().toUpperCase();
  const fb  = document.getElementById('trf-cust-fb');
  if (!fb) return;
  if (!key) { fb.innerHTML = ''; return; }

  const cust = CUSTOMERS.find(c => c.acctNumber === key);
  if (cust) {
    fb.innerHTML = `
      <div style="padding:8px 12px;background:rgba(46,204,138,.08);
        border:1px solid rgba(46,204,138,.2);border-radius:var(--radius-sm)">
        <span class="text-success fw-600">✅ ${cust.firstName} ${cust.lastName}</span>
        <span class="mono text-gold" style="margin-left:8px;font-size:.78rem">
          ${cust.acctNumber}
        </span>
        <span class="text-muted" style="margin-left:8px;font-size:.76rem">
          Balance: ${fmt(cust.balance || 0)}
        </span>
      </div>`;
  } else {
    fb.innerHTML = `
      <div style="padding:7px 12px;background:rgba(232,93,93,.08);
        border:1px solid rgba(232,93,93,.2);border-radius:var(--radius-sm);
        color:var(--danger);font-size:.8rem">
        ❌ Account not found
      </div>`;
  }
}

// ── Validate amount doesn't exceed excess ──
function validateExcessAmount() {
  const sheetId = document.getElementById('trf-sheet')?.value;
  const amt     = parseFloat(document.getElementById('trf-amount')?.value) || 0;
  const warn    = document.getElementById('trf-amount-warn');
  if (!warn || !sheetId) return;
  const sheet = COLLECTION_SHEETS.find(s => s.id === sheetId);
  warn.style.display = (sheet && amt > (sheet.excess || 0)) ? 'block' : 'none';
}

// ── Save transfer (all types) ──
function saveTransfer() {
  const type   = document.getElementById('tri-type').value;
  const reason = document.getElementById('trf-reason')?.value.trim() || '';
  const trfDate = document.getElementById('trf-date')?.value || todayISO();

  if (!trfDate) return toast('Select a transfer date', 'error');
  if (!reason)  return toast('Enter a reason / narration', 'error');

  if (type === 'excess') {
    const sheetId = document.getElementById('trf-sheet')?.value;
    const acct    = document.getElementById('trf-acct')?.value.trim().toUpperCase();
    const amount  = parseFloat(document.getElementById('trf-amount')?.value) || 0;

    if (!sheetId)          return toast('Select a sheet with excess', 'error');
    if (!acct)             return toast('Enter customer account number', 'error');
    if (!amount || amount <= 0) return toast('Enter a valid amount', 'error');

    const sheet = COLLECTION_SHEETS.find(s => s.id === sheetId);
    if (!sheet)            return toast('Sheet not found', 'error');
    if (amount > (sheet.excess || 0))
      return toast(`Amount exceeds available excess of ${fmt(sheet.excess)}`, 'error');

    const cust = CUSTOMERS.find(c => c.acctNumber === acct);
    if (!cust)             return toast('Customer account not found', 'error');

    trfShowLoader('Processing excess transfer...', `${fmt(amount)} → ${cust.acctNumber}`);
    setTimeout(() => {
      cust.balance = (cust.balance || 0) + amount;
      if (!cust.transactions) cust.transactions = [];
      cust.transactions.push({
        id      : uid(),
        type    : 'transfer_in',
        desc    : `Excess transfer from sheet ${sheet.code} — ${reason}`,
        amount,
        balance : cust.balance,
        date    : trfDate,
        time    : new Date().toISOString(),
        by      : currentUser?.name || 'System'
      });

      sheet.excess = (sheet.excess || 0) - amount;
      if (sheet.excess <= 0) { sheet.excess = 0; sheet.balanced = true; }

      TRANSFERS.push({
        id        : uid(),
        type      : 'excess',
        sheetCode : sheet.code,
        sheetId   : sheet.id,
        from      : `Sheet ${sheet.code} (${sheet.agentName})`,
        to        : `${cust.firstName} ${cust.lastName} (${cust.acctNumber})`,
        amount, reason,
        date      : trfDate,
        by        : currentUser?.name || 'System',
        time      : new Date().toISOString()
      });

      logActivity('Transfer',
        `Excess from ${sheet.code} → ${cust.acctNumber}`, amount, 'done');
      saveAll();
      trfHideLoader();
      renderTransferHistory();
      renderTransferForm();
      toast(
        `${fmt(amount)} excess from sheet ${sheet.code} credited to ${cust.firstName} ${cust.lastName}`,
        'success'
      );
    }, 900);

  } else if (type === 'wd_reversal') {
    const acct   = document.getElementById('trf-acct')?.value.trim().toUpperCase();
    const amount = parseFloat(document.getElementById('trf-amount')?.value) || 0;
    if (!acct || !amount) return toast('Fill in all fields', 'error');

    const cust = CUSTOMERS.find(c => c.acctNumber === acct);
    if (!cust) return toast('Customer account not found', 'error');

    trfShowLoader('Processing withdrawal reversal...', `${fmt(amount)} → ${acct}`);
    setTimeout(() => {
      cust.balance = (cust.balance || 0) + amount;
      if (!cust.transactions) cust.transactions = [];
      cust.transactions.push({
        id: uid(), type: 'transfer_in',
        desc: `Withdrawal reversal — ${reason}`,
        amount, balance: cust.balance,
        date: trfDate, time: new Date().toISOString(),
        by: currentUser?.name || 'System'
      });

      TRANSFERS.push({
        id: uid(), type: 'wd_reversal',
        from: 'Withdrawal Reversal', to: acct,
        amount, reason, date: trfDate,
        by: currentUser?.name || 'System',
        time: new Date().toISOString()
      });

      logActivity('Transfer', `WD Reversal → ${acct}`, amount, 'done');
      saveAll();
      trfHideLoader();
      renderTransferHistory();
      renderTransferForm();
      toast(`Withdrawal reversal of ${fmt(amount)} applied to ${acct}`, 'success');
    }, 900);

  } else if (type === 'customer') {
    const acct      = document.getElementById('trf-acct')?.value.trim().toUpperCase();
    const toAgentId = document.getElementById('trf-to-agent')?.value;
    if (!acct || !toAgentId) return toast('Fill in all fields', 'error');

    const cust    = CUSTOMERS.find(c => c.acctNumber === acct);
    const toAgent = AGENTS.find(a => a.id === toAgentId);
    if (!cust)    return toast('Customer not found', 'error');
    if (!toAgent) return toast('Destination agent not found', 'error');

    const fromAgentEl = document.getElementById('trf-from');
    const fromName = fromAgentEl?.options[fromAgentEl.selectedIndex]?.text || cust.acctNumber;

    trfShowLoader(
      'Transferring customer...',
      `${cust.firstName} ${cust.lastName} → ${toAgent.firstName} ${toAgent.lastName}`
    );
    setTimeout(() => {
      cust.agentId   = toAgent.id;
      cust.agentCode = getPrefix(cust.type) + pad2(toAgent.agentNumber);

      TRANSFERS.push({
        id: uid(), type: 'customer',
        from: fromName,
        to: `${toAgent.firstName} ${toAgent.lastName} (${toAgent.code})`,
        amount: 0, reason, date: trfDate,
        by: currentUser?.name || 'System',
        time: new Date().toISOString()
      });

      logActivity('Transfer', `Customer ${acct} → Agent ${toAgent.code}`, 0, 'done');
      saveAll();
      trfHideLoader();
      renderTransferHistory();
      renderTransferForm();
      toast(
        `${cust.firstName} ${cust.lastName} transferred to ${toAgent.firstName} ${toAgent.lastName}`,
        'success'
      );
    }, 900);

  } else if (type === 'transaction') {
    const fromAcct = document.getElementById('trf-acct')?.value.trim().toUpperCase();
    const toAcct   = document.getElementById('trf-to')?.value.trim().toUpperCase();
    const amount   = parseFloat(document.getElementById('trf-amount')?.value) || 0;
    if (!fromAcct || !toAcct || !amount) return toast('Fill in all fields', 'error');

    const fromC = CUSTOMERS.find(c => c.acctNumber === fromAcct);
    const toC   = CUSTOMERS.find(c => c.acctNumber === toAcct);
    if (!fromC) return toast('Source account not found', 'error');
    if (!toC)   return toast('Destination account not found', 'error');
    if (fromAcct === toAcct) return toast('Source and destination accounts cannot be the same', 'error');

    trfShowLoader('Moving transaction...', `${fromAcct} → ${toAcct}`);
    setTimeout(() => {
      fromC.balance = (fromC.balance || 0) - amount;
      toC.balance   = (toC.balance   || 0) + amount;
      if (!fromC.transactions) fromC.transactions = [];
      if (!toC.transactions)   toC.transactions   = [];

      fromC.transactions.push({
        id: uid(), type: 'transfer_out',
        desc: `Transfer to ${toAcct} — ${reason}`,
        amount, balance: fromC.balance,
        date: trfDate, time: new Date().toISOString(),
        by: currentUser?.name || 'System'
      });
      toC.transactions.push({
        id: uid(), type: 'transfer_in',
        desc: `Transfer from ${fromAcct} — ${reason}`,
        amount, balance: toC.balance,
        date: trfDate, time: new Date().toISOString(),
        by: currentUser?.name || 'System'
      });

      TRANSFERS.push({
        id: uid(), type: 'transaction',
        from: fromAcct, to: toAcct,
        amount, reason, date: trfDate,
        by: currentUser?.name || 'System',
        time: new Date().toISOString()
      });

      logActivity('Transfer', `Transaction ${fromAcct} → ${toAcct}`, amount, 'done');
      saveAll();
      trfHideLoader();
      renderTransferHistory();
      renderTransferForm();
      toast(`${fmt(amount)} moved from ${fromAcct} to ${toAcct}`, 'success');
    }, 900);
  }
}

function renderTransferHistory() {
  const tb = document.getElementById('transfer-tbody'); if (!tb) return;
  if (!TRANSFERS.length) {
    tb.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:24px">No transfers</td></tr>';
    return;
  }
  const typeLabels = {
    excess      : '📤 Excess',
    wd_reversal : '↩️ WD Reversal',
    customer    : '👤 Customer',
    transaction : '🔄 Transaction'
  };
  tb.innerHTML = [...TRANSFERS].reverse().map(t => `<tr>
    <td style="font-size:.76rem">${fmtDate(t.date)}</td>
    <td><span class="badge b-blue">${typeLabels[t.type] || t.type}</span></td>
    <td style="font-size:.82rem">${t.from}</td>
    <td style="font-size:.82rem">${t.to}</td>
    <td class="mono">${t.amount ? fmt(t.amount) : '—'}</td>
    <td style="font-size:.8rem">${t.reason}</td>
    <td style="font-size:.76rem;color:var(--muted)">${t.by}</td>
    <td><button class="btn btn-danger btn-xs" onclick="deleteTransfer('${t.id}')">🗑️</button></td>
  </tr>`).join('');
}

function deleteTransfer(id) {
  showConfirm('Delete Transfer Record?', 'This will permanently remove this transfer record.', () => {
    TRANSFERS = TRANSFERS.filter(t => t.id !== id);
    saveAll(); renderTransferHistory(); toast('Transfer deleted', 'warning');
  });
}