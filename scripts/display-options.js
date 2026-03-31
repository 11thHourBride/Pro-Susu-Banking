// ═══════════════════════════════════════════════════════
//  DISPLAY OPTIONS
// ═══════════════════════════════════════════════════════
function applyFontSize(size) {
  const px = parseInt(size) || 14;
  SETTINGS.fontSize = String(px);
  document.documentElement.style.fontSize = px + 'px';
}

function applyCompact(on) {
  SETTINGS.compact = !!on;
  document.body.classList.toggle('compact', !!on);
  // Inject compact styles if not already present
  let ct = document.getElementById('psb-compact-style');
  if (!ct) {
    ct = document.createElement('style');
    ct.id = 'psb-compact-style';
    document.head.appendChild(ct);
  }
  ct.textContent = on ? `
    .card { padding: 10px 12px !important; }
    .form-group { margin-bottom: 8px !important; }
    .stats-grid { gap: 8px !important; }
    .nav-item { padding: 7px 16px !important; }
    .page-content { padding: 12px !important; }
    .modal { padding: 16px !important; }
  ` : '';
}

function applySidebarStyle(style) {
  SETTINGS.sidebarStyle = style;
  document.querySelectorAll('.nav-item').forEach(el => {
    const icon = el.querySelector('.nav-icon');
    if (!icon) return;
    if (style === 'icons') {
      // Hide text, keep only icon
      el.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
      });
      el.title = el.textContent.trim(); // tooltip
      el.style.justifyContent = 'center';
    } else {
      // Restore — re-apply language to fill text back
      el.style.justifyContent = '';
      applyLanguage(SETTINGS.language || 'en');
    }
  });
}

// ── Brand colour ──
function applyBrandColor(hex) {
  if (!hex || hex.length < 4) return;
  SETTINGS.brandColor = hex;

  let styleTag = document.getElementById('psb-brand-color');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'psb-brand-color';
    document.head.appendChild(styleTag);
  }
  // Parse hex → rgb for rgba() usage
  let r=201,g=168,b=76;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    r = parseInt(hex.slice(1,3),16);
    g = parseInt(hex.slice(3,5),16);
    b = parseInt(hex.slice(5,7),16);
  }
  const light  = `rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)})`;
  const dim    = `rgba(${r},${g},${b},0.08)`;

  styleTag.textContent = `:root{
    --gold:${hex};
    --gold-light:${light};
    --gold-dim:${dim};
  }`;

  // Sync colour inputs
  const bc = document.getElementById('st-brand-color');
  const bt = document.getElementById('st-brand-color-text');
  if (bc && bc.value !== hex) bc.value = hex;
  if (bt && bt.value !== hex) bt.value = hex;
}

// ── Company name / sidebar header ──
function updateBrandNames() {
  const val = document.getElementById('st-sidebar-header')?.value
    || SETTINGS.sidebarHeader || SETTINGS.companyName || 'Pro Susu Banking';
  SETTINGS.sidebarHeader = val;

  document.querySelectorAll('.brand-name, #sb-company-name').forEach(el => {
    el.textContent = val;
  });

  const bpn = document.getElementById('brand-preview-name');
  if (bpn) bpn.textContent = val;

  const bpt = document.getElementById('brand-preview-tagline');
  if (bpt) bpt.textContent = SETTINGS.tagline || '';

  const titleEl = document.querySelector('.login-title, #login-company-name');
  if (titleEl) titleEl.textContent = val;
}