// ═══════════════════════════════════════════════════════
//  DATA STRUCTURES
// ═══════════════════════════════════════════════════════
let SETTINGS = {
  companyName:'Pro Susu Banking', tagline:'Management System',
  companyPhone:'', companyEmail:'', companyAddress:'',
  currency:'GH₵', susuPrefix:'TN', lendingPrefix:'LD', savingsPrefix:'TS',
  loanRate:0.25, loanBase:6, cardFee:30, commissionRate:1,
  sessionTimeout:30, strongPass:true, auditLog:true,
  notifApp:true, notifClose:false, notifLoan:true, notifInv:true,
  theme:'dark', fontSize:14, compact:false,
  adminPassword:'admin123'
};
let AGENTS = [];
let CUSTOMERS = [];
let LOANS = [];
let INVESTMENTS = [];
let TRANSFERS = [];
let CARD_REPLACEMENTS = [];
let COLLAB_PARTNERS = [];
let COLLAB_TRANSACTIONS = [];
let COLLECTION_SHEETS = [];
let ACCOUNTING_ENTRIES = [];
let DELETED_CUSTOMERS  = [];   // soft-deleted, admin-visible, restorable
let VACATED_ACCOUNTS   = [];   // account numbers freed by type-change, reusable
let USERS = [{id:'u1',name:'System Administrator',username:'admin',password:'admin123',role:'admin',phone:'',email:'',status:'active',lastLogin:''}];
let TELLER_STATE = {
  startOfDay:0, startOfDaySource:'', startOfDayTime:null,
  collections:[], withdrawals:[], expenses:[], history:[], dayClosed:false,
  floatRequests:[]
};
let ENTRY_STATE = {activeCollId:null, rows:[]};
let SHEET_STATE = {activeSheetId:null, rows:[], newSheet:null};
let PAYROLL = [];              // monthly payroll runs
let ALLOWANCES_RECORDS = [];  // allowance payment history
let AGENT_SUBMISSIONS  = [];  // agent field collections submitted to teller
let MANUAL_DEPOSITS    = [];  // admin-entered manual deposits (customerId, amount, date, note)
let ACTIVITY_LOG = [];
let currentUser  = null;


// ═══════════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════════
function saveAll() {
  try {
    localStorage.setItem('psb_v2', JSON.stringify({
      SETTINGS, AGENTS, CUSTOMERS, LOANS, INVESTMENTS, TRANSFERS,
      CARD_REPLACEMENTS, COLLAB_PARTNERS, COLLAB_TRANSACTIONS,
      COLLECTION_SHEETS, ACCOUNTING_ENTRIES, USERS, TELLER_STATE,
      PAYROLL, ALLOWANCES_RECORDS, DELETED_CUSTOMERS, VACATED_ACCOUNTS, AGENT_SUBMISSIONS, ACTIVITY_LOG, MANUAL_DEPOSITS
    }));
  } catch(e) {}
}
function loadAll() {
  try {
    const raw = localStorage.getItem('psb_v2');
    if(!raw) return;
    const d = JSON.parse(raw);
    if(d.SETTINGS) SETTINGS = Object.assign(SETTINGS, d.SETTINGS);
    if(d.AGENTS) AGENTS = d.AGENTS;
    if(d.CUSTOMERS) CUSTOMERS = d.CUSTOMERS;
    if(d.LOANS) LOANS = d.LOANS;
    if(d.INVESTMENTS) INVESTMENTS = d.INVESTMENTS;
    if(d.TRANSFERS) TRANSFERS = d.TRANSFERS;
    if(d.CARD_REPLACEMENTS) CARD_REPLACEMENTS = d.CARD_REPLACEMENTS;
    if(d.COLLAB_PARTNERS) COLLAB_PARTNERS = d.COLLAB_PARTNERS;
    if(d.COLLAB_TRANSACTIONS) COLLAB_TRANSACTIONS = d.COLLAB_TRANSACTIONS;
    if(d.COLLECTION_SHEETS)  COLLECTION_SHEETS  = d.COLLECTION_SHEETS;
    if(d.ACCOUNTING_ENTRIES) ACCOUNTING_ENTRIES = d.ACCOUNTING_ENTRIES;
    if(d.DELETED_CUSTOMERS)  DELETED_CUSTOMERS  = d.DELETED_CUSTOMERS;
    if(d.VACATED_ACCOUNTS)   VACATED_ACCOUNTS   = d.VACATED_ACCOUNTS;
    if(d.AGENT_SUBMISSIONS)  AGENT_SUBMISSIONS  = d.AGENT_SUBMISSIONS;
    if(d.USERS && d.USERS.length) USERS = d.USERS;
    if(d.TELLER_STATE) TELLER_STATE = Object.assign(TELLER_STATE, d.TELLER_STATE);
    if(d.PAYROLL)            PAYROLL            = d.PAYROLL;
    if(d.ALLOWANCES_RECORDS) ALLOWANCES_RECORDS = d.ALLOWANCES_RECORDS;
    if(d.ACTIVITY_LOG) ACTIVITY_LOG = d.ACTIVITY_LOG;
    if(d.MANUAL_DEPOSITS) MANUAL_DEPOSITS = d.MANUAL_DEPOSITS;

    // Always guarantee the default admin exists — even if a previous
    // company's data was loaded, a new company must always be able to log in.
    // If no admin-role user exists at all, re-inject the default.
    const hasAdmin = USERS.some(u => u.role === 'admin' && u.status === 'active');
    if (!hasAdmin) {
      USERS.unshift({
        id:'u1', name:'System Administrator',
        username:'admin', password:'admin123',
        role:'admin', phone:'', email:'', status:'active', lastLogin:''
      });
    }
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function fmt(n) { const s=SETTINGS.currency||'GH₵'; return s+' '+(+n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GH') : '—'; }
function fmtTime(d) { return d ? new Date(d).toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit'}) : '—'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-GH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }
function pad2(n) { return String(n).padStart(2,'0'); }
function pad4(n) { return String(n).padStart(4,'0'); }
function todayISO() { return new Date().toISOString().slice(0,10); }
function monthLabel(m) { return new Date(m+'-01').toLocaleDateString('en-GH',{month:'long',year:'numeric'}); }
function addMonths(dateStr, months) {
  const d = new Date(dateStr); d.setMonth(d.getMonth()+parseInt(months)); return d.toISOString().slice(0,10);
}

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
function toast(msg, type='success', duration=3500) {
  if(!SETTINGS.notifApp) return;
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>{el.style.animation='slideIn .28s reverse';setTimeout(()=>el.remove(),280)}, duration);
}

// ═══════════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const el=document.getElementById('live-time'); if(el) el.textContent=now.toLocaleTimeString('en-GH');
  const db=document.getElementById('topbar-date-badge'); if(db) db.textContent=now.toLocaleDateString('en-GH',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
setInterval(updateClock,1000); updateClock();

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════
// ── Landing page navigation ───────────────────────────
function showLoginPanel() {
  const drawer = document.getElementById('login-drawer');
  if (drawer) {
    drawer.style.display = 'flex';
    setTimeout(() => document.getElementById('login-user')?.focus(), 100);
  }
}
function hideLoginDrawer() {
  const drawer = document.getElementById('login-drawer');
  if (drawer) drawer.style.display = 'none';
}
function showSignupPanel() {
  hideLoginDrawer();
  showSetupWizard();
}

// ── First-Run Setup Wizard ────────────────────────────
function showSetupWizard() {
  const existing = document.getElementById('setup-wizard');
  if (existing) existing.remove();

  const wizardHTML = `
    <div id="setup-wizard" style="
      position:fixed;inset:0;z-index:9999;background:rgba(13,27,46,.96);
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;padding:40px 32px;
      backdrop-filter:blur(8px)">

      <div style="font-size:2rem;margin-bottom:8px">🏦</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.4rem;
        font-weight:700;color:#e8d48a;margin-bottom:6px">
        Welcome to Pro Susu Banking
      </div>
      <div style="font-size:.82rem;color:rgba(255,255,255,.45);
        margin-bottom:28px;text-align:center;line-height:1.6">
        Set up your company account to get started.
      </div>

      <div style="width:100%;max-width:340px;margin-bottom:14px">
        <label style="font-size:.72rem;font-weight:700;letter-spacing:1px;
          text-transform:uppercase;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">
          Company / Bank Name
        </label>
        <input type="text" id="setup-company" class="form-control"
          style="background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15);
            color:#fff;font-size:.92rem"
          placeholder="e.g. Bright Star Susu" autocomplete="off">
      </div>

      <div style="width:100%;max-width:340px;margin-bottom:14px">
        <label style="font-size:.72rem;font-weight:700;letter-spacing:1px;
          text-transform:uppercase;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">
          Administrator Name
        </label>
        <input type="text" id="setup-name" class="form-control"
          style="background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15);
            color:#fff;font-size:.92rem"
          placeholder="Full name" autocomplete="off">
      </div>

      <div style="width:100%;max-width:340px;margin-bottom:14px">
        <label style="font-size:.72rem;font-weight:700;letter-spacing:1px;
          text-transform:uppercase;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">
          Admin Username
        </label>
        <input type="text" id="setup-username" class="form-control"
          style="background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15);
            color:#fff;font-size:.92rem"
          placeholder="e.g. admin" autocomplete="off">
      </div>

      <div style="width:100%;max-width:340px;margin-bottom:20px">
        <label style="font-size:.72rem;font-weight:700;letter-spacing:1px;
          text-transform:uppercase;color:rgba(255,255,255,.4);display:block;margin-bottom:6px">
          Admin Password
        </label>
        <input type="password" id="setup-pass" class="form-control"
          style="background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15);
            color:#fff;font-size:.92rem"
          placeholder="Choose a strong password" autocomplete="new-password">
      </div>

      <div id="setup-error" style="display:none;color:#e85d5d;
        font-size:.78rem;margin-bottom:12px;text-align:center"></div>

      <button onclick="completeSetup()"
        style="width:100%;max-width:340px;padding:13px;border:none;
          border-radius:10px;background:#c9a84c;
          color:#08142a;font-size:.92rem;font-weight:700;cursor:pointer">
        🚀 Set Up &amp; Enter Dashboard
      </button>

      <div style="margin-top:12px;font-size:.72rem;color:rgba(255,255,255,.2)">
        Already have an account?
        <span onclick="document.getElementById('setup-wizard').remove();showLoginPanel()"
          style="color:#c9a84c;cursor:pointer;text-decoration:underline">Sign in →</span>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', wizardHTML);
  setTimeout(() => document.getElementById('setup-company')?.focus(), 100);
}
function completeSetup() {
  const company  = document.getElementById('setup-company')?.value.trim();
  const name     = document.getElementById('setup-name')?.value.trim();
  const username = document.getElementById('setup-username')?.value.trim();
  const pass     = document.getElementById('setup-pass')?.value;
  const errEl    = document.getElementById('setup-error');

  const showErr = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };

  if (!company)             return showErr('Enter your company or bank name.');
  if (!name)                return showErr('Enter the administrator\'s full name.');
  if (!username)            return showErr('Choose an admin username.');
  if (!pass || pass.length < 4) return showErr('Password must be at least 4 characters.');

  // Apply settings
  SETTINGS.companyName = company;

  // Update the default admin user
  USERS = [{
    id      : 'u1',
    name    : name,
    username: username,
    password: pass,
    role    : 'admin',
    phone   : '',
    email   : '',
    status  : 'active',
    lastLogin: '',
  }];

  saveAll();
  updateBrandNames();
  applyTheme(SETTINGS.theme || 'dark');

  // Remove wizard
  document.getElementById('setup-wizard')?.remove();

  // Open sign-in drawer with username pre-filled
  showLoginPanel();
  const loginUser = document.getElementById('login-user');
  const loginPass = document.getElementById('login-pass');
  if (loginUser) loginUser.value = username;
  if (loginPass) { loginPass.value = ''; loginPass.focus(); }

  toast(`Setup complete! Welcome to ${company}. Enter your password to sign in.`, 'success', 5000);
}

function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';

  if (!username || !password) {
    if (errEl) errEl.style.display = 'block';
    errEl.textContent = 'Please enter both username and password.';
    return;
  }

  // Show login loader
  showLoginLoader([
    '🔐 Checking your credentials...',
    '📂 Loading your previous work...',
    '📊 Preparing the dashboard...',
    '✅ Almost ready...'
  ], () => {
    const user = USERS.find(u =>
      u.username === username && u.password === password && u.status === 'active'
    );
    if (!user) {
      hideLoginLoader();
      if (errEl) {
        errEl.textContent = 'Invalid username or password. Please try again.';
        errEl.style.display = 'block';
      }
      return;
    }
    currentUser = user;
    user.lastLogin = new Date().toISOString();
    saveAll();

    // Persist session so page refresh doesn't log out
    sessionStorage.setItem('psb_session', JSON.stringify({ userId: user.id }));

    logActivity('Login', `${user.name} logged in`, 0, 'success');

    // Hide the login loader first, then activate the session
    hideLoginLoader(() => _activateSession(user, false));
  });
}

// Shared activation — runs after login AND after session restore on refresh
// hideLoader=true means the login loader is still visible and must be hidden first
function _activateSession(user, hideLoader) {
  currentUser = user;

  // Update sidebar / topbar
  const nameEl   = document.getElementById('sb-uname');
  const roleEl   = document.getElementById('sb-role');
  const avatarEl = document.getElementById('sb-avatar');
  if (nameEl)   nameEl.textContent   = user.name;
  const ROLE_LABELS = {
    admin:'Administrator', accountant:'Accountant', accounting_clerk:'Accounting Clerk',
    teller:'Teller', loan_officer:'Loan Officer', monitoring_officer:'Monitoring Officer',
    agent:'Agent', manager:'Manager', auditor:'Auditor', customer_service:'Customer Service'
  };
  if (roleEl)   roleEl.textContent   = ROLE_LABELS[user.role] || user.role;
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();

  // Payroll nav — admin only
  const payNav = document.getElementById('nav-payroll');
  if (payNav) payNav.style.display = user.role === 'admin' ? '' : 'none';

  // Agent role: show only Entries (agent view) and Customers nav items
  _applyNavRestrictions(user.role);

  function _show() {
    document.getElementById('login-overlay').style.display = 'none';
    const lp = document.getElementById('landing-page');
    if (lp) lp.style.display = 'none';
    // Apply the user's saved theme (default dark for app shell)
    applyTheme(SETTINGS.theme || 'dark');
    document.getElementById('app-shell').style.display     = 'flex';
    // Agents land on their entries page, everyone else on dashboard
    if (user.role === 'agent') {
      showView('agent-entries', document.querySelector('.nav-item[onclick*="agent-entries"]'));
    } else {
      showView('dashboard', document.querySelector('.nav-item'));
      updateDashboard();
    }
    _startInactivityTimer();
    // Initialise plan badge and expiry check
    if (typeof initPlans === 'function') initPlans();
  }

  if (hideLoader) {
    hideLoginLoader(_show);
  } else {
    _show();
  }
}

// ── Nav visibility by role ────────────────────────────
function _applyNavRestrictions(role) {
  // Views accessible to each role
  const ROLE_VIEWS = {
    agent: ['agent-entries', 'customers'],
    // all other roles see everything (payroll handled separately)
  };

  const allowed = ROLE_VIEWS[role];

  document.querySelectorAll('.nav-item').forEach(el => {
    if (!allowed) {
      // non-agent roles — show all (payroll already handled separately)
      el.style.display = '';
      return;
    }
    // Extract view name from onclick
    const match = el.getAttribute('onclick')?.match(/showView\('([^']+)'/);
    const view  = match ? match[1] : null;
    el.style.display = (view && allowed.includes(view)) ? '' : 'none';
  });
}

// ── Agent Registration — Assign Existing Customers ────
function toggleAgentAssignSection() {
  const checked = document.getElementById('ag-assign-toggle')?.checked;
  const section = document.getElementById('ag-assign-section');
  if (!section) return;

  section.style.display = checked ? 'block' : 'none';

  if (checked) {
    // Populate the source agent selector with all existing agents
    const sel = document.getElementById('ag-assign-source');
    if (!sel) return;

    // Group existing agent codes present in CUSTOMERS
    const agentCodes = {};
    AGENTS.forEach(a => {
      const custCount = CUSTOMERS.filter(c => c.agentId === a.id).length;
      agentCodes[a.code] = { agent: a, count: custCount };
    });

    sel.innerHTML = '<option value="">— Choose agent code —</option>' +
      Object.entries(agentCodes)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, { agent, count }]) =>
          `<option value="${agent.id}">
            ${code} — ${agent.firstName} ${agent.lastName}
            (${count} customer${count !== 1 ? 's' : ''})
          </option>`)
        .join('');

    document.getElementById('ag-assign-preview').style.display = 'none';
  }
}

function previewAgentAssign() {
  const sel     = document.getElementById('ag-assign-source');
  const preview = document.getElementById('ag-assign-preview');
  if (!sel || !preview) return;

  const agentId = sel.value;
  if (!agentId) { preview.style.display = 'none'; return; }

  const agent = AGENTS.find(a => a.id === agentId);
  if (!agent) { preview.style.display = 'none'; return; }

  const customers = CUSTOMERS.filter(c => c.agentId === agentId);
  const byType = { susu: 0, lending: 0, savings: 0 };
  customers.forEach(c => { if (byType[c.type] !== undefined) byType[c.type]++; });

  preview.style.display = 'block';
  preview.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span class="agent-code">${agent.code}</span>
      <span class="fw-600">${agent.firstName} ${agent.lastName}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
      <div style="padding:6px 10px;background:var(--surface2);border-radius:6px;text-align:center">
        <div class="text-muted" style="font-size:.66rem">Susu</div>
        <div class="fw-600">${byType.susu}</div>
      </div>
      <div style="padding:6px 10px;background:var(--surface2);border-radius:6px;text-align:center">
        <div class="text-muted" style="font-size:.66rem">Lending</div>
        <div class="fw-600">${byType.lending}</div>
      </div>
      <div style="padding:6px 10px;background:var(--surface2);border-radius:6px;text-align:center">
        <div class="text-muted" style="font-size:.66rem">Savings</div>
        <div class="fw-600">${byType.savings}</div>
      </div>
    </div>
    <div style="color:var(--gold);font-size:.78rem;font-weight:600">
      ✅ All ${customers.length} customer(s) from <strong>${agent.code}</strong>
      will be reassigned to the new agent after registration.
    </div>`;
}

// Called from addAgent (in agents.js) after the new agent is saved
// to perform the actual customer reassignment
function _applyAgentCustomerReassignment(newAgent) {
  const toggle  = document.getElementById('ag-assign-toggle');
  if (!toggle?.checked) return;

  const sel     = document.getElementById('ag-assign-source');
  const sourceId = sel?.value;
  if (!sourceId) return;

  const customers = CUSTOMERS.filter(c => c.agentId === sourceId);
  if (!customers.length) return;

  customers.forEach(c => {
    c.agentId   = newAgent.id;
    c.agentCode = newAgent.code;
  });

  saveAll();
  logActivity('Agent',
    `Transferred ${customers.length} customer(s) from ${sel.options[sel.selectedIndex]?.text?.split('—')[0]?.trim() || sourceId} → ${newAgent.code} (${newAgent.firstName} ${newAgent.lastName})`,
    0, 'transfer');

  toast(
    `✅ ${customers.length} customer(s) reassigned to ${newAgent.code} — ${newAgent.firstName} ${newAgent.lastName}`,
    'success'
  );

  // Reset the form
  if (toggle) toggle.checked = false;
  toggleAgentAssignSection();
}

// showView trigger already handles agents, but ensure toggle resets when switching tabs

// ── Purchase Request Page ─────────────────────────────
function showPurchaseRequestPage() {
  const lp  = document.getElementById('landing-page');
  const prp = document.getElementById('purchase-request-page');
  if (!prp) return showLoginScreen(); // fallback
  // Fade landing out, show purchase page
  if (lp) { lp.style.opacity = '0'; }
  setTimeout(() => {
    if (lp) lp.style.display = 'none';
    prp.style.display = 'block';
    prp.scrollTop = 0;
    requestAnimationFrame(() => { prp.style.opacity = '1'; });
    // Clear previous entries
    ['pr-company','pr-name','pr-phone','pr-email','pr-location','pr-ref'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const err = document.getElementById('pr-error');
    const suc = document.getElementById('pr-success');
    const btn = document.getElementById('pr-submit-btn');
    if (err) err.style.display = 'none';
    if (suc) suc.style.display = 'none';
    if (btn) { btn.style.display = ''; btn.disabled = false; }
  }, 320);
}

function hidePurchaseRequestPage() {
  const prp = document.getElementById('purchase-request-page');
  const lp  = document.getElementById('landing-page');
  if (!prp) return;
  prp.style.opacity = '0';
  setTimeout(() => {
    prp.style.display = 'none';
    if (lp) {
      lp.style.display = 'flex';
      lp.style.opacity = '0';
      requestAnimationFrame(() => { lp.style.opacity = '1'; });
    }
  }, 320);
}

function submitPurchaseRequest() {
  const company  = (document.getElementById('pr-company')?.value  || '').trim();
  const name     = (document.getElementById('pr-name')?.value     || '').trim();
  const phone    = (document.getElementById('pr-phone')?.value    || '').trim();
  const email    = (document.getElementById('pr-email')?.value    || '').trim();
  const location = (document.getElementById('pr-location')?.value || '').trim();
  const ref      = (document.getElementById('pr-ref')?.value      || '').trim();

  const errEl = document.getElementById('pr-error');
  const show  = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'block'; } };
  if (errEl) errEl.style.display = 'none';

  if (!company)  return show('Enter your company name.');
  if (!name)     return show('Enter the contact person\'s name.');
  if (!phone)    return show('Enter a phone number.');
  if (!location) return show('Enter your location / town.');
  if (!ref)      return show('Enter the payment reference / transaction ID.');

  // Store purchase request in localStorage (viewable by admin in developer mode)
  const requests = JSON.parse(localStorage.getItem('psb_purchase_requests') || '[]');
  requests.push({
    id         : 'REQ-' + Date.now(),
    company, name, phone, email, location,
    paymentRef : ref,
    amount     : 4000,
    submittedAt: new Date().toISOString(),
    status     : 'pending',
  });
  localStorage.setItem('psb_purchase_requests', JSON.stringify(requests));

  // Show success
  const sucEl = document.getElementById('pr-success');
  const btnEl = document.getElementById('pr-submit-btn');
  if (sucEl) sucEl.style.display = 'block';
  if (btnEl) { btnEl.style.display = 'none'; }

  // Scroll to success message
  sucEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showLoginScreen() {
  const lp = document.getElementById('landing-page');
  const lo = document.getElementById('login-overlay');
  if (!lo) return;
  // Fade out landing, then show login
  if (lp && lp.style.display !== 'none') {
    lp.style.opacity = '0';
    lp.style.transition = 'opacity .35s ease';
    setTimeout(() => {
      lp.style.display = 'none';
      lo.style.display = 'flex';
      lo.style.opacity = '0';
      lo.style.transition = 'opacity .35s ease';
      requestAnimationFrame(() => { lo.style.opacity = '1'; });
      setTimeout(() => document.getElementById('login-user')?.focus(), 100);
    }, 340);
  } else {
    lo.style.display = 'flex';
    lo.style.opacity = '0';
    setTimeout(() => { lo.style.opacity = '1'; lo.style.transition = 'opacity .35s ease'; }, 10);
    setTimeout(() => document.getElementById('login-user')?.focus(), 100);
  }
}

function showLandingPage() {
  const lo = document.getElementById('login-overlay');
  const lp = document.getElementById('landing-page');
  if (lo) {
    lo.style.opacity = '0';
    lo.style.transition = 'opacity .3s ease';
    setTimeout(() => {
      lo.style.display = 'none';
      if (lp) {
        lp.style.display = 'flex';
        lp.style.opacity = '0';
        lp.style.transition = 'opacity .35s ease';
        requestAnimationFrame(() => { lp.style.opacity = '1'; });
      }
    }, 300);
  }
}

function showLandingSection(section) {
  const plans = document.getElementById('landing-plans');
  if (section === 'plans') {
    if (plans) plans.style.display = 'block';
  }
  const targets = {
    hero        : 'landing-hero',
    features    : 'landing-features',
    stats       : 'landing-stats',
    plans       : 'landing-plans',
    testimonials: 'landing-testimonials',
  };
  const elId = targets[section];
  if (elId) {
    const el = document.getElementById(elId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function doLogout() {
  _stopInactivityTimer();

  const logoutOverlay = document.getElementById('logout-loader');
  if (logoutOverlay) logoutOverlay.style.display = 'flex';

  saveAll();

  setTimeout(() => {
    sessionStorage.removeItem('psb_session');
    currentUser = null;

    if (logoutOverlay) logoutOverlay.style.display = 'none';

    // Hide app and login, fade back to landing page
    document.getElementById('app-shell').style.display     = 'none';
    document.getElementById('login-overlay').style.display = 'none';

    // Reset login fields
    const loginUser = document.getElementById('login-user');
    const loginPass = document.getElementById('login-pass');
    const loginErr  = document.getElementById('login-error');
    if (loginUser) loginUser.value = '';
    if (loginPass) loginPass.value = '';
    if (loginErr)  loginErr.style.display = 'none';

    // Fade in landing page
    const lp = document.getElementById('landing-page');
    if (lp) {
      lp.style.opacity    = '0';
      lp.style.display    = 'flex';
      lp.style.transition = 'opacity .4s ease';
      requestAnimationFrame(() => { lp.style.opacity = '1'; });
    }
  }, 1200);
}

// ── Inactivity Auto-Logout ────────────────────────────
let _inactivityTimer   = null;
let _inactivityWarning = null;
const INACTIVITY_MINS    = 17;   // log out after this many minutes idle
const INACTIVITY_WARN    = 2;    // show warning this many minutes before logout

function _startInactivityTimer() {
  _stopInactivityTimer();   // clear any existing timer first

  const totalMs   = INACTIVITY_MINS * 60 * 1000;
  const warnMs    = (INACTIVITY_MINS - INACTIVITY_WARN) * 60 * 1000;

  // Warning toast before logout
  _inactivityWarning = setTimeout(() => {
    toast(
      `⚠️ You will be logged out in ${INACTIVITY_WARN} minutes due to inactivity.`,
      'warning',
      (INACTIVITY_WARN * 60 * 1000) - 500   // dismiss just before actual logout
    );
  }, warnMs);

  // Final logout
  _inactivityTimer = setTimeout(() => {
    logActivity('Security', `${currentUser?.name || 'User'} auto-logged out (inactivity)`, 0, 'logout');
    saveAll();
    doLogout();
    // Show a message on the login screen
    const errEl = document.getElementById('login-error');
    if (errEl) {
      errEl.textContent = '⏱️ You were logged out due to inactivity. Please sign in again.';
      errEl.style.display = 'block';
    }
  }, totalMs);
}

function _stopInactivityTimer() {
  if (_inactivityTimer)   { clearTimeout(_inactivityTimer);   _inactivityTimer   = null; }
  if (_inactivityWarning) { clearTimeout(_inactivityWarning); _inactivityWarning = null; }
}

function _resetInactivityTimer() {
  if (!currentUser) return;   // only track when logged in
  if (SETTINGS.autoLogout === false) return;  // respect the setting
  _startInactivityTimer();
}

// Bind activity events — called once from init()
function _bindActivityEvents() {
  const events = ['mousemove','mousedown','keydown','touchstart','scroll','click'];
  let _throttle = 0;
  events.forEach(ev => {
    document.addEventListener(ev, () => {
      const now = Date.now();
      if (now - _throttle < 10000) return;  // throttle: at most once per 10s
      _throttle = now;
      _resetInactivityTimer();
    }, { passive: true });
  });
}

// ═══════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════
function applyTheme(theme) {
  SETTINGS.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const btn=document.getElementById('theme-btn'); if(btn) btn.textContent=theme==='dark'?'🌙':'☀️';
  const dc=document.getElementById('theme-dark-card'), lc=document.getElementById('theme-light-card');
  if(dc) dc.style.borderColor=theme==='dark'?'var(--gold)':'var(--border)';
  if(lc) lc.style.borderColor=theme==='light'?'var(--gold)':'var(--border)';
  saveAll();
}
function toggleTheme() { applyTheme(SETTINGS.theme==='dark'?'light':'dark'); }
function setFontSize(sz) { SETTINGS.fontSize=sz; document.documentElement.style.fontSize=sz+'px'; saveAll(); }
function toggleCompact(on) { SETTINGS.compact=on; document.body.classList.toggle('compact',on); saveAll(); }

// ═══════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════
function showView(id, el) {
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById('view-' + id);
  if (view) view.classList.add('active');
  if (el)   el.classList.add('active');

  // Update topbar title and browser tab title
  const VIEW_LABELS = {
    dashboard      : 'Dashboard',
    teller         : 'Teller',
    entries        : 'Entries',
    'agent-entries': 'My Collections',
    agents         : 'Agents',
    customers      : 'Customers',
    loans          : 'Loans',
    investments    : 'Investments',
    transfers      : 'Transfers',
    cards          : 'Card Replacement',
    collaborations : 'Collaborations',
    sheets         : 'Collection Sheets',
    accounting     : 'Accounting',
    reports        : 'Reports',
    users          : 'Users & Access',
    settings       : 'Settings',
  };
  const viewLabel  = VIEW_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1);
  const company    = SETTINGS.companyName || 'Pro Susu Banking';
  const pageTitleEl = document.getElementById('page-title');
  if (pageTitleEl) pageTitleEl.textContent = viewLabel;
  document.title = `${viewLabel} — ${company}`;

  const triggers = {
    settings : () => {
      loadSettingsUI();
      const firstBtn = document.querySelector('#settings-subtabs .sub-tab');
      if (firstBtn) showSettingsTab('general', firstBtn);
    },
    users : () => {
      const firstBtn = document.querySelector('#users-subtabs .sub-tab');
      if (firstBtn) showUsersTab('overview', firstBtn);
    },
    reports : () => {
      const firstBtn = document.querySelector('#reports-subtabs .sub-tab');
      if (firstBtn) showReportTab('overview', firstBtn);
    },
    investments    : () => { if (typeof renderInvestments     === 'function') renderInvestments(); },
    sheets         : () => { if (typeof renderSheetList        === 'function') renderSheetList(null); },
    cards          : () => { if (typeof initCardReplacement    === 'function') initCardReplacement(); },
    customers      : () => { if (typeof renderCustomerList     === 'function') renderCustomerList(''); },
    agents         : () => {
      if (typeof renderAgentList === 'function') renderAgentList('');
      // Reset assign-customers checkbox when navigating to agents
      const t = document.getElementById('ag-assign-toggle');
      const s = document.getElementById('ag-assign-section');
      if (t) t.checked = false;
      if (s) s.style.display = 'none';
    },
    loans          : () => {
      if (typeof updateLoanStats          === 'function') updateLoanStats();
      if (typeof populateLoanAgentSelector === 'function') populateLoanAgentSelector();
    },
    entries        : () => { if (typeof renderEntriesList      === 'function') renderEntriesList(); },
    'agent-entries': () => { if (typeof renderAgentEntriesPage === 'function') renderAgentEntriesPage(); },
    teller         : () => {
      // Update agent submissions badge on teller tab
      if (typeof getAgentSubmissionBadgeCount === 'function') {
        const cnt = getAgentSubmissionBadgeCount();
        const badge = document.getElementById('agent-subs-badge');
        if (badge) { badge.textContent = cnt; badge.style.display = cnt > 0 ? '' : 'none'; }
      }
    },
    transfers      : () => {
      if (typeof renderTransferForm    === 'function') renderTransferForm();
      if (typeof renderTransferHistory === 'function') renderTransferHistory();
    },
    accounting     : () => { if (typeof renderAccountingJournal === 'function') renderAccountingJournal(); },
    collaborations : () => {
      if (typeof renderCollabOverview    === 'function') renderCollabOverview();
      if (typeof populatePartnerSelector === 'function') populatePartnerSelector();
    },
    teller         : () => {
      if (typeof updateTellerStats  === 'function') updateTellerStats();
      if (typeof renderFloatPanel   === 'function') renderFloatPanel();
    },
    payroll        : () => {
      if (typeof initPayrollView === 'function') initPayrollView();
    },
  };

  if (triggers[id]) {
    try { triggers[id](); }
    catch(e) { console.error('showView trigger error [' + id + ']:', e); }
  }
}
function showSubTab(prefix, id, el) {
  const parent=el ? el.closest('.sub-tabs') : null;
  if(parent) parent.querySelectorAll('.sub-tab').forEach(s=>s.classList.remove('active'));
  if(el) el.classList.add('active');
  document.querySelectorAll(`[id^="${prefix}-"]`).forEach(s=>{
    if(s.classList.contains('teller-sub')) s.classList.remove('active');
  });
  const target=document.getElementById(`${prefix}-${id}`); if(target) target.classList.add('active');
  if(prefix==='cu'&&id==='susu') renderCustomerByType('susu');
  if(prefix==='cu'&&id==='lending') renderCustomerByType('lending');
  if(prefix==='cu'&&id==='savings') renderCustomerByType('savings');
  if(prefix==='ag'&&id==='add') updateAgentPreview();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════

const SETTINGS_DEFAULTS = {
  companyName      : 'Pro Susu Banking',
  tagline          : 'Your trusted savings partner',
  companyPhone     : '',
  companyEmail     : '',
  companyLocation  : '',
  companyWebsite   : '',
  openTime         : '08:00',
  closeTime        : '17:00',
  workingDays      : ['Mon','Tue','Wed','Thu','Fri'],
  workSaturday     : false,
  workHoliday      : false,
  language         : 'en',
  currency         : 'GH₵',
  timezone         : 'Africa/Accra',
  dateFormat       : 'DD/MM/YYYY',
  numFormat        : '1,234.56',
  susuPrefix       : 'TN',
  lendingPrefix    : 'LD',
  savingsPrefix    : 'TS',
  loanRate         : 0.25,
  loanBase         : 6,
  loanDepositPct   : 30,
  instantPenalty   : 1,
  monthlyPenalty   : 1,
  cardFee          : 30,
  commissionRate   : 1,
  smsEnabled       : false,
  smsProvider      : 'mnotify',
  smsSenderId      : 'PROSUSU',
  smsApiKey        : '',
  notifSound       : false,
  notifDesktop     : false,
  notifOverdue     : true,
  notifLowBalance  : false,
  notifBalanceThreshold: 500,
  notifDailySummary: false,
  notifLoanComplete: true,
  notifHolidays    : true,
  notifHolidayDays : 3,
  notifPaymentDue  : true,
  notifDueDays     : 3,
  notifInvestment  : true,
  notifNewCustomer : false,
  strongPass       : false,
  autoLogout       : false,
  logoutMins       : 30,
  rbac             : false,
  loginLimit       : false,
  activityLog      : true,
  confirmDelete    : true,
  backupOnChange   : false,
  encryptData      : false,
  maskData         : false,
  logRetentionDays : 90,
  autoBackup       : false,
  backupFreq       : 'daily',
  backupTime       : '23:00',
  theme            : 'dark',
  compact          : false,
  fontSize         : '14',
  sidebarStyle     : 'full',
  companyLogo      : null,
  brandColor       : '#c9a84c',
  sidebarHeader    : 'Pro Susu Banking',
  companyInvProducts: [],
};

function showSettingsTab(tab, btn) {
  document.querySelectorAll('.st-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('st-panel-' + tab);
  if (panel) panel.classList.remove('hidden');
  if (btn) {
    document.querySelectorAll('#settings-subtabs .sub-tab')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  if (tab === 'notifications') renderUpcomingHolidays();
  if (tab === 'backup')        { refreshStorageUsage(); renderBackupHistory(); }
  if (tab === 'appearance')    syncThemeCards();
  if (tab === 'financial')     { if (typeof renderSMSPreviews === 'function') renderSMSPreviews(); }
  if (tab === 'plan')          { if (typeof renderPlanSettingsTab === 'function') renderPlanSettingsTab(); }

  // Plan & Billing tab — admin only
  const planTab = document.getElementById('settings-plan-tab');
  if (planTab) planTab.style.display = (currentUser?.role === 'admin') ? '' : 'none';
}

function settingChanged(key, val) {
  SETTINGS[key] = val;
  saveAll();

  const liveApply = {
    theme          : () => applyTheme(val),
    fontSize       : () => applyFontSize(val),
    compact        : () => applyCompact(val),
    sidebarStyle   : () => applySidebarStyle(val),
    language       : () => applyLanguage(val),
    brandColor     : () => applyBrandColor(val),
    sidebarHeader  : () => updateBrandNames(),
    tagline        : () => updateBrandNames(),
    companyName    : () => updateBrandNames(),
    currency       : () => applyCurrencyChange(val),
    loanRate       : () => updateFormulaDisplay(),
    loanBase       : () => updateFormulaDisplay(),
    notifLowBalance: () => {
      const w = document.getElementById('notif-balance-threshold-wrap');
      if (w) w.style.display = val ? 'block' : 'none';
    },
    autoBackup     : () => toggleAutoBackup(val),
  };
  if (liveApply[key]) {
    try { liveApply[key](); } catch(e) { console.warn('settingChanged apply error:', key, e); }
  }
}

// ═══════════════════════════════════════════════════════
//  LOAD SETTINGS UI
// ═══════════════════════════════════════════════════════
let _settingsUILoaded = false;

function loadSettingsUI() {
  if (_settingsUILoaded) return;
  _settingsUILoaded = true;

  const s   = SETTINGS;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value   = (v ?? ''); };
  const chk = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; };
  const sel = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; };

  // General
  set('st-company-name', s.companyName     || 'Pro Susu Banking');
  set('st-tagline',      s.tagline         || '');
  set('st-phone',        s.companyPhone    || '');
  set('st-email',        s.companyEmail    || '');
  set('st-location',     s.companyLocation || '');
  set('st-website',      s.companyWebsite  || '');
  set('st-open-time',    s.openTime        || '08:00');
  set('st-close-time',   s.closeTime       || '17:00');
  chk('st-saturday',     s.workSaturday);
  chk('st-holiday',      s.workHoliday);
  sel('st-language',     s.language    || 'en');
  sel('st-currency',     s.currency    || 'GH₵');
  sel('st-timezone',     s.timezone    || 'Africa/Accra');
  sel('st-date-format',  s.dateFormat  || 'DD/MM/YYYY');
  sel('st-num-format',   s.numFormat   || '1,234.56');
  const days = s.workingDays || ['Mon','Tue','Wed','Thu','Fri'];
  ['mon','tue','wed','thu','fri'].forEach(d => {
    const el = document.getElementById('wd-' + d);
    if (el) el.checked = days.includes(d.charAt(0).toUpperCase() + d.slice(1));
  });

  // Financial
  set('st-susu-prefix',     s.susuPrefix     || 'TN');
  set('st-lending-prefix',  s.lendingPrefix  || 'LD');
  set('st-savings-prefix',  s.savingsPrefix  || 'TS');
  set('st-loan-rate',       s.loanRate       ?? 0.25);
  set('st-loan-base',       s.loanBase       ?? 6);
  set('st-loan-dep-pct',    s.loanDepositPct ?? 30);
  set('st-instant-penalty', s.instantPenalty ?? 1);
  set('st-monthly-penalty', s.monthlyPenalty ?? 1);
  set('st-card-fee',        s.cardFee        ?? 30);
  set('st-commission',      s.commissionRate ?? 1);
  chk('st-sms-enabled',     s.smsEnabled);
  sel('st-sms-provider',    s.smsProvider    || 'mnotify');
  set('st-sms-sender',      s.smsSenderId    || '');
  set('st-sms-apikey',      s.smsApiKey      || '');

  // Notifications
  chk('notif-sound',             s.notifSound);
  chk('notif-desktop',           s.notifDesktop);
  chk('notif-overdue',           s.notifOverdue);
  chk('notif-low-balance',       s.notifLowBalance);
  set('notif-balance-threshold', s.notifBalanceThreshold || 500);
  chk('notif-daily-summary',     s.notifDailySummary);
  chk('notif-loan-complete',     s.notifLoanComplete);
  chk('notif-holidays',          s.notifHolidays);
  set('notif-holiday-days',      s.notifHolidayDays || 3);
  chk('notif-payment-due',       s.notifPaymentDue);
  set('notif-due-days',          s.notifDueDays || 3);
  chk('notif-investment',        s.notifInvestment);
  chk('notif-new-customer',      s.notifNewCustomer);
  const bw = document.getElementById('notif-balance-threshold-wrap');
  if (bw) bw.style.display = s.notifLowBalance ? 'block' : 'none';

  // Security
  chk('st-strong-pass',      s.strongPass);
  chk('st-auto-logout',      s.autoLogout);
  set('st-logout-mins',      s.logoutMins       ?? 30);
  chk('st-rbac',             s.rbac);
  chk('st-login-limit',      s.loginLimit);
  chk('st-activity-log',     s.activityLog      !== false);
  chk('st-confirm-delete',   s.confirmDelete    !== false);
  chk('st-backup-on-change', s.backupOnChange);
  chk('st-encrypt',          s.encryptData);
  chk('st-mask-data',        s.maskData);
  set('st-log-days',         s.logRetentionDays ?? 90);

  // Backup
  chk('st-auto-backup', s.autoBackup);
  sel('st-backup-freq', s.backupFreq || 'daily');
  set('st-backup-time', s.backupTime || '23:00');
  const ao = document.getElementById('auto-backup-options');
  if (ao) ao.style.display = s.autoBackup ? 'block' : 'none';

  // Appearance
  sel('st-font-size',     s.fontSize      || '14');
  sel('st-sidebar-style', s.sidebarStyle  || 'full');
  chk('st-compact',       s.compact);
  set('st-sidebar-header', s.sidebarHeader || s.companyName || 'Pro Susu Banking');
  const bc = document.getElementById('st-brand-color');
  const bt = document.getElementById('st-brand-color-text');
  const color = s.brandColor || '#c9a84c';
  if (bc) bc.value = color;
  if (bt) bt.value = color;

  // Apply all live effects on first load
  applyTheme(s.theme || 'dark');
  applyFontSize(s.fontSize || '14');
  applyCompact(s.compact);
  if (s.brandColor && s.brandColor !== '#c9a84c') applyBrandColor(s.brandColor);
  if (s.companyLogo) applyLogo(s.companyLogo);
  if (s.sidebarStyle === 'icons') applySidebarStyle('icons');
  if (s.language && s.language !== 'en') applyLanguage(s.language);
  updateBrandNames();
  syncThemeCards();
  updateFormulaDisplay();

  const bpn = document.getElementById('brand-preview-name');
  if (bpn) bpn.textContent = s.sidebarHeader || s.companyName || 'Pro Susu Banking';
  const bpt = document.getElementById('brand-preview-tagline');
  if (bpt) bpt.textContent = s.tagline || '';
}

// ─────────────────────────────────────────────────────
//  FIX 1 & 3: updateBrandNames — reliably targets all
//  tagline/name elements in sidebar AND login page
// ─────────────────────────────────────────────────────
function updateBrandNames() {
  const name    = SETTINGS.sidebarHeader || SETTINGS.companyName || 'Pro Susu Banking';
  const tagline = SETTINGS.tagline || 'Management System';

  // Sidebar company name
  document.querySelectorAll('.brand-name, #sb-company-name').forEach(el => {
    el.textContent = name;
  });

  // FIX 1 — sidebar tagline: target by class AND by id as fallback
  const brandSub = document.querySelector('.brand-sub');
  if (brandSub) brandSub.textContent = tagline;

  // FIX 1 — login page tagline: uses specific ID
  const loginTag = document.getElementById('login-company-tagline');
  if (loginTag) loginTag.textContent = tagline;

  // Login page company name
  const loginName = document.getElementById('login-company-name');
  if (loginName) loginName.textContent = name;

  // Settings live preview
  const bpn = document.getElementById('brand-preview-name');
  if (bpn) bpn.textContent = name;
  const bpt = document.getElementById('brand-preview-tagline');
  if (bpt) bpt.textContent = tagline;

  // Page title — only reset to company name if no view is currently active
  // (i.e. on initial load), otherwise showView() already set the correct title
  const activeView = document.querySelector('.view.active');
  if (!activeView) document.title = name;
}

// ═══════════════════════════════════════════════════════
//  SAVE / RESET SETTINGS TAB
// ═══════════════════════════════════════════════════════
function saveSettingsTab(tab) {
  const btn = event?.target;
  const restore = btnLoader(btn, 'Saving...');
  showLoader('💾 Saving Settings...', 'Applying changes and writing to storage');
  setTimeout(() => {
    saveAll();
    logActivity('Settings', `Saved ${tab} settings`, 0, 'saved');
    hideLoader();
    restore();
    toast(`✅ ${tab.charAt(0).toUpperCase() + tab.slice(1)} settings saved`, 'success');
  }, 500);
}

// FIX 4 — loader on reset + fix _settingsUILoaded so UI actually refreshes
function resetSettingsTab(tab) {
  showConfirm(`Reset ${tab} Settings?`,
    'This will restore defaults for this section. Your data is unaffected.',
    () => {
      showLoader('🔄 Resetting to defaults...', `Restoring ${tab} settings`);
      setTimeout(() => {
        const D = SETTINGS_DEFAULTS;
        const groups = {
          general      : ['companyName','tagline','companyPhone','companyEmail',
                          'companyLocation','companyWebsite','openTime','closeTime',
                          'workingDays','workSaturday','workHoliday','language',
                          'currency','timezone','dateFormat','numFormat'],
          financial    : ['susuPrefix','lendingPrefix','savingsPrefix','loanRate',
                          'loanBase','loanDepositPct','instantPenalty','monthlyPenalty',
                          'cardFee','commissionRate','smsEnabled','smsProvider',
                          'smsSenderId','smsApiKey'],
          notifications: ['notifSound','notifDesktop','notifOverdue','notifLowBalance',
                          'notifBalanceThreshold','notifDailySummary','notifLoanComplete',
                          'notifHolidays','notifHolidayDays','notifPaymentDue',
                          'notifDueDays','notifInvestment','notifNewCustomer'],
          security     : ['strongPass','autoLogout','logoutMins','rbac','loginLimit',
                          'activityLog','confirmDelete','backupOnChange',
                          'encryptData','maskData','logRetentionDays'],
          backup       : ['autoBackup','backupFreq','backupTime'],
          appearance   : ['theme','compact','fontSize','sidebarStyle',
                          'companyLogo','brandColor','sidebarHeader'],
        };
        (groups[tab] || []).forEach(k => { SETTINGS[k] = D[k]; });

        // Allow loadSettingsUI to re-run so inputs reflect defaults
        _settingsUILoaded = false;
        loadSettingsUI();
        saveAll();
        hideLoader();
        toast(`${tab.charAt(0).toUpperCase() + tab.slice(1)} settings reset to default`, 'info');
      }, 600);
    });
}

// Working days
function updateWorkingDays() {
  const days = ['Mon','Tue','Wed','Thu','Fri'].filter(d => {
    const el = document.getElementById('wd-' + d.toLowerCase());
    return el && el.checked;
  });
  SETTINGS.workingDays = days;
}


// ═══════════════════════════════════════════════════════
//  LOGO
// ═══════════════════════════════════════════════════════
function uploadCompanyLogo(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('Logo must be under 2MB', 'error'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    SETTINGS.companyLogo = e.target.result;
    applyLogo(e.target.result);
    saveAll();
    toast('Logo uploaded and applied ✅', 'success');
  };
  reader.readAsDataURL(file);
}

// FIX 2 — applyLogo uses correct login element ID (#login-logo-display)
function applyLogo(src) {
  const logoHTML = src
    ? `<img src="${src}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;display:block">`
    : '🏦';

  // Sidebar brand icon
  const sbIcon = document.querySelector('.sidebar-brand .brand-icon');
  if (sbIcon) sbIcon.innerHTML = logoHTML;

  // FIX 2 — login page uses id="login-logo-display", NOT class .login-icon
  const loginIcon = document.getElementById('login-logo-display');
  if (loginIcon) {
    loginIcon.innerHTML = src
      ? `<img src="${src}" style="width:44px;height:44px;border-radius:10px;object-fit:cover">`
      : '🏦';
  }

  // Settings logo preview
  const lp = document.getElementById('logo-preview');
  if (lp) lp.innerHTML = src
    ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
    : '🏢';

  // Settings brand preview
  const bp = document.getElementById('brand-preview-logo');
  if (bp) bp.innerHTML = src
    ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
    : '🏢';
}

function clearCompanyLogo() {
  SETTINGS.companyLogo = null;
  applyLogo(null);
  saveAll();
  toast('Logo removed', 'info');
}

// ─────────────────────────────────────────────────────
//  FIX 3 — applyLanguage: works without data-nav attrs
//  by reading the view name from onclick attribute
// ─────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    dashboard:'Dashboard', teller:'Teller', entries:'Entries',
    agents:'Agents', customers:'Customers', loans:'Loans',
    investments:'Investments', transfers:'Transfers', cards:'Card Replacement',
    collaborations:'Collaborations', sheets:'Collection Sheets',
    accounting:'Accounting', reports:'Reports', users:'Users',
    settings:'Settings', logout:'Logout'
  },
  fr: {
    dashboard:'Tableau de bord', teller:'Caissier', entries:'Saisies',
    agents:'Agents', customers:'Clients', loans:'Prêts',
    investments:'Investissements', transfers:'Transferts', cards:'Remplacement Carte',
    collaborations:'Collaborations', sheets:'Feuilles de collecte',
    accounting:'Comptabilité', reports:'Rapports', users:'Utilisateurs',
    settings:'Paramètres', logout:'Déconnexion'
  },
  es: {
    dashboard:'Panel', teller:'Cajero', entries:'Entradas',
    agents:'Agentes', customers:'Clientes', loans:'Préstamos',
    investments:'Inversiones', transfers:'Transferencias', cards:'Reemplazo de Tarjeta',
    collaborations:'Colaboraciones', sheets:'Hojas de cobro',
    accounting:'Contabilidad', reports:'Informes', users:'Usuarios',
    settings:'Configuración', logout:'Cerrar sesión'
  },
  pt: {
    dashboard:'Painel', teller:'Caixa', entries:'Lançamentos',
    agents:'Agentes', customers:'Clientes', loans:'Empréstimos',
    investments:'Investimentos', transfers:'Transferências', cards:'Substituição Cartão',
    collaborations:'Colaborações', sheets:'Folhas de cobrança',
    accounting:'Contabilidade', reports:'Relatórios', users:'Utilizadores',
    settings:'Configurações', logout:'Sair'
  },
  ha: {
    dashboard:'Allon Dashbodi', teller:'Karsashi', entries:'Shigarwar Bayanai',
    agents:'Wakilan', customers:'Abokan Ciniki', loans:'Lamunin Kudi',
    investments:'Saka Hannun Jari', transfers:'Canja Kudi', cards:'Maye Katin',
    collaborations:'Hadin Gwiwa', sheets:'Takardun Tattara',
    accounting:'Lissafi', reports:'Rahotannin', users:'Masu Amfani',
    settings:'Saiti', logout:'Fita'
  },
  tw: {
    dashboard:'Nhyehyɛe', teller:'Sika Gua', entries:'Nsɛm Kyerɛw',
    agents:'Ɔgye Ho', customers:'Ahofɔ', loans:'Sika Boaboa',
    investments:'Sika To Ase', transfers:'Tumi Sika', cards:'Kadi Foforo',
    collaborations:'Bom Adwuma', sheets:'Akontabuo',
    accounting:'Akontaa', reports:'Amanneɛ', users:'Ndwumafufo',
    settings:'Nhyehyɛe', logout:'Pue'
  },
  sw: {
    dashboard:'Dashibodi', teller:'Mhusika', entries:'Maingizo',
    agents:'Mawakala', customers:'Wateja', loans:'Mikopo',
    investments:'Uwekezaji', transfers:'Uhamisho', cards:'Ubadilishaji Kadi',
    collaborations:'Ushirikiano', sheets:'Karatasi za Ukusanyaji',
    accounting:'Uhasibu', reports:'Ripoti', users:'Watumiaji',
    settings:'Mipangilio', logout:'Toka'
  },
  ar: {
    dashboard:'لوحة التحكم', teller:'الصراف', entries:'الإدخالات',
    agents:'العملاء', customers:'الزبائن', loans:'القروض',
    investments:'الاستثمارات', transfers:'التحويلات', cards:'استبدال البطاقة',
    collaborations:'التعاون', sheets:'أوراق التحصيل',
    accounting:'المحاسبة', reports:'التقارير', users:'المستخدمون',
    settings:'الإعدادات', logout:'تسجيل الخروج'
  }
};

// Map showView() view IDs to translation keys
const NAV_VIEW_TO_KEY = {
  dashboard:'dashboard', teller:'teller', entries:'entries',
  agents:'agents', customers:'customers', loans:'loans',
  investments:'investments', transfers:'transfers', cards:'cards',
  collaborations:'collaborations', sheets:'sheets',
  accounting:'accounting', reports:'reports', users:'users', settings:'settings'
};

function applyLanguage(lang) {
  SETTINGS.language = lang;
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // FIX 3 — parse onclick to extract the view id, then swap the text node
  // while preserving the .nav-icon span
  document.querySelectorAll('.nav-item').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    const match   = onclick.match(/showView\('(\w+)'/);
    if (!match) return;
    const viewId  = match[1];
    const key     = NAV_VIEW_TO_KEY[viewId] || viewId;
    const label   = t[key];
    if (!label) return;

    // Keep the icon span, replace only the text node
    const icon = el.querySelector('.nav-icon');
    el.textContent = label;
    if (icon) el.prepend(icon);
  });

  // Also support any elements with data-nav attribute (future-proofing)
  document.querySelectorAll('[data-nav]').forEach(el => {
    const key = el.dataset.nav;
    if (t[key]) el.textContent = t[key];
  });

  // Logout button
  const logoutBtn = document.querySelector('.topbar-btn[onclick*="doLogout"]');
  if (logoutBtn && t.logout) logoutBtn.textContent = '🚪 ' + t.logout;

  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';

  const langName = document.getElementById('st-language')?.selectedOptions[0]?.text || lang;
  toast(`Language changed to ${langName}`, 'info');
}

// Desktop notifications
function toggleDesktopNotifs(on) {
  settingChanged('notifDesktop', on);
  const status = document.getElementById('notif-desktop-status');
  if (on) {
    if (!('Notification' in window)) {
      if (status) status.textContent = '❌ Browser does not support notifications';
      document.getElementById('notif-desktop').checked = false;
      return;
    }
    Notification.requestPermission().then(perm => {
      SETTINGS.notifDesktop = perm === 'granted';
      document.getElementById('notif-desktop').checked = perm === 'granted';
      if (status) {
        status.textContent = perm === 'granted'
          ? '✅ Desktop notifications enabled'
          : '❌ Permission denied — please allow notifications in your browser settings';
      }
    });
  } else {
    if (status) status.textContent = '';
  }
}

function testNotification(type) {
  if (type === 'sound') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch(e) { toast('Sound not supported in this browser', 'warning'); }
  } else if (type === 'desktop') {
    if (Notification.permission === 'granted') {
      new Notification('Pro Susu Banking', { body: 'Test desktop notification ✅', icon: '/favicon.ico' });
    } else {
      toast('Desktop notifications not permitted', 'warning');
    }
  } else if (type === 'overdue') {
    const overdue = LOANS.filter(l =>
      l.status === 'active' && l.schedule?.some(s => !s.paid && isOverdue(s.dueDate))
    );
    if (overdue.length) {
      toast(`⚠️ ${overdue.length} loan(s) have overdue payments`, 'warning', 5000);
    } else {
      toast('✅ No overdue loans found', 'success');
    }
  }
}

// Upcoming holidays
const GH_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-03-06', name: 'Independence Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-01', name: "Workers' Day" },
  { date: '2026-05-25', name: 'Africa Day' },
  { date: '2026-07-01', name: 'Republic Day' },
  { date: '2026-08-04', name: "Founders' Day" },
  { date: '2026-09-21', name: 'Kwame Nkrumah Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Boxing Day' },
];

function renderUpcomingHolidays() {
  const el  = document.getElementById('upcoming-holidays-list'); if (!el) return;
  const now = new Date(todayISO());
  const upcoming = GH_HOLIDAYS_2026.filter(h => new Date(h.date) >= now).slice(0, 5);
  if (!upcoming.length) {
    el.innerHTML = '<div class="text-muted" style="font-size:.8rem;padding:8px 0">No upcoming holidays this year</div>';
    return;
  }
  el.innerHTML = upcoming.map(h => {
    const diff = Math.ceil((new Date(h.date) - now) / 86400000);
    return `<div style="display:flex;justify-content:space-between;align-items:center;
      padding:8px 0;border-bottom:1px solid var(--border);font-size:.8rem">
      <div>
        <div class="fw-600">${h.name}</div>
        <div class="text-muted" style="font-size:.72rem">${fmtDate(h.date)}</div>
      </div>
      <span style="padding:3px 9px;border-radius:20px;font-size:.7rem;
        background:${diff <= 7 ? 'rgba(251,191,36,.15)' : 'var(--surface2)'};
        border:1px solid ${diff <= 7 ? 'rgba(251,191,36,.3)' : 'var(--border)'};
        color:${diff <= 7 ? 'var(--warning)' : 'var(--muted)'}">
        ${diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`}
      </span>
    </div>`;
  }).join('');
}

// Auto backup
let _backupTimer = null;
function toggleAutoBackup(on) {
  settingChanged('autoBackup', on);
  const ao = document.getElementById('auto-backup-options');
  if (ao) ao.style.display = on ? 'block' : 'none';
  if (on) scheduleAutoBackup();
  else if (_backupTimer) { clearInterval(_backupTimer); _backupTimer = null; }
}

function scheduleAutoBackup() {
  if (_backupTimer) clearInterval(_backupTimer);
  if (!SETTINGS.autoBackup) return;
  const freq = SETTINGS.backupFreq || 'daily';
  const intervals = { daily: 86400000, weekly: 604800000, monthly: 2592000000 };
  const ms = intervals[freq] || 86400000;
  _backupTimer = setInterval(() => exportData(), ms);
  const nextInfo = document.getElementById('backup-next-info');
  if (nextInfo) nextInfo.textContent = `⏰ Auto backup scheduled — ${freq} at ${SETTINGS.backupTime || '23:00'}`;
}

function refreshStorageUsage() {
  const el  = document.getElementById('storage-usage-info');
  const bar = document.getElementById('storage-bar-fill');
  try {
    const data = localStorage.getItem('psb_v2') || '';
    const bytes = new Blob([data]).size;
    const kb = (bytes / 1024).toFixed(1);
    const mb = (bytes / 1048576).toFixed(2);
    const pct = Math.min(100, Math.round((bytes / (5 * 1024 * 1024)) * 100));
    if (el) el.textContent = `${kb} KB (${mb} MB) used of ~5 MB limit`;
    if (bar) {
      bar.style.width = pct + '%';
      bar.style.background = pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)';
    }
  } catch(e) {
    if (el) el.textContent = 'Unable to calculate storage usage';
  }
}

// Export / Import
function exportData() {
  const data = JSON.stringify({ AGENTS, CUSTOMERS, LOANS, INVESTMENTS, TRANSFERS,
    CARD_REPLACEMENTS, COLLAB_PARTNERS, COLLAB_TRANSACTIONS,
    COLLECTION_SHEETS, ACCOUNTING_ENTRIES, USERS, TELLER_STATE,
    ACTIVITY_LOG, SETTINGS }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `psb-backup-${todayISO()}.json`; a.click();
  URL.revokeObjectURL(url);
  if (!SETTINGS.backupHistory) SETTINGS.backupHistory = [];
  SETTINGS.backupHistory.unshift({ date: new Date().toISOString(), size: data.length });
  SETTINGS.backupHistory = SETTINGS.backupHistory.slice(0, 10);
  saveAll();
  toast('Backup exported successfully', 'success');
  renderBackupHistory();
}

function importData(input) {
  const file = input.files[0]; if (!file) return;
  showConfirm('Import Backup?',
    'This will overwrite ALL current data with the backup file. This cannot be undone.',
    () => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const d = JSON.parse(e.target.result);
          if (d.CUSTOMERS) CUSTOMERS = d.CUSTOMERS;
          if (d.AGENTS)    AGENTS    = d.AGENTS;
          if (d.LOANS)     LOANS     = d.LOANS;
          if (d.INVESTMENTS) INVESTMENTS = d.INVESTMENTS;
          if (d.TRANSFERS)   TRANSFERS   = d.TRANSFERS;
          if (d.CARD_REPLACEMENTS)    CARD_REPLACEMENTS    = d.CARD_REPLACEMENTS;
          if (d.COLLAB_PARTNERS)      COLLAB_PARTNERS      = d.COLLAB_PARTNERS;
          if (d.COLLAB_TRANSACTIONS)  COLLAB_TRANSACTIONS  = d.COLLAB_TRANSACTIONS;
          if (d.COLLECTION_SHEETS)    COLLECTION_SHEETS    = d.COLLECTION_SHEETS;
          if (d.ACCOUNTING_ENTRIES)   ACCOUNTING_ENTRIES   = d.ACCOUNTING_ENTRIES;
          if (d.USERS)        USERS        = d.USERS;
          if (d.TELLER_STATE) TELLER_STATE = d.TELLER_STATE;
          if (d.ACTIVITY_LOG) ACTIVITY_LOG = d.ACTIVITY_LOG;
          if (d.SETTINGS) Object.assign(SETTINGS, d.SETTINGS);
          saveAll();
          _settingsUILoaded = false;
          loadSettingsUI();
          applyTheme(SETTINGS.theme || 'dark');
          toast('Backup imported successfully ✅', 'success');
        } catch(err) {
          toast('Invalid backup file — could not parse JSON', 'error');
        }
      };
      reader.readAsText(file);
    });
}

function clearData() {
  showConfirm('⚠️ Clear ALL Data?',
    'This will permanently delete ALL customers, loans, collections, and settings. This CANNOT be undone.',
    () => { localStorage.removeItem('psb_v2'); location.reload(); });
}

function renderBackupHistory() {
  const el = document.getElementById('backup-history-list'); if (!el) return;
  const hist = SETTINGS.backupHistory || [];
  if (!hist.length) {
    el.innerHTML = `<div class="empty-state" style="padding:16px 0">
      <div class="ei">💾</div><div class="et">No backups yet</div></div>`;
    return;
  }
  el.innerHTML = hist.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:8px 0;border-bottom:1px solid var(--border);font-size:.78rem">
      <div>
        <div class="fw-600">${fmtDateTime(b.date)}</div>
        <div class="text-muted" style="font-size:.7rem">${(b.size / 1024).toFixed(1)} KB</div>
      </div>
      <span class="badge b-green" style="font-size:.62rem">✅ Exported</span>
    </div>`).join('');
}

function updateFormulaDisplay() {
  const rate = SETTINGS.loanRate || 0.25;
  const base = SETTINGS.loanBase || 6;
  const text = `Interest = (Amount × ${rate} ÷ ${base}) × Months`;
  const e1 = document.getElementById('formula-display');
  if (e1) e1.textContent = text;
  const e2 = document.getElementById('formula-display-settings');
  if (e2) e2.textContent = text;
}

function changeAdminPass() {
  const np = document.getElementById('new-admin-pass')?.value;
  if (!np || np.length < 4) return toast('Password too short', 'error');
  const admin = USERS.find(u => u.username === 'admin');
  if (admin) { admin.password = np; saveAll(); toast('Admin password updated ✅', 'success'); }
  const el = document.getElementById('new-admin-pass');
  if (el) el.value = '';
}


// ═══════════════════════════════════════════════════════
//  CONFIRM MODAL
// ═══════════════════════════════════════════════════════
function showConfirm(title, body, onOk, btnStyle) {
  document.getElementById('m-conf-title').textContent = title;
  document.getElementById('m-conf-body').innerHTML = body;
  const okBtn = document.getElementById('m-conf-ok');
  okBtn.onclick = () => { closeModal('modal-confirm'); onOk(); };
  // Style the confirm button: 'danger' = red, default = original btn-danger (already red)
  okBtn.className = btnStyle === 'danger'
    ? 'btn btn-danger'
    : 'btn btn-danger';   // both use danger; kept for future styles
  openModal('modal-confirm');
}

// ═══════════════════════════════════════════════════════
//  ACTIVITY LOG
// ═══════════════════════════════════════════════════════
function logActivity(type, desc, amount, status) {
  ACTIVITY_LOG.unshift({type,desc,amount,status,time:new Date().toISOString(),by:currentUser?.name||'System'});
  if(ACTIVITY_LOG.length>100) ACTIVITY_LOG=ACTIVITY_LOG.slice(0,100);
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════
function updateDashboard() {
  const ts=TELLER_STATE;
  const coll=ts.collections.reduce((s,c)=>s+c.amount,0);
  const wd=ts.withdrawals.filter(w=>w.status==='paid').reduce((s,w)=>s+w.amount,0);
  const exp=ts.expenses.reduce((s,e)=>s+e.amount,0);
  const cash=Math.max(0,ts.startOfDay+coll-wd-exp);
  const activeLoans=LOANS.filter(l=>l.status==='active');
  const totalOutstanding=activeLoans.reduce((s,l)=>s+(l.totalRepayment-l.payments.reduce((a,p)=>a+p.amount,0)),0);
  const activeAgents=AGENTS.filter(a=>a.status==='active');
  const setTxt=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  setTxt('d-float',fmt(ts.startOfDay)); setTxt('d-coll',fmt(coll));
  setTxt('d-coll-sub',ts.collections.length+' posted today');
  setTxt('d-wd',fmt(wd)); setTxt('d-wd-sub',ts.withdrawals.filter(w=>w.status==='paid').length+' processed');
  setTxt('d-loans',activeLoans.length); setTxt('d-loans-sub',fmt(totalOutstanding)+' outstanding');
  setTxt('d-agents',AGENTS.length); setTxt('d-agents-sub',activeAgents.length+' active');
  setTxt('d-customers',CUSTOMERS.length);
  const sus=CUSTOMERS.filter(c=>c.type==='susu').length, sav=CUSTOMERS.filter(c=>c.type==='savings').length;
  setTxt('d-cust-sub',sus+' Susu · '+sav+' Savings');
  setTxt('s-float',fmt(ts.startOfDay)); setTxt('s-coll','+ '+fmt(coll));
  setTxt('s-wd','− '+fmt(wd)); setTxt('s-exp','− '+fmt(exp)); setTxt('s-hand',fmt(cash));
  const perf=document.getElementById('dash-agent-perf');
  if(AGENTS.length===0) { perf.innerHTML='<div class="empty-state" style="padding:20px 0"><div class="ei">🧑‍💼</div><div class="et">No agents yet</div></div>'; }
  else {
    perf.innerHTML=AGENTS.slice(0,5).map(a=>{
      const agColl=ts.collections.filter(c=>c.agentId===a.id).reduce((s,c)=>s+c.amount,0);
      const pct=a.monthlyTarget>0?Math.min(100,Math.round(agColl/a.monthlyTarget*100)):0;
      return `<div style="margin-bottom:10px">
        <div class="flex-between" style="margin-bottom:3px"><span class="fw-600" style="font-size:.83rem">${a.firstName} ${a.lastName}</span><span class="agent-code">${a.code}</span></div>
        <div class="flex-between" style="margin-bottom:4px"><span class="text-muted" style="font-size:.75rem">${fmt(agColl)} collected</span><span style="font-size:.72rem;color:var(--gold)">${pct}% of target</span></div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }
  const ab=document.getElementById('dash-activity');
  if(!ACTIVITY_LOG.length) { ab.innerHTML='<tr><td colspan="5" class="text-center text-muted" style="padding:24px">No activity yet</td></tr>'; }
  else {
    const typeColors={Float:'text-gold',Collection:'text-success',Withdrawal:'text-danger',Expense:'text-danger',Loan:'text-info',Investment:'text-info'};
    ab.innerHTML=ACTIVITY_LOG.slice(0,15).map(a=>`<tr><td class="text-muted" style="font-size:.75rem">${fmtTime(a.time)}</td><td><span class="${typeColors[a.type]||''} fw-600" style="font-size:.8rem">${a.type}</span></td><td style="font-size:.82rem">${a.desc}</td><td class="mono" style="font-size:.8rem">${fmt(a.amount)}</td><td style="font-size:.78rem;color:var(--muted)">${a.by}</td></tr>`).join('');
  }

  // Float widget — admin/accountant only
  const floatWidget = document.getElementById('dash-float-widget');
  if (floatWidget) {
    const isAdmin = ['admin','accountant'].includes(currentUser?.role);
    if (!isAdmin) { floatWidget.style.display = 'none'; return; }
    floatWidget.style.display = 'block';
    if (!TELLER_STATE.floatRequests) TELLER_STATE.floatRequests = [];
    const pending   = TELLER_STATE.floatRequests.filter(r => r.status === 'pending');
    const todayConf = TELLER_STATE.floatRequests.filter(r => r.status === 'confirmed' && r.date === todayISO());
    floatWidget.innerHTML = `
      <div class="card">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span><span>💰</span> Float Status Today</span>
          <button class="btn btn-gold btn-sm"
            onclick="showView('teller',document.querySelector('.nav-item[onclick*=\\'teller\\']'));renderFloatPanel()">
            📤 Send Float
          </button>
        </div>
        ${pending.length > 0 ? `
          <div style="padding:9px 12px;background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.2);
            border-radius:var(--radius-sm);margin-bottom:10px;font-size:.8rem;color:var(--warning)">
            ⏳ ${pending.length} float${pending.length > 1 ? 's' : ''} awaiting teller confirmation
          </div>
          ${pending.map(r => `
            <div class="flex-between" style="padding:7px 0;border-bottom:1px solid var(--border);font-size:.82rem">
              <div><span class="fw-600">${r.tellerName}</span>
                <span class="text-muted" style="margin-left:6px;font-size:.74rem">${fmtDate(r.date)}</span>
              </div>
              <div class="flex-center gap-8">
                <span class="mono text-gold">${fmt(r.amount)}</span>
                <span class="badge b-yellow" style="font-size:.6rem">Pending</span>
              </div>
            </div>`).join('')}`
        : todayConf.length > 0 ? `
          <div style="padding:9px 12px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.18);
            border-radius:var(--radius-sm);font-size:.8rem;color:var(--success)">
            ✅ Float confirmed today by ${todayConf.map(r => r.tellerName).join(', ')}
            — ${todayConf.map(r => fmt(r.amount)).join(', ')}
          </div>`
        : `<div class="text-muted" style="font-size:.8rem;padding:6px 0">
             No float sent today yet.
           </div>`}
      </div>`;
  }
}


// ─────────────────────────────────────────
//  REPORTS
// ─────────────────────────────────────────
function renderOverviewReport() {
  const el = document.getElementById('rpt-overview-content');
  if (!el) return;
  const now       = new Date();
  const thisMonth = getThisMonth();
  const monthLbl  = now.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });
  const totalCusts  = CUSTOMERS.length;
  const totalBal    = CUSTOMERS.reduce((s, c) => s + (c.balance || 0), 0);
  const sheetCount  = COLLECTION_SHEETS.length;
  const sheetsThisMonth = COLLECTION_SHEETS.filter(s => (s.date || '').slice(0,7) === thisMonth).length;
  const monthTxns   = txnsInMonth(thisMonth);
  const monthDeps   = monthTxns.filter(t => ['deposit','entry','transfer_in'].includes(t.type)).reduce((s,t)=>s+t.amount,0);
  const monthWds    = monthTxns.filter(t => ['withdrawal','transfer_out'].includes(t.type)).reduce((s,t)=>s+t.amount,0);
  const monthComm   = monthTxns.filter(t => t.type === 'commission').reduce((s,t)=>s+t.amount,0);
  const monthFees   = monthTxns.filter(t => t.type === 'fee').reduce((s,t)=>s+t.amount,0);
  const monthExp    = ACCOUNTING_ENTRIES.filter(e => e.type==='expense' && (e.date||'').slice(0,7)===thisMonth).reduce((s,e)=>s+e.amount,0);
  const netFlow     = monthDeps - monthWds - monthExp;
  const activeLoans = LOANS.filter(l => l.status === 'active');
  const loanOutstanding = activeLoans.reduce((s,l)=>s+(l.totalRepayment-l.payments.reduce((a,p)=>a+p.amount,0)),0);
  el.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div class="card-title" style="margin-bottom:14px"><span>🔑</span> Key Business Metrics</div>
      <div class="metric-grid">
        <div class="metric-card"><div class="metric-sub text-muted">TOTAL CUSTOMERS</div><div class="metric-val">${totalCusts.toLocaleString()}</div><div class="metric-sub">${CUSTOMERS.filter(c=>c.status==='active').length} active</div></div>
        <div class="metric-card"><div class="metric-sub text-muted">TOTAL BALANCE</div><div class="metric-val" style="font-size:1.05rem">${fmt(totalBal)}</div><div class="metric-sub" style="color:var(--gold)">customer holdings</div></div>
        <div class="metric-card"><div class="metric-sub text-muted">COLLECTION SHEETS</div><div class="metric-val">${sheetCount.toLocaleString()}</div><div class="metric-sub" style="color:var(--success)">${sheetsThisMonth} this month</div></div>
        <div class="metric-card"><div class="metric-sub text-muted">ACTIVE LOANS</div><div class="metric-val">${activeLoans.length}</div><div class="metric-sub">${fmt(loanOutstanding)} outstanding</div></div>
        <div class="metric-card"><div class="metric-sub text-muted">TOTAL AGENTS</div><div class="metric-val">${AGENTS.length}</div><div class="metric-sub">${AGENTS.filter(a=>a.status==='active').length} active</div></div>
        <div class="metric-card"><div class="metric-sub text-muted">INVESTMENTS</div><div class="metric-val">${INVESTMENTS.filter(i=>i.status==='active').length}</div><div class="metric-sub">${fmt(INVESTMENTS.filter(i=>i.status==='active').reduce((s,i)=>s+i.amount,0))} deployed</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:14px"><span>📅</span> This Month — <span style="color:var(--gold);font-weight:400">${monthLbl}</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        <div style="padding:14px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);border-radius:var(--radius-sm)"><div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">Deposits</div><div class="mono text-success fw-600" style="font-size:1.1rem;margin-top:4px">${fmt(monthDeps)}</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px">incl. collections &amp; entries</div></div>
        <div style="padding:14px;background:rgba(232,93,93,.08);border:1px solid rgba(232,93,93,.2);border-radius:var(--radius-sm)"><div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">Withdrawals</div><div class="mono text-danger fw-600" style="font-size:1.1rem;margin-top:4px">${fmt(monthWds)}</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px">approved payouts</div></div>
        <div style="padding:14px;background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.2);border-radius:var(--radius-sm)"><div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">Expenses</div><div class="mono text-warning fw-600" style="font-size:1.1rem;margin-top:4px">${fmt(monthExp)}</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px">operating costs</div></div>
        <div style="padding:14px;background:${netFlow>=0?'rgba(46,204,138,.08)':'rgba(232,93,93,.08)'};border:1px solid ${netFlow>=0?'rgba(46,204,138,.2)':'rgba(232,93,93,.2)'};border-radius:var(--radius-sm)"><div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">Net Flow</div><div class="mono fw-600" style="font-size:1.1rem;margin-top:4px;color:${netFlow>=0?'var(--success)':'var(--danger)'}">${netFlow>=0?'+':''}${fmt(netFlow)}</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px">deposits − withdrawals − expenses</div></div>
      </div>
      ${(monthComm+monthFees)>0?`<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">${monthComm>0?`<div style="padding:8px 14px;background:var(--gold-dim);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.8rem"><span class="text-muted">Commissions deducted: </span><span class="mono text-gold">${fmt(monthComm)}</span></div>`:''}${monthFees>0?`<div style="padding:8px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.8rem"><span class="text-muted">Card fees collected: </span><span class="mono text-gold">${fmt(monthFees)}</span></div>`:''}</div>`:''}
    </div>`;
}

function renderPerformanceReport() {
  const el = document.getElementById('rpt-performance-content'); if (!el) return;
  const months = getLast12Months();
  const collData = months.map(m => ({ label: m.label, value: collsInMonth(m.key).reduce((s,c)=>s+c.amount,0) }));
  const depData  = months.map(m => txnsInMonth(m.key).filter(t=>['deposit','entry','transfer_in'].includes(t.type)).reduce((s,t)=>s+t.amount,0));
  const wdData   = months.map(m => txnsInMonth(m.key).filter(t=>['withdrawal','transfer_out'].includes(t.type)).reduce((s,t)=>s+t.amount,0));
  const labels   = months.map(m => m.label);
  const agentData = AGENTS.map((a,i) => ({ label:a.code, name:`${a.firstName} ${a.lastName}`, value:TELLER_STATE.collections.filter(c=>c.agentId===a.id).reduce((s,c)=>s+c.amount,0), color:`hsl(${(i*47)%360},65%,55%)` })).sort((a,b)=>b.value-a.value);
  const agentMax = Math.max(...agentData.map(a=>a.value),1);
  el.innerHTML = `
    <div class="chart-wrap"><div class="chart-title">📦 Monthly Collections Trend — Last 12 Months</div>${buildBarChart(collData,d=>`rgba(201,168,76,${0.4+(d.value/Math.max(...collData.map(x=>x.value),1))*0.6})`)}<div style="text-align:center;font-size:.72rem;color:var(--muted);margin-top:6px">Total: ${fmt(collData.reduce((s,d)=>s+d.value,0))} over 12 months</div></div>
    <div class="chart-wrap"><div class="chart-title">⚖️ Deposits vs Withdrawals — Last 12 Months</div><div style="display:flex;gap:14px;margin-bottom:10px;font-size:.76rem;flex-wrap:wrap"><div style="display:flex;align-items:center;gap:6px"><div class="legend-dot" style="background:rgba(46,204,138,.75)"></div>Deposits (${fmt(depData.reduce((s,v)=>s+v,0))})</div><div style="display:flex;align-items:center;gap:6px"><div class="legend-dot" style="background:rgba(232,93,93,.7)"></div>Withdrawals (${fmt(wdData.reduce((s,v)=>s+v,0))})</div></div>${buildStackedBar(depData,wdData,labels)}</div>
    <div class="chart-wrap"><div class="chart-title">🧑‍💼 All-Time Collections by Agent</div>${agentData.length?`<div class="bar-chart" style="height:180px">${agentData.map(a=>{const pct=Math.round((a.value/agentMax)*100);return`<div class="bar-col"><div class="bar-fill" style="height:${Math.max(pct,1)}%;background:${a.color}" data-val="${a.name}: ${fmt(a.value)}"></div><div class="bar-label" title="${a.name}">${a.label}</div></div>`;}).join('')}</div><div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">${agentData.map(a=>`<div style="display:flex;align-items:center;gap:6px;font-size:.74rem;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 10px"><div class="legend-dot" style="background:${a.color}"></div>${a.name} — ${fmt(a.value)}</div>`).join('')}</div>`:`<div class="empty-state" style="padding:30px 0"><div class="ei">📊</div><div class="et">No agent data yet</div></div>`}</div>`;
}

function renderFinancialReport() {
  const el = document.getElementById('rpt-financial-content'); if (!el) return;
  const monthOpts = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    const lbl = d.toLocaleDateString('en-GH',{month:'long',year:'numeric'});
    monthOpts.push(`<option value="${key}" ${i===0?'selected':''}>${lbl}</option>`);
  }
  el.innerHTML = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap"><label class="form-label" style="margin-bottom:0">Period:</label><select class="form-control" id="fin-month-sel" style="width:220px" onchange="renderFinancialDetail()">${monthOpts.join('')}</select><button class="btn btn-outline btn-sm no-print" onclick="window.print()">🖨️ Print</button></div><div id="fin-detail"></div>`;
  renderFinancialDetail();
}

function renderFinancialDetail() {
  const sel = document.getElementById('fin-month-sel');
  const month = sel ? sel.value : getThisMonth();
  const el = document.getElementById('fin-detail'); if (!el) return;
  const monthLbl = new Date(month+'-01').toLocaleDateString('en-GH',{month:'long',year:'numeric'});
  const txns = txnsInMonth(month);
  const deposits    = txns.filter(t=>['deposit','entry'].includes(t.type)).reduce((s,t)=>s+t.amount,0);
  const commissions = txns.filter(t=>t.type==='commission').reduce((s,t)=>s+t.amount,0);
  const cardFees    = txns.filter(t=>t.type==='fee').reduce((s,t)=>s+t.amount,0);
  const otherIncome = ACCOUNTING_ENTRIES.filter(e=>e.type==='income'&&(e.date||'').slice(0,7)===month).reduce((s,e)=>s+e.amount,0);
  const totalIncome = deposits+commissions+cardFees+otherIncome;
  const withdrawals = txns.filter(t=>t.type==='withdrawal').reduce((s,t)=>s+t.amount,0);
  const opExpenses  = ACCOUNTING_ENTRIES.filter(e=>e.type==='expense'&&(e.date||'').slice(0,7)===month).reduce((s,e)=>s+e.amount,0);
  const totalExpenses = withdrawals+opExpenses;
  const netCashFlow = totalIncome-totalExpenses;
  const margin = totalIncome>0?((netCashFlow/totalIncome)*100).toFixed(1):'0.0';
  const fmtRow = (label,value,color='') => `<div class="fin-row-sub"><span>${label}</span><span class="mono${color?' '+color:''}">${fmt(value)}</span></div>`;
  el.innerHTML = `
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:14px">Financial summary for <strong style="color:var(--gold)">${monthLbl}</strong></div>
    <div class="fin-section"><div class="fin-section-head" style="background:rgba(46,204,138,.1);border-bottom:1px solid var(--border)"><span>💚 Total Income</span><span class="mono text-success fw-600">${fmt(totalIncome)}</span></div>${fmtRow('Deposits & Collections',deposits,'text-success')}${fmtRow('Commissions Deducted',commissions,'text-success')}${fmtRow('Card Replacement Fees',cardFees,'text-success')}${fmtRow('Other Income (Accounting)',otherIncome,'text-success')}</div>
    <div class="fin-section"><div class="fin-section-head" style="background:rgba(232,93,93,.1);border-bottom:1px solid var(--border)"><span>🔴 Total Expenses</span><span class="mono text-danger fw-600">${fmt(totalExpenses)}</span></div>${fmtRow('Withdrawals Paid Out',withdrawals,'text-danger')}${fmtRow('Operating Expenses',opExpenses,'text-danger')}</div>
    <div class="fin-section"><div class="fin-section-head" style="background:${netCashFlow>=0?'rgba(46,204,138,.1)':'rgba(232,93,93,.1)'};border-bottom:1px solid var(--border)"><span>${netCashFlow>=0?'📈':'📉'} Net Profit / Loss</span><span class="mono fw-600" style="color:${netCashFlow>=0?'var(--success)':'var(--danger)'}">${netCashFlow>=0?'+':''}${fmt(netCashFlow)}</span></div>${fmtRow('Net Cash Flow',netCashFlow,netCashFlow>=0?'text-success':'text-danger')}${fmtRow('Profit Margin',parseFloat(margin),parseFloat(margin)>=0?'text-success':'text-danger')}</div>
    <div class="chart-wrap" style="margin-top:6px"><div class="chart-title">📊 Income vs Expenses</div><div style="display:flex;gap:12px;align-items:flex-end;height:100px">${[{label:'Income',value:totalIncome,color:'rgba(46,204,138,.75)'},{label:'Expenses',value:totalExpenses,color:'rgba(232,93,93,.7)'},{label:'Net',value:Math.abs(netCashFlow),color:netCashFlow>=0?'rgba(201,168,76,.8)':'rgba(232,93,93,.4)'}].map(bar=>{const max=Math.max(totalIncome,totalExpenses,1);const pct=Math.round((bar.value/max)*100);return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px"><div style="font-size:.68rem;color:var(--muted)">${fmt(bar.value)}</div><div style="width:100%;height:${Math.max(pct,2)}%;background:${bar.color};border-radius:4px 4px 0 0;min-height:3px"></div><div style="font-size:.7rem;color:var(--muted)">${bar.label}</div></div>`;}).join('')}</div></div>`;
}

function renderCustomersReport() {
  const el = document.getElementById('rpt-customers-content'); if (!el) return;
  const agentOptions = ['<option value="all">All Agents</option>',...AGENTS.map(a=>`<option value="${a.id}">${a.firstName} ${a.lastName} (${a.code})</option>`)].join('');
  el.innerHTML = `<div class="card" style="margin-bottom:16px;padding:14px 16px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="form-group" style="margin-bottom:0;min-width:160px"><label class="form-label">Status</label><select class="form-control" id="crf-status" onchange="applyCustomerFilter()"><option value="all">All Customers</option><option value="active">Active Only</option><option value="inactive">Inactive Only</option><option value="dormant">Dormant Only</option></select></div><div class="form-group" style="margin-bottom:0;min-width:200px"><label class="form-label">Agent</label><select class="form-control" id="crf-agent" onchange="applyCustomerFilter()">${agentOptions}</select></div><div class="form-group" style="margin-bottom:0;min-width:200px"><label class="form-label">Sort By</label><select class="form-control" id="crf-sort" onchange="applyCustomerFilter()"><option value="bal_desc">Balance (High to Low)</option><option value="bal_asc">Balance (Low to High)</option><option value="txn_desc">Most Transactions</option><option value="txn_asc">Least Transactions</option><option value="recent">Recently Registered</option></select></div><button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Print</button></div></div><div id="crf-summary" style="margin-bottom:14px"></div><div class="card"><div id="crf-table"></div></div>`;
  applyCustomerFilter();
}

function applyCustomerFilter() {
  const statusSel = document.getElementById('crf-status')?.value||'all';
  const agentSel  = document.getElementById('crf-agent')?.value||'all';
  const sortSel   = document.getElementById('crf-sort')?.value||'bal_desc';
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-90);
  let list = CUSTOMERS.filter(c => {
    if(statusSel==='active'&&c.status!=='active') return false;
    if(statusSel==='inactive'&&c.status!=='inactive') return false;
    if(statusSel==='dormant'){const l=(c.transactions||[]).slice(-1)[0];const ld=l?new Date(l.date):new Date(c.dateCreated||0);if(ld>=cutoff)return false;}
    if(agentSel!=='all'&&c.agentId!==agentSel) return false;
    return true;
  });
  if(sortSel==='bal_desc') list.sort((a,b)=>(b.balance||0)-(a.balance||0));
  else if(sortSel==='bal_asc') list.sort((a,b)=>(a.balance||0)-(b.balance||0));
  else if(sortSel==='txn_desc') list.sort((a,b)=>(b.transactions||[]).length-(a.transactions||[]).length);
  else if(sortSel==='txn_asc') list.sort((a,b)=>(a.transactions||[]).length-(b.transactions||[]).length);
  else if(sortSel==='recent') list.sort((a,b)=>new Date(b.dateCreated||0)-new Date(a.dateCreated||0));
  const totalBal=list.reduce((s,c)=>s+(c.balance||0),0);
  const avgBal=list.length?totalBal/list.length:0;
  const sumEl=document.getElementById('crf-summary');
  if(sumEl) sumEl.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px"><div class="metric-card"><div class="metric-sub text-muted">TOTAL CUSTOMERS</div><div class="metric-val" style="font-size:1.2rem">${list.length}</div></div><div class="metric-card"><div class="metric-sub text-muted">TOTAL BALANCE</div><div class="metric-val" style="font-size:1rem">${fmt(totalBal)}</div></div><div class="metric-card"><div class="metric-sub text-muted">AVERAGE BALANCE</div><div class="metric-val" style="font-size:1rem">${fmt(avgBal)}</div></div></div>`;
  const tbEl=document.getElementById('crf-table'); if(!tbEl) return;
  if(!list.length){tbEl.innerHTML=`<div class="empty-state" style="padding:30px 0"><div class="ei">👥</div><div class="et">No customers match this filter</div></div>`;return;}
  tbEl.innerHTML=`<div class="table-wrap" style="max-height:520px;overflow-y:auto"><table><thead><tr><th>Rank</th><th>Account No.</th><th>Name</th><th>Agent</th><th>Balance</th><th>Transactions</th><th>Status</th></tr></thead><tbody>${list.map((c,i)=>{const agent=AGENTS.find(a=>a.id===c.agentId);const txnCount=(c.transactions||[]).length;const sc=c.status==='active'?'b-green':c.status==='inactive'?'b-gray':'b-yellow';return`<tr><td class="text-muted" style="font-weight:600">${i+1}</td><td class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</td><td class="fw-600" style="font-size:.83rem">${c.firstName} ${c.lastName}</td><td style="font-size:.8rem">${agent?agent.firstName+' '+agent.lastName:'—'}</td><td class="mono text-gold">${fmt(c.balance||0)}</td><td class="text-center">${txnCount}</td><td><span class="badge ${sc}">${c.status}</span></td></tr>`;}).join('')}</tbody></table></div>`;
}

function renderLoanReport() {
  const el = document.getElementById('rpt-loans-content'); if (!el) return;
  const active=LOANS.filter(l=>l.status==='active');
  const completed=LOANS.filter(l=>l.status==='completed');
  const overdue=active.filter(l=>new Date(l.endDate)<new Date());
  const totalDisbursed=LOANS.reduce((s,l)=>s+l.amount,0);
  const totalOutstanding=active.reduce((s,l)=>s+(l.totalRepayment-l.payments.reduce((a,p)=>a+p.amount,0)),0);
  el.innerHTML=`<div class="metric-grid" style="margin-bottom:16px"><div class="metric-card"><div class="metric-sub text-muted">ACTIVE LOANS</div><div class="metric-val">${active.length}</div></div><div class="metric-card"><div class="metric-sub text-muted">COMPLETED</div><div class="metric-val">${completed.length}</div></div><div class="metric-card"><div class="metric-sub text-muted">TOTAL DISBURSED</div><div class="metric-val" style="font-size:1rem">${fmt(totalDisbursed)}</div></div><div class="metric-card"><div class="metric-sub text-muted">OUTSTANDING</div><div class="metric-val" style="font-size:1rem;color:var(--danger)">${fmt(totalOutstanding)}</div></div><div class="metric-card"><div class="metric-sub text-muted">OVERDUE</div><div class="metric-val" style="color:var(--danger)">${overdue.length}</div></div></div><div class="card"><div class="card-title"><span>📋</span> All Loans</div><div class="table-wrap"><table><thead><tr><th>Loan #</th><th>Customer</th><th>Agent</th><th>Amount</th><th>Paid</th><th>Balance</th><th>End Date</th><th>Status</th></tr></thead><tbody>${LOANS.length?LOANS.map(l=>{const paid=l.payments.reduce((s,p)=>s+p.amount,0);const bal=l.totalRepayment-paid;const od=l.status==='active'&&new Date(l.endDate)<new Date();return`<tr><td class="mono text-gold" style="font-size:.78rem">${l.loanNum}</td><td>${l.customerName}</td><td>${l.agentName}</td><td class="mono">${fmt(l.amount)}</td><td class="mono text-success">${fmt(paid)}</td><td class="mono text-danger">${fmt(bal)}</td><td style="font-size:.76rem">${fmtDate(l.endDate)}</td><td><span class="badge ${od?'b-red':l.status==='active'?'b-blue':'b-green'}">${od?'Overdue':l.status}</span></td></tr>`;}).join(''):`<tr><td colspan="8" class="text-center text-muted" style="padding:24px">No loans yet</td></tr>`}</tbody></table></div></div>`;
}

function renderAgentReport() {
  const el = document.getElementById('rpt-agents-content'); if (!el) return;
  el.innerHTML=`<div class="card"><div class="card-title"><span>🧑‍💼</span> Agent Performance Report</div><div class="table-wrap"><table><thead><tr><th>Agent</th><th>Code</th><th>Customers</th><th>Collections</th><th>Target</th><th>Achievement</th><th>Commission (${SETTINGS.commissionRate||1}%)</th></tr></thead><tbody>${AGENTS.map(a=>{const custs=CUSTOMERS.filter(c=>c.agentId===a.id).length;const coll=TELLER_STATE.collections.filter(c=>c.agentId===a.id).reduce((s,c)=>s+c.amount,0);const pct=a.monthlyTarget>0?Math.min(100,Math.round(coll/a.monthlyTarget*100)):0;const comm=coll*(SETTINGS.commissionRate||1)/100;const barColor=pct>=80?'var(--success)':pct>=50?'var(--warning)':'var(--danger)';return`<tr><td class="fw-600">${a.firstName} ${a.lastName}</td><td><span class="agent-code">${a.code}</span></td><td class="text-center">${custs}</td><td class="mono text-success">${fmt(coll)}</td><td class="mono text-gold">${fmt(a.monthlyTarget||0)}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="progress-wrap" style="min-width:70px;flex:1"><div class="progress-bar" style="width:${pct}%;background:${barColor}"></div></div><span style="font-size:.74rem;font-weight:600;color:${barColor}">${pct}%</span></div></td><td class="mono text-gold">${fmt(comm)}</td></tr>`;}).join('')}</tbody></table></div></div>`;
}

function renderReport(period) {
  showReportTab('overview', document.querySelector('#reports-subtabs .sub-tab'));
}


// ═══════════════════════════════════════════════════════
//  ENTRIES
// ═══════════════════════════════════════════════════════
function lookupEntryAcct(id, val) {
  const key = val.trim().toUpperCase();
  const r = ENTRY_STATE.rows.find(r => r.id === id); if (!r) return;
  r.acct = key;
  const cust = CUSTOMERS.find(c => c.acctNumber === key);
  r.name = cust ? `${cust.firstName} ${cust.lastName}` : '';
  const el = document.getElementById('er-name-' + id); if (el) el.value = r.name;
  if (cust) {
    const rows = document.querySelectorAll('#entry-rows tr');
    rows.forEach(row => {
      const acctInput = row.querySelector('input[type="text"]');
      if (acctInput && acctInput.value === key) {
        const amtInput = row.querySelector('input[type="number"]');
        if (amtInput) { amtInput.focus(); amtInput.select(); }
      }
    });
    const idx = ENTRY_STATE.rows.findIndex(x => x.id === id);
    if (idx === ENTRY_STATE.rows.length - 1) {
      ENTRY_STATE.rows.push({ id: uid(), acct: '', name: '', amount: '' });
      renderEntryRows();
    }
  }
  calcEntryBalance();
}

// ═══════════════════════════════════════════════════════
//  INIT
//  FIX 1 — call updateBrandNames() and applyLogo() on
//  startup so saved tagline/logo appear immediately
// ═══════════════════════════════════════════════════════
(function init() {
  loadAll();
  applyTheme(SETTINGS.theme || 'dark');
  const company = SETTINGS.companyName || 'Pro Susu Banking';
  document.title = `Dashboard — ${company}`;

  // Fade in the landing page on first load
  const lp = document.getElementById('landing-page');
  if (lp) {
    // Small delay so paint has settled before fade starts
    setTimeout(() => {
      lp.style.transition = 'opacity .55s ease';
      lp.style.opacity    = '1';
    }, 60);
  }

  // FIX 1 — apply saved tagline and brand names on every page load,
  // not just when the user opens Settings
  updateBrandNames();

  // FIX 2 — apply saved logo on page load
  if (SETTINGS.companyLogo) applyLogo(SETTINGS.companyLogo);

  if (SETTINGS.fontSize) document.documentElement.style.fontSize = SETTINGS.fontSize + 'px';
  if (SETTINGS.compact)  document.body.classList.add('compact');

  SETTINGS.loanDepositPct = SETTINGS.loanDepositPct ?? 30;
  SETTINGS.instantPenalty  = SETTINGS.instantPenalty  ?? 1;
  SETTINGS.monthlyPenalty  = SETTINGS.monthlyPenalty  ?? 1;

  // Set today's date defaults
  const today = todayISO();
  ['lni-start','ii-date','cti-date','acci-date'].forEach(id => {
    const el = document.getElementById(id); if (el && !el.value) el.value = today;
  });
  const targetPicker = document.getElementById('target-month-picker');
  if (targetPicker) targetPicker.value = today.slice(0,7);
  const commPicker = document.getElementById('comm-month-picker');
  if (commPicker) commPicker.value = today.slice(0,7);

  const cfd = document.getElementById('card-fee-display');
  if (cfd) cfd.textContent = fmt(SETTINGS.cardFee || 30);
  updateFormulaDisplay();

  // Bind activity listeners for inactivity timer (safe to call here —
  // currentUser is declared and init runs after all scripts load)
  _bindActivityEvents();

  // ── First-run detection ─────────────────────────────
  // If there is no stored data at all (fresh browser, new company),
  // show the setup wizard so the new company can set their name and
  // admin password before seeing the login screen.
  const hasStoredData = !!localStorage.getItem('psb_v2');
  if (!hasStoredData && CUSTOMERS.length === 0 && AGENTS.length === 0) {
    // Fresh install — show setup wizard immediately (no Firebase delay needed)
    setTimeout(() => showSetupWizard(), 400);
  }

  // ── Restore session on page refresh ────────────────
  // If the user was already logged in before the refresh,
  // skip the login screen and return them to the dashboard.
  const saved = sessionStorage.getItem('psb_session');
  if (saved) {
    try {
      const { userId } = JSON.parse(saved);
      const user = USERS.find(u => u.id === userId && u.status === 'active');
      if (user) {
        _activateSession(user, false);   // no login loader on refresh
        return;
      }
    } catch (e) { /* malformed session — fall through to login */ }
    sessionStorage.removeItem('psb_session');   // clear invalid session
  }
})();

 
// ═══════════════════════════════════════════════════════
//  LOADERS
// ═══════════════════════════════════════════════════════

// Login loader
let _loginLoaderTimer = null;

function showLoginLoader(steps, onComplete) {
  const overlay = document.getElementById('login-loader');
  if (!overlay) { onComplete(); return; }
  overlay.style.display = 'flex';

  const brandEl = document.getElementById('ll-brand');
  if (brandEl) brandEl.textContent = SETTINGS.companyName || 'Pro Susu Banking';

  if (SETTINGS.companyLogo) {
    const logoEl = document.getElementById('ll-logo');
    if (logoEl) logoEl.innerHTML =
      `<img src="${SETTINGS.companyLogo}" style="width:56px;height:56px;border-radius:14px;object-fit:cover">`;
  }

  let step = 0;
  const msgEl = document.getElementById('ll-message');
  const dots  = document.querySelectorAll('.ll-dot');

  function advance() {
    if (step < steps.length) {
      if (msgEl) {
        msgEl.style.opacity = '0';
        setTimeout(() => { msgEl.textContent = steps[step]; msgEl.style.opacity = '1'; }, 150);
      }
      dots.forEach((d, i) => d.classList.toggle('active', i <= step));
      step++;
      _loginLoaderTimer = setTimeout(advance, 900);
    } else {
      _loginLoaderTimer = setTimeout(() => { onComplete(); }, 300);
    }
  }
  advance();
}

function hideLoginLoader(onHidden) {
  if (_loginLoaderTimer) { clearTimeout(_loginLoaderTimer); _loginLoaderTimer = null; }
  const overlay = document.getElementById('login-loader');
  if (!overlay || overlay.style.display === 'none') {
    onHidden?.();
    return;
  }
  overlay.style.opacity    = '0';
  overlay.style.transition = 'opacity .35s ease';
  setTimeout(() => {
    overlay.style.display    = 'none';
    overlay.style.opacity    = '1';
    overlay.style.transition = '';
    onHidden?.();
  }, 350);
}

// Global action loader
let _glTimeout = null;

function showLoader(message, sub) {
  const overlay = document.getElementById('global-loader');
  const msgEl   = document.getElementById('gl-message');
  const subEl   = document.getElementById('gl-sub');
  if (msgEl) msgEl.textContent = message || 'Processing...';
  if (subEl) subEl.textContent = sub || '';
  if (overlay) overlay.style.display = 'flex';
  if (_glTimeout) clearTimeout(_glTimeout);
  _glTimeout = setTimeout(() => hideLoader(), 8000);
}

function hideLoader() {
  if (_glTimeout) { clearTimeout(_glTimeout); _glTimeout = null; }
  const overlay = document.getElementById('global-loader');
  if (overlay) overlay.style.display = 'none';
}

// Button loader helper
function btnLoader(btn, loadingText) {
  if (!btn) return () => {};
  const original   = btn.innerHTML;
  const origDisabled = btn.disabled;
  btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:7px">
    <span style="width:14px;height:14px;border:2px solid rgba(255,255,255,.3);
      border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;
      display:inline-block"></span>
    ${loadingText || 'Processing...'}
  </span>`;
  btn.disabled = true;
  return () => { btn.innerHTML = original; btn.disabled = origDisabled; };
}

function openProfileEdit() {
  if (!currentUser) return;
  document.getElementById('m-conf-title').textContent = '✏️ Edit My Profile';
  document.getElementById('m-conf-body').innerHTML = `
    <div class="form-group"><label class="form-label">Full Name</label><input type="text" class="form-control" id="prof-name" value="${currentUser.name||''}" placeholder="Your full name"></div>
    <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-control" id="prof-phone" value="${currentUser.phone||''}" placeholder="0XX XXX XXXX"></div>
    <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="prof-email" value="${currentUser.email||''}" placeholder="your@email.com"></div>
    <div class="form-group"><label class="form-label">Change Password <span class="text-muted" style="font-size:.7rem;text-transform:none;font-weight:400">(leave blank to keep current)</span></label><input type="password" class="form-control" id="prof-pass" placeholder="New password"></div>`;
  const okBtn = document.getElementById('m-conf-ok');
  okBtn.textContent = '✅ Save Profile';
  okBtn.className   = 'btn btn-gold';
  okBtn.onclick = () => {
    const name  = document.getElementById('prof-name')?.value.trim();
    const phone = document.getElementById('prof-phone')?.value.trim();
    const email = document.getElementById('prof-email')?.value.trim();
    const pass  = document.getElementById('prof-pass')?.value;
    if (!name) { toast('Name cannot be empty', 'error'); return; }
    const u = USERS.find(x => x.id === currentUser.id);
    if (u) { u.name=name; u.phone=phone; u.email=email; if(pass&&pass.length>=4) u.password=pass; }
    currentUser.name=name; currentUser.phone=phone; currentUser.email=email;
    const nameEl   = document.getElementById('sb-uname');
    const avatarEl = document.getElementById('sb-avatar');
    if (nameEl)   nameEl.textContent   = name;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
    saveAll();
    closeModal('modal-confirm');
    toast(`Profile updated — welcome, ${name}! ✅`, 'success');
  };
  openModal('modal-confirm');
}
