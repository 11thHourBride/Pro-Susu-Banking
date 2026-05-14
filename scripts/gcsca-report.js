// ═══════════════════════════════════════════════════════
//  GCSCA REPORT MODULE — Pro Susu Banking
//  Ghana Cooperative Susu Collectors Association
//  Generates the standard quarterly/annual returns
//  required for submission to GCSCA.
// ═══════════════════════════════════════════════════════

// ── Dormant helpers (self-contained fallback) ─────────
// Uses customers.js isDormant if loaded, otherwise defines own version
function _gcscaIsDormant(customer) {
  if (typeof isDormant === 'function') return isDormant(customer);
  // Inline fallback — no activity for 3+ months
  if (customer.status !== 'active') return false;
  const txns = (customer.transactions || [])
    .filter(t => t.type === 'deposit' || t.type === 'withdrawal' || t.type === 'entry')
    .map(t => t.date || t.time?.slice(0, 10) || '')
    .filter(Boolean).sort().reverse();
  const last    = txns[0] || customer.dateCreated;
  if (!last) return false;
  const cutoff  = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  return new Date(last) < cutoff;
}

// ── State ─────────────────────────────────────────────
let GCSCA_STATE = {
  period  : 'quarterly',
  quarter : '',        // e.g. 'Q1-2026'
  year    : '',        // e.g. '2026'
  fromDate: '',
  toDate  : '',
  template: null,      // imported template fields (optional)
  overrides: {},       // user-edited values
};

// ── Render ─────────────────────────────────────────────
function renderGCSCAReport() {
  const el = document.getElementById('rpt-gcsca-content'); if (!el) return;

  // Set default period
  const now = new Date();
  const qNum = Math.ceil((now.getMonth() + 1) / 3);
  if (!GCSCA_STATE.year) GCSCA_STATE.year = String(now.getFullYear());
  if (!GCSCA_STATE.quarter) GCSCA_STATE.quarter = `Q${qNum}-${now.getFullYear()}`;

  el.innerHTML = `
    <div style="max-width:900px">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;
        flex-wrap:wrap;gap:12px;margin-bottom:24px">
        <div>
          <div class="fw-600" style="font-size:1rem">🏛️ GCSCA Statistical Returns</div>
          <div class="text-muted" style="font-size:.78rem;margin-top:3px">
            Ghana Cooperative Susu Collectors Association &mdash;
            Periodic Returns Submission
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="gcscaImportTemplate()">
            📂 Import GCSCA Template
          </button>
          <button class="btn btn-outline btn-sm" onclick="gcscaPrint()">
            🖨️ Print / PDF
          </button>
          <button class="btn btn-gold btn-sm" onclick="gcscaExportCSV()">
            📥 Export CSV
          </button>
        </div>
      </div>

      <!-- Period selector -->
      <div class="card mb-4">
        <div class="card-title"><span>📅</span> Reporting Period</div>
        <div class="form-row" style="align-items:flex-end">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Report Type</label>
            <select class="form-control" id="gcsca-period-type"
              onchange="gcscaPeriodChange()">
              <option value="quarterly" ${GCSCA_STATE.period==='quarterly'?'selected':''}>Quarterly Returns</option>
              <option value="annual"    ${GCSCA_STATE.period==='annual'   ?'selected':''}>Annual Returns</option>
              <option value="monthly"   ${GCSCA_STATE.period==='monthly'  ?'selected':''}>Monthly Returns</option>
              <option value="custom"    ${GCSCA_STATE.period==='custom'   ?'selected':''}>Custom Period</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0" id="gcsca-quarter-wrap">
            <label class="form-label">Quarter</label>
            <select class="form-control" id="gcsca-quarter" onchange="gcscaPeriodChange()">
              ${[1,2,3,4].map(q => {
                const yr = now.getFullYear();
                const val = `Q${q}-${yr}`;
                return `<option value="${val}" ${GCSCA_STATE.quarter===val?'selected':''}>${val}</option>`;
              }).join('')}
              ${[1,2,3,4].map(q => {
                const yr = now.getFullYear()-1;
                const val = `Q${q}-${yr}`;
                return `<option value="${val}" ${GCSCA_STATE.quarter===val?'selected':''}>${val}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0" id="gcsca-year-wrap"
            style="display:none">
            <label class="form-label">Year</label>
            <select class="form-control" id="gcsca-year" onchange="gcscaPeriodChange()">
              ${[0,1,2].map(i => {
                const yr = now.getFullYear() - i;
                return `<option value="${yr}" ${GCSCA_STATE.year===String(yr)?'selected':''}>${yr}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;display:none" id="gcsca-custom-wrap">
            <label class="form-label">From</label>
            <input type="date" class="form-control" id="gcsca-from"
              value="${GCSCA_STATE.fromDate}" onchange="gcscaPeriodChange()">
          </div>
          <div class="form-group" style="margin-bottom:0;display:none" id="gcsca-custom-to">
            <label class="form-label">To</label>
            <input type="date" class="form-control" id="gcsca-to"
              value="${GCSCA_STATE.toDate}" onchange="gcscaPeriodChange()">
          </div>
          <button class="btn btn-gold btn-sm" onclick="renderGCSCAReport()"
            style="margin-bottom:0">
            ↻ Generate
          </button>
        </div>
        ${GCSCA_STATE.template ? `
          <div class="alert alert-success" style="margin-top:10px;font-size:.78rem">
            ✅ GCSCA template loaded — fields will be mapped automatically.
            <button class="btn btn-ghost btn-xs" onclick="GCSCA_STATE.template=null;renderGCSCAReport()">✕ Remove</button>
          </div>` : ''}
      </div>

      <!-- The report itself -->
      <div id="gcsca-report-body">
        ${_buildGCSCABody()}
      </div>

      <!-- Template import instruction -->
      ${!GCSCA_STATE.template ? `
        <div class="alert alert-info" style="margin-top:16px;font-size:.78rem;line-height:1.7">
          💡 <strong>Using the Official GCSCA Template?</strong>
          Click <em>Import GCSCA Template</em> above to upload the official CSV/Excel template.
          The system will auto-map all available data into the required fields.
          You can then edit any values before exporting.
        </div>` : ''}
    </div>`;

  gcscaPeriodChange(); // sync UI to current state
}

// ── Period change handler ─────────────────────────────
function gcscaPeriodChange() {
  const type = document.getElementById('gcsca-period-type')?.value || 'quarterly';
  GCSCA_STATE.period = type;

  const qWrap  = document.getElementById('gcsca-quarter-wrap');
  const yrWrap = document.getElementById('gcsca-year-wrap');
  const cusW1  = document.getElementById('gcsca-custom-wrap');
  const cusW2  = document.getElementById('gcsca-custom-to');

  if (qWrap)  qWrap.style.display  = type === 'quarterly' ? '' : 'none';
  if (yrWrap) yrWrap.style.display = (type === 'annual' || type === 'monthly') ? '' : 'none';
  if (cusW1)  cusW1.style.display  = type === 'custom' ? '' : 'none';
  if (cusW2)  cusW2.style.display  = type === 'custom' ? '' : 'none';

  if (type === 'quarterly') {
    GCSCA_STATE.quarter = document.getElementById('gcsca-quarter')?.value || GCSCA_STATE.quarter;
    const [q, yr] = GCSCA_STATE.quarter.split('-');
    const qn = parseInt(q.replace('Q',''));
    GCSCA_STATE.fromDate = `${yr}-${String((qn-1)*3+1).padStart(2,'0')}-01`;
    const endMonth = qn * 3;
    const endDay   = new Date(parseInt(yr), endMonth, 0).getDate();
    GCSCA_STATE.toDate = `${yr}-${String(endMonth).padStart(2,'0')}-${endDay}`;
  } else if (type === 'annual') {
    GCSCA_STATE.year     = document.getElementById('gcsca-year')?.value || GCSCA_STATE.year;
    GCSCA_STATE.fromDate = `${GCSCA_STATE.year}-01-01`;
    GCSCA_STATE.toDate   = `${GCSCA_STATE.year}-12-31`;
  } else if (type === 'monthly') {
    GCSCA_STATE.year     = document.getElementById('gcsca-year')?.value || GCSCA_STATE.year;
  } else {
    GCSCA_STATE.fromDate = document.getElementById('gcsca-from')?.value || GCSCA_STATE.fromDate;
    GCSCA_STATE.toDate   = document.getElementById('gcsca-to')?.value   || GCSCA_STATE.toDate;
  }
}

// ── Compute stats for period ──────────────────────────
function _gcscaStats() {
  const from = GCSCA_STATE.fromDate ? new Date(GCSCA_STATE.fromDate) : null;
  const to   = GCSCA_STATE.toDate   ? new Date(GCSCA_STATE.toDate + 'T23:59:59') : null;

  const inPeriod = date => {
    if (!date) return false;
    const d = new Date(date);
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  };

  // ── Customer counts ──
  const active   = CUSTOMERS.filter(c => c.status === 'active');
  const newMembers = CUSTOMERS.filter(c => inPeriod(c.dateCreated));
  const dormantC = CUSTOMERS.filter(_gcscaIsDormant);
  const susuC    = active.filter(c => c.type === 'susu');
  const lendingC = active.filter(c => c.type === 'lending');
  const savingsC = active.filter(c => c.type === 'savings');

  // ── Transactions in period ──
  let totalDeposits = 0, totalWithdrawals = 0, depositCount = 0, withdrawalCount = 0;
  CUSTOMERS.forEach(c => {
    (c.transactions || []).forEach(t => {
      if (!inPeriod(t.date)) return;
      if (t.type === 'deposit' || t.type === 'entry') {
        totalDeposits += t.amount || 0; depositCount++;
      }
      if (t.type === 'withdrawal') {
        totalWithdrawals += t.amount || 0; withdrawalCount++;
      }
    });
  });

  // ── Savings (total balances) ──
  const totalSavings     = active.reduce((s, c) => s + (c.balance || 0), 0);
  const susuSavings      = susuC.reduce((s, c) => s + (c.balance || 0), 0);
  const lendingSavings   = lendingC.reduce((s, c) => s + (c.balance || 0), 0);
  const accountSavings   = savingsC.reduce((s, c) => s + (c.balance || 0), 0);

  // ── Loans ──
  const activeLoans   = LOANS.filter(l => l.status === 'active');
  const newLoans      = LOANS.filter(l => inPeriod(l.startDate));
  const loansDisbursed= newLoans.reduce((s, l) => s + (l.amount || 0), 0);
  const loansOutstanding = activeLoans.reduce((l, loan) => {
    const paid = (loan.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    return l + Math.max(0, (loan.totalRepayment || 0) - paid);
  }, 0);
  const loansRecovered = LOANS.reduce((s, l) => {
    return s + (l.payments || [])
      .filter(p => inPeriod(p.date))
      .reduce((a, p) => a + (p.amount || 0), 0);
  }, 0);

  // ── Agents ──
  const activeAgents = AGENTS.filter(a => a.status === 'active');
  const agentStats   = activeAgents.map(a => {
    const custs = active.filter(c => c.agentId === a.id);
    const colls  = TELLER_STATE.collections
      .filter(c => c.agentId === a.id && inPeriod(c.collectionDate || c.time?.slice(0,10)));
    const amount = colls.reduce((s, c) => s + (c.amount || 0), 0);
    return { agent: a, customers: custs.length, collections: amount };
  });

  // ── Float / Operations ──
  const totalFloat = TELLER_STATE.startOfDay || 0;

  return {
    // Period
    fromDate: GCSCA_STATE.fromDate, toDate: GCSCA_STATE.toDate,
    // Members
    totalMembers: active.length, newMembers: newMembers.length,
    dormantMembers: dormantC.length,
    susuMembers: susuC.length, lendingMembers: lendingC.length, savingsMembers: savingsC.length,
    // Financial
    totalSavings, susuSavings, lendingSavings, accountSavings,
    totalDeposits, depositCount, totalWithdrawals, withdrawalCount,
    netChange: totalDeposits - totalWithdrawals,
    // Loans
    activeLoans: activeLoans.length, newLoans: newLoans.length,
    loansDisbursed, loansOutstanding, loansRecovered,
    // Operations
    activeAgents: activeAgents.length, totalFloat, agentStats,
    // Company
    company: SETTINGS.companyName || '',
    address: SETTINGS.companyAddress || '',
    phone  : SETTINGS.companyPhone   || '',
    email  : SETTINGS.companyEmail   || '',
  };
}

// ── Build the report HTML ─────────────────────────────
function _buildGCSCABody() {
  const s = _gcscaStats();
  const period = GCSCA_STATE.period === 'quarterly' ? GCSCA_STATE.quarter
    : GCSCA_STATE.period === 'annual' ? `Year ${GCSCA_STATE.year}`
    : `${fmtDate(GCSCA_STATE.fromDate)} — ${fmtDate(GCSCA_STATE.toDate)}`;

  const ov = v => `<span contenteditable="true" class="gcsca-editable"
    style="outline:none;border-bottom:1px dashed var(--gold);padding:0 2px;min-width:10px"
    >${v}</span>`;

  return `
  <!-- Printable report area -->
  <div id="gcsca-printable" style="font-size:.84rem">

    <!-- Report header -->
    <div style="text-align:center;padding:20px;background:var(--surface2);
      border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px">
      <div style="font-family:'Playfair Display',serif;font-size:1.4rem;
        font-weight:700;color:var(--gold);margin-bottom:4px">
        GHANA COOPERATIVE SUSU COLLECTORS ASSOCIATION
      </div>
      <div style="font-size:.9rem;font-weight:700;margin-bottom:4px">
        GCSCA STATISTICAL RETURNS — ${period}
      </div>
      <div style="font-size:.78rem;color:var(--muted)">
        Section 28 &amp; 29, Cooperative Societies Decree 1968 (NLCD 252)<br>
        Submitted by: <strong>${s.company}</strong>
      </div>
    </div>

    <!-- SECTION A: Particulars of the Association -->
    <div class="card mb-3">
      <div class="card-title" style="color:var(--gold)"><span>🏛️</span> SECTION A — Particulars of Association</div>
      <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        ${_gcscaRow('A1', 'Name of Association',        s.company)}
        ${_gcscaRow('A2', 'Address',                    s.address || '—')}
        ${_gcscaRow('A3', 'Phone / Contact',             s.phone   || '—')}
        ${_gcscaRow('A4', 'Email Address',              s.email   || '—')}
        ${_gcscaRow('A5', 'Registration Number',        SETTINGS.regNumber || '—', true)}
        ${_gcscaRow('A6', 'Reporting Period',           period)}
        ${_gcscaRow('A7', 'Date of Submission',         fmtDate(todayISO()))}
        ${_gcscaRow('A8', 'Name of Reporting Officer',  SETTINGS.reportingOfficer || currentUser?.name || '—', true)}
        ${_gcscaRow('A9', 'Designation',                SETTINGS.reportingDesig   || 'Administrator', true)}
      </table>
    </div>

    <!-- SECTION B: Membership Statistics -->
    <div class="card mb-3">
      <div class="card-title" style="color:var(--gold)"><span>👥</span> SECTION B — Membership Statistics</div>
      <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead>
          <tr style="background:var(--surface2)">
            <th style="padding:8px 12px;text-align:left;width:40px">No.</th>
            <th style="padding:8px 12px;text-align:left">Description</th>
            <th style="padding:8px 12px;text-align:right;width:140px">Number</th>
          </tr>
        </thead>
        <tbody>
          ${_gcscaDataRow('B1', 'Total Active Members at End of Period', s.totalMembers)}
          ${_gcscaDataRow('B2', 'New Members Enrolled During Period',    s.newMembers)}
          ${_gcscaDataRow('B3', 'Dormant Accounts (3+ months inactive)', s.dormantMembers)}
          ${_gcscaDataRow('B4', 'Susu (Daily) Account Holders',         s.susuMembers)}
          ${_gcscaDataRow('B5', 'Lending Deposit Account Holders',       s.lendingMembers)}
          ${_gcscaDataRow('B6', 'Savings Account Holders',              s.savingsMembers)}
          ${_gcscaDataRow('B7', 'Number of Active Agents/Collectors',   s.activeAgents)}
        </tbody>
      </table>
    </div>

    <!-- SECTION C: Savings & Deposits -->
    <div class="card mb-3">
      <div class="card-title" style="color:var(--gold)"><span>💰</span> SECTION C — Savings &amp; Deposit Statistics (GH₵)</div>
      <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead>
          <tr style="background:var(--surface2)">
            <th style="padding:8px 12px;text-align:left;width:40px">No.</th>
            <th style="padding:8px 12px;text-align:left">Description</th>
            <th style="padding:8px 12px;text-align:right;width:160px">Amount (GH₵)</th>
          </tr>
        </thead>
        <tbody>
          ${_gcscaDataRow('C1', 'Total Savings/Deposits at End of Period', s.totalSavings, true)}
          ${_gcscaDataRow('C2', '  — Susu (Daily) Savings',               s.susuSavings, true)}
          ${_gcscaDataRow('C3', '  — Lending Deposit Savings',            s.lendingSavings, true)}
          ${_gcscaDataRow('C4', '  — Regular Savings Accounts',           s.accountSavings, true)}
          ${_gcscaDataRow('C5', 'Total Collections Received During Period', s.totalDeposits, true)}
          ${_gcscaDataRow('C6', 'Number of Collection Transactions',       s.depositCount)}
          ${_gcscaDataRow('C7', 'Total Withdrawals Paid During Period',    s.totalWithdrawals, true)}
          ${_gcscaDataRow('C8', 'Number of Withdrawal Transactions',       s.withdrawalCount)}
          ${_gcscaDataRow('C9', 'Net Change in Savings (Collections − Withdrawals)', s.netChange, true, s.netChange < 0)}
        </tbody>
      </table>
    </div>

    <!-- SECTION D: Loans -->
    <div class="card mb-3">
      <div class="card-title" style="color:var(--gold)"><span>📋</span> SECTION D — Loan Portfolio (GH₵)</div>
      <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead>
          <tr style="background:var(--surface2)">
            <th style="padding:8px 12px;text-align:left;width:40px">No.</th>
            <th style="padding:8px 12px;text-align:left">Description</th>
            <th style="padding:8px 12px;text-align:right;width:160px">Value</th>
          </tr>
        </thead>
        <tbody>
          ${_gcscaDataRow('D1', 'Number of Active Loans at End of Period',  s.activeLoans)}
          ${_gcscaDataRow('D2', 'Number of New Loans Granted During Period', s.newLoans)}
          ${_gcscaDataRow('D3', 'Total Amount Disbursed During Period',      s.loansDisbursed, true)}
          ${_gcscaDataRow('D4', 'Total Outstanding Loan Balance',            s.loansOutstanding, true)}
          ${_gcscaDataRow('D5', 'Total Loan Repayments Received During Period', s.loansRecovered, true)}
          ${_gcscaDataRow('D6', 'Loans in Default / NPL (> 90 days overdue)',
            LOANS.filter(l => l.status === 'active' &&
              new Date(l.endDate) < new Date(Date.now() - 90*86400000)).length)}
        </tbody>
      </table>
    </div>

    <!-- SECTION E: Agent Performance -->
    <div class="card mb-3">
      <div class="card-title" style="color:var(--gold)"><span>🧑‍💼</span> SECTION E — Agent / Collector Performance</div>
      ${s.agentStats.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr style="background:var(--surface2)">
                <th>Agent Code</th>
                <th>Agent Name</th>
                <th style="text-align:right">Customers</th>
                <th style="text-align:right">Collections (GH₵)</th>
              </tr>
            </thead>
            <tbody>
              ${s.agentStats.map((ag, i) => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td class="agent-code" style="font-size:.78rem">${ag.agent.code}</td>
                  <td style="font-size:.84rem">${ag.agent.firstName} ${ag.agent.lastName}</td>
                  <td style="text-align:right;font-size:.82rem">${ag.customers}</td>
                  <td style="text-align:right" class="mono fw-600 text-gold">${fmt(ag.collections)}</td>
                </tr>`).join('')}
              <tr style="background:var(--surface2);font-weight:700">
                <td colspan="2">TOTAL</td>
                <td style="text-align:right">${s.agentStats.reduce((a,x)=>a+x.customers,0)}</td>
                <td style="text-align:right" class="mono text-gold">
                  ${fmt(s.agentStats.reduce((a,x)=>a+x.collections,0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>` :
        '<div class="text-muted" style="padding:12px;font-size:.8rem">No agents registered.</div>'}
    </div>

    <!-- SECTION F: Declaration -->
    <div class="card mb-3">
      <div class="card-title" style="color:var(--gold)"><span>✍️</span> SECTION F — Declaration</div>
      <div style="font-size:.82rem;line-height:1.8;padding:8px 0">
        I hereby declare that the information provided in this return is true and correct
        to the best of my knowledge and belief, and that it has been prepared in accordance
        with the records of <strong>${s.company}</strong>.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px">
        <div>
          <div style="font-size:.76rem;color:var(--muted);margin-bottom:4px">Name of Authorised Officer</div>
          <div style="border-bottom:1px solid var(--border);padding-bottom:4px;font-size:.84rem">
            ${currentUser?.name || '____________________________'}
          </div>
        </div>
        <div>
          <div style="font-size:.76rem;color:var(--muted);margin-bottom:4px">Designation</div>
          <div style="border-bottom:1px solid var(--border);padding-bottom:4px;font-size:.84rem">
            ${currentUser?.role || '____________________________'}
          </div>
        </div>
        <div>
          <div style="font-size:.76rem;color:var(--muted);margin-bottom:4px">Signature</div>
          <div style="border-bottom:1px solid var(--border);padding-bottom:24px"></div>
        </div>
        <div>
          <div style="font-size:.76rem;color:var(--muted);margin-bottom:4px">Date</div>
          <div style="border-bottom:1px solid var(--border);padding-bottom:4px;font-size:.84rem">
            ${fmtDate(todayISO())}
          </div>
        </div>
      </div>
      <div style="margin-top:16px;padding:10px 14px;background:rgba(201,168,76,.08);
        border:1px solid rgba(201,168,76,.2);border-radius:8px;font-size:.76rem;color:var(--muted)">
        📨 Submit completed returns to: <strong>GCSCA National Secretariat</strong>
        &nbsp;·&nbsp; Deadline: 30 days after the end of each reporting period
      </div>
    </div>

  </div>`;  // end gcsca-printable
}

// ── Table row helpers ─────────────────────────────────
function _gcscaRow(num, label, value, editable = false) {
  const val = editable
    ? `<span contenteditable="true" style="outline:none;border-bottom:1px dashed var(--gold);
         padding:0 2px;min-width:40px;display:inline-block">${value}</span>`
    : value;
  return `<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:7px 12px;color:var(--muted);font-size:.76rem;width:40px">${num}</td>
    <td style="padding:7px 12px">${label}</td>
    <td style="padding:7px 12px;font-weight:600">${val}</td>
  </tr>`;
}

function _gcscaDataRow(num, label, value, isMoney = false, isDanger = false) {
  const display = isMoney ? fmt(Math.abs(value)) : value.toLocaleString();
  const color   = isDanger ? 'var(--danger)' : isMoney ? 'var(--gold)' : '';
  return `<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:7px 12px;color:var(--muted);font-size:.76rem;width:40px">${num}</td>
    <td style="padding:7px 12px">${label}</td>
    <td style="padding:7px 12px;text-align:right;font-family:'JetBrains Mono',monospace;
      font-weight:700;color:${color}">
      ${isDanger ? '(' + display + ')' : display}
    </td>
  </tr>`;
}

// ── Print / PDF ───────────────────────────────────────
function gcscaPrint() {
  const content = document.getElementById('gcsca-printable');
  if (!content) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html>
<html><head><title>GCSCA Report — ${SETTINGS.companyName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',Arial,sans-serif;font-size:11pt;color:#111;padding:20mm}
  h1,h2,h3{font-family:Georgia,serif}
  table{width:100%;border-collapse:collapse;margin-bottom:12pt}
  th,td{padding:5pt 8pt;border:1px solid #ccc;text-align:left;font-size:10pt}
  thead th{background:#f0ede6;font-weight:700}
  .card{border:1px solid #ccc;border-radius:4pt;padding:10pt;margin-bottom:12pt}
  .card-title{font-weight:700;font-size:11pt;margin-bottom:8pt;color:#8b6914}
  .text-right{text-align:right}
  .fw-700{font-weight:700}
  .agent-code{font-family:monospace;font-size:.9em;background:#f5f5f5;padding:1px 4px;border-radius:2px}
  @media print{body{padding:10mm}}
</style></head><body>
${content.innerHTML}
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── Export CSV ────────────────────────────────────────
function gcscaExportCSV() {
  const s      = _gcscaStats();
  const period = GCSCA_STATE.period === 'quarterly' ? GCSCA_STATE.quarter
    : GCSCA_STATE.period === 'annual' ? `Year ${GCSCA_STATE.year}`
    : `${GCSCA_STATE.fromDate}_${GCSCA_STATE.toDate}`;

  const rows = [
    ['GCSCA STATISTICAL RETURNS'],
    ['Association', s.company],
    ['Period', period],
    ['Date Generated', todayISO()],
    [],
    ['SECTION B — MEMBERSHIP'],
    ['Description', 'Value'],
    ['Total Active Members',         s.totalMembers],
    ['New Members During Period',     s.newMembers],
    ['Dormant Accounts',             s.dormantMembers],
    ['Susu Account Holders',         s.susuMembers],
    ['Lending Deposit Holders',      s.lendingMembers],
    ['Savings Account Holders',      s.savingsMembers],
    ['Active Agents/Collectors',     s.activeAgents],
    [],
    ['SECTION C — SAVINGS & DEPOSITS (GH₵)'],
    ['Description', 'Amount'],
    ['Total Savings at End of Period',      s.totalSavings.toFixed(2)],
    ['  Susu Savings',                      s.susuSavings.toFixed(2)],
    ['  Lending Deposit Savings',           s.lendingSavings.toFixed(2)],
    ['  Regular Savings',                   s.accountSavings.toFixed(2)],
    ['Total Collections Received',          s.totalDeposits.toFixed(2)],
    ['Number of Collection Transactions',   s.depositCount],
    ['Total Withdrawals Paid',              s.totalWithdrawals.toFixed(2)],
    ['Number of Withdrawal Transactions',   s.withdrawalCount],
    ['Net Change in Savings',               s.netChange.toFixed(2)],
    [],
    ['SECTION D — LOANS (GH₵)'],
    ['Description', 'Value'],
    ['Active Loans at End of Period',       s.activeLoans],
    ['New Loans Granted',                   s.newLoans],
    ['Total Disbursed During Period',       s.loansDisbursed.toFixed(2)],
    ['Outstanding Loan Balance',            s.loansOutstanding.toFixed(2)],
    ['Loan Repayments Received',            s.loansRecovered.toFixed(2)],
    [],
    ['SECTION E — AGENT PERFORMANCE'],
    ['Agent Code', 'Agent Name', 'Customers', 'Collections (GH₵)'],
    ...s.agentStats.map(ag => [
      ag.agent.code,
      `${ag.agent.firstName} ${ag.agent.lastName}`,
      ag.customers,
      ag.collections.toFixed(2),
    ]),
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `GCSCA_Report_${s.company.replace(/\s+/g,'_')}_${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('GCSCA report exported as CSV ✅', 'success');
  logActivity('Report', `GCSCA Report exported — ${period}`, 0, 'export');
}

// ── Import GCSCA template ─────────────────────────────
function gcscaImportTemplate() {
  // Create hidden file input
  const inp = document.createElement('input');
  inp.type  = 'file';
  inp.accept= '.csv,.xlsx,.xls';
  inp.style.display = 'none';
  inp.onchange = function() {
    const file = this.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const text   = e.target.result;
        const lines  = text.replace(/\r/g,'').split('\n').filter(l=>l.trim());
        // Parse as key-value pairs or structured template
        const fields = {};
        lines.forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const key = parts[0].replace(/"/g,'').trim();
            const val = parts[1].replace(/"/g,'').trim();
            if (key) fields[key] = val;
          }
        });
        GCSCA_STATE.template = fields;
        renderGCSCAReport();
        toast('GCSCA template loaded ✅ — fields mapped from file', 'success');
      } catch(err) {
        toast('Could not parse template file — ensure it is a valid CSV', 'error');
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(inp);
  inp.click();
  document.body.removeChild(inp);
}
