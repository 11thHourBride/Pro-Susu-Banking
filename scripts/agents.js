// ═══════════════════════════════════════════════════════
//  AGENTS
// ═══════════════════════════════════════════════════════

function getNextAgentCode() {
  const num = AGENTS.length + 1;
  return SETTINGS.susuPrefix + pad2(num);
}

function updateAgentPreview() {
  const p = document.getElementById('next-agent-preview');
  if (p) p.textContent = getNextAgentCode();
}

function addAgent() {
  const fn      = document.getElementById('ag-fname')?.value.trim();
  const ln      = document.getElementById('ag-lname')?.value.trim();
  const phone   = document.getElementById('ag-phone')?.value.trim();
  const email   = document.getElementById('ag-email')?.value.trim();
  const dob     = document.getElementById('ag-dob')?.value;
  const joinDate= document.getElementById('ag-joindate')?.value || todayISO();
  const address = document.getElementById('ag-address')?.value.trim();
  const idType  = document.getElementById('ag-idtype')?.value;
  const idNum   = document.getElementById('ag-idnum')?.value.trim();
  const target  = parseFloat(document.getElementById('ag-target')?.value) || 0;
  const status  = document.getElementById('ag-status')?.value || 'active';

  if (!fn || !ln) return toast('Enter first and last name', 'error');
  if (!phone)     return toast('Enter phone number', 'error');

  const agentNum = AGENTS.length + 1;
  const agent = {
    id          : uid(),
    agentNumber : agentNum,
    code        : SETTINGS.susuPrefix + pad2(agentNum),
    firstName   : fn,
    lastName    : ln,
    phone, email, dob, joinDate, address, idType, idNum,
    monthlyTarget: target,
    status,
    dateAdded   : todayISO(),
  };

  AGENTS.push(agent);

  // ── Assign existing customers if checkbox is ticked ──
  if (typeof _applyAgentCustomerReassignment === 'function') {
    _applyAgentCustomerReassignment(agent);
  }

  // Clear form fields
  ['ag-fname','ag-lname','ag-phone','ag-email','ag-dob',
   'ag-address','ag-idnum','ag-target'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  updateAgentPreview();
  renderAgentList('');
  populateAgentSelectors();
  logActivity('Agent', 'Registered: ' + fn + ' ' + ln, 0, 'active');
  saveAll();
  toast('Agent ' + agent.code + ' registered: ' + fn + ' ' + ln, 'success');
}

// ── Agent list ────────────────────────────────────────
function renderAgentList(search) {
  const el = document.getElementById('agent-cards'); if (!el) return;

  const active = AGENTS.filter(a => a.status === 'active').length;
  const ab = document.getElementById('ag-active-badge');
  const tb = document.getElementById('ag-total-badge');
  if (ab) ab.textContent = active + ' Active';
  if (tb) tb.textContent = AGENTS.length + ' Total';

  let list = AGENTS;
  if (search) list = list.filter(a =>
    `${a.firstName} ${a.lastName} ${a.code}`.toLowerCase().includes(search.toLowerCase()));

  if (!list.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="ei">🧑‍💼</div>
      <div class="et">No agents found</div>
      <div class="es">Register your first agent above</div>
    </div>`;
    return;
  }

  el.innerHTML = list.map(a => {
    const custs     = CUSTOMERS.filter(c => c.agentId === a.id);
    const susu      = custs.filter(c => c.type === 'susu').length;
    const lending   = custs.filter(c => c.type === 'lending').length;
    const savings   = custs.filter(c => c.type === 'savings').length;
    const monthColl = TELLER_STATE.collections
      .filter(c => c.agentId === a.id)
      .reduce((s, c) => s + c.amount, 0);
    const pct = a.monthlyTarget > 0
      ? Math.min(100, Math.round(monthColl / a.monthlyTarget * 100)) : 0;
    const initials = a.firstName[0] + a.lastName[0];
    const statusColor = a.status === 'active' ? '#2ecc8a' : '#5a7a9a';

    return `
      <div onclick="openAgentModal('${a.id}')"
        style="background:var(--surface);border:1px solid var(--border);
          border-radius:14px;padding:0;overflow:hidden;cursor:pointer;
          transition:transform .2s,box-shadow .2s,border-color .2s"
        onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 28px rgba(0,0,0,.2)';this.style.borderColor='rgba(201,168,76,.35)'"
        onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='var(--border)'">

        <!-- Card header -->
        <div style="padding:16px 18px;border-bottom:1px solid var(--border);
          display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;
            background:linear-gradient(135deg,rgba(201,168,76,.25),rgba(201,168,76,.08));
            border:2px solid rgba(201,168,76,.3);
            display:flex;align-items:center;justify-content:center;
            font-size:.88rem;font-weight:700;color:var(--gold)">
            ${initials}
          </div>
          <div style="flex:1;min-width:0">
            <div class="fw-600" style="font-size:.9rem;white-space:nowrap;
              overflow:hidden;text-overflow:ellipsis">
              ${a.firstName} ${a.lastName}
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:3px">
              <span class="agent-code" style="font-size:.72rem">${a.code}</span>
              <span style="width:6px;height:6px;border-radius:50%;
                background:${statusColor};flex-shrink:0"></span>
              <span style="font-size:.7rem;color:${statusColor}">${a.status}</span>
            </div>
          </div>
        </div>

        <!-- Stats grid -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);
          border-bottom:1px solid var(--border)">
          <div style="padding:10px;text-align:center;border-right:1px solid var(--border)">
            <div style="font-size:1.05rem;font-weight:700;color:var(--gold)">${custs.length}</div>
            <div style="font-size:.64rem;color:var(--muted)">Customers</div>
          </div>
          <div style="padding:10px;text-align:center;border-right:1px solid var(--border)">
            <div style="font-size:1.05rem;font-weight:700;color:var(--success)">${fmt(monthColl)}</div>
            <div style="font-size:.64rem;color:var(--muted)">Collected</div>
          </div>
          <div style="padding:10px;text-align:center">
            <div style="font-size:1.05rem;font-weight:700;color:var(--info)">${pct}%</div>
            <div style="font-size:.64rem;color:var(--muted)">Target</div>
          </div>
        </div>

        <!-- Account type badges -->
        <div style="padding:10px 14px;display:flex;gap:6px;align-items:center">
          ${susu    ? `<span class="badge b-gold" style="font-size:.62rem">${susu} Susu</span>` : ''}
          ${lending ? `<span class="badge b-blue" style="font-size:.62rem">${lending} Lending</span>` : ''}
          ${savings ? `<span class="badge b-green" style="font-size:.62rem">${savings} Savings</span>` : ''}
          ${!custs.length ? `<span class="text-muted" style="font-size:.72rem">No customers yet</span>` : ''}
        </div>

        <!-- Progress bar -->
        ${a.monthlyTarget > 0 ? `
          <div style="padding:0 14px 12px">
            <div style="display:flex;justify-content:space-between;
              font-size:.68rem;color:var(--muted);margin-bottom:4px">
              <span>Monthly Target</span>
              <span class="text-gold">${fmt(a.monthlyTarget)}</span>
            </div>
            <div class="progress-wrap">
              <div class="progress-bar" style="width:${pct}%"></div>
            </div>
          </div>` : `
          <div style="padding:0 14px 12px;font-size:.7rem;color:var(--muted)">
            No target set
          </div>`}
      </div>`;
  }).join('');
}

// ── Agent detail modal ────────────────────────────────
function openAgentModal(id) {
  const a = AGENTS.find(x => x.id === id); if (!a) return;
  const custs     = CUSTOMERS.filter(c => c.agentId === id);
  const monthColl = TELLER_STATE.collections
    .filter(c => c.agentId === id)
    .reduce((s, c) => s + c.amount, 0);
  const comm = (monthColl * SETTINGS.commissionRate / 100).toFixed(2);
  const susu    = custs.filter(c => c.type === 'susu').length;
  const lending = custs.filter(c => c.type === 'lending').length;
  const savings = custs.filter(c => c.type === 'savings').length;
  const pct = a.monthlyTarget > 0
    ? Math.min(100, Math.round(monthColl / a.monthlyTarget * 100)) : 0;

  document.getElementById('m-agent-title').textContent =
    `${a.firstName} ${a.lastName} — ${a.code}`;

  document.getElementById('m-agent-body').innerHTML = `
    <!-- Top band -->
    <div style="display:flex;align-items:center;gap:16px;padding:16px;
      background:var(--surface2);border-radius:var(--radius);margin-bottom:16px">
      <div style="width:56px;height:56px;border-radius:50%;flex-shrink:0;
        background:linear-gradient(135deg,rgba(201,168,76,.3),rgba(201,168,76,.08));
        border:2px solid rgba(201,168,76,.35);
        display:flex;align-items:center;justify-content:center;
        font-size:1.1rem;font-weight:700;color:var(--gold)">
        ${a.firstName[0]}${a.lastName[0]}
      </div>
      <div style="flex:1">
        <div class="fw-600" style="font-size:1rem">${a.firstName} ${a.lastName}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span class="agent-code">${a.code}</span>
          <span class="badge ${a.status === 'active' ? 'b-green' : 'b-gray'}">${a.status}</span>
        </div>
        <div class="text-muted" style="font-size:.76rem;margin-top:4px">
          Joined ${fmtDate(a.joinDate)} &nbsp;·&nbsp; 📞 ${a.phone}
        </div>
      </div>
    </div>

    <!-- KPI row -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="padding:12px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);
        border-radius:10px;text-align:center">
        <div class="fw-700 text-success" style="font-size:1.1rem">${fmt(monthColl)}</div>
        <div class="text-muted" style="font-size:.68rem">Collections (Month)</div>
      </div>
      <div style="padding:12px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);
        border-radius:10px;text-align:center">
        <div class="fw-700 text-gold" style="font-size:1.1rem">${fmt(comm)}</div>
        <div class="text-muted" style="font-size:.68rem">Commission (${SETTINGS.commissionRate}%)</div>
      </div>
      <div style="padding:12px;background:rgba(74,144,217,.08);border:1px solid rgba(74,144,217,.2);
        border-radius:10px;text-align:center">
        <div class="fw-700" style="font-size:1.1rem;color:var(--info)">${custs.length}</div>
        <div class="text-muted" style="font-size:.68rem">Total Customers</div>
      </div>
    </div>

    <!-- Target progress -->
    ${a.monthlyTarget > 0 ? `
      <div style="margin-bottom:16px;padding:12px 14px;background:var(--surface2);
        border-radius:var(--radius)">
        <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px">
          <span class="text-muted">Monthly Target</span>
          <span><span class="text-success">${fmt(monthColl)}</span>
            / <span class="text-gold">${fmt(a.monthlyTarget)}</span>
            <span class="text-muted">(${pct}%)</span>
          </span>
        </div>
        <div class="progress-wrap" style="height:8px">
          <div class="progress-bar" style="width:${pct}%;height:8px"></div>
        </div>
      </div>` : ''}

    <!-- Customer type breakdown -->
    <div style="display:flex;gap:8px;margin-bottom:16px">
      ${susu    ? `<div style="flex:1;padding:8px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;text-align:center">
        <div class="fw-600 text-gold">${susu}</div><div class="text-muted" style="font-size:.68rem">Susu</div></div>` : ''}
      ${lending ? `<div style="flex:1;padding:8px;background:rgba(74,144,217,.08);border:1px solid rgba(74,144,217,.2);border-radius:8px;text-align:center">
        <div class="fw-600" style="color:var(--info)">${lending}</div><div class="text-muted" style="font-size:.68rem">Lending</div></div>` : ''}
      ${savings ? `<div style="flex:1;padding:8px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);border-radius:8px;text-align:center">
        <div class="fw-600 text-success">${savings}</div><div class="text-muted" style="font-size:.68rem">Savings</div></div>` : ''}
      ${!custs.length ? `<div class="text-muted" style="font-size:.8rem;padding:8px">No customers registered yet</div>` : ''}
    </div>

    <!-- Personal info grid -->
    <div class="card-title mb-2"><span>👤</span> Personal Details</div>
    <div class="grid-2 mb-4" style="font-size:.82rem">
      <div><div class="text-muted" style="font-size:.68rem;margin-bottom:2px">EMAIL</div>
        <div>${a.email || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.68rem;margin-bottom:2px">DATE OF BIRTH</div>
        <div>${fmtDate(a.dob) || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.68rem;margin-bottom:2px">ID TYPE</div>
        <div>${a.idType || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.68rem;margin-bottom:2px">ID NUMBER</div>
        <div class="mono">${a.idNum || '—'}</div></div>
      <div style="grid-column:1/-1"><div class="text-muted" style="font-size:.68rem;margin-bottom:2px">ADDRESS</div>
        <div>${a.address || '—'}</div></div>
    </div>

    <!-- Action buttons -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <button class="btn btn-gold btn-sm" onclick="openEditAgentModal('${id}')">✏️ Edit Agent</button>
      <button class="btn btn-outline btn-sm" onclick="openReassignModal('${id}')">🔄 Reassign Customers</button>
      <button class="btn ${a.status==='active'?'btn-danger':'btn-outline'} btn-sm"
        onclick="toggleAgentStatus('${id}')">
        ${a.status === 'active' ? '🚫 Deactivate' : '✅ Activate'}
      </button>
    </div>

    <!-- Customers table -->
    <div class="card-title"><span>👥</span> Customers Under This Agent</div>
    ${custs.length ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Account</th><th>Name</th><th>Type</th><th>Balance</th></tr>
          </thead>
          <tbody>
            ${custs.map(c => `
              <tr>
                <td class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</td>
                <td style="font-size:.84rem">${c.firstName} ${c.lastName}</td>
                <td><span class="badge ${c.type==='susu'?'b-gold':c.type==='lending'?'b-blue':'b-green'}">${c.type}</span></td>
                <td class="mono fw-600">${fmt(c.balance || 0)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` :
      `<div class="empty-state" style="padding:20px 0">
        <div class="ei">👥</div>
        <div class="et">No customers</div>
      </div>`}
  `;

  openModal('modal-agent');
}

// ── Toggle agent status ───────────────────────────────
function toggleAgentStatus(id) {
  const a = AGENTS.find(x => x.id === id); if (!a) return;
  const action = a.status === 'active' ? 'inactive' : 'active';
  showConfirm(
    `${action === 'inactive' ? '🚫 Deactivate' : '✅ Activate'} Agent?`,
    `${action === 'inactive' ? 'Deactivate' : 'Activate'} <strong>${a.firstName} ${a.lastName}</strong>?`,
    () => {
      a.status = action;
      saveAll();
      closeModal('modal-agent');
      renderAgentList('');
      toast(`${a.firstName} ${a.lastName} is now ${action}`, action === 'active' ? 'success' : 'warning');
    }
  );
}

// ── Reassign customers to another agent ───────────────
function openReassignModal(id) {
  const a = AGENTS.find(x => x.id === id); if (!a) return;
  const custs = CUSTOMERS.filter(c => c.agentId === id);
  if (!custs.length) return toast('This agent has no customers to reassign', 'warning');

  const others = AGENTS.filter(x => x.id !== id && x.status === 'active');
  if (!others.length) return toast('No other active agents to reassign to', 'warning');

  closeModal('modal-agent');

  showConfirmHtml(
    '🔄 Reassign Customers',
    `<div style="margin-bottom:12px">
       Reassign all <strong>${custs.length}</strong> customers from
       <strong>${a.firstName} ${a.lastName} (${a.code})</strong> to:
     </div>
     <select class="form-control" id="reassign-target">
       <option value="">— Select target agent —</option>
       ${others.map(o =>
         `<option value="${o.id}">${o.code} — ${o.firstName} ${o.lastName}</option>`
       ).join('')}
     </select>`,
    () => {
      const targetId = document.getElementById('reassign-target')?.value;
      if (!targetId) { toast('Select a target agent', 'error'); return false; }
      const target = AGENTS.find(x => x.id === targetId);
      custs.forEach(c => { c.agentId = target.id; c.agentCode = target.code; });
      saveAll();
      logActivity('Agent', `Reassigned ${custs.length} customers from ${a.code} → ${target.code}`, 0, 'transfer');
      renderAgentList('');
      toast(`${custs.length} customer(s) reassigned to ${target.code}`, 'success');
    }
  );
}

// ── Edit agent modal ──────────────────────────────────
function openEditAgentModal(id) {
  const a = AGENTS.find(x => x.id === id); if (!a) return;
  closeModal('modal-agent');
  showConfirmHtml(
    `✏️ Edit Agent — ${a.code}`,
    `<div class="form-row">
       <div class="form-group"><label class="form-label">First Name</label>
         <input type="text" class="form-control" id="ea-fname" value="${a.firstName}"></div>
       <div class="form-group"><label class="form-label">Last Name</label>
         <input type="text" class="form-control" id="ea-lname" value="${a.lastName}"></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label class="form-label">Phone</label>
         <input type="text" class="form-control" id="ea-phone" value="${a.phone}"></div>
       <div class="form-group"><label class="form-label">Email</label>
         <input type="email" class="form-control" id="ea-email" value="${a.email||''}"></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label class="form-label">Monthly Target (GH₵)</label>
         <input type="number" class="form-control" id="ea-target" value="${a.monthlyTarget}" min="0" step="0.01"></div>
       <div class="form-group"><label class="form-label">Status</label>
         <select class="form-control" id="ea-status">
           <option value="active" ${a.status==='active'?'selected':''}>Active</option>
           <option value="inactive" ${a.status==='inactive'?'selected':''}>Inactive</option>
         </select>
       </div>
     </div>
     <div class="form-group"><label class="form-label">Address</label>
       <input type="text" class="form-control" id="ea-address" value="${a.address||''}"></div>`,
    () => {
      a.firstName    = document.getElementById('ea-fname')?.value.trim()   || a.firstName;
      a.lastName     = document.getElementById('ea-lname')?.value.trim()   || a.lastName;
      a.phone        = document.getElementById('ea-phone')?.value.trim()   || a.phone;
      a.email        = document.getElementById('ea-email')?.value.trim();
      a.address      = document.getElementById('ea-address')?.value.trim();
      a.monthlyTarget= parseFloat(document.getElementById('ea-target')?.value) || 0;
      a.status       = document.getElementById('ea-status')?.value || 'active';
      saveAll();
      renderAgentList('');
      toast(`${a.firstName} ${a.lastName} updated ✅`, 'success');
    }
  );
}

// ── Targets ───────────────────────────────────────────
function renderTargets() {
  const picker = document.getElementById('target-month-picker');
  if (picker && !picker.value) picker.value = new Date().toISOString().slice(0,7);
  const month  = picker?.value || new Date().toISOString().slice(0,7);
  const label  = document.getElementById('target-month-label');
  if (label) label.textContent = monthLabel(month);
  const tb = document.getElementById('targets-tbody'); if (!tb) return;
  if (!AGENTS.length) {
    tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:20px">No agents</td></tr>';
    return;
  }
  const monthColl = agId => TELLER_STATE.collections
    .filter(c => c.agentId === agId).reduce((s, c) => s + c.amount, 0);
  tb.innerHTML = AGENTS.map(a => {
    const mc  = monthColl(a.id);
    const pct = a.monthlyTarget > 0 ? Math.min(100, Math.round(mc / a.monthlyTarget * 100)) : 0;
    return `<tr>
      <td class="fw-600">${a.firstName} ${a.lastName}</td>
      <td class="agent-code">${a.code}</td>
      <td class="mono text-gold">${fmt(a.monthlyTarget)}</td>
      <td><input type="number" class="form-control"
        style="width:130px;font-size:.82rem;padding:6px 9px"
        value="${a.monthlyTarget}" min="0" step="0.01" id="tgt-${a.id}" placeholder="0.00"></td>
      <td class="mono text-success">${fmt(mc)}</td>
      <td>
        <div class="progress-wrap" style="min-width:80px">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <div style="font-size:.68rem;color:var(--muted)">${pct}%</div>
      </td>
    </tr>`;
  }).join('');
}

function saveAllTargets() {
  AGENTS.forEach(a => {
    const el = document.getElementById('tgt-' + a.id);
    if (el) a.monthlyTarget = parseFloat(el.value) || 0;
  });
  saveAll();
  toast('Targets saved for all agents', 'success');
}

// ── Commissions ───────────────────────────────────────
function renderCommissions() {
  const picker = document.getElementById('comm-month-picker');
  if (picker && !picker.value) picker.value = new Date().toISOString().slice(0,7);
  const tb   = document.getElementById('comm-tbody'); if (!tb) return;
  const rate = SETTINGS.commissionRate;
  const l  = document.getElementById('comm-rate-label');  if (l)  l.textContent  = rate + '%';
  const l2 = document.getElementById('comm-rate-th');     if (l2) l2.textContent = rate + '%';
  if (!AGENTS.length) {
    tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:20px">No agents</td></tr>';
    return;
  }
  tb.innerHTML = AGENTS.map(a => {
    const mc   = TELLER_STATE.collections
      .filter(c => c.agentId === a.id).reduce((s, c) => s + c.amount, 0);
    const comm = mc * rate / 100;
    return `<tr>
      <td class="fw-600">${a.firstName} ${a.lastName}</td>
      <td><span class="agent-code">${a.code}</span></td>
      <td class="mono text-success">${fmt(mc)}</td>
      <td class="mono text-gold fw-600">${fmt(comm)}</td>
      <td><span class="badge ${comm > 0 ? 'b-green' : 'b-gray'}">${comm > 0 ? 'Due' : 'No collection'}</span></td>
      <td>${comm > 0
        ? `<button class="btn btn-gold btn-xs" onclick="markCommPaid('${a.id}',${comm})">Mark Paid</button>`
        : '—'}</td>
    </tr>`;
  }).join('');
}

function markCommPaid(agentId, amount) {
  const a = AGENTS.find(x => x.id === agentId);
  logActivity('Commission', 'Commission paid to ' + a?.firstName, amount, 'paid');
  saveAll();
  toast(fmt(amount) + ' commission marked as paid', 'success');
}

// ── showConfirmHtml helper (if not in general.js) ─────
function showConfirmHtml(title, bodyHtml, onConfirm) {
  const titleEl = document.getElementById('m-conf-title');
  const bodyEl  = document.getElementById('m-conf-body');
  const okBtn   = document.getElementById('m-conf-ok');
  if (!titleEl || !bodyEl || !okBtn) return;
  titleEl.innerHTML = title;
  bodyEl.innerHTML  = bodyHtml;
  okBtn.onclick = () => {
    const result = onConfirm();
    if (result !== false) closeModal('modal-confirm');
  };
  openModal('modal-confirm');
}
