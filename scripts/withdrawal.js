// ═══════════════════════════════════════════════════════
//  WITHDRAWAL TABS
// ═══════════════════════════════════════════════════════
let currentWdTab = 'pending';

function showWdTab(tab, btn) {
  currentWdTab = tab;
  if (btn) {
    btn.closest('.sub-tabs').querySelectorAll('.sub-tab')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  renderWdTab(tab);
}

function renderWdTab(tab) {
  const el = document.getElementById('wd-tab-content');
  if (!el) return;
  const wds = TELLER_STATE.withdrawals;

  if (tab === 'pending') {
    const list = wds.filter(w => w.status === 'pending');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><div class="ei">⏳</div>
        <div class="et">No Pending Requests</div></div>`;
      return;
    }
    el.innerHTML = list.map(w => buildWdCard(w, 'pending')).join('');

  } else if (tab === 'approved') {
    const list = wds.filter(w => w.status === 'paid');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><div class="ei">✅</div>
        <div class="et">No Approved Withdrawals</div></div>`;
      return;
    }
    el.innerHTML = list.map(w => buildWdCard(w, 'approved')).join('');

  } else if (tab === 'rejected') {
    const list = wds.filter(w => w.status === 'rejected');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><div class="ei">✕</div>
        <div class="et">No Rejected Requests</div></div>`;
      return;
    }
    el.innerHTML = list.map(w => buildWdCard(w, 'rejected')).join('');

  } else if (tab === 'history') {
    if (!wds.length) {
      el.innerHTML = `<div class="empty-state"><div class="ei">📅</div>
        <div class="et">No Withdrawal History</div></div>`;
      return;
    }
    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Date</th><th>Account</th><th>Customer</th>
              <th>Amount</th><th>Collector</th><th>Submitted By</th>
              <th>Status</th><th>Approved By</th>
            </tr>
          </thead>
          <tbody>
            ${[...wds].reverse().map((w, i) => `
              <tr>
                <td class="text-muted">${i + 1}</td>
                <td style="font-size:.76rem">${fmtDate(w.date)}</td>
                <td class="mono text-gold" style="font-size:.78rem">${w.acct || '—'}</td>
                <td class="fw-600" style="font-size:.83rem">${w.name}</td>
                <td class="mono text-danger">${fmt(w.type === 'customer_request' ? w.totalDeduction : w.amount)}</td>
                <td style="font-size:.78rem">${w.isRepresentative ? (w.representative?.name || '—') + ' (Rep)' : (w.name || '—')}</td>
                <td style="font-size:.76rem;color:var(--muted)">${w.submittedBy || '—'}</td>
                <td><span class="badge ${w.status === 'paid' ? 'b-green' : w.status === 'rejected' ? 'b-red' : 'b-yellow'}">${w.status}</span></td>
                <td style="font-size:.76rem;color:var(--muted)">${w.approvedBy || w.rejectedBy || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

function buildWdCard(w, mode) {
  const isReq   = w.type === 'customer_request';
  const amount  = isReq ? w.totalDeduction : w.amount;
  const repBadge = w.isRepresentative
    ? `<span class="badge b-yellow" style="font-size:.62rem">
         👤 Rep: ${w.representative?.name || '—'}
       </span>`
    : `<span class="badge b-green" style="font-size:.62rem">👤 Owner</span>`;

  const denomsHTML = (w.denominations && mode === 'approved')
    ? buildDenomDisplay(w.denominations) : '';

  const rejReasonHTML = (mode === 'rejected' && w.rejectedReason)
    ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(232,93,93,.08);
         border:1px solid rgba(232,93,93,.2);border-radius:var(--radius-sm);
         font-size:.78rem;color:var(--danger)">
         ✕ Reason: ${w.rejectedReason}
       </div>` : '';

  const actionsHTML = mode === 'pending'
    ? `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px">
         <button class="btn btn-gold btn-sm"
           onclick="openApproveWdModal('${w.id}')">✅ Approve</button>
         <button class="btn btn-danger btn-sm"
           onclick="openRejectWdModal('${w.id}')">✕ Reject</button>
       </div>` : '';

  return `
    <div style="background:var(--surface);border:1px solid var(--border);
      border-radius:var(--radius);padding:16px;margin-bottom:12px">

      <!-- Header row -->
      <div class="flex-between" style="margin-bottom:10px">
        <div>
          <div class="fw-600" style="font-size:.92rem">${w.name}</div>
          <div class="mono text-gold" style="font-size:.78rem;margin-top:2px">
            ${w.acct || '—'}
          </div>
        </div>
        <div style="text-align:right">
          <div class="mono text-danger fw-600" style="font-size:1.05rem">
            ${fmt(amount)}
          </div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:2px">
            ${fmtDate(w.date)}
          </div>
        </div>
      </div>

      <!-- Badges -->
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
        ${repBadge}
        ${isReq && w.advanceAmount > 0
          ? `<span class="badge b-blue" style="font-size:.62rem">
               ⏩ Adv: ${fmt(w.advanceAmount)}
             </span>` : ''}
        ${isReq && w.commissionAmount > 0
          ? `<span class="badge b-gold" style="font-size:.62rem">
               💰 Comm: ${fmt(w.commissionAmount)}
             </span>` : ''}
        ${w.reason
          ? `<span class="badge b-gray" style="font-size:.62rem">
               📝 ${w.reason}
             </span>` : ''}
      </div>

      <!-- Breakdown if customer request -->
      ${isReq && (w.advanceAmount > 0 || w.commissionAmount > 0)
        ? `<div style="background:var(--surface2);border:1px solid var(--border);
             border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px;
             font-size:.8rem;display:flex;flex-direction:column;gap:5px">
             <div class="flex-between">
               <span class="text-muted">Withdrawal</span>
               <span class="mono">${fmt(w.amount)}</span>
             </div>
             ${w.advanceAmount > 0
               ? `<div class="flex-between">
                    <span class="text-muted">Advance</span>
                    <span class="mono text-warning">${fmt(w.advanceAmount)}</span>
                  </div>` : ''}
             ${w.commissionAmount > 0
               ? `<div class="flex-between">
                    <span class="text-muted">Commission</span>
                    <span class="mono text-warning">${fmt(w.commissionAmount)}</span>
                  </div>` : ''}
             <hr class="divider" style="margin:2px 0">
             <div class="flex-between fw-600">
               <span>Total</span>
               <span class="mono text-danger">${fmt(w.totalDeduction)}</span>
             </div>
           </div>` : ''}

      <!-- Representative details -->
      ${w.isRepresentative && w.representative
        ? `<div style="background:rgba(240,165,0,.07);border:1px solid rgba(240,165,0,.2);
             border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px;
             font-size:.78rem">
             <div class="fw-600 text-warning" style="margin-bottom:5px">
               👤 Representative Details
             </div>
             <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
               <div><span class="text-muted">Name: </span>${w.representative.name}</div>
               <div><span class="text-muted">Phone: </span>${w.representative.phone}</div>
               <div><span class="text-muted">Relationship: </span>${w.representative.relationship}</div>
               <div><span class="text-muted">ID: </span>${w.representative.idType} — ${w.representative.idNumber}</div>
             </div>
           </div>` : ''}

      <!-- Submitted by -->
      <div style="font-size:.73rem;color:var(--muted);margin-bottom:4px">
        Submitted by: <strong>${w.submittedBy || '—'}</strong>
        ${w.approvedBy ? ` · Approved by: <strong>${w.approvedBy}</strong>` : ''}
        ${w.rejectedBy ? ` · Rejected by: <strong>${w.rejectedBy}</strong>` : ''}
      </div>

      <!-- BUG 3 FIX: receiver name (approved cards only) -->
      ${mode === 'approved' && w.receiver
        ? `<div style="margin-top:6px;padding:8px 12px;
             background:rgba(46,204,138,.07);border:1px solid rgba(46,204,138,.18);
             border-radius:var(--radius-sm);font-size:.78rem;display:flex;
             align-items:center;gap:8px">
             <span style="font-size:.9rem">👤</span>
             <div>
               <span class="text-muted">Cash received by: </span>
               <strong class="text-success">${w.receiver}</strong>
               ${w.isRepresentative
                 ? `<span class="badge b-yellow" style="font-size:.6rem;margin-left:6px">Representative</span>`
                 : `<span class="badge b-green"  style="font-size:.6rem;margin-left:6px">Account Owner</span>`}
             </div>
           </div>` : ''}

      <!-- Denomination display (approved) -->
      ${denomsHTML}

      <!-- Rejection reason -->
      ${rejReasonHTML}

      <!-- Actions -->
      ${actionsHTML}
    </div>`;
}

function buildDenomDisplay(denoms) {
  if (!denoms || !denoms.length) return '';
  return `
    <div style="margin-top:8px;background:rgba(46,204,138,.07);
      border:1px solid rgba(46,204,138,.18);border-radius:var(--radius-sm);
      padding:10px 12px;font-size:.78rem">
      <div class="fw-600 text-success" style="margin-bottom:6px">
        💵 Denominations Paid
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${denoms.filter(d => d.qty > 0).map(d =>
          `<span style="background:var(--surface2);border:1px solid var(--border);
             border-radius:4px;padding:3px 9px;font-family:'JetBrains Mono',monospace">
             ${d.qty} × ${d.label} = ${fmt(d.qty * d.value)}
           </span>`
        ).join('')}
      </div>
    </div>`;
}

// ── Approve Modal with Denomination Selection ──
function openApproveWdModal(wdId) {
  const w = TELLER_STATE.withdrawals.find(x => x.id === wdId);
  if (!w) return;

  const isReq = w.type === 'customer_request';

  // Commission is deducted from account but NOT paid out in cash
  const cashToPay     = isReq
    ? (w.amount || 0) + (w.advanceAmount || 0)   // NO commission
    : (w.amount || 0);
  const commissionAmt = isReq ? (w.commissionAmount || 0) : 0;
  const totalDeduct   = isReq ? w.totalDeduction : w.amount;

  const denomDef = [
    { id: 'ap200', label: 'GH₵ 200', value: 200  },
    { id: 'ap100', label: 'GH₵ 100', value: 100  },
    { id: 'ap50',  label: 'GH₵ 50',  value: 50   },
    { id: 'ap20',  label: 'GH₵ 20',  value: 20   },
    { id: 'ap10',  label: 'GH₵ 10',  value: 10   },
    { id: 'ap5',   label: 'GH₵ 5',   value: 5    },
    { id: 'ap2',   label: 'GH₵ 2',   value: 2    },
    { id: 'ap1',   label: 'GH₵ 1',   value: 1    },
    { id: 'ap050', label: '50p',      value: 0.50 },
    { id: 'ap020', label: '20p',      value: 0.20 },
    { id: 'ap010', label: '10p',      value: 0.10 },
    { id: 'ap005', label: '5p',       value: 0.05 },
  ];

  document.getElementById('m-conf-title').textContent = '✅ Approve Withdrawal';
  document.getElementById('m-conf-body').innerHTML = `

    <!-- Account deduction summary -->
    <div style="background:var(--surface2);border:1px solid var(--border);
      border-radius:var(--radius);padding:12px 16px;margin-bottom:14px;
      font-size:.83rem;display:flex;flex-direction:column;gap:6px">
      <div class="fw-600" style="margin-bottom:4px">${w.name}
        <span class="mono text-gold" style="font-size:.76rem;margin-left:6px">
          ${w.acct || ''}
        </span>
      </div>
      <div class="flex-between">
        <span class="text-muted">Withdrawal Amount</span>
        <span class="mono">${fmt(w.amount || 0)}</span>
      </div>
      ${(w.advanceAmount || 0) > 0
        ? `<div class="flex-between">
             <span class="text-muted">Advance Deduction</span>
             <span class="mono text-warning">${fmt(w.advanceAmount)}</span>
           </div>` : ''}
      ${commissionAmt > 0
        ? `<div class="flex-between">
             <span class="text-muted">Commission (deducted — not paid in cash)</span>
             <span class="mono text-warning">${fmt(commissionAmt)}</span>
           </div>` : ''}
      <hr class="divider" style="margin:3px 0">
      <div class="flex-between fw-600">
        <span>Total Deducted from Account</span>
        <span class="mono text-danger">${fmt(totalDeduct)}</span>
      </div>
      ${commissionAmt > 0
        ? `<div style="margin-top:4px;padding:7px 10px;
             background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.2);
             border-radius:var(--radius-sm);font-size:.76rem;color:var(--warning)">
             ⚠️ Commission of <strong>${fmt(commissionAmt)}</strong> is deducted from
             the account but <strong>excluded from cash payout</strong>.
             Denomination count covers cash payout only.
           </div>` : ''}
      <div style="margin-top:6px;padding:8px 12px;
        background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);
        border-radius:var(--radius-sm)">
        <div class="flex-between fw-600">
          <span class="text-success">💵 Cash to Hand Over</span>
          <span class="mono text-success" style="font-size:1rem">${fmt(cashToPay)}</span>
        </div>
      </div>
    </div>

    <!-- Person receiving -->
    <div class="form-group">
      <label class="form-label">Person Receiving Cash</label>
      <input type="text" class="form-control" id="ap-receiver"
        value="${w.isRepresentative ? (w.representative?.name || '') : w.name}"
        placeholder="Name of person collecting cash">
    </div>

    <!-- Denominations — counts only cashToPay -->
    <div class="form-group">
      <label class="form-label">
        Denominations Used
        <span class="text-muted" style="font-size:.7rem;text-transform:none;
          letter-spacing:0;font-weight:400">
          (for cash payout of ${fmt(cashToPay)} only)
        </span>
      </label>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px">
        ${denomDef.map(d => `
          <div style="background:var(--surface2);border:1px solid var(--border);
            border-radius:var(--radius-sm);padding:9px 10px">
            <div style="font-size:.74rem;color:var(--gold-light);
              font-weight:600;margin-bottom:4px">${d.label}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" class="form-control" id="${d.id}"
                style="width:65px;padding:5px 8px;font-size:.82rem"
                placeholder="0" min="0"
                oninput="calcApprovalDenoms(${cashToPay})">
              <span class="text-muted" style="font-size:.7rem">qty</span>
            </div>
            <div style="font-size:.7rem;color:var(--success);margin-top:3px"
              id="${d.id}-t">= GH₵ 0.00</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Running total -->
    <div style="background:var(--surface2);border:1px solid var(--border);
      border-radius:var(--radius);padding:12px 16px">
      <div class="flex-between" style="font-size:.83rem">
        <span class="text-muted">Cash to Pay Out</span>
        <span class="mono text-gold fw-600">${fmt(cashToPay)}</span>
      </div>
      <div class="flex-between" style="font-size:.83rem;margin-top:5px">
        <span class="text-muted">Counted in Denominations</span>
        <span class="mono fw-600" id="ap-denom-total">GH₵ 0.00</span>
      </div>
      <div class="flex-between fw-600" style="margin-top:8px;padding-top:8px;
        border-top:1px solid var(--border)">
        <span>Difference</span>
        <span class="mono" id="ap-denom-diff">GH₵ 0.00</span>
      </div>
    </div>`;

  const okBtn = document.getElementById('m-conf-ok');
  okBtn.textContent = '✅ Confirm Approval';
  okBtn.className   = 'btn btn-gold';
  okBtn.onclick = () => confirmApproveWd(wdId, denomDef, cashToPay, totalDeduct);

  openModal('modal-confirm');
}

function calcApprovalDenoms(required) {
  const denomDef = [
    { id: 'ap200', value: 200 }, { id: 'ap100', value: 100 },
    { id: 'ap50',  value: 50  }, { id: 'ap20',  value: 20  },
    { id: 'ap10',  value: 10  }, { id: 'ap5',   value: 5   },
    { id: 'ap2',   value: 2   }, { id: 'ap1',   value: 1   },
    { id: 'ap050', value: 0.5 }, { id: 'ap020', value: 0.2 },
    { id: 'ap010', value: 0.1 }, { id: 'ap005', value: 0.05},
  ];
  let total = 0;
  denomDef.forEach(d => {
    const qty = parseFloat(document.getElementById(d.id)?.value) || 0;
    const sub = qty * d.value;
    total += sub;
    const t = document.getElementById(d.id + '-t');
    if (t) t.textContent = `= GH₵ ${sub.toFixed(2)}`;
  });
  const totalEl = document.getElementById('ap-denom-total');
  const diffEl  = document.getElementById('ap-denom-diff');
  if (totalEl) totalEl.textContent = fmt(total);
  if (diffEl) {
    const diff = total - required;
    diffEl.textContent = (diff >= 0 ? '+' : '') + fmt(Math.abs(diff));
    diffEl.style.color = diff === 0
      ? 'var(--success)' : diff > 0 ? 'var(--warning)' : 'var(--danger)';
  }
}


function confirmApproveWd(wdId, denomDef, cashToPay, totalDeduct) {
  const w = TELLER_STATE.withdrawals.find(x => x.id === wdId);
  if (!w) return;

  const receiver = document.getElementById('ap-receiver')?.value.trim();
  if (!receiver) { toast('Enter the name of the person receiving cash', 'error'); return; }

  // Cash at hand check is against cashToPay (physical notes), not commission
  if (cashAtHand() < cashToPay) {
    toast(`Insufficient cash at hand! Need ${fmt(cashToPay)} in cash`, 'error');
    return;
  }

  // Lock the confirm button immediately while processing
  const okBtn   = document.getElementById('m-conf-ok');
  const restore = btnLoader(okBtn, 'Approving...');

  showLoader('✅ Processing Withdrawal...', `Paying out ${fmt(cashToPay)} to ${receiver}`);

  setTimeout(() => {
    // Deduct full totalDeduct from customer balance (includes commission)
    if (w.type === 'customer_request') {
      const c = CUSTOMERS.find(x => x.id === w.custId);
      if (c) {
        c.balance = (c.balance || 0) - totalDeduct;
        if (!c.transactions) c.transactions = [];

        c.transactions.push({
          id: uid(), type: 'withdrawal',
          desc: `Withdrawal${w.reason ? ' — ' + w.reason : ''}${
            w.isRepresentative ? ' (via rep: ' + w.representative?.name + ')' : ''}`,
          amount: w.amount,
          balance: c.balance + (w.advanceAmount || 0) + (w.commissionAmount || 0),
          date: w.date, time: new Date().toISOString(),
          by: currentUser?.name || 'Teller'
        });

        if ((w.advanceAmount || 0) > 0) {
          c.transactions.push({
            id: uid(), type: 'advance',
            desc: 'Advance withdrawal deduction',
            amount: w.advanceAmount,
            balance: c.balance + (w.commissionAmount || 0),
            date: w.date, time: new Date().toISOString(),
            by: currentUser?.name || 'Teller'
          });
        }

        if ((w.commissionAmount || 0) > 0) {
          c.transactions.push({
            id: uid(), type: 'commission',
            desc: 'Commission deduction (not paid in cash)',
            amount: w.commissionAmount,
            balance: c.balance,
            date: w.date, time: new Date().toISOString(),
            by: currentUser?.name || 'Teller'
          });
        }

        sendSMS(c, 'withdrawal', {
          amount  : w.amount,   // SMS shows actual withdrawal, not commission
          balance : c.balance,
          receiver
        });
      }
    }

    // Build denomsUsed from the denomination input fields
    const denomsUsed = denomDef
      .map(d => ({
        label: d.label,
        value: d.value,
        qty  : parseFloat(document.getElementById(d.id)?.value) || 0,
      }))
      .filter(d => d.qty > 0);

    w.status        = 'paid';
    w.approvedAt    = new Date().toISOString();
    w.approvedBy    = currentUser?.name || 'Teller';
    w.receiver      = receiver;
    w.cashPaidOut   = cashToPay;          // physical cash only
    w.denominations = denomsUsed;

    hideLoader();
    restore();
    closeModal('modal-confirm');
    updateTellerStats();
    renderWdTab('pending');
    refreshFloatSummary();
    logActivity('Withdrawal', `Approved: ${w.name} (${w.acct})`, cashToPay, 'paid');
    saveAll();
    toast(`${fmt(cashToPay)} paid out — ${fmt(w.commissionAmount || 0)} commission deducted from account`, 'success');
  }, 600);
}


function openRejectWdModal(wdId) {
  document.getElementById('m-conf-title').textContent = '✕ Reject Withdrawal';
  document.getElementById('m-conf-body').innerHTML = `
    <div class="alert alert-warning mb-3">
      The customer's balance will not be affected.
    </div>
    <div class="form-group">
      <label class="form-label">Reason for Rejection</label>
      <input type="text" class="form-control" id="rej-reason"
        placeholder="e.g. Insufficient documentation, suspected fraud...">
    </div>`;
  const okBtn = document.getElementById('m-conf-ok');
  okBtn.textContent = '✕ Confirm Rejection';
  okBtn.className = 'btn btn-danger';
  okBtn.onclick = () => {
    const reason = document.getElementById('rej-reason')?.value.trim();
    if (!reason) { toast('Enter a reason for rejection', 'error'); return; }
    const w = TELLER_STATE.withdrawals.find(x => x.id === wdId);
    if (!w) return;
    w.status         = 'rejected';
    w.rejectedAt     = new Date().toISOString();
    w.rejectedBy     = currentUser?.name || 'Teller';
    w.rejectedReason = reason;
    closeModal('modal-confirm');
    renderWdTab('pending');
    updateTellerStats();
    saveAll();
    toast('Withdrawal request rejected', 'warning');
  };
  openModal('modal-confirm');
}

// ── Update renderWdTable to use new tab system ──
function renderWdTable() {
  renderWdTab(currentWdTab || 'pending');
  updateTellerStats();
}