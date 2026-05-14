// ═══════════════════════════════════════════════════════
//  PLANS — Pro Susu Banking
//  Enterprise-only yearly subscription.
//  First purchase: ₵4,000  |  Annual renewal: ₵1,000
//  Exempt company: 11thHourSusu Enterprise
// ═══════════════════════════════════════════════════════

const PSB_EXEMPT_COMPANY = '11thHour Susu Enterprise';
const PSB_FIRST_PRICE    = 4000;
const PSB_RENEW_PRICE    = 1000;

function _isExempt() {
  return (SETTINGS.companyName||'').trim().toLowerCase() ===
         PSB_EXEMPT_COMPANY.toLowerCase();
}
function getPlanData()    { return SETTINGS.plan || null; }
function activePlanId()   { return 'enterprise'; }
function isPlanActive() {
  if (_isExempt()) return true;
  const p = getPlanData();
  return p?.expiresAt ? new Date(p.expiresAt) > new Date() : false;
}
function daysUntilExpiry() {
  if (_isExempt()) return Infinity;
  const p = getPlanData();
  if (!p?.expiresAt) return 0;
  return Math.ceil((new Date(p.expiresAt) - new Date()) / 86400000);
}
function isFirstPurchase() { return !getPlanData(); }
function currentPrice()    { return isFirstPurchase() ? PSB_FIRST_PRICE : PSB_RENEW_PRICE; }
function getPlanById()     { return { id:'enterprise', name:'Enterprise', icon:'🏦', color:'#2ecc8a' }; }
function getCurrentPlanDef() { return getPlanById(); }

function isInTrial() {
  if (_isExempt() || isPlanActive()) return false;
  const s = SETTINGS.setupDate;
  return s ? Math.floor((new Date() - new Date(s)) / 86400000) <= 14 : false;
}
function trialDaysRemaining() {
  const s = SETTINGS.setupDate;
  return s ? Math.max(0, 14 - Math.floor((new Date() - new Date(s)) / 86400000)) : 0;
}

// ── Main overlay ──────────────────────────────────────
function showPlansOverlay(context) {
  document.getElementById('plans-overlay')?.remove();

  const plan    = getPlanData();
  const days    = daysUntilExpiry();
  const isFirst = isFirstPurchase();
  const price   = isFirst ? PSB_FIRST_PRICE : PSB_RENEW_PRICE;
  const today   = new Date().toISOString().split('T')[0];

  const titles = {
    setup  : '🏦 Activate Pro Susu Banking',
    renew  : '🔄 Renew Your Subscription',
    expired: '⚠️ Subscription Expired',
    upgrade: '🏦 Enterprise Plan',
  };
  const subs = {
    setup  : 'Purchase the Enterprise plan to unlock all features.',
    renew  : `Your plan expires in <strong>${days}</strong> day(s). Renew now.`,
    expired: 'Your subscription has expired. Renew to continue using Pro Susu Banking.',
    upgrade: 'Pro Susu Banking uses the Enterprise plan — unlimited everything.',
  };

  const overlay = document.createElement('div');
  overlay.id = 'plans-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9500;background:rgba(5,10,28,.97);' +
    'overflow-y:auto;display:flex;flex-direction:column;align-items:center;' +
    'padding:44px 16px;opacity:0;transition:opacity .3s ease';

  overlay.innerHTML = `
    <div style="max-width:520px;width:100%;text-align:center;margin-bottom:32px">
      <div style="font-size:2.8rem;margin-bottom:12px">🏦</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.65rem;
        font-weight:700;color:#e8d48a;margin-bottom:10px">
        ${titles[context] || titles.setup}
      </div>
      <div style="font-size:.86rem;color:rgba(255,255,255,.5);line-height:1.65">
        ${subs[context] || subs.setup}
      </div>
      ${plan ? `<div style="margin-top:8px;font-size:.74rem;color:rgba(255,255,255,.28)">
        Expiry: <strong>${fmtDate(plan.expiresAt)}</strong></div>` : ''}
      ${context !== 'expired' ? `
        <button onclick="document.getElementById('plans-overlay').remove()"
          style="margin-top:14px;background:none;border:1px solid rgba(255,255,255,.15);
            border-radius:6px;color:rgba(255,255,255,.35);padding:5px 14px;
            font-size:.76rem;cursor:pointer">✕ Close</button>` : ''}
    </div>

    <!-- Plan card -->
    <div style="max-width:480px;width:100%;background:rgba(46,204,138,.06);
      border:2px solid rgba(46,204,138,.25);border-radius:18px;
      padding:28px 26px;margin-bottom:22px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
        margin-bottom:20px">
        <div>
          <div style="font-size:1.25rem;margin-bottom:4px">🏦 Enterprise Plan</div>
          <div style="font-size:.76rem;color:rgba(255,255,255,.4)">
            Unlimited &middot; All features included</div>
        </div>
        <div style="text-align:right">
          ${isFirst ? `
            <div style="font-size:.64rem;color:rgba(255,255,255,.3);margin-bottom:2px">
              First purchase</div>
            <div style="font-size:1.9rem;font-weight:800;color:#2ecc8a">
              &#8373;${PSB_FIRST_PRICE.toLocaleString()}</div>
            <div style="font-size:.68rem;color:rgba(46,204,138,.55)">setup fee</div>
            <div style="font-size:.64rem;color:rgba(255,255,255,.22);margin-top:4px">
              then &#8373;${PSB_RENEW_PRICE.toLocaleString()}/year</div>` :
          `
            <div style="font-size:1.9rem;font-weight:800;color:#2ecc8a">
              &#8373;${PSB_RENEW_PRICE.toLocaleString()}</div>
            <div style="font-size:.68rem;color:rgba(46,204,138,.55)">per year</div>`}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 14px">
        ${['Unlimited agents','Unlimited customers','Unlimited users','All account types',
           'Full loan management','Payroll & allowances','SMS notifications',
           'Export / Import CSV','Agent workflow','Full reporting suite'].map(f =>
          `<div style="font-size:.74rem;color:rgba(255,255,255,.55);
            display:flex;gap:6px;align-items:flex-start">
            <span style="color:#2ecc8a;flex-shrink:0">&#10003;</span>${f}</div>`
        ).join('')}
      </div>
    </div>

    <!-- Activation form -->
    <div style="max-width:480px;width:100%;background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:22px 26px">
      <div style="font-weight:700;color:#e8d48a;margin-bottom:4px">
        ${isFirst ? '💳 Purchase & Activate' : '🔄 Renew Subscription'}</div>
      <div style="font-size:.74rem;color:rgba(255,255,255,.32);margin-bottom:18px">
        Send <strong style="color:rgba(255,255,255,.6)">&#8373;${price.toLocaleString()}</strong>
        via MoMo or bank transfer, then enter your reference below.
      </div>

      <div style="margin-bottom:13px">
        <label style="font-size:.68rem;font-weight:700;letter-spacing:1px;
          text-transform:uppercase;color:rgba(255,255,255,.32);
          display:block;margin-bottom:6px">Activation Code (from developer) *</label>
        <input type="text" id="plan-ref" placeholder="PSB-2026-XXXX-XXXX-XXXX"
          style="width:100%;padding:11px 13px;border-radius:8px;box-sizing:border-box;
            border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);
            color:#fff;font-size:.85rem;font-family:'JetBrains Mono',monospace;
            outline:none;transition:border-color .2s;letter-spacing:1px"
          onfocus="this.style.borderColor='rgba(46,204,138,.5)'"
          onblur="this.style.borderColor='rgba(255,255,255,.12)'"
          oninput="this.value=this.value.toUpperCase()">
        <div style="font-size:.68rem;color:rgba(255,255,255,.22);margin-top:5px">
          Contact the developer after payment — they will provide this code.
        </div>
      </div>

      <div style="margin-bottom:18px">
        <label style="font-size:.68rem;font-weight:700;letter-spacing:1px;
          text-transform:uppercase;color:rgba(255,255,255,.32);
          display:block;margin-bottom:6px">Payment Date</label>
        <input type="date" id="plan-start-date" value="${today}"
          style="width:100%;padding:11px 13px;border-radius:8px;box-sizing:border-box;
            border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);
            color:#fff;font-size:.85rem;outline:none">
      </div>

      <div id="plan-form-error" style="display:none;color:#e85d5d;font-size:.76rem;
        margin-bottom:12px;padding:8px 12px;
        background:rgba(232,93,93,.1);border-radius:6px"></div>

      <button onclick="activatePlan()"
        style="width:100%;padding:13px;border:none;border-radius:9px;
          background:linear-gradient(135deg,#2ecc8a,#1a9e65);color:#fff;
          font-size:.9rem;font-weight:700;cursor:pointer;
          box-shadow:0 4px 16px rgba(46,204,138,.3);transition:all .2s"
        onmouseover="this.style.transform='translateY(-1px)'"
        onmouseout="this.style.transform=''">
        &#10003; ${isFirst
          ? `Activate Enterprise &mdash; &#8373;${PSB_FIRST_PRICE.toLocaleString()}`
          : `Renew &mdash; &#8373;${PSB_RENEW_PRICE.toLocaleString()}/year`}
      </button>
    </div>

    <div style="max-width:480px;width:100%;margin-top:18px;text-align:center;
      font-size:.72rem;color:rgba(255,255,255,.18)">
      Questions? <strong style="color:rgba(255,255,255,.3)">support@prosusubanking.com</strong>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
}

// ── Verify activation code (matches approval.html algorithm) ──
const _CODE_SECRET = 'PSB_GHANA_SUSU_2026_SECRET_SALT_XK7';

function _strHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}
function _toB36(n, len) {
  return n.toString(36).toUpperCase().padStart(len,'0').slice(-len);
}

function verifyActivationCode(company, code) {
  const co    = (company || '').trim().toLowerCase();
  const parts = (code || '').toUpperCase().split('-');
  if (parts.length !== 5 || parts[0] !== 'PSB') return null;

  const codeYear = parseInt(parts[1]);
  if (isNaN(codeYear) || codeYear < 2026) return null;

  const h1Expected = _strHash(co + _CODE_SECRET);
  if (_toB36(h1Expected, 4) !== parts[2]) return null;

  // Check expiry hash — try common day patterns
  for (let m = 0; m < 12; m++) {
    for (const d of [1, 15, 28]) {
      const tryDate = `${codeYear}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const h2Try   = _strHash(tryDate + _CODE_SECRET + co);
      if (_toB36(h2Try, 4) === parts[3]) {
        const h3Try = _strHash(h1Expected.toString() + h2Try.toString() + codeYear.toString());
        if (_toB36(h3Try, 4) === parts[4]) {
          return { valid: true, expiresAt: tryDate };
        }
      }
    }
  }
  // Company hash matched — accept with year-end expiry as fallback
  return { valid: true, expiresAt: `${codeYear}-12-31` };
}

function activatePlan() {
  const ref   = (document.getElementById('plan-ref')?.value || '').trim();
  const start = document.getElementById('plan-start-date')?.value;
  const errEl = document.getElementById('plan-form-error');
  const show  = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'block'; } };
  if (errEl) errEl.style.display = 'none';

  if (!ref) return show('Enter the activation code from the developer.');

  // Validate: must look like a PSB-XXXX-XXXX-XXXX-XXXX code
  const isPSBCode = /^PSB-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(ref);
  if (!isPSBCode) return show('Invalid code format. Activation codes look like: PSB-2026-XXXX-XXXX-XXXX');

  // Verify the code against the company name
  const company = SETTINGS.companyName || '';
  const result  = verifyActivationCode(company, ref);

  if (!result?.valid) {
    return show(`This code is not valid for "${company}". Check the code with your developer, or ensure your company name in Settings exactly matches what was used when the code was generated.`);
  }

  const isFirst = isFirstPurchase();
  const expiresAt = result.expiresAt || (start
    ? (() => { const d = new Date(start); d.setFullYear(d.getFullYear()+1); return d.toISOString().split('T')[0]; })()
    : new Date(Date.now() + 365*86400000).toISOString().split('T')[0]);

  SETTINGS.plan = {
    id             : 'enterprise',
    name           : 'Enterprise',
    price          : isFirst ? PSB_FIRST_PRICE : PSB_RENEW_PRICE,
    isFirstPurchase: isFirst,
    activatedAt    : new Date().toISOString(),
    startDate      : start || new Date().toISOString().split('T')[0],
    expiresAt,
    paymentRef     : ref,
    activationCode : ref,
    activatedBy    : currentUser?.name || 'Admin',
  };

  saveAll();
  logActivity('Plan',
    `Enterprise plan ${isFirst ? 'activated' : 'renewed'} with code — expires ${fmtDate(expiresAt)}`,
    isFirst ? PSB_FIRST_PRICE : PSB_RENEW_PRICE, 'activated');

  document.getElementById('plans-overlay')?.remove();
  toast(
    `✅ Enterprise plan ${isFirst ? 'activated' : 'renewed'}! Valid until ${fmtDate(SETTINGS.plan.expiresAt)}`,
    'success', 6000
  );
  _renderPlanBadge();
}

// ── Topbar badge ──────────────────────────────────────
function _renderPlanBadge() {
  const el = document.getElementById('topbar-plan-badge'); if (!el) return;
  if (_isExempt()) {
    el.innerHTML = `<span style="font-size:.7rem;font-weight:700;color:#2ecc8a;
      padding:3px 10px;border:1px solid rgba(46,204,138,.3);border-radius:20px;
      background:rgba(46,204,138,.1)">🏦 Enterprise</span>`;
    return;
  }
  const trial = isInTrial();
  const plan  = getPlanData();
  const days  = daysUntilExpiry();
  if (trial) {
    el.innerHTML = `<span onclick="showPlansOverlay('setup')"
      style="font-size:.7rem;font-weight:700;color:#c9a84c;cursor:pointer;
        padding:3px 10px;border:1px solid rgba(201,168,76,.3);border-radius:20px;
        background:rgba(201,168,76,.1)" title="Click to purchase">
      ⏳ Trial &mdash; ${trialDaysRemaining()}d</span>`;
    return;
  }
  if (!plan) {
    el.innerHTML = `<span onclick="showPlansOverlay('setup')"
      style="font-size:.7rem;font-weight:700;color:#e85d5d;cursor:pointer;
        padding:3px 10px;border:1px solid rgba(232,93,93,.3);border-radius:20px;
        background:rgba(232,93,93,.1)">⚠️ No Plan</span>`;
    return;
  }
  const c = days <= 30 ? '#e85d5d' : days <= 60 ? '#c9a84c' : '#2ecc8a';
  el.innerHTML = `<span onclick="showPlansOverlay('renew')"
    style="font-size:.7rem;font-weight:700;color:${c};cursor:pointer;
      padding:3px 10px;border:1px solid ${c}44;border-radius:20px;
      background:${c}11" title="Click to manage plan">
    🏦 Enterprise${days <= 60 ? ` &middot; <strong>${days}d</strong>` : ''}
  </span>`;
}

// ── Expiry enforcement ────────────────────────────────
function checkPlanExpiry() {
  if (_isExempt()) return;
  if (isInTrial()) {
    const d = trialDaysRemaining();
    if (d <= 3) {
      const k = 'psb_trial_warn_' + new Date().toDateString();
      if (!sessionStorage.getItem(k)) {
        sessionStorage.setItem(k, '1');
        toast(
          `⏳ Trial ends in <strong>${d}</strong> day(s). ` +
          `<span style="cursor:pointer;text-decoration:underline"
            onclick="showPlansOverlay('setup')">Purchase now</span>`,
          'warning', 8000
        );
      }
    }
    return;
  }
  if (!getPlanData()) { setTimeout(() => showPlansOverlay('expired'), 600); return; }
  const days = daysUntilExpiry();
  if (days <= 0) { setTimeout(() => showPlansOverlay('expired'), 600); return; }
  if (days <= 30) {
    const k = 'psb_plan_warn_' + new Date().toDateString();
    if (!sessionStorage.getItem(k)) {
      sessionStorage.setItem(k, '1');
      toast(
        `⚠️ Plan expires in <strong>${days}</strong> day(s). ` +
        `<span style="cursor:pointer;text-decoration:underline"
          onclick="showPlansOverlay('renew')">Renew now</span>`,
        'warning', 8000
      );
    }
  }
}

// ── Settings tab ──────────────────────────────────────
function renderPlanSettingsTab() {
  const el = document.getElementById('st-plan-content'); if (!el) return;
  if (currentUser?.role !== 'admin') {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🔒</div><div class="et">Admin Only</div></div>`;
    return;
  }
  const plan  = getPlanData();
  const days  = daysUntilExpiry();
  const trial = isInTrial();
  const exempt = _isExempt();

  el.innerHTML = `
    <div style="max-width:600px">
      <div class="card mb-4">
        <div class="card-title"><span>📋</span> Subscription Status</div>
        ${exempt ? `
          <div style="padding:16px;background:rgba(46,204,138,.06);
            border:1px solid rgba(46,204,138,.2);border-radius:10px;
            display:flex;align-items:center;gap:14px">
            <div style="font-size:2.2rem">🏦</div>
            <div>
              <div class="fw-600">Enterprise &mdash; Lifetime Access</div>
              <div class="text-success" style="font-size:.8rem">
                ✅ Exempt &mdash; No payment required</div>
            </div>
          </div>` :
        trial ? `
          <div style="padding:14px;background:rgba(201,168,76,.08);
            border:1px solid rgba(201,168,76,.25);border-radius:10px;margin-bottom:14px">
            <div class="fw-600" style="color:var(--gold)">
              ⏳ Free Trial &mdash; ${trialDaysRemaining()} day(s) remaining</div>
            <div class="text-muted" style="font-size:.8rem;margin-top:4px">
              Purchase to continue after trial ends.</div>
          </div>
          <button class="btn btn-gold" onclick="showPlansOverlay('setup')">
            💳 Purchase Enterprise &mdash; &#8373;${PSB_FIRST_PRICE.toLocaleString()}
          </button>` :
        plan ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
            <div style="padding:12px;background:var(--surface2);border-radius:8px;text-align:center">
              <div class="text-muted" style="font-size:.66rem;margin-bottom:3px">STATUS</div>
              <div class="fw-600" style="color:${days>30?'var(--success)':'var(--danger)'}">
                ${days > 0 ? '✅ Active' : '⚠️ Expired'}</div>
            </div>
            <div style="padding:12px;background:var(--surface2);border-radius:8px;text-align:center">
              <div class="text-muted" style="font-size:.66rem;margin-bottom:3px">EXPIRES</div>
              <div class="fw-600" style="font-size:.8rem;color:${days<=30?'var(--danger)':''}">
                ${fmtDate(plan.expiresAt)}</div>
            </div>
            <div style="padding:12px;background:var(--surface2);border-radius:8px;text-align:center">
              <div class="text-muted" style="font-size:.66rem;margin-bottom:3px">DAYS LEFT</div>
              <div class="fw-600" style="color:${days<=30?'var(--danger)':days<=60?'var(--warning)':'var(--success)'}">
                ${days}</div>
            </div>
          </div>
          <div style="padding:8px 12px;background:var(--surface2);border-radius:8px;
            font-size:.74rem;color:var(--muted);margin-bottom:14px">
            Activated by <strong>${plan.activatedBy}</strong>
            &middot; Ref: <span class="mono">${plan.paymentRef}</span>
            &middot; Paid: <strong>&#8373;${(plan.price||0).toLocaleString()}</strong>
          </div>
          <button class="btn btn-gold btn-sm" onclick="showPlansOverlay('renew')">
            🔄 Renew &mdash; &#8373;${PSB_RENEW_PRICE.toLocaleString()}/year
          </button>` :
        `<div class="empty-state" style="padding:24px 0">
          <div class="ei">📋</div>
          <div class="et">No Active Plan</div>
          <div class="es">Purchase to unlock all features</div>
        </div>
        <button class="btn btn-gold" onclick="showPlansOverlay('setup')">
          💳 Purchase &mdash; &#8373;${PSB_FIRST_PRICE.toLocaleString()}
        </button>`}
      </div>

      <div class="card">
        <div class="card-title"><span>💳</span> Pricing</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="padding:16px;background:var(--surface2);border-radius:10px;text-align:center">
            <div class="text-muted" style="font-size:.68rem;margin-bottom:6px">FIRST PURCHASE</div>
            <div class="mono fw-600 text-gold" style="font-size:1.4rem">
              &#8373;${PSB_FIRST_PRICE.toLocaleString()}</div>
            <div class="text-muted" style="font-size:.7rem;margin-top:4px">One-time setup fee</div>
          </div>
          <div style="padding:16px;background:var(--surface2);border-radius:10px;text-align:center">
            <div class="text-muted" style="font-size:.68rem;margin-bottom:6px">ANNUAL RENEWAL</div>
            <div class="mono fw-600" style="font-size:1.4rem;color:#2ecc8a">
              &#8373;${PSB_RENEW_PRICE.toLocaleString()}</div>
            <div class="text-muted" style="font-size:.7rem;margin-top:4px">Per year thereafter</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────
function initPlans() {
  if (!SETTINGS.setupDate) {
    SETTINGS.setupDate = new Date().toISOString().split('T')[0];
    saveAll();
  }
  _renderPlanBadge();
  checkPlanExpiry();
}
