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
  const apiKey  = (SETTINGS.smsApiKey   || '').trim();
  const sender  = (SETTINGS.smsSenderId || 'PROSUSU').trim();

  if (!apiKey) {
    toast('SMS API key not set. Go to Settings → Financial → SMS to add your Arkesel API key.', 'warning', 6000);
    callback?.(false, 'No API key configured');
    return;
  }

  // Normalise phone to international format (Ghana: 0XX → 233XX)
  let recipient = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (recipient.startsWith('0'))    recipient = '233' + recipient.slice(1);
  if (recipient.startsWith('+'))    recipient = recipient.slice(1);
  if (!recipient.startsWith('233')) recipient = '233' + recipient;

  fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key'     : apiKey,
    },
    body: JSON.stringify({
      sender    : sender,
      message   : message,
      recipients: [recipient],
    }),
  })
    .then(r => r.json())
    .then(res => {
      // Arkesel returns { status: 'success', ... } on success
      if (res.status === 'success') {
        callback?.(true, null);
      } else {
        const detail = res.message || res.reason || JSON.stringify(res);
        callback?.(false, detail);
      }
    })
    .catch(err => {
      callback?.(false, err.message || 'Network error — check internet connection');
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
  const message = `${co}: Test SMS OK. Your SMS integration is working correctly.`;

  const restore = btnLoader(btn, 'Sending...');

  _dispatchSMS(testPhone, message, (ok, detail) => {
    restore();
    if (ok) {
      toast(`Test SMS sent to ${testPhone} ✅`, 'success');
      logActivity('SMS', `Test SMS sent to ${testPhone}`, 0, 'sent');
    } else {
      toast(`Test SMS failed — ${detail || 'Check your API key in Settings → Financial'}`, 'error', 6000);
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
//  NOTE: Provider implementations (Arkesel, mNotify,
//  Hubtel) now live in sms-proxy.js on the server.
//  The API key is never sent to the browser.
// ═══════════════════════════════════════════════════════
