// ═══════════════════════════════════════════════════════
//  THEME DEFINITIONS — all 7 themes with full variables
// ═══════════════════════════════════════════════════════
const THEMES = {
  dark: {
    '--bg':'#08122a','--surface':'#0e1d3e','--surface2':'#122348',
    '--border':'rgba(201,168,76,.18)','--border2':'rgba(201,168,76,.08)',
    '--text':'#e8dfc8','--text2':'#b8a878','--muted':'#6a5a3a',
    '--gold':'#c9a84c','--gold-light':'#e8c96a','--gold-dim':'rgba(201,168,76,.08)',
    '--success':'#2ecc8a','--danger':'#e85d5d','--warning':'#f0a500',
    '--info':'#4a90d9','--sidebar-bg':'#050e20','--sidebar-text':'#c9a84c',
    '--sidebar-active':'rgba(201,168,76,.15)','--sidebar-border':'rgba(201,168,76,.12)'
  },
  light: {
    '--bg':'#f0ede4','--surface':'#ffffff','--surface2':'#f5f2e8',
    '--border':'rgba(0,0,0,.12)','--border2':'rgba(0,0,0,.06)',
    '--text':'#1a1208','--text2':'#4a3a18','--muted':'#8a7a5a',
    '--gold':'#b8860b','--gold-light':'#a07010','--gold-dim':'rgba(184,134,11,.08)',
    '--success':'#1a8a4a','--danger':'#c0392b','--warning':'#d4890a',
    '--info':'#1a6ab8','--sidebar-bg':'#1a1208','--sidebar-text':'#e8c96a',
    '--sidebar-active':'rgba(184,134,11,.2)','--sidebar-border':'rgba(184,134,11,.2)'
  },
  ocean: {
    '--bg':'#061523','--surface':'#0a2035','--surface2':'#0e2d4a',
    '--border':'rgba(56,189,248,.18)','--border2':'rgba(56,189,248,.08)',
    '--text':'#e2f0ff','--text2':'#a0c0d8','--muted':'#4a7a9a',
    '--gold':'#38bdf8','--gold-light':'#7dd3fc','--gold-dim':'rgba(56,189,248,.08)',
    '--success':'#34d399','--danger':'#f87171','--warning':'#fbbf24',
    '--info':'#60a5fa','--sidebar-bg':'#030f1a','--sidebar-text':'#7dd3fc',
    '--sidebar-active':'rgba(56,189,248,.15)','--sidebar-border':'rgba(56,189,248,.12)'
  },
  forest: {
    '--bg':'#061208','--surface':'#0a1f0d','--surface2':'#0e2e12',
    '--border':'rgba(74,222,128,.18)','--border2':'rgba(74,222,128,.08)',
    '--text':'#e2ffe8','--text2':'#a0d8b0','--muted':'#4a7a5a',
    '--gold':'#4ade80','--gold-light':'#86efac','--gold-dim':'rgba(74,222,128,.08)',
    '--success':'#34d399','--danger':'#f87171','--warning':'#fbbf24',
    '--info':'#60a5fa','--sidebar-bg':'#030a04','--sidebar-text':'#86efac',
    '--sidebar-active':'rgba(74,222,128,.15)','--sidebar-border':'rgba(74,222,128,.12)'
  },
  sunset: {
    '--bg':'#150a06','--surface':'#251208','--surface2':'#351a0e',
    '--border':'rgba(251,146,60,.18)','--border2':'rgba(251,146,60,.08)',
    '--text':'#fff1e6','--text2':'#d8b090','--muted':'#8a5a3a',
    '--gold':'#fb923c','--gold-light':'#fdba74','--gold-dim':'rgba(251,146,60,.08)',
    '--success':'#34d399','--danger':'#f87171','--warning':'#fbbf24',
    '--info':'#60a5fa','--sidebar-bg':'#0a0503','--sidebar-text':'#fdba74',
    '--sidebar-active':'rgba(251,146,60,.15)','--sidebar-border':'rgba(251,146,60,.12)'
  },
  royal: {
    '--bg':'#0e0615','--surface':'#180a25','--surface2':'#220f35',
    '--border':'rgba(168,85,247,.18)','--border2':'rgba(168,85,247,.08)',
    '--text':'#f0e8ff','--text2':'#c0a8e0','--muted':'#6a4a8a',
    '--gold':'#a855f7','--gold-light':'#c084fc','--gold-dim':'rgba(168,85,247,.08)',
    '--success':'#34d399','--danger':'#f87171','--warning':'#fbbf24',
    '--info':'#60a5fa','--sidebar-bg':'#07030e','--sidebar-text':'#c084fc',
    '--sidebar-active':'rgba(168,85,247,.15)','--sidebar-border':'rgba(168,85,247,.12)'
  },
  midnight: {
    '--bg':'#020408','--surface':'#060c14','--surface2':'#0a1420',
    '--border':'rgba(6,182,212,.18)','--border2':'rgba(6,182,212,.08)',
    '--text':'#e0f8ff','--text2':'#80c8d8','--muted':'#3a7080',
    '--gold':'#06b6d4','--gold-light':'#22d3ee','--gold-dim':'rgba(6,182,212,.08)',
    '--success':'#34d399','--danger':'#f87171','--warning':'#fbbf24',
    '--info':'#60a5fa','--sidebar-bg':'#010204','--sidebar-text':'#22d3ee',
    '--sidebar-active':'rgba(6,182,212,.15)','--sidebar-border':'rgba(6,182,212,.12)'
  }
};

// ── Apply theme — injects CSS variables directly into :root ──
function applyTheme(theme) {
  SETTINGS.theme = theme;
  const vars = THEMES[theme] || THEMES.dark;

  // Inject as :root overrides via a <style> tag
  let styleTag = document.getElementById('psb-theme-vars');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'psb-theme-vars';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = ':root{' +
    Object.entries(vars).map(([k,v]) => `${k}:${v}`).join(';') +
  '}';

  // Also set data-theme for any remaining static selectors
  document.documentElement.setAttribute('data-theme', theme);

  // Update theme toggle button
  const icons = {
    dark:'🌙', light:'☀️', ocean:'🌊', forest:'🌿',
    sunset:'🌅', royal:'👑', midnight:'🌃'
  };
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = icons[theme] || '🎨';

  syncThemeCards();
}

function syncThemeCards() {
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.dataset.theme === (SETTINGS.theme || 'dark'));
  });
}

function selectTheme(theme) {
  applyTheme(theme);
  SETTINGS.theme = theme;
  saveAll();
  toast(`Theme changed to ${theme} ✅`, 'success');
}

function toggleTheme() {
  const order = ['dark','light','ocean','forest','sunset','royal','midnight'];
  const idx = order.indexOf(SETTINGS.theme || 'dark');
  selectTheme(order[(idx + 1) % order.length]);
}


// ── Brand color ──
function applyBrandColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  SETTINGS.brandColor = hex;
  document.documentElement.style.setProperty('--gold', hex);

  // Derive lighter version
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const lighter = `rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)})`;
  document.documentElement.style.setProperty('--gold-light', lighter);
  document.documentElement.style.setProperty('--gold-dim', `rgba(${r},${g},${b},0.08)`);

  const bt = document.getElementById('st-brand-color-text');
  const bc = document.getElementById('st-brand-color');
  if (bt) bt.value = hex;
  if (bc) bc.value = hex;
}