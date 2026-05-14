// ═══════════════════════════════════════════════════════
//  CARD REPLACEMENT — Pro Susu Banking
// ═══════════════════════════════════════════════════════

let _crSelectedCustomer = null;   // currently looked-up customer

// ── Init: populate agents + set today's date ──────────
function initCardReplacement() {
  // Populate agent dropdown
  const sel = document.getElementById('cri-agent'); if (!sel) return;
  sel.innerHTML = '<option value="">— Choose agent —</option>' +
    AGENTS.filter(a => a.status === 'active')
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(a => `<option value="${a.id}">${a.code} — ${a.firstName} ${a.lastName}</option>`)
      .join('');

  // Set today's date
  const dateEl = document.getElementById('cri-date');
  if (dateEl && !dateEl.value) dateEl.value = todayISO();

  // Update fee display
  const feeEl = document.getElementById('card-fee-display');
  if (feeEl) feeEl.textContent = `GH₵ ${(SETTINGS.cardFee || 30).toFixed(2)}`;

  // Pre-fill processed by
  const byEl = document.getElementById('cri-by');
  if (byEl && !byEl.value) byEl.value = currentUser?.name || '';

  // Reset customer
  _crSelectedCustomer = null;
  _crClearLookup();

  // Render history
  renderCardHistory();
}

// ── Agent changed: reset account lookup ──────────────
function crAgentChanged() {
  _crSelectedCustomer = null;
  _crClearLookup();
  const acctEl = document.getElementById('cri-acct');
  if (acctEl) { acctEl.value = ''; acctEl.focus(); }
}

function _crClearLookup() {
  const nameEl = document.getElementById('cri-name');
  const fbEl   = document.getElementById('cri-fb');
  const balEl  = document.getElementById('cri-balance-display');
  const sug    = document.getElementById('cri-suggestions');
  if (nameEl) nameEl.value = '';
  if (fbEl)   fbEl.innerHTML = '';
  if (balEl)  balEl.innerHTML = '';
  if (sug)    sug.style.display = 'none';
}

// ── Account number lookup ─────────────────────────────
function crLookupAcct(raw, force = false) {
  const agentId = document.getElementById('cri-agent')?.value;
  const fbEl    = document.getElementById('cri-fb');
  const nameEl  = document.getElementById('cri-name');
  const balEl   = document.getElementById('cri-balance-display');
  const sugEl   = document.getElementById('cri-suggestions');
  const acctEl  = document.getElementById('cri-acct');

  _crSelectedCustomer = null;
  if (nameEl) nameEl.value = '';
  if (balEl)  balEl.innerHTML = '';
  if (fbEl)   fbEl.innerHTML = '';
  if (sugEl)  sugEl.style.display = 'none';

  const v = (raw || '').trim();
  if (!v) return;

  // Get pool of customers to search
  const agent = AGENTS.find(a => a.id === agentId);
  let pool = agentId
    ? CUSTOMERS.filter(c => c.agentId === agentId && c.status === 'active')
    : CUSTOMERS.filter(c => c.status === 'active');

  // Resolve: if 1–4 digits and agent selected, expand to full account number
  let resolved = v.toUpperCase();
  if (agent && /^\d{1,4}$/.test(v)) {
    resolved = `${agent.code}-${v.padStart(4, '0')}`;
  }

  // Exact match
  const exact = pool.find(c => c.acctNumber === resolved);
  if (exact) {
    _crSetCustomer(exact, resolved);
    if (acctEl) acctEl.value = resolved; // show full account number
    return;
  }

  // Partial match — show dropdown suggestions
  const partial = pool.filter(c =>
    c.acctNumber.includes(v.toUpperCase()) ||
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(v.toLowerCase())
  ).slice(0, 8);

  if (partial.length === 1 && force) {
    _crSetCustomer(partial[0], partial[0].acctNumber);
    if (acctEl) acctEl.value = partial[0].acctNumber;
    return;
  }

  if (partial.length > 0) {
    if (sugEl) {
      sugEl.style.display = 'block';
      sugEl.innerHTML = partial.map(c => `
        <div onclick="crPickSuggestion('${c.id}')"
          style="padding:8px 12px;cursor:pointer;font-size:.82rem;
            border-bottom:1px solid var(--border);
            display:flex;justify-content:space-between;align-items:center"
          onmouseover="this.style.background='var(--surface2)'"
          onmouseout="this.style.background=''">
          <div>
            <span class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</span>
            &nbsp;—&nbsp; ${c.firstName} ${c.lastName}
          </div>
          <span class="badge ${c.type==='susu'?'b-gold':c.type==='lending'?'b-blue':'b-green'}"
            style="font-size:.6rem">${c.type}</span>
        </div>`).join('');
    }
    if (fbEl) fbEl.innerHTML = `<span class="text-muted">${partial.length} match${partial.length!==1?'es':''} — select from list</span>`;
    return;
  }

  // Nothing found
  if (fbEl) fbEl.innerHTML = `<span style="color:var(--danger)">
    ❌ No ${agentId ? 'customer for this agent' : 'customer'} matching "${v}"
  </span>`;
}

function crPickSuggestion(custId) {
  const c = CUSTOMERS.find(x => x.id === custId); if (!c) return;
  const acctEl = document.getElementById('cri-acct');
  if (acctEl) acctEl.value = c.acctNumber;
  _crSetCustomer(c, c.acctNumber);
  const sug = document.getElementById('cri-suggestions');
  if (sug) sug.style.display = 'none';
}

function _crSetCustomer(cust, acctNumber) {
  _crSelectedCustomer = cust;
  const fee    = SETTINGS.cardFee || 30;
  const nameEl = document.getElementById('cri-name');
  const fbEl   = document.getElementById('cri-fb');
  const balEl  = document.getElementById('cri-balance-display');

  if (nameEl) nameEl.value = `${cust.firstName} ${cust.lastName}`;
  if (fbEl)   fbEl.innerHTML = `<span style="color:var(--success)">✅ ${cust.acctNumber}</span>`;

  if (balEl) {
    const after  = (cust.balance || 0) - fee;
    const color  = after < 0 ? 'var(--danger)' : 'var(--success)';
    balEl.innerHTML = `
      <div style="padding:10px 14px;background:var(--surface2);border:1px solid var(--border);
        border-radius:var(--radius);font-size:.8rem;margin-bottom:14px">
        <div class="flex-between mb-1">
          <span class="text-muted">Current Balance</span>
          <span class="mono fw-600">${fmt(cust.balance || 0)}</span>
        </div>
        <div class="flex-between mb-1">
          <span class="text-muted">Card Fee</span>
          <span class="mono" style="color:var(--danger)">− ${fmt(fee)}</span>
        </div>
        <div class="flex-between" style="border-top:1px solid var(--border);padding-top:6px;margin-top:4px">
          <span class="fw-600">Balance After</span>
          <span class="mono fw-600" style="color:${color}">${fmt(after)}</span>
        </div>
        ${after < 0 ? `<div style="color:var(--danger);font-size:.74rem;margin-top:5px">
          ⚠️ Insufficient balance — fee exceeds current balance</div>` : ''}
      </div>`;
  }
}

// ── Process replacement ───────────────────────────────
function processCardReplacement() {
  if (!_crSelectedCustomer) return toast('Look up a customer account first', 'error');

  const fee    = SETTINGS.cardFee || 30;
  const date   = document.getElementById('cri-date')?.value;
  const reason = document.getElementById('cri-reason')?.value;
  const by     = (document.getElementById('cri-by')?.value    || '').trim();
  const notes  = (document.getElementById('cri-notes')?.value || '').trim();

  if (!date)   return toast('Select the date of replacement', 'error');
  if (!by)     return toast('Enter the name of the staff processing this', 'error');

  const c = _crSelectedCustomer;

  showConfirm(
    '💳 Process Card Replacement?',
    `Replace card for <strong>${c.firstName} ${c.lastName}</strong>
     (${c.acctNumber})?<br>
     Fee of <strong class="text-danger">${fmt(fee)}</strong> will be deducted from their account.
     <br><span class="text-muted" style="font-size:.78rem">
       Reason: ${reason} &nbsp;·&nbsp; Date: ${fmtDate(date)}
     </span>`,
    () => {
      const prevBal = c.balance || 0;
      const newBal  = prevBal - fee;

      // 4. Deduct fee from balance
      c.balance = Math.round(newBal * 100) / 100;

      // 5. Add "Lost Card Replaced" to customer transactions
      if (!c.transactions) c.transactions = [];
      const reasonLabel = {
        lost: 'Card Lost', damaged: 'Card Damaged',
        expired: 'Card Expired', other: 'Other',
      }[reason] || reason;

      c.transactions.push({
        id      : uid(),
        type    : 'card_replacement',
        desc    : `${reasonLabel} — Card Replaced`,
        amount  : fee,
        balance : c.balance,
        date    : date,
        time    : new Date().toISOString(),
        by      : by,
        notes   : notes,
      });

      // Save to CARD_REPLACEMENTS history
      if (!CARD_REPLACEMENTS) window.CARD_REPLACEMENTS = [];
      CARD_REPLACEMENTS.unshift({
        id         : uid(),
        customerId : c.id,
        acctNumber : c.acctNumber,
        name       : `${c.firstName} ${c.lastName}`,
        agentId    : c.agentId,
        agentCode  : c.agentCode,
        reason, reasonLabel,
        fee,
        date,
        by,
        notes,
        balanceBefore: prevBal,
        balanceAfter : c.balance,
        processedAt  : new Date().toISOString(),
      });

      saveAll();
      logActivity('Card',
        `${reasonLabel} replaced for ${c.firstName} ${c.lastName} (${c.acctNumber}) — fee ${fmt(fee)} deducted`,
        fee, 'replaced');

      // SMS notification if enabled
      if (typeof sendSMS === 'function') {
        sendSMS(c, 'card_replacement', { fee, reason: reasonLabel, date, balance: c.balance });
      }

      // Reset form
      _crSelectedCustomer = null;
      const acctEl = document.getElementById('cri-acct');
      if (acctEl) acctEl.value = '';
      document.getElementById('cri-agent').value = '';
      _crClearLookup();
      const dateEl = document.getElementById('cri-date');
      if (dateEl) dateEl.value = todayISO();
      document.getElementById('cri-notes').value = '';

      renderCardHistory();
      toast(`Card replaced for ${c.firstName} ${c.lastName} — ${fmt(fee)} deducted ✅`, 'success');
    }
  );
}

// ── Render history table ──────────────────────────────
function renderCardHistory() {
  const tb = document.getElementById('card-replace-tbody'); if (!tb) return;
  if (!CARD_REPLACEMENTS?.length) {
    tb.innerHTML = `<tr><td colspan="6" class="text-center text-muted"
      style="padding:24px">No replacements yet</td></tr>`;
    return;
  }
  tb.innerHTML = CARD_REPLACEMENTS.slice(0, 50).map(r => `
    <tr>
      <td style="font-size:.78rem;white-space:nowrap">${fmtDate(r.date)}</td>
      <td class="mono text-gold" style="font-size:.78rem">${r.acctNumber}</td>
      <td style="font-size:.84rem">${r.name}</td>
      <td>
        <span class="badge ${
          r.reason==='lost'   ? 'b-red'  :
          r.reason==='damaged'? 'b-yellow':
          r.reason==='expired'? 'b-blue'  : 'b-gray'
        }">${r.reasonLabel || r.reason}</span>
      </td>
      <td class="mono fw-600" style="color:var(--danger)">− ${fmt(r.fee)}</td>
      <td style="font-size:.78rem">${r.by}</td>
    </tr>`).join('');
}

// ── showView trigger ──────────────────────────────────
// Called from general.js showView when cards tab is clicked
function onCardsViewOpen() {
  initCardReplacement();
}
