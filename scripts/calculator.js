// ═══════════════════════════════════════════════════════
//  CALCULATOR MODULE — Pro Susu Banking
// ═══════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────
  const S = {
    section    : 'calculator', // calculator | converter | history | memory | settings
    calcMode   : 'standard',   // standard | scientific | graphing | programmer | date
    convMode   : 'currency',
    // Calculator state
    expr       : '',           // expression string shown above
    input      : '0',          // current number being typed
    result     : null,         // last computed result
    justEvaled : false,        // did we just press =
    operand    : null,         // stored left-hand value
    operator   : null,         // pending operator
    // Memory slots (array of numbers)
    memory     : [],
    // History (array of {expr, val})
    history    : [],
    // Settings
    show00     : true,         // show 00/000 hold feature
    theme      : 'dark',       // for future light mode
    // Programmer mode
    progBase   : 16,           // HEX | DEC | OCT | BIN
    // Long-press for 00/000
    lpTimer    : null,
    lpStart    : null,
  };

  // ── Converter data tables ─────────────────────────
  const CONV = {
    currency: {
      units: ['GHS','USD','EUR','GBP','NGN','KES','ZAR','XOF','GHC'],
      // Rates relative to GHS (Ghana Cedi) — approximate
      rates: { GHS:1, USD:0.069, EUR:0.063, GBP:0.054, NGN:113, KES:9.05, ZAR:1.29, XOF:41.3, GHC:1 }
    },
    volume: {
      units: ['Litre','Millilitre','Gallon (US)','Pint (US)','Cup','Fl Oz','Cubic Metre','Tablespoon','Teaspoon'],
      toBase: { 'Litre':1, 'Millilitre':0.001, 'Gallon (US)':3.78541, 'Pint (US)':0.473176, 'Cup':0.236588, 'Fl Oz':0.0295735, 'Cubic Metre':1000, 'Tablespoon':0.0147868, 'Teaspoon':0.00492892 }
    },
    length: {
      units: ['Metre','Kilometre','Mile','Yard','Foot','Inch','Centimetre','Millimetre','Nautical Mile'],
      toBase: { 'Metre':1, 'Kilometre':1000, 'Mile':1609.34, 'Yard':0.9144, 'Foot':0.3048, 'Inch':0.0254, 'Centimetre':0.01, 'Millimetre':0.001, 'Nautical Mile':1852 }
    },
    weight: {
      units: ['Kilogram','Gram','Pound','Ounce','Tonne','Milligram','Stone','Carat'],
      toBase: { 'Kilogram':1, 'Gram':0.001, 'Pound':0.453592, 'Ounce':0.0283495, 'Tonne':1000, 'Milligram':0.000001, 'Stone':6.35029, 'Carat':0.0002 }
    },
    temperature: {
      units: ['Celsius','Fahrenheit','Kelvin'],
      // Special conversion — handled separately
    },
    energy: {
      units: ['Joule','Kilojoule','Calorie','Kilocalorie','Watt-hour','kWh','BTU','Electronvolt'],
      toBase: { 'Joule':1, 'Kilojoule':1000, 'Calorie':4.184, 'Kilocalorie':4184, 'Watt-hour':3600, 'kWh':3600000, 'BTU':1055.06, 'Electronvolt':1.602e-19 }
    },
    area: {
      units: ['Square Metre','Square Kilometre','Hectare','Acre','Square Mile','Square Foot','Square Inch','Square Yard'],
      toBase: { 'Square Metre':1, 'Square Kilometre':1e6, 'Hectare':1e4, 'Acre':4046.86, 'Square Mile':2589988, 'Square Foot':0.092903, 'Square Inch':0.00064516, 'Square Yard':0.836127 }
    },
    speed: {
      units: ['m/s','km/h','mph','Knot','ft/s','Mach'],
      toBase: { 'm/s':1, 'km/h':0.277778, 'mph':0.44704, 'Knot':0.514444, 'ft/s':0.3048, 'Mach':343 }
    },
    time: {
      units: ['Second','Minute','Hour','Day','Week','Month','Year','Millisecond','Microsecond'],
      toBase: { 'Second':1, 'Minute':60, 'Hour':3600, 'Day':86400, 'Week':604800, 'Month':2629800, 'Year':31557600, 'Millisecond':0.001, 'Microsecond':0.000001 }
    },
    power: {
      units: ['Watt','Kilowatt','Megawatt','Horsepower','BTU/hr','Calorie/sec'],
      toBase: { 'Watt':1, 'Kilowatt':1000, 'Megawatt':1e6, 'Horsepower':745.7, 'BTU/hr':0.293071, 'Calorie/sec':4.184 }
    },
    data: {
      units: ['Byte','Kilobyte','Megabyte','Gigabyte','Terabyte','Petabyte','Bit','Kilobit','Megabit','Gigabit'],
      toBase: { 'Byte':1, 'Kilobyte':1024, 'Megabyte':1048576, 'Gigabyte':1073741824, 'Terabyte':1099511627776, 'Petabyte':1.126e15, 'Bit':0.125, 'Kilobit':128, 'Megabit':131072, 'Gigabit':134217728 }
    },
    pressure: {
      units: ['Pascal','Bar','PSI','Atmosphere','mmHg','Torr','kPa'],
      toBase: { 'Pascal':1, 'Bar':100000, 'PSI':6894.76, 'Atmosphere':101325, 'mmHg':133.322, 'Torr':133.322, 'kPa':1000 }
    },
    angle: {
      units: ['Degree','Radian','Gradian','Turn','Arcminute','Arcsecond'],
      toBase: { 'Degree':1, 'Radian':180/Math.PI, 'Gradian':0.9, 'Turn':360, 'Arcminute':1/60, 'Arcsecond':1/3600 }
    }
  };

  // ── Build the Panel HTML ──────────────────────────
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'calc-panel';
    panel.innerHTML = `
      <div class="calc-header">
        <span class="calc-header-title">⌨️ Calculator</span>
        <button class="calc-close" onclick="calcClose()" title="Close">✕</button>
      </div>

      <!-- Section tabs -->
      <div class="calc-section-tabs">
        <button class="calc-stab active" onclick="calcSection('calculator',this)">Calculator</button>
        <button class="calc-stab" onclick="calcSection('converter',this)">Converter</button>
        <button class="calc-stab" onclick="calcSection('history',this)">History</button>
        <button class="calc-stab" onclick="calcSection('memory',this)">Memory</button>
        <button class="calc-stab" onclick="calcSection('settings',this)">Settings</button>
      </div>

      <!-- ── CALCULATOR ─────────────────────────── -->
      <div id="calc-sec-calculator" class="calc-view active">
        <div class="calc-subtabs">
          <button class="calc-subtab active" onclick="calcMode('standard',this)">Standard</button>
          <button class="calc-subtab" onclick="calcMode('scientific',this)">Scientific</button>
          <button class="calc-subtab" onclick="calcMode('graphing',this)">Graphing</button>
          <button class="calc-subtab" onclick="calcMode('programmer',this)">Programmer</button>
          <button class="calc-subtab" onclick="calcMode('date',this)">Date</button>
        </div>

        <!-- Display -->
        <div class="calc-display">
          <div class="calc-memory-indicator" id="calc-mem-ind"></div>
          <div class="calc-expr" id="calc-expr"></div>
          <div class="calc-result" id="calc-result">0</div>
        </div>

        <!-- ── Standard ── -->
        <div id="calc-std" class="calc-view active">
          <div class="calc-keys calc-keys-4">
            <button class="calc-key mem" onclick="calcMemory('mc')">MC</button>
            <button class="calc-key mem" onclick="calcMemory('mr')">MR</button>
            <button class="calc-key mem" onclick="calcMemory('ms')">MS</button>
            <button class="calc-key mem" onclick="calcMemory('m+')">M+</button>
            <button class="calc-key ac" onclick="calcAC()">AC</button>
            <button class="calc-key ac" onclick="calcDel()">⌫</button>
            <button class="calc-key op" onclick="calcOp('%')">%</button>
            <button class="calc-key op" onclick="calcOp('/')">÷</button>
            <button class="calc-key num" onclick="calcNum('7')">7</button>
            <button class="calc-key num" onclick="calcNum('8')">8</button>
            <button class="calc-key num" onclick="calcNum('9')">9</button>
            <button class="calc-key op" onclick="calcOp('×')">×</button>
            <button class="calc-key num" onclick="calcNum('4')">4</button>
            <button class="calc-key num" onclick="calcNum('5')">5</button>
            <button class="calc-key num" onclick="calcNum('6')">6</button>
            <button class="calc-key op" onclick="calcOp('-')">−</button>
            <button class="calc-key num" onclick="calcNum('1')">1</button>
            <button class="calc-key num" onclick="calcNum('2')">2</button>
            <button class="calc-key num" onclick="calcNum('3')">3</button>
            <button class="calc-key op" onclick="calcOp('+')">+</button>
            <button class="calc-key num" onclick="calcNeg()">+/−</button>
            <button class="calc-key num zero-hold"
              onmousedown="lpStart(event)" onmouseup="lpEnd()" ontouchstart="lpStart(event)" ontouchend="lpEnd()"
              onclick="calcNum('0')">0<span class="hold-hint">00/000</span></button>
            <button class="calc-key num" onclick="calcDot()">.</button>
            <button class="calc-key eq" onclick="calcEval()">=</button>
          </div>
        </div>

        <!-- ── Scientific ── -->
        <div id="calc-sci" class="calc-view">
          <div class="calc-keys calc-keys-5">
            <button class="calc-key fn" onclick="calcSci('sin')">sin</button>
            <button class="calc-key fn" onclick="calcSci('cos')">cos</button>
            <button class="calc-key fn" onclick="calcSci('tan')">tan</button>
            <button class="calc-key fn" onclick="calcSci('log')">log</button>
            <button class="calc-key fn" onclick="calcSci('ln')">ln</button>
            <button class="calc-key fn" onclick="calcSci('asin')">sin⁻¹</button>
            <button class="calc-key fn" onclick="calcSci('acos')">cos⁻¹</button>
            <button class="calc-key fn" onclick="calcSci('atan')">tan⁻¹</button>
            <button class="calc-key fn" onclick="calcSci('sqrt')">√</button>
            <button class="calc-key fn" onclick="calcSci('cbrt')">∛</button>
            <button class="calc-key fn" onclick="calcSci('sq')">x²</button>
            <button class="calc-key fn" onclick="calcSci('cube')">x³</button>
            <button class="calc-key fn" onclick="calcSci('inv')">1/x</button>
            <button class="calc-key fn" onclick="calcSci('exp')">eˣ</button>
            <button class="calc-key fn" onclick="calcSci('pow10')">10ˣ</button>
            <button class="calc-key fn" onclick="calcSci('pi')">π</button>
            <button class="calc-key fn" onclick="calcSci('e')">e</button>
            <button class="calc-key fn" onclick="calcSci('fact')">n!</button>
            <button class="calc-key fn" onclick="calcSci('abs')">|x|</button>
            <button class="calc-key fn" onclick="calcSci('pow')">xʸ</button>
            <button class="calc-key ac" onclick="calcAC()">AC</button>
            <button class="calc-key ac" onclick="calcDel()">⌫</button>
            <button class="calc-key op" onclick="calcOp('%')">%</button>
            <button class="calc-key op" onclick="calcOp('/')">÷</button>
            <button class="calc-key op" onclick="calcOp('×')">×</button>
            <button class="calc-key num" onclick="calcNum('7')">7</button>
            <button class="calc-key num" onclick="calcNum('8')">8</button>
            <button class="calc-key num" onclick="calcNum('9')">9</button>
            <button class="calc-key op" onclick="calcOp('+')">+</button>
            <button class="calc-key op" onclick="calcOp('-')">−</button>
            <button class="calc-key num" onclick="calcNum('4')">4</button>
            <button class="calc-key num" onclick="calcNum('5')">5</button>
            <button class="calc-key num" onclick="calcNum('6')">6</button>
            <button class="calc-key num" onclick="calcNum('1')">1</button>
            <button class="calc-key num" onclick="calcNum('2')">2</button>
            <button class="calc-key num" onclick="calcNum('3')">3</button>
            <button class="calc-key num zero-hold span2"
              onmousedown="lpStart(event)" onmouseup="lpEnd()" ontouchstart="lpStart(event)" ontouchend="lpEnd()"
              onclick="calcNum('0')">0<span class="hold-hint">00/000</span></button>
            <button class="calc-key num" onclick="calcDot()">.</button>
            <button class="calc-key num" onclick="calcNeg()">+/−</button>
            <button class="calc-key eq span2" onclick="calcEval()">=</button>
          </div>
        </div>

        <!-- ── Graphing ── -->
        <div id="calc-gph" class="calc-view">
          <div class="calc-graph-controls">
            <input type="text" class="form-control" id="calc-graph-fn" placeholder="e.g. sin(x), x^2, x*2+1" value="sin(x)">
            <button class="calc-graph-btn" onclick="calcDrawGraph()">Plot</button>
          </div>
          <div class="calc-graph-wrap" style="margin-top:8px">
            <canvas id="calc-graph-canvas" width="352" height="170"></canvas>
          </div>
          <div style="padding:6px 14px;font-size:.7rem;color:var(--muted)">
            Use <code>x</code> as variable. Supports: sin, cos, tan, sqrt, abs, PI, E, ^
          </div>
        </div>

        <!-- ── Programmer ── -->
        <div id="calc-prg" class="calc-view">
          <div class="calc-prog-base-tabs">
            <button class="calc-prog-btab active" onclick="calcProgBase(16,this)">HEX</button>
            <button class="calc-prog-btab" onclick="calcProgBase(10,this)">DEC</button>
            <button class="calc-prog-btab" onclick="calcProgBase(8,this)">OCT</button>
            <button class="calc-prog-btab" onclick="calcProgBase(2,this)">BIN</button>
          </div>
          <div class="calc-prog-bases" id="calc-prog-bases">
            <span class="calc-prog-base-label">HEX</span><span class="calc-prog-base-val" id="pb-hex">0</span>
            <span class="calc-prog-base-label">DEC</span><span class="calc-prog-base-val active" id="pb-dec">0</span>
            <span class="calc-prog-base-label">OCT</span><span class="calc-prog-base-val" id="pb-oct">0</span>
            <span class="calc-prog-base-label">BIN</span><span class="calc-prog-base-val" id="pb-bin">0</span>
          </div>
          <div class="calc-keys calc-keys-4">
            <button class="calc-key fn" onclick="calcProgOp('AND')">AND</button>
            <button class="calc-key fn" onclick="calcProgOp('OR')">OR</button>
            <button class="calc-key fn" onclick="calcProgOp('XOR')">XOR</button>
            <button class="calc-key fn" onclick="calcProgOp('NOT')">NOT</button>
            <button class="calc-key fn" onclick="calcProgOp('<<')">LSH</button>
            <button class="calc-key fn" onclick="calcProgOp('>>')">RSH</button>
            <button class="calc-key ac" onclick="calcAC()">AC</button>
            <button class="calc-key ac" onclick="calcDel()">⌫</button>
            <!-- Hex digits -->
            <button class="calc-key fn" id="pk-A" onclick="calcProgHex('A')">A</button>
            <button class="calc-key fn" id="pk-B" onclick="calcProgHex('B')">B</button>
            <button class="calc-key fn" id="pk-C" onclick="calcProgHex('C')">C</button>
            <button class="calc-key op" onclick="calcOp('/')">÷</button>
            <button class="calc-key fn" id="pk-D" onclick="calcProgHex('D')">D</button>
            <button class="calc-key fn" id="pk-E" onclick="calcProgHex('E')">E</button>
            <button class="calc-key fn" id="pk-F" onclick="calcProgHex('F')">F</button>
            <button class="calc-key op" onclick="calcOp('×')">×</button>
            <button class="calc-key num" onclick="calcNum('7')">7</button>
            <button class="calc-key num" onclick="calcNum('8')">8</button>
            <button class="calc-key num" onclick="calcNum('9')">9</button>
            <button class="calc-key op" onclick="calcOp('-')">−</button>
            <button class="calc-key num" onclick="calcNum('4')">4</button>
            <button class="calc-key num" onclick="calcNum('5')">5</button>
            <button class="calc-key num" onclick="calcNum('6')">6</button>
            <button class="calc-key op" onclick="calcOp('+')">+</button>
            <button class="calc-key num" onclick="calcNum('1')">1</button>
            <button class="calc-key num" onclick="calcNum('2')">2</button>
            <button class="calc-key num" onclick="calcNum('3')">3</button>
            <button class="calc-key num span2" onclick="calcNum('0')">0</button>
            <button class="calc-key num" onclick="calcDot()">.</button>
            <button class="calc-key eq" onclick="calcEval()">=</button>
          </div>
        </div>

        <!-- ── Date ── -->
        <div id="calc-dat" class="calc-view">
          <div class="calc-date-section">
            <div style="display:flex;gap:8px;margin-bottom:10px">
              <button class="calc-subtab active" onclick="calcDateMode('diff',this)">Difference</button>
              <button class="calc-subtab" onclick="calcDateMode('add',this)">Add / Subtract</button>
              <button class="calc-subtab" onclick="calcDateMode('age',this)">Age</button>
            </div>

            <!-- Date difference -->
            <div id="calc-date-diff">
              <label>From Date</label>
              <input type="date" id="calc-d1" onchange="calcDateDiff()">
              <label>To Date</label>
              <input type="date" id="calc-d2" onchange="calcDateDiff()">
              <div class="calc-date-result" id="calc-date-res">
                Select two dates to calculate the difference.
              </div>
            </div>

            <!-- Add/subtract -->
            <div id="calc-date-add" style="display:none">
              <label>Start Date</label>
              <input type="date" id="calc-d3" onchange="calcDateAdd()">
              <label>Add / Subtract Days</label>
              <input type="number" id="calc-d-days" placeholder="e.g. 30 or -7"
                style="width:100%;padding:7px 10px;border-radius:8px;border:1px solid var(--border);
                  background:var(--surface2);color:var(--text);font-size:.82rem;margin-bottom:8px;box-sizing:border-box"
                oninput="calcDateAdd()">
              <div class="calc-date-result" id="calc-date-res2">Enter a date and number of days.</div>
            </div>

            <!-- Age -->
            <div id="calc-date-age" style="display:none">
              <label>Date of Birth</label>
              <input type="date" id="calc-d-dob" onchange="calcAge()">
              <div class="calc-date-result" id="calc-date-res3">Enter your date of birth.</div>
            </div>
          </div>
        </div>

      </div>
      <!-- ── end CALCULATOR ──── -->

      <!-- ── CONVERTER ──────────────────────────── -->
      <div id="calc-sec-converter" class="calc-view">
        <div class="calc-subtabs" id="calc-conv-tabs">
          ${['currency','volume','length','weight','temperature','energy','area','speed','time','power','data','pressure','angle'].map(m =>
            `<button class="calc-subtab${m==='currency'?' active':''}" onclick="calcConvMode('${m}',this)">${convLabel(m)}</button>`
          ).join('')}
        </div>
        <div class="calc-conv-wrap" id="calc-conv-body"></div>
      </div>

      <!-- ── HISTORY ────────────────────────────── -->
      <div id="calc-sec-history" class="calc-view">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 0">
          <span style="font-size:.8rem;font-weight:600;color:var(--muted)">Last 50 calculations</span>
          <button class="calc-subtab" onclick="calcClearHistory()">Clear All</button>
        </div>
        <div class="calc-history-wrap" id="calc-history-list"></div>
      </div>

      <!-- ── MEMORY ─────────────────────────────── -->
      <div id="calc-sec-memory" class="calc-view">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 0">
          <span style="font-size:.8rem;font-weight:600;color:var(--muted)">Stored Values</span>
          <button class="calc-subtab" onclick="calcClearAllMemory()">Clear All</button>
        </div>
        <div class="calc-memory-wrap" id="calc-memory-list"></div>
      </div>

      <!-- ── SETTINGS ───────────────────────────── -->
      <div id="calc-sec-settings" class="calc-view">
        <div class="calc-settings-wrap">
          <div class="calc-settings-row">
            <div>
              <div class="calc-settings-label">00 / 000 Keys</div>
              <div class="calc-settings-desc">Hold the 0 key 1s for 00, 2s for 000</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="calc-set-00" checked onchange="S_set00(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="calc-settings-row">
            <div>
              <div class="calc-settings-label">Appearance</div>
              <div class="calc-settings-desc">Follows the app theme automatically</div>
            </div>
            <span class="badge b-gold" style="font-size:.7rem">Auto</span>
          </div>
          <div class="calc-settings-row">
            <div>
              <div class="calc-settings-label">Decimal Precision</div>
              <div class="calc-settings-desc">Max decimal places shown</div>
            </div>
            <select id="calc-set-prec"
              style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);
                     background:var(--surface2);color:var(--text);font-size:.78rem"
              onchange="S_setPrec(this.value)">
              <option value="4" selected>4</option>
              <option value="6">6</option>
              <option value="8">8</option>
              <option value="10">10</option>
              <option value="12">12</option>
            </select>
          </div>
          <div class="calc-settings-row">
            <div>
              <div class="calc-settings-label">Angle Unit (Scientific)</div>
              <div class="calc-settings-desc">Used for trig functions</div>
            </div>
            <select id="calc-set-angle"
              style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);
                     background:var(--surface2);color:var(--text);font-size:.78rem"
              onchange="S_setAngle(this.value)">
              <option value="deg" selected>Degrees</option>
              <option value="rad">Radians</option>
            </select>
          </div>

          <!-- Keyboard shortcut reference -->
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
            <div class="fw-600" style="font-size:.8rem;margin-bottom:4px">⌨️ Keyboard Shortcuts</div>
            <div class="text-muted" style="font-size:.72rem;margin-bottom:8px">
              Shortcuts work when the calculator is open and no text field is focused.
            </div>

            <div class="calc-kb-guide">
              <div class="calc-kb-section">Open / Close</div>
              <span class="calc-kb-key">Ctrl K</span><span class="calc-kb-desc">Toggle calculator open / close</span>
              <span class="calc-kb-key">Esc</span><span class="calc-kb-desc">Close calculator</span>

              <div class="calc-kb-section">Numbers & Decimal</div>
              <span class="calc-kb-key">0 – 9</span><span class="calc-kb-desc">Enter digits</span>
              <span class="calc-kb-key">.</span><span class="calc-kb-desc">Decimal point</span>
              <span class="calc-kb-key">Numpad</span><span class="calc-kb-desc">All numpad keys work identically</span>

              <div class="calc-kb-section">Operators</div>
              <span class="calc-kb-key">+</span><span class="calc-kb-desc">Add</span>
              <span class="calc-kb-key">−</span><span class="calc-kb-desc">Subtract</span>
              <span class="calc-kb-key">*</span><span class="calc-kb-desc">Multiply</span>
              <span class="calc-kb-key">/</span><span class="calc-kb-desc">Divide</span>
              <span class="calc-kb-key">% (Shift 5)</span><span class="calc-kb-desc">Percent</span>
              <span class="calc-kb-key">Enter / =</span><span class="calc-kb-desc">Evaluate (equals)</span>

              <div class="calc-kb-section">Editing</div>
              <span class="calc-kb-key">Backspace</span><span class="calc-kb-desc">Delete last digit</span>
              <span class="calc-kb-key">Delete</span><span class="calc-kb-desc">Clear all (AC)</span>
              <span class="calc-kb-key">F9</span><span class="calc-kb-desc">Toggle positive / negative</span>

              <div class="calc-kb-section">Memory (hold Ctrl)</div>
              <span class="calc-kb-key">Ctrl M</span><span class="calc-kb-desc">Memory Store (MS)</span>
              <span class="calc-kb-key">Ctrl R</span><span class="calc-kb-desc">Memory Recall (MR)</span>
              <span class="calc-kb-key">Ctrl P</span><span class="calc-kb-desc">Memory Add (M+)</span>
              <span class="calc-kb-key">Ctrl L</span><span class="calc-kb-desc">Memory Clear (MC)</span>

              <div class="calc-kb-section">Calculator Modes (F keys)</div>
              <span class="calc-kb-key">F1</span><span class="calc-kb-desc">Standard</span>
              <span class="calc-kb-key">F2</span><span class="calc-kb-desc">Scientific</span>
              <span class="calc-kb-key">F3</span><span class="calc-kb-desc">Graphing</span>
              <span class="calc-kb-key">F4</span><span class="calc-kb-desc">Programmer</span>
              <span class="calc-kb-key">F5</span><span class="calc-kb-desc">Date</span>

              <div class="calc-kb-section">Sections (hold Alt)</div>
              <span class="calc-kb-key">Alt 1</span><span class="calc-kb-desc">Calculator section</span>
              <span class="calc-kb-key">Alt 2</span><span class="calc-kb-desc">Converter section</span>
              <span class="calc-kb-key">Alt 3</span><span class="calc-kb-desc">History</span>
              <span class="calc-kb-key">Alt 4</span><span class="calc-kb-desc">Memory</span>
              <span class="calc-kb-key">Alt 5</span><span class="calc-kb-desc">Settings</span>

              <div class="calc-kb-section">Scientific Mode Only</div>
              <span class="calc-kb-key">S</span><span class="calc-kb-desc">sin</span>
              <span class="calc-kb-key">C</span><span class="calc-kb-desc">cos</span>
              <span class="calc-kb-key">T</span><span class="calc-kb-desc">tan</span>
              <span class="calc-kb-key">Q</span><span class="calc-kb-desc">√ Square root</span>
              <span class="calc-kb-key">X</span><span class="calc-kb-desc">x² Square</span>
              <span class="calc-kb-key">L</span><span class="calc-kb-desc">log₁₀</span>
              <span class="calc-kb-key">N</span><span class="calc-kb-desc">ln (natural log)</span>
              <span class="calc-kb-key">I</span><span class="calc-kb-desc">1/x (inverse)</span>
              <span class="calc-kb-key">P</span><span class="calc-kb-desc">π (pi)</span>
              <span class="calc-kb-key">E</span><span class="calc-kb-desc">e (Euler's number)</span>
              <span class="calc-kb-key">!</span><span class="calc-kb-desc">n! (factorial)</span>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // ── Helper ────────────────────────────────────────
  function convLabel(m) {
    return {
      currency:'Currency', volume:'Volume', length:'Length',
      weight:'Weight', temperature:'Temp', energy:'Energy',
      area:'Area', speed:'Speed', time:'Time', power:'Power',
      data:'Data', pressure:'Pressure', angle:'Angle'
    }[m] || m;
  }

  let calcPrecision = 4;
  let calcAngle     = 'deg';

  // ── Settings handlers ─────────────────────────────
  window.S_set00    = v => { S.show00 = v; };
  window.S_setPrec  = v => { calcPrecision = +v; };
  window.S_setAngle = v => { calcAngle = v; };

  // ── Section switching ─────────────────────────────
  window.calcSection = function (name, btn) {
    S.section = name;
    document.querySelectorAll('.calc-stab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('[id^="calc-sec-"]').forEach(el => el.classList.remove('active'));
    const sec = document.getElementById('calc-sec-' + name);
    if (sec) sec.classList.add('active');
    if (name === 'history')   renderHistory();
    if (name === 'memory')    renderMemory();
    if (name === 'converter') { calcConvMode(S.convMode, document.querySelector('.calc-conv-tabs .calc-subtab.active') || document.querySelector('#calc-conv-tabs .calc-subtab')); }
  };

  // ── Calculator mode switching ─────────────────────
  window.calcMode = function (mode, btn) {
    S.calcMode = mode;
    document.querySelectorAll('#calc-sec-calculator .calc-subtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['std','sci','gph','prg','dat'].forEach(id => {
      const el = document.getElementById('calc-' + id);
      if (el) el.classList.remove('active');
    });
    const map = { standard:'std', scientific:'sci', graphing:'gph', programmer:'prg', date:'dat' };
    const el = document.getElementById('calc-' + map[mode]);
    if (el) el.classList.add('active');
    if (mode === 'graphing')   calcDrawGraph();
    if (mode === 'programmer') updateProgBases();
  };

  // ── Display update ────────────────────────────────
  function updateDisplay() {
    const res = document.getElementById('calc-result');
    const expr = document.getElementById('calc-expr');
    const memInd = document.getElementById('calc-mem-ind');
    if (!res) return;

    let display = S.input;
    if (parseFloat(display).toString().length > 14) {
      display = parseFloat(display).toExponential(6);
    }
    res.textContent = display;
    res.className = 'calc-result' + (display.length > 12 ? ' small' : '');

    if (expr) {
      let exprStr = '';
      if (S.operand !== null && S.operator) {
        exprStr = fmtNum(S.operand) + ' ' + S.operator + (S.justEvaled ? '' : ' ' + S.input);
      } else if (S.justEvaled && S.result !== null) {
        exprStr = S.expr;
      }
      expr.textContent = exprStr;
    }

    if (memInd) {
      memInd.textContent = S.memory.length ? `M: ${fmtNum(S.memory[S.memory.length-1])}` : '';
    }

    if (S.calcMode === 'programmer') updateProgBases();
  }

  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    const str = parseFloat(n.toPrecision(14)).toString();
    return str;
  }

  function formatResult(n) {
    if (!isFinite(n)) return n > 0 ? 'Infinity' : '-Infinity';
    if (isNaN(n)) return 'Error';
    // Round to precision
    const rounded = parseFloat(n.toPrecision(10));
    let s = rounded.toString();
    // Trim trailing zeros after decimal
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    return s;
  }

  // ── Core calculator logic ─────────────────────────
  window.calcNum = function (n) {

    if (S.justEvaled) { S.input = '0'; S.justEvaled = false; }
    if (S.input === '0' && n !== '.') {
      S.input = n;
    } else {
      if (S.input.replace('-','').replace('.','').length >= 16) return;
      S.input += n;
    }
    updateDisplay();
  };

  window.calcDot = function () {

    if (S.justEvaled) { S.input = '0'; S.justEvaled = false; }
    if (!S.input.includes('.')) S.input += '.';
    updateDisplay();
  };

  window.calcNeg = function () {

    if (S.input === '0') return;
    S.input = S.input.startsWith('-') ? S.input.slice(1) : '-' + S.input;
    updateDisplay();
  };

  window.calcOp = function (op) {

    const val = parseFloat(S.input);
    if (isNaN(val)) return;

    if (S.operand !== null && S.operator && !S.justEvaled) {
      // Chain operations
      const res = doCalc(S.operand, S.operator, val);
      S.operand = res;
      S.input   = formatResult(res);
    } else {
      S.operand = val;
    }

    if (op === '%') {
      S.input = formatResult(S.operand / 100);
      S.operand = null; S.operator = null;
    } else {
      S.operator = op;
    }
    S.justEvaled = true;
    updateDisplay();
  };

  window.calcEval = function () {

    const val = parseFloat(S.input);
    if (isNaN(val)) return;

    let result;
    if (S.operand !== null && S.operator) {
      const exprStr = fmtNum(S.operand) + ' ' + S.operator + ' ' + fmtNum(val);
      result = doCalc(S.operand, S.operator, val);
      S.expr = exprStr + ' =';
      S.result = result;
      addHistory(exprStr, formatResult(result));
    } else {
      result = val;
    }

    S.input      = formatResult(result);
    S.operand    = null;
    S.operator   = null;
    S.justEvaled = true;
    updateDisplay();
  };

  function doCalc(a, op, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '/': return b === 0 ? Infinity : a / b;
      default : return b;
    }
  }

  window.calcAC = function () {

    S.input = '0'; S.operand = null; S.operator = null;
    S.expr = ''; S.result = null; S.justEvaled = false;
    updateDisplay();
  };

  window.calcDel = function () {

    if (S.justEvaled) { calcAC(); return; }
    S.input = S.input.length > 1 ? S.input.slice(0,-1) : '0';
    updateDisplay();
  };

  // ── Scientific functions ──────────────────────────
  window.calcSci = function (fn) {

    let val = parseFloat(S.input);
    if (isNaN(val)) return;

    function toRad(d) { return calcAngle === 'deg' ? d * Math.PI / 180 : d; }
    function fromRad(r) { return calcAngle === 'deg' ? r * 180 / Math.PI : r; }

    let res;
    const exprLabel = {
      sin:'sin', cos:'cos', tan:'tan', asin:'sin⁻¹', acos:'cos⁻¹', atan:'tan⁻¹',
      sqrt:'√', cbrt:'∛', sq:'sqr', cube:'cube', inv:'1/', log:'log', ln:'ln',
      exp:'e^', pow10:'10^', abs:'|', fact:'fact', pi:'π', e:'e', pow:'pow'
    }[fn] || fn;

    switch (fn) {
      case 'sin':   res = Math.sin(toRad(val)); break;
      case 'cos':   res = Math.cos(toRad(val)); break;
      case 'tan':   res = Math.tan(toRad(val)); break;
      case 'asin':  res = fromRad(Math.asin(val)); break;
      case 'acos':  res = fromRad(Math.acos(val)); break;
      case 'atan':  res = fromRad(Math.atan(val)); break;
      case 'sqrt':  res = Math.sqrt(val); break;
      case 'cbrt':  res = Math.cbrt(val); break;
      case 'sq':    res = val * val; break;
      case 'cube':  res = val * val * val; break;
      case 'inv':   res = 1 / val; break;
      case 'log':   res = Math.log10(val); break;
      case 'ln':    res = Math.log(val); break;
      case 'exp':   res = Math.exp(val); break;
      case 'pow10': res = Math.pow(10, val); break;
      case 'abs':   res = Math.abs(val); break;
      case 'fact':  res = factorial(Math.round(val)); break;
      case 'pi':    res = Math.PI; break;
      case 'e':     res = Math.E; break;
      case 'pow':
        S.operand = val; S.operator = '^'; S.justEvaled = true; updateDisplay(); return;
      default: return;
    }

    const exprStr = fn === 'pi' || fn === 'e' ? '' : `${exprLabel}(${fmtNum(val)})`;
    if (exprStr) addHistory(exprStr, formatResult(res));
    S.input = formatResult(res);
    S.expr = exprStr ? exprStr + ' =' : '';
    S.justEvaled = true;
    S.result = res;
    updateDisplay();
  };

  function factorial(n) {
    if (n < 0 || n > 170) return Infinity;
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // ── Memory ────────────────────────────────────────
  window.calcMemory = function (op) {

    const val = parseFloat(S.input);
    switch (op) {
      case 'mc': S.memory = []; break;
      case 'mr':
        if (S.memory.length) { S.input = formatResult(S.memory[S.memory.length-1]); S.justEvaled = false; }
        break;
      case 'ms':
        if (!isNaN(val)) S.memory.push(val);
        break;
      case 'm+':
        if (S.memory.length && !isNaN(val)) {
          S.memory[S.memory.length-1] += val;
        } else if (!isNaN(val)) {
          S.memory.push(val);
        }
        break;
    }
    updateDisplay();
  };

  window.calcClearAllMemory = function () {
    S.memory = [];
    renderMemory();
    updateDisplay();
  };

  // ── Programmer mode ───────────────────────────────
  window.calcProgBase = function (base, btn) {
    S.progBase = base;
    document.querySelectorAll('.calc-prog-btab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Enable/disable hex buttons
    ['A','B','C','D','E','F'].forEach(h => {
      const el = document.getElementById('pk-' + h);
      if (el) el.disabled = base < 16;
    });
    // Disable 8,9 in binary/octal
    updateProgBases();
  };

  window.calcProgHex = function (ch) {

    if (S.justEvaled) { S.input = '0'; S.justEvaled = false; }
    if (S.input === '0') S.input = ch;
    else S.input += ch;
    updateDisplay();
  };

  window.calcProgOp = function (op) {

    const val = parseInt(S.input);
    if (isNaN(val)) return;
    if (op === 'NOT') {
      S.input = formatResult(~val);
      addHistory(`NOT(${val})`, formatResult(~val));
      S.justEvaled = true;
      updateDisplay(); return;
    }
    S.operand = val;
    S.operator = op;
    S.justEvaled = true;
    updateDisplay();
  };

  function updateProgBases() {
    const dec = parseInt(S.input) || 0;
    const setEl = (id, val, isAct) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val;
      el.className = 'calc-prog-base-val' + (isAct ? ' active' : '');
    };
    const base = S.progBase;
    setEl('pb-hex', isNaN(dec) ? 'Error' : dec.toString(16).toUpperCase(), base===16);
    setEl('pb-dec', isNaN(dec) ? 'Error' : dec.toString(10), base===10);
    setEl('pb-oct', isNaN(dec) ? 'Error' : dec.toString(8), base===8);
    setEl('pb-bin', isNaN(dec) ? 'Error' : dec.toString(2), base===2);
  }

  // ── Graphing ──────────────────────────────────────
  window.calcDrawGraph = function () {
    const canvas = document.getElementById('calc-graph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const fnStr = (document.getElementById('calc-graph-fn')?.value || 'sin(x)').trim();

    // Safe eval
    function evalFn(x) {
      try {
        const safeStr = fnStr
          .replace(/\^/g, '**')
          .replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos')
          .replace(/tan/g,'Math.tan').replace(/sqrt/g,'Math.sqrt')
          .replace(/abs/g,'Math.abs').replace(/log/g,'Math.log10')
          .replace(/ln/g,'Math.log').replace(/PI/g,'Math.PI')
          .replace(/E\b/g,'Math.E');
        // eslint-disable-next-line no-new-func
        return Function('x', `"use strict"; return (${safeStr})`)(x);
      } catch { return NaN; }
    }

    // Sample
    const samples = 280;
    const xMin = -10, xMax = 10;
    const points = [];
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i <= samples; i++) {
      const x = xMin + (xMax - xMin) * i / samples;
      const y = evalFn(x);
      points.push({ x, y });
      if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
    }
    if (!isFinite(yMin)) { yMin = -10; yMax = 10; }
    const pad = Math.max((yMax - yMin) * 0.1, 0.5);
    yMin -= pad; yMax += pad;

    function toCanvasX(x) { return (x - xMin) / (xMax - xMin) * W; }
    function toCanvasY(y) { return H - (y - yMin) / (yMax - yMin) * H; }

    // Draw
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isDark ? '#0d1b2e' : '#f5f5f0';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
    ctx.lineWidth = 1;
    for (let x = Math.ceil(xMin); x <= xMax; x++) {
      const cx = toCanvasX(x);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    }
    for (let y = Math.ceil(yMin); y <= yMax; y++) {
      const cy = toCanvasY(y);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1.5;
    const cx0 = toCanvasX(0), cy0 = toCanvasY(0);
    ctx.beginPath(); ctx.moveTo(cx0, 0); ctx.lineTo(cx0, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy0); ctx.lineTo(W, cy0); ctx.stroke();

    // Curve
    ctx.beginPath();
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    let drawing = false;
    points.forEach(p => {
      if (!isFinite(p.y)) { drawing = false; return; }
      const px = toCanvasX(p.x), py = toCanvasY(p.y);
      if (!drawing) { ctx.moveTo(px, py); drawing = true; }
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  };

  // ── Date calculation ──────────────────────────────
  let calcDateSubMode = 'diff';
  window.calcDateMode = function (mode, btn) {
    calcDateSubMode = mode;
    document.querySelectorAll('#calc-dat .calc-subtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['diff','add','age'].forEach(m => {
      const el = document.getElementById('calc-date-' + m);
      if (el) el.style.display = m === mode ? '' : 'none';
    });
  };

  window.calcDateDiff = function () {
    const d1 = new Date(document.getElementById('calc-d1')?.value);
    const d2 = new Date(document.getElementById('calc-d2')?.value);
    const el = document.getElementById('calc-date-res');
    if (!el || isNaN(d1) || isNaN(d2)) return;
    const ms = Math.abs(d2 - d1);
    const days  = Math.floor(ms / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.round(days / 30.44);
    const years  = (days / 365.25).toFixed(2);
    el.innerHTML = `
      <div><span class="dval">${days.toLocaleString()}</span> days</div>
      <div><span class="dval">${weeks.toLocaleString()}</span> weeks</div>
      <div><span class="dval">${months.toLocaleString()}</span> months</div>
      <div><span class="dval">${years}</span> years</div>`;
  };

  window.calcDateAdd = function () {
    const d3 = new Date(document.getElementById('calc-d3')?.value);
    const days = parseInt(document.getElementById('calc-d-days')?.value);
    const el = document.getElementById('calc-date-res2');
    if (!el || isNaN(d3) || isNaN(days)) return;
    const result = new Date(d3.getTime() + days * 86400000);
    el.innerHTML = `Result: <span class="dval">${result.toDateString()}</span>`;
  };

  window.calcAge = function () {
    const dob = new Date(document.getElementById('calc-d-dob')?.value);
    const el  = document.getElementById('calc-date-res3');
    if (!el || isNaN(dob)) return;
    const now  = new Date();
    let years  = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    let days   = now.getDate()  - dob.getDate();
    if (days < 0)   { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years--;  months += 12; }
    el.innerHTML = `<span class="dval">${years}</span> years, <span class="dval">${months}</span> months, <span class="dval">${days}</span> days`;
  };

  // ── Converter ─────────────────────────────────────
  window.calcConvMode = function (mode, btn) {
    S.convMode = mode;
    if (btn) {
      document.querySelectorAll('#calc-conv-tabs .calc-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    renderConverter(mode);
  };

  function renderConverter(mode) {
    const body = document.getElementById('calc-conv-body');
    if (!body) return;
    const data = CONV[mode];

    body.innerHTML = `
      <div class="calc-conv-row">
        <div class="calc-conv-field">
          <label>From</label>
          <select id="conv-from">${data.units.map(u=>`<option>${u}</option>`).join('')}</select>
        </div>
        <button class="calc-conv-swap" onclick="convSwap()">⇌</button>
        <div class="calc-conv-field">
          <label>To</label>
          <select id="conv-to">${data.units.map((u,i)=>`<option${i===1?' selected':''}>${u}</option>`).join('')}</select>
        </div>
      </div>
      <div class="calc-conv-field" style="margin-bottom:8px">
        <label>Value</label>
        <input type="number" id="conv-val" placeholder="Enter value" oninput="doConvert()">
      </div>
      <div class="calc-conv-result-box" id="conv-result">—</div>`;
  }

  window.doConvert = function () {
    const mode = S.convMode;
    const from = document.getElementById('conv-from')?.value;
    const to   = document.getElementById('conv-to')?.value;
    const val  = parseFloat(document.getElementById('conv-val')?.value);
    const res  = document.getElementById('conv-result');
    if (!res || isNaN(val)) return;

    let result;
    if (mode === 'temperature') {
      result = convertTemp(val, from, to);
    } else if (mode === 'currency') {
      const rates = CONV.currency.rates;
      const inGhs = val / rates[from];
      result = inGhs * rates[to];
    } else {
      const tb = CONV[mode].toBase;
      const inBase = val * tb[from];
      result = inBase / tb[to];
    }

    const formatted = Math.abs(result) < 0.000001 ? result.toExponential(6)
                    : parseFloat(result.toPrecision(10)).toString();
    res.textContent = `${formatted} ${to}`;
  };

  window.convSwap = function () {
    const f = document.getElementById('conv-from');
    const t = document.getElementById('conv-to');
    if (!f || !t) return;
    [f.value, t.value] = [t.value, f.value];
    doConvert();
  };

  function convertTemp(val, from, to) {
    let celsius;
    switch (from) {
      case 'Celsius':    celsius = val; break;
      case 'Fahrenheit': celsius = (val - 32) * 5/9; break;
      case 'Kelvin':     celsius = val - 273.15; break;
    }
    switch (to) {
      case 'Celsius':    return celsius;
      case 'Fahrenheit': return celsius * 9/5 + 32;
      case 'Kelvin':     return celsius + 273.15;
    }
  }

  // ── History ───────────────────────────────────────
  function addHistory(expr, val) {
    S.history.unshift({ expr, val, time: new Date().toLocaleTimeString() });
    if (S.history.length > 50) S.history.pop();
  }

  function renderHistory() {
    const el = document.getElementById('calc-history-list');
    if (!el) return;
    if (!S.history.length) {
      el.innerHTML = '<div class="calc-history-empty">No calculations yet</div>';
      return;
    }
    el.innerHTML = S.history.map((h, i) => `
      <div class="calc-history-item" onclick="historyRecall(${i})">
        <div class="calc-history-expr">${h.expr}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="calc-history-val">= ${h.val}</div>
          <div style="font-size:.65rem;color:var(--muted)">${h.time}</div>
        </div>
      </div>`).join('');
  }

  window.historyRecall = function (i) {
    const h = S.history[i];
    if (!h) return;
    S.input = h.val;
    S.justEvaled = true;
    calcSection('calculator', document.querySelector('.calc-stab'));
    updateDisplay();
  };

  window.calcClearHistory = function () {
    S.history = [];
    renderHistory();
  };

  // ── Memory render ─────────────────────────────────
  function renderMemory() {
    const el = document.getElementById('calc-memory-list');
    if (!el) return;
    if (!S.memory.length) {
      el.innerHTML = '<div class="calc-history-empty">No values stored.<br>Use MS or M+ on the calculator.</div>';
      return;
    }
    el.innerHTML = S.memory.map((v, i) => `
      <div class="calc-memory-slot">
        <span class="calc-memory-slot-label">M${i+1}</span>
        <span class="calc-memory-slot-val">${fmtNum(v)}</span>
        <span class="calc-memory-slot-del" onclick="calcDelMemory(${i})">✕</span>
      </div>`).join('') +
      `<div style="text-align:right;margin-top:8px">
        <button class="calc-subtab" onclick="calcRecallAll()">Recall M1</button>
      </div>`;
  }

  window.calcDelMemory = function (i) {
    S.memory.splice(i, 1);
    renderMemory();
    updateDisplay();
  };

  window.calcRecallAll = function () {
    if (S.memory.length) {
      S.input = formatResult(S.memory[0]);
      S.justEvaled = false;
      calcSection('calculator', document.querySelector('.calc-stab'));
      updateDisplay();
    }
  };

  // ── Long-press 00/000 ─────────────────────────────
  window.lpStart = function (e) {
    if (!S.show00) return;
    S.lpStart = Date.now();
    const btn = e.currentTarget;

    // Show progress bar
    btn.classList.add('longpress-progress');
    btn.style.setProperty('--lp-dur', '1s');

    S.lpTimer = setTimeout(() => {
      // 1 second → 00
      S.input = (S.input === '0') ? '00' : S.input + '00';
      updateDisplay();
      // Wait another 1s → 000
      btn.style.setProperty('--lp-dur', '1s');
      btn.classList.remove('longpress-progress');
      void btn.offsetWidth; // reflow
      btn.classList.add('longpress-progress');

      S.lpTimer = setTimeout(() => {
        S.input = (S.input.endsWith('00')) ? S.input + '0' : S.input + '000';
        updateDisplay();
        btn.classList.remove('longpress-progress');
        S.lpTimer = null;
      }, 1000);
    }, 1000);
  };

  window.lpEnd = function () {
    if (S.lpTimer) {
      clearTimeout(S.lpTimer);
      S.lpTimer = null;
    }
    const btn = document.querySelector('.zero-hold');
    if (btn) btn.classList.remove('longpress-progress');
  };

  // ── Ripple effect ─────────────────────────────────
  function ripple(e) {
    if (!e) return;
    // Only ripple on genuine pointer/touch events — never on keyboard events.
    // KeyboardEvent type is 'keydown'/'keyup'/'keypress'; those must be ignored.
    if (!e.type || e.type.startsWith('key')) return;
    const btn = (e.currentTarget instanceof HTMLElement && e.currentTarget.classList.contains('calc-key'))
      ? e.currentTarget
      : e.target?.closest?.('.calc-key');
    if (!btn) return;
    const circle = document.createElement('span');
    circle.className = 'ripple';
    const r = Math.max(btn.offsetWidth, btn.offsetHeight);
    circle.style.width = circle.style.height = `${r}px`;
    circle.style.left  = `${(btn.offsetWidth  / 2) - r/2}px`;
    circle.style.top   = `${(btn.offsetHeight / 2) - r/2}px`;
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 350);
  }

  // ── Toggle panel ──────────────────────────────────
  window.calcToggle = function () {
    const panel = document.getElementById('calc-panel');
    const btn   = document.getElementById('calc-toggle-btn');
    if (!panel) return;
    const open = panel.classList.toggle('open');
    if (btn) btn.classList.toggle('active', open);
    if (open) {
      updateDisplay();
      renderConverter(S.convMode);
      // Give panel a tabindex so it can receive focus, then focus it
      panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
    } else {
      // Return focus to body so the rest of the app works normally
      document.body.focus();
    }
  };

  window.calcClose = function () {
    const panel = document.getElementById('calc-panel');
    const btn   = document.getElementById('calc-toggle-btn');
    if (panel) panel.classList.remove('open');
    if (btn)   btn.classList.remove('active');
  };

  // ── Flash a key for visual keyboard feedback ──────
  function flashKey(selector) {
    const btn = document.querySelector(`#calc-panel ${selector}`);
    if (!btn) return;
    btn.classList.add('key-flash');
    setTimeout(() => btn.classList.remove('key-flash'), 150);
  }

  // ── Re-focus panel after clicking a calc key ─────
  // This ensures keyboard still works after touchscreen/mouse use
  document.addEventListener('click', function (e) {
    const panel = document.getElementById('calc-panel');
    if (!panel?.classList.contains('open')) return;
    if (e.target?.closest('#calc-panel')) {
      // Clicked inside panel — re-focus the panel itself so keyboard keeps working
      // (unless the click landed on an input/select inside the panel)
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        panel.focus({ preventScroll: true });
      }
    }
  }, true); // capture phase

  // ── Keyboard handler ──────────────────────────────
  // Uses capture phase (true) so nothing else can block it.
  // Checks the panel is open; does NOT filter on e.target so it
  // works whether focus is on the panel, a button, or body.
  document.addEventListener('keydown', function (e) {

    // ── Global: Ctrl+K toggles calculator ─────────
    if (e.ctrlKey && !e.altKey && e.key === 'k') {
      e.preventDefault();
      calcToggle();
      return;
    }

    const panel = document.getElementById('calc-panel');
    if (!panel?.classList.contains('open')) return;

    // If focus is on a text input INSIDE the calculator (graph fn, conv val, etc.)
    // let the key go through to that input normally — except Escape
    const active = document.activeElement;
    const insideCalcInput = active &&
      (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA') &&
      active.closest('#calc-panel');
    if (insideCalcInput) {
      if (e.key === 'Escape') { e.preventDefault(); active.blur(); panel.focus({ preventScroll: true }); }
      return;
    }

    // If focus is outside the calc panel entirely (e.g. in a form field in the main app)
    // don't intercept keys — the user is typing in the app
    if (active && active !== document.body && active !== panel && !active.closest('#calc-panel')) {
      return;
    }

    // ── Global panel shortcuts ─────────────────────
    if (e.key === 'Escape') {
      e.preventDefault(); calcClose(); return;
    }

    // Alt + 1–5 → section switching
    if (e.altKey && !e.ctrlKey) {
      const secMap = { '1':'calculator','2':'converter','3':'history','4':'memory','5':'settings' };
      if (secMap[e.key]) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const btn = document.querySelectorAll('#calc-panel .calc-stab')[idx];
        if (btn) calcSection(secMap[e.key], btn);
        return;
      }
    }

    // Only process calculator keys when on calculator section
    if (S.section !== 'calculator') return;

    const shift = e.shiftKey;

    // ── Digits ──────────────────────────────────────
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        calcNum(e.key);
        flashKey(`.calc-key.num[onclick*="calcNum('${e.key}')"]`);
        return;
      }
    }

    // ── Numpad ──────────────────────────────────────
    if (e.code?.startsWith('Numpad') && !e.altKey && !e.ctrlKey) {
      const numpadMap = {
        'Numpad0':'0','Numpad1':'1','Numpad2':'2','Numpad3':'3','Numpad4':'4',
        'Numpad5':'5','Numpad6':'6','Numpad7':'7','Numpad8':'8','Numpad9':'9',
        'NumpadDecimal':'.','NumpadAdd':'+','NumpadSubtract':'-',
        'NumpadMultiply':'x','NumpadDivide':'/','NumpadEnter':'='
      };
      const mapped = numpadMap[e.code];
      if (mapped) {
        e.preventDefault();
        if      (mapped >= '0' && mapped <= '9') { calcNum(mapped); flashKey(`.calc-key.num[onclick*="calcNum('${mapped}')"]`); }
        else if (mapped === '.')  { calcDot();      flashKey(`.calc-key.num[onclick*="calcDot"]`); }
        else if (mapped === '=')  { calcEval();     flashKey('.calc-key.eq'); }
        else if (mapped === '+')  { calcOp('+');    flashKey(`.calc-key.op[onclick*="'+'"]`); }
        else if (mapped === '-')  { calcOp('-');    flashKey(`.calc-key.op[onclick*="'-'"]`); }
        else if (mapped === 'x')  { calcOp('×');   flashKey(`.calc-key.op[onclick*="'×'"]`); }
        else if (mapped === '/')  { calcOp('/');    flashKey(`.calc-key.op[onclick*="'/'"]`); }
        return;
      }
    }

    // ── Operators ───────────────────────────────────
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key === '+')               { e.preventDefault(); calcOp('+');  flashKey(`.calc-key.op[onclick*="'+'"]`);  return; }
      if (e.key === '-')               { e.preventDefault(); calcOp('-');  flashKey(`.calc-key.op[onclick*="'-'"]`);  return; }
      if (e.key === '*')               { e.preventDefault(); calcOp('×'); flashKey(`.calc-key.op[onclick*="'×'"]`); return; }
      if (e.key === '/')               { e.preventDefault(); calcOp('/');  flashKey(`.calc-key.op[onclick*="'/'"]`);  return; }
      if (e.key === '%' || (shift && e.key === '5')) { e.preventDefault(); calcOp('%'); flashKey(`.calc-key.op[onclick*="'%'"]`); return; }
      if (e.key === '.')               { e.preventDefault(); calcDot();   flashKey(`.calc-key.num[onclick*="calcDot"]`); return; }
    }

    // ── Equals / Enter ──────────────────────────────
    if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault(); calcEval(); flashKey('.calc-key.eq'); return;
    }

    // ── Backspace / Delete ──────────────────────────
    if (e.key === 'Backspace') { e.preventDefault(); calcDel(); flashKey(`.calc-key.ac[onclick*="calcDel"]`); return; }
    if (e.key === 'Delete')    { e.preventDefault(); calcAC();  flashKey(`.calc-key.ac[onclick*="calcAC"]`);  return; }

    // ── Toggle sign ─────────────────────────────────
    if (e.key === 'F9') { e.preventDefault(); calcNeg(); flashKey(`.calc-key.num[onclick*="calcNeg"]`); return; }

    // ── Memory (Ctrl) ───────────────────────────────
    if (e.ctrlKey && !e.altKey) {
      if (e.key === 'm') { e.preventDefault(); calcMemory('ms'); flashKey(`.calc-key.mem[onclick*="'ms'"]`); return; }
      if (e.key === 'r') { e.preventDefault(); calcMemory('mr'); flashKey(`.calc-key.mem[onclick*="'mr'"]`); return; }
      if (e.key === 'p') { e.preventDefault(); calcMemory('m+'); flashKey(`.calc-key.mem[onclick*="'m+'"]`); return; }
      if (e.key === 'l') { e.preventDefault(); calcMemory('mc'); flashKey(`.calc-key.mem[onclick*="'mc'"]`); return; }
    }

    // ── Scientific shortcuts ─────────────────────────
    if (S.calcMode === 'scientific' && !e.ctrlKey && !e.altKey) {
      const sciKeys = { s:'sin',c:'cos',t:'tan',q:'sqrt',x:'sq',l:'log',n:'ln',i:'inv',p:'pi',e:'e' };
      if (sciKeys[e.key]) { e.preventDefault(); calcSci(sciKeys[e.key]); return; }
      if (e.key === '!'  || (shift && e.key === '1')) { e.preventDefault(); calcSci('fact'); return; }
    }

    // ── Programmer hex digits ────────────────────────
    if (S.calcMode === 'programmer' && S.progBase === 16 && !e.ctrlKey) {
      const hexKeys = { a:'A',b:'B',c:'C',d:'D',e:'E',f:'F' };
      if (hexKeys[e.key.toLowerCase()]) { e.preventDefault(); calcProgHex(hexKeys[e.key.toLowerCase()]); return; }
    }

    // ── Mode switching (F1–F5) ───────────────────────
    const modeKeys = { F1:'standard',F2:'scientific',F3:'graphing',F4:'programmer',F5:'date' };
    if (modeKeys[e.key]) {
      e.preventDefault();
      const modes = Object.values(modeKeys);
      const idx   = modes.indexOf(modeKeys[e.key]);
      const btn   = document.querySelectorAll('#calc-sec-calculator .calc-subtab')[idx];
      if (btn) calcMode(modeKeys[e.key], btn);
      return;
    }

  }, true); // ← capture phase ensures nothing else blocks this

  // ── Init ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    buildPanel();
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const d1 = document.getElementById('calc-d1');
    const d2 = document.getElementById('calc-d2');
    const d3 = document.getElementById('calc-d3');
    const ddob = document.getElementById('calc-d-dob');
    if (d1) d1.value = today;
    if (d2) d2.value = today;
    if (d3) d3.value = today;
    if (ddob) ddob.value = today;

    // Initial graph
    setTimeout(calcDrawGraph, 200);
  });

})();