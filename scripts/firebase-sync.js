// ═══════════════════════════════════════════════════════
//  FIREBASE SYNC — Pro Susu Banking
//  Stores all data in Firestore (cloud) while keeping
//  localStorage as the offline/fast-load cache.
//  Real-time listener syncs changes across all devices.
// ═══════════════════════════════════════════════════════

import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAnalytics }                            from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js';
import {
  getFirestore, doc, setDoc, getDoc,
  onSnapshot, serverTimestamp
}                                                  from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// ── Config ────────────────────────────────────────────
const firebaseConfig = {
  apiKey            : 'AIzaSyAJd3qLYZJ8QsFjV6W45IS9c5n2Fkpeamk',
  authDomain        : 'pro-susu-banking.firebaseapp.com',
  projectId         : 'pro-susu-banking',
  storageBucket     : 'pro-susu-banking.firebasestorage.app',
  messagingSenderId : '211347067268',
  appId             : '1:211347067268:web:66c41e9e7907a45f750dd1',
  measurementId     : 'G-E3Q0BMEW1E',
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getFirestore(app);

// ── Firestore document paths ──────────────────────────
// All data lives under: /psb/main — split into 3 chunks
// to stay under Firestore's 1 MB document limit.
const MAIN_DOC   = () => doc(db, 'psb', 'main');    // core + settings
const CUST_DOC   = () => doc(db, 'psb', 'customers');// customers + deleted
const SHEETS_DOC = () => doc(db, 'psb', 'sheets');  // sheets + teller + entries

// ── Sync state ────────────────────────────────────────
let _syncEnabled      = false;
let _lastRemoteUpdate = 0;
let _unsubscribe      = null;
let _saveTimer        = null;

// ── UI indicator ──────────────────────────────────────
function _setSyncStatus(state) {
  // state: 'synced' | 'syncing' | 'offline' | 'error'
  const el = document.getElementById('firebase-status');
  if (!el) return;
  const map = {
    synced  : { icon: '☁️',  label: 'Synced',   color: 'var(--success)' },
    syncing : { icon: '🔄',  label: 'Syncing…', color: 'var(--gold)'    },
    offline : { icon: '📴',  label: 'Offline',  color: 'var(--muted)'   },
    error   : { icon: '⚠️',  label: 'Sync err', color: 'var(--danger)'  },
  };
  const s = map[state] || map.offline;
  el.innerHTML = `<span style="color:${s.color};font-size:.72rem;font-weight:600">
    ${s.icon} ${s.label}
  </span>`;
}

// ── Build payload chunks ───────────────────────────────
function _buildPayload() {
  // Access globals declared in general.js
  return {
    main: {
      SETTINGS, AGENTS, LOANS, INVESTMENTS, TRANSFERS,
      CARD_REPLACEMENTS, COLLAB_PARTNERS, COLLAB_TRANSACTIONS,
      ACCOUNTING_ENTRIES, USERS, PAYROLL, ALLOWANCES_RECORDS,
      VACATED_ACCOUNTS, AGENT_SUBMISSIONS, ACTIVITY_LOG,
      _savedAt: Date.now(),
    },
    customers: {
      CUSTOMERS,
      DELETED_CUSTOMERS,
      _savedAt: Date.now(),
    },
    sheets: {
      COLLECTION_SHEETS,
      TELLER_STATE,
      _savedAt: Date.now(),
    },
  };
}

// ── Save to Firestore (debounced 1.5 s) ───────────────
function fsSave() {
  if (!_syncEnabled) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_doSave, 1500);
}

async function _doSave() {
  _setSyncStatus('syncing');
  try {
    const p = _buildPayload();
    await Promise.all([
      setDoc(MAIN_DOC(),   p.main,      { merge: true }),
      setDoc(CUST_DOC(),   p.customers, { merge: true }),
      setDoc(SHEETS_DOC(), p.sheets,    { merge: true }),
    ]);
    _setSyncStatus('synced');
  } catch (err) {
    console.error('[Firebase] Save error:', err);
    _setSyncStatus('error');
  }
}

// ── Load from Firestore once ───────────────────────────
async function fsLoad() {
  _setSyncStatus('syncing');
  try {
    const [mainSnap, custSnap, sheetsSnap] = await Promise.all([
      getDoc(MAIN_DOC()),
      getDoc(CUST_DOC()),
      getDoc(SHEETS_DOC()),
    ]);

    if (mainSnap.exists())   _applyMain(mainSnap.data());
    if (custSnap.exists())   _applyCustomers(custSnap.data());
    if (sheetsSnap.exists()) _applySheets(sheetsSnap.data());

    _setSyncStatus('synced');
    return true;
  } catch (err) {
    console.warn('[Firebase] Load failed — using localStorage:', err.message);
    _setSyncStatus('offline');
    return false;
  }
}

// ── Apply data from Firestore to global vars ──────────
function _applyMain(d) {
  if (d.SETTINGS)           SETTINGS           = Object.assign(SETTINGS, d.SETTINGS);
  if (d.AGENTS)             AGENTS             = d.AGENTS;
  if (d.LOANS)              LOANS              = d.LOANS;
  if (d.INVESTMENTS)        INVESTMENTS        = d.INVESTMENTS;
  if (d.TRANSFERS)          TRANSFERS          = d.TRANSFERS;
  if (d.CARD_REPLACEMENTS)  CARD_REPLACEMENTS  = d.CARD_REPLACEMENTS;
  if (d.COLLAB_PARTNERS)    COLLAB_PARTNERS    = d.COLLAB_PARTNERS;
  if (d.COLLAB_TRANSACTIONS)COLLAB_TRANSACTIONS= d.COLLAB_TRANSACTIONS;
  if (d.ACCOUNTING_ENTRIES) ACCOUNTING_ENTRIES = d.ACCOUNTING_ENTRIES;
  if (d.USERS && d.USERS.length) USERS         = d.USERS;
  if (d.PAYROLL)            PAYROLL            = d.PAYROLL;
  if (d.ALLOWANCES_RECORDS) ALLOWANCES_RECORDS = d.ALLOWANCES_RECORDS;
  if (d.VACATED_ACCOUNTS)   VACATED_ACCOUNTS   = d.VACATED_ACCOUNTS;
  if (d.AGENT_SUBMISSIONS)  AGENT_SUBMISSIONS  = d.AGENT_SUBMISSIONS;
  if (d.ACTIVITY_LOG)       ACTIVITY_LOG       = d.ACTIVITY_LOG;
}
function _applyCustomers(d) {
  if (d.CUSTOMERS)         CUSTOMERS        = d.CUSTOMERS;
  if (d.DELETED_CUSTOMERS) DELETED_CUSTOMERS= d.DELETED_CUSTOMERS;
}
function _applySheets(d) {
  if (d.COLLECTION_SHEETS) COLLECTION_SHEETS = d.COLLECTION_SHEETS;
  if (d.TELLER_STATE)      TELLER_STATE      = Object.assign(TELLER_STATE, d.TELLER_STATE);
}

// ── Real-time listener (updates all open tabs/devices) ─
function _startListener() {
  if (_unsubscribe) _unsubscribe();   // detach old listener

  // Listen on the customers doc (most frequently changed)
  _unsubscribe = onSnapshot(CUST_DOC(), snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    // Ignore if this is from our own recent save (avoid echo)
    if (d._savedAt && Date.now() - d._savedAt < 3000) return;
    _applyCustomers(d);
    // Refresh any visible customer UI
    if (typeof renderCustomerList === 'function') renderCustomerList('');
    if (typeof updateDashboard    === 'function') updateDashboard();
    _setSyncStatus('synced');
  }, err => {
    console.warn('[Firebase] Listener error:', err.message);
    _setSyncStatus('offline');
  });
}

// ── Patch saveAll and loadAll in general.js ────────────
// Called once after general.js has loaded.
function _patchGeneralJS() {
  // Patch saveAll — also triggers Firestore save
  const _origSave = window.saveAll;
  window.saveAll = function() {
    if (typeof _origSave === 'function') _origSave();
    fsSave();
  };

  // loadAll is already called by init() before Firebase is ready;
  // we handle initial cloud load separately via fsLoad().
}

// ── Bootstrap ─────────────────────────────────────────
async function bootstrap() {
  _syncEnabled = true;

  // Show indicator element
  const statusDiv = document.createElement('div');
  statusDiv.id    = 'firebase-status';
  statusDiv.style.cssText =
    'position:fixed;bottom:12px;right:14px;z-index:9999;' +
    'background:var(--surface2,#0d1b2e);border:1px solid var(--border,#1e3050);' +
    'border-radius:20px;padding:4px 12px;font-size:.7rem;cursor:default;' +
    'box-shadow:0 2px 12px rgba(0,0,0,.3)';
  statusDiv.title = 'Firebase Firestore sync status';
  document.body.appendChild(statusDiv);
  _setSyncStatus('syncing');

  // Load from Firestore first (overrides localStorage if cloud data is newer)
  const loaded = await fsLoad();
  if (loaded) {
    // Also persist to localStorage so app works offline next time
    if (typeof saveAll === 'function') {
      const orig = window.saveAll;
      window.saveAll = function() {
        try {
          localStorage.setItem('psb_v2', JSON.stringify({
            SETTINGS, AGENTS, CUSTOMERS, LOANS, INVESTMENTS, TRANSFERS,
            CARD_REPLACEMENTS, COLLAB_PARTNERS, COLLAB_TRANSACTIONS,
            COLLECTION_SHEETS, ACCOUNTING_ENTRIES, USERS, TELLER_STATE,
            PAYROLL, ALLOWANCES_RECORDS, DELETED_CUSTOMERS, VACATED_ACCOUNTS,
            AGENT_SUBMISSIONS, ACTIVITY_LOG
          }));
        } catch(e) {}
        fsSave();
      };
    }
  }

  _patchGeneralJS();
  _startListener();

  // Re-render the current view after cloud load
  if (typeof updateDashboard    === 'function') updateDashboard();
  if (typeof renderCustomerList === 'function') renderCustomerList('');
}

// Start as soon as DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Export for debugging
window._firebase = { app, db, fsSave, fsLoad };