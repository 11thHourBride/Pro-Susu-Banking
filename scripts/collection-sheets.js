// ═══════════════════════════════════════════════════════
//  COLLECTION SHEETS
// ═══════════════════════════════════════════════════════
function openNewSheet() {
  const agentOptions = AGENTS.map(a => `<option value="${a.id}">${a.firstName} ${a.lastName} (${a.code})</option>`).join('');
  document.getElementById('m-conf-title').textContent = '➕ New Collection Sheet';
  document.getElementById('m-conf-body').innerHTML = `
    <div class="form-group"><label class="form-label">Select Agent</label><select class="form-control" id="ns-agent"><option value="">-- Select Agent --</option>${agentOptions}</select></div>
    <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-control" id="ns-date" value="${todayISO()}"></div>`;
  const okBtn = document.getElementById('m-conf-ok');
  okBtn.textContent = '✅ Create Sheet'; okBtn.className = 'btn btn-gold';
  okBtn.onclick = () => { createNewSheet(); closeModal('modal-confirm'); };
  openModal('modal-confirm');
}

function createNewSheet() {
  const agentId = document.getElementById('ns-agent')?.value;
  const date = document.getElementById('ns-date')?.value;
  if (!agentId) return toast('Select an agent', 'error');
  if (!date) return toast('Select date', 'error');
  const agent = AGENTS.find(a => a.id === agentId);
  const code = 'SH' + Date.now().toString(36).toUpperCase();
  SHEET_STATE.newSheet = { id: uid(), code, agentId, agentName: agent ? `${agent.firstName} ${agent.lastName} (${agent.code})` : '—', date, entries: [], status: 'draft', dateCreated: todayISO() };
  SHEET_STATE.rows = [{ id: uid(), acct: '', name: '', amount: '' }];
  showSheetDetail(SHEET_STATE.newSheet);
}

function showSheetDetail(sheet) {
  document.getElementById('sheets-list-view').classList.add('hidden');
  document.getElementById('sheet-detail-view').classList.remove('hidden');
  document.getElementById('sd-code').textContent = sheet.code;
  document.getElementById('sd-date').textContent = fmtDate(sheet.date);
  document.getElementById('sd-agent').textContent = sheet.agentName;
  document.getElementById('ph-sheet-meta').textContent = `Sheet: ${sheet.code} · Agent: ${sheet.agentName} · Date: ${fmtDate(sheet.date)}`;
  document.getElementById('ph-company').textContent = SETTINGS.companyName || 'Pro Susu Banking';
  SHEET_STATE.activeSheetId = sheet.id;
  SHEET_STATE.rows = sheet.entries && sheet.entries.length ? JSON.parse(JSON.stringify(sheet.entries)) : [{ id: uid(), acct: '', name: '', amount: '' }];
  renderSheetRows(); calcSheetTotal();
}

function backFromSheet() {
  document.getElementById('sheets-list-view').classList.remove('hidden');
  document.getElementById('sheet-detail-view').classList.add('hidden');
  SHEET_STATE.activeSheetId = null; SHEET_STATE.newSheet = null;
  renderSheetList(null);
}

function addSheetRow() { SHEET_STATE.rows.push({ id: uid(), acct: '', name: '', amount: '' }); renderSheetRows(); }

function renderSheetRows() {
  const tb = document.getElementById('sheet-entry-rows');
  tb.innerHTML = SHEET_STATE.rows.map((r, i) => `<tr>
    <td class="text-muted">${i + 1}</td>
    <td><input type="text" class="form-control" style="font-size:.78rem;padding:6px 9px" value="${r.acct}" placeholder="Account No." id="sr-acct-${r.id}" oninput="updateSheetAcct('${r.id}',this.value)" onblur="lookupSheetAcct('${r.id}',this.value)"></td>
    <td><input type="text" class="form-control" style="font-size:.78rem;padding:6px 9px" value="${r.name}" placeholder="Auto-filled" readonly id="sr-name-${r.id}"></td>
    <td><input type="number" class="form-control" style="font-size:.78rem;padding:6px 9px" value="${r.amount}" placeholder="0.00" min="0" step="0.01" id="sr-amt-${r.id}" oninput="updateSheetAmt('${r.id}',this.value)"></td>
    <td class="no-print"><button class="btn btn-danger btn-xs" onclick="removeSheetRow('${r.id}')">✕</button></td>
  </tr>`).join('');
}

function updateSheetAcct(id, val) { const r = SHEET_STATE.rows.find(r => r.id === id); if (r) r.acct = val.toUpperCase(); }
function updateSheetAmt(id, val) { const r = SHEET_STATE.rows.find(r => r.id === id); if (r) r.amount = parseFloat(val) || 0; calcSheetTotal(); }

function lookupSheetAcct(id, val) {
  const key = val.trim().toUpperCase();
  const r = SHEET_STATE.rows.find(r => r.id === id); if (!r) return;
  r.acct = key;
  const cust = CUSTOMERS.find(c => c.acctNumber === key);
  r.name = cust ? `${cust.firstName} ${cust.lastName}` : '';
  const el = document.getElementById('sr-name-' + id); if (el) el.value = r.name;
  // Auto-jump to amount field
  if (cust) { const amtEl = document.getElementById('sr-amt-' + id); if (amtEl) { amtEl.focus(); amtEl.select(); } }
  // Auto-add new row if this is the last one
  const idx = SHEET_STATE.rows.findIndex(x => x.id === id);
  if (idx === SHEET_STATE.rows.length - 1 && cust) {
    SHEET_STATE.rows.push({ id: uid(), acct: '', name: '', amount: '' });
    renderSheetRows();
    // Re-focus amount of current row
    setTimeout(() => { const amtEl = document.getElementById('sr-amt-' + id); if (amtEl) { amtEl.focus(); amtEl.select(); } }, 50);
  }
  calcSheetTotal();
}

function removeSheetRow(id) {
  SHEET_STATE.rows = SHEET_STATE.rows.filter(r => r.id !== id);
  if (!SHEET_STATE.rows.length) SHEET_STATE.rows = [{ id: uid(), acct: '', name: '', amount: '' }];
  renderSheetRows(); calcSheetTotal();
}

function calcSheetTotal() {
  const total = SHEET_STATE.rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const count = SHEET_STATE.rows.filter(r => r.acct && r.amount > 0).length;
  const el = document.getElementById('sheet-running-total'); if (el) el.textContent = fmt(total);
  const sd = document.getElementById('sd-total'); if (sd) sd.textContent = fmt(total);
  const sc = document.getElementById('sd-count'); if (sc) sc.textContent = `${count} contributors`;
}

function finalizeSheet() {
  const validRows = SHEET_STATE.rows.filter(r => r.acct && r.amount > 0);
  if (!validRows.length) return toast('Add at least one entry', 'error');
  const total = validRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  let sheet;
  if (SHEET_STATE.newSheet) {
    sheet = { ...SHEET_STATE.newSheet, entries: JSON.parse(JSON.stringify(SHEET_STATE.rows)), total, count: validRows.length, status: 'finalized' };
    COLLECTION_SHEETS.push(sheet);
  } else {
    sheet = COLLECTION_SHEETS.find(s => s.id === SHEET_STATE.activeSheetId);
    if (sheet) { sheet.entries = JSON.parse(JSON.stringify(SHEET_STATE.rows)); sheet.total = total; sheet.count = validRows.length; sheet.status = 'finalized'; }
  }
  saveAll(); toast(`Sheet ${sheet?.code} finalized — ${validRows.length} entries, ${fmt(total)}`, 'success');
  backFromSheet();
}

function renderSheetList(filter) {
  const el    = document.getElementById('sheets-container');
  const badge = document.getElementById('sheets-total-badge');
  if (!el) return;
  if (badge) badge.textContent = COLLECTION_SHEETS.length + ' Sheets';

  let list = [...COLLECTION_SHEETS].reverse();
  if (filter) {
    const f = filter.toLowerCase();
    list = list.filter(s =>
      s.code.toLowerCase().includes(f) ||
      (s.agentName || '').toLowerCase().includes(f)
    );
  }

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ei">📋</div>
        <div class="et">${COLLECTION_SHEETS.length ? 'No sheets match your search' : 'No Collection Sheets Yet'}</div>
        <div class="es">
          ${COLLECTION_SHEETS.length
            ? 'Try a different code or clear the filter'
            : 'Finalize an entry in the Entries module to generate a sheet'}
        </div>
      </div>`;
    return;
  }

  el.innerHTML = list.map(s => `
    <div class="sheet-card" onclick="openSheetDetail('${s.id}')"
      style="cursor:pointer">
      <div class="flex-between">
        <div>
          <span class="sheet-code">${s.code}</span>
          <div class="fw-600" style="margin-top:6px">${s.agentName}</div>
          <div class="text-muted" style="font-size:.72rem;margin-top:2px">
            ${fmtDate(s.date)} · ${s.count || 0} contributors
          </div>
        </div>
        <div style="text-align:right">
          <div class="mono text-gold fw-600" style="font-size:1rem">
            ${fmt(s.total || 0)}
          </div>
          <div style="margin-top:5px">
            <span class="badge b-green">Finalized</span>
          </div>
          ${s.excess > 0
            ? `<div style="font-size:.7rem;color:var(--success);margin-top:3px">
                 Excess: ${fmt(s.excess)}
               </div>` : ''}
          ${s.shortage > 0
            ? `<div style="font-size:.7rem;color:var(--danger);margin-top:3px">
                 Shortage: ${fmt(s.shortage)}
               </div>` : ''}
          ${s.balanced
            ? `<div style="font-size:.7rem;color:var(--success);margin-top:3px">
                 ✅ Balanced
               </div>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function searchSheets() {
  const code = document.getElementById('sheet-search-code')?.value.trim();
  const date = document.getElementById('sheet-search-date')?.value;
  let list = [...COLLECTION_SHEETS];
  if (code) {
    const f = code.toLowerCase();
    list = list.filter(s =>
      s.code.toLowerCase().includes(f) ||
      (s.agentName || '').toLowerCase().includes(f)
    );
  }
  if (date) list = list.filter(s => s.date === date);
  const el = document.getElementById('sheets-container');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ei">🔍</div>
        <div class="et">No sheets found</div>
        <div class="es">Try a different code, agent name, or date</div>
      </div>`;
    return;
  }
  el.innerHTML = [...list].reverse().map(s => `
    <div class="sheet-card" onclick="openSheetDetail('${s.id}')"
      style="cursor:pointer">
      <div class="flex-between">
        <div>
          <span class="sheet-code">${s.code}</span>
          <div class="fw-600" style="margin-top:6px">${s.agentName}</div>
          <div class="text-muted" style="font-size:.72rem;margin-top:2px">
            ${fmtDate(s.date)} · ${s.count || 0} contributors
          </div>
        </div>
        <div style="text-align:right">
          <div class="mono text-gold fw-600">${fmt(s.total || 0)}</div>
          <div style="margin-top:5px"><span class="badge b-green">Finalized</span></div>
          ${s.excess > 0
            ? `<div style="font-size:.7rem;color:var(--success);margin-top:3px">
                 Excess: ${fmt(s.excess)}</div>` : ''}
          ${s.shortage > 0
            ? `<div style="font-size:.7rem;color:var(--danger);margin-top:3px">
                 Shortage: ${fmt(s.shortage)}</div>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function clearSheetSearch() {
  const c = document.getElementById('sheet-search-code');
  const d = document.getElementById('sheet-search-date');
  if (c) c.value = '';
  if (d) d.value = '';
  renderSheetList(null);
}

function backFromSheet() {
  document.getElementById('sheets-list-view').classList.remove('hidden');
  document.getElementById('sheet-detail-view').classList.add('hidden');
  renderSheetList(null);
}

function openSheetDetail(id) {
  const sheet = COLLECTION_SHEETS.find(s => s.id === id);
  if (!sheet) return;

  document.getElementById('sheets-list-view').classList.add('hidden');
  document.getElementById('sheet-detail-view').classList.remove('hidden');

  document.getElementById('sd-code').textContent  = sheet.code;
  document.getElementById('sd-date').textContent  = fmtDate(sheet.date);
  document.getElementById('sd-agent').textContent = sheet.agentName;
  document.getElementById('sd-total').textContent = fmt(sheet.total || 0);
  document.getElementById('sd-count').textContent =
    `${sheet.count || 0} contributors`;

  document.getElementById('ph-sheet-meta').textContent =
    `Sheet: ${sheet.code} · Agent: ${sheet.agentName} · ${fmtDate(sheet.date)}`;
  document.getElementById('ph-company').textContent =
    SETTINGS.companyName || 'Pro Susu Banking';

  // Render contributors (read-only)
  const rows = (sheet.entries || []).filter(r =>
    r.acct && (parseFloat(r.amount) || 0) > 0
  );
  const tb = document.getElementById('sheet-entry-rows');
  if (tb) {
    tb.innerHTML = rows.map((r, i) => {
      const cust = CUSTOMERS.find(c => c.acctNumber === r.acct);
      const name = cust
        ? `${cust.firstName} ${cust.lastName}`
        : (r.name || '—');
      return `<tr>
        <td class="text-muted" style="font-size:.76rem">${i + 1}</td>
        <td class="mono text-gold" style="font-size:.8rem">${r.acct}</td>
        <td class="fw-600" style="font-size:.83rem">${name}</td>
        <td class="mono text-success">${fmt(parseFloat(r.amount) || 0)}</td>
      </tr>`;
    }).join('');
  }

  const totalEl = document.getElementById('sheet-running-total');
  if (totalEl) totalEl.textContent = fmt(sheet.total || 0);

  // Balance summary
  const summaryEl = document.getElementById('sd-balance-summary');
  if (summaryEl) {
    if (sheet.excess > 0 || sheet.shortage > 0 || sheet.balanced) {
      summaryEl.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="padding:8px 14px;background:var(--gold-dim);
            border:1px solid var(--border);border-radius:var(--radius-sm);
            font-size:.8rem">
            <span class="text-muted">Posted: </span>
            <span class="mono text-gold fw-600">${fmt(sheet.posted || 0)}</span>
          </div>
          ${sheet.excess > 0 ? `
            <div style="padding:8px 14px;background:rgba(46,204,138,.08);
              border:1px solid rgba(46,204,138,.2);border-radius:var(--radius-sm);
              font-size:.8rem">
              <span class="text-muted">Excess: </span>
              <span class="mono text-success fw-600">${fmt(sheet.excess)}</span>
            </div>` : ''}
          ${sheet.shortage > 0 ? `
            <div style="padding:8px 14px;background:rgba(232,93,93,.08);
              border:1px solid rgba(232,93,93,.2);border-radius:var(--radius-sm);
              font-size:.8rem">
              <span class="text-muted">Shortage: </span>
              <span class="mono text-danger fw-600">${fmt(sheet.shortage)}</span>
            </div>` : ''}
          ${sheet.balanced ? `
            <div style="padding:8px 14px;background:rgba(46,204,138,.08);
              border:1px solid rgba(46,204,138,.2);border-radius:var(--radius-sm);
              font-size:.8rem">
              <span class="text-success fw-600">✅ Balanced</span>
            </div>` : ''}
          <div style="padding:8px 14px;background:var(--surface2);
            border:1px solid var(--border);border-radius:var(--radius-sm);
            font-size:.8rem">
            <span class="text-muted">Finalized by: </span>
            <span class="fw-600">${sheet.finalizedBy || '—'}</span>
            <span class="text-muted" style="margin-left:8px">
              ${sheet.finalizedAt ? fmtDateTime(sheet.finalizedAt) : ''}
            </span>
          </div>
        </div>`;
    } else {
      summaryEl.innerHTML = '';
    }
  }
}