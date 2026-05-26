// ═══════════════════════════════════════════════════════
//  REPORTS FIX — reports-fix.js  (v2)
//  Fixes two distinct problems:
//
//  1. showReportTab() — the dispatcher called by every
//     sub-tab button and by showView() — was never defined.
//
//  2. Seven helper functions called by the render*Report()
//     functions in general.js were never defined:
//       getLast12Months, getThisMonth, txnsInMonth,
//       collsInMonth, buildBarChart, buildStackedBar,
//       isOverdue
//
//  HOW TO APPLY:
//    1. Copy this file into your scripts/ folder.
//    2. In index.html, add ONE line after general.js:
//         <script src="scripts/reports-fix.js"></script>
// ═══════════════════════════════════════════════════════


// ── 1. DATE / PERIOD HELPERS ──────────────────────────

/**
 * Returns the current month as 'YYYY-MM'.
 */
function getThisMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Returns an array of the last 12 months (oldest first),
 * each as { key: 'YYYY-MM', label: 'Mon YYYY' }.
 */
function getLast12Months() {
  const months = [];
  const now    = new Date();
  for (let i = 11; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const lbl = d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' });
    months.push({ key, label: lbl });
  }
  return months;
}

/**
 * Returns true if dueDate is strictly before today.
 */
function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(todayISO());
}


// ── 2. DATA AGGREGATION HELPERS ───────────────────────

/**
 * Returns all customer transactions whose date falls in
 * the given month key ('YYYY-MM').
 * Transactions are expected to have a `date` field.
 */
function txnsInMonth(month) {
  const result = [];
  CUSTOMERS.forEach(c => {
    (c.transactions || []).forEach(t => {
      const d = (t.date || t.time || '').slice(0, 7);
      if (d === month) result.push(t);
    });
  });
  return result;
}

/**
 * Returns TELLER_STATE.collections that fall in the
 * given month key ('YYYY-MM').
 */
function collsInMonth(monthKey) {
  return (TELLER_STATE.collections || []).filter(c => {
    const d = (c.collectionDate || c.time || '').slice(0, 7);
    return d === monthKey;
  });
}


// ── 3. CHART BUILDERS ─────────────────────────────────

/**
 * Builds a vertical bar chart as an HTML string.
 *
 * @param {Array<{label:string, value:number}>} data
 * @param {Function|string} colorFn  Called with each datum; returns a CSS color string.
 *                                   Or pass a plain string for a fixed color.
 * @returns {string} HTML
 */
function buildBarChart(data, colorFn) {
  if (!data || !data.length) return '<div class="text-muted" style="padding:16px;font-size:.8rem">No data</div>';

  const max = Math.max(...data.map(d => d.value), 1);

  const bars = data.map(d => {
    const pct   = Math.max(Math.round((d.value / max) * 100), d.value > 0 ? 2 : 0);
    const color = typeof colorFn === 'function' ? colorFn(d) : (colorFn || 'rgba(201,168,76,.7)');
    return `
      <div class="bar-col" style="flex:1;display:flex;flex-direction:column;
        align-items:center;justify-content:flex-end;height:100%;gap:3px;min-width:0">
        <div style="width:100%;height:${pct}%;background:${color};
          border-radius:3px 3px 0 0;min-height:${d.value > 0 ? 2 : 0}px;
          transition:height .3s ease"
          title="${d.label}: ${typeof fmt === 'function' ? fmt(d.value) : d.value}">
        </div>
        <div style="font-size:.58rem;color:var(--muted);text-align:center;
          width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          padding:0 1px"
          title="${d.label}">${d.label}</div>
      </div>`;
  }).join('');

  return `<div style="display:flex;align-items:flex-end;gap:3px;
    height:160px;padding:0 2px">${bars}</div>`;
}

/**
 * Builds a grouped / stacked bar chart comparing deposits vs withdrawals.
 *
 * @param {number[]} depData   Deposit amounts, one per label
 * @param {number[]} wdData    Withdrawal amounts, one per label
 * @param {string[]} labels    Month labels, parallel to depData/wdData
 * @returns {string} HTML
 */
function buildStackedBar(depData, wdData, labels) {
  if (!labels || !labels.length) return '<div class="text-muted" style="padding:16px;font-size:.8rem">No data</div>';

  const max = Math.max(...depData.map((v, i) => v + (wdData[i] || 0)), 1);

  const bars = labels.map((lbl, i) => {
    const dep    = depData[i] || 0;
    const wd     = wdData[i]  || 0;
    const depPct = Math.round((dep / max) * 100);
    const wdPct  = Math.round((wd  / max) * 100);
    const fmtFn  = typeof fmt === 'function' ? fmt : v => v;

    return `
      <div style="flex:1;display:flex;flex-direction:column;
        align-items:center;justify-content:flex-end;height:100%;gap:2px;min-width:0">
        <div style="width:100%;display:flex;flex-direction:column;
          justify-content:flex-end;height:calc(100% - 18px);gap:1px">
          <div style="width:100%;height:${wdPct}%;background:rgba(232,93,93,.7);
            min-height:${wd > 0 ? 2 : 0}px;border-radius:2px 2px 0 0"
            title="${lbl} Withdrawals: ${fmtFn(wd)}"></div>
          <div style="width:100%;height:${depPct}%;background:rgba(46,204,138,.75);
            min-height:${dep > 0 ? 2 : 0}px"
            title="${lbl} Deposits: ${fmtFn(dep)}"></div>
        </div>
        <div style="font-size:.58rem;color:var(--muted);text-align:center;
          width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          padding:0 1px" title="${lbl}">${lbl}</div>
      </div>`;
  }).join('');

  return `<div style="display:flex;align-items:flex-end;gap:3px;
    height:160px;padding:0 2px">${bars}</div>`;
}


// ── 4. REPORT TAB DISPATCHER ──────────────────────────

/** Map of tab keys to their render functions. */
const _REPORT_RENDERERS = {
  overview    : () => { if (typeof renderOverviewReport    === 'function') renderOverviewReport(); },
  performance : () => { if (typeof renderPerformanceReport === 'function') renderPerformanceReport(); },
  financial   : () => { if (typeof renderFinancialReport   === 'function') renderFinancialReport(); },
  customers   : () => { if (typeof renderCustomersReport   === 'function') renderCustomersReport(); },
  loans       : () => { if (typeof renderLoanReport        === 'function') renderLoanReport(); },
  agents      : () => { if (typeof renderAgentReport       === 'function') renderAgentReport(); },
  gcsca       : () => { if (typeof renderGCSCAReport       === 'function') renderGCSCAReport(); },
};

/**
 * showReportTab(tab, btn)
 * Hides all .rpt-panel elements, reveals the chosen one,
 * marks the clicked sub-tab button active, then calls the
 * matching render function.
 */
function showReportTab(tab, btn) {
  // Hide every report panel
  document.querySelectorAll('.rpt-panel').forEach(p => p.classList.add('hidden'));

  // Show the target panel
  const panel = document.getElementById('rpt-' + tab);
  if (panel) panel.classList.remove('hidden');

  // Activate the clicked sub-tab button
  if (btn) {
    document.querySelectorAll('#reports-subtabs .sub-tab')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  // Call the render function
  const renderer = _REPORT_RENDERERS[tab];
  if (renderer) {
    try {
      renderer();
    } catch (e) {
      console.error('showReportTab render error [' + tab + ']:', e);
    }
  }
}
