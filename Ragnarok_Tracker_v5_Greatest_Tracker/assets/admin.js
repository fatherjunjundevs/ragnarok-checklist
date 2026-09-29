(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={rows:[],selectedId:null};
const STATUS={new:'New',reviewing:'Reviewing',planned:'Planned',fixed:'Fixed',closed:'Closed'};
const TYPE={bug:['🐛','Bug'],suggestion:['💡','Suggestion'],general:['⭐','General']};
const AREA={dailies:'Dailies',weeklies:'Weeklies',journal:'Adventure Journal',characters:'Characters',layout:'Layout / Display',mobile:'Mobile / Installed App',cloud:'Cloud Sync',other:'Other'};
const OPEN_STATUSES=new Set(['new','reviewing','planned']);

function showLogin(message=''){
  $('dashboard-view').hidden=true;$('login-view').hidden=false;$('login-status').textContent=message;
  $('login-status').className='form-status'+(message?' bad':'');setTimeout(()=>$('admin-password')?.focus(),30);
}
function showDashboard(){$('login-view').hidden=true;$('dashboard-view').hidden=false}
async function request(url,options={},unauthorizedMessage='Your admin session expired. Please sign in again.'){
  const res=await fetch(url,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},cache:'no-store'});
  let data={};try{data=await res.json()}catch(_){}
  if(res.status===401){showLogin(unauthorizedMessage);throw new Error('Unauthorized')}
  if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}
function formatDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?'Unknown time':d.toLocaleString()}
function relativeTime(value){
  const ms=Date.now()-Date.parse(value||'');if(!Number.isFinite(ms))return'';
  const abs=Math.abs(ms),future=ms<0;
  const units=[[86400000,'day'],[3600000,'hour'],[60000,'minute']];
  for(const [size,label] of units){
    if(abs>=size){const n=Math.max(1,Math.floor(abs/size));return future?`in ${n} ${label}${n===1?'':'s'}`:`${n} ${label}${n===1?'':'s'} ago`}
  }
  return 'just now';
}
function typeMeta(row){return TYPE[row.feedback_type]||['✦','Feedback']}
function selectedRow(){return state.rows.find(x=>x.id===state.selectedId)||null}

function renderSummary(){
  const root=$('summary');root.replaceChildren();
  ['new','reviewing','planned','fixed','closed'].forEach(status=>{
    const card=document.createElement('button');card.type='button';card.className='summary-card';card.dataset.status=status;
    const label=document.createElement('span');label.textContent=STATUS[status];
    const value=document.createElement('strong');value.textContent=String(state.rows.filter(x=>x.status===status).length);
    card.append(label,value);card.addEventListener('click',()=>{$('filter-status').value=status;renderList()});root.append(card);
  });
}
function filteredRows(){
  const status=$('filter-status').value,type=$('filter-type').value,area=$('filter-area').value,q=$('filter-search').value.trim().toLowerCase(),sort=$('filter-sort').value;
  let rows=state.rows.filter(row=>{
    if(status==='open'&&!OPEN_STATUSES.has(row.status))return false;
    if(status!=='all'&&status!=='open'&&row.status!==status)return false;
    if(type!=='all'&&row.feedback_type!==type)return false;
    if(area!=='all'&&row.area!==area)return false;
    if(q){
      const hay=[row.message,row.steps,row.expected,row.contact,row.admin_notes,row.feedback_type,row.area,row.status].join(' ').toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });
  const time=v=>Date.parse(v||'')||0;
  rows=[...rows].sort((a,b)=>{
    if(sort==='oldest')return time(a.created_at)-time(b.created_at);
    if(sort==='updated')return time(b.updated_at||b.created_at)-time(a.updated_at||a.created_at);
    return time(b.created_at)-time(a.created_at);
  });
  return rows;
}
function renderList(){
  const root=$('feedback-list'),rows=filteredRows();root.replaceChildren();
  $('result-count').textContent=`${rows.length} ${rows.length===1?'report':'reports'}`;$('empty-state').hidden=rows.length>0;
  rows.forEach(row=>{
    const button=document.createElement('button');button.type='button';button.className='feedback-card';
    const [icon,label]=typeMeta(row);const iconEl=document.createElement('span');iconEl.className='type-icon';iconEl.textContent=icon;
    const copy=document.createElement('div');copy.className='feedback-copy';
    const top=document.createElement('div');top.className='feedback-topline';const strong=document.createElement('strong');strong.textContent=`${label} · ${AREA[row.area]||row.area}`;top.append(strong);
    const msg=document.createElement('p');msg.className='feedback-message';msg.textContent=row.message||'';
    const sub=document.createElement('div');sub.className='feedback-sub';
    const ref=document.createElement('span');ref.textContent=`#${String(row.id||'').slice(0,8)}`;
    const date=document.createElement('span');date.textContent=`${relativeTime(row.created_at)} · ${formatDate(row.created_at)}`;
    sub.append(ref,date);
    if(row.contact){const contact=document.createElement('span');contact.textContent='Contact provided';sub.append(contact)}
    copy.append(top,msg,sub);
    const pill=document.createElement('span');pill.className=`status-pill ${row.status}`;pill.textContent=STATUS[row.status]||row.status;
    button.append(iconEl,copy,pill);button.addEventListener('click',()=>openDetail(row.id));root.append(button);
  });
}
function renderAll(){renderSummary();renderList()}
async function loadFeedback(initial=false){
  try{
    const data=await request('/api/admin-feedback',{},initial?'Please sign in to continue.':'Your admin session expired. Please sign in again.');
    state.rows=Array.isArray(data.feedback)?data.feedback:[];showDashboard();renderAll();$('last-refreshed').textContent=`Updated ${new Date().toLocaleTimeString()}`;
  }catch(err){
    if(err.message!=='Unauthorized'){if(!$('dashboard-view').hidden)$('last-refreshed').textContent=err.message;else showLogin(err.message)}
  }
}
function renderTimeline(row){
  const root=$('detail-timeline');root.replaceChildren();
  const items=[
    ['Submitted',row.created_at],
    ['Reviewed',row.reviewed_at],
    ['Resolved',row.resolved_at]
  ].filter(([,value])=>value);
  items.forEach(([label,value])=>{
    const chip=document.createElement('span');chip.className='timeline-chip';chip.textContent=`${label}: ${formatDate(value)}`;root.append(chip);
  });
}
function renderWorkflow(row){
  document.querySelectorAll('[data-quick-status]').forEach(btn=>{
    const status=btn.dataset.quickStatus,current=status===row.status;
    btn.setAttribute('aria-current',String(current));btn.disabled=current;
  });
}
function openDetail(id){
  const row=state.rows.find(x=>x.id===id);if(!row)return;state.selectedId=id;
  const [icon,label]=typeMeta(row);$('detail-reference').textContent=`#${String(row.id).slice(0,8)}`;
  $('detail-title').textContent=`${icon} ${label} · ${AREA[row.area]||row.area}`;
  $('detail-meta').textContent=`Submitted ${formatDate(row.created_at)} · ${relativeTime(row.created_at)}`;
  renderTimeline(row);renderWorkflow(row);
  $('detail-message').textContent=row.message||'';$('detail-steps').textContent=row.steps||'';$('detail-expected').textContent=row.expected||'';$('detail-contact').textContent=row.contact||'';
  $('steps-section').hidden=!row.steps;$('expected-section').hidden=!row.expected;$('contact-section').hidden=!row.contact;
  $('detail-diagnostics').textContent=JSON.stringify(row.diagnostics||{},null,2);$('detail-status').value=row.status||'new';$('detail-notes').value=row.admin_notes||'';
  $('detail-status-message').textContent='';$('detail-status-message').className='form-status';
  const d=$('feedback-dialog');if(!d.open)d.showModal();
}
async function saveDetail(statusOverride=null){
  const id=state.selectedId;if(!id)return null;
  const button=$('save-feedback');button.disabled=true;$('detail-status-message').textContent='Saving…';
  try{
    const status=statusOverride||$('detail-status').value;
    const data=await request('/api/admin-feedback',{method:'PATCH',body:JSON.stringify({id,status,admin_notes:$('detail-notes').value})});
    const row=data.feedback,index=state.rows.findIndex(x=>x.id===id);if(index>=0&&row)state.rows[index]=row;
    renderAll();$('detail-status-message').textContent=`Saved · ${STATUS[row?.status]||status}`;$('detail-status-message').className='form-status good';if(row)openDetail(row.id);return row;
  }catch(err){
    $('detail-status-message').textContent=err.message;$('detail-status-message').className='form-status bad';return null;
  }finally{button.disabled=false}
}
function fullReport(row){
  const [,label]=typeMeta(row),report=[`Reference: #${String(row.id).slice(0,8)}`,`Type: ${label}`,`Area: ${AREA[row.area]||row.area}`,`Status: ${STATUS[row.status]||row.status}`,`Submitted: ${formatDate(row.created_at)}`,'','Message:',row.message||''];
  if(row.steps)report.push('','Steps to reproduce:',row.steps);
  if(row.expected)report.push('','Expected result:',row.expected);
  if(row.contact)report.push('','Contact:',row.contact);
  report.push('','Safe diagnostics:',JSON.stringify(row.diagnostics||{},null,2));
  if(row.admin_notes)report.push('','Private admin notes:',row.admin_notes);
  return report.join('\n');
}
function githubIssueDraft(row){
  const [,label]=typeMeta(row),title=`[Feedback #${String(row.id).slice(0,8)}] ${label}: ${AREA[row.area]||row.area}`;
  const body=[
    `# ${title}`,
    '',
    '> Drafted from private tracker feedback. Review before publishing.',
    '',
    '## Feedback',
    row.message||''
  ];
  if(row.steps)body.push('','## Steps to reproduce',row.steps);
  if(row.expected)body.push('','## Expected result',row.expected);
  body.push('','## Safe diagnostics','```json',JSON.stringify(row.diagnostics||{},null,2),'```','','---',`Private feedback reference: #${String(row.id).slice(0,8)}`);
  return body.join('\n');
}
async function copyText(value,success){
  try{await navigator.clipboard.writeText(value);$('detail-status-message').textContent=success;$('detail-status-message').className='form-status good'}
  catch(_){$('detail-status-message').textContent='Copy failed';$('detail-status-message').className='form-status bad'}
}
function nextNew(){
  const current=selectedRow(),rows=[...state.rows].filter(x=>x.status==='new').sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
  if(!rows.length){$('detail-status-message').textContent='No new reports left.';$('detail-status-message').className='form-status good';return}
  let next=rows[0];
  if(current){const i=rows.findIndex(x=>x.id===current.id);if(i>=0&&rows[i+1])next=rows[i+1];else if(i>=0&&rows.length>1)next=rows[0]}
  if(current&&next.id===current.id&&rows.length===1){$('detail-status-message').textContent='This is the only new report.';return}
  openDetail(next.id);
}

$('login-form').addEventListener('submit',async e=>{
  e.preventDefault();const password=$('admin-password').value,button=$('login-submit');button.disabled=true;$('login-status').textContent='Signing in…';$('login-status').className='form-status';
  try{await request('/api/admin-login',{method:'POST',body:JSON.stringify({password})},'Invalid admin credentials.');$('admin-password').value='';await loadFeedback()}
  catch(err){if(err.message!=='Unauthorized')showLogin(err.message)}
  finally{button.disabled=false}
});
$('refresh-feedback').addEventListener('click',loadFeedback);
$('logout').addEventListener('click',async()=>{try{await fetch('/api/admin-logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'})}catch(_){}state.rows=[];showLogin('')});
['filter-status','filter-type','filter-area','filter-sort'].forEach(id=>$(id).addEventListener('change',renderList));
$('filter-search').addEventListener('input',renderList);
$('save-feedback').addEventListener('click',()=>saveDetail());
document.querySelectorAll('[data-quick-status]').forEach(btn=>btn.addEventListener('click',()=>saveDetail(btn.dataset.quickStatus)));
$('copy-report').addEventListener('click',()=>{const row=selectedRow();if(row)copyText(fullReport(row),'Full report copied')});
$('copy-issue-draft').addEventListener('click',()=>{const row=selectedRow();if(row)copyText(githubIssueDraft(row),'GitHub issue draft copied')});
$('next-new').addEventListener('click',nextNew);
loadFeedback(true);
})();
