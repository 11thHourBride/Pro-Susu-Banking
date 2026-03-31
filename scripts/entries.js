// ═══════════════════════════════════════════════════════
//  ENTRIES — FUNCTIONS
// ═══════════════════════════════════════════════════════

function renderEntriesList() {
  // Only show awaiting collections — entered ones live in Collection Sheets
  const allColls      = TELLER_STATE.collections;
  const awaitingColls = allColls.filter(c => c.status === 'awaiting');
  const enteredCount  = allColls.filter(c => c.status === 'entered').length;

  const a = document.getElementById('ent-await');
  const b = document.getElementById('ent-done');
  if (a) a.textContent = awaitingColls.length + ' awaiting';
  if (b) b.textContent = enteredCount + ' entered';

  const area = document.getElementById('entries-cards-area');
  if (!area) return;

  if (!awaitingColls.length) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="ei">${enteredCount > 0 ? '✅' : '📭'}</div>
        <div class="et">
          ${enteredCount > 0
            ? `All ${enteredCount} collection(s) finalized`
            : 'No Collections Posted'}
        </div>
        <div class="es">
          ${enteredCount > 0
            ? 'View finalized sheets in <strong>Collection Sheets</strong>'
            : 'Collections from teller will appear here'}
        </div>
      </div>`;
    return;
  }

  area.innerHTML = awaitingColls.map(c => `
    <div style="background:var(--surface);border:1px solid var(--border);
      border-radius:var(--radius);padding:16px;cursor:pointer;
      margin-bottom:9px;transition:all .18s"
      onmouseover="this.style.borderColor='rgba(201,168,76,.35)'"
      onmouseout="this.style.borderColor='var(--border)'"
      onclick="openEntry('${c.id}')">
      <div class="flex-between">
        <div>
          <div class="fw-600" style="font-size:.9rem">${c.agentName}</div>
          <div class="text-muted" style="font-size:.75rem;margin-top:2px">
            ${c.ref || 'No route'} · ${fmtTime(c.time)}
          </div>
        </div>
        <div style="text-align:right">
          <div class="mono text-gold" style="font-size:1.05rem">${fmt(c.amount)}</div>
          <span class="badge b-yellow" style="margin-top:4px">Awaiting Entry</span>
        </div>
      </div>
    </div>`).join('');
}

function openEntry(collId) {
  const coll = TELLER_STATE.collections.find(c => c.id === collId);
  if (!coll) return;

  ENTRY_STATE.activeCollId = collId;

  const existing = coll.entryRows || [];
  ENTRY_STATE.rows = existing.length
    ? JSON.parse(JSON.stringify(existing))
    : [{ id: uid(), acct: '', name: '', amount: '' }];

  document.getElementById('entries-list').style.display = 'none';
  document.getElementById('entry-detail').classList.remove('hidden');

  document.getElementById('entry-heading').textContent =
    `${coll.agentName} — ${fmt(coll.amount)}`;

  // Resolve agent for hint
  const agent = AGENTS.find(a => a.id === coll.agentId);
  const hint = agent
    ? `💡 Type last 4 digits only — e.g. <strong>0001</strong> for <span class="mono">${agent.code}-0001</span>`
    : '💡 Type account number';

  const metaEl = document.getElementById('entry-meta');
  if (metaEl) metaEl.innerHTML =
    `${coll.ref || 'No route'} · ${fmtDateTime(coll.time)}
     <br><span style="color:var(--gold);font-size:.72rem">${hint}</span>`;

  buildEntryTable();
  calcEntryBalance();
}

function backFromEntry() {
  ENTRY_STATE.activeCollId = null;
  ENTRY_STATE.rows = [];
  document.getElementById('entries-list').style.display = '';
  document.getElementById('entry-detail').classList.add('hidden');
  renderEntriesList();
}

// ── Build the full table (called once per openEntry / row add) ──
function buildEntryTable() {
  const tb = document.getElementById('entry-rows');
  if (!tb) return;

  tb.innerHTML = ENTRY_STATE.rows.map((r, i) => `
    <tr id="erow-${r.id}">
      <td class="text-muted" style="width:32px;font-size:.78rem">${i + 1}</td>
      <td style="width:155px">
        <input
          type="text"
          id="eacct-${r.id}"
          class="form-control"
          style="font-size:.82rem;padding:7px 10px;
                 font-family:'JetBrains Mono',monospace;letter-spacing:.5px"
          value="${r.acct}"
          placeholder="e.g. 0001"
          autocomplete="off"
          spellcheck="false">
      </td>
      <td>
        <input
          type="text"
          id="ename-${r.id}"
          class="form-control"
          style="font-size:.82rem;padding:7px 10px;background:var(--surface2)"
          value="${r.name}"
          placeholder="Auto-filled"
          readonly
          tabindex="-1">
      </td>
      <td style="width:155px">
        <input
          type="number"
          id="eamt-${r.id}"
          class="form-control"
          style="font-size:.82rem;padding:7px 10px"
          value="${r.amount || ''}"
          placeholder="0.00"
          min="0"
          step="0.01"
          tabindex="-1">
      </td>
      <td style="width:36px">
        ${i > 0
          ? `<button class="btn btn-danger btn-xs"
               onclick="removeEntryRow('${r.id}')" tabindex="-1">✕</button>`
          : ''}
      </td>
    </tr>`).join('');

  // Attach listeners AFTER the DOM is built
  ENTRY_STATE.rows.forEach(r => attachEntryRowListeners(r.id));

  // Focus account field of last row
  focusEntryAcct(ENTRY_STATE.rows[ENTRY_STATE.rows.length - 1].id);
}

// ── Attach keyboard listeners to one row by id ──
function attachEntryRowListeners(rowId) {
  const acctEl = document.getElementById(`eacct-${rowId}`);
  const amtEl  = document.getElementById(`eamt-${rowId}`);

  if (acctEl) {
    // Auto-lookup the moment clerk types exactly 4 digits
    acctEl.addEventListener('input', function() {
      const val = this.value.trim();
      // Fire immediately when 4 digits typed (short code)
      if (/^\d{4}$/.test(val)) {
        doLookup(rowId, val);
        return;
      }
      // Also fire if they type a full account number with dash e.g. TN01-0001
      if (/^[A-Za-z]{2,4}\d{2}-\d{4}$/.test(val)) {
        doLookup(rowId, val);
        return;
      }
      // If name was previously filled and clerk is now clearing/changing, reset the name
      const r = ENTRY_STATE.rows.find(x => x.id === rowId);
      if (r && r.name) {
        r.name = '';
        const nameEl = document.getElementById(`ename-${rowId}`);
        if (nameEl) {
          nameEl.value = '';
          nameEl.style.color = 'var(--muted)';
        }
      }
    });

    // Enter/Tab still works as a manual trigger (e.g. 1, 2, or 3 digit codes)
    acctEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const val = this.value.trim();
        if (val) doLookup(rowId, val);
      }
    });
  }

  if (amtEl) {
    amtEl.addEventListener('input', function() {
      updateEntryAmt(rowId, this.value);
    });

    amtEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const amt = parseFloat(this.value) || 0;
        if (!amt || amt <= 0) {
          toast('Enter an amount before proceeding', 'warning');
          return;
        }
        updateEntryAmt(rowId, this.value);
        advanceEntryRow(rowId);
      }
    });
  }
}

// ── Core lookup — reads directly from DOM, no oninput dependency ──
function doLookup(rowId, raw) {
  if (!raw) return;

  const r = ENTRY_STATE.rows.find(x => x.id === rowId);
  if (!r) return;

  // Get agent from active collection
  const coll  = TELLER_STATE.collections.find(c => c.id === ENTRY_STATE.activeCollId);
  const agent = coll ? AGENTS.find(a => a.id === coll.agentId) : null;

  let cust         = null;
  let resolvedAcct = raw.toUpperCase();

  // ── Short code: clerk typed digits only (1–4 chars) ──
  if (agent && /^\d{1,4}$/.test(raw)) {
    const padded = raw.padStart(4, '0');       // "1" → "0001"
    resolvedAcct  = `${agent.code}-${padded}`; // "TN01-0001"
    cust = CUSTOMERS.find(c => c.acctNumber === resolvedAcct);
  }

  // ── Fallback: full account number typed ──
  if (!cust) {
    resolvedAcct = raw.toUpperCase();
    cust = CUSTOMERS.find(c => c.acctNumber === resolvedAcct);
  }

  // ── Persist resolved values into state ──
  r.acct = cust ? resolvedAcct : raw.toUpperCase();
  r.name = cust ? `${cust.firstName} ${cust.lastName}` : '';

  // ── Update DOM ──
  const acctEl = document.getElementById(`eacct-${rowId}`);
  const nameEl = document.getElementById(`ename-${rowId}`);

  if (acctEl) acctEl.value = r.acct;

  if (nameEl) {
    if (cust) {
      nameEl.value = r.name;
      nameEl.style.color = 'var(--success)';
    } else {
      nameEl.value = '❌ Account not found';
      nameEl.style.color = 'var(--danger)';
    }
  }

  calcEntryBalance();

  // ── Jump to amount field if customer found ──
  if (cust) {
    const amtEl = document.getElementById(`eamt-${rowId}`);
    if (amtEl) {
      amtEl.removeAttribute('tabindex'); // make focusable
      amtEl.focus();
      amtEl.select();
    }
  }
}

// ── Advance to next row after amount entered ──
function advanceEntryRow(rowId) {
  const idx = ENTRY_STATE.rows.findIndex(r => r.id === rowId);

  if (idx === ENTRY_STATE.rows.length - 1) {
    // Last row — create a new one
    const newRow = { id: uid(), acct: '', name: '', amount: '' };
    ENTRY_STATE.rows.push(newRow);
    buildEntryTable(); // rebuilds and focuses new row automatically
  } else {
    // Move to next existing row
    focusEntryAcct(ENTRY_STATE.rows[idx + 1].id);
  }
}

function focusEntryAcct(rowId) {
  setTimeout(() => {
    const el = document.getElementById(`eacct-${rowId}`);
    if (el) { el.focus(); el.select(); }
  }, 40);
}

function updateEntryAmt(id, val) {
  const r = ENTRY_STATE.rows.find(r => r.id === id);
  if (r) r.amount = parseFloat(val) || 0;
  calcEntryBalance();
}

function removeEntryRow(id) {
  if (ENTRY_STATE.rows.length === 1) return;
  ENTRY_STATE.rows = ENTRY_STATE.rows.filter(r => r.id !== id);
  buildEntryTable();
  calcEntryBalance();
}

function calcEntryBalance() {
  const coll = TELLER_STATE.collections.find(c => c.id === ENTRY_STATE.activeCollId);
  if (!coll) return;

  const posted   = coll.amount;
  const total    = ENTRY_STATE.rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const diff     = posted - total;  // positive = remaining, negative = over-entered
  const remaining = diff > 0 ? diff : 0;
  const shortage  = diff < 0 ? Math.abs(diff) : 0;
  const balanced  = diff === 0 && total > 0;

  // ── Remaining / Balanced box ──
  const remainBox   = document.getElementById('eb-remaining-box');
  const remainLabel = document.getElementById('eb-remaining-label');
  const remainVal   = document.getElementById('eb-posted');

  if (balanced) {
    if (remainBox)  {
      remainBox.style.background = 'rgba(46,204,138,.12)';
      remainBox.style.border     = '2px solid rgba(46,204,138,.4)';
    }
    if (remainLabel) { remainLabel.textContent = '✅ Balanced'; remainLabel.style.color = 'var(--success)'; }
    if (remainVal)   { remainVal.textContent = 'GH₵ 0.00';    remainVal.style.color   = 'var(--success)'; }
  } else {
    if (remainBox)  {
      remainBox.style.background = 'rgba(74,144,217,.1)';
      remainBox.style.border     = '1px solid rgba(74,144,217,.22)';
    }
    if (remainLabel) { remainLabel.textContent = '📥 Remaining Posted'; remainLabel.style.color = 'var(--info)'; }
    if (remainVal)   { remainVal.textContent = fmt(remaining);           remainVal.style.color   = 'var(--info)'; }
  }

  // ── Excess box (live — only shows remaining as prospective excess) ──
  const excessEl = document.getElementById('eb-excess');
  if (excessEl) {
    excessEl.textContent = remaining > 0 ? fmt(remaining) : 'GH₵ 0.00';
    excessEl.style.color = remaining > 0 ? 'var(--success)' : 'var(--muted)';
  }

  // ── Shortage box ──
  const shortEl = document.getElementById('eb-short');
  if (shortEl) {
    shortEl.textContent = fmt(shortage);
    shortEl.style.color = shortage > 0 ? 'var(--danger)' : 'var(--muted)';
  }

  // ── Total entered ──
  const totalEl = document.getElementById('entry-total');
  if (totalEl) totalEl.textContent = fmt(total);
}

function finalizeEntry() {
  const coll = TELLER_STATE.collections.find(c => c.id === ENTRY_STATE.activeCollId);
  if (!coll) return;

  const validRows = ENTRY_STATE.rows.filter(r =>
    r.acct && (parseFloat(r.amount) || 0) > 0
  );
  if (!validRows.length) return toast('Add at least one valid entry row', 'error');

  const posted    = coll.amount;
  const total     = validRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const remaining = posted - total;   // unaccounted → excess
  const shortage  = total - posted;   // over-entered → shortage

  // ── 1. Generate unique sheet code ──
  const sheetCode = 'SH-' +
    new Date().toISOString().slice(0,10).replace(/-/g,'') +
    '-' + Math.random().toString(36).slice(2,6).toUpperCase();

  // ── 2. Update each customer's balance and transaction history ──
  const entryDate = todayISO();
  validRows.forEach(r => {
    const cust = CUSTOMERS.find(c => c.acctNumber === r.acct);
    if (!cust) return;
    const amt = parseFloat(r.amount) || 0;
    cust.balance = (cust.balance || 0) + amt;
    if (!cust.transactions) cust.transactions = [];
    cust.transactions.push({
      id      : uid(),
      type    : 'entry',
      desc    : `Collection entry — Sheet ${sheetCode} (${coll.agentName})`,
      amount  : amt,
      balance : cust.balance,
      date    : entryDate,
      time    : new Date().toISOString(),
      by      : currentUser?.name || 'System',
      sheetCode
    });
  });

  // ── 3. Build and save the Collection Sheet ──
  const agent = AGENTS.find(a => a.id === coll.agentId);
  const sheet = {
    id          : uid(),
    code        : sheetCode,
    agentId     : coll.agentId,
    agentName   : coll.agentName,
    agentCode   : agent?.code || '',
    date        : entryDate,
    entries     : JSON.parse(JSON.stringify(validRows)),
    total,
    count       : validRows.length,
    posted,
    excess      : remaining > 0 ? remaining : 0,
    shortage    : shortage  > 0 ? shortage  : 0,
    balanced    : remaining === 0 && shortage === 0,
    status      : 'finalized',
    finalizedAt : new Date().toISOString(),
    finalizedBy : currentUser?.name || 'System',
    collectionId: coll.id
  };
  COLLECTION_SHEETS.push(sheet);

  // ── 4. Mark collection as entered and store sheet code ──
  coll.status    = 'entered';
  coll.sheetCode = sheetCode;
  coll.entryRows = JSON.parse(JSON.stringify(ENTRY_STATE.rows));
  coll.entrySummary = {
    posted, totalEntered: total,
    excess   : remaining > 0 ? remaining : 0,
    shortage : shortage  > 0 ? shortage  : 0,
    balanced : remaining === 0 && shortage === 0,
    finalizedAt : new Date().toISOString(),
    finalizedBy : currentUser?.name || 'System'
  };

  // ── 5. Toast feedback ──
  if (remaining > 0) {
    toast(`Sheet ${sheetCode} finalized — ${fmt(remaining)} recorded as Excess`, 'warning');
  } else if (shortage > 0) {
    toast(`Sheet ${sheetCode} finalized — ${fmt(shortage)} recorded as Shortage`, 'warning');
  } else {
    toast(`Sheet ${sheetCode} finalized — ${validRows.length} contributors balanced ✅`, 'success');
  }

  logActivity('Entry',
    `Sheet ${sheetCode} — ${coll.agentName} — ${validRows.length} contributors`,
    total, 'finalized');

  saveAll();
  backFromEntry();
}