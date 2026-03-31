// ═══════════════════════════════════════════════════════
//  AGENTS
// ═══════════════════════════════════════════════════════
function getNextAgentCode() {
  const num=AGENTS.length+1; return SETTINGS.susuPrefix+pad2(num);
}
function updateAgentPreview() {
  const p=document.getElementById('next-agent-preview'); if(p) p.textContent=getNextAgentCode();
}
function addAgent() {
  const fn=document.getElementById('ag-fname').value.trim();
  const ln=document.getElementById('ag-lname').value.trim();
  const phone=document.getElementById('ag-phone').value.trim();
  const email=document.getElementById('ag-email').value.trim();
  const dob=document.getElementById('ag-dob').value;
  const joinDate=document.getElementById('ag-joindate').value||todayISO();
  const address=document.getElementById('ag-address').value.trim();
  const idType=document.getElementById('ag-idtype').value;
  const idNum=document.getElementById('ag-idnum').value.trim();
  const target=parseFloat(document.getElementById('ag-target').value)||0;
  const status=document.getElementById('ag-status').value;
  if(!fn||!ln) return toast('Enter first and last name','error');
  if(!phone) return toast('Enter phone number','error');
  const agentNum=AGENTS.length+1;
  const agent={id:uid(),agentNumber:agentNum,code:SETTINGS.susuPrefix+pad2(agentNum),firstName:fn,lastName:ln,phone,email,dob,joinDate,address,idType,idNum,monthlyTarget:target,status,dateAdded:todayISO()};
  AGENTS.push(agent);
  ['ag-fname','ag-lname','ag-phone','ag-email','ag-dob','ag-address','ag-idnum','ag-target'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  updateAgentPreview(); renderAgentList(''); populateAgentSelectors();
  logActivity('Agent','Registered: '+fn+' '+ln,0,'active'); saveAll();
  toast('Agent '+agent.code+' registered: '+fn+' '+ln,'success');
}
function renderAgentList(search) {
  const el=document.getElementById('agent-cards'); if(!el) return;
  const active=AGENTS.filter(a=>a.status==='active').length;
  const ab=document.getElementById('ag-active-badge'), tb=document.getElementById('ag-total-badge');
  if(ab) ab.textContent=active+' Active'; if(tb) tb.textContent=AGENTS.length+' Total';
  let list=AGENTS;
  if(search) list=list.filter(a=>`${a.firstName} ${a.lastName} ${a.code}`.toLowerCase().includes(search.toLowerCase()));
  if(!list.length) { el.innerHTML='<div class="empty-state"><div class="ei">🧑‍💼</div><div class="et">No agents found</div></div>'; return; }
  el.innerHTML=list.map(a=>{
    const custCount=CUSTOMERS.filter(c=>c.agentId===a.id).length;
    const monthColl=TELLER_STATE.collections.filter(c=>c.agentId===a.id).reduce((s,c)=>s+c.amount,0);
    const pct=a.monthlyTarget>0?Math.min(100,Math.round(monthColl/a.monthlyTarget*100)):0;
    return `<div class="agent-card" onclick="openAgentModal('${a.id}')">
      <div class="flex-center gap-10 mb-3">
        <div class="agent-avatar">${a.firstName[0]}${a.lastName[0]}</div>
        <div><div class="fw-600">${a.firstName} ${a.lastName}</div><div class="agent-code" style="margin-top:3px">${a.code}</div></div>
        <span class="badge ${a.status==='active'?'b-green':'b-gray'}" style="margin-left:auto">${a.status}</span>
      </div>
      <div class="flex-between mb-3" style="font-size:.78rem">
        <span class="text-muted">📞 ${a.phone}</span>
        <span class="text-muted">👥 ${custCount} customers</span>
      </div>
      <div class="flex-between mb-2" style="font-size:.78rem">
        <span class="text-muted">Monthly Target</span><span class="text-gold">${fmt(a.monthlyTarget)}</span>
      </div>
      <div class="flex-between mb-2" style="font-size:.78rem">
        <span class="text-muted">Collected This Month</span><span class="text-success">${fmt(monthColl)}</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div style="text-align:right;font-size:.7rem;color:var(--muted);margin-top:3px">${pct}% of target</div>
    </div>`;
  }).join('');
}
function openAgentModal(id) {
  const a=AGENTS.find(x=>x.id===id); if(!a) return;
  const custs=CUSTOMERS.filter(c=>c.agentId===id);
  const monthColl=TELLER_STATE.collections.filter(c=>c.agentId===id).reduce((s,c)=>s+c.amount,0);
  const comm=(monthColl*SETTINGS.commissionRate/100).toFixed(2);
  document.getElementById('m-agent-title').textContent=`${a.firstName} ${a.lastName} — ${a.code}`;
  document.getElementById('m-agent-body').innerHTML=`
    <div class="grid-2 mb-4">
      <div><div class="text-muted" style="font-size:.72rem">PHONE</div><div class="fw-600">${a.phone}</div></div>
      <div><div class="text-muted" style="font-size:.72rem">EMAIL</div><div>${a.email||'—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem">DOB</div><div>${fmtDate(a.dob)}</div></div>
      <div><div class="text-muted" style="font-size:.72rem">JOIN DATE</div><div>${fmtDate(a.joinDate)}</div></div>
      <div><div class="text-muted" style="font-size:.72rem">ID TYPE</div><div>${a.idType||'—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem">ID NUMBER</div><div class="mono">${a.idNum||'—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem">ADDRESS</div><div>${a.address||'—'}</div></div>
      <div><div class="text-muted" style="font-size:.72rem">MONTHLY TARGET</div><div class="text-gold fw-600">${fmt(a.monthlyTarget)}</div></div>
    </div>
    <div class="grid-3 mb-4">
      <div class="stat-card green card-sm"><div class="stat-label">Collections (Month)</div><div class="stat-value">${fmt(monthColl)}</div></div>
      <div class="stat-card gold card-sm"><div class="stat-label">Commission (${SETTINGS.commissionRate}%)</div><div class="stat-value">${fmt(comm)}</div></div>
      <div class="stat-card blue card-sm"><div class="stat-label">Total Customers</div><div class="stat-value">${custs.length}</div></div>
    </div>
    <div class="card-title mt-4"><span>👥</span> Customers Under This Agent</div>
    ${custs.length?`<div class="table-wrap"><table><thead><tr><th>Account</th><th>Name</th><th>Type</th><th>Balance</th></tr></thead><tbody>${custs.map(c=>`<tr><td class="mono text-gold" style="font-size:.78rem">${c.acctNumber}</td><td>${c.firstName} ${c.lastName}</td><td><span class="badge ${c.type==='susu'?'b-gold':c.type==='lending'?'b-blue':'b-green'}">${c.type}</span></td><td class="mono">${fmt(c.balance||0)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state" style="padding:20px 0"><div class="ei">👥</div><div class="et">No customers</div></div>'}
  `;
  openModal('modal-agent');
}
function renderTargets() {
  const picker=document.getElementById('target-month-picker');
  if(picker&&!picker.value) picker.value=new Date().toISOString().slice(0,7);
  const month=picker?.value||new Date().toISOString().slice(0,7);
  const label=document.getElementById('target-month-label'); if(label) label.textContent=monthLabel(month);
  const tb=document.getElementById('targets-tbody'); if(!tb) return;
  if(!AGENTS.length) { tb.innerHTML='<tr><td colspan="6" class="text-center text-muted" style="padding:20px">No agents</td></tr>'; return; }
  const monthColl=(agId)=>TELLER_STATE.collections.filter(c=>c.agentId===agId).reduce((s,c)=>s+c.amount,0);
  tb.innerHTML=AGENTS.map(a=>{
    const mc=monthColl(a.id); const pct=a.monthlyTarget>0?Math.min(100,Math.round(mc/a.monthlyTarget*100)):0;
    return `<tr><td class="fw-600">${a.firstName} ${a.lastName}</td><td class="agent-code">${a.code}</td><td class="mono text-gold">${fmt(a.monthlyTarget)}</td><td><input type="number" class="form-control" style="width:130px;font-size:.82rem;padding:6px 9px" value="${a.monthlyTarget}" min="0" step="0.01" id="tgt-${a.id}" placeholder="0.00"></td><td class="mono text-success">${fmt(mc)}</td><td><div class="progress-wrap" style="min-width:80px"><div class="progress-bar" style="width:${pct}%"></div></div><div style="font-size:.68rem;color:var(--muted)">${pct}%</div></td></tr>`;
  }).join('');
}
function saveAllTargets() {
  AGENTS.forEach(a=>{const el=document.getElementById('tgt-'+a.id); if(el) a.monthlyTarget=parseFloat(el.value)||0;});
  saveAll(); toast('Targets saved for all agents','success');
}
function renderCommissions() {
  const picker=document.getElementById('comm-month-picker');
  if(picker&&!picker.value) picker.value=new Date().toISOString().slice(0,7);
  const tb=document.getElementById('comm-tbody'); if(!tb) return;
  const rate=SETTINGS.commissionRate;
  const l=document.getElementById('comm-rate-label'); if(l) l.textContent=rate+'%';
  const l2=document.getElementById('comm-rate-th'); if(l2) l2.textContent=rate+'%';
  if(!AGENTS.length) { tb.innerHTML='<tr><td colspan="6" class="text-center text-muted" style="padding:20px">No agents</td></tr>'; return; }
  tb.innerHTML=AGENTS.map(a=>{
    const mc=TELLER_STATE.collections.filter(c=>c.agentId===a.id).reduce((s,c)=>s+c.amount,0);
    const comm=mc*rate/100;
    return `<tr><td class="fw-600">${a.firstName} ${a.lastName}</td><td><span class="agent-code">${a.code}</span></td><td class="mono text-success">${fmt(mc)}</td><td class="mono text-gold fw-600">${fmt(comm)}</td><td><span class="badge ${comm>0?'b-green':'b-gray'}">${comm>0?'Due':'No collection'}</span></td><td>${comm>0?`<button class="btn btn-gold btn-xs" onclick="markCommPaid('${a.id}',${comm})">Mark Paid</button>`:'—'}</td></tr>`;
  }).join('');
}
function markCommPaid(agentId, amount) { logActivity('Commission','Commission paid to '+AGENTS.find(a=>a.id===agentId)?.firstName,amount,'paid'); saveAll(); toast(fmt(amount)+' commission marked as paid','success'); }

