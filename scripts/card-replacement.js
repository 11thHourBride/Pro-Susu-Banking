// ═══════════════════════════════════════════════════════
//  CARD REPLACEMENT
// ═══════════════════════════════════════════════════════
function processCardReplacement() {
  const acct = document.getElementById('cri-acct').value.trim().toUpperCase();
  const reason = document.getElementById('cri-reason').value;
  const by = document.getElementById('cri-by').value.trim();
  const notes = document.getElementById('cri-notes').value.trim();
  if (!acct) return toast('Enter account number', 'error');
  if (!by) return toast('Enter staff name', 'error');
  const cust = CUSTOMERS.find(c => c.acctNumber === acct);
  if (!cust) return toast('Account not found', 'error');
  const fee = SETTINGS.cardFee || 30;
  if ((cust.balance || 0) < fee) return toast(`Insufficient balance. Fee is ${fmt(fee)}`, 'error');
  cust.balance = (cust.balance || 0) - fee;
  if (!cust.transactions) cust.transactions = [];
  cust.transactions.push({ id: uid(), type: 'fee', desc: `Card replacement fee (${reason})`, amount: fee, balance: cust.balance, date: todayISO(), by });
  const rec = { id: uid(), acct, customerName: `${cust.firstName} ${cust.lastName}`, reason, fee, by, notes, date: todayISO() };
  CARD_REPLACEMENTS.push(rec);
  ['cri-acct','cri-name','cri-by','cri-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('cri-fb').innerHTML = ''; document.getElementById('cri-balance-display').innerHTML = '';
  renderCardHistory(); logActivity('Card Replacement', `${cust.firstName} ${cust.lastName} (${acct})`, fee, 'processed');
  saveAll(); toast(`Card replacement processed. ${fmt(fee)} deducted from ${acct}`, 'success');
}

function renderCardHistory() {
  const tb = document.getElementById('card-replace-tbody'); if (!tb) return;
  if (!CARD_REPLACEMENTS.length) { tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:24px">No replacements</td></tr>'; return; }
  const reasonLabels = { lost: 'Card Lost', damaged: 'Card Damaged', expired: 'Card Expired', other: 'Other' };
  tb.innerHTML = [...CARD_REPLACEMENTS].reverse().map(r => `<tr>
    <td style="font-size:.76rem">${fmtDate(r.date)}</td>
    <td class="mono text-gold" style="font-size:.78rem">${r.acct}</td>
    <td>${r.customerName}</td>
    <td><span class="badge b-yellow">${reasonLabels[r.reason] || r.reason}</span></td>
    <td class="mono text-danger">${fmt(r.fee)}</td>
    <td style="font-size:.78rem;color:var(--muted)">${r.by}</td>
  </tr>`).join('');
}