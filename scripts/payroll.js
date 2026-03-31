// ═══════════════════════════════════════════════════════
//  PAYROLL MODULE  (Admin only)
// ═══════════════════════════════════════════════════════

const DEFAULT_AGENT_BASE   = 500;   // GH₵ — standard basic salary
const ABSENT_REDUCED_BASE  = 400;   // GH₵ — reduced if absent ≥10 consecutive days
const SSNIT_EMPLOYEE_RATE  = 0.055; // 5.5% of basic salary
const SSNIT_EMPLOYER_RATE  = 0.13;  // 13% (informational, not deducted from worker)
const ABSENCE_THRESHOLD    = 10;    // consecutive days to trigger base reduction

// ── Ghana PAYE bands (monthly, 2026) ─────────────────
function calcGhanaPAYE(chargeable) {
  if (!chargeable || chargeable <= 0) return 0;
  const bands = [
    { limit: 402,      rate: 0     },
    { limit: 110,      rate: 0.05  },
    { limit: 130,      rate: 0.10  },
    { limit: 3000,     rate: 0.175 },
    { limit: 16358,    rate: 0.25  },
    { limit: Infinity, rate: 0.35  }
  ];
  let tax = 0, remaining = chargeable;
  for (const b of bands) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, b.limit);
    tax += taxable * b.rate;
    remaining -= taxable;
  }
  return Math.round(tax * 100) / 100;
}

// ── Commission for an agent in a given month ──────────
function getAgentCommission(agentId, month) {
  return TELLER_STATE.collections
    .filter(c => c.agentId === agentId &&
      (c.collectionDate || '').slice(0, 7) === month)
    .reduce((s, c) => s + c.amount, 0) * ((SETTINGS.commissionRate || 1) / 100);
}

// ── Check consecutive absence in a month ─────────────
// Returns { absent: bool, maxConsecutive: number }
function checkAgentAbsence(agentId, month) {
  const colls = TELLER_STATE.collections.filter(c =>
    c.agentId === agentId &&
    (c.collectionDate || '').slice(0, 7) === month
  );
  const collDates = new Set(colls.map(c => c.collectionDate));

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  let maxConsecutive = 0, streak = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    // Skip Sundays (simple check — susu banking typically includes Saturdays)
    const dow = new Date(dateStr).getDay();
    if (dow === 0) { streak = 0; continue; } // reset on Sundays
    if (!collDates.has(dateStr)) {
      streak++;
      maxConsecutive = Math.max(maxConsecutive, streak);
    } else {
      streak = 0;
    }
  }
  return { absent: maxConsecutive >= ABSENCE_THRESHOLD, maxConsecutive };
}

// ── Teller shortage deduction for a month ────────────
function getTellerShortageDeduction(userId, month) {
  // Match teller close-of-day history by closedBy name
  const user = USERS.find(u => u.id === userId);
  if (!user) return 0;
  return TELLER_STATE.history
    .filter(r => r.date?.slice(0, 7) === month &&
                 r.diff < 0 &&
                 r.closedBy === user.name)
    .reduce((s, r) => s + Math.abs(r.diff), 0);
}

// ── Build one payroll entry per person ────────────────
function buildPayrollEntry(person, isAgent, month, overrides = {}) {
  // Salary base
  let baseSalary = 0;
  let commission = 0;
  let absenceInfo = { absent: false, maxConsecutive: 0 };

  if (isAgent) {
    const agentBaseSalary = person.basicSalary ?? DEFAULT_AGENT_BASE;
    absenceInfo = checkAgentAbsence(person.id, month);
    baseSalary  = absenceInfo.absent ? ABSENT_REDUCED_BASE : agentBaseSalary;
    commission  = Math.round(getAgentCommission(person.id, month) * 100) / 100;
  } else {
    // Non-agent staff — admin sets salary
    baseSalary = overrides.baseSalary || person.monthlySalary || 0;
  }

  // Gross before deductions (includes commission for agents)
  const grossEarnings = baseSalary + commission;

  // SSNIT (on basic only, not commission)
  const ssnitDeduction = Math.round(baseSalary * SSNIT_EMPLOYEE_RATE * 100) / 100;
  const ssnitEmployer  = Math.round(baseSalary * SSNIT_EMPLOYER_RATE * 100) / 100;

  // Chargeable income for tax = gross - SSNIT employee
  const chargeableIncome = Math.max(0, grossEarnings - ssnitDeduction);
  const taxDeduction     = calcGhanaPAYE(chargeableIncome);

  // Shortage deduction (tellers only)
  const shortageDeduction = person.role === 'teller'
    ? getTellerShortageDeduction(person.id, month) : 0;

  // Other deductions (overrideable by admin)
  const otherDeduction = overrides.otherDeduction || 0;

  const totalDeductions = ssnitDeduction + taxDeduction + shortageDeduction + otherDeduction;
  const netSalary = Math.max(0, grossEarnings - totalDeductions);

  return {
    id             : uid(),
    personId       : person.id,
    personType     : isAgent ? 'agent' : 'staff',
    name           : isAgent
                       ? `${person.firstName} ${person.lastName}`
                       : person.name,
    role           : isAgent ? 'Agent' : (person.role || 'Staff'),
    code           : person.code || '',
    month,
    baseSalary,
    commission,
    grossEarnings,
    ssnitEmployee  : ssnitDeduction,
    ssnitEmployer,
    taxPAYE        : taxDeduction,
    chargeableIncome,
    shortageDeduction,
    otherDeduction,
    otherDeductionNote : overrides.otherDeductionNote || '',
    totalDeductions,
    netSalary,
    absenceInfo,
    payslipGenerated: false
  };
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
function initPayrollView() {
  // Default month to current month
  const monthSel = document.getElementById('pay-month-sel');
  if (monthSel && !monthSel.value) monthSel.value = todayISO().slice(0, 7);
  // Populate agent report selector
  populateAgentReportSelector();
  renderAllowancesHistory();
}

// ═══════════════════════════════════════════════════════
//  SALARIES TAB
// ═══════════════════════════════════════════════════════
function renderPayrollSalaries() {
  // Just refresh the content if a payroll run exists for this month
  const month = document.getElementById('pay-month-sel')?.value;
  if (!month) return;
  const existing = PAYROLL.find(p => p.month === month);
  if (existing) renderPayrollTable(existing);
}

function generatePayroll() {
  const month = document.getElementById('pay-month-sel')?.value;
  if (!month) return toast('Select a payroll month first', 'error');

  // Prevent duplicate generation
  const existing = PAYROLL.find(p => p.month === month);
  if (existing) {
    showConfirm(
      'Regenerate Payroll?',
      `A payroll run for <strong>${monthLabel(month)}</strong> already exists.
       Regenerating will overwrite it. Continue?`,
      () => _doGeneratePayroll(month)
    );
    return;
  }
  _doGeneratePayroll(month);
}

function _doGeneratePayroll(month) {
  showLoader('⚙️ Generating Payroll...', `Computing salaries for ${monthLabel(month)}`);
  setTimeout(() => {
    const entries = [];

    // ── Agents / Mobile Bankers ─────────────────────
    AGENTS.forEach(agent => {
      entries.push(buildPayrollEntry(agent, true, month));
    });

    // ── Other Staff (USERS who are not agents) ──────
    USERS.filter(u => u.status === 'active').forEach(user => {
      entries.push(buildPayrollEntry(user, false, month));
    });

    // Get allowances for this month (target) + this quarter (others)
    const quarter = getQuarterForMonth(month);
    const year    = month.slice(0, 4);
    const monthAllowances = ALLOWANCES_RECORDS.filter(a =>
      (a.type === 'target' && a.period === month) ||
      (['clothing','health','risk'].includes(a.type) && a.period === quarter && a.year === year)
    );

    // Apply allowances to each entry
    entries.forEach(e => {
      e.allowances = { clothing: 0, health: 0, risk: 0, target: 0 };
      monthAllowances.forEach(a => {
        const applies =
          (a.scope === 'all') ||
          (a.scope === 'agents'  && e.personType === 'agent') ||
          (a.scope === 'staff'   && e.personType === 'staff');
        if (!applies) return;
        if (a.type === 'target' && e.personType !== 'agent') return;
        e.allowances[a.type] = (e.allowances[a.type] || 0) + a.amount;
      });
      e.totalAllowances = Object.values(e.allowances).reduce((s, v) => s + v, 0);
      e.finalNet = Math.round((e.netSalary + e.totalAllowances) * 100) / 100;
    });

    const run = {
      id          : uid(),
      month,
      monthLabel  : monthLabel(month),
      generatedAt : new Date().toISOString(),
      generatedBy : currentUser?.name || 'Admin',
      entries
    };

    // Remove existing run for this month if regenerating
    PAYROLL = PAYROLL.filter(p => p.month !== month);
    PAYROLL.unshift(run);
    saveAll();
    hideLoader();
    renderPayrollTable(run);
    logActivity('Payroll', `Payroll generated for ${monthLabel(month)}`, 0, 'generated');
    toast(`Payroll for ${monthLabel(month)} generated ✅`, 'success');
  }, 800);
}

function getQuarterForMonth(month) {
  const m = parseInt(month.slice(5, 7));
  if (m <= 3) return 'Q1';
  if (m <= 6) return 'Q2';
  if (m <= 9) return 'Q3';
  return 'Q4';
}

function renderPayrollTable(run) {
  const el = document.getElementById('pay-salaries-content'); if (!el) return;

  const totalGross = run.entries.reduce((s, e) => s + e.grossEarnings, 0);
  const totalNet   = run.entries.reduce((s, e) => s + (e.finalNet ?? e.netSalary), 0);
  const totalSSNIT_employer = run.entries.reduce((s, e) => s + (e.ssnitEmployer || 0), 0);

  el.innerHTML = `
    <!-- Summary banner -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
      gap:10px;margin-bottom:18px">
      <div class="stat-card gold card-sm">
        <div class="stat-label">Total Staff</div>
        <div class="stat-value" style="font-size:1.1rem">${run.entries.length}</div>
      </div>
      <div class="stat-card blue card-sm">
        <div class="stat-label">Total Gross</div>
        <div class="stat-value" style="font-size:.9rem">${fmt(totalGross)}</div>
      </div>
      <div class="stat-card green card-sm">
        <div class="stat-label">Total Net Pay</div>
        <div class="stat-value" style="font-size:.9rem">${fmt(totalNet)}</div>
      </div>
      <div class="stat-card red card-sm">
        <div class="stat-label">SSNIT (Employer)</div>
        <div class="stat-value" style="font-size:.9rem">${fmt(totalSSNIT_employer)}</div>
      </div>
    </div>

    <div style="font-size:.74rem;color:var(--muted);margin-bottom:12px">
      Generated by <strong>${run.generatedBy}</strong> on
      ${fmtDateTime(run.generatedAt)} · Period: <strong>${run.monthLabel}</strong>
    </div>

    <!-- Payroll table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Role</th>
              <th>Basic</th>
              <th>Commission</th>
              <th>Allowances</th>
              <th>Gross</th>
              <th>SSNIT (5.5%)</th>
              <th>Tax (PAYE)</th>
              <th>Shortage</th>
              <th>Net Pay</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${run.entries.map((e, i) => {
              const isAbsent = e.absenceInfo?.absent;
              return `<tr ${isAbsent ? 'style="background:rgba(232,93,93,.05)"' : ''}>
                <td class="text-muted">${i + 1}</td>
                <td>
                  <div class="fw-600" style="font-size:.84rem">${e.name}
                    ${e.code ? `<span class="agent-code" style="margin-left:4px">${e.code}</span>` : ''}
                  </div>
                  ${isAbsent
                    ? `<div style="font-size:.68rem;color:var(--danger)">
                         ⚠️ ${e.absenceInfo.maxConsecutive}d consecutive absent — base reduced
                       </div>` : ''}
                </td>
                <td style="font-size:.78rem">${e.role}</td>
                <td class="mono">${fmt(e.baseSalary)}</td>
                <td class="mono text-success">${e.commission > 0 ? '+ ' + fmt(e.commission) : '—'}</td>
                <td class="mono text-info">${e.totalAllowances > 0 ? '+ ' + fmt(e.totalAllowances) : '—'}</td>
                <td class="mono fw-600 text-gold">${fmt(e.grossEarnings + (e.totalAllowances || 0))}</td>
                <td class="mono text-danger" style="font-size:.8rem">− ${fmt(e.ssnitEmployee)}</td>
                <td class="mono text-danger" style="font-size:.8rem">− ${fmt(e.taxPAYE)}</td>
                <td class="mono text-danger" style="font-size:.8rem">
                  ${e.shortageDeduction > 0 ? '− ' + fmt(e.shortageDeduction) : '—'}
                </td>
                <td class="mono fw-600" style="color:var(--success);font-size:.92rem">
                  ${fmt(e.finalNet ?? e.netSalary)}
                </td>
                <td style="white-space:nowrap">
                  <button class="btn btn-gold btn-xs"
                    onclick="openPayslip('${run.id}','${e.id}')">
                    🧾 Payslip
                  </button>
                  ${e.paidOut
                    ? `<span class="badge b-green" style="font-size:.6rem;margin-left:4px">
                         ✅ Paid
                       </span>`
                    : `<button class="btn btn-outline btn-xs" style="margin-left:4px"
                         onclick="markPayrollEntryPaid('${run.id}','${e.id}')">
                         💵 Pay Out
                       </button>`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit staff salaries section -->
    <div class="card" style="margin-top:16px">
      <div class="card-title"><span>✏️</span> Adjust Staff Salaries / Other Deductions</div>
      <div class="text-muted" style="font-size:.78rem;margin-bottom:12px">
        Override monthly salary for non-agent staff, or add custom deductions.
        Changes will regenerate payroll.
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${run.entries.filter(e => e.personType === 'staff').map(e => `
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;
            padding:10px 14px;background:var(--surface2);border:1px solid var(--border);
            border-radius:var(--radius-sm)">
            <div style="min-width:160px">
              <div class="fw-600" style="font-size:.83rem">${e.name}</div>
              <div class="text-muted" style="font-size:.72rem">${e.role}</div>
            </div>
            <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
              <label class="form-label" style="font-size:.7rem">Basic Salary (GH₵)</label>
              <input type="number" class="form-control" style="font-size:.8rem"
                id="adj-sal-${e.id}" value="${e.baseSalary}" min="0" step="0.01">
            </div>
            <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
              <label class="form-label" style="font-size:.7rem">Other Deduction (GH₵)</label>
              <input type="number" class="form-control" style="font-size:.8rem"
                id="adj-ded-${e.id}" value="${e.otherDeduction || 0}" min="0" step="0.01">
            </div>
            <div class="form-group" style="margin-bottom:0;flex:2;min-width:160px">
              <label class="form-label" style="font-size:.7rem">Deduction Note</label>
              <input type="text" class="form-control" style="font-size:.8rem"
                id="adj-note-${e.id}" value="${e.otherDeductionNote || ''}"
                placeholder="e.g. Absence, loan repayment">
            </div>
          </div>`).join('')}
        ${run.entries.filter(e => e.personType === 'agent').map(e => `
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;
            padding:10px 14px;background:var(--surface2);border:1px solid var(--border);
            border-radius:var(--radius-sm)">
            <div style="min-width:160px">
              <div class="fw-600" style="font-size:.83rem">${e.name}
                <span class="agent-code">${e.code}</span>
              </div>
              <div class="text-muted" style="font-size:.72rem">Agent · Base: ${fmt(e.baseSalary)}</div>
            </div>
            <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
              <label class="form-label" style="font-size:.7rem">Other Deduction (GH₵)</label>
              <input type="number" class="form-control" style="font-size:.8rem"
                id="adj-ded-${e.id}" value="${e.otherDeduction || 0}" min="0" step="0.01">
            </div>
            <div class="form-group" style="margin-bottom:0;flex:2;min-width:160px">
              <label class="form-label" style="font-size:.7rem">Deduction Note</label>
              <input type="text" class="form-control" style="font-size:.8rem"
                id="adj-note-${e.id}" value="${e.otherDeductionNote || ''}"
                placeholder="e.g. Shortage, loan, other">
            </div>
          </div>`).join('')}
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-gold" onclick="applyPayrollAdjustments('${run.id}')">
          💾 Save Adjustments & Regenerate
        </button>
      </div>
    </div>`;
}

function applyPayrollAdjustments(runId) {
  const run = PAYROLL.find(p => p.id === runId); if (!run) return;

  run.entries.forEach(e => {
    const salEl  = document.getElementById(`adj-sal-${e.id}`);
    const dedEl  = document.getElementById(`adj-ded-${e.id}`);
    const noteEl = document.getElementById(`adj-note-${e.id}`);

    if (e.personType === 'staff' && salEl) {
      const newBase = parseFloat(salEl.value) || 0;
      // Recalculate
      e.baseSalary       = newBase;
      e.grossEarnings    = newBase + e.commission;
      e.ssnitEmployee    = Math.round(newBase * SSNIT_EMPLOYEE_RATE * 100) / 100;
      e.ssnitEmployer    = Math.round(newBase * SSNIT_EMPLOYER_RATE * 100) / 100;
      e.chargeableIncome = Math.max(0, e.grossEarnings - e.ssnitEmployee);
      e.taxPAYE          = calcGhanaPAYE(e.chargeableIncome);
    }
    if (dedEl)  e.otherDeduction     = parseFloat(dedEl.value)  || 0;
    if (noteEl) e.otherDeductionNote = noteEl.value.trim();

    e.totalDeductions = e.ssnitEmployee + e.taxPAYE + e.shortageDeduction + e.otherDeduction;
    e.netSalary       = Math.max(0, e.grossEarnings - e.totalDeductions);
    e.finalNet        = Math.round((e.netSalary + (e.totalAllowances || 0)) * 100) / 100;
  });

  saveAll();
  renderPayrollTable(run);
  toast('Payroll adjustments saved ✅', 'success');
}

// ═══════════════════════════════════════════════════════
//  PAYSLIP
// ═══════════════════════════════════════════════════════
function openPayslip(runId, entryId) {
  const run   = PAYROLL.find(p => p.id === runId);   if (!run) return;
  const entry = run.entries.find(e => e.id === entryId); if (!entry) return;

  const company = SETTINGS.companyName  || 'Pro Susu Banking';
  const address = SETTINGS.companyLocation || '';
  const phone   = SETTINGS.companyPhone   || '';

  document.getElementById('m-payslip-title').textContent =
    `Payslip — ${entry.name} · ${run.monthLabel}`;

  const alw = entry.allowances || {};

  document.getElementById('m-payslip-body').innerHTML = `
    <div id="payslip-print-area" style="font-family:'Inter',sans-serif;font-size:.82rem">

      <!-- Company header -->
      <div style="text-align:center;padding-bottom:14px;border-bottom:2px solid var(--gold);
        margin-bottom:14px">
        <div style="font-size:1.2rem;font-weight:700;color:var(--gold)">${company}</div>
        ${address ? `<div style="font-size:.74rem;color:var(--muted)">${address}</div>` : ''}
        ${phone   ? `<div style="font-size:.74rem;color:var(--muted)">Tel: ${phone}</div>` : ''}
        <div style="font-size:.9rem;font-weight:600;margin-top:8px">
          PAY SLIP — ${run.monthLabel.toUpperCase()}
        </div>
      </div>

      <!-- Employee info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;
        padding:10px 14px;background:var(--surface2);border:1px solid var(--border);
        border-radius:var(--radius-sm);margin-bottom:14px;font-size:.8rem">
        <div><span class="text-muted">Employee:</span> <strong>${entry.name}</strong></div>
        <div><span class="text-muted">Role:</span> ${entry.role}</div>
        ${entry.code ? `<div><span class="text-muted">Code:</span> ${entry.code}</div>` : ''}
        <div><span class="text-muted">Period:</span> ${run.monthLabel}</div>
      </div>

      <!-- Earnings -->
      <div style="margin-bottom:12px">
        <div style="padding:7px 12px;background:rgba(46,204,138,.1);
          border-left:3px solid var(--success);font-weight:600;margin-bottom:6px">
          EARNINGS
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:5px 12px">Basic Salary</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace">
              ${fmt(entry.baseSalary)}
            </td>
          </tr>
          ${entry.commission > 0 ? `<tr>
            <td style="padding:5px 12px">Commission</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--success)">
              ${fmt(entry.commission)}
            </td>
          </tr>` : ''}
          ${alw.clothing > 0 ? `<tr>
            <td style="padding:5px 12px">👔 Clothing Allowance</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--info)">
              ${fmt(alw.clothing)}
            </td>
          </tr>` : ''}
          ${alw.health > 0 ? `<tr>
            <td style="padding:5px 12px">🏥 Health Allowance</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--info)">
              ${fmt(alw.health)}
            </td>
          </tr>` : ''}
          ${alw.risk > 0 ? `<tr>
            <td style="padding:5px 12px">⚠️ Risk Allowance</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--info)">
              ${fmt(alw.risk)}
            </td>
          </tr>` : ''}
          ${alw.target > 0 ? `<tr>
            <td style="padding:5px 12px">🎯 Target Achieved Allowance</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--info)">
              ${fmt(alw.target)}
            </td>
          </tr>` : ''}
          <tr style="border-top:1px solid var(--border);font-weight:700">
            <td style="padding:7px 12px">GROSS EARNINGS</td>
            <td style="text-align:right;padding:7px 12px;font-family:monospace;color:var(--gold)">
              ${fmt(entry.grossEarnings + (entry.totalAllowances || 0))}
            </td>
          </tr>
        </table>
      </div>

      <!-- Deductions -->
      <div style="margin-bottom:12px">
        <div style="padding:7px 12px;background:rgba(232,93,93,.1);
          border-left:3px solid var(--danger);font-weight:600;margin-bottom:6px">
          DEDUCTIONS
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:5px 12px">SSNIT (Employee 5.5%)</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--danger)">
              − ${fmt(entry.ssnitEmployee)}
            </td>
          </tr>
          <tr>
            <td style="padding:5px 12px">Income Tax (PAYE)</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--danger)">
              − ${fmt(entry.taxPAYE)}
            </td>
          </tr>
          ${entry.shortageDeduction > 0 ? `<tr>
            <td style="padding:5px 12px">Cash Shortage Recovery</td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--danger)">
              − ${fmt(entry.shortageDeduction)}
            </td>
          </tr>` : ''}
          ${entry.otherDeduction > 0 ? `<tr>
            <td style="padding:5px 12px">
              Other Deductions
              ${entry.otherDeductionNote
                ? `<span style="font-size:.72rem;color:var(--muted)"> (${entry.otherDeductionNote})</span>`
                : ''}
            </td>
            <td style="text-align:right;padding:5px 12px;font-family:monospace;color:var(--danger)">
              − ${fmt(entry.otherDeduction)}
            </td>
          </tr>` : ''}
          <tr style="border-top:1px solid var(--border);font-weight:700">
            <td style="padding:7px 12px">TOTAL DEDUCTIONS</td>
            <td style="text-align:right;padding:7px 12px;font-family:monospace;color:var(--danger)">
              − ${fmt(entry.totalDeductions)}
            </td>
          </tr>
        </table>
      </div>

      <!-- SSNIT info -->
      <div style="padding:7px 12px;background:rgba(74,144,217,.07);
        border:1px solid rgba(74,144,217,.18);border-radius:var(--radius-sm);
        font-size:.74rem;margin-bottom:12px;color:var(--muted)">
        ℹ️ SSNIT Employer Contribution (13%): <strong style="color:var(--info)">${fmt(entry.ssnitEmployer)}</strong>
        — paid by employer, not deducted from worker.
        Chargeable Income: <strong>${fmt(entry.chargeableIncome)}</strong>
      </div>

      <!-- Net pay -->
      <div style="padding:14px 16px;background:var(--gold-dim);
        border:2px solid rgba(201,168,76,.3);border-radius:var(--radius);text-align:center">
        <div style="font-size:.76rem;text-transform:uppercase;letter-spacing:1px;
          color:var(--muted);margin-bottom:4px">NET PAY</div>
        <div style="font-size:1.8rem;font-weight:700;color:var(--gold);
          font-family:'Playfair Display',serif">
          ${fmt(entry.finalNet ?? entry.netSalary)}
        </div>
      </div>

      <!-- Absence note -->
      ${entry.absenceInfo?.absent ? `
        <div style="margin-top:10px;padding:8px 12px;background:rgba(232,93,93,.08);
          border:1px solid rgba(232,93,93,.2);border-radius:var(--radius-sm);
          font-size:.76rem;color:var(--danger)">
          ⚠️ Basic salary reduced from GH₵ ${DEFAULT_AGENT_BASE} to GH₵ ${ABSENT_REDUCED_BASE}
          due to ${entry.absenceInfo.maxConsecutive} consecutive days absent without reason.
        </div>` : ''}

      <!-- Signatures -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;
        gap:20px;margin-top:30px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="text-align:center">
          <div style="border-bottom:1px solid var(--border);padding-bottom:20px;margin-bottom:6px"></div>
          <div style="font-size:.72rem;color:var(--muted)">Employee Signature</div>
        </div>
        <div style="text-align:center">
          <div style="border-bottom:1px solid var(--border);padding-bottom:20px;margin-bottom:6px"></div>
          <div style="font-size:.72rem;color:var(--muted)">HR / Administrator</div>
        </div>
        <div style="text-align:center">
          <div style="border-bottom:1px solid var(--border);padding-bottom:20px;margin-bottom:6px"></div>
          <div style="font-size:.72rem;color:var(--muted)">Date Received</div>
        </div>
      </div>
    </div>`;

  openModal('modal-payslip');
}

// ═══════════════════════════════════════════════════════
//  ALLOWANCES TAB
// ═══════════════════════════════════════════════════════
function toggleAllowancePeriod() {
  const type = document.getElementById('alw-type')?.value;
  const qWrap = document.getElementById('alw-quarter-wrap');
  const mWrap = document.getElementById('alw-month-wrap');
  if (qWrap) qWrap.classList.toggle('hidden', type === 'target');
  if (mWrap) mWrap.classList.toggle('hidden', type !== 'target');
}

function renderAllowancesTab() {
  renderAllowancesHistory();
  // Set default year
  const yearEl = document.getElementById('alw-year');
  if (yearEl && !yearEl.value) yearEl.value = new Date().getFullYear();
  const monthEl = document.getElementById('alw-month');
  if (monthEl && !monthEl.value) monthEl.value = todayISO().slice(0, 7);
}

function applyAllowance() {
  const type   = document.getElementById('alw-type')?.value;
  const amount = parseFloat(document.getElementById('alw-amount')?.value) || 0;
  const scope  = document.getElementById('alw-scope')?.value;
  const notes  = document.getElementById('alw-notes')?.value.trim() || '';
  const year   = document.getElementById('alw-year')?.value || String(new Date().getFullYear());

  if (!amount || amount <= 0) return toast('Enter an allowance amount', 'error');

  let period, label;
  if (type === 'target') {
    period = document.getElementById('alw-month')?.value;
    if (!period) return toast('Select a month for target allowance', 'error');
    label = `${monthLabel(period)} — Target Achieved`;
  } else {
    const quarter = document.getElementById('alw-quarter')?.value;
    period = quarter;
    label = `${quarter} ${year} — ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }

  // Check for duplicate
  const exists = ALLOWANCES_RECORDS.find(a =>
    a.type === type && a.period === period && a.year === year && a.scope === scope
  );
  if (exists) {
    return toast(`${type} allowance for ${label} already applied to ${scope}`, 'warning');
  }

  const record = {
    id        : uid(),
    type,
    period,
    year,
    scope,
    amount,
    notes,
    label,
    appliedAt : new Date().toISOString(),
    appliedBy : currentUser?.name || 'Admin'
  };

  ALLOWANCES_RECORDS.unshift(record);
  saveAll();
  renderAllowancesHistory();

  // Clear form
  const amtEl = document.getElementById('alw-amount');
  const noteEl = document.getElementById('alw-notes');
  if (amtEl) amtEl.value = '';
  if (noteEl) noteEl.value = '';

  toast(`${type.charAt(0).toUpperCase() + type.slice(1)} allowance of ${fmt(amount)} applied ✅`, 'success');
  logActivity('Payroll', `${type} allowance of ${fmt(amount)} applied for ${label}`, amount, 'applied');
}

function renderAllowancesHistory() {
  const el = document.getElementById('alw-history-content'); if (!el) return;

  if (!ALLOWANCES_RECORDS.length) {
    el.innerHTML = `<div class="empty-state" style="padding:28px 0">
      <div class="ei">🎁</div><div class="et">No allowances applied yet</div>
    </div>`;
    return;
  }

  const typeIcons = {
    clothing : '👔', health : '🏥', risk : '⚠️', target : '🎯'
  };
  const typeColors = {
    clothing : 'b-blue', health : 'b-green', risk : 'b-red', target : 'b-gold'
  };

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
    ${ALLOWANCES_RECORDS.map(a => `
      <div style="padding:10px 13px;background:var(--surface2);border:1px solid var(--border);
        border-radius:var(--radius-sm)">
        <div class="flex-between">
          <div>
            <span class="badge ${typeColors[a.type] || 'b-gray'}" style="margin-right:6px">
              ${typeIcons[a.type] || ''} ${a.type}
            </span>
            <span class="fw-600" style="font-size:.83rem">${a.label}</span>
          </div>
          <span class="mono text-gold fw-600">${fmt(a.amount)}</span>
        </div>
        <div style="display:flex;gap:14px;margin-top:5px;font-size:.73rem;color:var(--muted)">
          <span>Scope: ${a.scope}</span>
          <span>Applied by: ${a.appliedBy}</span>
          <span>${fmtDate(a.appliedAt)}</span>
        </div>
        ${a.notes ? `<div style="font-size:.72rem;color:var(--muted);margin-top:3px">${a.notes}</div>` : ''}
        <button class="btn btn-danger btn-xs" style="margin-top:6px"
          onclick="deleteAllowance('${a.id}')">🗑 Remove</button>
      </div>`).join('')}
  </div>`;
}

function deleteAllowance(id) {
  showConfirm('Remove Allowance?',
    'This will remove this allowance record. Regenerate payroll to reflect the change.',
    () => {
      ALLOWANCES_RECORDS = ALLOWANCES_RECORDS.filter(a => a.id !== id);
      saveAll();
      renderAllowancesHistory();
      toast('Allowance removed', 'warning');
    });
}

// ═══════════════════════════════════════════════════════
//  AGENT CUSTOMER REPORTS
// ═══════════════════════════════════════════════════════
function populateAgentReportSelector() {
  const el = document.getElementById('rpt-agent-sel'); if (!el) return;
  const val = el.value;
  el.innerHTML = '<option value="">-- Select Agent --</option>'
    + AGENTS.map(a =>
        `<option value="${a.id}">${a.firstName} ${a.lastName} (${a.code})</option>`
      ).join('');
  if (val) el.value = val;
}

function generateAgentReport() {
  const agentId = document.getElementById('rpt-agent-sel')?.value;
  const el      = document.getElementById('agent-report-content'); if (!el) return;

  if (!agentId) {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🖨️</div><div class="et">Select an agent to view their customers</div>
    </div>`;
    return;
  }

  const agent = AGENTS.find(a => a.id === agentId);
  if (!agent) return;

  const customers = CUSTOMERS.filter(c => c.agentId === agentId);
  if (!customers.length) {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">👥</div>
      <div class="et">No customers under ${agent.firstName} ${agent.lastName}</div>
    </div>`;
    return;
  }

  // Build enriched rows
  const rows = customers.map(c => {
    // Last collection: most recent deposit/entry transaction
    const txns = (c.transactions || []).slice();
    txns.sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastTxn = txns.find(t =>
      ['deposit','entry','transfer_in'].includes(t.type)
    );
    return {
      acctNumber  : c.acctNumber,
      name        : `${c.firstName} ${c.lastName}`,
      phone       : c.phone || '—',
      dateReg     : c.dateCreated || '—',
      lastCollDate: lastTxn?.date || null,
      lastCollAmt : lastTxn?.amount || 0,
      balance     : c.balance || 0,
      type        : c.type,
      status      : c.status
    };
  });

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const company      = SETTINGS.companyName || 'Pro Susu Banking';

  el.innerHTML = `
    <div id="printable-agent-report">
      <!-- Print header (visible in print only via @media print) -->
      <div class="no-print" style="display:flex;justify-content:space-between;
        align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <div class="fw-600" style="font-size:.95rem">
            ${agent.firstName} ${agent.lastName}
            <span class="agent-code">${agent.code}</span>
          </div>
          <div class="text-muted" style="font-size:.75rem;margin-top:2px">
            ${customers.length} customer(s) · Total Balance: ${fmt(totalBalance)}
          </div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="printAgentReport()">
          🖨️ Print This Report
        </button>
      </div>

      <!-- Print-only header -->
      <div class="print-only" style="display:none;text-align:center;margin-bottom:16px;
        padding-bottom:10px;border-bottom:2px solid #c9a84c">
        <div style="font-size:1.2rem;font-weight:700">${company}</div>
        <div style="font-size:.85rem;margin-top:4px">
          Agent Customer Report — ${agent.firstName} ${agent.lastName} (${agent.code})
        </div>
        <div style="font-size:.75rem;color:#666;margin-top:2px">
          Generated: ${fmtDateTime(new Date().toISOString())}
        </div>
      </div>

      <!-- Summary strip -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
        gap:10px;margin-bottom:14px">
        <div class="stat-card gold card-sm">
          <div class="stat-label">Total Customers</div>
          <div class="stat-value" style="font-size:1.1rem">${customers.length}</div>
        </div>
        <div class="stat-card green card-sm">
          <div class="stat-label">Active</div>
          <div class="stat-value" style="font-size:1.1rem">
            ${customers.filter(c => c.status === 'active').length}
          </div>
        </div>
        <div class="stat-card blue card-sm">
          <div class="stat-label">Total Balance</div>
          <div class="stat-value" style="font-size:.88rem">${fmt(totalBalance)}</div>
        </div>
        <div class="stat-card purple card-sm">
          <div class="stat-label">Account Types</div>
          <div class="stat-value" style="font-size:.72rem;font-weight:600">
            ${['susu','lending','savings'].map(t =>
                customers.filter(c => c.type === t).length + ' ' + t
              ).filter(s => !s.startsWith('0')).join(' · ')}
          </div>
        </div>
      </div>

      <!-- Customer table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Account No.</th>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Date Registered</th>
                <th>Last Collection Date</th>
                <th>Last Collection Amount</th>
                <th>Balance</th>
                <th class="no-print">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r, i) => `<tr>
                <td class="text-muted">${i + 1}</td>
                <td class="mono text-gold" style="font-size:.78rem">${r.acctNumber}</td>
                <td class="fw-600" style="font-size:.83rem">${r.name}</td>
                <td style="font-size:.8rem">${r.phone}</td>
                <td style="font-size:.78rem">${fmtDate(r.dateReg)}</td>
                <td style="font-size:.78rem;${!r.lastCollDate ? 'color:var(--muted)' : ''}">
                  ${r.lastCollDate ? fmtDate(r.lastCollDate) : '—'}
                </td>
                <td class="mono ${r.lastCollAmt > 0 ? 'text-success' : 'text-muted'}">
                  ${r.lastCollAmt > 0 ? fmt(r.lastCollAmt) : '—'}
                </td>
                <td class="mono text-gold fw-600">${fmt(r.balance)}</td>
                <td class="no-print">
                  <span class="badge ${r.status === 'active' ? 'b-green' : 'b-gray'}">
                    ${r.status}
                  </span>
                </td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--border);font-weight:700">
                <td colspan="7" style="padding:8px 12px;text-align:right">
                  Total Balance:
                </td>
                <td class="mono text-gold" style="padding:8px 12px">
                  ${fmt(totalBalance)}
                </td>
                <td class="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>`;
}

function printAgentReport() {
  const agentId = document.getElementById('rpt-agent-sel')?.value;
  if (!agentId) return toast('Select an agent first', 'warning');
  window.print();
}

function renderAgentReportTab() {
  populateAgentReportSelector();
  // Restore any previously selected agent
  const sel = document.getElementById('rpt-agent-sel');
  if (sel?.value) generateAgentReport();
}

// ═══════════════════════════════════════════════════════
//  SALARY WALLET — Pay Out & Withdraw
// ═══════════════════════════════════════════════════════

// Each agent gets agent.salaryBalance tracked on the AGENTS array.
// Each user gets user.salaryBalance tracked on the USERS array.

function getSalaryBalance(personId, personType) {
  if (personType === 'agent') {
    const a = AGENTS.find(x => x.id === personId);
    return a ? (a.salaryBalance || 0) : 0;
  }
  const u = USERS.find(x => x.id === personId);
  return u ? (u.salaryBalance || 0) : 0;
}

function getPersonName(personId, personType) {
  if (personType === 'agent') {
    const a = AGENTS.find(x => x.id === personId);
    return a ? `${a.firstName} ${a.lastName}` : '—';
  }
  const u = USERS.find(x => x.id === personId);
  return u ? u.name : '—';
}

// ── Mark a payroll entry as paid and credit salary wallet ──
function markPayrollEntryPaid(runId, entryId) {
  const run   = PAYROLL.find(p => p.id === runId);   if (!run) return;
  const entry = run.entries.find(e => e.id === entryId); if (!entry) return;

  if (entry.paidOut) {
    return toast(`${entry.name} has already been paid for ${run.monthLabel}`, 'warning');
  }

  const amount = Math.round((entry.finalNet ?? entry.netSalary) * 100) / 100;

  showConfirm(
    'Pay Out Salary?',
    `Credit <strong>${fmt(amount)}</strong> salary for <strong>${entry.name}</strong>
     (${run.monthLabel}) to their salary wallet?`,
    () => {
      // Credit wallet
      if (entry.personType === 'agent') {
        const a = AGENTS.find(x => x.id === entry.personId);
        if (a) {
          a.salaryBalance = Math.round(((a.salaryBalance || 0) + amount) * 100) / 100;
          if (!a.salaryHistory) a.salaryHistory = [];
          a.salaryHistory.unshift({
            id: uid(), month: run.month, monthLabel: run.monthLabel,
            amount, paidAt: new Date().toISOString(), paidBy: currentUser?.name || 'Admin'
          });
        }
      } else {
        const u = USERS.find(x => x.id === entry.personId);
        if (u) {
          u.salaryBalance = Math.round(((u.salaryBalance || 0) + amount) * 100) / 100;
          if (!u.salaryHistory) u.salaryHistory = [];
          u.salaryHistory.unshift({
            id: uid(), month: run.month, monthLabel: run.monthLabel,
            amount, paidAt: new Date().toISOString(), paidBy: currentUser?.name || 'Admin'
          });
        }
      }

      entry.paidOut    = true;
      entry.paidOutAt  = new Date().toISOString();
      entry.paidOutBy  = currentUser?.name || 'Admin';

      logActivity('Payroll',
        `Salary of ${fmt(amount)} paid out to ${entry.name} for ${run.monthLabel}`,
        amount, 'paid');
      saveAll();
      renderPayrollTable(run);
      toast(`${fmt(amount)} credited to ${entry.name}'s salary wallet ✅`, 'success');
    }
  );
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
          onclick="openSalaryWithdrawal('${personId}','${personType}')">
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