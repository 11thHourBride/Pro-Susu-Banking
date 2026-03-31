// ═══════════════════════════════════════════════════════
//  LOANS
// ═══════════════════════════════════════════════════════

let loanSelectedCustomer = null;
let activeLoanPayId      = null;

// ── Helpers ──────────────────────────────────────────
function calcLoanInterest(amount, months) {
  const rate = SETTINGS.loanRate || 0.25;
  const base = SETTINGS.loanBase || 6;
  return (amount * rate / base) * months;
}

function generateSchedule(startDate, months, monthlyPayment) {
  const schedule = [];
  for (let i = 1; i <= months; i++) {
    schedule.push({
      month      : i,
      dueDate    : addMonths(startDate, i),
      amount     : monthlyPayment,
      paid       : false
    });
  }
  return schedule;
}

function isOverdue(dueDateStr) {
  return new Date(dueDateStr) < new Date(todayISO());
}

function calcPenalties(loan) {
  if (!loan.schedule) return 0;
  const today    = new Date(todayISO());
  const instRate = (SETTINGS.instantPenalty  ?? 1) / 100;
  const monRate  = (SETTINGS.monthlyPenalty  ?? 1) / 100;
  let penalty    = 0;

  loan.schedule.forEach(slot => {
    if (slot.paid || slot.waived) return;
    const due = new Date(slot.dueDate);
    if (due >= today) return;
    const remaining = loan.totalRepayment -
      loan.payments.reduce((s, p) => s + p.amount, 0);
    if (remaining <= 0) return;
    if (!slot.instantPenaltyApplied) penalty += remaining * instRate;
    const monthsOverdue = Math.max(0,
      Math.floor((today - due) / (30 * 86400000)));
    penalty += remaining * monRate * monthsOverdue;
  });

  return Math.round(penalty * 100) / 100;
}

function validateLendingDeposit(customer, loanAmount) {
  const pct     = (SETTINGS.loanDepositPct ?? 30) / 100;
  const required = loanAmount * pct;
  const ldAcct  = CUSTOMERS.find(c =>
    c.type === 'lending' &&
    c.agentId === customer.agentId &&
    (c.firstName + c.lastName) === (customer.firstName + customer.lastName) &&
    c.status === 'active'
  ) || CUSTOMERS.find(c =>
    c.type === 'lending' && c.id === customer.lendingAcctId
  );
  return { ldAcct, required, met: ldAcct && (ldAcct.balance || 0) >= required };
}

// ── Populate agent selector on Loans view ────────────
// Called both from showView('loans') and on the lni-agent init
function populateLoanAgentSelector() {
  const el = document.getElementById('lni-agent'); if (!el) return;
  const val = el.value;
  el.innerHTML = '<option value="">-- Select Agent --</option>'
    + AGENTS.map(a =>
        `<option value="${a.id}">${a.firstName} ${a.lastName} (${a.code})</option>`
      ).join('');
  el.value = val;
}

// ── FIX 1: populateLoanCustomers — runs when agent is picked ─
function populateLoanCustomers() {
  // Just re-prime the search hint — actual search is typed by user
  const agentId = document.getElementById('lni-agent')?.value;
  const search  = document.getElementById('lni-cust-search');
  const results = document.getElementById('lni-cust-results');
  const selected = document.getElementById('lni-cust-selected');

  // Reset customer selection when agent changes
  loanSelectedCustomer = null;
  if (search)   { search.value = ''; }
  if (results)  results.classList.add('hidden');
  if (selected) selected.classList.add('hidden');

  // Update search placeholder
  if (search) {
    const agent = AGENTS.find(a => a.id === agentId);
    search.placeholder = agent
      ? `Search customers under ${agent.firstName} ${agent.lastName}...`
      : 'Type account no. or customer name...';
  }

  calcLoanPreview();
}

// ── Loan calculator preview ──────────────────────────
function calcLoanPreview() {
  const amount = parseFloat(document.getElementById('lni-amount')?.value) || 0;
  const months = parseInt(document.getElementById('lni-duration')?.value) || 0;
  const el     = document.getElementById('loan-calc-display'); if (!el) return;

  if (!amount || !months) {
    el.innerHTML = `<div class="empty-state" style="padding:24px 0">
      <div class="ei">🧮</div><div class="et">Enter loan details</div>
      <div class="es">Preview will appear here</div>
    </div>`;
    return;
  }

  const interest  = calcLoanInterest(amount, months);
  const total     = amount + interest;
  const monthly   = total / months;
  const depPct    = SETTINGS.loanDepositPct ?? 30;
  const depReq    = amount * depPct / 100;

  let depCheck = '';
  if (loanSelectedCustomer) {
    const { ldAcct, required, met } = validateLendingDeposit(loanSelectedCustomer, amount);
    depCheck = `
      <hr class="divider" style="margin:10px 0">
      <div style="padding:9px 12px;border-radius:var(--radius-sm);font-size:.8rem;
        background:${met ? 'rgba(46,204,138,.08)' : 'rgba(232,93,93,.08)'};
        border:1px solid ${met ? 'rgba(46,204,138,.2)' : 'rgba(232,93,93,.2)'}">
        <div class="fw-600" style="color:${met ? 'var(--success)' : 'var(--danger)'}">
          ${met ? '✅' : '❌'} Lending Deposit Requirement
        </div>
        <div style="margin-top:4px;color:var(--text2);font-size:.78rem">
          Required: <strong>${fmt(required)}</strong> (${depPct}% of loan) ·
          ${ldAcct
            ? `Acct: <span class="mono">${ldAcct.acctNumber}</span> · Bal: <strong>${fmt(ldAcct.balance || 0)}</strong>`
            : '<span style="color:var(--danger)">No lending deposit account found</span>'}
        </div>
        ${!met && ldAcct
          ? `<div style="color:var(--danger);font-size:.74rem;margin-top:4px">
               Shortfall: ${fmt(required - (ldAcct.balance || 0))}
             </div>` : ''}
      </div>`;
  } else {
    depCheck = `
      <hr class="divider" style="margin:10px 0">
      <div style="font-size:.77rem;color:var(--muted);padding:6px 0">
        💡 Lending deposit required: <strong>${fmt(depReq)}</strong>
        (${depPct}% of loan amount)
      </div>`;
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:9px">
      <div class="flex-between">
        <span class="text-muted" style="font-size:.83rem">Principal</span>
        <span class="mono text-gold">${fmt(amount)}</span>
      </div>
      <div class="flex-between">
        <span class="text-muted" style="font-size:.83rem">
          Interest (${((SETTINGS.loanRate || 0.25) * 100).toFixed(0)}% over ${months}m)
        </span>
        <span class="mono text-warning">${fmt(interest)}</span>
      </div>
      <hr class="divider" style="margin:2px 0">
      <div class="flex-between">
        <span class="fw-600">Total Repayment</span>
        <span class="mono fw-600 text-success">${fmt(total)}</span>
      </div>
      <div class="flex-between">
        <span class="text-muted" style="font-size:.83rem">Monthly Payment</span>
        <span class="mono text-info">${fmt(monthly)}</span>
      </div>
      <div class="flex-between">
        <span class="text-muted" style="font-size:.83rem">Duration</span>
        <span class="fw-600">${months} months</span>
      </div>
      ${depCheck}
    </div>`;

  calcLoanEndDate();
}

function calcLoanEndDate() {
  const start  = document.getElementById('lni-start')?.value;
  const months = parseInt(document.getElementById('lni-duration')?.value) || 0;
  const endEl  = document.getElementById('lni-end'); if (!endEl) return;
  if (start && months) endEl.value = addMonths(start, months);
}

// ── Customer search ──────────────────────────────────
function loanCustSearch(val) {
  const results = document.getElementById('lni-cust-results'); if (!results) return;
  if (!val || val.length < 2) { results.classList.add('hidden'); return; }

  const agentId = document.getElementById('lni-agent')?.value;
  let matches   = CUSTOMERS.filter(c =>
    `${c.firstName} ${c.lastName} ${c.acctNumber}`
      .toLowerCase().includes(val.toLowerCase())
  );
  // Filter by selected agent if one is chosen
  if (agentId) matches = matches.filter(c => c.agentId === agentId);
  matches = matches.slice(0, 8);

  if (!matches.length) { results.classList.add('hidden'); return; }
  results.classList.remove('hidden');
  results.innerHTML = matches.map(c => `
    <div onclick="selectLoanCustomer('${c.id}')"
      style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);
             font-size:.83rem;transition:background .15s"
      onmouseover="this.style.background='var(--gold-dim)'"
      onmouseout="this.style.background=''">
      <div class="fw-600">${c.firstName} ${c.lastName}</div>
      <div class="text-muted" style="font-size:.73rem">
        ${c.acctNumber} · ${c.type} · Balance: ${fmt(c.balance || 0)}
      </div>
    </div>`).join('');
}

function selectLoanCustomer(id) {
  const c = CUSTOMERS.find(x => x.id === id); if (!c) return;
  loanSelectedCustomer = c;
  const sel = document.getElementById('lni-cust-selected');
  const res = document.getElementById('lni-cust-results');
  const inp = document.getElementById('lni-cust-search');
  if (sel) {
    sel.classList.remove('hidden');
    sel.innerHTML = `✅ <strong>${c.firstName} ${c.lastName}</strong> —
      <span class="mono">${c.acctNumber}</span> · Balance: ${fmt(c.balance || 0)}`;
  }
  if (res) res.classList.add('hidden');
  if (inp) inp.value = `${c.firstName} ${c.lastName} (${c.acctNumber})`;
  calcLoanPreview();
}

// ── Create Loan ──────────────────────────────────────
function createLoan() {
  if (!loanSelectedCustomer) return toast('Search and select a customer', 'error');
  const amount  = parseFloat(document.getElementById('lni-amount').value);
  const months  = parseInt(document.getElementById('lni-duration').value);
  const start   = document.getElementById('lni-start').value;
  const purpose = document.getElementById('lni-purpose').value.trim();
  const gname   = document.getElementById('lni-gname').value.trim();
  const gphone  = document.getElementById('lni-gphone').value.trim();

  if (!amount || amount <= 0) return toast('Enter loan amount', 'error');
  if (!months || months < 1)  return toast('Enter duration', 'error');
  if (!start)                 return toast('Select start date', 'error');

  // Lending deposit check
  const { ldAcct, required, met } = validateLendingDeposit(loanSelectedCustomer, amount);
  if (!met) {
    return toast(
      ldAcct
        ? `Lending deposit balance (${fmt(ldAcct.balance || 0)}) is below the required ${fmt(required)}`
        : 'Customer has no active Lending Deposit account',
      'error'
    );
  }

  // Lock the required deposit
  ldAcct.lockedAmount = (ldAcct.lockedAmount || 0) + required;
  if (!ldAcct.transactions) ldAcct.transactions = [];
  ldAcct.transactions.push({
    id: uid(), type: 'lock',
    desc: 'Deposit locked as loan collateral',
    amount: required, balance: ldAcct.balance,
    date: start, time: new Date().toISOString(),
    by: currentUser?.name || 'System'
  });

  const interest       = calcLoanInterest(amount, months);
  const totalRepayment = amount + interest;
  const monthlyPayment = totalRepayment / months;
  const endDate        = addMonths(start, months);
  const loanNum        = 'LN' + pad4(LOANS.length + 1);
  const agent          = AGENTS.find(a => a.id === loanSelectedCustomer.agentId);
  const schedule       = generateSchedule(start, months, monthlyPayment);

  const loan = {
    id: uid(), loanNum,
    customerId   : loanSelectedCustomer.id,
    customerName : `${loanSelectedCustomer.firstName} ${loanSelectedCustomer.lastName}`,
    acctNumber   : loanSelectedCustomer.acctNumber,
    agentId      : agent?.id || '',
    agentName    : agent ? `${agent.firstName} ${agent.lastName}` : '—',
    amount, interest, totalRepayment, monthlyPayment, months,
    startDate    : start, endDate, purpose,
    guarantorName: gname, guarantorPhone: gphone,
    ldAcctId     : ldAcct.id,
    lockedAmount : required,
    status       : 'active',
    payments     : [],
    penalties    : [],
    schedule,
    dateCreated  : todayISO()
  };
  LOANS.push(loan);

  // Reset form
  ['lni-amount','lni-duration','lni-start','lni-end',
   'lni-purpose','lni-gname','lni-gphone'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  loanSelectedCustomer = null;
  const sel = document.getElementById('lni-cust-selected');
  if (sel) { sel.classList.add('hidden'); sel.innerHTML = ''; }
  const inp = document.getElementById('lni-cust-search');
  if (inp) inp.value = '';
  const calc = document.getElementById('loan-calc-display');
  if (calc) calc.innerHTML = `<div class="empty-state" style="padding:24px 0">
    <div class="ei">🧮</div><div class="et">Enter loan details</div></div>`;

  updateLoanStats();
  logActivity('Loan', `Created ${loanNum} for ${loan.customerName}`, amount, 'active');
  saveAll();
  toast(`Loan ${loanNum} created — ${fmt(totalRepayment)} total repayment ✅`, 'success');

  // FIX 3: navigate directly to Active Loans tab without fragile querySelector
  const activeBtn = document.querySelector(
    '#view-loans .sub-tab[onclick*="\'active\'"]'
  );
  if (activeBtn) {
    showSubTab('ln', 'active', activeBtn);
    renderLoansTab('active');
  }
}

// ── Stats ────────────────────────────────────────────
function updateLoanStats() {
  const active      = LOANS.filter(l => l.status === 'active');
  const completed   = LOANS.filter(l => l.status === 'completed');
  const overdue     = active.filter(l => new Date(l.endDate) < new Date());
  const outstanding = active.reduce((s, l) =>
    s + (l.totalRepayment - l.payments.reduce((a, p) => a + p.amount, 0)), 0);
  const recovered   = completed.reduce((s, l) =>
    s + l.payments.reduce((a, p) => a + p.amount, 0), 0);
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('ln-stat-active', active.length);
  setTxt('ln-active-s',    fmt(outstanding) + ' outstanding');
  setTxt('ln-done',     completed.length);
  setTxt('ln-done-s',   fmt(recovered) + ' recovered');
  setTxt('ln-total',    fmt(LOANS.reduce((s, l) => s + l.amount, 0)));
  setTxt('ln-overdue',  overdue.length);

  // Show Export/Import tab for admin only
  const expTab = document.getElementById('ln-exportimport-tab');
  if (expTab) expTab.style.display = (currentUser?.role === 'admin') ? '' : 'none';
}

// ── Render loans tab ─────────────────────────────────
// FIX 2: all styling uses inline styles — no undefined CSS classes
function renderLoansTab(tab) {

  if (tab === 'active') {
    const el    = document.getElementById('active-loans-list');
    const loans = LOANS.filter(l => l.status === 'active');

    if (!loans.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="ei">💼</div>
        <div class="et">No Active Loans</div>
        <div class="es">Create a loan to see it here</div>
      </div>`;
      return;
    }

    el.innerHTML = loans.map(l => {
      const paid      = l.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = l.totalRepayment - paid;
      const pct       = Math.min(100, Math.round((paid / l.totalRepayment) * 100));
      const penalty   = calcPenalties(l);
      const overdue   = new Date(l.endDate) < new Date();
      const nextSlot  = l.schedule?.find(s => !s.paid && !s.waived);
      const barColor  = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';

      return `
        <div onclick="openLoanDetail('${l.id}')"
          style="background:var(--surface);border:1px solid var(--border);
            border-radius:var(--radius);padding:16px;margin-bottom:12px;
            cursor:pointer;transition:transform .2s,box-shadow .2s"
          onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.2)'"
          onmouseout="this.style.transform='';this.style.boxShadow=''">

          <!-- Header -->
          <div class="flex-between" style="margin-bottom:10px">
            <div>
              <div class="fw-600" style="font-size:.92rem">
                ${l.customerName}
                ${overdue
                  ? `<span class="badge b-red" style="font-size:.6rem;margin-left:6px">OVERDUE</span>`
                  : ''}
              </div>
              <div class="text-muted" style="font-size:.74rem;margin-top:2px">
                ${l.acctNumber} · ${l.agentName} ·
                <span class="mono text-gold">${l.loanNum}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div class="mono fw-600 text-gold" style="font-size:1.05rem">
                ${fmt(l.amount)}
              </div>
              <div style="font-size:.7rem;color:var(--muted)">
                ${l.months}m · ${fmt(l.monthlyPayment)}/mo
              </div>
            </div>
          </div>

          <!-- Balance row -->
          <div class="flex-between" style="font-size:.79rem;margin-bottom:8px">
            <span class="text-muted">Paid:
              <span class="mono text-success fw-600">${fmt(paid)}</span>
            </span>
            <span class="text-muted">Remaining:
              <span class="mono text-danger fw-600">${fmt(remaining)}</span>
            </span>
            <div style="width:36px;height:36px;border-radius:50%;
              border:2px solid ${barColor};display:flex;align-items:center;
              justify-content:center;font-size:.65rem;font-weight:700;
              color:${barColor}">
              ${pct}%
            </div>
          </div>

          <!-- Progress bar -->
          <div class="progress-wrap" style="margin-bottom:8px">
            <div class="progress-bar" style="width:${pct}%;background:${barColor}"></div>
          </div>

          <!-- Footer info -->
          <div class="flex-between" style="font-size:.72rem;color:var(--muted)">
            <span>${l.payments.length}/${l.months} payments</span>
            ${nextSlot
              ? `<span>Next due:
                   <strong style="color:${isOverdue(nextSlot.dueDate)
                     ? 'var(--danger)' : 'var(--gold)'}">
                     ${fmtDate(nextSlot.dueDate)}
                   </strong>
                 </span>`
              : '<span>All slots paid</span>'}
            <span>Ends: ${fmtDate(l.endDate)}</span>
          </div>

          ${penalty > 0 ? `
            <div style="margin-top:9px;padding:6px 11px;background:rgba(232,93,93,.1);
              border:1px solid rgba(232,93,93,.2);border-radius:var(--radius-sm);
              font-size:.75rem;color:var(--danger)">
              ⚠️ Accrued Penalty: <strong>${fmt(penalty)}</strong>
            </div>` : ''}

          <!-- Action buttons -->
          <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap"
            onclick="event.stopPropagation()">
            <button class="btn btn-gold btn-xs"
              onclick="openLoanPayment('${l.id}')">💳 Pay</button>
            <button class="btn btn-outline btn-xs"
              onclick="openLoanSchedule('${l.id}')">📅 Schedule</button>
            <button class="btn btn-outline btn-xs"
              onclick="openLoanEdit('${l.id}')">✏️ Edit</button>
            ${penalty > 0
              ? `<button class="btn btn-outline btn-xs" style="color:var(--warning);border-color:rgba(240,165,0,.3)"
                   onclick="openWaiverModal('${l.id}')">🛡️ Waive Penalty</button>`
              : ''}
            <button class="btn btn-danger btn-xs"
              onclick="deleteLoan('${l.id}')">🗑</button>
          </div>
        </div>`;
    }).join('');

  } else if (tab === 'completed') {
    const el    = document.getElementById('completed-loans-list');
    const loans = LOANS.filter(l => l.status === 'completed');

    if (!loans.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="ei">✅</div><div class="et">No Completed Loans</div>
      </div>`;
      return;
    }

    el.innerHTML = loans.map(l => {
      const paid = l.payments.reduce((s, p) => s + p.amount, 0);
      return `
        <div style="background:var(--surface);border:1px solid var(--border);
          border-radius:var(--radius);padding:14px 16px;margin-bottom:10px">
          <div class="flex-between">
            <div>
              <div class="fw-600">${l.customerName}</div>
              <div class="text-muted" style="font-size:.74rem;margin-top:2px">
                ${l.acctNumber} · <span class="mono text-gold">${l.loanNum}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div class="mono fw-600 text-gold">${fmt(l.amount)}</div>
              <span class="badge b-green">Completed</span>
            </div>
          </div>
          <div class="flex-between mt-2" style="font-size:.78rem;color:var(--muted)">
            <span>Total repaid: <span class="mono text-success">${fmt(paid)}</span></span>
            <span>${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px"
            onclick="event.stopPropagation()">
            <button class="btn btn-outline btn-xs"
              onclick="openLoanDetail('${l.id}')">📋 Details</button>
            <button class="btn btn-outline btn-xs"
              onclick="openLoanSchedule('${l.id}')">📅 Schedule</button>
            <button class="btn btn-danger btn-xs"
              onclick="deleteLoan('${l.id}')">🗑</button>
          </div>
        </div>`;
    }).join('');

  } else {
    // All loans table
    const tb = document.getElementById('all-loans-tbody');
    if (!LOANS.length) {
      tb.innerHTML = `<tr><td colspan="10" class="text-center text-muted"
        style="padding:24px">No loans yet</td></tr>`;
      return;
    }
    tb.innerHTML = LOANS.map(l => {
      const paid = l.payments.reduce((s, p) => s + p.amount, 0);
      const od   = l.status === 'active' && new Date(l.endDate) < new Date();
      return `<tr>
        <td class="mono text-gold" style="font-size:.78rem">${l.loanNum}</td>
        <td>${l.customerName}</td>
        <td>${l.agentName}</td>
        <td class="mono">${fmt(l.amount)}</td>
        <td class="text-center">${l.months}m</td>
        <td class="mono">${fmt(l.monthlyPayment)}</td>
        <td style="font-size:.78rem">${fmtDate(l.startDate)}</td>
        <td style="font-size:.78rem">${fmtDate(l.endDate)}</td>
        <td><span class="badge ${od ? 'b-red' : l.status === 'active' ? 'b-blue' : 'b-green'}">
          ${od ? 'Overdue' : l.status}
        </span></td>
        <td style="white-space:nowrap">
          <button class="btn btn-gold btn-xs"
            onclick="openLoanDetail('${l.id}')">View</button>
          ${l.status === 'active'
            ? `<button class="btn btn-outline btn-xs"
                 onclick="openLoanPayment('${l.id}')">💳 Pay</button>` : ''}
          <button class="btn btn-outline btn-xs"
            onclick="openLoanEdit('${l.id}')">✏️</button>
          <button class="btn btn-danger btn-xs"
            onclick="deleteLoan('${l.id}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }
}

// ── Loan Detail Modal ────────────────────────────────
function openLoanDetail(id) {
  const l = LOANS.find(x => x.id === id); if (!l) return;
  const paid      = l.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = l.totalRepayment - paid;
  const pct       = Math.min(100, Math.round((paid / l.totalRepayment) * 100));
  const penalty   = calcPenalties(l);
  const ldAcct    = CUSTOMERS.find(c => c.id === l.ldAcctId);

  document.getElementById('m-loan-title').textContent =
    `${l.loanNum} — ${l.customerName}`;

  document.getElementById('m-loan-body').innerHTML = `
    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));
      gap:10px;margin-bottom:16px">
      <div class="stat-card gold card-sm"><div class="stat-label">Principal</div>
        <div class="stat-value" style="font-size:.95rem">${fmt(l.amount)}</div></div>
      <div class="stat-card blue card-sm"><div class="stat-label">Total Repayment</div>
        <div class="stat-value" style="font-size:.95rem">${fmt(l.totalRepayment)}</div></div>
      <div class="stat-card green card-sm"><div class="stat-label">Paid</div>
        <div class="stat-value" style="font-size:.95rem">${fmt(paid)}</div></div>
      <div class="stat-card red card-sm"><div class="stat-label">Remaining</div>
        <div class="stat-value" style="font-size:.95rem">${fmt(remaining)}</div></div>
    </div>

    <!-- Progress -->
    <div style="margin-bottom:16px">
      <div class="flex-between" style="margin-bottom:6px">
        <span class="fw-600">Payment Progress</span>
        <span class="mono text-gold fw-600">${pct}%</span>
      </div>
      <div class="progress-wrap" style="height:8px">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="flex-between" style="font-size:.72rem;color:var(--muted);margin-top:4px">
        <span>${l.payments.length} payments made</span>
        <span>${l.months - l.payments.length} remaining</span>
      </div>
    </div>

    ${penalty > 0 ? `
      <div style="padding:10px 14px;background:rgba(232,93,93,.1);
        border:1px solid rgba(232,93,93,.25);border-radius:var(--radius-sm);
        margin-bottom:14px">
        <div class="fw-600 text-danger">⚠️ Accrued Penalty: ${fmt(penalty)}</div>
        <div style="font-size:.74rem;color:var(--muted);margin-top:3px">
          Instant (${SETTINGS.instantPenalty ?? 1}%) +
          Monthly (${SETTINGS.monthlyPenalty ?? 1}%/mo)
        </div>
        <button class="btn btn-outline btn-xs" style="margin-top:8px;color:var(--warning);border-color:rgba(240,165,0,.3)"
          onclick="openWaiverModal('${l.id}')">🛡️ Waive Penalty</button>
      </div>` : ''}

    <!-- Details -->
    <div class="grid-2" style="margin-bottom:16px">
      <div><div class="text-muted" style="font-size:.7rem">CUSTOMER</div>
        <div class="fw-600">${l.customerName} (${l.acctNumber})</div></div>
      <div><div class="text-muted" style="font-size:.7rem">AGENT</div>
        <div>${l.agentName}</div></div>
      <div><div class="text-muted" style="font-size:.7rem">PURPOSE</div>
        <div>${l.purpose || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.7rem">MONTHLY PAYMENT</div>
        <div class="mono text-gold">${fmt(l.monthlyPayment)}</div></div>
      <div><div class="text-muted" style="font-size:.7rem">START DATE</div>
        <div>${fmtDate(l.startDate)}</div></div>
      <div><div class="text-muted" style="font-size:.7rem">END DATE</div>
        <div>${fmtDate(l.endDate)}</div></div>
      <div><div class="text-muted" style="font-size:.7rem">GUARANTOR</div>
        <div>${l.guarantorName || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.7rem">GUARANTOR PHONE</div>
        <div>${l.guarantorPhone || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.7rem">LENDING DEPOSIT ACCT</div>
        <div class="mono text-gold" style="font-size:.82rem">
          ${ldAcct
            ? ldAcct.acctNumber + ' (Locked: ' + fmt(l.lockedAmount || 0) + ')'
            : '—'}
        </div></div>
    </div>

    <!-- Payment history -->
    <div class="card-title" style="margin-bottom:8px"><span>💳</span> Payment History</div>
    ${l.payments.length
      ? `<div class="table-wrap" style="max-height:220px;overflow-y:auto">
           <table>
             <thead>
               <tr><th>#</th><th>Date</th><th>Amount</th>
                 <th>Type</th><th>Balance After</th><th>By</th></tr>
             </thead>
             <tbody>
               ${l.payments.map((p, i) => `<tr>
                 <td class="text-muted">${i + 1}</td>
                 <td style="font-size:.78rem">${fmtDate(p.date)}</td>
                 <td class="mono text-success">${fmt(p.amount)}</td>
                 <td><span class="badge ${p.isPenalty ? 'b-red' : 'b-green'}" style="font-size:.62rem">
                   ${p.isPenalty ? 'Penalty' : 'Payment'}
                 </span></td>
                 <td class="mono">${fmt(p.balanceAfter)}</td>
                 <td style="font-size:.72rem;color:var(--muted)">${p.by || '—'}</td>
               </tr>`).join('')}
             </tbody>
           </table>
         </div>`
      : `<div class="empty-state" style="padding:16px 0">
           <div class="et">No payments recorded yet</div>
         </div>`}

    <!-- Actions -->
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      ${l.status === 'active'
        ? `<button class="btn btn-gold"
             onclick="openLoanPayment('${l.id}');closeModal('modal-loan-detail')">
             💳 Record Payment
           </button>` : ''}
      <button class="btn btn-outline"
        onclick="openLoanSchedule('${l.id}');closeModal('modal-loan-detail')">
        📅 View Schedule
      </button>
      <button class="btn btn-outline"
        onclick="openLoanEdit('${l.id}');closeModal('modal-loan-detail')">
        ✏️ Edit Loan
      </button>
    </div>`;

  openModal('modal-loan-detail');
}

// ── Payment Schedule Modal ───────────────────────────
function openLoanSchedule(id) {
  const l = LOANS.find(x => x.id === id); if (!l) return;
  let runBalance = l.totalRepayment;

  document.getElementById('m-loan-title').textContent =
    `📅 Payment Schedule — ${l.loanNum}`;

  const schedRows = (l.schedule || generateSchedule(
    l.startDate, l.months, l.monthlyPayment
  )).map((slot, i) => {
    const pmtForSlot = l.payments[i];
    const isPaid     = !!pmtForSlot || slot.paid;
    const isWaived   = slot.waived;
    const od         = !isPaid && !isWaived && isOverdue(slot.dueDate);
    runBalance      -= isPaid ? (pmtForSlot?.amount || slot.amount) : 0;

    return `<tr style="${od ? 'background:rgba(232,93,93,.06)' : ''}">
      <td class="text-muted">${slot.month}</td>
      <td style="font-size:.8rem;${od ? 'color:var(--danger);font-weight:600' : ''}">
        ${fmtDate(slot.dueDate)}
        ${od ? '<span class="badge b-red" style="font-size:.58rem;margin-left:4px">OVERDUE</span>' : ''}
      </td>
      <td class="mono">${fmt(slot.amount)}</td>
      <td class="mono ${isPaid ? 'text-success' : od ? 'text-danger' : 'text-muted'}">
        ${isPaid ? fmt(pmtForSlot?.amount || slot.amount) : '—'}
      </td>
      <td>
        ${isWaived
          ? `<span class="badge b-blue"   style="font-size:.62rem">Waived</span>`
          : isPaid
            ? `<span class="badge b-green" style="font-size:.62rem">✅ Paid</span>`
            : od
              ? `<span class="badge b-red"    style="font-size:.62rem">Overdue</span>`
              : `<span class="badge b-yellow" style="font-size:.62rem">Pending</span>`}
      </td>
      <td class="mono" style="font-size:.78rem">
        ${isPaid ? fmt(Math.max(0, runBalance)) : '—'}
      </td>
    </tr>`;
  }).join('');

  document.getElementById('m-loan-body').innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div style="padding:8px 14px;background:var(--gold-dim);
        border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.8rem">
        <span class="text-muted">Loan: </span>
        <span class="mono text-gold fw-600">${l.loanNum}</span>
      </div>
      <div style="padding:8px 14px;background:var(--surface2);
        border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.8rem">
        <span class="text-muted">Monthly: </span>
        <span class="mono fw-600">${fmt(l.monthlyPayment)}</span>
      </div>
      <div style="padding:8px 14px;background:var(--surface2);
        border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.8rem">
        <span class="text-muted">Paid: </span>
        <span class="mono text-success fw-600">${l.payments.length}/${l.months}</span>
      </div>
    </div>
    <div class="table-wrap" style="max-height:420px;overflow-y:auto">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Due Date</th><th>Amount Due</th>
            <th>Amount Paid</th><th>Status</th><th>Balance After</th>
          </tr>
        </thead>
        <tbody>${schedRows}</tbody>
      </table>
    </div>
    <div style="margin-top:14px">
      <button class="btn btn-ghost btn-sm no-print"
        onclick="window.print()">🖨️ Print Schedule</button>
    </div>`;

  openModal('modal-loan-detail');
}

// ── Record Loan Payment ──────────────────────────────
function openLoanPayment(id) {
  activeLoanPayId = id;
  const l = LOANS.find(x => x.id === id); if (!l) return;
  const paid      = l.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = l.totalRepayment - paid;
  const penalty   = calcPenalties(l);
  const nextSlot  = l.schedule?.find(s => !s.paid && !s.waived);

  document.getElementById('m-loan-pay-body').innerHTML = `
    <div style="background:var(--gold-dim);border:1px solid var(--border);
      border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;font-size:.83rem">
      <div class="fw-600">${l.customerName} — ${l.loanNum}</div>
      <div class="flex-between" style="margin-top:7px">
        <span class="text-muted">Monthly Payment</span>
        <span class="mono text-gold">${fmt(l.monthlyPayment)}</span>
      </div>
      <div class="flex-between" style="margin-top:4px">
        <span class="text-muted">Remaining Balance</span>
        <span class="mono text-danger">${fmt(remaining)}</span>
      </div>
      ${nextSlot ? `
        <div class="flex-between" style="margin-top:4px">
          <span class="text-muted">Next Due</span>
          <span class="mono ${isOverdue(nextSlot.dueDate) ? 'text-danger fw-600' : 'text-gold'}">
            ${fmtDate(nextSlot.dueDate)}
            ${isOverdue(nextSlot.dueDate) ? ' ⚠️' : ''}
          </span>
        </div>` : ''}
      ${penalty > 0 ? `
        <div class="flex-between" style="margin-top:4px">
          <span class="text-muted">Accrued Penalty</span>
          <span class="mono text-danger">+ ${fmt(penalty)}</span>
        </div>` : ''}
    </div>

    <div class="form-group">
      <label class="form-label">Payment Amount (GH₵)</label>
      <input type="number" class="form-control" id="lpay-amount"
        value="${l.monthlyPayment.toFixed(2)}" min="0" step="0.01">
    </div>
    <div class="form-group">
      <label class="form-label">Payment Date</label>
      <input type="date" class="form-control" id="lpay-date" value="${todayISO()}">
    </div>
    ${penalty > 0 ? `
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.83rem">
          <input type="checkbox" id="lpay-incl-penalty" style="width:16px;height:16px">
          Include penalty payment (${fmt(penalty)})
        </label>
      </div>` : ''}
    <div class="form-group">
      <label class="form-label">Notes</label>
      <input type="text" class="form-control" id="lpay-notes" placeholder="Optional">
    </div>`;

  openModal('modal-loan-pay');
}

function confirmLoanPayment() {
  const l = LOANS.find(x => x.id === activeLoanPayId); if (!l) return;
  const amount   = parseFloat(document.getElementById('lpay-amount').value);
  const date     = document.getElementById('lpay-date').value;
  const notes    = document.getElementById('lpay-notes')?.value.trim() || '';
  const inclPen  = document.getElementById('lpay-incl-penalty')?.checked;

  if (!amount || amount <= 0) return toast('Enter valid amount', 'error');
  if (!date)                  return toast('Select payment date', 'error');

  const prevPaid     = l.payments.reduce((s, p) => s + p.amount, 0);
  const balanceAfter = Math.max(0, l.totalRepayment - prevPaid - amount);

  const nextSlot = l.schedule?.find(s => !s.paid && !s.waived);
  if (nextSlot) {
    nextSlot.paid      = true;
    nextSlot.paidDate  = date;
    nextSlot.paidAmt   = amount;
    nextSlot.instantPenaltyApplied = true;
  }

  l.payments.push({
    id: uid(), amount, date, balanceAfter,
    isPenalty: false, notes,
    by: currentUser?.name || 'System'
  });

  if (inclPen) {
    const penalty = calcPenalties(l);
    if (penalty > 0) {
      l.payments.push({
        id: uid(), amount: penalty, date,
        balanceAfter: Math.max(0, balanceAfter - penalty),
        isPenalty: true, notes: 'Penalty payment',
        by: currentUser?.name || 'System'
      });
      l.schedule?.forEach(s => { s.instantPenaltyApplied = true; });
    }
  }

  const totalPaid = l.payments.reduce((s, p) => s + p.amount, 0);
  if (totalPaid >= l.totalRepayment) {
    l.status      = 'completed';
    l.completedAt = new Date().toISOString();
    // Release lending deposit lock
    const ldAcct = CUSTOMERS.find(c => c.id === l.ldAcctId);
    if (ldAcct) {
      ldAcct.lockedAmount = Math.max(0, (ldAcct.lockedAmount || 0) - (l.lockedAmount || 0));
      if (!ldAcct.transactions) ldAcct.transactions = [];
      ldAcct.transactions.push({
        id: uid(), type: 'unlock',
        desc: `Collateral released — Loan ${l.loanNum} completed`,
        amount: l.lockedAmount || 0,
        balance: ldAcct.balance,
        date, time: new Date().toISOString(),
        by: currentUser?.name || 'System'
      });
    }
    toast(`🎉 Loan ${l.loanNum} fully repaid! Collateral released.`, 'success');
  } else {
    toast(`${fmt(amount)} payment recorded for ${l.loanNum} ✅`, 'success');
  }

  updateLoanStats();
  logActivity('Loan Payment',
    `${l.customerName} paid ${fmt(amount)} on ${l.loanNum}`, amount, 'paid');
  saveAll();
  closeModal('modal-loan-pay');
  renderLoansTab('active');
}

// ── Edit Loan ────────────────────────────────────────
function openLoanEdit(id) {
  const l = LOANS.find(x => x.id === id); if (!l) return;
  document.getElementById('m-loan-edit-title').textContent = `✏️ Edit Loan — ${l.loanNum}`;

  document.getElementById('m-loan-edit-body').innerHTML = `
    <div style="background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.2);
      border-radius:var(--radius-sm);padding:9px 13px;margin-bottom:14px;
      font-size:.78rem;color:var(--warning)">
      ⚠️ Editing will regenerate the payment schedule. Payments already made are preserved.
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Loan Amount (GH₵)</label>
        <input type="number" class="form-control" id="le-amount"
          value="${l.amount}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Duration (months)</label>
        <input type="number" class="form-control" id="le-months"
          value="${l.months}" min="1">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="date" class="form-control" id="le-start" value="${l.startDate}">
      </div>
      <div class="form-group">
        <label class="form-label">Purpose</label>
        <input type="text" class="form-control" id="le-purpose" value="${l.purpose || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Guarantor Name</label>
        <input type="text" class="form-control" id="le-gname" value="${l.guarantorName || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Guarantor Phone</label>
        <input type="text" class="form-control" id="le-gphone" value="${l.guarantorPhone || ''}">
      </div>
    </div>
    <div style="display:flex;gap:9px;justify-content:flex-end;
      padding-top:14px;border-top:1px solid var(--border)">
      <button class="btn btn-outline" onclick="closeModal('modal-loan-edit')">Cancel</button>
      <button class="btn btn-gold" onclick="saveLoanEdit('${l.id}')">✅ Save Changes</button>
    </div>`;

  openModal('modal-loan-edit');
}

function saveLoanEdit(id) {
  const l = LOANS.find(x => x.id === id); if (!l) return;
  const amount  = parseFloat(document.getElementById('le-amount')?.value)  || l.amount;
  const months  = parseInt(document.getElementById('le-months')?.value)    || l.months;
  const start   = document.getElementById('le-start')?.value               || l.startDate;
  const purpose = document.getElementById('le-purpose')?.value.trim()      || '';
  const gname   = document.getElementById('le-gname')?.value.trim()        || '';
  const gphone  = document.getElementById('le-gphone')?.value.trim()       || '';

  const interest        = calcLoanInterest(amount, months);
  const totalRepayment  = amount + interest;
  const monthlyPayment  = totalRepayment / months;
  const endDate         = addMonths(start, months);
  const oldSchedule     = l.schedule || [];

  l.amount         = amount;
  l.months         = months;
  l.startDate      = start;
  l.endDate        = endDate;
  l.interest       = interest;
  l.totalRepayment = totalRepayment;
  l.monthlyPayment = monthlyPayment;
  l.purpose        = purpose;
  l.guarantorName  = gname;
  l.guarantorPhone = gphone;
  l.schedule       = generateSchedule(start, months, monthlyPayment).map((slot, i) => {
    const old = oldSchedule[i];
    if (old?.paid) return { ...slot, paid: old.paid, paidDate: old.paidDate, paidAmt: old.paidAmt };
    return slot;
  });

  logActivity('Loan', `Edited loan ${l.loanNum}`, amount, 'edited');
  saveAll();
  closeModal('modal-loan-edit');
  updateLoanStats();
  renderLoansTab('active');
  toast(`Loan ${l.loanNum} updated successfully ✅`, 'success');
}

// ── Delete Loan ──────────────────────────────────────
function deleteLoan(id) {
  const l = LOANS.find(x => x.id === id); if (!l) return;
  showConfirm(
    'Delete Loan?',
    `Permanently delete loan <strong>${l.loanNum}</strong> for
     <strong>${l.customerName}</strong>?
     The lending deposit collateral lock will also be released.`,
    () => {
      const ldAcct = CUSTOMERS.find(c => c.id === l.ldAcctId);
      if (ldAcct && l.lockedAmount) {
        ldAcct.lockedAmount = Math.max(0, (ldAcct.lockedAmount || 0) - l.lockedAmount);
      }
      LOANS = LOANS.filter(x => x.id !== id);
      updateLoanStats();
      renderLoansTab('active');
      logActivity('Loan', `Deleted loan ${l.loanNum}`, l.amount, 'deleted');
      saveAll();
      toast(`Loan ${l.loanNum} deleted`, 'warning');
    }
  );
}

// ── Waive Penalty ────────────────────────────────────
function openWaiverModal(loanId) {
  const l = LOANS.find(x => x.id === loanId); if (!l) return;
  const penalty = calcPenalties(l);

  document.getElementById('m-waiver-body').innerHTML = `
    <div style="padding:10px 14px;background:rgba(232,93,93,.08);
      border:1px solid rgba(232,93,93,.2);border-radius:var(--radius-sm);
      margin-bottom:14px;font-size:.83rem">
      <div class="fw-600 text-danger">Accrued Penalty: ${fmt(penalty)}</div>
      <div class="text-muted" style="margin-top:3px;font-size:.76rem">
        ${l.loanNum} — ${l.customerName}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Reason for Waiver <span class="req">*</span></label>
      <input type="text" class="form-control" id="waiver-reason"
        placeholder="e.g. Hospitalisation, family emergency, valid documentation">
    </div>
    <div class="form-group">
      <label class="form-label">Waiver Type</label>
      <select class="form-control" id="waiver-type"
        onchange="document.getElementById('waiver-partial-wrap').style.display=
          this.value==='partial'?'block':'none'">
        <option value="full">Full Waiver — Remove entire penalty</option>
        <option value="partial">Partial Waiver — Reduce penalty amount</option>
      </select>
    </div>
    <div id="waiver-partial-wrap" style="display:none">
      <div class="form-group">
        <label class="form-label">Reduced Penalty Amount (GH₵)</label>
        <input type="number" class="form-control" id="waiver-partial-amt"
          placeholder="0.00" min="0" step="0.01" max="${penalty}">
      </div>
    </div>
    <div style="display:flex;gap:9px;justify-content:flex-end;
      padding-top:14px;border-top:1px solid var(--border)">
      <button class="btn btn-outline" onclick="closeModal('modal-waiver')">Cancel</button>
      <button class="btn btn-gold"
        onclick="confirmWaiver('${loanId}', ${penalty})">🛡️ Confirm Waiver</button>
    </div>`;

  closeModal('modal-loan-detail');
  openModal('modal-waiver');
}

function confirmWaiver(loanId, penalty) {
  const l      = LOANS.find(x => x.id === loanId); if (!l) return;
  const reason = document.getElementById('waiver-reason')?.value.trim();
  const type   = document.getElementById('waiver-type')?.value;
  if (!reason) return toast('Enter a reason for the waiver', 'error');

  l.schedule?.forEach(slot => {
    if (!slot.paid && isOverdue(slot.dueDate)) {
      slot.waived                = type === 'full';
      slot.waiverReason          = reason;
      slot.waivedBy              = currentUser?.name || 'System';
      slot.waivedAt              = new Date().toISOString();
      slot.instantPenaltyApplied = true;
    }
  });

  if (type === 'partial') {
    const reducedAmt = parseFloat(document.getElementById('waiver-partial-amt')?.value) || 0;
    l.waiverNote = `Partial waiver: ${fmt(reducedAmt)} of ${fmt(penalty)} waived. ${reason}`;
  } else {
    l.waiverNote = `Full waiver applied. ${reason}`;
  }

  logActivity('Loan', `Penalty waived on ${l.loanNum} — ${reason}`, penalty, 'waived');
  saveAll();
  closeModal('modal-waiver');
  renderLoansTab('active');
  toast(`Penalty waiver applied to ${l.loanNum} ✅`, 'success');
}

// ═══════════════════════════════════════════════════════
//  EXPORT / IMPORT — LOANS (Admin only)
// ═══════════════════════════════════════════════════════

function renderLoanExportImport() {
  const el = document.getElementById('ln-exportimport-content'); if (!el) return;
  if (currentUser?.role !== 'admin') {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🔒</div><div class="et">Admin Only</div></div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px">

      <!-- EXPORT -->
      <div class="card">
        <div class="card-title"><span>📤</span> Export Loans</div>
        <div class="text-muted" style="font-size:.8rem;margin-bottom:14px;line-height:1.6">
          Downloads all loans with key details as a CSV file.
          Includes: loan number, customer, account, agent, amount, interest,
          total repayment, monthly payment, duration, start/end dates,
          total paid, balance remaining, and status.
        </div>
        <div class="form-group">
          <label class="form-label">Filter by Status (optional)</label>
          <select class="form-control" id="exp-loan-status">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <button class="btn btn-gold" onclick="exportLoansCSV()">📥 Download CSV</button>
      </div>

      <!-- EXPORT SCHEDULE -->
      <div class="card">
        <div class="card-title"><span>📅</span> Export Loan Schedules</div>
        <div class="text-muted" style="font-size:.8rem;margin-bottom:14px;line-height:1.6">
          Downloads the full repayment schedule for all active loans — each
          installment on its own row with due date, amount, and payment status.
        </div>
        <div style="flex:1"></div>
        <button class="btn btn-gold" onclick="exportLoanSchedulesCSV()">📥 Download Schedules CSV</button>
      </div>
    </div>`;

  // Show tab
  const tab = document.getElementById('ln-exportimport-tab');
  if (tab) tab.style.display = '';
}

function exportLoansCSV() {
  const statusFilter = document.getElementById('exp-loan-status')?.value || '';
  let list = statusFilter ? LOANS.filter(l => l.status === statusFilter) : LOANS;
  if (!list.length) return toast('No loans to export', 'warning');

  const headers = [
    'Loan Number','Customer Name','Account Number','Agent Name',
    'Amount','Interest','Total Repayment','Monthly Payment',
    'Duration (months)','Start Date','End Date',
    'Total Paid','Balance Remaining','Status','Purpose'
  ];

  const rows = list.map(l => {
    const paid = (l.payments || []).reduce((s, p) => s + p.amount, 0);
    const bal  = l.totalRepayment - paid;
    return [
      l.loanNum || '',
      l.customerName || '',
      l.acctNumber || '',
      l.agentName || '',
      (l.amount || 0).toFixed(2),
      (l.interest || 0).toFixed(2),
      (l.totalRepayment || 0).toFixed(2),
      (l.monthlyPayment || 0).toFixed(2),
      l.months || '',
      l.startDate || '',
      l.endDate || '',
      paid.toFixed(2),
      bal.toFixed(2),
      l.status || '',
      l.purpose || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });

  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `loans_export_${todayISO()}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${list.length} loans ✅`, 'success');
  logActivity('Export', `Admin exported ${list.length} loan records`, 0, 'export');
}

function exportLoanSchedulesCSV() {
  const active = LOANS.filter(l => l.status === 'active');
  if (!active.length) return toast('No active loans to export', 'warning');

  const headers = [
    'Loan Number','Customer Name','Account Number',
    'Installment #','Due Date','Amount','Paid','Waived'
  ];

  const rows = [];
  active.forEach(l => {
    (l.schedule || []).forEach((s, i) => {
      rows.push([
        l.loanNum || '',
        l.customerName || '',
        l.acctNumber || '',
        i + 1,
        s.dueDate || '',
        (l.monthlyPayment || 0).toFixed(2),
        s.paid ? 'Yes' : 'No',
        s.waived ? 'Yes' : 'No',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`));
    });
  });

  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `loan_schedules_${todayISO()}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast(`Exported schedules for ${active.length} loans ✅`, 'success');
  logActivity('Export', `Admin exported loan schedules for ${active.length} loans`, 0, 'export');
}