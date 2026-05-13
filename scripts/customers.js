// ═══════════════════════════════════════════════════════
//  CUSTOMERS
// ═══════════════════════════════════════════════════════

// ── Photo state ──────────────────────────────────────
// Use var so re-declaration is harmless if general.js already declared these globals
// Per-form state (suffix '' = form A, 'b' = form B)
var pendingCustomerPhoto = pendingCustomerPhoto || null;
var pendingCustomerPhotoB = pendingCustomerPhotoB || null;
var pendingEditPhoto     = pendingEditPhoto     || null;

let selectedCustType  = 'susu';   // form A
let selectedCustTypeB = 'susu';   // form B
let nokCount  = 1;   // form A
let nokCountB = 1;   // form B

// ── Local loader helpers ─────────────────────────────
function custShowLoader(msg, sub) {
  const el    = document.getElementById('global-loader');
  const msgEl = document.getElementById('gl-message');
  const subEl = document.getElementById('gl-sub');
  if (msgEl) msgEl.textContent = msg || 'Processing...';
  if (subEl) subEl.textContent = sub || '';
  if (el)    el.style.display  = 'flex';
}
function custHideLoader() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
}

// ── Photo helpers — Add form ──────────────────────────
function previewCustomerPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return toast('Photo must be under 2MB', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    pendingCustomerPhoto = e.target.result;
    const preview = document.getElementById('cu-photo-preview');
    if (preview) preview.innerHTML =
      `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  };
  reader.readAsDataURL(file);
}
function clearCustomerPhoto() {
  pendingCustomerPhoto = null;
  const preview = document.getElementById('cu-photo-preview');
  if (preview) preview.innerHTML = '👤';
  const input = document.getElementById('cu-photo-input');
  if (input) input.value = '';
}

// Form B photo helpers
function previewCustomerPhotoB(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return toast('Photo must be under 2MB', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    pendingCustomerPhotoB = e.target.result;
    const preview = document.getElementById('cu-photo-preview-b');
    if (preview) preview.innerHTML =
      `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  };
  reader.readAsDataURL(file);
}
function clearCustomerPhotoB() {
  pendingCustomerPhotoB = null;
  const preview = document.getElementById('cu-photo-preview-b');
  if (preview) preview.innerHTML = '👤';
  const input = document.getElementById('cu-photo-input-b');
  if (input) input.value = '';
}

// ── Photo helpers — Edit modal ────────────────────────
function previewEditPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return toast('Photo must be under 2MB', 'error');
  const reader = new FileReader();
  reader.onload = e => {
    pendingEditPhoto = e.target.result;
    const preview = document.getElementById('edit-photo-preview');
    if (preview) preview.innerHTML =
      `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  };
  reader.readAsDataURL(file);
}
function clearEditPhoto(currentPhoto) {
  pendingEditPhoto = null;
  const preview = document.getElementById('edit-photo-preview');
  if (preview) {
    // restore original if it existed, else blank
    preview.innerHTML = currentPhoto
      ? `<img src="${currentPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : '👤';
  }
}

// ── Photo lightbox (view modal) ───────────────────────
function showPhotoLightbox(src, name) {
  const existing = document.getElementById('photo-lightbox');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'photo-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9000;' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;animation:fadein .2s ease';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <div style="text-align:center;pointer-events:none">
      <img src="${src}" style="max-width:88vw;max-height:78vh;border-radius:14px;
        border:3px solid var(--gold);object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,.6)">
      ${name ? `<div style="color:rgba(255,255,255,.75);font-size:.88rem;margin-top:14px;
        font-family:'Playfair Display',serif">${name}</div>` : ''}
      <div style="color:rgba(255,255,255,.35);font-size:.72rem;margin-top:6px">
        Click anywhere to close
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// ─────────────────────────────────────────────────────
//  ACCOUNT TYPES & PREVIEW
// ─────────────────────────────────────────────────────
function selectCustType(type, sfx) {
  sfx = sfx || '';
  if (sfx === 'b') selectedCustTypeB = type;
  else             selectedCustType  = type;
  const p = sfx ? sfx + '-' : '';
  ['susu','lending','savings'].forEach(t => {
    const el = document.getElementById('tc-' + p + t);
    if (el) el.classList.toggle('selected', t === type);
  });
  updateAccountPreview(sfx);
}

function getPrefix(type) {
  return type === 'susu'
    ? SETTINGS.susuPrefix
    : type === 'lending'
      ? SETTINGS.lendingPrefix
      : SETTINGS.savingsPrefix;
}

function getNextAcctNum(type, agentCode) {
  // Check vacated (freed) slots first — return the lowest vacated number
  const vacated = (VACATED_ACCOUNTS || [])
    .filter(v => v.type === type && v.agentCode === agentCode)
    .sort((a, b) => parseInt(a.seq) - parseInt(b.seq));
  if (vacated.length) return vacated[0].seq;

  // Find the highest existing sequence number for this agent+type
  // Using max sequence (not count) prevents duplicates after deletions or imports
  const prefix   = agentCode + '-';
  let   maxSeq   = 0;
  CUSTOMERS.forEach(c => {
    if (c.agentCode === agentCode && c.type === type && c.acctNumber) {
      const parts = c.acctNumber.split('-');
      const seq   = parseInt(parts[parts.length - 1]);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });
  // Also scan deleted customers so restored numbers don't collide
  (DELETED_CUSTOMERS || []).forEach(c => {
    if (c.agentCode === agentCode && c.type === type && c.acctNumber) {
      const parts = c.acctNumber.split('-');
      const seq   = parseInt(parts[parts.length - 1]);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });
  return pad4(maxSeq + 1);
}

// Ensure an account number is truly unique before use
function _ensureUniqueAcct(acctNumber) {
  const allNums = [
    ...CUSTOMERS.map(c => c.acctNumber),
    ...(DELETED_CUSTOMERS || []).map(c => c.acctNumber),
  ];
  if (!allNums.includes(acctNumber)) return acctNumber;
  // Collision — increment until unique
  const parts  = acctNumber.split('-');
  const prefix = parts.slice(0, -1).join('-') + '-';
  let   seq    = parseInt(parts[parts.length - 1]);
  while (allNums.includes(prefix + pad4(++seq))) { /* keep incrementing */ }
  return prefix + pad4(seq);
}

// Remove a vacated slot once it has been used
function _consumeVacated(type, agentCode, seq) {
  if (!VACATED_ACCOUNTS) return;
  const idx = VACATED_ACCOUNTS.findIndex(v =>
    v.type === type && v.agentCode === agentCode && v.seq === seq
  );
  if (idx >= 0) VACATED_ACCOUNTS.splice(idx, 1);
}

function updateAccountPreview(sfx) {
  sfx = sfx || '';
  const p = sfx ? sfx + '-' : '';
  const agentId = document.getElementById('cu-agent' + (sfx ? '-' + sfx : ''))?.value;
  const agent   = AGENTS.find(a => a.id === agentId);
  const agentNum = agent ? pad2(agent.agentNumber) : '01';
  const activeCustType = sfx === 'b' ? selectedCustTypeB : selectedCustType;
  ['susu','lending','savings'].forEach(t => {
    const pfx    = getPrefix(t);
    const code   = document.getElementById('tc-' + p + t + '-code');
    const agCode = pfx + agentNum;
    if (code) code.textContent = `${agCode}-${getNextAcctNum(t, agCode)}`;
  });
  const preview = document.getElementById('acct-preview' + (sfx ? '-' + sfx : ''));
  if (preview && agent) {
    const pfx    = getPrefix(activeCustType);
    const agCode = pfx + pad2(agent.agentNumber);
    preview.textContent = `${agCode}-${getNextAcctNum(activeCustType, agCode)}`;
  }
}

// ─────────────────────────────────────────────────────
//  ADD CUSTOMER  (suffix: '' = form A, 'b' = form B)
// ─────────────────────────────────────────────────────
function addCustomer(sfx) {
  sfx = sfx || '';
  const s = sfx ? '-' + sfx : '';
  const activeCustType = sfx === 'b' ? selectedCustTypeB : selectedCustType;

  const agentId  = document.getElementById('cu-agent'  + s).value;
  const fn       = document.getElementById('cu-fname'  + s).value.trim();
  const ln       = document.getElementById('cu-lname'  + s).value.trim();
  const phone    = document.getElementById('cu-phone'  + s).value.trim();
  const dob      = document.getElementById('cu-dob'    + s).value;
  const gender   = document.getElementById('cu-gender' + (sfx ? '-' + sfx : ''))?.value || '';
  const regDate  = document.getElementById('cu-regdate'+ s).value || todayISO();
  const idType   = document.getElementById('cu-idtype' + s).value;
  const idNum    = document.getElementById('cu-idnum'  + s).value.trim();
  const address  = document.getElementById('cu-address'+ s).value.trim();
  const town     = document.getElementById('cu-town'   + s)?.value.trim() || '';
  const occupation = document.getElementById('cu-occupation' + s)?.value.trim() || '';
  const initBal  = parseFloat(document.getElementById('cu-initbal'+ s).value) || 0;

  if (!agentId)       return toast('Select an agent', 'error');
  if (!fn || !ln)     return toast('Enter full name', 'error');
  if (!phone)         return toast('Enter phone number', 'error');

  const noks = collectNokData(sfx);
  if (noks.length === 0)
    return toast('At least one next of kin is required', 'error');
  const invalidNok = noks.find(n => !n.name || !n.relationship || !n.phone);
  if (invalidNok)
    return toast('Fill in name, relationship, and phone for all next of kin', 'error');

  const agent = AGENTS.find(a => a.id === agentId);
  if (!agent) return toast('Agent not found', 'error');

  // Show loader ──────────────────────────────────────
  custShowLoader('Registering customer...', `${fn} ${ln}`);

  setTimeout(() => {
    const pfx       = getPrefix(activeCustType);
    const agentNum  = pad2(agent.agentNumber);
    const agentCode = pfx + agentNum;
    const seq       = getNextAcctNum(activeCustType, agentCode);
    const rawAcct   = `${agentCode}-${seq}`;
    const acctNumber = _ensureUniqueAcct(rawAcct);
    // Consume the vacated slot if one was used
    _consumeVacated(activeCustType, agentCode, seq);

    const pendingPhoto = sfx === 'b' ? pendingCustomerPhotoB : pendingCustomerPhoto;

    const customer = {
      id: uid(), type: activeCustType, agentId,
      agentCode, acctNumber,
      firstName: fn, lastName: ln, phone, dob, gender,
      idType, idNum, address, town, occupation,
      nextOfKin : noks,
      balance   : initBal,
      initialDeposit: initBal,
      dateCreated: regDate,
      status    : 'active',
      photo     : pendingPhoto || null,
      transactions: []
    };

    if (initBal > 0) {
      customer.transactions.push({
        id: uid(), type: 'deposit', desc: 'Initial deposit',
        amount: initBal, balance: initBal,
        date: regDate, by: currentUser?.name || 'System'
      });
    }

    CUSTOMERS.push(customer);
    sendSMS(customer, 'registration');

    // Reset the correct form
    ['fname','lname','phone','dob','regdate','address','town','occupation','idnum','initbal','gender'].forEach(f => {
      const el = document.getElementById('cu-' + f + s); if (el) el.value = '';
    });
    resetNokForm(sfx);
    if (sfx === 'b') { pendingCustomerPhotoB = null; }
    else             { clearCustomerPhoto(); }

    updateAccountPreview(sfx);
    renderCustomerList('');
    populateAgentSelectors();
    logActivity('Customer', `Registered: ${fn} ${ln} (${acctNumber})`, initBal, 'active');
    saveAll();
    custHideLoader();
    toast(`Customer ${acctNumber} registered successfully`, 'success');
  }, 900);
}

// ─────────────────────────────────────────────────────
//  NEXT OF KIN HELPERS  (suffix-aware)
// ─────────────────────────────────────────────────────
// nokCount / nokCountB are declared at the top of the file

function _nokListId(sfx)   { return 'nok-list'    + (sfx ? '-' + sfx : ''); }
function _nokAddBtnId(sfx) { return 'nok-add-btn' + (sfx ? '-' + sfx : ''); }
function _nokPfx(sfx)      { return sfx ? sfx + '-nok' : 'nok'; }

function addNokRow(sfx) {
  sfx = sfx || '';
  const count = sfx === 'b' ? nokCountB : nokCount;
  if (count >= 3) return toast('Maximum 3 next of kin allowed', 'warning');
  const idx  = count;
  const pfx  = _nokPfx(sfx);
  const row  = document.createElement('div');
  row.className = 'nok-row';
  row.id = `${pfx}-${idx}`;
  row.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px';
  row.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="text-gold" style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:1px">Next of Kin #${idx + 1}</span>
      <button type="button" class="btn btn-danger btn-xs" onclick="removeNokRow(${idx},'${sfx}')">✕ Remove</button>
    </div>
    <div class="form-row-3">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-control" id="${pfx}-name-${idx}" placeholder="Full name">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Relationship</label>
        <select class="form-control" id="${pfx}-rel-${idx}">
          <option value="">-- Select --</option>
          <option value="Spouse">Spouse</option>
          <option value="Parent">Parent</option>
          <option value="Child">Child</option>
          <option value="Sibling">Sibling</option>
          <option value="Grandparent">Grandparent</option>
          <option value="Uncle/Aunt">Uncle/Aunt</option>
          <option value="Nephew/Niece">Nephew/Niece</option>
          <option value="Friend">Friend</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Phone Number</label>
        <input type="text" class="form-control" id="${pfx}-phone-${idx}" placeholder="0XX XXX XXXX">
      </div>
    </div>`;
  document.getElementById(_nokListId(sfx))?.appendChild(row);
  if (sfx === 'b') nokCountB++; else nokCount++;
  const c2 = sfx === 'b' ? nokCountB : nokCount;
  if (c2 >= 3) {
    const btn = document.getElementById(_nokAddBtnId(sfx));
    if (btn) btn.style.display = 'none';
  }
}

function removeNokRow(idx, sfx) {
  sfx = sfx || '';
  const pfx = _nokPfx(sfx);
  const row = document.getElementById(`${pfx}-${idx}`);
  if (row) row.remove();
  if (sfx === 'b') nokCountB--; else nokCount--;
  const btn = document.getElementById(_nokAddBtnId(sfx));
  if (btn) btn.style.display = '';
}

function collectNokData(sfx) {
  sfx = sfx || '';
  const count = sfx === 'b' ? nokCountB : nokCount;
  const pfx   = _nokPfx(sfx);
  const noks  = [];
  for (let i = 0; i < count; i++) {
    const name = document.getElementById(`${pfx}-name-${i}`)?.value.trim()  || '';
    const rel  = document.getElementById(`${pfx}-rel-${i}`)?.value          || '';
    const ph   = document.getElementById(`${pfx}-phone-${i}`)?.value.trim() || '';
    if (name || rel || ph) noks.push({ name, relationship: rel, phone: ph });
  }
  return noks;
}

function resetNokForm(sfx) {
  sfx = sfx || '';
  if (sfx === 'b') nokCountB = 1; else nokCount = 1;
  const pfx    = _nokPfx(sfx);
  const list   = document.getElementById(_nokListId(sfx));
  const addBtn = document.getElementById(_nokAddBtnId(sfx));
  if (list) {
    // Remove all except first row
    const rows = list.querySelectorAll('.nok-row');
    rows.forEach((r, i) => { if (i > 0) r.remove(); });
    // Clear first row
    const n = list.querySelector(`#${pfx}-name-0`); if (n) n.value = '';
    const r = list.querySelector(`#${pfx}-rel-0`);  if (r) r.value = '';
    const p = list.querySelector(`#${pfx}-phone-0`);if (p) p.value = '';
  }
  if (addBtn) addBtn.style.display = '';
}

// ─────────────────────────────────────────────────────
//  EDIT CUSTOMER MODAL  (FIX 2 — photo, FIX 5 — loader)
// ─────────────────────────────────────────────────────
// Show what account number the customer would get after a type change
function previewNewAcctNum(custId) {
  const c       = CUSTOMERS.find(x => x.id === custId); if (!c) return;
  const newType = document.getElementById('edit-cu-newtype')?.value;
  const preview = document.getElementById('edit-new-acct-preview');
  const warning = document.getElementById('edit-type-warning');
  if (!preview) return;
  if (!newType) {
    preview.value = '';
    if (warning) warning.style.display = 'none';
    return;
  }
  const agent    = AGENTS.find(a => a.id === c.agentId);
  if (!agent)    { preview.value = '(agent not found)'; return; }
  const pfx     = getPrefix(newType);
  const agCode  = pfx + pad2(agent.agentNumber);
  const seq     = getNextAcctNum(newType, agCode);
  preview.value = `${agCode}-${seq}`;
  if (warning) warning.style.display = '';
}

function openEditCustomerModal(id) {
  const c = CUSTOMERS.find(x => x.id === id); if (!c) return;

  // Reset pending edit photo to current photo
  pendingEditPhoto = c.photo || null;

  document.getElementById('m-edit-cust-title').textContent =
    `✏️ Edit — ${c.firstName} ${c.lastName} (${c.acctNumber})`;

  const agentOptions = AGENTS.map(a =>
    `<option value="${a.id}" ${a.id === c.agentId ? 'selected' : ''}>
      ${a.firstName} ${a.lastName} (${a.code})
     </option>`
  ).join('');

  const relOptions = val => ['','Spouse','Parent','Child','Sibling','Grandparent',
    'Uncle/Aunt','Nephew/Niece','Friend','Other']
    .map(r => `<option value="${r}" ${r === val ? 'selected' : ''}>${r || '-- Select --'}</option>`)
    .join('');

  const noks = (c.nextOfKin && c.nextOfKin.length)
    ? c.nextOfKin
    : [{ name: '', relationship: '', phone: '' }];

  const nokRowsHTML = noks.map((n, i) => `
    <div class="nok-row" id="edit-nok-${i}"
      style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="text-gold" style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:1px">
          Next of Kin #${i + 1}
        </span>
        ${i > 0 ? `<button type="button" class="btn btn-danger btn-xs" onclick="removeEditNokRow(${i})">✕ Remove</button>` : ''}
      </div>
      <div class="form-row-3">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Full Name</label>
          <input type="text" class="form-control" id="edit-nok-name-${i}" value="${n.name || ''}" placeholder="Full name">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Relationship</label>
          <select class="form-control" id="edit-nok-rel-${i}">${relOptions(n.relationship)}</select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Phone Number</label>
          <input type="text" class="form-control" id="edit-nok-phone-${i}" value="${n.phone || ''}" placeholder="0XX XXX XXXX">
        </div>
      </div>
    </div>`).join('');

  // Photo preview for edit
  const currentPhotoSrc = c.photo || null;
  const photoPreviewHTML = currentPhotoSrc
    ? `<img src="${currentPhotoSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : '👤';

  document.getElementById('m-edit-cust-body').innerHTML = `
    <div style="background:var(--gold-dim);border:1px solid var(--border);
      border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:18px;font-size:.8rem">
      ⚠️ Account number <strong class="mono">${c.acctNumber}</strong> and type
      <strong>${c.type}</strong> cannot be changed after registration.
    </div>

    <!-- FIX 2: Profile photo (editable) -->
    <div class="form-group">
      <label class="form-label">Profile Photo
        <span class="text-muted" style="font-size:.68rem;text-transform:none;letter-spacing:0">(Optional)</span>
      </label>
      <div style="display:flex;align-items:center;gap:14px">
        <div id="edit-photo-preview"
          style="width:72px;height:72px;border-radius:50%;background:var(--surface2);
            border:2px dashed var(--border);display:flex;align-items:center;
            justify-content:center;font-size:1.6rem;flex-shrink:0;overflow:hidden;cursor:pointer"
          onclick="document.getElementById('edit-photo-input').click()"
          title="Click to change photo">
          ${photoPreviewHTML}
        </div>
        <div>
          <input type="file" id="edit-photo-input" accept="image/*"
            style="display:none" onchange="previewEditPhoto(this)">
          <button type="button" class="btn btn-outline btn-sm"
            onclick="document.getElementById('edit-photo-input').click()">
            📷 Change Photo
          </button>
          <button type="button" class="btn btn-ghost btn-sm"
            onclick="clearEditPhoto(${currentPhotoSrc ? "'"+currentPhotoSrc+"'" : 'null'})">
            ✕ Remove
          </button>
          <div class="input-hint">JPG, PNG, GIF — max 2MB. Click photo to change.</div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Assigned Agent</label>
      <select class="form-control" id="edit-cu-agent">
        <option value="">-- Select Agent --</option>
        ${agentOptions}
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">First Name</label>
        <input type="text" class="form-control" id="edit-cu-fname" value="${c.firstName}" placeholder="First name">
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input type="text" class="form-control" id="edit-cu-lname" value="${c.lastName}" placeholder="Last name">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input type="text" class="form-control" id="edit-cu-phone" value="${c.phone || ''}" placeholder="0XX XXX XXXX">
      </div>
      <div class="form-group">
        <label class="form-label">Date of Birth</label>
        <input type="date" class="form-control" id="edit-cu-dob" value="${c.dob || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Gender</label>
        <select class="form-control" id="edit-cu-gender">
          <option value="">-- Select --</option>
          <option value="Male"   ${c.gender === 'Male'   ? 'selected' : ''}>Male</option>
          <option value="Female" ${c.gender === 'Female' ? 'selected' : ''}>Female</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">ID Type</label>
        <select class="form-control" id="edit-cu-idtype">
          <option ${c.idType === 'National ID'      ? 'selected' : ''}>National ID</option>
          <option ${c.idType === "Voter's Card"      ? 'selected' : ''}>Voter's Card</option>
          <option ${c.idType === 'Passport'          ? 'selected' : ''}>Passport</option>
          <option ${c.idType === "Driver's License"  ? 'selected' : ''}>Driver's License</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">ID Number</label>
        <input type="text" class="form-control" id="edit-cu-idnum" value="${c.idNum || ''}" placeholder="ID number">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Residential Address</label>
      <input type="text" class="form-control" id="edit-cu-address" value="${c.address || ''}" placeholder="Customer's address">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Town / City</label>
        <input type="text" class="form-control" id="edit-cu-town" value="${c.town || ''}" placeholder="e.g. Kumasi, Accra, Takoradi">
      </div>
      <div class="form-group">
        <label class="form-label">Occupation</label>
        <input type="text" class="form-control" id="edit-cu-occupation" value="${c.occupation || ''}" placeholder="e.g. Trader, Teacher, Farmer">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Registration Date</label>
        <input type="date" class="form-control" id="edit-cu-regdate" value="${c.dateCreated || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-control" id="edit-cu-status">
          <option value="active"    ${c.status === 'active'    ? 'selected' : ''}>Active</option>
          <option value="inactive"  ${c.status === 'inactive'  ? 'selected' : ''}>Inactive</option>
          <option value="suspended" ${c.status === 'suspended' ? 'selected' : ''}>Suspended</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Initial Deposit (GH₵)</label>
        <input type="number" class="form-control" id="edit-cu-initbal"
          value="${c.initialDeposit ?? c.balance ?? 0}"
          min="0" step="0.01" placeholder="0.00">
        <div class="input-hint">
          Current balance: <strong class="mono">${fmt(c.balance || 0)}</strong>.
          Editing this sets the customer's balance to the entered amount.
        </div>
      </div>
      <div class="form-group">
        <div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);
          border-radius:var(--radius-sm);font-size:.8rem;margin-top:20px">
          <div class="text-muted" style="font-size:.72rem;margin-bottom:4px">Original Initial Deposit</div>
          <div class="mono fw-600 text-gold">${fmt(c.initialDeposit || 0)}</div>
        </div>
      </div>
    </div>

    <!-- ── Account Type Change ── -->
    <div class="form-group" style="margin-top:4px;padding:14px;background:rgba(232,93,93,.05);
      border:1px solid rgba(232,93,93,.18);border-radius:var(--radius)">
      <div class="flex-between" style="margin-bottom:8px">
        <div>
          <div class="fw-600" style="font-size:.84rem">🔄 Change Account Type</div>
          <div class="text-muted" style="font-size:.74rem;margin-top:2px">
            Moves this customer to a different account type with a new account number.
            Current account number <strong class="mono">${c.acctNumber}</strong> will be freed for reuse.
          </div>
        </div>
      </div>
      <div class="form-row" style="align-items:flex-end">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Change To</label>
          <select class="form-control" id="edit-cu-newtype" onchange="previewNewAcctNum('${c.id}')">
            <option value="">-- Keep current type (${c.type}) --</option>
            ${['susu','lending','savings'].filter(t => t !== c.type).map(t =>
              `<option value="${t}">${t === 'lending' ? 'Lending Deposit' : t.charAt(0).toUpperCase() + t.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">New Account Number (preview)</label>
          <input type="text" class="form-control" id="edit-new-acct-preview"
            readonly placeholder="Select a type above"
            style="background:var(--surface2);color:var(--gold);font-family:'JetBrains Mono',monospace;font-weight:700">
        </div>
      </div>
      <div class="alert alert-warning" style="margin-top:8px;font-size:.78rem;display:none" id="edit-type-warning">
        ⚠️ This action reassigns the account number and cannot be undone without re-editing.
      </div>
    </div>

    <div class="form-group" style="margin-top:6px">
      <label class="form-label">Next of Kin
        <span class="text-muted" style="font-size:.68rem;text-transform:none;letter-spacing:0">
          (Minimum 1, Maximum 3)
        </span>
      </label>
      <div id="edit-nok-list">${nokRowsHTML}</div>
      <button type="button" class="btn btn-outline btn-sm" id="edit-nok-add-btn"
        onclick="addEditNokRow()"
        style="${noks.length >= 3 ? 'display:none' : ''}">
        + Add Another Next of Kin
      </button>
    </div>

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal('modal-edit-customer')">Cancel</button>
      <button class="btn btn-gold" onclick="saveEditCustomer('${id}')">💾 Save Changes</button>
    </div>`;

  window._editNokCount = noks.length;
  closeModal('modal-customer');
  openModal('modal-edit-customer');
}

function addEditNokRow() {
  if (window._editNokCount >= 3) return toast('Maximum 3 next of kin allowed', 'warning');
  const idx = window._editNokCount;
  const relOptions = ['','Spouse','Parent','Child','Sibling','Grandparent',
    'Uncle/Aunt','Nephew/Niece','Friend','Other']
    .map(r => `<option value="${r}">${r || '-- Select --'}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'nok-row';
  row.id = `edit-nok-${idx}`;
  row.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px';
  row.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="text-gold" style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:1px">Next of Kin #${idx + 1}</span>
      <button type="button" class="btn btn-danger btn-xs" onclick="removeEditNokRow(${idx})">✕ Remove</button>
    </div>
    <div class="form-row-3">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-control" id="edit-nok-name-${idx}" placeholder="Full name">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Relationship</label>
        <select class="form-control" id="edit-nok-rel-${idx}">${relOptions}</select>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Phone Number</label>
        <input type="text" class="form-control" id="edit-nok-phone-${idx}" placeholder="0XX XXX XXXX">
      </div>
    </div>`;
  document.getElementById('edit-nok-list').appendChild(row);
  window._editNokCount++;
  if (window._editNokCount >= 3) {
    const btn = document.getElementById('edit-nok-add-btn');
    if (btn) btn.style.display = 'none';
  }
}

function removeEditNokRow(idx) {
  const row = document.getElementById(`edit-nok-${idx}`);
  if (row) row.remove();
  window._editNokCount--;
  const btn = document.getElementById('edit-nok-add-btn');
  if (btn) btn.style.display = '';
}

function collectEditNokData() {
  const noks = [];
  for (let i = 0; i < 3; i++) {
    const row = document.getElementById(`edit-nok-${i}`);
    if (!row) continue;
    const name  = document.getElementById(`edit-nok-name-${i}`)?.value.trim();
    const rel   = document.getElementById(`edit-nok-rel-${i}`)?.value;
    const phone = document.getElementById(`edit-nok-phone-${i}`)?.value.trim();
    if (name || rel || phone)
      noks.push({ name: name || '', relationship: rel || '', phone: phone || '' });
  }
  return noks;
}

// FIX 5 — loader on save edit
function saveEditCustomer(id) {
  const c = CUSTOMERS.find(x => x.id === id); if (!c) return;

  const agentId  = document.getElementById('edit-cu-agent').value;
  const fn       = document.getElementById('edit-cu-fname').value.trim();
  const ln       = document.getElementById('edit-cu-lname').value.trim();
  const phone    = document.getElementById('edit-cu-phone').value.trim();
  const dob      = document.getElementById('edit-cu-dob').value;
  const gender   = document.getElementById('edit-cu-gender')?.value || '';
  const idType   = document.getElementById('edit-cu-idtype').value;
  const idNum    = document.getElementById('edit-cu-idnum').value.trim();
  const address  = document.getElementById('edit-cu-address').value.trim();
  const town     = document.getElementById('edit-cu-town')?.value.trim() || '';
  const occupation = document.getElementById('edit-cu-occupation')?.value.trim() || '';
  const regDate  = document.getElementById('edit-cu-regdate').value;
  const status   = document.getElementById('edit-cu-status').value;
  const newInitial = parseFloat(document.getElementById('edit-cu-initbal')?.value) || 0;
  const newType  = document.getElementById('edit-cu-newtype')?.value || '';  // '' = no change

  if (!agentId)     return toast('Select an agent', 'error');
  if (!fn || !ln)   return toast('Enter full name', 'error');
  if (!phone)       return toast('Enter phone number', 'error');

  // If type change requested, ensure preview shows a valid number
  if (newType) {
    const previewEl = document.getElementById('edit-new-acct-preview');
    if (!previewEl?.value || previewEl.value.includes('(')) {
      return toast('Preview account number is missing — select a type to change to', 'error');
    }
  }

  const noks = collectEditNokData();
  if (noks.length === 0) return toast('At least one next of kin is required', 'error');
  const invalidNok = noks.find(n => !n.name || !n.relationship || !n.phone);
  if (invalidNok)   return toast('Fill in name, relationship and phone for all next of kin', 'error');

  custShowLoader('Saving changes...', `${fn} ${ln}`);

  setTimeout(() => {
    const agent = AGENTS.find(a => a.id === agentId);
    if (agent && agentId !== c.agentId) {
      c.agentId   = agentId;
      c.agentCode = getPrefix(c.type) + pad2(agent.agentNumber);
    }

    // ── Account type change ─────────────────────────
    if (newType && newType !== c.type) {
      const oldType    = c.type;
      const oldAcctNum = c.acctNumber;
      const oldAgCode  = c.agentCode;
      // Extract old sequence (e.g. 'TN01-0001' → '0001')
      const oldSeq     = oldAcctNum.split('-').pop();

      // Free the old account number for reuse
      if (!VACATED_ACCOUNTS) window.VACATED_ACCOUNTS = [];
      VACATED_ACCOUNTS.push({ type: oldType, agentCode: oldAgCode, seq: oldSeq });

      // Assign new account number (uses vacated slot if one exists for newType)
      const newPfx     = getPrefix(newType);
      const curAgent   = AGENTS.find(a => a.id === (agentId || c.agentId));
      const newAgCode  = newPfx + pad2(curAgent.agentNumber);
      const newSeq     = getNextAcctNum(newType, newAgCode);
      const newAcctNum = _ensureUniqueAcct(`${newAgCode}-${newSeq}`);
      _consumeVacated(newType, newAgCode, newSeq);

      c.type       = newType;
      c.agentCode  = newAgCode;
      c.acctNumber = newAcctNum;

      logActivity('Customer',
        `Account type changed: ${oldAcctNum} (${oldType}) → ${newAcctNum} (${newType}) for ${fn} ${ln}`,
        0, 'updated');
    }

    c.firstName   = fn;
    c.lastName    = ln;
    c.phone       = phone;
    c.dob         = dob;
    c.gender      = gender;
    c.idType      = idType;
    c.idNum       = idNum;
    c.address     = address;
    c.town        = town;
    c.occupation  = occupation;
    c.dateCreated = regDate || c.dateCreated;
    c.status      = status;
    c.nextOfKin   = noks;

    // Apply initial deposit edit — the entered value becomes the customer's current balance.
    // It does NOT add to the existing balance; it replaces it.
    if (newInitial !== (c.initialDeposit || 0) || newInitial !== c.balance) {
      c.initialDeposit = Math.round(newInitial * 100) / 100;
      c.balance        = Math.round(newInitial * 100) / 100;
    }

    // FIX 2 — save edited photo
    // pendingEditPhoto is null  → keep existing
    // pendingEditPhoto is ''    → user removed photo
    // pendingEditPhoto is data: → new photo
    if (pendingEditPhoto !== null) c.photo = pendingEditPhoto || null;
    pendingEditPhoto = null;

    saveAll();
    renderCustomerList('');
    custHideLoader();
    closeModal('modal-edit-customer');
    toast(`${fn} ${ln}'s details updated successfully`, 'success');
    setTimeout(() => openCustomerModal(id), 200);
  }, 900);
}

// ─────────────────────────────────────────────────────
//  CUSTOMER LIST  (FIX 1 — clickable name/avatar)
// ─────────────────────────────────────────────────────
function renderCustomerList(search) {
  const tb = document.getElementById('cust-tbody'); if (!tb) return;

  const isAgent = currentUser?.role === 'agent';

  // Tab visibility
  const delTab = document.getElementById('cu-deleted-tab');
  if (delTab) delTab.style.display = (currentUser?.role === 'admin') ? '' : 'none';
  const expTab = document.getElementById('cu-exportimport-tab');
  if (expTab) expTab.style.display = (currentUser?.role === 'admin') ? '' : 'none';
  const lnEiTab = document.getElementById('ln-exportimport-tab');
  if (lnEiTab) lnEiTab.style.display = (currentUser?.role === 'admin') ? '' : 'none';

  // Hide All Customers tab for agent role
  const allTab = document.querySelector('#view-customers .sub-tab[onclick*="\'list\'"]');
  if (allTab) allTab.style.display = isAgent ? 'none' : '';

  // ── Populate agent filter dropdown (admin/teller only) ──
  const agentFilterEl = document.getElementById('cu-agent-filter');
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
    // Restore selection
    if (currentVal) agentFilterEl.value = currentVal;
  }
  if (agentFilterEl) agentFilterEl.style.display = isAgent ? 'none' : '';

  // ── Active filter value ──
  const agentFilterVal = isAgent ? '' : (agentFilterEl?.value || '');

  // For agent role: bind to session agent
  const sessionAgent = isAgent && typeof _getSessionAgent === 'function' ? _getSessionAgent() : null;
  const agentRoleFilter = sessionAgent ? (c => c.agentId === sessionAgent.id) : () => true;

  // ── Badge counts (respect agent role scope) ──
  const sb  = document.getElementById('cu-susu-badge');
  const lb  = document.getElementById('cu-ld-badge');
  const svb = document.getElementById('cu-sav-badge');
  const baseList = isAgent && sessionAgent
    ? CUSTOMERS.filter(c => c.agentId === sessionAgent.id)
    : CUSTOMERS;
  if (sb)  sb.textContent = baseList.filter(c => c.type === 'susu').length    + ' Susu';
  if (lb)  lb.textContent = baseList.filter(c => c.type === 'lending').length + ' Lending';
  if (svb) svb.textContent= baseList.filter(c => c.type === 'savings').length + ' Savings';

  // ── Count unassigned and show/hide button ──
  const noAgentCount = CUSTOMERS.filter(c => !c.agentId).length;
  const assignBtn = document.getElementById('cu-assign-noagent-btn');
  if (assignBtn) {
    assignBtn.style.display = (noAgentCount > 0 && !isAgent) ? '' : 'none';
    assignBtn.textContent   = `🔗 Assign Unassigned (${noAgentCount})`;
  }

  // ── Build filtered list ──
  let list = isAgent && sessionAgent
    ? CUSTOMERS.filter(c => c.agentId === sessionAgent.id)
    : CUSTOMERS;

  // Apply agent filter
  if (agentFilterVal === '__none__') {
    list = list.filter(c => !c.agentId);
  } else if (agentFilterVal) {
    list = list.filter(c => c.agentId === agentFilterVal);
  }

  // Apply search
  if (search) list = list.filter(c =>
    `${c.firstName} ${c.lastName} ${c.acctNumber}`.toLowerCase()
      .includes(search.toLowerCase()));

  if (!list.length) {
    const msg = agentFilterVal === '__none__'
      ? 'No customers without an agent'
      : agentFilterVal
        ? 'No customers found for this agent'
        : 'No customers found';
    tb.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:28px">${msg}</td></tr>`;
    return;
  }

  tb.innerHTML = list.map((c, i) => {
    const agent = AGENTS.find(a => a.id === c.agentId);
    const typeColors = { susu: 'b-gold', lending: 'b-blue', savings: 'b-green' };
    // FIX 1 — avatar and name are clickable
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
      <td class="text-muted">${i + 1}</td>
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
        ${currentUser?.role !== 'agent' ? `<button class="btn btn-danger btn-xs" onclick="softDeleteCustomer('${c.id}')">🗑</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function renderCustomerByType(type) {
  const contentId = `cu-${type}-content`;
  const el = document.getElementById(contentId); if (!el) return;
  const isAgent     = currentUser?.role === 'agent';
  const sessionAgent = isAgent && typeof _getSessionAgent === 'function' ? _getSessionAgent() : null;
  const list = CUSTOMERS.filter(c =>
    c.type === type && (!sessionAgent || c.agentId === sessionAgent.id)
  );
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="ei">👥</div>
      <div class="et">No ${type} customers yet</div></div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Account No.</th><th>Name</th><th>Agent</th>
      <th>Phone</th><th>Balance</th><th>Date Created</th><th>Action</th></tr></thead>
    <tbody>${list.map((c, i) => {
      const agent = AGENTS.find(a => a.id === c.agentId);
      return `<tr>
        <td class="text-muted">${i + 1}</td>
        <td class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</td>
        <td class="fw-600">${c.firstName} ${c.lastName}</td>
        <td>${agent ? agent.firstName + ' ' + agent.lastName : '—'}</td>
        <td>${c.phone || '—'}</td>
        <td class="mono">${fmt(c.balance || 0)}</td>
        <td>${fmtDate(c.dateCreated)}</td>
        <td>
          <button class="btn btn-gold btn-xs" onclick="openCustomerModal('${c.id}')">View</button>
          <button class="btn btn-outline btn-xs" onclick="openCustomerTxn('${c.id}')">Txns</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ─────────────────────────────────────────────────────
//  VIEW MODAL  (FIX 1 — clickable photo lightbox)
//              (FIX 4 — View Transactions → page)
// ─────────────────────────────────────────────────────
function openCustomerModal(id) {
  const c = CUSTOMERS.find(x => x.id === id); if (!c) return;
  const agent       = AGENTS.find(a => a.id === c.agentId);
  const activeLoans = LOANS.filter(l => l.customerId === id && l.status === 'active');

  // FIX 1 — photo is clickable (lightbox)
  const photoHTML = c.photo
    ? `<img src="${c.photo}"
         onclick="showPhotoLightbox('${c.photo}','${c.firstName} ${c.lastName}')"
         style="width:72px;height:72px;border-radius:50%;object-fit:cover;
           border:3px solid var(--gold);flex-shrink:0;cursor:pointer"
         title="Click to enlarge">`
    : `<div style="width:72px;height:72px;border-radius:50%;
         background:linear-gradient(135deg,var(--gold),#a8851c);
         display:flex;align-items:center;justify-content:center;
         font-size:1.6rem;font-weight:700;color:#08142a;flex-shrink:0;
         font-family:'Playfair Display',serif">
         ${c.firstName[0]}${c.lastName[0]}
       </div>`;

  const nokHTML = (c.nextOfKin && c.nextOfKin.length)
    ? c.nextOfKin.map((n, i) => `
        <div style="display:flex;gap:14px;flex-wrap:wrap;padding:9px 12px;
          background:var(--surface2);border:1px solid var(--border);
          border-radius:var(--radius-sm);margin-bottom:6px">
          <div style="min-width:120px">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">NOK ${i + 1}</div>
            <div class="fw-600" style="font-size:.83rem">${n.name || '—'}</div>
          </div>
          <div style="min-width:100px">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Relationship</div>
            <div style="font-size:.83rem">${n.relationship || '—'}</div>
          </div>
          <div style="min-width:120px">
            <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Phone</div>
            <div style="font-size:.83rem">${n.phone || '—'}</div>
          </div>
        </div>`).join('')
    : '<div class="text-muted" style="font-size:.8rem;padding:8px 0">No next of kin recorded</div>';

  document.getElementById('m-cust-title').textContent =
    `${c.firstName} ${c.lastName} — ${c.acctNumber}`;

  document.getElementById('m-cust-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;
      background:var(--surface2);border:1px solid var(--border);
      border-radius:var(--radius);margin-bottom:18px">
      ${photoHTML}
      <div>
        <div class="fw-600" style="font-size:1rem">${c.firstName} ${c.lastName}</div>
        <div class="mono text-gold" style="font-size:.82rem">${c.acctNumber}</div>
        <div style="margin-top:4px">
          <span class="badge ${c.type==='susu'?'b-gold':c.type==='lending'?'b-blue':'b-green'}">${c.type}</span>
          <span class="badge ${c.status==='active'?'b-green':'b-gray'}" style="margin-left:4px">${c.status}</span>
        </div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">ACCOUNT NO.</div><div class="mono text-gold fw-600">${c.acctNumber}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">ACCOUNT TYPE</div><div><span class="badge ${c.type==='susu'?'b-gold':c.type==='lending'?'b-blue':'b-green'}">${c.type}</span></div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">PHONE</div><div>${c.phone || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">AGENT</div><div>${agent ? agent.firstName + ' ' + agent.lastName + ' (' + agent.code + ')' : '—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">DATE OF BIRTH</div><div>${fmtDate(c.dob)}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">DATE REGISTERED</div><div>${fmtDate(c.dateCreated)}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">ID TYPE</div><div>${c.idType || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">ID NUMBER</div><div class="mono">${c.idNum || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">ADDRESS</div><div>${c.address || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">TOWN / CITY</div><div>${c.town || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">OCCUPATION</div><div>${c.occupation || '—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px">BALANCE</div><div class="mono text-gold fw-600" style="font-size:1.1rem">${fmt(c.balance || 0)}</div></div>
    </div>

    <div style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:8px"><span>👨‍👩‍👧</span> Next of Kin</div>
      ${nokHTML}
    </div>

    <div class="grid-2 mb-4">
      <div style="padding:12px 16px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.18);border-radius:var(--radius-sm)">
        <div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">TOTAL TRANSACTIONS</div>
        <div class="mono text-success fw-600" style="font-size:1.1rem">${(c.transactions || []).length}</div>
      </div>
      <div style="padding:12px 16px;background:rgba(74,144,217,.08);border:1px solid rgba(74,144,217,.18);border-radius:var(--radius-sm)">
        <div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">ACTIVE LOANS</div>
        <div class="mono text-info fw-600" style="font-size:1.1rem">${activeLoans.length}</div>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <!-- FIX 4 — View Transactions navigates to the page panel -->
      <button class="btn btn-gold btn-sm"
        onclick="closeModal('modal-customer');openCustomerTxn('${id}')">
        📋 View Transactions
      </button>
      ${currentUser?.role !== 'agent' ? `<button class="btn btn-outline btn-sm" onclick="openDepositModal('${id}')">💰 Deposit</button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="openWithdrawModal('${id}')">💸 Withdraw</button>
      <button class="btn btn-info btn-sm" onclick="openEditCustomerModal('${id}')">✏️ Edit Customer</button>
    </div>`;

  openModal('modal-customer');
}

// ─────────────────────────────────────────────────────
//  TRANSACTIONS — ON PAGE  (FIX 3)
// ─────────────────────────────────────────────────────
function openCustomerTxn(custId) {
  // Close any open modals
  ['modal-customer','modal-edit-customer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });

  // Navigate to customers view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const custView = document.getElementById('view-customers');
  if (custView) custView.classList.add('active');
  document.getElementById('page-title').textContent = 'Customers';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const custNav = document.querySelector('.nav-item[onclick*="\'customers\'"]');
  if (custNav) custNav.classList.add('active');

  // Switch to cu-txn sub-panel (deactivate all others first)
  document.querySelectorAll('#view-customers .teller-sub').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#view-customers .sub-tab').forEach(b => b.classList.remove('active'));

  const txnPanel = document.getElementById('cu-txn');
  if (!txnPanel) return;
  txnPanel.classList.add('active');

  const c = CUSTOMERS.find(x => x.id === custId);
  if (!c) { txnPanel.innerHTML = '<div class="empty-state"><div class="ei">❌</div><div class="et">Customer not found</div></div>'; return; }

  // Sort transactions ascending (oldest → newest)
  const txns = [...(c.transactions || [])].sort((a, b) => {
    const da = new Date((a.date || '') + 'T' + (a.time ? a.time.slice(11,19) : '00:00:00'));
    const db = new Date((b.date || '') + 'T' + (b.time ? b.time.slice(11,19) : '00:00:00'));
    return da - db;
  });

  const typeLabels = {
    deposit      : { label: 'Deposit',      badge: 'b-green',  sign: '+', color: 'text-success' },
    withdrawal   : { label: 'Withdrawal',   badge: 'b-red',    sign: '−', color: 'text-danger'  },
    fee          : { label: 'Fee',           badge: 'b-yellow', sign: '−', color: 'text-warning' },
    advance      : { label: 'Advance',       badge: 'b-yellow', sign: '−', color: 'text-warning' },
    commission   : { label: 'Commission',    badge: 'b-gold',   sign: '−', color: 'text-warning' },
    transfer_in  : { label: 'Transfer In',   badge: 'b-blue',   sign: '+', color: 'text-info'    },
    transfer_out : { label: 'Transfer Out',  badge: 'b-purple', sign: '−', color: 'text-danger'  },
    entry        : { label: 'Collection',    badge: 'b-green',  sign: '+', color: 'text-success' },
  };

  const photoHTML = c.photo
    ? `<img src="${c.photo}"
         style="width:44px;height:44px;border-radius:50%;object-fit:cover;
           border:2px solid var(--gold);flex-shrink:0;cursor:pointer"
         onclick="showPhotoLightbox('${c.photo}','${c.firstName} ${c.lastName}')">`
    : `<div style="width:44px;height:44px;border-radius:50%;
         background:linear-gradient(135deg,var(--gold),#a8851c);
         display:flex;align-items:center;justify-content:center;
         font-size:1rem;font-weight:700;color:#08142a;flex-shrink:0">
         ${c.firstName[0]}${c.lastName[0]}
       </div>`;

  const totalIn  = txns.filter(t => ['deposit','transfer_in','entry'].includes(t.type))
    .reduce((s,t) => s + t.amount, 0);
  const totalOut = txns.filter(t => ['withdrawal','fee','advance','commission','transfer_out'].includes(t.type))
    .reduce((s,t) => s + t.amount, 0);

  txnPanel.innerHTML = `
    <!-- Back bar -->
    <div class="flex-between mb-4" style="flex-wrap:wrap;gap:8px">
      <button class="btn btn-outline btn-sm" onclick="backToCustomerList()">
        ← Back to Customers
      </button>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        ${currentUser?.role !== 'agent' ? `<button class="btn btn-gold btn-xs" onclick="openDepositModal('${custId}')">💰 Deposit</button>` : ''}
        <button class="btn btn-outline btn-xs" onclick="openWithdrawModal('${custId}')">💸 Withdraw</button>
        <button class="btn btn-info btn-xs" onclick="openCustomerModal('${custId}')">👤 View Profile</button>
      </div>
    </div>

    <!-- Customer header -->
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
      background:var(--surface);border:1px solid var(--border);
      border-radius:var(--radius);margin-bottom:16px">
      ${photoHTML}
      <div style="flex:1">
        <div class="fw-600">${c.firstName} ${c.lastName}</div>
        <div class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</div>
      </div>
      <div style="text-align:right">
        <div class="text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px">
          Current Balance
        </div>
        <div class="mono text-gold fw-600" style="font-size:1.15rem">${fmt(c.balance || 0)}</div>
      </div>
    </div>

    <!-- Summary strip -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="padding:10px 12px;background:rgba(46,204,138,.08);
        border:1px solid rgba(46,204,138,.18);border-radius:var(--radius-sm);text-align:center">
        <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Total In</div>
        <div class="mono text-success fw-600">${fmt(totalIn)}</div>
      </div>
      <div style="padding:10px 12px;background:rgba(232,93,93,.08);
        border:1px solid rgba(232,93,93,.18);border-radius:var(--radius-sm);text-align:center">
        <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Total Out</div>
        <div class="mono text-danger fw-600">${fmt(totalOut)}</div>
      </div>
      <div style="padding:10px 12px;background:var(--gold-dim);
        border:1px solid var(--border);border-radius:var(--radius-sm);text-align:center">
        <div class="text-muted" style="font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Transactions</div>
        <div class="mono text-gold fw-600">${txns.length}</div>
      </div>
    </div>

    <!-- Transaction table -->
    ${txns.length
      ? `<div class="card" style="padding:0;overflow:hidden">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>Date</th><th>Type</th><th>Description</th>
                <th>Amount</th><th>Balance After</th><th>By</th>
              </tr></thead>
              <tbody>
                ${txns.map((t, i) => {
                  // Commission rows are suppressed as standalone rows — merged
                  // into the preceding withdrawal row's amount cell instead.
                  if (t.type === 'commission') return '';

                  const meta = typeLabels[t.type] || { label: t.type, badge: 'b-gray', sign: '', color: '' };

                  // For withdrawals, look ahead for an adjacent commission on the same date.
                  let commissionLine = '';
                  if (t.type === 'withdrawal') {
                    const next = txns[i + 1];
                    if (next && next.type === 'commission' && next.date === t.date) {
                      commissionLine = '<div style="font-size:.68rem;color:var(--warning);margin-top:3px;' +
                        'border-top:1px dashed rgba(240,165,0,.25);padding-top:3px">' +
                        '− ' + fmt(next.amount) +
                        '<span style="opacity:.7;margin-left:4px">commission</span></div>';
                    }
                  }

                  return '<tr>' +
                    '<td class="text-muted" style="font-size:.74rem">' + (i + 1) + '</td>' +
                    '<td style="font-size:.76rem;white-space:nowrap">' + fmtDate(t.date) + '</td>' +
                    '<td><span class="badge ' + meta.badge + '" style="font-size:.62rem">' + meta.label + '</span></td>' +
                    '<td style="font-size:.8rem;max-width:200px">' + (t.desc || '—') + '</td>' +
                    '<td class="mono ' + meta.color + '" style="white-space:nowrap">' +
                      meta.sign + ' ' + fmt(t.amount) + commissionLine +
                    '</td>' +
                    '<td class="mono text-gold" style="font-size:.8rem;white-space:nowrap">' + fmt(t.balance) + '</td>' +
                    '<td style="font-size:.73rem;color:var(--muted)">' + (t.by || '—') + '</td>' +
                    '</tr>';
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`
      : `<div class="empty-state" style="padding:48px 0">
           <div class="ei">📋</div>
           <div class="et">No transactions yet</div>
           <div class="es">Deposits and withdrawals will appear here</div>
         </div>`
    }`;
}

// Navigate back from transactions panel to customer list
function backToCustomerList() {
  document.querySelectorAll('#view-customers .teller-sub').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#view-customers .sub-tab').forEach(b => b.classList.remove('active'));
  const listPanel = document.getElementById('cu-list');
  if (listPanel) listPanel.classList.add('active');
  const firstTab = document.querySelector('#view-customers .sub-tab');
  if (firstTab) firstTab.classList.add('active');
}

// ─────────────────────────────────────────────────────
//  DEPOSIT / WITHDRAW MODALS
// ─────────────────────────────────────────────────────
function openDepositModal(custId) {
  const c = CUSTOMERS.find(x => x.id === custId); if (!c) return;
  document.getElementById('m-cust-title').textContent = `Deposit — ${c.firstName} ${c.lastName}`;
  document.getElementById('m-cust-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Amount (GH₵)</label>
      <input type="number" class="form-control" id="dep-amount" placeholder="0.00" min="0" step="0.01">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input type="text" class="form-control" id="dep-desc" placeholder="Deposit reason">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal('modal-customer')">Cancel</button>
      <button class="btn btn-gold" onclick="doDeposit('${custId}')">✅ Deposit</button>
    </div>`;
  openModal('modal-customer');
}

function doDeposit(custId) {
  const c = CUSTOMERS.find(x => x.id === custId); if (!c) return;
  const amt  = parseFloat(document.getElementById('dep-amount').value);
  const desc = document.getElementById('dep-desc').value.trim() || 'Manual deposit';
  if (!amt || amt <= 0) return toast('Enter valid amount', 'error');
  c.balance = (c.balance || 0) + amt;
  if (!c.transactions) c.transactions = [];
  c.transactions.push({
    id: uid(), type: 'deposit', desc, amount: amt,
    balance: c.balance, date: todayISO(),
    by: currentUser?.name || 'System'
  });
  saveAll();
  closeModal('modal-customer');
  sendSMS(c, 'deposit', { amount: amt, balance: c.balance, date: todayISO() });
  toast(`${fmt(amt)} deposited to ${c.acctNumber}`, 'success');
  // Refresh txn panel if it's currently visible
  if (document.getElementById('cu-txn')?.classList.contains('active')) {
    openCustomerTxn(custId);
  }
}

// ─────────────────────────────────────────────────────
//  WITHDRAWAL REQUEST MODAL  (FIX 5 — loader)
// ─────────────────────────────────────────────────────
function openWithdrawModal(custId) {
  const c = CUSTOMERS.find(x => x.id === custId);
  if (!c) return;

  document.getElementById('m-wd-title').textContent =
    `💸 Withdrawal Request — ${c.firstName} ${c.lastName} (${c.acctNumber})`;

  document.getElementById('m-wd-body').innerHTML = `
    <div style="background:var(--gold-dim);border:1px solid var(--border);
      border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;
      display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:.82rem">Current Balance</span>
      <span class="mono text-gold fw-600" style="font-size:1.05rem">${fmt(c.balance || 0)}</span>
    </div>

    <!-- 1. Request Details -->
    <div class="card mb-4" style="padding:16px">
      <div class="card-title" style="margin-bottom:12px"><span>📋</span> Request Details</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Request Date</label>
          <input type="date" class="form-control" id="wdr-date" value="${todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label">Withdrawal Amount (GH₵)</label>
          <input type="number" class="form-control" id="wdr-amount"
            placeholder="0.00" min="0" step="0.01"
            oninput="calcWdrSummary('${custId}')">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason / Narration
          <span class="text-muted" style="font-size:.68rem;text-transform:none;letter-spacing:0">(Optional)</span>
        </label>
        <input type="text" class="form-control" id="wdr-reason" placeholder="Purpose of withdrawal...">
      </div>
    </div>

    <!-- 2. Who is Collecting -->
    <div class="card mb-4" style="padding:16px">
      <div class="card-title" style="margin-bottom:12px"><span>👤</span> Who is Collecting?</div>
      <div class="flex-between" style="padding:10px 14px;background:var(--surface2);
        border:1px solid var(--border);border-radius:var(--radius-sm)">
        <div>
          <div class="fw-600" style="font-size:.85rem">Sending a Representative</div>
          <div class="text-muted" style="font-size:.74rem">Toggle on if someone else is collecting</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="wdr-rep-toggle" onchange="toggleRepresentative()">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div id="wdr-owner-info" style="margin-top:10px;padding:10px 14px;
        background:rgba(46,204,138,.07);border:1px solid rgba(46,204,138,.18);
        border-radius:var(--radius-sm);font-size:.83rem">
        <span class="text-success">✅ Owner collecting:</span>
        <strong>${c.firstName} ${c.lastName}</strong> · ${c.phone || 'No phone'}
      </div>
      <div id="wdr-rep-details" style="display:none;margin-top:12px">
        <div style="background:rgba(240,165,0,.07);border:1px solid rgba(240,165,0,.2);
          border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;
          font-size:.78rem;color:var(--warning)">
          ⚠️ Collect a valid ID from the representative before approving.
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Representative's Full Name</label>
            <input type="text" class="form-control" id="wdr-rep-name" placeholder="Full name"></div>
          <div class="form-group"><label class="form-label">Phone Number</label>
            <input type="text" class="form-control" id="wdr-rep-phone" placeholder="0XX XXX XXXX"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Relationship to Customer</label>
            <select class="form-control" id="wdr-rep-rel">
              <option value="">-- Select --</option>
              <option>Spouse</option><option>Parent</option><option>Child</option>
              <option>Sibling</option><option>Grandparent</option><option>Uncle/Aunt</option>
              <option>Nephew/Niece</option><option>Friend</option><option>Other</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">ID Type</label>
            <select class="form-control" id="wdr-rep-idtype">
              <option>National ID</option><option>Voter's Card</option>
              <option>Passport</option><option>Driver's License</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label class="form-label">ID Number</label>
          <input type="text" class="form-control" id="wdr-rep-idnum" placeholder="Representative's ID number">
        </div>
      </div>
    </div>

    <!-- 3. Additional Options -->
    <div class="card mb-4" style="padding:16px">
      <div class="card-title" style="margin-bottom:12px"><span>⚙️</span> Additional Options</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <!-- Commission -->
        <div style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="fw-600" style="font-size:.84rem">💰 Deduct Commission</div>
              <div class="text-muted" style="font-size:.73rem">Deduct agent commission from this withdrawal</div>
            </div>
            <input type="checkbox" id="wdr-comm-check" style="width:18px;height:18px;cursor:pointer"
              onchange="toggleCommInput();calcWdrSummary('${custId}')">
          </div>
          <div id="wdr-comm-input-wrap" style="display:none;margin-top:10px">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Commission Amount (GH₵)</label>
              <input type="number" class="form-control" id="wdr-comm-amount"
                placeholder="0.00" min="0" step="0.01"
                oninput="calcWdrSummary('${custId}')">
            </div>
          </div>
        </div>
        <!-- Advance -->
        <div style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="fw-600" style="font-size:.84rem">⏩ Advance Withdrawal</div>
              <div class="text-muted" style="font-size:.73rem">Deduct an advance amount from this withdrawal</div>
            </div>
            <input type="checkbox" id="wdr-adv-check" style="width:18px;height:18px;cursor:pointer"
              onchange="toggleAdvInput();calcWdrSummary('${custId}')">
          </div>
          <div id="wdr-adv-input-wrap" style="display:none;margin-top:10px">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Advance Amount (GH₵)</label>
              <input type="number" class="form-control" id="wdr-adv-amount"
                placeholder="0.00" min="0" step="0.01"
                oninput="calcWdrSummary('${custId}')">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Deduction Summary -->
    <div class="card mb-4" style="padding:16px">
      <div class="card-title" style="margin-bottom:12px"><span>🧾</span> Deduction Summary</div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:.84rem">
        <div class="flex-between"><span class="text-muted">Withdrawal Amount</span><span class="mono" id="wds-wd">GH₵ 0.00</span></div>
        <div class="flex-between" id="wds-adv-row" style="display:none"><span class="text-muted">Advance Amount</span><span class="mono text-warning" id="wds-adv">GH₵ 0.00</span></div>
        <div class="flex-between" id="wds-comm-row" style="display:none"><span class="text-muted">Commission</span><span class="mono text-warning" id="wds-comm">GH₵ 0.00</span></div>
        <hr class="divider" style="margin:3px 0">
        <div class="flex-between fw-600">
          <span>Total Deduction from Account</span>
          <span class="mono text-danger fw-600" style="font-size:1rem" id="wds-total">GH₵ 0.00</span>
        </div>
        <div class="flex-between">
          <span class="text-muted">Balance After Deduction</span>
          <span class="mono" id="wds-balance-after" style="color:var(--muted)">${fmt(c.balance || 0)}</span>
        </div>
      </div>
    </div>

    <!-- Submit -->
    <div style="display:flex;gap:9px;justify-content:flex-end;padding-top:14px;border-top:1px solid var(--border)">
      <button class="btn btn-outline" onclick="closeModal('modal-wd-request')">Cancel</button>
      <button class="btn btn-gold" onclick="submitWithdrawalRequest('${custId}')">📤 Submit to Teller</button>
    </div>`;

  closeModal('modal-customer');
  openModal('modal-wd-request');
}

function toggleRepresentative() {
  const on = document.getElementById('wdr-rep-toggle').checked;
  document.getElementById('wdr-owner-info').style.display  = on ? 'none'  : 'block';
  document.getElementById('wdr-rep-details').style.display = on ? 'block' : 'none';
}
function toggleCommInput() {
  const on = document.getElementById('wdr-comm-check').checked;
  document.getElementById('wdr-comm-input-wrap').style.display = on ? 'block' : 'none';
  if (!on) { const el = document.getElementById('wdr-comm-amount'); if (el) el.value = ''; }
}
function toggleAdvInput() {
  const on = document.getElementById('wdr-adv-check').checked;
  document.getElementById('wdr-adv-input-wrap').style.display = on ? 'block' : 'none';
  const advRow = document.getElementById('wds-adv-row');
  if (advRow) advRow.style.display = on ? 'flex' : 'none';
  if (!on) { const el = document.getElementById('wdr-adv-amount'); if (el) el.value = ''; }
}

function calcWdrSummary(custId) {
  const c = CUSTOMERS.find(x => x.id === custId); if (!c) return;
  const wdAmt   = parseFloat(document.getElementById('wdr-amount')?.value)     || 0;
  const advOn   = document.getElementById('wdr-adv-check')?.checked;
  const commOn  = document.getElementById('wdr-comm-check')?.checked;
  const advAmt  = advOn  ? (parseFloat(document.getElementById('wdr-adv-amount')?.value)  || 0) : 0;
  const commAmt = commOn ? (parseFloat(document.getElementById('wdr-comm-amount')?.value) || 0) : 0;
  const total   = wdAmt + advAmt + commAmt;
  const balAfter = (c.balance || 0) - total;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('wds-wd',    fmt(wdAmt));
  set('wds-adv',   fmt(advAmt));
  set('wds-comm',  fmt(commAmt));
  set('wds-total', fmt(total));
  const advRow  = document.getElementById('wds-adv-row');
  if (advRow)  advRow.style.display  = advOn  ? 'flex' : 'none';
  const commRow = document.getElementById('wds-comm-row');
  if (commRow) commRow.style.display = commOn ? 'flex' : 'none';
  const balEl = document.getElementById('wds-balance-after');
  if (balEl) {
    balEl.textContent = fmt(balAfter);
    balEl.style.color = balAfter < 0 ? 'var(--danger)' : 'var(--success)';
  }
}

// FIX 5 — loader on withdrawal request submit
function submitWithdrawalRequest(custId) {
  const c = CUSTOMERS.find(x => x.id === custId); if (!c) return;

  const date    = document.getElementById('wdr-date')?.value;
  const amount  = parseFloat(document.getElementById('wdr-amount')?.value) || 0;
  const reason  = document.getElementById('wdr-reason')?.value.trim() || '';
  const isRep   = document.getElementById('wdr-rep-toggle')?.checked;
  const advOn   = document.getElementById('wdr-adv-check')?.checked;
  const commOn  = document.getElementById('wdr-comm-check')?.checked;
  const advAmt  = advOn  ? (parseFloat(document.getElementById('wdr-adv-amount')?.value)  || 0) : 0;
  const commAmt = commOn ? (parseFloat(document.getElementById('wdr-comm-amount')?.value) || 0) : 0;

  if (!date)              return toast('Select a request date', 'error');
  if (!amount || amount <= 0) return toast('Enter withdrawal amount', 'error');

  const total = amount + advAmt + commAmt;
  if (total > (c.balance || 0))
    return toast(`Insufficient balance. Deduction ${fmt(total)} exceeds balance ${fmt(c.balance || 0)}`, 'error');

  let repDetails = null;
  if (isRep) {
    const repName  = document.getElementById('wdr-rep-name')?.value.trim();
    const repPhone = document.getElementById('wdr-rep-phone')?.value.trim();
    const repRel   = document.getElementById('wdr-rep-rel')?.value;
    const repIdT   = document.getElementById('wdr-rep-idtype')?.value;
    const repIdN   = document.getElementById('wdr-rep-idnum')?.value.trim();
    if (!repName)  return toast("Enter representative's full name", 'error');
    if (!repPhone) return toast("Enter representative's phone number", 'error');
    if (!repRel)   return toast("Select representative's relationship", 'error');
    if (!repIdN)   return toast("Enter representative's ID number", 'error');
    repDetails = { name: repName, phone: repPhone, relationship: repRel, idType: repIdT, idNumber: repIdN };
  }

  // Show loader
  custShowLoader('Submitting withdrawal request...', `${fmt(total)} for ${c.firstName} ${c.lastName}`);
  closeModal('modal-wd-request');

  setTimeout(() => {
    const req = {
      id               : uid(),
      type             : 'customer_request',
      custId           : c.id,
      acct             : c.acctNumber,
      name             : `${c.firstName} ${c.lastName}`,
      date, amount, reason,
      isRepresentative : isRep,
      representative   : repDetails,
      advanceAmount    : advAmt,
      commissionAmount : commAmt,
      totalDeduction   : total,
      status           : 'pending',
      submittedAt      : new Date().toISOString(),
      submittedBy      : currentUser?.name || 'System'
    };

    TELLER_STATE.withdrawals.push(req);
    logActivity('Withdrawal Request',
      `${c.firstName} ${c.lastName} (${c.acctNumber}) — ${fmt(total)}`, total, 'pending');
    saveAll();
    updateTellerStats();
    renderWdTable();
    custHideLoader();
    toast(`Withdrawal request of ${fmt(total)} submitted to teller for approval`, 'success');
  }, 900);
}

// ═══════════════════════════════════════════════════════
//  CUSTOMER DELETION — soft delete, restore, purge
// ═══════════════════════════════════════════════════════

// ── Soft-delete a customer ────────────────────────────
function softDeleteCustomer(id) {
  const c = CUSTOMERS.find(x => x.id === id);
  if (!c) return;

  const name = `${c.firstName} ${c.lastName}`;

  showConfirm(
    '🗑️ Delete Customer?',
    `This will remove <strong>${name}</strong> (${c.acctNumber}) from the active list.<br><br>
     The record will be stored in <strong>Deleted Customers</strong> and can be restored or
     permanently deleted by an administrator.`,
    () => {
      // Stamp who deleted it and when
      const record = Object.assign({}, c, {
        deletedAt   : new Date().toISOString(),
        deletedBy   : currentUser?.name || 'Unknown',
        deletedByRole: currentUser?.role || 'unknown',
        deletedById : currentUser?.id   || null,
      });

      DELETED_CUSTOMERS.unshift(record);
      CUSTOMERS = CUSTOMERS.filter(x => x.id !== id);
      saveAll();

      logActivity('Customer', `Deleted customer ${name} (${c.acctNumber})`, 0, 'deleted');
      renderCustomerList(document.getElementById('cust-search')?.value || '');
      toast(`${name} moved to Deleted Customers`, 'warning');
    }
  );
}

// ── Render the Deleted Customers panel ───────────────
function renderDeletedCustomers() {
  const el = document.getElementById('cu-deleted-content'); if (!el) return;

  // Admin gate — double-check on render as well
  if (currentUser?.role !== 'admin') {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🔒</div>
      <div class="et">Access Restricted</div>
      <div class="es">Only administrators can view deleted customers</div>
    </div>`;
    return;
  }

  if (!DELETED_CUSTOMERS.length) {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🗑️</div>
      <div class="et">No deleted customers</div>
      <div class="es">Deleted customers will appear here</div>
    </div>`;
    return;
  }

  const ROLE_LABELS = {
    admin:'Administrator', accountant:'Accountant', teller:'Teller',
    loan_officer:'Loan Officer', accounting_clerk:'Accounting Clerk',
    monitoring_officer:'Monitoring Officer', agent:'Agent',
    manager:'Manager', auditor:'Auditor', customer_service:'Customer Service'
  };

  el.innerHTML = `
    <!-- Summary banner -->
    <div style="display:flex;align-items:center;justify-content:space-between;
      flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <div>
        <div class="fw-600" style="font-size:.95rem">
          🗑️ Deleted Customers
          <span class="badge b-red" style="margin-left:8px">${DELETED_CUSTOMERS.length}</span>
        </div>
        <div class="text-muted" style="font-size:.76rem;margin-top:2px">
          Visible to administrators only · Records can be restored or permanently deleted
        </div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="purgeAllDeletedCustomers()">
        🔥 Purge All Permanently
      </button>
    </div>

    <!-- Filter / search -->
    <div style="margin-bottom:14px">
      <input type="text" class="form-control" style="max-width:320px"
        id="del-cust-search" placeholder="🔍 Search deleted customers..."
        oninput="filterDeletedCustomers(this.value)">
    </div>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table id="del-cust-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Account No.</th>
              <th>Customer Name</th>
              <th>Type</th>
              <th>Agent</th>
              <th>Balance</th>
              <th>Deleted By</th>
              <th>Role</th>
              <th>Deleted On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="del-cust-tbody">
            ${_buildDeletedRows(DELETED_CUSTOMERS)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _buildDeletedRows(list) {
  if (!list.length) return '<tr><td colspan="10" class="text-center text-muted" style="padding:28px">No records found</td></tr>';

  const ROLE_LABELS = {
    admin:'Administrator', accountant:'Accountant', teller:'Teller',
    loan_officer:'Loan Officer', accounting_clerk:'Accounting Clerk',
    monitoring_officer:'Monitoring Officer', agent:'Agent',
    manager:'Manager', auditor:'Auditor', customer_service:'Customer Service'
  };
  const typeColors = { susu:'b-gold', lending:'b-blue', savings:'b-green' };

  return list.map((c, i) => {
    const agent = AGENTS.find(a => a.id === c.agentId);
    return `<tr style="opacity:.85">
      <td class="text-muted">${i + 1}</td>
      <td class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</td>
      <td>
        <div class="fw-600">${c.firstName} ${c.lastName}</div>
        <div class="text-muted" style="font-size:.72rem">${c.phone || '—'}</div>
      </td>
      <td><span class="badge ${typeColors[c.type] || 'b-gray'}">${c.type}</span></td>
      <td style="font-size:.8rem">${agent ? agent.firstName + ' ' + agent.lastName : '—'}</td>
      <td class="mono text-danger">${fmt(c.balance || 0)}</td>
      <td>
        <div class="fw-600" style="font-size:.82rem">${c.deletedBy || '—'}</div>
      </td>
      <td>
        <span class="badge b-gray" style="font-size:.68rem">
          ${ROLE_LABELS[c.deletedByRole] || c.deletedByRole || '—'}
        </span>
      </td>
      <td style="font-size:.78rem;white-space:nowrap">${fmtDateTime(c.deletedAt)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-gold btn-xs" onclick="restoreCustomer('${c.id}')">
          ♻️ Restore
        </button>
        <button class="btn btn-danger btn-xs" style="margin-left:4px"
          onclick="permanentlyDeleteCustomer('${c.id}')">
          🔥 Delete
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Live filter for deleted table ─────────────────────
function filterDeletedCustomers(query) {
  const tbody = document.getElementById('del-cust-tbody'); if (!tbody) return;
  const q = (query || '').toLowerCase();
  const filtered = q
    ? DELETED_CUSTOMERS.filter(c =>
        `${c.firstName} ${c.lastName} ${c.acctNumber} ${c.deletedBy}`.toLowerCase().includes(q)
      )
    : DELETED_CUSTOMERS;
  tbody.innerHTML = _buildDeletedRows(filtered);
}

// ── Restore a customer back to active ────────────────
function restoreCustomer(id) {
  const c = DELETED_CUSTOMERS.find(x => x.id === id); if (!c) return;
  const name = `${c.firstName} ${c.lastName}`;

  showConfirm(
    '♻️ Restore Customer?',
    `Restore <strong>${name}</strong> (${c.acctNumber}) back to the active customer list?`,
    () => {
      // Strip deletion meta fields then push back
      const restored = Object.assign({}, c);
      delete restored.deletedAt;
      delete restored.deletedBy;
      delete restored.deletedByRole;
      delete restored.deletedById;

      CUSTOMERS.push(restored);
      DELETED_CUSTOMERS = DELETED_CUSTOMERS.filter(x => x.id !== id);
      saveAll();

      logActivity('Customer', `Restored customer ${name} (${c.acctNumber})`, 0, 'restored');
      renderDeletedCustomers();
      toast(`${name} restored to active customers ✅`, 'success');
    }
  );
}

// ── Permanently delete one record ────────────────────
function permanentlyDeleteCustomer(id) {
  const c = DELETED_CUSTOMERS.find(x => x.id === id); if (!c) return;
  const name = `${c.firstName} ${c.lastName}`;

  showConfirm(
    '🔥 Permanently Delete?',
    `<div style="color:var(--danger)">
       This action <strong>cannot be undone</strong>.
     </div>
     <br>
     All records for <strong>${name}</strong> (${c.acctNumber}) — including transactions,
     loans, and history — will be erased forever.
     <br><br>
     Type the account number to confirm, or just click Confirm to proceed.`,
    () => {
      DELETED_CUSTOMERS = DELETED_CUSTOMERS.filter(x => x.id !== id);
      saveAll();
      logActivity('Customer', `Permanently deleted customer ${name} (${c.acctNumber})`, 0, 'purged');
      renderDeletedCustomers();
      toast(`${name} permanently deleted`, 'error');
    },
    'danger'   // red confirm button
  );
}

// ── Purge ALL deleted customers ───────────────────────
function purgeAllDeletedCustomers() {
  if (!DELETED_CUSTOMERS.length) return toast('Nothing to purge', 'warning');

  showConfirm(
    '🔥 Purge All Deleted Customers?',
    `<div style="color:var(--danger)">
       <strong>This cannot be undone.</strong>
     </div><br>
     All <strong>${DELETED_CUSTOMERS.length}</strong> deleted customer records will be
     permanently erased. This includes all their transactions and history.`,
    () => {
      const count = DELETED_CUSTOMERS.length;
      DELETED_CUSTOMERS = [];
      saveAll();
      logActivity('Customer', `Purged all ${count} deleted customers`, 0, 'purged');
      renderDeletedCustomers();
      toast(`${count} customer records permanently purged`, 'error');
    },
    'danger'
  );
}

// ═══════════════════════════════════════════════════════
//  EXPORT / IMPORT — CUSTOMERS  (admin only)
// ═══════════════════════════════════════════════════════

function renderCustomerExportImport() {
  const el = document.getElementById('cu-exportimport-content'); if (!el) return;
  // Show/hide tab based on role
  const tab = document.getElementById('cu-exportimport-tab');
  if (tab) tab.style.display = currentUser?.role === 'admin' ? '' : 'none';
  if (currentUser?.role !== 'admin') {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🔒</div><div class="et">Admin Only</div></div>`;
    return;
  }

  el.innerHTML = `
    <div style="max-width:720px">
      <div class="fw-600" style="font-size:.95rem;margin-bottom:4px">📤 Export / Import Customers</div>
      <div class="text-muted" style="font-size:.78rem;margin-bottom:18px">
        Export all customer records (including balances and transaction history) as CSV or JSON.
        Import from a previously exported JSON file to restore or migrate data.
      </div>

      <!-- Export -->
      <div class="card mb-4">
        <div class="card-title"><span>📤</span> Export Customers</div>
        <div class="text-muted" style="font-size:.78rem;margin-bottom:12px">
          Exports <strong>${CUSTOMERS.length}</strong> active customers
          + <strong>${DELETED_CUSTOMERS?.length || 0}</strong> deleted.
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-gold btn-sm" onclick="exportCustomersCSV()">
            📊 Export as CSV
          </button>
          <button class="btn btn-outline btn-sm" onclick="exportCustomersJSON()">
            🗂 Export as JSON (Full backup)
          </button>
        </div>
        <div class="input-hint" style="margin-top:8px">
          CSV includes: Account No., Name, Type, Agent, Phone, Gender, Balance, Status, Date Created.<br>
          JSON includes all fields including transaction history — use for full migration.
        </div>
      </div>

      <!-- Import -->
      <div class="card">
        <div class="card-title"><span>📥</span> Import Customers (JSON)</div>
        <div class="alert alert-warning" style="font-size:.78rem;margin-bottom:12px">
          ⚠️ Import merges new records only — existing customers with matching account numbers
          are <strong>skipped</strong>, not overwritten.
        </div>
        <div class="form-group">
          <label class="form-label">Select JSON file (exported from Pro Susu Banking)</label>
          <input type="file" class="form-control" id="cu-import-file" accept=".json"
            onchange="previewCustomerImport(this)">
        </div>
        <div id="cu-import-preview" style="display:none">
          <div class="alert alert-info" style="font-size:.78rem" id="cu-import-info"></div>
          <button class="btn btn-gold btn-sm" onclick="confirmCustomerImport()">
            ✅ Confirm Import
          </button>
        </div>
      </div>
    </div>`;
}

function exportCustomersCSV() {
  const headers = [
    'Account No.','First Name','Last Name','Type','Agent Code','Phone','Gender',
    'DOB','ID Type','ID Number','Address','Town','Occupation','Balance',
    'Initial Deposit','Status','Date Created'
  ];
  const rows = CUSTOMERS.map(c => {
    const agent = AGENTS.find(a => a.id === c.agentId);
    return [
      c.acctNumber, c.firstName, c.lastName, c.type,
      agent ? agent.code : '',
      c.phone || '', c.gender || '', c.dob || '',
      c.idType || '', c.idNum || '', c.address || '', c.town || '', c.occupation || '',
      (c.balance || 0).toFixed(2),
      (c.initialDeposit || 0).toFixed(2),
      c.status, c.dateCreated || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  _downloadFile(csv, `customers_${todayISO()}.csv`, 'text/csv');
  toast(`${CUSTOMERS.length} customers exported as CSV ✅`, 'success');
  logActivity('Export', `Admin exported ${CUSTOMERS.length} customers (CSV)`, 0, 'exported');
}

function exportCustomersJSON() {
  const data = JSON.stringify({
    exportedAt : new Date().toISOString(),
    exportedBy : currentUser.name,
    source     : SETTINGS.companyName || 'Pro Susu Banking',
    type       : 'customers',
    records    : CUSTOMERS,
    deleted    : DELETED_CUSTOMERS || [],
  }, null, 2);
  _downloadFile(data, `customers_backup_${todayISO()}.json`, 'application/json');
  toast(`Full customer backup exported ✅`, 'success');
  logActivity('Export', `Admin exported ${CUSTOMERS.length} customers (JSON)`, 0, 'exported');
}

let _pendingCustomerImport = null;

function previewCustomerImport(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.records || !Array.isArray(data.records))
        return toast('Invalid file — no customer records found', 'error');
      const existing   = new Set(CUSTOMERS.map(c => c.acctNumber));
      const newRecords = data.records.filter(c => !existing.has(c.acctNumber));
      const skipped    = data.records.length - newRecords.length;
      _pendingCustomerImport = newRecords;
      const info = document.getElementById('cu-import-info');
      const pre  = document.getElementById('cu-import-preview');
      if (info) info.innerHTML =
        `Found <strong>${data.records.length}</strong> records.
         <strong>${newRecords.length}</strong> will be imported.
         <strong>${skipped}</strong> already exist and will be skipped.
         ${data.exportedAt ? `<br>Exported: ${fmtDateTime(data.exportedAt)} by ${data.exportedBy || '—'}.` : ''}`;
      if (pre) pre.style.display = newRecords.length ? '' : 'none';
      if (!newRecords.length) toast('No new records to import — all already exist', 'warning');
    } catch {
      toast('Could not read file — make sure it is a valid JSON export', 'error');
    }
  };
  reader.readAsText(file);
}

function confirmCustomerImport() {
  if (!_pendingCustomerImport?.length) return;
  const count = _pendingCustomerImport.length;
  showConfirm('✅ Confirm Import?',
    `Import <strong>${count}</strong> new customer record${count!==1?'s':''}?`,
    () => {
      CUSTOMERS.push(..._pendingCustomerImport);
      _pendingCustomerImport = null;
      saveAll();
      logActivity('Import', `Admin imported ${count} customers from file`, 0, 'imported');
      renderCustomerList('');
      renderCustomerExportImport();
      toast(`${count} customers imported ✅`, 'success');
    });
}

// ═══════════════════════════════════════════════════════
//  EXPORT / IMPORT — LOANS  (admin only — in loans.js context)
// ═══════════════════════════════════════════════════════

function renderLoanExportImport() {
  const el = document.getElementById('ln-exportimport-content'); if (!el) return;
  const tab = document.getElementById('ln-exportimport-tab');
  if (tab) tab.style.display = currentUser?.role === 'admin' ? '' : 'none';
  if (currentUser?.role !== 'admin') {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🔒</div><div class="et">Admin Only</div></div>`;
    return;
  }
  const active    = LOANS.filter(l => l.status === 'active').length;
  const completed = LOANS.filter(l => l.status === 'completed').length;

  el.innerHTML = `
    <div style="max-width:720px">
      <div class="fw-600" style="font-size:.95rem;margin-bottom:4px">📤 Export / Import Loans</div>
      <div class="text-muted" style="font-size:.78rem;margin-bottom:18px">
        Export all loan records including schedules and payment history.
      </div>
      <div class="card mb-4">
        <div class="card-title"><span>📤</span> Export Loans</div>
        <div class="text-muted" style="font-size:.78rem;margin-bottom:12px">
          <strong>${active}</strong> active · <strong>${completed}</strong> completed
          · <strong>${LOANS.length}</strong> total
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-gold btn-sm" onclick="exportLoansCSV()">📊 Export as CSV</button>
          <button class="btn btn-outline btn-sm" onclick="exportLoansJSON()">🗂 Export as JSON (Full backup)</button>
        </div>
        <div class="input-hint" style="margin-top:8px">
          CSV: Loan #, Customer, Agent, Amount, Interest, Total, Monthly, Start, End, Status.<br>
          JSON: Full records including payment history and schedule.
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span>📥</span> Import Loans (JSON)</div>
        <div class="alert alert-warning" style="font-size:.78rem;margin-bottom:12px">
          ⚠️ Existing loans with matching IDs are skipped, not overwritten.
        </div>
        <div class="form-group">
          <label class="form-label">Select JSON file</label>
          <input type="file" class="form-control" id="ln-import-file" accept=".json"
            onchange="previewLoanImport(this)">
        </div>
        <div id="ln-import-preview" style="display:none">
          <div class="alert alert-info" style="font-size:.78rem" id="ln-import-info"></div>
          <button class="btn btn-gold btn-sm" onclick="confirmLoanImport()">✅ Confirm Import</button>
        </div>
      </div>
    </div>`;
}

function exportLoansCSV() {
  const headers = [
    'Loan #','Customer','Acct No.','Agent','Amount','Interest',
    'Total Repayment','Monthly Payment','Months','Start Date','End Date',
    'Paid','Remaining','Status'
  ];
  const rows = LOANS.map(l => {
    const paid = (l.payments || []).reduce((s, p) => s + p.amount, 0);
    return [
      l.loanNum, l.customerName, l.acctNumber, l.agentName,
      (l.amount || 0).toFixed(2), (l.interest || 0).toFixed(2),
      (l.totalRepayment || 0).toFixed(2), (l.monthlyPayment || 0).toFixed(2),
      l.months || '', l.startDate || '', l.endDate || '',
      paid.toFixed(2), (l.totalRepayment - paid).toFixed(2), l.status
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  _downloadFile(csv, `loans_${todayISO()}.csv`, 'text/csv');
  toast(`${LOANS.length} loans exported as CSV ✅`, 'success');
  logActivity('Export', `Admin exported ${LOANS.length} loans (CSV)`, 0, 'exported');
}

function exportLoansJSON() {
  const data = JSON.stringify({
    exportedAt : new Date().toISOString(),
    exportedBy : currentUser.name,
    source     : SETTINGS.companyName || 'Pro Susu Banking',
    type       : 'loans',
    records    : LOANS,
  }, null, 2);
  _downloadFile(data, `loans_backup_${todayISO()}.json`, 'application/json');
  toast(`Full loan backup exported ✅`, 'success');
  logActivity('Export', `Admin exported ${LOANS.length} loans (JSON)`, 0, 'exported');
}

let _pendingLoanImport = null;

function previewLoanImport(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.records || !Array.isArray(data.records))
        return toast('Invalid file — no loan records found', 'error');
      const existing = new Set(LOANS.map(l => l.id));
      const newRecs  = data.records.filter(l => !existing.has(l.id));
      const skipped  = data.records.length - newRecs.length;
      _pendingLoanImport = newRecs;
      const info = document.getElementById('ln-import-info');
      const pre  = document.getElementById('ln-import-preview');
      if (info) info.innerHTML =
        `Found <strong>${data.records.length}</strong> records.
         <strong>${newRecs.length}</strong> will be imported.
         <strong>${skipped}</strong> already exist and will be skipped.`;
      if (pre) pre.style.display = newRecs.length ? '' : 'none';
      if (!newRecs.length) toast('No new loans to import', 'warning');
    } catch {
      toast('Could not read file — ensure it is a valid JSON export', 'error');
    }
  };
  reader.readAsText(file);
}

function confirmLoanImport() {
  if (!_pendingLoanImport?.length) return;
  const count = _pendingLoanImport.length;
  showConfirm('✅ Confirm Import?',
    `Import <strong>${count}</strong> new loan record${count!==1?'s':''}?`,
    () => {
      LOANS.push(..._pendingLoanImport);
      _pendingLoanImport = null;
      saveAll();
      logActivity('Import', `Admin imported ${count} loans from file`, 0, 'imported');
      if (typeof updateLoanStats === 'function') updateLoanStats();
      renderLoanExportImport();
      toast(`${count} loans imported ✅`, 'success');
    });
}

// ── Generic file download helper ─────────────────────
function _downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
}

// ═══════════════════════════════════════════════════════
//  EXPORT / IMPORT — CUSTOMERS (Admin only)
// ═══════════════════════════════════════════════════════

function renderCustomerExportImport() {
  const el = document.getElementById('cu-exportimport-content'); if (!el) return;
  if (currentUser?.role !== 'admin') {
    el.innerHTML = `<div class="empty-state" style="padding:48px 0">
      <div class="ei">🔒</div><div class="et">Admin Only</div></div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px">

      <!-- EXPORT -->
      <div class="card">
        <div class="card-title"><span>📤</span> Export Customers</div>
        <div class="text-muted" style="font-size:.8rem;margin-bottom:14px;line-height:1.6">
          Downloads all customers with their details and current balances as a CSV file.
          Includes: name, account number, type, agent, phone, gender, DOB, address,
          ID, status, balance, initial deposit, registration date.
        </div>
        <div class="form-group">
          <label class="form-label">Filter by Type (optional)</label>
          <select class="form-control" id="exp-cust-type">
            <option value="">All Types</option>
            <option value="susu">Susu</option>
            <option value="lending">Lending Deposit</option>
            <option value="savings">Savings</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Filter by Status (optional)</label>
          <select class="form-control" id="exp-cust-status">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <button class="btn btn-gold" onclick="exportCustomersCSV()">
          📥 Download CSV
        </button>
      </div>

      <!-- IMPORT -->
      <div class="card">
        <div class="card-title"><span>📂</span> Import Customers</div>
        <div class="text-muted" style="font-size:.8rem;margin-bottom:14px;line-height:1.6">
          Import customers from a CSV file. Use the exported file as a template.
          Existing customers with the same account number will be <strong>updated</strong>.
          New account numbers will be <strong>added</strong>.
        </div>
        <div class="alert alert-warning" style="font-size:.78rem;margin-bottom:12px">
          ⚠️ Always export first and use the exported file as the import template
          to avoid data loss.
        </div>
        <div class="form-group">
          <label class="form-label">Select CSV File</label>
          <input type="file" class="form-control" id="imp-cust-file" accept=".csv"
            style="padding:6px 10px"
            onchange="onImportFileSelected()">
        </div>

        <!-- Agent Assignment -->
        <div class="form-group">
          <label class="form-label">Agent Assignment</label>
          <select class="form-control" id="imp-agent-mode"
            onchange="onImportAgentModeChange()">
            <option value="csv">Use agent code from CSV file</option>
            <option value="override">Assign ALL imported customers to one agent</option>
            <option value="new_only">Assign only customers with no agent in CSV</option>
          </select>
          <div class="text-muted" style="font-size:.74rem;margin-top:4px" id="imp-agent-mode-hint">
            Agent codes in the CSV will be used as-is.
          </div>
        </div>

        <!-- Agent picker (shown for override / new_only modes) -->
        <div id="imp-agent-picker" style="display:none" class="form-group">
          <label class="form-label">Select Agent</label>
          <select class="form-control" id="imp-agent-select">
            <option value="">— Choose an agent —</option>
          </select>
        </div>

        <!-- Preview panel (appears after file is chosen) -->
        <div id="imp-preview-panel" style="display:none;margin-bottom:12px;
          padding:10px 14px;background:var(--surface2);border-radius:var(--radius);
          font-size:.8rem;line-height:1.7;border:1px solid var(--border)">
        </div>

        <button class="btn btn-gold" onclick="importCustomersCSV()">📤 Import CSV</button>
        <div id="imp-cust-result" style="margin-top:12px;font-size:.8rem"></div>
      </div>
    </div>`;
}

function exportCustomersCSV() {
  const typeFilter   = document.getElementById('exp-cust-type')?.value   || '';
  const statusFilter = document.getElementById('exp-cust-status')?.value || '';

  let list = CUSTOMERS;
  if (typeFilter)   list = list.filter(c => c.type   === typeFilter);
  if (statusFilter) list = list.filter(c => c.status === statusFilter);

  if (!list.length) return toast('No customers match the selected filters', 'warning');

  const headers = [
    'Account Number','First Name','Last Name','Gender','Type','Agent Code',
    'Phone','Date of Birth','ID Type','ID Number','Address','Town','Occupation',
    'Status','Balance','Initial Deposit','Registration Date'
  ];

  const rows = list.map(c => {
    const agent = AGENTS.find(a => a.id === c.agentId);
    return [
      c.acctNumber || '',
      c.firstName  || '',
      c.lastName   || '',
      c.gender     || '',
      c.type       || '',
      agent ? agent.code : '',
      c.phone      || '',
      c.dob        || '',
      c.idType     || '',
      c.idNum      || '',
      c.address    || '',
      c.town       || '',
      c.occupation || '',
      c.status     || '',
      (c.balance   || 0).toFixed(2),
      (c.initialDeposit || 0).toFixed(2),
      c.dateCreated || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `customers_export_${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${list.length} customers ✅`, 'success');
  logActivity('Export', `Admin exported ${list.length} customer records`, 0, 'export');
}

// ── Import UI helpers ─────────────────────────────────
function onImportAgentModeChange() {
  const mode   = document.getElementById('imp-agent-mode')?.value;
  const picker = document.getElementById('imp-agent-picker');
  const hint   = document.getElementById('imp-agent-mode-hint');
  const sel    = document.getElementById('imp-agent-select');
  const hints  = {
    csv      : 'Agent codes in the CSV will be used as-is. Rows with no agent code will have no agent assigned.',
    override : 'Every imported customer will be assigned to the selected agent, regardless of the CSV.',
    new_only : 'Only rows with no agent code in the CSV will be assigned to the selected agent.',
  };
  if (hint) hint.textContent = hints[mode] || '';
  const needPicker = mode === 'override' || mode === 'new_only';
  if (picker) picker.style.display = needPicker ? '' : 'none';
  if (needPicker && sel && sel.options.length <= 1) {
    sel.innerHTML = '<option value="">— Choose an agent —</option>' +
      AGENTS.filter(a => a.status === 'active')
        .sort((a,b) => a.code.localeCompare(b.code))
        .map(a => `<option value="${a.id}">${a.code} — ${a.firstName} ${a.lastName}</option>`)
        .join('');
  }
  onImportFileSelected();
}

function onImportFileSelected() {
  const file    = document.getElementById('imp-cust-file')?.files[0];
  const preview = document.getElementById('imp-preview-panel');
  if (!preview) return;
  if (!file) { preview.style.display = 'none'; return; }
  const reader  = new FileReader();
  reader.onload = function(e) {
    try {
      const lines = e.target.result.replace(/\r/g, '').split('\n').filter(l => l.trim());
      const dataRows = lines.slice(1).filter(l => l.trim());
      const header = _csvParseLine(lines[0]);
      const idx = {};
      header.forEach((h, i) => { idx[h.trim()] = i; });
      let withAgent = 0, withoutAgent = 0;
      dataRows.forEach(l => {
        const row = _csvParseLine(l);
        (row[idx['Agent Code']] || '').trim() ? withAgent++ : withoutAgent++;
      });
      const mode      = document.getElementById('imp-agent-mode')?.value || 'csv';
      const agentSel  = document.getElementById('imp-agent-select');
      const agentText = agentSel?.options[agentSel.selectedIndex]?.text || '';
      const agCode    = agentText.split('—')[0].trim();
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="font-weight:600;margin-bottom:6px">📋 File Preview</div>
        <div>Rows to import: <strong>${dataRows.length}</strong></div>
        <div>With agent code: <strong>${withAgent}</strong> &nbsp;·&nbsp;
             Without agent code: <strong>${withoutAgent}</strong></div>
        ${mode==='override'&&agCode?`<div style="color:var(--gold);margin-top:4px">→ All ${dataRows.length} customer(s) will be assigned to <strong>${agCode}</strong></div>`:''}
        ${mode==='new_only'&&agCode?`<div style="color:var(--gold);margin-top:4px">→ ${withoutAgent} customer(s) without agent will be assigned to <strong>${agCode}</strong></div>`:''}`;
    } catch(e) { if (preview) preview.style.display = 'none'; }
  };
  reader.readAsText(file);
}

function importCustomersCSV() {
  const file = document.getElementById('imp-cust-file')?.files[0];
  if (!file) return toast('Select a CSV file first', 'error');

  const mode           = document.getElementById('imp-agent-mode')?.value || 'csv';
  const agentSelEl     = document.getElementById('imp-agent-select');
  const overrideAgentId = agentSelEl?.value || '';
  if ((mode === 'override' || mode === 'new_only') && !overrideAgentId)
    return toast('Select an agent to assign customers to', 'error');
  const overrideAgent = AGENTS.find(a => a.id === overrideAgentId) || null;

  const resultEl = document.getElementById('imp-cust-result');
  const reader   = new FileReader();

  reader.onload = function(e) {
    try {
      const lines  = e.target.result.replace(/\r/g, '').split('\n').filter(l => l.trim());
      const header = _csvParseLine(lines[0]);
      const rows   = lines.slice(1).map(l => _csvParseLine(l));
      const idx    = {};
      header.forEach((h, i) => { idx[h.trim()] = i; });

      let added = 0, updated = 0, skipped = 0, reassigned = 0;

      rows.forEach(row => {
        if (row.length < 2) return;
        const acctNumber = (row[idx['Account Number']] || '').trim();
        const firstName  = (row[idx['First Name']]     || '').trim();
        const lastName   = (row[idx['Last Name']]      || '').trim();
        if (!acctNumber || !firstName || !lastName) { skipped++; return; }

        const balance    = parseFloat(row[idx['Balance']]          || '0') || 0;
        const initDep    = parseFloat(row[idx['Initial Deposit']]  || '0') || 0;
        const csvCode    = (row[idx['Agent Code']] || '').trim();
        const csvAgent   = AGENTS.find(a => a.code === csvCode);

        let assignedAgent;
        if (mode === 'override') {
          assignedAgent = overrideAgent;
          if (csvAgent && csvAgent.id !== overrideAgent?.id) reassigned++;
        } else if (mode === 'new_only') {
          assignedAgent = csvAgent || overrideAgent;
          if (!csvAgent && overrideAgent) reassigned++;
        } else {
          assignedAgent = csvAgent;
        }

        const existing = CUSTOMERS.find(c => c.acctNumber === acctNumber);
        if (existing) {
          existing.firstName      = firstName;
          existing.lastName       = lastName;
          existing.gender         = (row[idx['Gender']]          || existing.gender     || '').trim();
          existing.phone          = (row[idx['Phone']]           || existing.phone      || '').trim();
          existing.dob            = (row[idx['Date of Birth']]   || existing.dob        || '').trim();
          existing.idType         = (row[idx['ID Type']]         || existing.idType     || '').trim();
          existing.idNum          = (row[idx['ID Number']]       || existing.idNum      || '').trim();
          existing.address        = (row[idx['Address']]         || existing.address    || '').trim();
          existing.town           = (row[idx['Town']]            || existing.town       || '').trim();
          existing.occupation     = (row[idx['Occupation']]      || existing.occupation || '').trim();
          existing.status         = (row[idx['Status']]          || existing.status     || 'active').trim();
          existing.balance        = balance;
          existing.initialDeposit = initDep;
          if (assignedAgent) { existing.agentId = assignedAgent.id; existing.agentCode = assignedAgent.code; }
          updated++;
        } else {
          CUSTOMERS.push({
            id: uid(), acctNumber, firstName, lastName,
            gender      : (row[idx['Gender']]          || '').trim(),
            type        : (row[idx['Type']]            || 'susu').trim().toLowerCase(),
            agentId     : assignedAgent?.id   || '',
            agentCode   : assignedAgent?.code || '',
            phone       : (row[idx['Phone']]           || '').trim(),
            dob         : (row[idx['Date of Birth']]   || '').trim(),
            idType      : (row[idx['ID Type']]         || '').trim(),
            idNum       : (row[idx['ID Number']]       || '').trim(),
            address     : (row[idx['Address']]         || '').trim(),
            town        : (row[idx['Town']]            || '').trim(),
            occupation  : (row[idx['Occupation']]      || '').trim(),
            status      : (row[idx['Status']]          || 'active').trim(),
            balance, initialDeposit: initDep,
            dateCreated : (row[idx['Registration Date']] || todayISO()).trim(),
            nextOfKin: [], transactions: [],
          });
          added++;
        }
      });

      saveAll();
      const agLabel     = overrideAgent ? ` · Assigned to <strong>${overrideAgent.code}</strong>` : '';
      const reLabel     = reassigned > 0 ? ` · <strong>${reassigned}</strong> reassigned` : '';
      const msg = `✅ Import complete — <strong>${added}</strong> added, <strong>${updated}</strong> updated, <strong>${skipped}</strong> skipped${agLabel}${reLabel}.`;
      if (resultEl) resultEl.innerHTML = `<div class="alert alert-success" style="font-size:.8rem">${msg}</div>`;
      toast(`Import complete: ${added} added, ${updated} updated`, 'success');
      logActivity('Import', `Imported customers: ${added} added, ${updated} updated${overrideAgent ? ', assigned to ' + overrideAgent.code : ''}`, 0, 'import');

      const fi = document.getElementById('imp-cust-file'); if (fi) fi.value = '';
      const pv = document.getElementById('imp-preview-panel'); if (pv) pv.style.display = 'none';
    } catch (err) {
      console.error('Import error:', err);
      if (resultEl) resultEl.innerHTML = `<div class="alert alert-danger" style="font-size:.8rem">❌ Import failed: ${err.message}</div>`;
      toast('Import failed — check file format', 'error');
    }
  };
  reader.readAsText(file);
}


// Simple CSV line parser (handles quoted fields with commas)
function _csvParseLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ═══════════════════════════════════════════════════════
//  ASSIGN UNASSIGNED CUSTOMERS TO AN AGENT
// ═══════════════════════════════════════════════════════
function openAssignNoAgentModal() {
  const unassigned = CUSTOMERS.filter(c => !c.agentId);
  if (!unassigned.length) return toast('All customers already have an agent', 'success');

  const agents = AGENTS.filter(a => a.status === 'active')
    .sort((a, b) => a.code.localeCompare(b.code));
  if (!agents.length) return toast('No active agents to assign to', 'error');

  // Group by type for summary
  const byType = { susu: 0, lending: 0, savings: 0 };
  unassigned.forEach(c => { if (byType[c.type] !== undefined) byType[c.type]++; });

  // Build modal content
  const titleEl = document.getElementById('m-conf-title');
  const bodyEl  = document.getElementById('m-conf-body');
  const okBtn   = document.getElementById('m-conf-ok');
  if (!titleEl || !bodyEl || !okBtn) return;

  titleEl.innerHTML = '🔗 Assign Unassigned Customers';
  bodyEl.innerHTML = `
    <!-- Summary -->
    <div style="padding:12px 14px;background:var(--surface2);border-radius:var(--radius);
      margin-bottom:16px;font-size:.82rem">
      <div class="fw-600" style="margin-bottom:6px">
        <span style="color:var(--danger)">⚠️</span>
        ${unassigned.length} customer${unassigned.length !== 1 ? 's' : ''} have no agent assigned
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${byType.susu    ? `<span class="badge b-gold">${byType.susu} Susu</span>` : ''}
        ${byType.lending ? `<span class="badge b-blue">${byType.lending} Lending</span>` : ''}
        ${byType.savings ? `<span class="badge b-green">${byType.savings} Savings</span>` : ''}
      </div>
    </div>

    <!-- Mode selector -->
    <div class="form-group">
      <label class="form-label">Assignment Mode</label>
      <select class="form-control" id="noagent-mode" onchange="onNoAgentModeChange()">
        <option value="all">Assign ALL unassigned customers to one agent</option>
        <option value="type">Assign by account type (Susu/Lending/Savings separately)</option>
        <option value="pick">Let me choose individually</option>
      </select>
    </div>

    <!-- All-to-one panel -->
    <div id="noagent-all-panel">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Select Agent</label>
        <select class="form-control" id="noagent-agent-all">
          <option value="">— Choose agent —</option>
          ${agents.map(a => `<option value="${a.id}">${a.code} — ${a.firstName} ${a.lastName}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- By-type panel -->
    <div id="noagent-type-panel" style="display:none">
      ${['susu','lending','savings'].map(t => byType[t] > 0 ? `
        <div class="form-group">
          <label class="form-label" style="text-transform:capitalize">
            ${t} Customers (${byType[t]})
          </label>
          <select class="form-control" id="noagent-agent-${t}">
            <option value="">— Keep unassigned —</option>
            ${agents.map(a => `<option value="${a.id}">${a.code} — ${a.firstName} ${a.lastName}</option>`).join('')}
          </select>
        </div>` : '').join('')}
    </div>

    <!-- Individual pick panel -->
    <div id="noagent-pick-panel" style="display:none">
      <div class="table-wrap" style="max-height:260px;overflow-y:auto">
        <table>
          <thead>
            <tr>
              <th style="width:28px">
                <input type="checkbox" id="noagent-check-all" title="Select all"
                  onchange="document.querySelectorAll('.noagent-check').forEach(c=>c.checked=this.checked)">
              </th>
              <th>Account</th><th>Name</th><th>Type</th><th>Assign To</th>
            </tr>
          </thead>
          <tbody>
            ${unassigned.map((c, i) => `
              <tr>
                <td><input type="checkbox" class="noagent-check" value="${c.id}" checked></td>
                <td class="mono text-gold" style="font-size:.76rem">${c.acctNumber}</td>
                <td style="font-size:.82rem">${c.firstName} ${c.lastName}</td>
                <td><span class="badge ${c.type==='susu'?'b-gold':c.type==='lending'?'b-blue':'b-green'}">${c.type}</span></td>
                <td>
                  <select class="form-control" id="noagent-pick-${c.id}"
                    style="font-size:.76rem;padding:4px 8px">
                    <option value="">— Keep unassigned —</option>
                    ${agents.map(a => `<option value="${a.id}">${a.code} — ${a.firstName} ${a.lastName}</option>`).join('')}
                  </select>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  okBtn.textContent = '✅ Assign';
  okBtn.onclick = () => {
    const mode = document.getElementById('noagent-mode')?.value;
    let assigned = 0;

    if (mode === 'all') {
      const agentId = document.getElementById('noagent-agent-all')?.value;
      if (!agentId) { toast('Select an agent', 'error'); return; }
      const agent = AGENTS.find(a => a.id === agentId);
      unassigned.forEach(c => { c.agentId = agent.id; c.agentCode = agent.code; assigned++; });

    } else if (mode === 'type') {
      ['susu','lending','savings'].forEach(t => {
        const agentId = document.getElementById('noagent-agent-' + t)?.value;
        if (!agentId) return;
        const agent = AGENTS.find(a => a.id === agentId);
        unassigned.filter(c => c.type === t).forEach(c => {
          c.agentId = agent.id; c.agentCode = agent.code; assigned++;
        });
      });

    } else if (mode === 'pick') {
      document.querySelectorAll('.noagent-check:checked').forEach(cb => {
        const custId  = cb.value;
        const agentId = document.getElementById('noagent-pick-' + custId)?.value;
        if (!agentId) return;
        const cust  = CUSTOMERS.find(c => c.id === custId);
        const agent = AGENTS.find(a => a.id === agentId);
        if (cust && agent) { cust.agentId = agent.id; cust.agentCode = agent.code; assigned++; }
      });
    }

    if (!assigned) { toast('No customers were assigned — select an agent', 'warning'); return; }

    saveAll();
    logActivity('Customers', `${assigned} unassigned customer(s) assigned to agent(s)`, 0, 'assign');
    closeModal('modal-confirm');
    renderCustomerList(document.getElementById('cust-search')?.value || '');
    toast(`✅ ${assigned} customer${assigned !== 1 ? 's' : ''} successfully assigned`, 'success');
  };

  openModal('modal-confirm');
}

function onNoAgentModeChange() {
  const mode = document.getElementById('noagent-mode')?.value;
  document.getElementById('noagent-all-panel').style.display  = mode === 'all'  ? '' : 'none';
  document.getElementById('noagent-type-panel').style.display = mode === 'type' ? '' : 'none';
  document.getElementById('noagent-pick-panel').style.display = mode === 'pick' ? '' : 'none';
}
