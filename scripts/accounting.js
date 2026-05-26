
// ═══════════════════════════════════════════════════════
//  ACCOUNTING.JS  —  Deep Accounting Module
//  Requires globals from general.js:
//  LOANS, CARD_REPLACEMENTS, ACCOUNTING_ENTRIES, CARD_COSTS,
//  TELLER_STATE, INVESTMENTS, COLLAB_TRANSACTIONS, SETTINGS,
//  AGENTS, CUSTOMERS, PAYROLL
// ═══════════════════════════════════════════════════════

if (typeof CARD_COSTS === 'undefined') var CARD_COSTS = [];

// ── Category Definitions ─────────────────────────────
const ACC_EXP_CATS = [
  { value:'card_printing',    label:'Card Printing Costs',    icon:'💳', code:'5001' },
  { value:'salaries',         label:'Staff Salaries',          icon:'👥', code:'5002' },
  { value:'agent_commission', label:'Agent Commissions',       icon:'🤝', code:'5003' },
  { value:'stationery',       label:'Stationery & Supplies',   icon:'📎', code:'5004' },
  { value:'utilities',        label:'Utilities',               icon:'💡', code:'5005' },
  { value:'rent',             label:'Rent & Rates',            icon:'🏠', code:'5006' },
  { value:'transport',        label:'Transport & Travel',      icon:'🚗', code:'5007' },
  { value:'equipment',        label:'Equipment & Maintenance', icon:'🔧', code:'5008' },
  { value:'marketing',        label:'Marketing & Advertising', icon:'📣', code:'5009' },
  { value:'bank_charges',     label:'Bank Charges',            icon:'🏦', code:'5010' },
  { value:'staff_welfare',    label:'Staff Welfare',           icon:'🎁', code:'5011' },
  { value:'miscellaneous',    label:'Miscellaneous',           icon:'📦', code:'5012' },
];

const ACC_INC_CATS = [
  { value:'loan_interest',  label:'Loan Interest Income',   icon:'💰', code:'4001' },
  { value:'card_fees',      label:'Card Replacement Fees',  icon:'💳', code:'4002' },
  { value:'penalties',      label:'Late Payment Penalties', icon:'⚠️', code:'4003' },
  { value:'investment_ret', label:'Investment Returns',     icon:'📈', code:'4004' },
  { value:'collab_inflow',  label:'Collaboration Inflows',  icon:'🤝', code:'4005' },
  { value:'commission',     label:'Commission Income',      icon:'💼', code:'4006' },
  { value:'other',          label:'Other Income',           icon:'💵', code:'4007' },
];

const ACC_COA = [
  { code:'1001', name:'Cash at Hand',            type:'asset',    group:'Current Assets'     },
  { code:'1002', name:'Cash at Bank',            type:'asset',    group:'Current Assets'     },
  { code:'1003', name:'Loans Receivable',        type:'asset',    group:'Current Assets'     },
  { code:'1004', name:'Interest Receivable',     type:'asset',    group:'Current Assets'     },
  { code:'1005', name:'Card Stock (Inventory)',  type:'asset',    group:'Current Assets'     },
  { code:'1006', name:'Investment Portfolio',    type:'asset',    group:'Non-Current Assets' },
  { code:'1007', name:'Equipment & Fixtures',    type:'asset',    group:'Non-Current Assets' },
  { code:'2001', name:'Susu Deposits Payable',   type:'liability',group:'Current Liabilities'},
  { code:'2002', name:'Customer Savings',        type:'liability',group:'Current Liabilities'},
  { code:'2003', name:'Lending Deposits',        type:'liability',group:'Current Liabilities'},
  { code:'2004', name:'Accounts Payable',        type:'liability',group:'Current Liabilities'},
  { code:'3001', name:"Owner's Equity",          type:'equity',   group:'Equity'             },
  { code:'3002', name:'Retained Earnings',       type:'equity',   group:'Equity'             },
  { code:'4001', name:'Loan Interest Income',    type:'income',   group:'Income'             },
  { code:'4002', name:'Card Replacement Fees',   type:'income',   group:'Income'             },
  { code:'4003', name:'Late Payment Penalties',  type:'income',   group:'Income'             },
  { code:'4004', name:'Investment Returns',      type:'income',   group:'Income'             },
  { code:'4005', name:'Collaboration Inflows',   type:'income',   group:'Income'             },
  { code:'4006', name:'Commission Income',       type:'income',   group:'Income'             },
  { code:'4007', name:'Other Income',            type:'income',   group:'Income'             },
  { code:'5001', name:'Card Printing Costs',     type:'expense',  group:'Cost of Sales'      },
  { code:'5002', name:'Staff Salaries',          type:'expense',  group:'Operating Expenses' },
  { code:'5003', name:'Agent Commissions Paid',  type:'expense',  group:'Operating Expenses' },
  { code:'5004', name:'Stationery & Supplies',   type:'expense',  group:'Operating Expenses' },
  { code:'5005', name:'Utilities',               type:'expense',  group:'Operating Expenses' },
  { code:'5006', name:'Rent & Rates',            type:'expense',  group:'Operating Expenses' },
  { code:'5007', name:'Transport & Travel',      type:'expense',  group:'Operating Expenses' },
  { code:'5008', name:'Equipment & Maintenance', type:'expense',  group:'Operating Expenses' },
  { code:'5009', name:'Marketing & Advertising', type:'expense',  group:'Operating Expenses' },
  { code:'5010', name:'Bank Charges',            type:'expense',  group:'Operating Expenses' },
  { code:'5011', name:'Staff Welfare',           type:'expense',  group:'Operating Expenses' },
  { code:'5012', name:'Miscellaneous',           type:'expense',  group:'Operating Expenses' },
];

// ── Internal helpers ──────────────────────────────────
function _accThisMonth() {
  return (typeof getThisMonth === 'function') ? getThisMonth() : new Date().toISOString().slice(0,7);
}

function _accFiltDate(date, f) {
  if (!f) return true;
  if (Array.isArray(f)) return f.some(m => (date||'').startsWith(m));
  return (date||'').startsWith(f);
}

function _accLoanInterest(filter) {
  let total = 0;
  (LOANS||[]).forEach(l => {
    const interest  = l.interest || 0;
    const totalRep  = l.totalRepayment || 1;
    const intFrac   = interest / totalRep;
    (l.payments||[]).filter(p => _accFiltDate(p.date, filter)).forEach(p => {
      total += p.amount * intFrac;
    });
  });
  return total;
}

function _accCardIncome(filter) {
  return (CARD_REPLACEMENTS||[])
    .filter(r => _accFiltDate(r.date, filter))
    .reduce((s, r) => s + (r.fee || SETTINGS.cardFee || 0), 0);
}

function _accCardCosts(filter) {
  return (CARD_COSTS||[])
    .filter(c => _accFiltDate(c.date, filter))
    .reduce((s, c) => s + (c.totalCost || 0), 0);
}

function _accManualType(type, filter) {
  return (ACCOUNTING_ENTRIES||[])
    .filter(e => e.type === type && _accFiltDate(e.date, filter))
    .reduce((s, e) => s + (e.amount || 0), 0);
}

function _accManualCat(cat, filter) {
  return (ACCOUNTING_ENTRIES||[])
    .filter(e => e.type==='expense' && (e.category===cat||e.cat===cat) && _accFiltDate(e.date, filter))
    .reduce((s, e) => s + (e.amount || 0), 0);
}

function _accCollabInflows(filter) {
  return (COLLAB_TRANSACTIONS||[])
    .filter(t => t.type==='inflow' && _accFiltDate(t.date, filter))
    .reduce((s, t) => s + (t.amount || 0), 0);
}

function _accInvReturns(filter) {
  return (INVESTMENTS||[])
    .filter(i => i.status==='matured' && _accFiltDate(i.maturity||i.date, filter))
    .reduce((s, i) => s + ((i.amount||0) * ((i.roi||0)/100)), 0);
}

function _accTotalIncome(filter) {
  return _accLoanInterest(filter) + _accCardIncome(filter) + _accCollabInflows(filter)
       + _accInvReturns(filter)   + _accManualType('income', filter);
}

function _accTotalExpenses(filter) {
  return _accCardCosts(filter) + _accManualType('expense', filter);
}

function _accPeriodFilter(period) {
  const now = new Date();
  if (period === 'month')   return now.toISOString().slice(0,7);
  if (period === 'year')    return String(now.getFullYear());
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth()/3);
    return [0,1,2].map(i => new Date(now.getFullYear(), q*3+i, 1).toISOString().slice(0,7));
  }
  return null;
}

function _accPeriodLabel(period) {
  const now = new Date();
  if (period === 'month')   return now.toLocaleDateString('en-GH',{month:'long',year:'numeric'});
  if (period === 'year')    return `Year ${now.getFullYear()}`;
  if (period === 'quarter') return `Q${Math.floor(now.getMonth()/3)+1} ${now.getFullYear()}`;
  return 'All Time';
}

// ── Tab router ────────────────────────────────────────
function showAccTab(tab, btn) {
  document.querySelectorAll('#acc-subtabs .sub-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('acc-tab-content'); if (!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:64px 0">
      <div style="width:38px;height:38px;border:3px solid rgba(201,168,76,.2);
        border-top-color:var(--gold);border-radius:50%;animation:spin .75s linear infinite">
      </div>
    </div>`;
  const map = {
    overview: _accRenderOverview,
    journal:  _accRenderJournal,
    income:   _accRenderIncome,
    expenses: _accRenderExpenses,
    cards:    _accRenderCards,
    loans:    _accRenderLoans,
    trial:    _accRenderTrial,
    pl:       _accRenderPL,
    coa:      _accRenderCOA,
  };
  setTimeout(() => { if (map[tab]) map[tab](); }, 120);
}

// Entry point called from showView
function renderAccountingJournal() {
  const firstBtn = document.querySelector('#acc-subtabs .sub-tab');
  if (firstBtn) {
    document.querySelectorAll('#acc-subtabs .sub-tab').forEach(b => b.classList.remove('active'));
    firstBtn.classList.add('active');
  }
  _accRenderOverview();
}

// Legacy aliases
function addAccountingEntry()  { _accPostJournalEntry(); }
function renderTrialBalance()  { _accRenderTrial(); }

// ══════════════════════════════════════════════════════
//  1. OVERVIEW
// ══════════════════════════════════════════════════════
function _accRenderOverview() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;
  const m    = _accThisMonth();
  const mLbl = new Date(m+'-01').toLocaleDateString('en-GH',{month:'long',year:'numeric'});

  const mInc = _accTotalIncome(m),   mExp = _accTotalExpenses(m),  mNet = mInc - mExp;
  const aInc = _accTotalIncome(null),aExp = _accTotalExpenses(null),aNet = aInc - aExp;

  const cardInc = _accCardIncome(null), cardExp = _accCardCosts(null), cardNet = cardInc - cardExp;
  const loanInt = _accLoanInterest(null);

  const activeLoans    = (LOANS||[]).filter(l=>l.status==='active');
  const loanOutstanding = activeLoans.reduce((s,l)=>s+Math.max(0,(l.totalRepayment||0)-(l.payments||[]).reduce((a,p)=>a+p.amount,0)),0);

  const recent = [...(ACCOUNTING_ENTRIES||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);

  const kpi = (label, val, bg, br, color, sign=false) => `
    <div style="padding:14px;background:${bg};border:1px solid ${br};border-radius:var(--radius)">
      <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">${label}</div>
      <div class="mono fw-600 ${color}" style="font-size:1.12rem;margin-top:4px">
        ${sign&&val>=0?'+':''}${fmt(val)}
      </div>
    </div>`;

  el.innerHTML = `
    <div class="flex-between mb-4" style="flex-wrap:wrap;gap:8px">
      <div class="fw-600" style="font-size:.95rem">📊 Accounting Dashboard</div>
      <div style="display:flex;gap:8px">
        <span class="badge b-gold" style="font-size:.72rem">📅 ${mLbl}</span>
        <button class="btn btn-outline btn-xs" onclick="window.print()">🖨️ Print</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
      ${kpi('Income This Month',   mInc, 'rgba(46,204,138,.08)',   'rgba(46,204,138,.2)',  'text-success')}
      ${kpi('Expenses This Month', mExp, 'rgba(232,93,93,.08)',    'rgba(232,93,93,.2)',   'text-danger')}
      ${kpi('Net Profit (Month)',  mNet, mNet>=0?'rgba(46,204,138,.08)':'rgba(232,93,93,.08)', mNet>=0?'rgba(46,204,138,.2)':'rgba(232,93,93,.2)', mNet>=0?'text-success':'text-danger', true)}
      ${kpi('Loan Interest Earned',loanInt,'var(--gold-dim)','var(--border)','text-gold')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-title"><span>📈</span> All-Time Summary</div>
        <div style="font-size:.84rem;display:flex;flex-direction:column;gap:9px">
          <div class="flex-between"><span class="text-muted">Total Income</span><span class="mono text-success fw-600">${fmt(aInc)}</span></div>
          <div class="flex-between"><span class="text-muted">Total Expenses</span><span class="mono text-danger fw-600">${fmt(aExp)}</span></div>
          <hr class="divider">
          <div class="flex-between"><span class="fw-600">Net Profit / Loss</span>
            <span class="mono fw-600" style="color:${aNet>=0?'var(--success)':'var(--danger)'}">${aNet>=0?'+':''}${fmt(aNet)}</span>
          </div>
          <div class="flex-between" style="margin-top:4px"><span class="text-muted">Loans Outstanding</span><span class="mono text-danger">${fmt(loanOutstanding)}</span></div>
          <div class="flex-between"><span class="text-muted">Active Loans</span><span class="fw-600">${activeLoans.length}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span>💳</span> Card Accounts</div>
        <div style="font-size:.84rem;display:flex;flex-direction:column;gap:9px">
          <div class="flex-between"><span class="text-muted">Cards Issued</span><span class="fw-600">${(CARD_REPLACEMENTS||[]).length}</span></div>
          <div class="flex-between"><span class="text-muted">Sales Income</span><span class="mono text-success">${fmt(cardInc)}</span></div>
          <div class="flex-between"><span class="text-muted">Printing Costs</span><span class="mono text-danger">${fmt(cardExp)}</span></div>
          <hr class="divider">
          <div class="flex-between"><span class="fw-600">Card Net Profit</span>
            <span class="mono fw-600" style="color:${cardNet>=0?'var(--success)':'var(--danger)'}">${cardNet>=0?'+':''}${fmt(cardNet)}</span>
          </div>
          <div class="flex-between"><span class="text-muted">Avg Profit / Card</span>
            <span class="mono text-gold">${fmt((CARD_REPLACEMENTS||[]).length?cardNet/(CARD_REPLACEMENTS||[]).length:0)}</span>
          </div>
        </div>
        <button class="btn btn-outline btn-xs" style="margin-top:10px"
          onclick="document.querySelectorAll('#acc-subtabs .sub-tab')[4]?.click()">View Card Details →</button>
      </div>
      <div class="card">
        <div class="card-title"><span>⚡</span> Quick Actions</div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <button class="btn btn-outline btn-sm" onclick="document.querySelectorAll('#acc-subtabs .sub-tab')[2]?.click()">💰 Record Income</button>
          <button class="btn btn-outline btn-sm" onclick="document.querySelectorAll('#acc-subtabs .sub-tab')[3]?.click()">💸 Record Expense</button>
          <button class="btn btn-outline btn-sm" onclick="document.querySelectorAll('#acc-subtabs .sub-tab')[4]?.click()">💳 Record Card Cost</button>
          <button class="btn btn-gold btn-sm"    onclick="document.querySelectorAll('#acc-subtabs .sub-tab')[7]?.click()">📈 View P&amp;L</button>
          <button class="btn btn-outline btn-sm" onclick="document.querySelectorAll('#acc-subtabs .sub-tab')[6]?.click()">⚖️ Trial Balance</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span>🕐</span> Recent Journal Entries</div>
      ${recent.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Type</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              ${recent.map(e => {
                const cats = ACC_EXP_CATS.concat(ACC_INC_CATS);
                const cat  = cats.find(c=>c.value===(e.category||e.cat));
                return `<tr>
                  <td style="font-size:.75rem;white-space:nowrap">${fmtDate(e.date)}</td>
                  <td style="font-size:.77rem">${cat?cat.icon+' '+cat.label:(e.category||e.cat||'—')}</td>
                  <td style="font-size:.8rem">${e.desc||'—'}</td>
                  <td><span class="badge ${e.type==='income'?'b-green':e.type==='expense'?'b-red':'b-gray'}" style="font-size:.62rem">${e.type}</span></td>
                  <td class="mono ${e.type==='income'?'text-success':'text-danger'}" style="white-space:nowrap">${e.type==='income'?'+ ':'- '}${fmt(e.amount)}</td>
                  <td><button class="btn btn-danger btn-xs" onclick="_accDeleteEntry('${e.id}',null)">✕</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : `
        <div class="empty-state" style="padding:24px 0">
          <div class="ei">📒</div><div class="et">No journal entries yet</div>
          <div class="es">Use the tabs above to record income and expenses</div>
        </div>`}
    </div>`;
}

// ══════════════════════════════════════════════════════
//  2. JOURNAL
// ══════════════════════════════════════════════════════
function _accRenderJournal() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">
      <div class="card" style="position:sticky;top:70px">
        <div class="card-title"><span>➕</span> New Journal Entry</div>
        <div class="form-group">
          <label class="form-label">Entry Type</label>
          <select class="form-control" id="jrn-type" onchange="_accJrnTypeChanged()">
            <option value="income">💰 Income</option>
            <option value="expense">💸 Expense</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="jrn-cat">
            ${ACC_INC_CATS.map(c=>`<option value="${c.value}">${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-control" id="jrn-desc" placeholder="Entry description">
        </div>
        <div class="form-group">
          <label class="form-label">Amount (${SETTINGS.currency||'GH₵'})</label>
          <input type="number" class="form-control" id="jrn-amount" placeholder="0.00" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="jrn-date" value="${todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label">Paid To / Received From</label>
          <input type="text" class="form-control" id="jrn-payee" placeholder="Name or company">
        </div>
        <div class="form-group">
          <label class="form-label">Reference No.</label>
          <input type="text" class="form-control" id="jrn-ref" placeholder="Receipt or voucher no.">
        </div>
        <button class="btn btn-gold w-full" onclick="_accPostJournalEntry()">✅ Post Entry</button>
      </div>
      <div class="card">
        <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
          <div class="card-title" style="margin-bottom:0"><span>📒</span> All Entries</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <select class="form-control" style="width:120px;font-size:.78rem" id="jrn-f-type" onchange="_accFilterJournal()">
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <input type="month" class="form-control" style="width:145px;font-size:.78rem" id="jrn-f-month" onchange="_accFilterJournal()">
            <button class="btn btn-outline btn-xs" onclick="window.print()">🖨️</button>
          </div>
        </div>
        <div id="jrn-table-wrap">${_accBuildJournalTable(_accAllJournalEntries())}</div>
      </div>
    </div>`;
}

function _accAllJournalEntries() {
  return [
    ...(ACCOUNTING_ENTRIES||[]).map(e=>({...e,_src:'manual'})),
    ...(CARD_COSTS||[]).map(c=>({
      id:c.id, type:'expense', category:'card_printing', cat:'card_printing',
      desc:`Card printing — ${c.quantity} cards @ ${fmt(c.costPerCard)} (${c.supplier||'supplier'})`,
      amount:c.totalCost, date:c.date, ref:'', by:c.by, _src:'card_cost'
    })),
    ...(CARD_REPLACEMENTS||[]).map(r=>({
      id:r.id, type:'income', category:'card_fees', cat:'card_fees',
      desc:`Card sale — ${r.name||r.acctNumber||''} (${r.reason||'replacement'})`,
      amount:(r.fee||SETTINGS.cardFee||0), date:r.date, by:r.by||'', _src:'card_sale'
    })),
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));
}

function _accBuildJournalTable(entries) {
  if (!entries.length) return `<div class="empty-state" style="padding:40px 0"><div class="ei">📒</div><div class="et">No entries found</div></div>`;
  const totalInc = entries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0);
  const totalExp = entries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const net      = totalInc - totalExp;
  const cats     = ACC_EXP_CATS.concat(ACC_INC_CATS);
  return `
    <div class="table-wrap" style="max-height:540px;overflow-y:auto">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Ref</th><th>By</th><th></th></tr></thead>
        <tbody>
          ${entries.map(e=>{
            const cat   = cats.find(c=>c.value===(e.category||e.cat));
            const catLbl= cat?cat.icon+' '+cat.label:(e.category||e.cat||'—');
            return `<tr>
              <td style="font-size:.74rem;white-space:nowrap">${fmtDate(e.date)}</td>
              <td><span class="badge ${e.type==='income'?'b-green':'b-red'}" style="font-size:.6rem">${e.type}</span></td>
              <td style="font-size:.74rem">${catLbl}</td>
              <td style="font-size:.79rem;max-width:180px">${e.desc||'—'}</td>
              <td class="mono ${e.type==='income'?'text-success':'text-danger'}" style="white-space:nowrap">${e.type==='income'?'+ ':'- '}${fmt(e.amount)}</td>
              <td style="font-size:.71rem;color:var(--muted)">${e.ref||'—'}</td>
              <td style="font-size:.71rem;color:var(--muted)">${e.by||'—'}</td>
              <td>${e._src==='manual'?`<button class="btn btn-danger btn-xs" onclick="_accDeleteEntry('${e.id}','_accRenderJournal')">✕</button>`:e._src==='card_cost'?`<button class="btn btn-danger btn-xs" onclick="_accDeleteCardCost('${e.id}','_accRenderJournal')">✕</button>`:'<span style="opacity:.3;font-size:.68rem">auto</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--surface2);font-weight:700;font-size:.81rem">
            <td colspan="4" style="padding:8px 12px">
              <span class="text-success">In: ${fmt(totalInc)}</span>
              &nbsp;·&nbsp;
              <span class="text-danger">Out: ${fmt(totalExp)}</span>
            </td>
            <td class="mono fw-600" style="padding:8px 12px;color:${net>=0?'var(--success)':'var(--danger)'}">Net: ${net>=0?'+':''}${fmt(net)}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function _accJrnTypeChanged() {
  const type  = document.getElementById('jrn-type')?.value;
  const catEl = document.getElementById('jrn-cat'); if (!catEl) return;
  const cats  = type==='income' ? ACC_INC_CATS : ACC_EXP_CATS;
  catEl.innerHTML = cats.map(c=>`<option value="${c.value}">${c.icon} ${c.label}</option>`).join('');
}

function _accFilterJournal() {
  const typeF  = document.getElementById('jrn-f-type')?.value;
  const monthF = document.getElementById('jrn-f-month')?.value;
  let entries  = _accAllJournalEntries();
  if (typeF)  entries = entries.filter(e=>e.type===typeF);
  if (monthF) entries = entries.filter(e=>(e.date||'').startsWith(monthF));
  const wrap = document.getElementById('jrn-table-wrap');
  if (wrap) wrap.innerHTML = _accBuildJournalTable(entries);
}

function _accPostJournalEntry() {
  const type   = document.getElementById('jrn-type')?.value;
  const cat    = document.getElementById('jrn-cat')?.value;
  const desc   = (document.getElementById('jrn-desc')?.value||'').trim();
  const amount = parseFloat(document.getElementById('jrn-amount')?.value);
  const date   = document.getElementById('jrn-date')?.value || todayISO();
  const payee  = (document.getElementById('jrn-payee')?.value||'').trim();
  const ref    = (document.getElementById('jrn-ref')?.value||'').trim();

  if (!desc)           return toast('Enter a description','error');
  if (!amount||amount<=0) return toast('Enter a valid amount','error');

  ACCOUNTING_ENTRIES.push({
    id:uid(), type, category:cat, cat, desc, amount, date, payee, ref,
    by:currentUser?.name||'System', createdAt:new Date().toISOString()
  });
  saveAll();
  logActivity('Accounting',`${type}: ${desc} — ${fmt(amount)}`,amount,type);
  toast('Journal entry posted ✅','success');
  ['jrn-desc','jrn-amount','jrn-payee','jrn-ref'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.value='';
  });
  _accFilterJournal();
}

// ══════════════════════════════════════════════════════
//  3. INCOME
// ══════════════════════════════════════════════════════
function _accRenderIncome() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;
  const m = _accThisMonth();

  const autoSrcs = [
    { label:'Loan Interest Earned',  icon:'💰', code:'4001', all:_accLoanInterest(null),   month:_accLoanInterest(m)   },
    { label:'Card Replacement Fees', icon:'💳', code:'4002', all:_accCardIncome(null),     month:_accCardIncome(m)     },
    { label:'Collaboration Inflows', icon:'🤝', code:'4005', all:_accCollabInflows(null),  month:_accCollabInflows(m)  },
    { label:'Investment Returns',    icon:'📈', code:'4004', all:_accInvReturns(null),     month:_accInvReturns(m)     },
  ];
  const manualEntries = [...(ACCOUNTING_ENTRIES||[])].filter(e=>e.type==='income').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const totalAuto    = autoSrcs.reduce((s,a)=>s+a.all,0);
  const totalManual  = manualEntries.reduce((s,e)=>s+e.amount,0);
  const grandTotal   = totalAuto + totalManual;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">
      <div class="card" style="position:sticky;top:70px">
        <div class="card-title"><span>💰</span> Record Manual Income</div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="inc-cat">
            ${ACC_INC_CATS.map(c=>`<option value="${c.value}">${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (${SETTINGS.currency||'GH₵'})</label>
          <input type="number" class="form-control" id="inc-amount" placeholder="0.00" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="inc-date" value="${todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-control" id="inc-desc" placeholder="Source or details">
        </div>
        <div class="form-group">
          <label class="form-label">Received From</label>
          <input type="text" class="form-control" id="inc-payer" placeholder="Payer name">
        </div>
        <div class="form-group">
          <label class="form-label">Reference No.</label>
          <input type="text" class="form-control" id="inc-ref" placeholder="Receipt number">
        </div>
        <button class="btn btn-gold w-full" onclick="_accPostIncome()">✅ Post Income</button>
        <div style="margin-top:12px;padding:9px 12px;background:rgba(46,204,138,.07);border:1px solid rgba(46,204,138,.18);border-radius:var(--radius-sm);font-size:.74rem;color:var(--muted)">
          ℹ️ Loan interest, card fees, collaboration inflows, and investment returns are <strong>auto-calculated</strong> from system data and shown below.
        </div>
      </div>
      <div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="padding:14px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);border-radius:var(--radius)">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">TOTAL INCOME</div>
            <div class="mono text-success fw-600" style="font-size:1.1rem;margin-top:3px">${fmt(grandTotal)}</div>
          </div>
          <div style="padding:14px;background:var(--gold-dim);border:1px solid var(--border);border-radius:var(--radius)">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">AUTO-CALCULATED</div>
            <div class="mono text-gold fw-600" style="font-size:1.1rem;margin-top:3px">${fmt(totalAuto)}</div>
          </div>
          <div style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius)">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">MANUAL ENTRIES</div>
            <div class="mono fw-600" style="font-size:1.1rem;margin-top:3px">${fmt(totalManual)}</div>
          </div>
        </div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-title"><span>🤖</span> Auto-Calculated Income Sources</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Source</th><th>Code</th><th>This Month</th><th>All Time</th></tr></thead>
              <tbody>
                ${autoSrcs.map(a=>`
                  <tr>
                    <td>${a.icon} ${a.label}</td>
                    <td class="mono text-muted" style="font-size:.75rem">${a.code}</td>
                    <td class="mono text-success">${fmt(a.month)}</td>
                    <td class="mono text-gold fw-600">${fmt(a.all)}</td>
                  </tr>`).join('')}
                <tr style="background:var(--surface2);font-weight:700;font-size:.82rem">
                  <td colspan="2">Total Auto</td>
                  <td class="mono text-success">${fmt(autoSrcs.reduce((s,a)=>s+a.month,0))}</td>
                  <td class="mono text-gold">${fmt(totalAuto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
            <div class="card-title" style="margin-bottom:0"><span>📋</span> Manual Income Entries</div>
            <input type="month" class="form-control" style="width:145px;font-size:.78rem" id="inc-f-month" onchange="_accFilterIncomeTable()">
          </div>
          <div id="inc-table-wrap">${_accBuildIncomeTable(manualEntries)}</div>
        </div>
      </div>
    </div>`;
}

function _accBuildIncomeTable(entries) {
  if (!entries.length) return `<div class="empty-state" style="padding:24px 0"><div class="ei">💰</div><div class="et">No manual income entries</div></div>`;
  const total = entries.reduce((s,e)=>s+e.amount,0);
  return `
    <div class="table-wrap" style="max-height:400px;overflow-y:auto">
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>From</th><th>Ref</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          ${entries.map(e=>{
            const cat=ACC_INC_CATS.find(c=>c.value===(e.category||e.cat));
            return `<tr>
              <td style="font-size:.75rem;white-space:nowrap">${fmtDate(e.date)}</td>
              <td style="font-size:.77rem">${cat?cat.icon+' '+cat.label:(e.category||'—')}</td>
              <td style="font-size:.8rem">${e.desc||'—'}</td>
              <td style="font-size:.75rem;color:var(--muted)">${e.payee||e.payer||'—'}</td>
              <td style="font-size:.71rem;color:var(--muted)">${e.ref||'—'}</td>
              <td class="mono text-success fw-600" style="white-space:nowrap">+ ${fmt(e.amount)}</td>
              <td><button class="btn btn-danger btn-xs" onclick="_accDeleteEntry('${e.id}','_accRenderIncome')">✕</button></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--surface2);font-weight:700">
            <td colspan="5" style="padding:8px 12px">Total Manual Income</td>
            <td class="mono text-success" style="padding:8px 12px">+ ${fmt(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function _accFilterIncomeTable() {
  const mf = document.getElementById('inc-f-month')?.value;
  let entries = (ACCOUNTING_ENTRIES||[]).filter(e=>e.type==='income').sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (mf) entries = entries.filter(e=>(e.date||'').startsWith(mf));
  const wrap = document.getElementById('inc-table-wrap');
  if (wrap) wrap.innerHTML = _accBuildIncomeTable(entries);
}

function _accPostIncome() {
  const cat    = document.getElementById('inc-cat')?.value;
  const amount = parseFloat(document.getElementById('inc-amount')?.value);
  const date   = document.getElementById('inc-date')?.value || todayISO();
  const desc   = (document.getElementById('inc-desc')?.value||'').trim();
  const payee  = (document.getElementById('inc-payer')?.value||'').trim();
  const ref    = (document.getElementById('inc-ref')?.value||'').trim();
  if (!amount||amount<=0) return toast('Enter a valid amount','error');
  if (!desc)              return toast('Enter a description','error');
  ACCOUNTING_ENTRIES.push({id:uid(),type:'income',category:cat,cat,desc,amount,date,payee,ref,by:currentUser?.name||'System',createdAt:new Date().toISOString()});
  saveAll();
  logActivity('Accounting',`Income: ${desc} — ${fmt(amount)}`,amount,'income');
  toast('Income posted ✅','success');
  ['inc-amount','inc-desc','inc-payer','inc-ref'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  _accRenderIncome();
}

// ══════════════════════════════════════════════════════
//  4. EXPENSES
// ══════════════════════════════════════════════════════
function _accRenderExpenses() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;

  const allExpenses = [
    ...(ACCOUNTING_ENTRIES||[]).filter(e=>e.type==='expense').map(e=>({...e,_src:'manual'})),
    ...(CARD_COSTS||[]).map(c=>({
      id:c.id, type:'expense', category:'card_printing', cat:'card_printing',
      desc:`Card printing — ${c.quantity} cards @ ${fmt(c.costPerCard)} each`,
      amount:c.totalCost, date:c.date, payee:c.supplier||'', ref:'', by:c.by, _src:'card_cost', _cc:c
    })),
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));

  const totalExp  = allExpenses.reduce((s,e)=>s+e.amount,0);
  const m         = _accThisMonth();
  const monthExp  = allExpenses.filter(e=>(e.date||'').startsWith(m)).reduce((s,e)=>s+e.amount,0);

  const catTotals = {};
  ACC_EXP_CATS.forEach(c=>{catTotals[c.value]=0;});
  allExpenses.forEach(e=>{const k=e.category||e.cat||'miscellaneous';catTotals[k]=(catTotals[k]||0)+e.amount;});
  const topCats = Object.entries(catTotals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">
      <div class="card" style="position:sticky;top:70px">
        <div class="card-title"><span>💸</span> Record Expense</div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="exp-cat">
            ${ACC_EXP_CATS.map(c=>`<option value="${c.value}">${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-control" id="exp-desc" placeholder="What was this expense for?">
        </div>
        <div class="form-group">
          <label class="form-label">Amount (${SETTINGS.currency||'GH₵'})</label>
          <input type="number" class="form-control" id="exp-amount" placeholder="0.00" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="exp-date" value="${todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label">Paid To</label>
          <input type="text" class="form-control" id="exp-payee" placeholder="Supplier or recipient">
        </div>
        <div class="form-group">
          <label class="form-label">Reference / Receipt No.</label>
          <input type="text" class="form-control" id="exp-ref" placeholder="Voucher or receipt no.">
        </div>
        <button class="btn btn-gold w-full" onclick="_accPostExpense()">✅ Post Expense</button>
      </div>
      <div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="padding:14px;background:rgba(232,93,93,.08);border:1px solid rgba(232,93,93,.2);border-radius:var(--radius)">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">TOTAL EXPENSES</div>
            <div class="mono text-danger fw-600" style="font-size:1.1rem;margin-top:3px">${fmt(totalExp)}</div>
          </div>
          <div style="padding:14px;background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.2);border-radius:var(--radius)">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">THIS MONTH</div>
            <div class="mono text-warning fw-600" style="font-size:1.1rem;margin-top:3px">${fmt(monthExp)}</div>
          </div>
          <div style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius)">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">TOTAL ENTRIES</div>
            <div class="mono fw-600" style="font-size:1.1rem;margin-top:3px">${allExpenses.length}</div>
          </div>
        </div>
        ${topCats.length ? `
          <div class="card" style="margin-bottom:14px">
            <div class="card-title"><span>📊</span> Expense Breakdown</div>
            ${topCats.map(([key,val])=>{
              const cat=ACC_EXP_CATS.find(c=>c.value===key);
              const pct=Math.round((val/totalExp)*100);
              return `<div style="margin-bottom:8px">
                <div class="flex-between" style="margin-bottom:3px;font-size:.82rem">
                  <span>${cat?cat.icon+' '+cat.label:key}</span>
                  <span class="mono text-danger">${fmt(val)} <span class="text-muted" style="font-size:.7rem">(${pct}%)</span></span>
                </div>
                <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:var(--danger)"></div></div>
              </div>`;
            }).join('')}
          </div>` : ''}
        <div class="card">
          <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
            <div class="card-title" style="margin-bottom:0"><span>📋</span> All Expenses</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <select class="form-control" style="width:160px;font-size:.78rem" id="exp-f-cat" onchange="_accFilterExpenses()">
                <option value="">All Categories</option>
                ${ACC_EXP_CATS.map(c=>`<option value="${c.value}">${c.icon} ${c.label}</option>`).join('')}
              </select>
              <input type="month" class="form-control" style="width:145px;font-size:.78rem" id="exp-f-month" onchange="_accFilterExpenses()">
              <button class="btn btn-outline btn-xs" onclick="window.print()">🖨️</button>
            </div>
          </div>
          <div id="exp-table-wrap">${_accBuildExpTable(allExpenses)}</div>
        </div>
      </div>
    </div>`;
}

function _accBuildExpTable(entries) {
  if (!entries.length) return `<div class="empty-state" style="padding:28px 0"><div class="ei">💸</div><div class="et">No expenses found</div></div>`;
  const total = entries.reduce((s,e)=>s+e.amount,0);
  return `
    <div class="table-wrap" style="max-height:500px;overflow-y:auto">
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid To</th><th>Ref</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          ${entries.map(e=>{
            const cat=ACC_EXP_CATS.find(c=>c.value===(e.category||e.cat));
            return `<tr>
              <td style="font-size:.74px;white-space:nowrap;font-size:.74rem">${fmtDate(e.date)}</td>
              <td style="font-size:.75rem">${cat?cat.icon+' '+cat.label:(e.category||'—')}</td>
              <td style="font-size:.8rem;max-width:180px">${e.desc||'—'}</td>
              <td style="font-size:.75rem;color:var(--muted)">${e.payee||e._cc?.supplier||'—'}</td>
              <td style="font-size:.71rem;color:var(--muted)">${e.ref||'—'}</td>
              <td class="mono text-danger fw-600" style="white-space:nowrap">- ${fmt(e.amount)}</td>
              <td>${e._src==='manual'?`<button class="btn btn-danger btn-xs" onclick="_accDeleteEntry('${e.id}','_accRenderExpenses')">✕</button>`:e._src==='card_cost'?`<button class="btn btn-danger btn-xs" onclick="_accDeleteCardCost('${e.id}','_accRenderExpenses')">✕</button>`:''}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--surface2);font-weight:700">
            <td colspan="5" style="padding:8px 12px">Total Expenses</td>
            <td class="mono text-danger" style="padding:8px 12px">- ${fmt(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function _accFilterExpenses() {
  const catF  = document.getElementById('exp-f-cat')?.value;
  const monthF= document.getElementById('exp-f-month')?.value;
  let entries = [
    ...(ACCOUNTING_ENTRIES||[]).filter(e=>e.type==='expense').map(e=>({...e,_src:'manual'})),
    ...(CARD_COSTS||[]).map(c=>({id:c.id,type:'expense',category:'card_printing',cat:'card_printing',desc:`Card printing — ${c.quantity} cards`,amount:c.totalCost,date:c.date,payee:c.supplier||'',_src:'card_cost',_cc:c})),
  ].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (catF)  entries = entries.filter(e=>(e.category||e.cat)===catF);
  if (monthF)entries = entries.filter(e=>(e.date||'').startsWith(monthF));
  const wrap = document.getElementById('exp-table-wrap');
  if (wrap) wrap.innerHTML = _accBuildExpTable(entries);
}

function _accPostExpense() {
  const cat    = document.getElementById('exp-cat')?.value;
  const desc   = (document.getElementById('exp-desc')?.value||'').trim();
  const amount = parseFloat(document.getElementById('exp-amount')?.value);
  const date   = document.getElementById('exp-date')?.value || todayISO();
  const payee  = (document.getElementById('exp-payee')?.value||'').trim();
  const ref    = (document.getElementById('exp-ref')?.value||'').trim();
  if (!desc)           return toast('Enter a description','error');
  if (!amount||amount<=0) return toast('Enter a valid amount','error');
  ACCOUNTING_ENTRIES.push({id:uid(),type:'expense',category:cat,cat,desc,amount,date,payee,ref,by:currentUser?.name||'System',createdAt:new Date().toISOString()});
  saveAll();
  logActivity('Accounting',`Expense: ${desc} — ${fmt(amount)}`,amount,'expense');
  toast('Expense posted ✅','success');
  ['exp-desc','exp-amount','exp-payee','exp-ref'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  _accRenderExpenses();
}

// ══════════════════════════════════════════════════════
//  5. CARD ACCOUNTS
// ══════════════════════════════════════════════════════
function _accRenderCards() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;

  const sales      = (CARD_REPLACEMENTS||[]).map(r=>({id:r.id,date:r.date,customer:r.name||r.acctNumber||'',reason:r.reason||'replacement',income:(r.fee||SETTINGS.cardFee||0),by:r.by||''}));
  const costs      = CARD_COSTS||[];
  const totalInc   = sales.reduce((s,r)=>s+r.income,0);
  const totalCost  = costs.reduce((s,c)=>s+c.totalCost,0);
  const totalCards = costs.reduce((s,c)=>s+c.quantity,0);
  const netProfit  = totalInc - totalCost;
  const avgCost    = totalCards ? totalCost/totalCards : 0;
  const avgInc     = sales.length ? totalInc/sales.length : 0;
  const margin     = totalInc ? ((netProfit/totalInc)*100).toFixed(1) : '0.0';

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px">
      ${[
        {label:'Cards Sold',       val:sales.length,    mono:false,color:''},
        {label:'Sales Income',     val:fmt(totalInc),   mono:true, color:'text-success'},
        {label:'Printing Costs',   val:fmt(totalCost),  mono:true, color:'text-danger'},
        {label:'Net Profit',       val:fmt(netProfit),  mono:true, color:netProfit>=0?'text-success':'text-danger'},
        {label:'Profit Margin',    val:margin+'%',      mono:false,color:parseFloat(margin)>=0?'text-success':'text-danger'},
      ].map(k=>`
        <div style="padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);text-align:center">
          <div class="text-muted" style="font-size:.66rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${k.label}</div>
          <div class="${k.mono?'mono':''} fw-600 ${k.color}" style="font-size:1rem">${k.val}</div>
        </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">
      <div class="card" style="position:sticky;top:70px">
        <div class="card-title"><span>🖨️</span> Record Card Printing Cost</div>
        <div class="alert alert-info" style="font-size:.75rem;margin-bottom:12px">
          Record each batch of cards printed or procured. Compare against your selling price to track profit per card.
        </div>
        <div class="form-group">
          <label class="form-label">Date of Printing / Purchase</label>
          <input type="date" class="form-control" id="cc-date" value="${todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label">No. of Cards in Batch</label>
          <input type="number" class="form-control" id="cc-qty" placeholder="e.g. 100" min="1" step="1" oninput="_accCalcCardPreview()">
        </div>
        <div class="form-group">
          <label class="form-label">Cost Per Card (${SETTINGS.currency||'GH₵'})</label>
          <input type="number" class="form-control" id="cc-cost" placeholder="e.g. 2.50" min="0" step="0.01" oninput="_accCalcCardPreview()">
        </div>
        <div id="cc-preview" style="display:none;padding:10px 12px;background:var(--gold-dim);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:10px;font-size:.82rem">
          <div class="flex-between"><span class="text-muted">Total Batch Cost</span><span class="mono text-gold fw-600" id="cc-total">—</span></div>
          <div class="flex-between" style="margin-top:4px"><span class="text-muted">Selling Price / Card</span><span class="mono">${fmt(SETTINGS.cardFee||0)}</span></div>
          <div class="flex-between" style="margin-top:4px"><span class="text-muted">Profit / Card</span><span class="mono fw-600" id="cc-profit">—</span></div>
        </div>
        <div class="form-group">
          <label class="form-label">Supplier / Printer</label>
          <input type="text" class="form-control" id="cc-supplier" placeholder="e.g. ABC Printing Co.">
        </div>
        <div class="form-group">
          <label class="form-label">Card Type</label>
          <select class="form-control" id="cc-type">
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
            <option value="nfc">NFC / Smart Card</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input type="text" class="form-control" id="cc-notes" placeholder="Batch reference or notes">
        </div>
        <button class="btn btn-gold w-full" onclick="_accPostCardCost()">✅ Record Card Cost</button>
      </div>

      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-title"><span>🖨️</span> Card Printing Cost Batches</div>
          ${costs.length ? `
            <div class="table-wrap" style="max-height:300px;overflow-y:auto">
              <table>
                <thead><tr><th>Date</th><th>Qty</th><th>Cost/Card</th><th>Total Cost</th><th>Supplier</th><th>Type</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  ${costs.map(c=>`<tr>
                    <td style="font-size:.75rem;white-space:nowrap">${fmtDate(c.date)}</td>
                    <td class="mono fw-600">${c.quantity}</td>
                    <td class="mono">${fmt(c.costPerCard)}</td>
                    <td class="mono text-danger fw-600">- ${fmt(c.totalCost)}</td>
                    <td style="font-size:.78rem">${c.supplier||'—'}</td>
                    <td style="font-size:.75rem;text-transform:capitalize">${c.cardType||'standard'}</td>
                    <td style="font-size:.72rem;color:var(--muted)">${c.notes||'—'}</td>
                    <td><button class="btn btn-danger btn-xs" onclick="_accDeleteCardCost('${c.id}','_accRenderCards')">✕</button></td>
                  </tr>`).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:var(--surface2);font-weight:700;font-size:.81rem">
                    <td style="padding:8px 12px">Totals</td>
                    <td class="mono" style="padding:8px 12px">${totalCards}</td>
                    <td class="mono" style="padding:8px 12px">${fmt(avgCost)}</td>
                    <td class="mono text-danger" style="padding:8px 12px">- ${fmt(totalCost)}</td>
                    <td colspan="4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>` : `<div class="empty-state" style="padding:20px 0"><div class="ei">🖨️</div><div class="et">No card cost batches recorded</div></div>`}
        </div>

        <div class="card">
          <div class="flex-between mb-3" style="flex-wrap:wrap;gap:8px">
            <div class="card-title" style="margin-bottom:0"><span>💰</span> Card Sales Income</div>
            <div style="font-size:.8rem;color:var(--muted)">
              Selling price: <strong class="mono text-gold">${fmt(SETTINGS.cardFee||0)}</strong> &nbsp;·&nbsp;
              Avg cost: <strong class="mono text-danger">${fmt(avgCost)}</strong>
            </div>
          </div>
          ${sales.length ? `
            <div class="table-wrap" style="max-height:380px;overflow-y:auto">
              <table>
                <thead><tr><th>Date</th><th>Customer</th><th>Reason</th><th>Sale Price</th><th>Cost Price</th><th>Profit</th><th>By</th></tr></thead>
                <tbody>
                  ${sales.map(s=>{
                    const profit=s.income-avgCost;
                    return `<tr>
                      <td style="font-size:.74rem;white-space:nowrap">${fmtDate(s.date)}</td>
                      <td style="font-size:.82rem">${s.customer}</td>
                      <td style="font-size:.75rem;text-transform:capitalize">${s.reason}</td>
                      <td class="mono text-success">+ ${fmt(s.income)}</td>
                      <td class="mono text-danger">${fmt(avgCost)}</td>
                      <td class="mono fw-600" style="color:${profit>=0?'var(--success)':'var(--danger)'}">${profit>=0?'+ ':'- '}${fmt(Math.abs(profit))}</td>
                      <td style="font-size:.72rem;color:var(--muted)">${s.by}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:var(--surface2);font-weight:700;font-size:.81rem">
                    <td colspan="3" style="padding:8px 12px">Totals (${sales.length} cards)</td>
                    <td class="mono text-success" style="padding:8px 12px">+ ${fmt(totalInc)}</td>
                    <td class="mono text-danger" style="padding:8px 12px">${fmt(avgCost*sales.length)}</td>
                    <td class="mono fw-600" style="padding:8px 12px;color:${netProfit>=0?'var(--success)':'var(--danger)'}">${netProfit>=0?'+ ':'- '}${fmt(Math.abs(netProfit))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>` : `<div class="empty-state" style="padding:20px 0"><div class="ei">💳</div><div class="et">No card replacements yet</div></div>`}
        </div>
      </div>
    </div>`;
}

function _accCalcCardPreview() {
  const qty   = parseFloat(document.getElementById('cc-qty')?.value)  || 0;
  const cost  = parseFloat(document.getElementById('cc-cost')?.value) || 0;
  const total = qty * cost;
  const prev  = document.getElementById('cc-preview');
  if (qty > 0 && cost > 0) {
    if (prev) prev.style.display = 'block';
    const totEl  = document.getElementById('cc-total');
    const profEl = document.getElementById('cc-profit');
    if (totEl)  totEl.textContent  = fmt(total);
    if (profEl) {
      const p = (SETTINGS.cardFee||0) - cost;
      profEl.textContent  = fmt(p);
      profEl.style.color  = p >= 0 ? 'var(--success)' : 'var(--danger)';
    }
  } else {
    if (prev) prev.style.display = 'none';
  }
}

function _accPostCardCost() {
  const date     = document.getElementById('cc-date')?.value     || todayISO();
  const qty      = parseInt(document.getElementById('cc-qty')?.value)    || 0;
  const costPer  = parseFloat(document.getElementById('cc-cost')?.value) || 0;
  const supplier = (document.getElementById('cc-supplier')?.value||'').trim();
  const cardType = document.getElementById('cc-type')?.value     || 'standard';
  const notes    = (document.getElementById('cc-notes')?.value||'').trim();
  if (!qty||qty<=0)        return toast('Enter number of cards','error');
  if (!costPer||costPer<=0)return toast('Enter cost per card','error');
  const entry = {
    id:uid(), date, quantity:qty, costPerCard:costPer,
    totalCost:Math.round(qty*costPer*100)/100,
    supplier, cardType, notes,
    by:currentUser?.name||'System', createdAt:new Date().toISOString()
  };
  CARD_COSTS.push(entry);
  saveAll();
  logActivity('Accounting',`Card cost: ${qty} cards @ ${fmt(costPer)} = ${fmt(entry.totalCost)}`,entry.totalCost,'card_cost');
  toast('Card cost recorded ✅','success');
  ['cc-qty','cc-cost','cc-supplier','cc-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const prev=document.getElementById('cc-preview');if(prev)prev.style.display='none';
  _accRenderCards();
}

// ══════════════════════════════════════════════════════
//  6. LOAN LEDGER
// ══════════════════════════════════════════════════════
function _accRenderLoans() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;
  const loans         = LOANS||[];
  const totalDisb     = loans.reduce((s,l)=>s+(l.amount||0),0);
  const totalRepay    = loans.reduce((s,l)=>s+(l.totalRepayment||0),0);
  const totalCollect  = loans.reduce((s,l)=>s+(l.payments||[]).reduce((a,p)=>a+p.amount,0),0);
  const totalOut      = loans.reduce((s,l)=>s+Math.max(0,(l.totalRepayment||0)-(l.payments||[]).reduce((a,p)=>a+p.amount,0)),0);
  const totalInt      = loans.reduce((s,l)=>s+(l.interest||0),0);
  const intCollected  = _accLoanInterest(null);
  const overdueLoans  = loans.filter(l=>l.status==='active'&&(l.schedule||[]).some(s=>!s.paid&&new Date(s.dueDate)<new Date()));

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
      ${[
        {label:'Total Disbursed',    val:fmt(totalDisb),    color:'text-gold'},
        {label:'Total Collectible',  val:fmt(totalRepay),   color:''},
        {label:'Total Collected',    val:fmt(totalCollect), color:'text-success'},
        {label:'Outstanding',        val:fmt(totalOut),     color:'text-danger'},
        {label:'Total Interest',     val:fmt(totalInt),     color:'text-gold'},
        {label:'Interest Collected', val:fmt(intCollected), color:'text-success'},
        {label:'Overdue Loans',      val:overdueLoans.length, color:overdueLoans.length>0?'text-danger':'text-success'},
        {label:'Active Loans',       val:loans.filter(l=>l.status==='active').length, color:'text-info'},
      ].map(k=>`
        <div style="padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius)">
          <div class="text-muted" style="font-size:.66rem;text-transform:uppercase;letter-spacing:1px">${k.label}</div>
          <div class="mono fw-600 ${k.color}" style="font-size:.98rem;margin-top:3px">${typeof k.val==='number'?k.val:k.val}</div>
        </div>`).join('')}
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:flex-end">
      <div>
        <label class="form-label">Status</label>
        <select class="form-control" id="ll-status" style="width:130px" onchange="_accFilterLoanLedger()">
          <option value="">All Loans</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <div>
        <label class="form-label">Agent</label>
        <select class="form-control" id="ll-agent" style="width:200px" onchange="_accFilterLoanLedger()">
          <option value="">All Agents</option>
          ${(AGENTS||[]).map(a=>`<option value="${a.id}">${a.code} — ${a.firstName} ${a.lastName}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Print Ledger</button>
    </div>

    <div class="card">
      <div id="ll-table-wrap">${_accBuildLoanTable(loans)}</div>
    </div>`;
}

function _accFilterLoanLedger() {
  const statusF = document.getElementById('ll-status')?.value;
  const agentF  = document.getElementById('ll-agent')?.value;
  let   loans   = [...(LOANS||[])];
  if (agentF) loans = loans.filter(l=>l.agentId===agentF);
  if (statusF==='overdue') {
    loans = loans.filter(l=>l.status==='active'&&(l.schedule||[]).some(s=>!s.paid&&new Date(s.dueDate)<new Date()));
  } else if (statusF) {
    loans = loans.filter(l=>l.status===statusF);
  }
  const wrap=document.getElementById('ll-table-wrap');
  if (wrap) wrap.innerHTML=_accBuildLoanTable(loans);
}

function _accBuildLoanTable(loans) {
  if (!loans.length) return `<div class="empty-state" style="padding:40px 0"><div class="ei">🏦</div><div class="et">No loans found</div></div>`;
  const tD=loans.reduce((s,l)=>s+(l.amount||0),0);
  const tI=loans.reduce((s,l)=>s+(l.interest||0),0);
  const tR=loans.reduce((s,l)=>s+(l.totalRepayment||0),0);
  const tC=loans.reduce((s,l)=>s+(l.payments||[]).reduce((a,p)=>a+p.amount,0),0);
  const tO=loans.reduce((s,l)=>s+Math.max(0,(l.totalRepayment||0)-(l.payments||[]).reduce((a,p)=>a+p.amount,0)),0);
  return `
    <div class="table-wrap" style="max-height:600px;overflow-y:auto">
      <table>
        <thead><tr><th>Loan #</th><th>Customer</th><th>Agent</th><th>Disbursed</th><th>Interest</th><th>Total Repay</th><th>Collected</th><th>Outstanding</th><th>Status</th></tr></thead>
        <tbody>
          ${loans.map(l=>{
            const paid=((l.payments||[]).reduce((s,p)=>s+p.amount,0));
            const out =Math.max(0,(l.totalRepayment||0)-paid);
            const pct =l.totalRepayment>0?Math.min(100,Math.round(paid/l.totalRepayment*100)):0;
            const isOD=l.status==='active'&&(l.schedule||[]).some(s=>!s.paid&&new Date(s.dueDate)<new Date());
            return `<tr>
              <td class="mono text-gold" style="font-size:.75rem">${l.loanNum}</td>
              <td>
                <div class="fw-600" style="font-size:.82rem">${l.customerName}</div>
                <div class="text-muted" style="font-size:.7rem">${l.acctNumber||''}</div>
              </td>
              <td style="font-size:.78rem">${l.agentName||'—'}</td>
              <td class="mono">${fmt(l.amount||0)}</td>
              <td class="mono text-gold">${fmt(l.interest||0)}</td>
              <td class="mono">${fmt(l.totalRepayment||0)}</td>
              <td>
                <div class="mono text-success">${fmt(paid)}</div>
                <div class="progress-wrap" style="margin-top:3px;min-width:65px">
                  <div class="progress-bar" style="width:${pct}%"></div>
                </div>
                <div style="font-size:.63rem;color:var(--muted)">${pct}%</div>
              </td>
              <td class="mono fw-600" style="color:${out>0?'var(--danger)':'var(--success)'}">${fmt(out)}</td>
              <td><span class="badge ${isOD?'b-red':l.status==='active'?'b-blue':'b-green'}">${isOD?'Overdue':l.status}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--surface2);font-weight:700;font-size:.81rem">
            <td colspan="3" style="padding:8px 12px">TOTALS (${loans.length})</td>
            <td class="mono" style="padding:8px 12px">${fmt(tD)}</td>
            <td class="mono text-gold" style="padding:8px 12px">${fmt(tI)}</td>
            <td class="mono" style="padding:8px 12px">${fmt(tR)}</td>
            <td class="mono text-success" style="padding:8px 12px">${fmt(tC)}</td>
            <td class="mono text-danger" style="padding:8px 12px">${fmt(tO)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ══════════════════════════════════════════════════════
//  7. TRIAL BALANCE
// ══════════════════════════════════════════════════════
function _accRenderTrial() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;

  const ts   = TELLER_STATE||{};
  const coll = (ts.collections||[]).reduce((s,c)=>s+c.amount,0);
  const wds  = (ts.withdrawals||[]).filter(w=>w.status==='paid').reduce((s,w)=>s+(w.totalDeduction||w.amount||0),0);
  const exps = (ts.expenses||[]).reduce((s,e)=>s+e.amount,0);
  const cash = Math.max(0,(ts.startOfDay||0)+coll-wds-exps);

  const loanRec   = (LOANS||[]).filter(l=>l.status==='active').reduce((s,l)=>s+Math.max(0,(l.totalRepayment||0)-(l.payments||[]).reduce((a,p)=>a+p.amount,0)),0);
  const invPort   = (INVESTMENTS||[]).filter(i=>i.status==='active').reduce((s,i)=>s+(i.amount||0),0);
  const susD      = (CUSTOMERS||[]).filter(c=>c.type==='susu').reduce((s,c)=>s+(c.balance||0),0);
  const savD      = (CUSTOMERS||[]).filter(c=>c.type==='savings').reduce((s,c)=>s+(c.balance||0),0);
  const lenD      = (CUSTOMERS||[]).filter(c=>c.type==='lending').reduce((s,c)=>s+(c.balance||0),0);

  const loanInt   = _accLoanInterest(null);
  const cardInc   = _accCardIncome(null);
  const collInc   = _accCollabInflows(null);
  const invRet    = _accInvReturns(null);
  const manInc    = _accManualType('income',null);
  const cardCst   = _accCardCosts(null);
  const manExp    = _accManualType('expense',null);
  const net       = (loanInt+cardInc+collInc+invRet+manInc) - (cardCst+manExp);

  const rows = [
    {code:'1001',name:'Cash at Hand',            debit:cash,    credit:0       },
    {code:'1003',name:'Loans Receivable',        debit:loanRec, credit:0       },
    {code:'1006',name:'Investment Portfolio',    debit:invPort, credit:0       },
    {code:'2001',name:'Susu Deposits Payable',   debit:0,       credit:susD    },
    {code:'2002',name:'Customer Savings',        debit:0,       credit:savD    },
    {code:'2003',name:'Lending Deposits',        debit:0,       credit:lenD    },
    {code:'3002',name:'Retained Earnings',       debit:0,       credit:Math.max(0,net)},
    {code:'4001',name:'Loan Interest Income',    debit:0,       credit:loanInt },
    {code:'4002',name:'Card Replacement Fees',   debit:0,       credit:cardInc },
    {code:'4005',name:'Collaboration Inflows',   debit:0,       credit:collInc },
    {code:'4004',name:'Investment Returns',      debit:0,       credit:invRet  },
    {code:'4007',name:'Other Income (Manual)',   debit:0,       credit:manInc  },
    {code:'5001',name:'Card Printing Costs',     debit:cardCst, credit:0       },
    ...ACC_EXP_CATS.filter(c=>c.value!=='card_printing').map(c=>({
      code:c.code, name:c.label,
      debit:_accManualCat(c.value,null), credit:0
    })),
  ].filter(r=>r.debit>0||r.credit>0).sort((a,b)=>a.code.localeCompare(b.code));

  const totalDr = rows.reduce((s,r)=>s+r.debit,0);
  const totalCr = rows.reduce((s,r)=>s+r.credit,0);
  const balanced = Math.abs(totalDr-totalCr)<0.01;

  el.innerHTML = `
    <div class="flex-between mb-4" style="flex-wrap:wrap;gap:8px">
      <div class="fw-600" style="font-size:.95rem">⚖️ Trial Balance</div>
      <div style="display:flex;gap:8px;align-items:center">
        ${balanced
          ? `<span class="badge b-green">✅ Balanced</span>`
          : `<span class="badge b-red">⚠️ Difference: ${fmt(Math.abs(totalDr-totalCr))}</span>`}
        <button class="btn btn-outline btn-xs" onclick="window.print()">🖨️ Print</button>
      </div>
    </div>
    <div style="margin-bottom:10px;font-size:.8rem;color:var(--muted)">
      Period: All Time &nbsp;·&nbsp; As at ${fmtDate(todayISO())} &nbsp;·&nbsp; ${SETTINGS.companyName||'Pro Susu Banking'}
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th style="text-align:right">Debit (${SETTINGS.currency||'GH₵'})</th>
              <th style="text-align:right">Credit (${SETTINGS.currency||'GH₵'})</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r=>`
              <tr>
                <td class="mono text-muted" style="font-size:.74rem">${r.code}</td>
                <td style="font-size:.84rem">${r.name}</td>
                <td class="mono" style="text-align:right;color:${r.debit>0?'var(--info)':'var(--muted)'}">${r.debit>0?fmt(r.debit):'—'}</td>
                <td class="mono" style="text-align:right;color:${r.credit>0?'var(--success)':'var(--muted)'}">${r.credit>0?fmt(r.credit):'—'}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface2);font-weight:700;border-top:2px solid var(--border)">
              <td colspan="2" style="padding:10px 14px;font-size:.88rem">TOTALS</td>
              <td class="mono" style="text-align:right;padding:10px 14px;font-size:.95rem">${fmt(totalDr)}</td>
              <td class="mono" style="text-align:right;padding:10px 14px;font-size:.95rem">${fmt(totalCr)}</td>
            </tr>
            ${!balanced?`<tr><td colspan="4" style="text-align:center;padding:8px;color:var(--danger);font-size:.76rem">⚠️ Difference of ${fmt(Math.abs(totalDr-totalCr))} — ensure all transactions are recorded.</td></tr>`:''}
          </tfoot>
        </table>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════
//  8. P&L STATEMENT
// ══════════════════════════════════════════════════════
function _accRenderPL() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;
  el.innerHTML = `
    <div class="flex-between mb-4" style="flex-wrap:wrap;gap:8px">
      <div class="fw-600" style="font-size:.95rem">📈 Profit &amp; Loss Statement</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select class="form-control" id="pl-period" style="width:150px" onchange="_accRenderPLContent()">
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>
        <button class="btn btn-outline btn-xs" onclick="window.print()">🖨️ Print P&amp;L</button>
      </div>
    </div>
    <div id="pl-content"></div>`;
  _accRenderPLContent();
}

function _accRenderPLContent() {
  const el = document.getElementById('pl-content'); if (!el) return;
  const period = document.getElementById('pl-period')?.value || 'month';
  const filter = _accPeriodFilter(period);
  const label  = _accPeriodLabel(period);

  const loanInt  = _accLoanInterest(filter);
  const cardInc  = _accCardIncome(filter);
  const collInc  = _accCollabInflows(filter);
  const invRet   = _accInvReturns(filter);
  const penInc   = (ACCOUNTING_ENTRIES||[]).filter(e=>e.type==='income'&&(e.category==='penalties'||e.cat==='penalties')&&_accFiltDate(e.date,filter)).reduce((s,e)=>s+e.amount,0);
  const commInc  = (ACCOUNTING_ENTRIES||[]).filter(e=>e.type==='income'&&(e.category==='commission'||e.cat==='commission')&&_accFiltDate(e.date,filter)).reduce((s,e)=>s+e.amount,0);
  const othInc   = (ACCOUNTING_ENTRIES||[]).filter(e=>e.type==='income'&&!['penalties','commission','loan_interest','card_fees','collab_inflow','investment_ret'].includes(e.category||e.cat)&&_accFiltDate(e.date,filter)).reduce((s,e)=>s+e.amount,0);
  const grossInc = loanInt+cardInc+collInc+invRet+penInc+commInc+othInc;

  const cardCst  = _accCardCosts(filter);
  const grossPft = grossInc - cardCst;

  const opEx = {};
  ACC_EXP_CATS.filter(c=>c.value!=='card_printing').forEach(c=>{
    opEx[c.value] = (ACCOUNTING_ENTRIES||[]).filter(e=>e.type==='expense'&&(e.category===c.value||e.cat===c.value)&&_accFiltDate(e.date,filter)).reduce((s,e)=>s+e.amount,0);
  });
  const totalOpEx = Object.values(opEx).reduce((s,v)=>s+v,0);
  const netPft    = grossPft - totalOpEx;
  const margin    = grossInc>0?((netPft/grossInc)*100).toFixed(1):'0.0';

  const sec = (title, rows, total, totColor) => {
    const visRows = rows.filter(r=>r[1]!==0);
    return `
      <div style="margin-bottom:16px">
        <div style="padding:9px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius) var(--radius) 0 0;font-weight:700;font-size:.83rem;display:flex;justify-content:space-between">
          <span>${title}</span><span class="mono ${totColor}">${fmt(total)}</span>
        </div>
        ${visRows.map(r=>`
          <div style="padding:7px 14px 7px 24px;display:flex;justify-content:space-between;font-size:.82rem;border:1px solid var(--border);border-top:none">
            <span class="text-muted">${r[0]}</span><span class="mono">${fmt(r[1])}</span>
          </div>`).join('')}
        ${!visRows.length?`<div style="padding:8px 14px 8px 24px;font-size:.78rem;color:var(--muted);border:1px solid var(--border);border-top:none;font-style:italic">No entries in this period</div>`:''}
      </div>`;
  };

  el.innerHTML = `
    <div style="text-align:center;padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:20px">
      <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted)">${SETTINGS.companyName||'Pro Susu Banking'}</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;margin-top:4px">Profit &amp; Loss Statement</div>
      <div class="text-muted" style="font-size:.8rem;margin-top:3px">Period: ${label}</div>
    </div>
    <div class="card" style="max-width:780px;margin:0 auto">
      ${sec('💚 INCOME',[
        ['Loan Interest Earned',  loanInt],
        ['Card Replacement Fees', cardInc],
        ['Late Payment Penalties',penInc],
        ['Collaboration Inflows', collInc],
        ['Investment Returns',    invRet],
        ['Commission Income',     commInc],
        ['Other Income',          othInc],
      ], grossInc, 'text-success')}

      ${sec('🔴 COST OF SALES',[
        ['Card Printing Costs', cardCst],
      ], cardCst, 'text-danger')}

      <div style="padding:11px 14px;background:${grossPft>=0?'rgba(46,204,138,.08)':'rgba(232,93,93,.08)'};border:1px solid ${grossPft>=0?'rgba(46,204,138,.2)':'rgba(232,93,93,.2)'};border-radius:var(--radius-sm);display:flex;justify-content:space-between;font-weight:700;margin-bottom:16px">
        <span>GROSS PROFIT</span>
        <span class="mono" style="color:${grossPft>=0?'var(--success)':'var(--danger)'}">${grossPft>=0?'+':''}${fmt(grossPft)}</span>
      </div>

      ${sec('🔶 OPERATING EXPENSES',
        ACC_EXP_CATS.filter(c=>c.value!=='card_printing').map(c=>[c.icon+' '+c.label, opEx[c.value]||0]),
        totalOpEx, 'text-warning')}

      <div style="padding:16px;background:${netPft>=0?'rgba(46,204,138,.1)':'rgba(232,93,93,.1)'};border:2px solid ${netPft>=0?'rgba(46,204,138,.4)':'rgba(232,93,93,.4)'};border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center;margin-top:4px">
        <div>
          <div style="font-weight:700;font-size:.94rem">${netPft>=0?'📈 NET PROFIT':'📉 NET LOSS'}</div>
          <div class="text-muted" style="font-size:.72rem;margin-top:3px">Profit margin: ${margin}% &nbsp;·&nbsp; ${label}</div>
        </div>
        <div class="mono fw-600" style="font-size:1.5rem;color:${netPft>=0?'var(--success)':'var(--danger)'}">
          ${netPft>=0?'+':''}${fmt(netPft)}
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════
//  9. CHART OF ACCOUNTS
// ══════════════════════════════════════════════════════
function _accRenderCOA() {
  const el = document.getElementById('acc-tab-content'); if (!el) return;
  const groups = {};
  ACC_COA.forEach(a=>{ if (!groups[a.group]) groups[a.group]=[]; groups[a.group].push(a); });
  const typeColors = {asset:'b-blue',liability:'b-yellow',equity:'b-purple',income:'b-green',expense:'b-red'};
  el.innerHTML = `
    <div class="flex-between mb-4" style="flex-wrap:wrap;gap:8px">
      <div class="fw-600" style="font-size:.95rem">🗂️ Chart of Accounts</div>
      <button class="btn btn-outline btn-xs" onclick="window.print()">🖨️ Print</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th>Group</th></tr></thead>
          <tbody>
            ${Object.entries(groups).map(([group,accs])=>`
              <tr style="background:var(--surface2)">
                <td colspan="4" style="padding:7px 14px;font-weight:700;font-size:.73rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">${group}</td>
              </tr>
              ${accs.map(a=>`<tr>
                <td class="mono text-gold" style="font-size:.78rem;padding-left:22px">${a.code}</td>
                <td style="font-size:.84rem">${a.name}</td>
                <td><span class="badge ${typeColors[a.type]||'b-gray'}" style="font-size:.63rem">${a.type}</span></td>
                <td class="text-muted" style="font-size:.76rem">${a.group}</td>
              </tr>`).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════
//  SHARED ACTION HELPERS
// ══════════════════════════════════════════════════════
function _accDeleteEntry(id, reRenderFn) {
  showConfirm('Delete Journal Entry?','This will permanently remove this entry.',()=>{
    ACCOUNTING_ENTRIES = (ACCOUNTING_ENTRIES||[]).filter(e=>e.id!==id);
    saveAll();
    logActivity('Accounting','Deleted journal entry',0,'deleted');
    toast('Entry deleted','warning');
    if (reRenderFn && typeof window[reRenderFn]==='function') window[reRenderFn]();
    else _accRenderOverview();
  });
}

function _accDeleteCardCost(id, reRenderFn) {
  showConfirm('Delete Card Cost Record?','This will remove this printing cost batch.',()=>{
    CARD_COSTS = (CARD_COSTS||[]).filter(c=>c.id!==id);
    saveAll();
    logActivity('Accounting','Deleted card cost record',0,'deleted');
    toast('Record deleted','warning');
    if (reRenderFn && typeof window[reRenderFn]==='function') window[reRenderFn]();
    else _accRenderCards();
  });
}
