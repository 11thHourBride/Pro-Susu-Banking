
// ═══════════════════════════════════════════════════════
//  COLLABORATIONS
// ═══════════════════════════════════════════════════════
function addPartner() {
  const name = document.getElementById('pi-name').value.trim();
  const code = document.getElementById('pi-code').value.trim().toUpperCase();
  const contact = document.getElementById('pi-contact').value.trim();
  const phone = document.getElementById('pi-phone').value.trim();
  const email = document.getElementById('pi-email').value.trim();
  const cat = document.getElementById('pi-cat').value;
  const address = document.getElementById('pi-address').value.trim();
  const notes = document.getElementById('pi-notes').value.trim();
  if (!name) return toast('Enter organisation name', 'error');
  if (!code) return toast('Enter partner code', 'error');
  if (COLLAB_PARTNERS.find(p => p.code === code)) return toast('Partner code already exists', 'error');
  const partner = { id: uid(), name, code, contact, phone, email, category: cat, address, notes, dateAdded: todayISO(), status: 'active' };
  COLLAB_PARTNERS.push(partner);
  ['pi-name','pi-code','pi-contact','pi-phone','pi-email','pi-address','pi-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderCollabOverview(); renderPartnerList(); populatePartnerSelector();
  logActivity('Collaboration', `Partner added: ${name}`, 0, 'active'); saveAll();
  toast(`Partner "${name}" added`, 'success');
  // Show QR
  setTimeout(() => showPartnerQR(partner.id), 300);
}

function showPartnerQR(id) {
  const p = COLLAB_PARTNERS.find(x => x.id === id); if (!p) return;
  document.getElementById('m-qr-title').textContent = `QR Code — ${p.name}`;
  const qrData = JSON.stringify({ code: p.code, name: p.name, category: p.category, phone: p.phone });
  document.getElementById('m-qr-body').innerHTML = `
    <div class="qr-card">
      <div class="qr-partner-name">${p.name}</div>
      <div class="text-muted" style="font-size:.76rem;margin-bottom:8px">${p.code} · ${p.category}</div>
      <div class="qr-wrap" id="qr-display"></div>
      <div style="font-size:.74rem;color:var(--muted);margin-top:10px">${p.phone || ''} ${p.email ? '· ' + p.email : ''}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:4px">${SETTINGS.companyName}</div>
    </div>`;
  setTimeout(() => {
    const el = document.getElementById('qr-display');
    if (el && window.QRCode) { el.innerHTML = ''; new QRCode(el, { text: qrData, width: 160, height: 160 }); }
  }, 100);
  openModal('modal-partner-qr');
}

function printQR() { window.print(); }

function renderCollabOverview() {
  const totalIn = COLLAB_TRANSACTIONS.filter(t => t.type === 'inflow').reduce((s, t) => s + t.amount, 0);
  const totalOut = COLLAB_TRANSACTIONS.filter(t => t.type === 'outflow').reduce((s, t) => s + t.amount, 0);
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('col-partners', COLLAB_PARTNERS.length); setTxt('col-inflows', fmt(totalIn));
  setTxt('col-outflows', fmt(totalOut)); setTxt('col-net', fmt(totalIn - totalOut));
  const el = document.getElementById('collab-partner-cards'); if (!el) return;
  if (!COLLAB_PARTNERS.length) { el.innerHTML = '<div class="empty-state"><div class="ei">🤝</div><div class="et">No partners yet</div></div>'; return; }
  el.innerHTML = COLLAB_PARTNERS.map(p => {
    const txns = COLLAB_TRANSACTIONS.filter(t => t.partnerId === p.id);
    const inflow = txns.filter(t => t.type === 'inflow').reduce((s, t) => s + t.amount, 0);
    const outflow = txns.filter(t => t.type === 'outflow').reduce((s, t) => s + t.amount, 0);
    const catColors = { bank: 'b-blue', insurance: 'b-gold', microfinance: 'b-green', ngo: 'b-purple', government: 'b-gray', other: 'b-gray' };
    return `<div class="card" style="cursor:pointer" onclick="showPartnerQR('${p.id}')">
      <div class="flex-between mb-2"><div class="fw-600">${p.name}</div><span class="badge ${catColors[p.category]||'b-gray'}">${p.category}</span></div>
      <div class="text-muted" style="font-size:.75rem;margin-bottom:10px">${p.code} · ${p.contact || '—'}</div>
      <div class="flex-between" style="font-size:.8rem">
        <span class="text-success">↓ In: ${fmt(inflow)}</span>
        <span class="text-danger">↑ Out: ${fmt(outflow)}</span>
        <span class="text-gold">Net: ${fmt(inflow - outflow)}</span>
      </div>
    </div>`;
  }).join('');
}

function renderPartnerList() {
  const el = document.getElementById('partners-grid'); if (!el) return;
  if (!COLLAB_PARTNERS.length) { el.innerHTML = '<div class="empty-state"><div class="ei">🤝</div><div class="et">No partners</div></div>'; return; }
  el.innerHTML = COLLAB_PARTNERS.map(p => `<div class="card">
    <div class="flex-between mb-3">
      <div class="fw-600" style="font-size:.95rem">${p.name}</div>
      <span class="badge b-blue">${p.code}</span>
    </div>
    <div style="font-size:.8rem;display:flex;flex-direction:column;gap:5px;color:var(--text2)">
      <div>📞 ${p.phone || '—'}</div>
      <div>✉️ ${p.email || '—'}</div>
      <div>👤 ${p.contact || '—'}</div>
      <div>📍 ${p.address || '—'}</div>
    </div>
    <div style="margin-top:12px;display:flex;gap:6px">
      <button class="btn btn-gold btn-xs" onclick="showPartnerQR('${p.id}')">🔲 QR Code</button>
      <button class="btn btn-danger btn-xs" onclick="deletePartner('${p.id}')">🗑️</button>
    </div>
  </div>`).join('');
}

function deletePartner(id) {
  showConfirm('Delete Partner?', 'This will remove the partner and all associated QR data.', () => {
    COLLAB_PARTNERS = COLLAB_PARTNERS.filter(p => p.id !== id);
    renderCollabOverview(); renderPartnerList(); populatePartnerSelector(); saveAll(); toast('Partner deleted', 'warning');
  });
}

function populatePartnerSelector() {
  const el = document.getElementById('cti-partner'); if (!el) return;
  el.innerHTML = '<option value="">-- Select Partner --</option>' + COLLAB_PARTNERS.map(p => `<option value="${p.id}">${p.name} (${p.code})</option>`).join('');
}

function addCollabTransaction() {
  const partnerId = document.getElementById('cti-partner').value;
  const type = document.getElementById('cti-type').value;
  const amount = parseFloat(document.getElementById('cti-amount').value);
  const date = document.getElementById('cti-date').value;
  const desc = document.getElementById('cti-desc').value.trim();
  const ref = document.getElementById('cti-ref').value.trim();
  if (!partnerId) return toast('Select a partner', 'error');
  if (!amount || amount <= 0) return toast('Enter valid amount', 'error');
  if (!date) return toast('Select date', 'error');
  const partner = COLLAB_PARTNERS.find(p => p.id === partnerId);
  const txn = { id: uid(), partnerId, partnerName: partner?.name || '—', type, amount, date, desc, ref, by: currentUser?.name || 'System' };
  COLLAB_TRANSACTIONS.push(txn);
  ['cti-amount','cti-date','cti-desc','cti-ref'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderCollabTransactions(); renderCollabOverview();
  saveAll(); toast(`Transaction recorded — ${fmt(amount)}`, 'success');
}

function renderCollabTransactions() {
  const tb = document.getElementById('collab-txn-tbody'); if (!tb) return;
  if (!COLLAB_TRANSACTIONS.length) { tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:20px">No transactions</td></tr>'; return; }
  tb.innerHTML = [...COLLAB_TRANSACTIONS].reverse().map(t => `<tr>
    <td style="font-size:.76rem">${fmtDate(t.date)}</td>
    <td class="fw-600">${t.partnerName}</td>
    <td><span class="badge ${t.type==='inflow'?'b-green':'b-red'}">${t.type}</span></td>
    <td class="mono ${t.type==='inflow'?'text-success':'text-danger'}">${fmt(t.amount)}</td>
    <td style="font-size:.8rem">${t.desc || '—'}</td>
  </tr>`).join('');
}