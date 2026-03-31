// ═══════════════════════════════════════════════════════
//  ACCOUNTING
// ═══════════════════════════════════════════════════════
function addAccountingEntry() {
  const type = document.getElementById('acci-type').value;
  const cat = document.getElementById('acci-cat').value;
  const desc = document.getElementById('acci-desc').value.trim();
  const amount = parseFloat(document.getElementById('acci-amount').value);
  const date = document.getElementById('acci-date').value;
  const ref = document.getElementById('acci-ref').value.trim();
  if (!desc) return toast('Enter description', 'error');
  if (!amount || amount <= 0) return toast('Enter valid amount', 'error');
  if (!date) return toast('Select date', 'error');
  const entry = { id: uid(), type, category: cat, desc, amount, date, ref, by: currentUser?.name || 'System', time: new Date().toISOString() };
  ACCOUNTING_ENTRIES.push(entry);
  ['acci-desc','acci-amount','acci-date','acci-ref'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderAccountingJournal(); logActivity('Accounting', `${type}: ${desc}`, amount, 'recorded'); saveAll();
  toast('Journal entry recorded', 'success');
}

function renderAccountingJournal() {
  const income = ACCOUNTING_ENTRIES.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = ACCOUNTING_ENTRIES.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const net = income - expense;
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('acc-income', fmt(income)); setTxt('acc-expense', fmt(expense)); setTxt('acc-net', fmt(net));
  const tb = document.getElementById('acc-journal-tbody');
  if (tb) {
    if (!ACCOUNTING_ENTRIES.length) { tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:20px">No entries</td></tr>'; }
    else tb.innerHTML = [...ACCOUNTING_ENTRIES].reverse().slice(0, 20).map(e => `<tr>
      <td style="font-size:.76rem">${fmtDate(e.date)}</td>
      <td style="font-size:.76rem">${e.category}</td>
      <td>${e.desc}</td>
      <td><span class="badge ${e.type==='income'?'b-green':e.type==='expense'?'b-red':'b-blue'}">${e.type}</span></td>
      <td class="mono ${e.type==='income'?'text-success':e.type==='expense'?'text-danger':''}">${fmt(e.amount)}</td>
    </tr>`).join('');
  }
  // Income tab
  const incTb = document.getElementById('acc-income-tbody');
  if (incTb) {
    const incEntries = ACCOUNTING_ENTRIES.filter(e => e.type === 'income');
    incTb.innerHTML = incEntries.length ? incEntries.reverse().map(e => `<tr><td style="font-size:.76rem">${fmtDate(e.date)}</td><td>${e.category}</td><td>${e.desc}</td><td class="mono" style="font-size:.76rem">${e.ref||'—'}</td><td class="mono text-success">${fmt(e.amount)}</td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted" style="padding:24px">No income entries</td></tr>';
  }
  // Expense tab
  const expTb = document.getElementById('acc-expense-tbody');
  if (expTb) {
    const expEntries = ACCOUNTING_ENTRIES.filter(e => e.type === 'expense');
    expTb.innerHTML = expEntries.length ? expEntries.reverse().map(e => `<tr><td style="font-size:.76rem">${fmtDate(e.date)}</td><td>${e.category}</td><td>${e.desc}</td><td class="mono" style="font-size:.76rem">${e.ref||'—'}</td><td class="mono text-danger">${fmt(e.amount)}</td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted" style="padding:24px">No expense entries</td></tr>';
  }
}

function renderTrialBalance() {
  const el = document.getElementById('trial-balance-content'); if (!el) return;
  const cats = {};
  ACCOUNTING_ENTRIES.forEach(e => {
    if (!cats[e.category]) cats[e.category] = { income: 0, expense: 0 };
    if (e.type === 'income') cats[e.category].income += e.amount;
    if (e.type === 'expense') cats[e.category].expense += e.amount;
  });
  const totalIn = ACCOUNTING_ENTRIES.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalEx = ACCOUNTING_ENTRIES.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Category</th><th>Income (Dr.)</th><th>Expense (Cr.)</th><th>Net</th></tr></thead>
    <tbody>
      ${Object.entries(cats).map(([cat, v]) => `<tr>
        <td class="fw-600">${cat}</td>
        <td class="mono text-success">${v.income ? fmt(v.income) : '—'}</td>
        <td class="mono text-danger">${v.expense ? fmt(v.expense) : '—'}</td>
        <td class="mono ${v.income-v.expense>=0?'text-success':'text-danger'}">${fmt(v.income - v.expense)}</td>
      </tr>`).join('')}
      <tr style="border-top:2px solid var(--border);font-weight:700">
        <td class="fw-600 text-gold">TOTAL</td>
        <td class="mono text-success fw-600">${fmt(totalIn)}</td>
        <td class="mono text-danger fw-600">${fmt(totalEx)}</td>
        <td class="mono fw-600 ${totalIn-totalEx>=0?'text-success':'text-danger'}">${fmt(totalIn - totalEx)}</td>
      </tr>
    </tbody>
  </table></div>`;
}

// ═══════════════════════════════════════════════════════
//  REPORTS — FUNCTIONS
// ═══════════════════════════════════════════════════════

let currentReportTab = 'overview';

function showReportTab(tab, btn) {
  currentReportTab = tab;
  document.querySelectorAll('.rpt-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('rpt-' + tab);
  if (panel) panel.classList.remove('hidden');
  if (btn) {
    document.querySelectorAll('#reports-subtabs .sub-tab')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const renderers = {
    overview    : renderOverviewReport,
    performance : renderPerformanceReport,
    financial   : renderFinancialReport,
    customers   : renderCustomersReport,
    loans       : renderLoanReport,
    agents      : renderAgentReport
  };
  if (renderers[tab]) renderers[tab]();
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key   : d.toISOString().slice(0, 7),
      label : d.toLocaleDateString('en-GH', { month: 'short', year: '2-digit' })
    });
  }
  return months;
}

function getThisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function txnsInMonth(monthKey) {
  return CUSTOMERS.flatMap(c => (c.transactions || []))
    .filter(t => (t.date || '').slice(0, 7) === monthKey);
}

function collsInMonth(monthKey) {
  return TELLER_STATE.collections
    .filter(c => (c.collectionDate || c.time || '').slice(0, 7) === monthKey);
}

function buildBarChart(data, colorFn, maxOverride) {
  const max = maxOverride || Math.max(...data.map(d => d.value), 1);
  return `<div class="bar-chart">
    ${data.map(d => {
      const pct = max > 0 ? Math.round((d.value / max) * 100) : 0;
      return `<div class="bar-col">
        <div class="bar-fill"
          style="height:${Math.max(pct, 1)}%;background:${colorFn(d)}"
          data-val="${fmt(d.value)}"></div>
        <div class="bar-label">${d.label}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function buildStackedBar(deposits, withdrawals, labels) {
  const max = Math.max(...deposits.map((v, i) => v + withdrawals[i]), 1);
  return `<div class="bar-chart">
    ${labels.map((lbl, i) => {
      const dPct = Math.round((deposits[i]    / max) * 100);
      const wPct = Math.round((withdrawals[i] / max) * 100);
      return `<div class="bar-col">
        <div style="width:100%;display:flex;flex-direction:column;
          justify-content:flex-end;height:100%;gap:0">
          <div style="width:100%;height:${dPct}%;background:rgba(46,204,138,.75);
            border-radius:4px 4px 0 0;min-height:${deposits[i]>0?2:0}px;
            position:relative;cursor:default"
            data-val="Dep: ${fmt(deposits[i])}"
            class="bar-fill"></div>
          <div style="width:100%;height:${wPct}%;background:rgba(232,93,93,.7);
            min-height:${withdrawals[i]>0?2:0}px;
            position:relative;cursor:default"
            data-val="Wd: ${fmt(withdrawals[i])}"
            class="bar-fill"></div>
        </div>
        <div class="bar-label">${lbl}</div>
      </div>`;
    }).join('')}
  </div>`;
}