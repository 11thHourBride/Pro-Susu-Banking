// ═══════════════════════════════════════════════════════
//  SMS INTEGRATION
// ═══════════════════════════════════════════════════════
 
// ── SMS amount formatter ──────────────────────────────
// Uses plain "GHS" prefix so the cedi symbol (GH₵) doesn't
// appear in SMS — carriers may mangle the ₵ character.
function fmtSMS(n) {
  return 'GHS ' + (+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
 
// ── Message Templates ────────────────────────────────
function buildSMSMessage(customer, eventType, data = {}) {
  const co   = SETTINGS.companyName || 'Pro Susu Banking';
  const type = customer.type === 'lending' ? 'Lending Deposit'
             : customer.type === 'savings' ? 'Savings'
             : 'Susu';
 
  switch (eventType) {
 
    case 'registration':
      return `${co}: Dear ${customer.firstName} ${customer.lastName}, your ${type} account is open. `
           + `Acct: ${customer.acctNumber}. Thank you for trusting us.`;
 
    case 'deposit':
      return `${co}: Dear ${customer.firstName} ${customer.lastName}, your deposit of ${fmtSMS(data.amount)} on ${fmtDate(data.date || todayISO())} has been credited to your ${type} acct `
           + `${customer.acctNumber}. Bal: ${fmtSMS(data.balance)}. `
           ;
 
    case 'withdrawal':
      return `Dear ${customer.firstName} ${customer.lastName}, you have successfully withdrawn ${fmtSMS(data.amount)} from your ${type} `
           + `${customer.acctNumber}  acct by ${data.receiver || 'Owner'} on ${fmtDate(data.date || todayISO())}. Bal: ${fmtSMS(data.balance)}. `
           ;
 
    case 'holiday':
      return `${co}: Dear ${customer.firstName} ${customer.lastName}, wishing you and your family `
           + `a happy ${data.holidayName || 'holiday'}. Thank you for banking with us.`;
 
    default:
      return '';
  }
}
 
// ── Main sendSMS dispatcher ──────────────────────────
function sendSMS(customer, eventType, data = {}) {
  if (!SETTINGS.smsEnabled) return;
  if (!customer?.phone)     return;
 
  const message = buildSMSMessage(customer, eventType, data);
  if (!message) return;
 
  logActivity('SMS',
    `${eventType} SMS → ${customer.phone} (${customer.acctNumber})`,
    0, 'sent'
  );
  _dispatchSMS(customer.phone, message);
}
 
function _dispatchSMS(phone, message, callback) {
  // All requests go to the local proxy server (sms-proxy.js).
  // The proxy holds the real API key — it never reaches the browser.
  fetch('http://127.0.0.1:3300/send-sms', {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify({ phone, message })
  })
    .then(r => r.json())
    .then(res => {
      if (res.ok) callback?.(true, null);
      else        callback?.(false, res.error || 'Proxy returned failure');
    })
    .catch(err => {
      // Proxy not running — give a clear message
      const msg = err.message.includes('fetch')
        ? 'SMS proxy not running. Start it with: node sms-proxy.js'
        : err.message;
      callback?.(false, msg);
    });
}
 
// ── Test SMS ─────────────────────────────────────────
function testSMS(btnEl) {
  const btn = btnEl || (typeof event !== 'undefined' ? event?.target : null);
 
  if (!SETTINGS.smsEnabled)
    return toast('Enable SMS notifications first.', 'warning');
 
  const testPhone = (currentUser?.phone || SETTINGS.companyPhone || '').replace(/\s/g, '');
  if (!testPhone)
    return toast('Add a phone number to your profile or company settings first.', 'warning');
 
  const co      = SETTINGS.companyName || 'Pro Susu Banking';
  const message = `${co}: Test SMS OK. Your SMS integration is working correctly ✅`;
 
  const restore = btnLoader(btn, 'Sending...');
 
  _dispatchSMS(testPhone, message, (ok, detail) => {
    restore();
    if (ok) {
      toast(`Test SMS sent to ${testPhone} ✅`, 'success');
      logActivity('SMS', `Test SMS sent to ${testPhone}`, 0, 'sent');
    } else {
      toast(`Test SMS failed — ${detail || 'Check sms-proxy.js is running'}`, 'error');
      console.error('SMS test failure:', detail);
    }
  });
}
 
// ── Holiday broadcast ────────────────────────────────
function sendHolidaySMS(holidayName) {
  if (!holidayName) return toast('Enter a holiday name first.', 'warning');
  if (!SETTINGS.smsEnabled) return toast('SMS notifications are disabled.', 'warning');
 
  const targets = CUSTOMERS.filter(c => c.status === 'active' && c.phone);
  if (!targets.length)
    return toast('No active customers with phone numbers.', 'warning');
 
  showConfirm(
    'Send Holiday SMS?',
    `Send a <strong>${holidayName}</strong> greeting to <strong>${targets.length}</strong> customer(s)?`,
    () => {
      targets.forEach(c => sendSMS(c, 'holiday', { holidayName }));
      toast(`Holiday SMS sent to ${targets.length} customer(s) ✅`, 'success');
      logActivity('SMS', `Holiday broadcast "${holidayName}" → ${targets.length} customers`, 0, 'sent');
      saveAll();
    }
  );
}
 
// ── Render message previews in Settings ──────────────
function renderSMSPreviews() {
  const dummy = {
    firstName  : 'Kofi',
    lastName   : 'Mensah',
    acctNumber : 'TN01-0042',
    phone      : '0241234567',
    type       : 'susu'
  };
 
  const set = (id, msg) => {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || '—';
  };
 
  set('sms-prev-reg', buildSMSMessage(dummy, 'registration'));
  set('sms-prev-dep', buildSMSMessage(dummy, 'deposit',    { amount: 50, balance: 420, date: todayISO() }));
  set('sms-prev-wd',  buildSMSMessage(dummy, 'withdrawal', { amount: 100, balance: 320, receiver: 'Ama Mensah' }));
  set('sms-prev-hol', buildSMSMessage(dummy, 'holiday',    { holidayName: 'Christmas' }));
}
 
// Auto-render previews whenever the financial settings tab opens
// (hooked via showSettingsTab in general.js — we just expose the function)
// Also run once on load so they're ready when user opens the tab
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderSMSPreviews, 800);
});
// ═══════════════════════════════════════════════════════
//  PROVIDER IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════

function _cleanPhone(phone) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('233')) return d;
  if (d.startsWith('0'))   return '233' + d.slice(1);
  return '233' + d;
}

// ── Arkesel v2 ───────────────────────────────────────
function _sendViaArkesel(phone, message, callback) {
  const apiKey   = (SETTINGS.smsApiKey   || '').trim();
  const senderId = (SETTINGS.smsSenderId || 'PROSUSU').trim();
  if (!apiKey) { callback?.(false, 'API key is empty'); return; }

  fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method  : 'POST',
    headers : { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body    : JSON.stringify({
      sender     : senderId,
      message    : message,
      recipients : [_cleanPhone(phone)]
    })
  })
    .then(r => r.json())
    .then(res => {
      console.log('Arkesel:', res);
      if (res.status === 'success') callback?.(true, null);
      else callback?.(false, res.message || res.data?.message || JSON.stringify(res));
    })
    .catch(err => { callback?.(false, err.message || 'Network error'); });
}

// ── mNotify ──────────────────────────────────────────
function _sendViaMnotify(phone, message, callback) {
  const apiKey   = (SETTINGS.smsApiKey   || '').trim();
  const senderId = (SETTINGS.smsSenderId || 'PROSUSU').trim();
  if (!apiKey) { callback?.(false, 'API key is empty'); return; }

  fetch(
    `https://apps.mnotify.net/smsapi?key=${encodeURIComponent(apiKey)}` +
    `&to=${_cleanPhone(phone)}` +
    `&msg=${encodeURIComponent(message)}` +
    `&sender_id=${encodeURIComponent(senderId)}`
  )
    .then(r => r.text())
    .then(res => {
      console.log('mNotify:', res);
      const code = res.trim();
      if (code === '1000' || code.startsWith('1000')) callback?.(true, null);
      else callback?.(false, `mNotify code: ${code}`);
    })
    .catch(err => {
      callback?.(false, 'Network / CORS error. Use Arkesel or Hubtel instead.');
    });
}

// ── Hubtel ───────────────────────────────────────────
function _sendViaHubtel(phone, message, callback) {
  const clientId  = (SETTINGS.smsClientId     || '').trim();
  const clientSec = (SETTINGS.smsClientSecret || '').trim();
  const senderId  = (SETTINGS.smsSenderId     || 'PROSUSU').trim();
  if (!clientId || !clientSec) {
    callback?.(false, 'Hubtel Client ID / Secret not set');
    return;
  }

  fetch('https://smsc.hubtel.com/v1/messages/send', {
    method  : 'POST',
    headers : {
      'Authorization' : 'Basic ' + btoa(`${clientId}:${clientSec}`),
      'Content-Type'  : 'application/json'
    },
    body: JSON.stringify({
      From               : senderId,
      To                 : _cleanPhone(phone),
      Content            : message,
      RegisteredDelivery : true
    })
  })
    .then(r => r.json())
    .then(res => {
      console.log('Hubtel:', res);
      if (res.Status === 0 || res.status === 'success') callback?.(true, null);
      else callback?.(false, res.Message || res.message || JSON.stringify(res));
    })
    .catch(err => { callback?.(false, err.message || 'Network error'); });
}