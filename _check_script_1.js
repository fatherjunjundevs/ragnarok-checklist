
(() => {
  'use strict';
  const KEY = 'ragnarok-new-world-checklist-v3';
  const OLD_KEY = 'ragnarok-new-world-checklist-v1';
  const SERVER_OFFSET_MIN = 7 * 60;
  const SERVER_RESET_HOUR = 5;
  const kinds = ['daily', 'weekly'];
  const defaults = {
    daily: ['Quest Board', 'Guild Dailies', 'Cat Cargo', 'Peer Arena', 'MVP', 'Mini', 'Monster Extermination', 'Healthy Combat', 'Card Pity', 'Lord Chest', 'Assist and Hand in Hand', 'Catch Pets', 'Special Events'],
    weekly: ['Forgotten Land', 'Rift Raid']
  };
  const byId = id => document.getElementById(id);
  const normalizeName = name => String(name ?? '').trim().replace(/\s+/g, ' ');
  let idSequence = 0;
  const newId = prefix => (prefix || 'id') + '-' + Date.now().toString(36) + '-' + (++idSequence) + '-' + Math.random().toString(36).slice(2, 8);
  const utcDateKey = date => [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
  function effectiveServerDate(now = new Date()) { return new Date(now.getTime() + (SERVER_OFFSET_MIN - SERVER_RESET_HOUR * 60) * 60000); }
  function dayKey(now = new Date()) { return utcDateKey(effectiveServerDate(now)); }
  function weekKey(now = new Date()) {
    const d = effectiveServerDate(now);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    return utcDateKey(monday);
  }
  function nextDailyReset(now = new Date()) {
    const server = new Date(now.getTime() + SERVER_OFFSET_MIN * 60000);
    let fake = Date.UTC(server.getUTCFullYear(), server.getUTCMonth(), server.getUTCDate(), SERVER_RESET_HOUR, 0, 0);
    if (server.getUTCHours() >= SERVER_RESET_HOUR) fake += 86400000;
    return new Date(fake - SERVER_OFFSET_MIN * 60000);
  }
  function formatKey(key, opts = {weekday:'long', month:'long', day:'numeric', year:'numeric'}) {
    const [y,m,d] = key.split('-').map(Number);
    return new Date(Date.UTC(y,m-1,d,12)).toLocaleDateString(undefined, {...opts, timeZone:'UTC'});
  }
  function cleanTaskName(name) {
    const n = normalizeName(name).slice(0,80);
    return n.toLowerCase() === 'monster etermination' ? 'Monster Extermination' : n;
  }
  function makeTasks(kind) { return defaults[kind].map((name,i) => ({id: kind+'-'+i, name, done:false})); }
  function normalizeProfile(value, fallbackName = 'Main Character') {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = {id: typeof input.id === 'string' && input.id ? input.id : newId('char'), name: cleanTaskName(input.name || fallbackName).slice(0,40) || fallbackName, dailyDate: input.dailyDate, weekDate: input.weekDate};
    for (const kind of kinds) {
      const rows = Array.isArray(input[kind]) ? input[kind] : makeTasks(kind);
      const ids = new Set();
      result[kind] = rows.filter(row => row && typeof row.name === 'string' && cleanTaskName(row.name)).map(row => {
        let id = typeof row.id === 'string' && row.id ? row.id : newId(kind);
        if (ids.has(id)) id = newId(kind);
        ids.add(id);
        return {id, name: cleanTaskName(row.name), done: row.done === true};
      });
    }
    return result;
  }
  function normalizeApp(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    if (Array.isArray(input.profiles)) {
      const profiles = input.profiles.slice(0,50).map((p,i) => normalizeProfile(p, i ? 'Character '+(i+1) : 'Main Character'));
      if (!profiles.length) profiles.push(normalizeProfile(null));
      const ids = new Set();
      profiles.forEach(p => { if (ids.has(p.id)) p.id = newId('char'); ids.add(p.id); });
      return {version:3, profiles, activeProfileId: profiles.some(p => p.id === input.activeProfileId) ? input.activeProfileId : profiles[0].id};
    }
    if (Array.isArray(input.daily) || Array.isArray(input.weekly)) {
      const p = normalizeProfile({...input, name:'Main Character'});
      return {version:3, profiles:[p], activeProfileId:p.id};
    }
    const p = normalizeProfile(null);
    return {version:3, profiles:[p], activeProfileId:p.id};
  }
  let app, lastSaved = null, storageUnavailable = false;
  function warnStorage(message) { const n=byId('storage-note'); n.textContent=message; n.hidden=false; }
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) raw = localStorage.getItem(OLD_KEY);
    app = normalizeApp(raw ? JSON.parse(raw) : null);
  } catch (error) {
    app = normalizeApp(null);
    if (error instanceof SyntaxError) warnStorage('Saved data could not be read. A fresh checklist is shown.');
    else { storageUnavailable = true; warnStorage('The checklist works in this session, but this browser is not allowing local saving.'); }
  }
  const active = () => app.profiles.find(p => p.id === app.activeProfileId) || app.profiles[0];
  function save() {
    if (storageUnavailable) return;
    try { lastSaved = JSON.stringify(app); localStorage.setItem(KEY, lastSaved); }
    catch (error) { storageUnavailable=true; warnStorage('The checklist works in this session, but this browser is not allowing local saving.'); }
  }
  function rollover(profile = active(), now = new Date()) {
    const day = dayKey(now), week = weekKey(now); let changed=false;
    if (profile.dailyDate !== day) { profile.daily.forEach(t => t.done=false); profile.dailyDate=day; changed=true; }
    if (profile.weekDate !== week) { profile.weekly.forEach(t => t.done=false); profile.weekDate=week; changed=true; }
    return changed;
  }
  function rolloverAll() { let changed=false; for(const p of app.profiles) if(rollover(p)) changed=true; return changed; }
  function say(kind,text){ byId(kind+'-status').textContent=text; }
  function syncSay(text){ byId('sync-status').textContent=text; }
  function updateProfileSelect() {
    const select=byId('profile-select'), current=active(); select.replaceChildren();
    app.profiles.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; select.append(o); });
    select.value=current.id; byId('profile-delete').disabled=app.profiles.length===1;
  }
  function updateSummary(kind) {
    const p=active(), tasks=p[kind], done=tasks.filter(t=>t.done).length;
    byId(kind+'-count').textContent=done+' / '+tasks.length+' done';
    const bar=byId(kind+'-bar'); bar.style.width=(tasks.length?done/tasks.length*100:0)+'%';
    const progress=bar.parentElement; progress.setAttribute('aria-valuenow',String(done)); progress.setAttribute('aria-valuemax',String(Math.max(1,tasks.length))); progress.setAttribute('aria-valuetext',done+' of '+tasks.length+' quests done');
    byId(kind+'-date').textContent = kind==='daily' ? 'Server day: '+formatKey(p.dailyDate)+' · reset 5:00 AM UTC+7' : 'Week of '+formatKey(p.weekDate,{month:'long',day:'numeric',year:'numeric'})+' · Monday reset 5:00 AM UTC+7';
  }
  function taskIndex(kind,id){ return active()[kind].findIndex(t=>t.id===id); }
  function moveTask(kind,id,toIndex){ const a=active()[kind], from=a.findIndex(t=>t.id===id); if(from<0||toIndex<0||toIndex>=a.length||from===toIndex)return false; const [row]=a.splice(from,1); a.splice(toIndex,0,row); save(); render(kind); focusHandle(kind,id); say(kind,'Quest order saved.'); return true; }
  function focusHandle(kind,id){ requestAnimationFrame(()=>{ const row=[...byId(kind+'-list').querySelectorAll('.item')].find(el=>el.dataset.taskId===id); const handle=row?.querySelector('.drag-handle'); if(handle)handle.focus(); }); }
  let drag=null;
  function startDrag(event,kind,id){
    if(event.pointerType==='mouse' && event.button!==0)return; event.preventDefault();
    const handle=event.currentTarget,row=handle.closest('.item'),list=row.parentElement; drag={kind,id,row,list,handle,pointerId:event.pointerId,moved:false};
    row.classList.add('dragging'); document.body.classList.add('dragging-page'); handle.setPointerCapture?.(event.pointerId);
  }
  function dragMove(event){
    if(!drag || event.pointerId!==drag.pointerId)return; event.preventDefault(); drag.moved=true;
    if(event.clientY<80) window.scrollBy(0,-14); else if(event.clientY>window.innerHeight-80) window.scrollBy(0,14);
    const el=document.elementFromPoint(event.clientX,event.clientY), over=el && el.closest('.item');
    if(!over || over===drag.row || over.parentElement!==drag.list)return;
    const rect=over.getBoundingClientRect();
    if(event.clientY < rect.top+rect.height/2) drag.list.insertBefore(drag.row,over); else drag.list.insertBefore(drag.row,over.nextSibling);
  }
  function endDrag(event){
    if(!drag || event.pointerId!==drag.pointerId)return;
    const {kind,id,row,list,handle}=drag; try{handle.releasePointerCapture?.(event.pointerId)}catch(e){}
    row.classList.remove('dragging'); document.body.classList.remove('dragging-page');
    const order=[...list.querySelectorAll('.item')].map(el=>el.dataset.taskId), map=new Map(active()[kind].map(t=>[t.id,t])); active()[kind]=order.map(x=>map.get(x)).filter(Boolean); save(); say(kind,'Quest order saved.'); drag=null; focusHandle(kind,id);
  }
  function render(kind) {
    const list=byId(kind+'-list'), p=active(); list.replaceChildren();
    if(!p[kind].length){ const empty=document.createElement('li'); empty.className='empty'; empty.textContent='No '+kind+' quests yet. Add one below.'; list.append(empty); }
    for(const task of p[kind]){
      const row=document.createElement('li'); row.className='item'+(task.done?' done':''); row.dataset.taskId=task.id;
      const grip=document.createElement('button'); grip.type='button'; grip.className='drag-handle'; grip.textContent='⋮⋮'; grip.title='Drag to reorder '+task.name; grip.setAttribute('aria-label',grip.title);
      grip.addEventListener('pointerdown',e=>startDrag(e,kind,task.id)); grip.addEventListener('pointermove',dragMove); grip.addEventListener('pointerup',endDrag); grip.addEventListener('pointercancel',endDrag);
      grip.addEventListener('keydown',e=>{ if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return; e.preventDefault(); const i=taskIndex(kind,task.id), to=e.key==='ArrowUp'?i-1:i+1; moveTask(kind,task.id,to); });
      const label=document.createElement('label'), cb=document.createElement('input'); cb.type='checkbox'; cb.checked=task.done; cb.dataset.taskId=task.id; const name=document.createElement('span'); name.className='task-name'; name.textContent=task.name; label.append(cb,name);
      const actions=document.createElement('div'); actions.className='task-actions';
      const edit=document.createElement('button'); edit.type='button'; edit.className='task-action edit'; edit.textContent='✎'; edit.dataset.editId=task.id; edit.title='Rename '+task.name; edit.setAttribute('aria-label',edit.title);
      const del=document.createElement('button'); del.type='button'; del.className='task-action delete'; del.textContent='×'; del.dataset.removeId=task.id; del.title='Remove '+task.name; del.setAttribute('aria-label',del.title);
      actions.append(edit,del); row.append(grip,label,actions); list.append(row);
    }
    updateSummary(kind);
  }
  function renderAll(){ updateProfileSelect(); kinds.forEach(render); }
  for(const kind of kinds){
    byId(kind+'-list').addEventListener('change',event=>{ const id=event.target.dataset.taskId; if(!id)return; rollover(active()); const task=active()[kind].find(t=>t.id===id); if(task) task.done=event.target.checked; save(); if(task) event.target.closest('.item')?.classList.toggle('done',task.done); updateSummary(kind); say(kind,''); });
    byId(kind+'-list').addEventListener('click',event=>{
      const edit=event.target.closest('button[data-edit-id]'); if(edit){ const task=active()[kind].find(t=>t.id===edit.dataset.editId); if(!task)return; const raw=prompt('Rename quest:',task.name); if(raw===null)return; const name=cleanTaskName(raw); if(!name){say(kind,'Quest name cannot be blank.');return;} if(active()[kind].some(t=>t.id!==task.id&&t.name.toLowerCase()===name.toLowerCase())){say(kind,'That quest is already on this list.');return;} task.name=name; save(); render(kind); say(kind,'Quest renamed.'); focusHandle(kind,task.id); return; }
      const del=event.target.closest('button[data-remove-id]'); if(!del)return; const i=taskIndex(kind,del.dataset.removeId); if(i<0)return; const task=active()[kind][i]; if(!confirm('Remove “'+task.name+'” from this character?'))return; active()[kind].splice(i,1); save(); render(kind); say(kind,'Removed '+task.name+'.');
    });
    byId(kind+'-form').addEventListener('submit',event=>{ event.preventDefault(); rollover(active()); const input=byId(kind+'-new'), name=cleanTaskName(input.value); if(!name){say(kind,'Type a quest name first.');input.focus();return;} if(active()[kind].some(t=>t.name.toLowerCase()===name.toLowerCase())){say(kind,'That quest is already on this list.');input.focus();return;} active()[kind].push({id:newId(kind),name,done:false}); save(); render(kind); input.value=''; input.focus(); say(kind,'Added '+name+'.'); });
    byId(kind+'-reset').addEventListener('click',()=>{ rollover(active()); active()[kind].forEach(t=>t.done=false); save(); render(kind); say(kind,'Checks cleared. Your quests and order are unchanged.'); });
  }
  byId('profile-select').addEventListener('change',event=>{ app.activeProfileId=event.target.value; rollover(active()); save(); renderAll(); });
  byId('profile-add').addEventListener('click',()=>{ const raw=prompt('Character name:','New Character'); if(raw===null)return; const name=normalizeName(raw).slice(0,40); if(!name)return; const p=normalizeProfile({name}); rollover(p); app.profiles.push(p); app.activeProfileId=p.id; save(); renderAll(); });
  byId('profile-rename').addEventListener('click',()=>{ const p=active(), raw=prompt('Rename character:',p.name); if(raw===null)return; const name=normalizeName(raw).slice(0,40); if(!name)return; p.name=name; save(); updateProfileSelect(); });
  byId('profile-delete').addEventListener('click',()=>{ if(app.profiles.length===1)return; const p=active(); if(!confirm('Delete character “'+p.name+'” and all of its checklist data?'))return; app.profiles=app.profiles.filter(x=>x.id!==p.id); app.activeProfileId=app.profiles[0].id; save(); renderAll(); });
  function serverClockText(now){
    const server=new Date(now.getTime()+SERVER_OFFSET_MIN*60000), h=server.getUTCHours(), m=server.getUTCMinutes(), s=server.getUTCSeconds();
    const hour=((h+11)%12)+1, ap=h>=12?'PM':'AM'; return String(hour).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+' '+ap;
  }
  function duration(ms){ const total=Math.max(0,Math.floor(ms/1000)), h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60; return (h? h+'h ':'')+String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'s'; }
  let lastDay=dayKey(), lastWeek=weekKey();
  function tick(){ const now=new Date(); byId('server-clock').textContent=serverClockText(now); byId('daily-countdown').textContent=duration(nextDailyReset(now)-now); const d=dayKey(now), w=weekKey(now); if(d!==lastDay||w!==lastWeek){ lastDay=d; lastWeek=w; if(rolloverAll()){save();renderAll();} } }
  function encodeSync(){ const json=JSON.stringify(app), bytes=new TextEncoder().encode(json); let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b)); return 'RTNW3-'+btoa(bin); }
  function decodeSync(code){ const clean=String(code||'').trim(); if(!clean.startsWith('RTNW3-')) throw new Error('This is not a valid RTNW3 sync code.'); const bin=atob(clean.slice(6)), bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)); return normalizeApp(JSON.parse(new TextDecoder().decode(bytes))); }
  async function copyText(text){ if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); return; } const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.append(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); if(!ok)throw new Error('Copy failed'); }
  byId('copy-sync').addEventListener('click',async()=>{ try{ await copyText(encodeSync()); syncSay('Sync code copied. Paste it on your other device and choose Import sync code.'); }catch(e){ prompt('Copy this sync code:',encodeSync()); syncSay('A sync code was opened for manual copying.'); } });
  byId('import-sync').addEventListener('click',()=>{ const code=prompt('Paste your RTNW3 sync code:'); if(code===null)return; try{ const incoming=decodeSync(code); if(!confirm('Import this code and replace the checklist data stored on this device?'))return; app=incoming; rolloverAll(); save(); renderAll(); syncSay('Sync code imported successfully.'); }catch(e){ syncSay(e.message||'That sync code could not be imported.'); } });
  byId('export-backup').addEventListener('click',()=>{ const blob=new Blob([JSON.stringify(app,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download='ragnarok-checklist-backup-'+dayKey()+'.json'; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); syncSay('Backup file created.'); });
  byId('import-backup-btn').addEventListener('click',()=>byId('import-backup-file').click());
  byId('import-backup-file').addEventListener('change',async()=>{ const f=byId('import-backup-file').files?.[0]; if(!f)return; try{ const incoming=normalizeApp(JSON.parse(await f.text())); if(!confirm('Import this backup and replace the checklist data stored on this device?'))return; app=incoming; rolloverAll(); save(); renderAll(); syncSay('Backup imported successfully.'); }catch(e){ syncSay('That backup file could not be read.'); } finally { byId('import-backup-file').value=''; } });
  window.addEventListener('storage',event=>{ if(event.key!==KEY||!event.newValue)return; try{ app=normalizeApp(JSON.parse(event.newValue)); rolloverAll(); lastSaved=event.newValue; renderAll(); }catch(e){} });
  rolloverAll(); save(); renderAll(); tick(); setInterval(tick,1000);
  document.querySelectorAll('[data-enable]').forEach(el=>el.disabled=false); updateProfileSelect(); byId('runtime-note').hidden=true;
  try {
    const theme=byId('theme-audio'), musicButton=byId('music-toggle'), volume=byId('music-volume'), musicFile=byId('music-file'), musicName=byId('music-name'), welcome=byId('welcome'), main=document.querySelector('main'), embeddedSource=theme.getAttribute('src');
    let fileUrl=null, trackName='Theme of Prontera', attempt=0, audioFailed=false;
    function buttonState(){ musicButton.textContent=theme.paused?'♫ Play music':'❚❚ Pause music'; musicButton.setAttribute('aria-pressed',String(!theme.paused)); }
    function closeWelcome(returnFocus){ welcome.hidden=true; main.inert=false; if(returnFocus)musicButton.focus(); }
    function showWelcome(){ byId('welcome-track').textContent=trackName+' is ready. Tap to start the music.'; welcome.hidden=false; main.inert=true; byId('enter-play').focus(); }
    function stopMusic(){ attempt++; theme.pause(); buttonState(); }
    async function playMusic(){ const current=++attempt; try{ await theme.play(); if(current!==attempt)return; audioFailed=false; closeWelcome(false); buttonState(); musicName.textContent=trackName+' · playing'; }catch(error){ if(current!==attempt)return; buttonState(); if(error.name==='NotAllowedError')showWelcome(); else{audioFailed=true;closeWelcome(false);musicName.textContent='This audio could not play. Choose another audio file or restore Prontera.';} } }
    function setVolume(){ try{ theme.volume=Math.max(0,Math.min(1,Number(volume.value)/100)); }catch(e){} }
    setVolume(); byId('enter-play').addEventListener('click',playMusic); byId('enter-quiet').addEventListener('click',()=>{stopMusic();closeWelcome(true);});
    welcome.addEventListener('keydown',event=>{ if(event.key==='Escape'){stopMusic();closeWelcome(true);} if(event.key==='Tab'){const first=byId('enter-play'),last=byId('enter-quiet');if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}} });
    musicButton.addEventListener('click',()=>{if(theme.paused)playMusic();else stopMusic();}); volume.addEventListener('input',setVolume); theme.addEventListener('play',buttonState); theme.addEventListener('pause',()=>{buttonState();if(!audioFailed)musicName.textContent=trackName+' · paused';});
    theme.addEventListener('error',()=>{audioFailed=true;buttonState();closeWelcome(false);musicName.textContent='This audio could not play. Choose another audio file or restore Prontera.';});
    byId('choose-music').addEventListener('click',()=>musicFile.click()); musicFile.addEventListener('change',()=>{const file=musicFile.files&&musicFile.files[0];if(!file)return;stopMusic();if(fileUrl)URL.revokeObjectURL(fileUrl);audioFailed=false;fileUrl=URL.createObjectURL(file);trackName=file.name;theme.src=fileUrl;byId('restore-music').hidden=false;musicName.textContent=trackName+' · ready';musicFile.value='';playMusic();});
    byId('restore-music').addEventListener('click',()=>{stopMusic();if(fileUrl){URL.revokeObjectURL(fileUrl);fileUrl=null;}audioFailed=false;theme.src=embeddedSource;trackName='Theme of Prontera';byId('restore-music').hidden=true;musicName.textContent=trackName+' · ready';playMusic();});
    playMusic();
  } catch(error){ byId('music-name').textContent='Music is unavailable in this browser. The checklist is ready.'; byId('welcome').hidden=true; document.querySelector('main').inert=false; }
})();
