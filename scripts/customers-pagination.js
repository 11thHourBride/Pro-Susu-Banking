// ═══════════════════════════════════════════════════════
//  CUSTOMERS — PAGINATION PATCH
//  Adds 20-per-page pagination to the customer list.
//
//  HOW TO APPLY:
//    Add ONE line to index.html AFTER customers.js:
//      <script src="scripts/customers-pagination.js"></script>
//
//  This file redefines renderCustomerList() and adds
//  three helpers: setCustPage(), _renderCustPager(),
//  and _buildCustRows(). No other files need changing.
// ═══════════════════════════════════════════════════════

const CUST_PAGE_SIZE = 20;
let   CUST_PAGE      = 1;

// Track last search/filter so we can reset to page 1 on change
let _custLastSearch = '';
let _custLastAgent  = '';

// ── Jump to a page and re-render ─────────────────────
function setCustPage(n) {
  CUST_PAGE = n;
  const search = document.getElementById('cust-search')?.value || '';
  renderCustomerList(search, true);   // true = keep current page
}

// ── Main list renderer (replaces the one in customers.js) ──
function renderCustomerList(search, keepPage) {
  const tb = document.getElementById('cust-tbody'); if (!tb) return;

  const isAgent      = currentUser?.role === 'agent';
  const agentFilterEl = document.getElementById('cu-agent-filter');
  const agentFilterVal = isAgent ? '' : (agentFilterEl?.value || '');

  // Reset to page 1 whenever search or agent filter changes
  if (!keepPage ||
      search        !== _custLastSearch ||
      agentFilterVal !== _custLastAgent) {
    CUST_PAGE = 1;
  }
  _custLastSearch = search        || '';
  _custLastAgent  = agentFilterVal || '';

  // ── Tab visibility ────────────────────────────────
  const delTab = document.getElementById('cu-deleted-tab');
  if (delTab) delTab.style.display = (currentUser?.role === 'admin') ? '' : 'none';
  const expTab = document.getElementById('cu-exportimport-tab');
  if (expTab) expTab.style.display = (currentUser?.role === 'admin') ? '' : 'none';
  const mdTab  = document.getElementById('cu-manualdeposits-tab');
  if (mdTab)  mdTab.style.display  = (currentUser?.role === 'admin') ? '' : 'none';

  const allTab = document.querySelector('#view-customers .sub-tab[onclick*="\'list\'"]');
  if (allTab) allTab.style.display = isAgent ? 'none' : '';

  if (typeof updateDormantBadge === 'function') updateDormantBadge();

  // ── Populate agent filter dropdown ────────────────
  if (agentFilterEl && !isAgent) {
    const currentVal = agentFilterEl.value;
    agentFilterEl.innerHTML =
      '<option value="">👥 All Agents</option>' +
      '<option value="__none__">⚠️ No Agent Assigned</option>' +
      AGENTS.filter(a => a.status === 'active')
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(a =>
          `<option value="${a.id}" ${currentVal === a.id ? 'selected' : ''}>
            ${a.code} — ${a.firstName} ${a.lastName}
          </option>`)
        .join('');
    if (currentVal) agentFilterEl.value = currentVal;
  }
  if (agentFilterEl) agentFilterEl.style.display = isAgent ? 'none' : '';

  // ── Session agent (for agent role) ───────────────
  const sessionAgent = isAgent && typeof _getSessionAgent === 'function'
    ? _getSessionAgent() : null;

  // ── Badge counts ──────────────────────────────────
  const sb   = document.getElementById('cu-susu-badge');
  const lb   = document.getElementById('cu-ld-badge');
  const svb  = document.getElementById('cu-sav-badge');
  const base = isAgent && sessionAgent
    ? CUSTOMERS.filter(c => c.agentId === sessionAgent.id)
    : CUSTOMERS;
  if (sb)  sb.textContent  = base.filter(c => c.type === 'susu').length    + ' Susu';
  if (lb)  lb.textContent  = base.filter(c => c.type === 'lending').length + ' Lending';
  if (svb) svb.textContent = base.filter(c => c.type === 'savings').length + ' Savings';

  // ── Unassigned-customers button ───────────────────
  const noAgentCount = CUSTOMERS.filter(c => !c.agentId).length;
  const assignBtn = document.getElementById('cu-assign-noagent-btn');
  if (assignBtn) {
    assignBtn.style.display = (noAgentCount > 0 && !isAgent) ? '' : 'none';
    assignBtn.textContent   = `🔗 Assign Unassigned (${noAgentCount})`;
  }

  // ── Build full filtered list ──────────────────────
  let list = isAgent && sessionAgent
    ? CUSTOMERS.filter(c => c.agentId === sessionAgent.id)
    : CUSTOMERS;

  if (agentFilterVal === '__none__') {
    list = list.filter(c => !c.agentId);
  } else if (agentFilterVal) {
    list = list.filter(c => c.agentId === agentFilterVal);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(c =>
      `${c.firstName} ${c.lastName} ${c.acctNumber}`.toLowerCase().includes(q));
  }

  // ── Empty state ───────────────────────────────────
  if (!list.length) {
    const msg = agentFilterVal === '__none__'
      ? 'No customers without an agent'
      : agentFilterVal ? 'No customers found for this agent'
      : 'No customers found';
    tb.innerHTML = `<tr><td colspan="9" class="text-center text-muted"
      style="padding:28px">${msg}</td></tr>`;
    // Hide pager if visible
    const pager = document.getElementById('cust-pager');
    if (pager) pager.innerHTML = '';
    const info  = document.getElementById('cust-pager-info');
    if (info)  info.textContent = '';
    return;
  }

  // ── Pagination slice ──────────────────────────────
  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CUST_PAGE_SIZE));
  if (CUST_PAGE > totalPages) CUST_PAGE = totalPages;
  const startIdx = (CUST_PAGE - 1) * CUST_PAGE_SIZE;
  const endIdx   = Math.min(startIdx + CUST_PAGE_SIZE, totalCount);
  const pageList = list.slice(startIdx, endIdx);

  // ── Render table rows ─────────────────────────────
  tb.innerHTML = pageList.map((c, i) => {
    const agent      = AGENTS.find(a => a.id === c.agentId);
    const typeColors = { susu: 'b-gold', lending: 'b-blue', savings: 'b-green' };
    const rowNum     = startIdx + i + 1;

    const avatarHTML = c.photo
      ? `<img src="${c.photo}" onclick="openCustomerModal('${c.id}')"
           style="width:32px;height:32px;border-radius:50%;object-fit:cover;
             border:2px solid var(--gold);cursor:pointer;vertical-align:middle;
             margin-right:7px" title="View customer">`
      : `<span onclick="openCustomerModal('${c.id}')"
           style="display:inline-flex;width:32px;height:32px;border-radius:50%;
             background:linear-gradient(135deg,var(--gold),#a8851c);
             align-items:center;justify-content:center;font-size:.7rem;
             font-weight:700;color:#08142a;cursor:pointer;vertical-align:middle;
             margin-right:7px" title="View customer">
           ${c.firstName[0]}${c.lastName[0]}
         </span>`;

    return `<tr>
      <td class="text-muted">${rowNum}</td>
      <td class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</td>
      <td class="fw-600">
        ${avatarHTML}<span onclick="openCustomerModal('${c.id}')"
          style="cursor:pointer;vertical-align:middle"
          title="View customer">${c.firstName} ${c.lastName}</span>
      </td>
      <td><span class="badge ${typeColors[c.type]}">${c.type}</span></td>
      <td>${agent ? agent.firstName + ' ' + agent.lastName : '—'}</td>
      <td style="font-size:.82rem">${c.phone || '—'}</td>
      <td class="mono">${fmt(c.balance || 0)}</td>
      <td><span class="badge ${c.status === 'active' ? 'b-green' : 'b-gray'}">${c.status}</span></td>
      <td>
        <button class="btn btn-gold btn-xs" onclick="openCustomerModal('${c.id}')">View</button>
        <button class="btn btn-info btn-xs" onclick="openEditCustomerModal('${c.id}')">✏️ Edit</button>
        <button class="btn btn-outline btn-xs" onclick="openCustomerTxn('${c.id}')">Txns</button>
        ${currentUser?.role !== 'agent'
          ? `<button class="btn btn-danger btn-xs" onclick="softDeleteCustomer('${c.id}')">🗑</button>`
          : ''}
      </td>
    </tr>`;
  }).join('');

  // ── Pagination controls ───────────────────────────
  _renderCustPager(totalPages, totalCount, startIdx + 1, endIdx);
}

// ── Build and inject the pager UI ────────────────────
function _renderCustPager(totalPages, totalCount, from, to) {
  // Pager lives in a div below the table — create it once
  let pager = document.getElementById('cust-pager');
  let info  = document.getElementById('cust-pager-info');

  if (!pager) {
    const tableWrap = document.querySelector('#cu-list .table-wrap');
    if (!tableWrap) return;

    // Info bar (above pager)
    info = document.createElement('div');
    info.id = 'cust-pager-info';
    info.style.cssText =
      'font-size:.76rem;color:var(--muted);text-align:center;padding:6px 0 2px';
    tableWrap.after(info);

    // Pager row
    pager = document.createElement('div');
    pager.id = 'cust-pager';
    pager.style.cssText =
      'display:flex;justify-content:center;align-items:center;' +
      'gap:5px;padding:12px 0 4px;flex-wrap:wrap';
    info.after(pager);
  }

  // Info text
  info.textContent = totalPages <= 1
    ? `${totalCount} customer${totalCount !== 1 ? 's' : ''}`
    : `Showing ${from}–${to} of ${totalCount} customers`;

  // Hide pager if only one page
  if (totalPages <= 1) { pager.innerHTML = ''; return; }

  // Build page number list with ellipsis
  const pages = _custPageNumbers(CUST_PAGE, totalPages);

  const btnBase =
    'border:1px solid var(--border);border-radius:7px;' +
    'padding:5px 11px;font-size:.78rem;cursor:pointer;' +
    'background:var(--surface);color:var(--text);transition:all .15s;min-width:34px;text-align:center';
  const btnActive =
    'background:var(--gold);color:#08142a;border-color:var(--gold);font-weight:700';
  const btnDisabled =
    'opacity:.35;cursor:default;pointer-events:none';

  pager.innerHTML =
    // ← Prev
    `<button style="${btnBase}${CUST_PAGE === 1 ? ';' + btnDisabled : ''}"
       onclick="setCustPage(${CUST_PAGE - 1})" title="Previous page">←</button>` +

    // Page buttons / ellipsis
    pages.map(p =>
      p === '…'
        ? `<span style="padding:5px 4px;color:var(--muted);font-size:.76rem">…</span>`
        : `<button style="${btnBase}${p === CUST_PAGE ? ';' + btnActive : ''}"
             onclick="setCustPage(${p})">${p}</button>`
    ).join('') +

    // Next →
    `<button style="${btnBase}${CUST_PAGE === totalPages ? ';' + btnDisabled : ''}"
       onclick="setCustPage(${CUST_PAGE + 1})" title="Next page">→</button>` +

    // Jump-to-page input (shown when > 7 pages)
    (totalPages > 7
      ? `<span style="margin-left:8px;font-size:.76rem;color:var(--muted)">Go to</span>
         <input type="number" min="1" max="${totalPages}"
           style="width:54px;padding:4px 7px;border:1px solid var(--border);
             border-radius:7px;background:var(--surface);color:var(--text);
             font-size:.78rem;text-align:center"
           placeholder="${CUST_PAGE}"
           onkeydown="if(event.key==='Enter'){
             const n=parseInt(this.value);
             if(n>=1&&n<=${totalPages})setCustPage(n);}">`
      : '');
}

// ── Page-number array with ellipsis logic ─────────────
// Always shows: first, last, current ± 2, and … gaps.
function _custPageNumbers(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, cur, cur - 1, cur - 2, cur + 1, cur + 2]
    .filter(p => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}
