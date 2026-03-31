// ═══════════════════════════════════════════════════════
//  INVESTMENTS — FUNCTIONS
// ═══════════════════════════════════════════════════════
let currentInvMode = 'customer';

function switchInvMode(mode, btn) {
  currentInvMode = mode;
  if (btn) {
    btn.closest('.sub-tabs').querySelectorAll('.sub-tab')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  document.getElementById('inv-panel-customer').style.display =
    mode === 'customer' ? '' : 'none';
  document.getElementById('inv-panel-company').style.display =
    mode === 'company'  ? '' : 'none';
  renderInvestments();
}

// ── Customer account lookup ──
function lookupInvCustomer(val) {
  const key  = val.trim().toUpperCase();
  const cust = CUSTOMERS.find(c => c.acctNumber === key);
  const nameEl = document.getElementById('ii-custname');
  if (nameEl) {
    nameEl.value = cust ? `${cust.firstName} ${cust.lastName}` : '';
    nameEl.style.color = cust ? 'var(--success)' : 'var(--danger)';
  }
}

// ── Customer investment returns preview ──
function calcInvReturns() {
  const amt  = parseFloat(document.getElementById('ii-amount')?.value) || 0;
  const roi  = parseFloat(document.getElementById('ii-roi')?.value)    || 0;
  const prev = document.getElementById('inv-returns-preview');
  if (!prev) return;
  if (amt && roi) {
    const returns  = amt * roi / 100;
    const maturity = amt + returns;
    prev.classList.remove('hidden');
    prev.innerHTML =
      `<div class="flex-between">
         <span class="text-muted">Expected Returns</span>
         <span class="mono text-gold fw-600">${fmt(returns)}</span>
       </div>
       <div class="flex-between" style="margin-top:4px">
         <span class="text-muted">Total at Maturity</span>
         <span class="mono text-success fw-600">${fmt(maturity)}</span>
       </div>`;
  } else {
    prev.classList.add('hidden');
  }
}

// ── Company investment returns preview ──
function calcCinvReturns() {
  const amt  = parseFloat(document.getElementById('cinv-amount')?.value) || 0;
  const roi  = parseFloat(document.getElementById('cinv-roi')?.value)    || 0;
  const prev = document.getElementById('cinv-returns-preview');
  if (!prev) return;
  if (amt && roi) {
    const returns  = amt * roi / 100;
    const maturity = amt + returns;
    prev.classList.remove('hidden');
    prev.innerHTML =
      `<div class="flex-between">
         <span class="text-muted">Expected Profit</span>
         <span class="mono text-gold fw-600">${fmt(returns)}</span>
       </div>
       <div class="flex-between" style="margin-top:4px">
         <span class="text-muted">Total Maturity Value</span>
         <span class="mono text-success fw-600">${fmt(maturity)}</span>
       </div>`;
  } else {
    prev.classList.add('hidden');
  }
}

function cinvTypeChanged() {
  const sel  = document.getElementById('cinv-type')?.value;
  const wrap = document.getElementById('cinv-custom-wrap');
  if (wrap) wrap.style.display = sel === '__custom__' ? 'block' : 'none';
}

// ── Add investment (customer or company) ──
function addInvestment(mode) {
  if (mode === 'customer') {
    const acct    = document.getElementById('ii-acct')?.value.trim().toUpperCase();
    const cat     = document.getElementById('ii-cat')?.value;
    const name    = document.getElementById('ii-name')?.value.trim();
    const amount  = parseFloat(document.getElementById('ii-amount')?.value) || 0;
    const roi     = parseFloat(document.getElementById('ii-roi')?.value)    || 0;
    const date    = document.getElementById('ii-date')?.value;
    const maturity= document.getElementById('ii-maturity')?.value;
    const desc    = document.getElementById('ii-desc')?.value.trim();

    if (!acct)   return toast('Enter customer account number', 'error');
    if (!cat)    return toast('Select investment type', 'error');
    if (!name)   return toast('Enter an investment name/label', 'error');
    if (!amount) return toast('Enter investment amount', 'error');
    if (!date)   return toast('Select start date', 'error');

    const cust = CUSTOMERS.find(c => c.acctNumber === acct);
    if (!cust) return toast('Customer account not found', 'error');

    const returns = amount * roi / 100;
    const inv = {
      id             : uid(),
      mode           : 'customer',
      custId         : cust.id,
      custName       : `${cust.firstName} ${cust.lastName}`,
      acct,
      name, category : cat,
      amount, roi,
      returns,
      totalAtMaturity: amount + returns,
      date, maturity, desc,
      status         : 'active',
      dateAdded      : new Date().toISOString(),
      addedBy        : currentUser?.name || 'System'
    };
    INVESTMENTS.push(inv);
    logActivity('Investment', `Customer: ${cust.firstName} — ${fmt(amount)}`, amount, 'active');

    // Reset form
    ['ii-acct','ii-custname','ii-name','ii-amount','ii-roi',
     'ii-date','ii-maturity','ii-desc'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const p = document.getElementById('inv-returns-preview');
    if (p) p.classList.add('hidden');

  } else {
    // Company investment
    let prodType = document.getElementById('cinv-type')?.value;
    if (prodType === '__custom__') {
      prodType = document.getElementById('cinv-custom-type')?.value.trim();
    }
    const desc    = document.getElementById('cinv-desc')?.value.trim();
    const amount  = parseFloat(document.getElementById('cinv-amount')?.value) || 0;
    const roi     = parseFloat(document.getElementById('cinv-roi')?.value)    || 0;
    const qty     = parseFloat(document.getElementById('cinv-qty')?.value)    || 0;
    const unit    = document.getElementById('cinv-unit')?.value.trim();
    const date    = document.getElementById('cinv-date')?.value;
    const maturity= document.getElementById('cinv-maturity')?.value;
    const manager = document.getElementById('cinv-manager')?.value.trim();

    if (!prodType) return toast('Select or enter a product type', 'error');
    if (!amount)   return toast('Enter capital invested', 'error');
    if (!date)     return toast('Select investment date', 'error');

    const returns = amount * roi / 100;
    const inv = {
      id             : uid(),
      mode           : 'company',
      name           : prodType,
      category       : prodType,
      desc, amount, roi, qty, unit,
      returns,
      totalAtMaturity: amount + returns,
      date, maturity, manager,
      status         : 'active',
      dateAdded      : new Date().toISOString(),
      addedBy        : currentUser?.name || 'System'
    };
    INVESTMENTS.push(inv);

    // Save custom product types
    if (!SETTINGS.companyInvProducts) SETTINGS.companyInvProducts = [];
    const builtins = ['Hardware','Rice','Cement','Cryptocurrency','Real Estate',
      'Treasury Bill','Shares / Stocks','Vehicle / Equipment','Livestock','Other'];
    if (prodType && !builtins.includes(prodType) &&
        !SETTINGS.companyInvProducts.includes(prodType)) {
      SETTINGS.companyInvProducts.push(prodType);
      refreshCinvTypeOptions();
    }

    logActivity('Company Investment', `${prodType} — ${fmt(amount)}`, amount, 'active');

    ['cinv-type','cinv-desc','cinv-amount','cinv-roi','cinv-qty',
     'cinv-unit','cinv-date','cinv-maturity','cinv-manager','cinv-custom-type'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const cw = document.getElementById('cinv-custom-wrap');
    if (cw) cw.style.display = 'none';
    const cp = document.getElementById('cinv-returns-preview');
    if (cp) cp.classList.add('hidden');
  }

  saveAll();
  renderInvestments();
  toast('Investment added successfully ✅', 'success');
}

function refreshCinvTypeOptions() {
  const sel     = document.getElementById('cinv-type');
  const customs = SETTINGS.companyInvProducts || [];
  if (!sel || !customs.length) return;
  const lastOpt = sel.querySelector('option[value="__custom__"]');
  customs.forEach(p => {
    if (!sel.querySelector(`option[value="${p}"]`)) {
      const o = document.createElement('option');
      o.value = p; o.textContent = p;
      sel.insertBefore(o, lastOpt);
    }
  });
}

// ── Main render dispatcher ──
function renderInvestments() {
  renderInvPortfolio('customer');
  renderInvPortfolio('company');
}

// ── Render one portfolio panel ──
function renderInvPortfolio(mode) {
  const list = INVESTMENTS.filter(i => i.mode === mode);

  if (mode === 'customer') {
    // Update stat cards
    const totalInv  = list.reduce((s, i) => s + i.amount, 0);
    const totalRet  = list.reduce((s, i) => s + (i.returns || 0), 0);
    const active    = list.filter(i => i.status === 'active').length;
    const matured   = list.filter(i =>
      i.status === 'matured' || (i.maturity && new Date(i.maturity) < new Date())
    ).length;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('inv-total',   fmt(totalInv));
    s('inv-returns', fmt(totalRet));
    s('inv-active',  active);
    s('inv-matured', matured);
  } else {
    const totalInv = list.reduce((s, i) => s + i.amount, 0);
    const totalRet = list.reduce((s, i) => s + (i.returns || 0), 0);
    const active   = list.filter(i => i.status === 'active').length;
    const settled  = list.filter(i => i.status === 'settled').length;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('cinv-total',   fmt(totalInv));
    s('cinv-returns', fmt(totalRet));
    s('cinv-active',  active);
    s('cinv-settled', settled);
  }

  const containerId = mode === 'customer'
    ? 'inv-portfolio-customer' : 'inv-portfolio-company';
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:30px 0">
        <div class="ei">${mode === 'company' ? '🏢' : '📈'}</div>
        <div class="et">No investments yet</div>
        <div class="es">Add one using the form on the left</div>
      </div>`;
    return;
  }

  const catIcons = {
    fixed_deposit : '🏦', treasury : '📜', equity : '📈',
    real_estate   : '🏘️', mutual_fund : '💹', other : '💰'
  };

  el.innerHTML = [...list].reverse().map(inv => {
    const isMatured = inv.maturity && new Date(inv.maturity) < new Date()
                      && inv.status !== 'settled';
    const statusBadge = inv.status === 'settled'
      ? '<span class="badge b-green">Settled</span>'
      : isMatured
        ? '<span class="badge b-yellow">Matured</span>'
        : '<span class="badge b-blue">Active</span>';

    return `
      <div style="background:var(--surface);border:1px solid var(--border);
        border-radius:var(--radius-sm);padding:13px;margin-bottom:9px">

        <!-- Title row -->
        <div class="flex-between" style="margin-bottom:8px">
          <div>
            <div class="fw-600" style="font-size:.87rem">
              ${catIcons[inv.category] || '💰'} ${inv.name || inv.category}
            </div>
            ${mode === 'customer'
              ? `<div class="mono text-gold" style="font-size:.73rem">
                   ${inv.custName} · ${inv.acct}
                 </div>`
              : `<div style="font-size:.74rem;color:var(--muted)">
                   ${inv.desc || ''}
                   ${inv.qty ? ` · Qty: ${inv.qty} ${inv.unit || ''}` : ''}
                 </div>`}
          </div>
          <div style="text-align:right">
            <div class="mono text-gold fw-600">${fmt(inv.amount)}</div>
            <div style="font-size:.7rem;color:var(--muted)">${fmtDate(inv.date)}</div>
          </div>
        </div>

        <!-- Stats strip -->
        <div style="background:var(--surface2);border:1px solid var(--border);
          border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:8px;
          display:flex;flex-wrap:wrap;gap:12px;font-size:.76rem">
          <div><span class="text-muted">Rate: </span>${inv.roi || 0}%</div>
          <div><span class="text-muted">Returns: </span>
            <span class="text-success">${fmt(inv.returns || 0)}</span></div>
          <div><span class="text-muted">Maturity Value: </span>
            <span class="text-gold">${fmt(inv.totalAtMaturity || inv.amount)}</span></div>
          ${inv.maturity
            ? `<div><span class="text-muted">Matures: </span>${fmtDate(inv.maturity)}</div>`
            : ''}
          ${mode === 'company' && inv.manager
            ? `<div><span class="text-muted">Manager: </span>${inv.manager}</div>` : ''}
        </div>

        <!-- Status + actions -->
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${statusBadge}
          <div style="display:flex;gap:6px">
            ${inv.status === 'active'
              ? `<button class="btn btn-success btn-xs"
                   onclick="settleInvestment('${inv.id}')">✅ Settle</button>`
              : ''}
            <button class="btn btn-danger btn-xs"
              onclick="deleteInvestment('${inv.id}')">🗑</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function settleInvestment(id) {
  const inv = INVESTMENTS.find(i => i.id === id);
  if (!inv) return;
  showConfirm('Settle Investment?',
    `Mark this ${fmt(inv.amount)} investment as settled?
     Maturity value: ${fmt(inv.totalAtMaturity || inv.amount)}`,
    () => {
      inv.status    = 'settled';
      inv.settledAt = new Date().toISOString();
      inv.settledBy = currentUser?.name || 'System';
      saveAll();
      renderInvestments();
      toast('Investment marked as settled ✅', 'success');
    });
}

function deleteInvestment(id) {
  const inv = INVESTMENTS.find(i => i.id === id);
  showConfirm('Delete Investment?',
    'This will permanently remove this investment record.',
    () => {
      INVESTMENTS = INVESTMENTS.filter(i => i.id !== id);
      saveAll();
      renderInvestments();
      toast('Investment deleted', 'warning');
    });
}

function viewInvestment(id) {
  const inv = INVESTMENTS.find(x => x.id === id);
  if (!inv) return;
  toast(`${inv.name} — ${fmt(inv.amount)} @ ${inv.roi}% → ${fmt(inv.totalAtMaturity)}`, 'info', 5000);
}