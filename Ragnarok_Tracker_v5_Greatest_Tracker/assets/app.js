(() => {
  'use strict';

  const VERSION = '5.2.1';
  const SUPPORT_URL = 'https://buymeacoffee.com/FatherJunJun';
  const TRACKER_URL = 'https://ragnarok-checklist.vercel.app';
  const STORAGE_KEY = 'rtnw-tracker-v5';
  const LEGACY_KEYS = ['ragnarok-new-world-checklist-v3', 'ragnarok-new-world-checklist-v1'];
  const SNAPSHOT_KEY = 'rtnw-tracker-v5-snapshots';
  const CLOUD_KEY = 'rtnw-tracker-v5-cloud';
  const CLOUD_ROOM_RE = /^[a-z0-9-]{8,64}$/i;
  const CLOUD_SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
  const REMINDER_KEY = 'rtnw-tracker-v5-reminders';
  const MUSIC_INTRO_KEY = 'rtnw-tracker-v5-music-intro';
  const SERVER_OFFSET_MIN = 7 * 60;
  const RESET_HOUR = 5;
  const MAX_PROFILES = 50;
  const MAX_SNAPSHOTS = 20;
  const CLOUD_POLL_MS = 15000;
  const DEFAULT_CATEGORIES = ['General', 'Guild', 'PvP', 'Hunt', 'Instance', 'Farming', 'Exploration', 'Social', 'Pets', 'Event'];
  const DEFAULT_DAILY = [
    ['Quest Board','General'],['Guild Dailies','Guild'],['Cat Cargo','General'],['Peer Arena','PvP'],['MVP','Hunt'],['Mini','Hunt'],['Elite','Hunt'],
    ['Monster Extermination','Hunt'],['Healthy Combat','General'],['Card Pity','Farming'],['Lord Chest','Exploration'],
    ['Assist and Hand in Hand','Social'],['Catch Pets','Pets'],['Special Events','Event']
  ];
  const DEFAULT_WEEKLY = [['Forgotten Land','Instance'],['Rift Raid','Instance']];

  const $ = id => document.getElementById(id);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const nowISO = () => new Date().toISOString();
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const norm = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const cleanName = value => {
    const n = norm(value).slice(0, 80);
    return n.toLowerCase() === 'monster etermination' ? 'Monster Extermination' : n;
  };
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${cryptoRandom(6)}`;
  function cryptoRandom(bytes = 16) {
    const a = new Uint8Array(bytes); crypto.getRandomValues(a);
    return [...a].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  function deepClone(v){ return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)); }
  function toast(message, tone = '') {
    const el = document.createElement('div'); el.className = `toast ${tone}`.trim(); el.textContent = message;
    $('toast-stack').append(el); setTimeout(() => el.remove(), 4200);
  }
  function setText(id, text){ const el=$(id); if(el) el.textContent=text; }

  function utcDateKey(d){ return [d.getUTCFullYear(), String(d.getUTCMonth()+1).padStart(2,'0'), String(d.getUTCDate()).padStart(2,'0')].join('-'); }
  function effectiveServerDate(now = new Date()){ return new Date(now.getTime() + (SERVER_OFFSET_MIN - RESET_HOUR * 60) * 60000); }
  function dayKey(now = new Date()){ return utcDateKey(effectiveServerDate(now)); }
  function weekKey(now = new Date()){
    const d = effectiveServerDate(now); const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay()+6)%7)); return utcDateKey(mon);
  }
  function shiftKey(key, days){ const [y,m,d]=key.split('-').map(Number); const x=new Date(Date.UTC(y,m-1,d+days,12)); return utcDateKey(x); }
  function nextDailyReset(now = new Date()){
    const server = new Date(now.getTime() + SERVER_OFFSET_MIN*60000);
    let fake = Date.UTC(server.getUTCFullYear(), server.getUTCMonth(), server.getUTCDate(), RESET_HOUR, 0, 0);
    if(server.getUTCHours() >= RESET_HOUR) fake += 86400000;
    return new Date(fake - SERVER_OFFSET_MIN*60000);
  }
  function formatDateKey(key, opts={weekday:'short',month:'short',day:'numeric',year:'numeric'}){
    const [y,m,d]=key.split('-').map(Number); return new Date(Date.UTC(y,m-1,d,12)).toLocaleDateString(undefined,{...opts,timeZone:'UTC'});
  }
  function serverClockText(now){ const s=new Date(now.getTime()+SERVER_OFFSET_MIN*60000),h=s.getUTCHours(),m=s.getUTCMinutes(),sec=s.getUTCSeconds(); const hr=((h+11)%12)+1; return `${String(hr).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')} ${h>=12?'PM':'AM'}`; }
  function duration(ms, short=false){ const t=Math.max(0,Math.floor(ms/1000)),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60; return short ? `${h}h ${String(m).padStart(2,'0')}m` : `${h?`${h}h `:''}${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`; }

  function categoryForLegacy(name, kind){
    const map = Object.fromEntries((kind==='daily'?DEFAULT_DAILY:DEFAULT_WEEKLY).map(([n,c])=>[n.toLowerCase(),c]));
    return map[cleanName(name).toLowerCase()] || 'General';
  }
  function makeTask(name, category='General', extra={}){
    return {id: extra.id || uid('q'), name: cleanName(name), done: extra.done===true, note: norm(extra.note).slice(0,500), favorite: extra.favorite===true,
      priority: clamp(Number(extra.priority)||0,0,3), category: norm(extra.category || category).slice(0,30) || 'General', updatedAt: extra.updatedAt || nowISO(), completedAt: extra.done ? (extra.completedAt || nowISO()) : null};
  }
  function defaultTasks(kind){ return (kind==='daily'?DEFAULT_DAILY:DEFAULT_WEEKLY).map(([n,c],i)=>makeTask(n,c,{id:`${kind}-${i}`})); }
  function normalizeTask(row, kind){
    if(!row || typeof row !== 'object') return null; const name=cleanName(row.name); if(!name) return null;
    return makeTask(name, row.category || categoryForLegacy(name,kind), row);
  }
  function normalizeProfile(input, fallback='Main Character'){
    const p = input && typeof input==='object' ? input : {};
    const daily = (Array.isArray(p.daily)?p.daily:defaultTasks('daily')).map(x=>normalizeTask(x,'daily')).filter(Boolean);
    const weekly = (Array.isArray(p.weekly)?p.weekly:defaultTasks('weekly')).map(x=>normalizeTask(x,'weekly')).filter(Boolean);
    return {id: typeof p.id==='string'&&p.id?p.id:uid('char'), name:norm(p.name||fallback).slice(0,40)||fallback, className:norm(p.className||'').slice(0,40), avatar:norm(p.avatar||'⚔️').slice(0,4)||'⚔️', dailyDate:p.dailyDate||dayKey(), weekDate:p.weekDate||weekKey(), daily, weekly, updatedAt:p.updatedAt||nowISO()};
  }
  function addEliteHuntQuest(profile){
    if(profile.daily.some(t=>cleanName(t.name).toLowerCase()==='elite')) return;
    const elite=makeTask('Elite','Hunt');
    let at=profile.daily.findIndex(t=>cleanName(t.name).toLowerCase()==='mini');
    if(at<0) at=profile.daily.findIndex(t=>cleanName(t.name).toLowerCase()==='mvp');
    if(at<0){
      const huntIndexes=profile.daily.map((t,i)=>t.category==='Hunt'?i:-1).filter(i=>i>=0);
      at=huntIndexes.length?huntIndexes[huntIndexes.length-1]:profile.daily.length-1;
    }
    profile.daily.splice(at+1,0,elite);
  }
  function defaultSettings(){ return {hideCompleted:false,completedBottom:false,compact:false,uiSounds:true,autoplay:true,theme:'system',finishMode:false,finishAuto:true,collapsedSections:{daily:false,weekly:false},collapsedCategories:{daily:{},weekly:{}},musicVolume:35,reminders:false,reminderHours:2}; }
  function normalizeApp(input){
    const raw = input && typeof input==='object' ? input : {};
    let profiles;
    if(Array.isArray(raw.profiles)) profiles=raw.profiles.slice(0,MAX_PROFILES).map((p,i)=>normalizeProfile(p,i?`Character ${i+1}`:'Main Character'));
    else if(Array.isArray(raw.daily)||Array.isArray(raw.weekly)) profiles=[normalizeProfile(raw)];
    else profiles=[normalizeProfile(null)];
    if(!profiles.length) profiles=[normalizeProfile(null)];
    const savedVersion=String(raw.meta?.appVersion||'');
    if(!['5.1.3','5.1.4','5.2.0','5.2.1'].includes(savedVersion)) profiles.forEach(addEliteHuntQuest);
    const ids=new Set(); profiles.forEach(p=>{if(ids.has(p.id))p.id=uid('char');ids.add(p.id)});
    const settings={...defaultSettings(),...(raw.settings||{})};
    if(!['system','light','dark'].includes(settings.theme)) settings.theme='system';
    settings.collapsedSections={daily:false,weekly:false,...(raw.settings?.collapsedSections||{})};
    settings.collapsedCategories={daily:{},weekly:{},...(raw.settings?.collapsedCategories||{})};
    settings.collapsedCategories.daily={...(raw.settings?.collapsedCategories?.daily||{})};
    settings.collapsedCategories.weekly={...(raw.settings?.collapsedCategories?.weekly||{})};
    const cats=Array.isArray(raw.categories)?raw.categories.map(x=>norm(x).slice(0,30)).filter(Boolean):DEFAULT_CATEGORIES;
    const categories=[...new Set(['General',...cats,...profiles.flatMap(p=>[...p.daily,...p.weekly].map(t=>t.category)).filter(Boolean)])].slice(0,40);
    return {version:5, profiles, activeProfileId:profiles.some(p=>p.id===raw.activeProfileId)?raw.activeProfileId:profiles[0].id,
      categories, settings, history: raw.history && typeof raw.history==='object'?raw.history:{}, meta:{updatedAt:raw.meta?.updatedAt||nowISO(),createdAt:raw.meta?.createdAt||nowISO(),appVersion:VERSION}};
  }

  let app = loadApp();
  let dirtySinceCloud = false;
  let saveDebounce = null;
  let snapshotTimer = null;
  let cloudTimer = null;
  let cloudPollTimer = null;
  let cloudConfigured = false;
  let cloudAuthInvalid = false;
  let cloud = loadCloud();
  dirtySinceCloud = !!(cloud && Date.parse(app.meta?.updatedAt || 0) > Date.parse(cloud.lastSync || 0));
  let swRegistration = null;
  let reloadingForUpdate = false;
  let lastDay = dayKey(), lastWeek = weekKey();
  let drag = null;
  let customMusicUrl=null, audioUnlockArmed=false, audioUnlockHandler=null;
  let sfxCtx=null;
  const theme=$('theme-audio');

  function loadApp(){
    let raw=null;
    try{ raw=localStorage.getItem(STORAGE_KEY); if(!raw){ for(const k of LEGACY_KEYS){raw=localStorage.getItem(k);if(raw)break;} } return normalizeApp(raw?JSON.parse(raw):null); }
    catch(e){ toast('Saved tracker data could not be read. A clean tracker was loaded.','bad'); return normalizeApp(null); }
  }
  function loadCloud(){
    try{
      const x=JSON.parse(localStorage.getItem(CLOUD_KEY)||'null');
      if(!x || !CLOUD_ROOM_RE.test(String(x.roomId||'')) || !CLOUD_SECRET_RE.test(String(x.secret||''))) return null;
      return {roomId:String(x.roomId),secret:String(x.secret),revision:Math.max(0,Number(x.revision)||0),lastSync:typeof x.lastSync==='string'?x.lastSync:null};
    }catch(e){return null;}
  }
  function saveCloud(){
    try{
      if(!cloud){localStorage.removeItem(CLOUD_KEY);return;}
      const minimal={roomId:String(cloud.roomId),secret:String(cloud.secret),revision:Math.max(0,Number(cloud.revision)||0),lastSync:cloud.lastSync||null};
      localStorage.setItem(CLOUD_KEY,JSON.stringify(minimal));
    }catch(e){}
  }
  function active(){ return app.profiles.find(p=>p.id===app.activeProfileId)||app.profiles[0]; }

  function effectiveTheme(){
    const pref=['system','light','dark'].includes(app.settings.theme)?app.settings.theme:'system';
    if(pref==='dark') return 'dark';
    if(pref==='light') return 'light';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(){
    const eff=effectiveTheme();
    document.documentElement.dataset.theme=eff;
    document.documentElement.dataset.themePreference=app.settings.theme||'system';
    const meta=$('theme-color-meta'); if(meta) meta.content=eff==='dark'?'#081426':'#10274b';
    const btn=$('theme-toggle');
    if(btn){
      btn.textContent=eff==='dark'?'☀ Light mode':'☾ Dark mode';
      btn.setAttribute('aria-label',eff==='dark'?'Switch to light mode':'Switch to dark mode');
      btn.title=app.settings.theme==='system'?`Using device setting (${eff})`:`Current theme: ${eff}`;
    }
  }
  function touch(obj){ obj.updatedAt=nowISO(); app.meta.updatedAt=obj.updatedAt; app.meta.appVersion=VERSION; }
  function saveLocal(reason='Change saved', options={}){
    touch(active());
    try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(app)); setText('save-status','Saved locally · '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})); }
    catch(e){ setText('save-status','Local save unavailable'); toast('This browser is blocking local storage.','bad'); }
    dirtySinceCloud=true;
    if(options.snapshot) createSnapshot(options.snapshotReason||reason);
    scheduleSnapshot(reason); scheduleCloudPush(); broadcastState();
  }
  function scheduleSnapshot(reason){ clearTimeout(snapshotTimer); snapshotTimer=setTimeout(()=>createSnapshot(reason),120000); }
  function getSnapshots(){ try{ const s=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'[]'); return Array.isArray(s)?s:[]; }catch(e){return [];} }
  function createSnapshot(reason='Automatic snapshot'){
    try{
      const list=getSnapshots(), json=JSON.stringify(app), newest=list[0]; if(newest?.data===json)return;
      list.unshift({id:uid('snap'),at:nowISO(),reason,data:json}); localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(list.slice(0,MAX_SNAPSHOTS))); updateSnapshotCount();
    }catch(e){}
  }
  function updateSnapshotCount(){ const n=getSnapshots().length; setText('snapshot-count',`${n} snapshot${n===1?'':'s'}`); }
  function broadcastState(){ try{ if(window.BroadcastChannel){ const bc=new BroadcastChannel('rtnw-v5'); bc.postMessage({type:'saved',updatedAt:app.meta.updatedAt}); bc.close(); } }catch(e){} }

  function historyBucket(profile){ if(!app.history[profile.id]) app.history[profile.id]={daily:{},weekly:{}}; const h=app.history[profile.id]; h.daily ||= {}; h.weekly ||= {}; return h; }
  function recordPeriod(profile, kind, key){
    const tasks=profile[kind], done=tasks.filter(t=>t.done).length, h=historyBucket(profile)[kind];
    h[key]={done,total:tasks.length,complete:tasks.length>0&&done===tasks.length,updatedAt:nowISO()};
    const keys=Object.keys(h).sort().reverse(); const keep=kind==='daily'?120:60; keys.slice(keep).forEach(k=>delete h[k]);
  }
  function rolloverProfile(profile, now=new Date()){
    const d=dayKey(now),w=weekKey(now); let changed=false;
    if(profile.dailyDate!==d){ if(profile.dailyDate)recordPeriod(profile,'daily',profile.dailyDate); profile.daily.forEach(t=>{t.done=false;t.completedAt=null}); profile.dailyDate=d; changed=true; }
    if(profile.weekDate!==w){ if(profile.weekDate)recordPeriod(profile,'weekly',profile.weekDate); profile.weekly.forEach(t=>{t.done=false;t.completedAt=null}); profile.weekDate=w; changed=true; }
    if(changed)touch(profile); return changed;
  }
  function rolloverAll(){ let c=false; app.profiles.forEach(p=>{if(rolloverProfile(p))c=true}); if(c){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(app));}catch(e){}} return c; }

  function priorityLabel(n){ return ['Normal','Low','High','Urgent'][n]||'Normal'; }
  function displayTasks(profile,kind){
    let tasks=[...profile[kind]];
    const filtered = app.settings.finishMode || app.settings.hideCompleted;
    if(filtered) tasks=tasks.filter(t=>!t.done);
    if(app.settings.finishMode) tasks.sort((a,b)=>(Number(b.favorite)-Number(a.favorite))||(b.priority-a.priority)||(profile[kind].indexOf(a)-profile[kind].indexOf(b)));
    else if(app.settings.completedBottom) tasks.sort((a,b)=>(Number(a.done)-Number(b.done))||(profile[kind].indexOf(a)-profile[kind].indexOf(b)));
    return tasks;
  }
  function canDrag(){ return !app.settings.finishMode && !app.settings.hideCompleted && !app.settings.completedBottom; }
  function renderAll(){ rolloverAll(); applyTheme(); renderCharacters(); renderKind('daily'); renderKind('weekly'); renderQuick(); renderSettings(); renderCloudUI(); updateSnapshotCount(); document.body.classList.toggle('compact',!!app.settings.compact); document.body.classList.toggle('finish-mode',!!app.settings.finishMode); }
  function renderCharacters(){
    const root=$('character-tabs'); root.replaceChildren();
    app.profiles.forEach(p=>{ const b=document.createElement('button'); b.type='button'; b.className='character-tab'+(p.id===app.activeProfileId?' active':''); b.dataset.profile=p.id; b.innerHTML=`<span>${escapeHTML(p.avatar)}</span><span>${escapeHTML(p.name)}${p.className?`<small> · ${escapeHTML(p.className)}</small>`:''}</span>`; b.addEventListener('click',()=>{app.activeProfileId=p.id;saveLocal('Character switched');renderAll();});root.append(b); });
    const p=active(); const quick=$('quick-character-select'); quick.replaceChildren(); app.profiles.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=`${x.avatar} ${x.name}`;quick.append(o)});quick.value=p.id;
  }
  function renderQuick(){
    const p=active(), dd=p.daily.filter(t=>t.done).length, wd=p.weekly.filter(t=>t.done).length;
    setText('quick-daily',`${dd}/${p.daily.length}`); setText('quick-weekly',`${wd}/${p.weekly.length}`);
    setPressed('toggle-hide-completed',app.settings.hideCompleted); setPressed('toggle-finish-mode',app.settings.finishMode);
  }
  function renderKind(kind){
    const p=active(); recordPeriod(p,kind,kind==='daily'?p.dailyDate:p.weekDate);
    const tasks=p[kind],done=tasks.filter(t=>t.done).length,total=tasks.length,pct=total?done/total*100:0;
    setText(`${kind}-count`,`${done} / ${total}`); $(`${kind}-bar`).style.width=`${pct}%`;
    const prog=$(`${kind}-bar`).parentElement; prog.setAttribute('aria-valuenow',String(done)); prog.setAttribute('aria-valuemax',String(Math.max(1,total))); prog.setAttribute('aria-valuetext',`${done} of ${total} quests done`);
    if(kind==='daily')setText('daily-date',`${formatDateKey(p.dailyDate)} · reset 5:00 AM UTC+7`); else setText('weekly-date',`Week of ${formatDateKey(p.weekDate,{month:'short',day:'numeric',year:'numeric'})} · Monday reset`);
    const body=$(`${kind}-body`), collapsed=!!app.settings.collapsedSections[kind]; body.hidden=collapsed; const cb=document.querySelector(`[data-collapse="${kind}"]`); cb.textContent=collapsed?'Expand':'Collapse'; cb.setAttribute('aria-expanded',String(!collapsed));
    const root=$(`${kind}-groups`); root.replaceChildren(); const shown=displayTasks(p,kind), byCat=new Map();
    shown.forEach(t=>{if(!byCat.has(t.category))byCat.set(t.category,[]);byCat.get(t.category).push(t)});
    const order=[...app.categories,...[...byCat.keys()].filter(c=>!app.categories.includes(c))];
    const cats=order.filter(c=>byCat.has(c));
    if(!cats.length){ const e=document.createElement('div');e.className='empty-state';e.textContent=tasks.length?'Everything visible here is complete. Great work.':'No quests yet. Add one to begin.';root.append(e);return; }
    cats.forEach(category=>root.append(renderCategory(kind,category,byCat.get(category))));
  }
  function renderCategory(kind,category,tasks){
    const block=document.createElement('section');block.className='category-block';block.dataset.category=category;
    const head=document.createElement('div');head.className='category-head'; const collapsed=!!app.settings.collapsedCategories[kind]?.[category];
    head.innerHTML=`<div class="category-title"><strong>${escapeHTML(category)}</strong><span>${tasks.length}</span></div>`;
    const btn=document.createElement('button');btn.type='button';btn.textContent=collapsed?'Expand':'Collapse';btn.addEventListener('click',()=>{app.settings.collapsedCategories[kind][category]=!collapsed;saveLocal('Category view changed');renderKind(kind)});head.append(btn);block.append(head);
    const list=document.createElement('ul');list.className='task-list';list.dataset.kind=kind;list.dataset.category=category;list.hidden=collapsed;
    tasks.forEach(t=>list.append(renderTask(kind,t))); block.append(list); return block;
  }
  function renderTask(kind,task){
    const row=document.createElement('li'); row.className=`task-row${task.done?' done':''}${task.favorite?' favorite':''}${task.priority===2?' high':''}${task.priority===3?' urgent':''}`; row.dataset.taskId=task.id; row.dataset.kind=kind;
    const dragBtn=document.createElement('button');dragBtn.type='button';dragBtn.className='drag-handle';dragBtn.textContent='⋮⋮';dragBtn.title=canDrag()?'Drag to reorder or change category':'Turn off filtering/sorting to drag';dragBtn.disabled=!canDrag();
    dragBtn.addEventListener('pointerdown',e=>startDrag(e,kind,task.id));dragBtn.addEventListener('pointermove',dragMove);dragBtn.addEventListener('pointerup',endDrag);dragBtn.addEventListener('pointercancel',endDrag);dragBtn.addEventListener('keydown',e=>keyboardMove(e,kind,task.id)); row.append(dragBtn);
    const check=document.createElement('label');check.className='task-check';const input=document.createElement('input');input.type='checkbox';input.checked=task.done;input.setAttribute('aria-label',`Mark ${task.name} ${task.done?'unfinished':'complete'}`);input.addEventListener('change',()=>{task.done=input.checked;task.completedAt=task.done?nowISO():null;touch(task);recordPeriod(active(),kind,kind==='daily'?active().dailyDate:active().weekDate);saveLocal('Quest progress');playSfx(task.done?'done':'undo');renderKind(kind);renderQuick();checkCompletion(kind)});check.append(input);row.append(check);
    const copy=document.createElement('div');copy.className='task-copy';const name=document.createElement('div');name.className='task-name';name.textContent=task.name;copy.append(name);const meta=document.createElement('div');meta.className='task-meta';
    if(task.note){const tag=document.createElement('span');tag.className='mini-tag note';tag.textContent='Note';meta.append(tag)}
    if(task.priority>=2){const tag=document.createElement('span');tag.className=`mini-tag priority-${task.priority===3?'urgent':'high'}`;tag.textContent=priorityLabel(task.priority);meta.append(tag)}
    if(task.favorite){const tag=document.createElement('span');tag.className='mini-tag';tag.textContent='Favorite';meta.append(tag)}
    if(meta.childNodes.length)copy.append(meta);row.append(copy);
    const fav=document.createElement('button');fav.type='button';fav.className='favorite-btn';fav.textContent=task.favorite?'★':'☆';fav.setAttribute('aria-pressed',String(task.favorite));fav.title=task.favorite?'Remove favorite':'Favorite quest';fav.addEventListener('click',()=>{task.favorite=!task.favorite;touch(task);saveLocal('Favorite changed');renderKind(kind)});row.append(fav);
    const edit=document.createElement('button');edit.type='button';edit.className='edit-task';edit.textContent=task.note?'Notes · Edit':'Edit';edit.addEventListener('click',()=>openTaskDialog(kind,task.id));row.append(edit);return row;
  }
  function checkCompletion(kind){ const p=active(),tasks=p[kind]; if(tasks.length&&tasks.every(t=>t.done)){toast(`${kind==='daily'?'Daily':'Weekly'} checklist complete!`,'good');createSnapshot(`${kind} completed`);} }
  function escapeHTML(v){ const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML; }
  function setPressed(id,v){ const el=$(id);el?.setAttribute('aria-pressed',String(!!v)); }

  function clearTextSelection(){ try{ window.getSelection?.()?.removeAllRanges?.(); }catch(_){} }
  function startDrag(e,kind,id){ if(!canDrag()||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();clearTextSelection();const row=e.currentTarget.closest('.task-row');drag={kind,id,row,handle:e.currentTarget,pointerId:e.pointerId};row.classList.add('dragging');document.body.classList.add('drag-active');e.currentTarget.setPointerCapture?.(e.pointerId); }
  function dragMove(e){ if(!drag||drag.pointerId!==e.pointerId)return;e.preventDefault();clearTextSelection();if(e.clientY<90)scrollBy(0,-14);else if(e.clientY>innerHeight-80)scrollBy(0,14);const el=document.elementFromPoint(e.clientX,e.clientY);const list=el?.closest('.task-list');if(!list||list.dataset.kind!==drag.kind||list.hidden)return;const over=el.closest('.task-row');if(over&&over!==drag.row){const r=over.getBoundingClientRect();list.insertBefore(drag.row,e.clientY<r.top+r.height/2?over:over.nextSibling);}else if(!over){list.append(drag.row);} }
  function endDrag(e){ if(!drag||drag.pointerId!==e.pointerId)return;try{drag.handle.releasePointerCapture?.(e.pointerId)}catch(_){}const {kind,id}=drag;drag.row.classList.remove('dragging');document.body.classList.remove('drag-active');const p=active(),map=new Map(p[kind].map(t=>[t.id,t])),visibleIds=new Set();const reordered=[];
    $$(`.task-list[data-kind="${kind}"]`).forEach(list=>{ $$('.task-row',list).forEach(row=>{const t=map.get(row.dataset.taskId);if(t){t.category=list.dataset.category;touch(t);reordered.push(t);visibleIds.add(t.id)}})}); p[kind]=[...reordered,...p[kind].filter(t=>!visibleIds.has(t.id))];saveLocal('Quest order changed');drag=null;renderKind(kind);requestAnimationFrame(()=>document.querySelector(`[data-task-id="${CSS.escape(id)}"] .drag-handle`)?.focus()); }
  function keyboardMove(e,kind,id){ if(!canDrag()||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const arr=active()[kind],i=arr.findIndex(t=>t.id===id),j=e.key==='ArrowUp'?i-1:i+1;if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];saveLocal('Quest order changed');renderKind(kind); }

  function openTaskDialog(kind,id=null){
    const task=id?active()[kind].find(t=>t.id===id):null;$('task-id').value=task?.id||'';$('task-kind').value=kind;$('task-dialog-title').textContent=task?'Edit quest':`Add ${kind} quest`;$('task-dialog-kicker').textContent=kind==='daily'?'Daily quest':'Weekly quest';$('task-name').value=task?.name||'';$('task-note').value=task?.note||'';$('task-priority').value=String(task?.priority||0);$('task-favorite').checked=!!task?.favorite;$('task-delete').hidden=!task;
    const select=$('task-category');select.replaceChildren();app.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;select.append(o)});select.value=task?.category||'General';$('task-dialog').showModal();setTimeout(()=>$('task-name').focus(),40);
  }
  function saveTaskFromDialog(){ const kind=$('task-kind').value,id=$('task-id').value,name=cleanName($('task-name').value);if(!name){toast('Enter a quest name.','bad');return false;}const p=active();let task=id?p[kind].find(t=>t.id===id):null;if(!task){task=makeTask(name,$('task-category').value);p[kind].push(task)}task.name=name;task.category=$('task-category').value;task.note=norm($('task-note').value).slice(0,500);task.priority=clamp(Number($('task-priority').value),0,3);task.favorite=$('task-favorite').checked;touch(task);saveLocal('Quest edited');renderKind(kind);return true; }
  function deleteTaskFromDialog(){ const kind=$('task-kind').value,id=$('task-id').value;if(!id)return;if(!confirm('Delete this quest?'))return;createSnapshot('Before deleting quest');active()[kind]=active()[kind].filter(t=>t.id!==id);saveLocal('Quest deleted');$('task-dialog').close();renderKind(kind);renderQuick(); }

  function openCharacterDialog(id=null){ const p=id?app.profiles.find(x=>x.id===id):null;$('character-id').value=p?.id||'';$('character-dialog-title').textContent=p?'Edit character':'Add character';$('character-name').value=p?.name||'';$('character-class').value=p?.className||'';$('character-avatar').value=p?.avatar||'⚔️';$('character-copy-quests').checked=!p;$('character-copy-wrap').hidden=!!p;$('character-delete').hidden=!p||app.profiles.length===1;$('character-dialog').showModal();setTimeout(()=>$('character-name').focus(),40); }
  function saveCharacter(){ const id=$('character-id').value,name=norm($('character-name').value).slice(0,40);if(!name){toast('Enter a character name.','bad');return false;}if(id){const p=app.profiles.find(x=>x.id===id);p.name=name;p.className=norm($('character-class').value).slice(0,40);p.avatar=$('character-avatar').value;touch(p);}else{if(app.profiles.length>=MAX_PROFILES){toast('Maximum character count reached.','bad');return false;}const source=active();let p;if($('character-copy-quests').checked){p=normalizeProfile({name,className:norm($('character-class').value),avatar:$('character-avatar').value,daily:source.daily.map(t=>({...t,id:uid('q'),done:false,completedAt:null})),weekly:source.weekly.map(t=>({...t,id:uid('q'),done:false,completedAt:null}))});}else p=normalizeProfile({name,className:norm($('character-class').value),avatar:$('character-avatar').value});app.profiles.push(p);app.activeProfileId=p.id;}saveLocal('Character saved');renderAll();return true; }
  function deleteCharacter(){ const id=$('character-id').value;if(!id||app.profiles.length===1)return;const p=app.profiles.find(x=>x.id===id);if(!confirm(`Delete ${p.name} and all of this character's tracker data?`))return;createSnapshot('Before deleting character');app.profiles=app.profiles.filter(x=>x.id!==id);delete app.history[id];app.activeProfileId=app.profiles[0].id;saveLocal('Character deleted');$('character-dialog').close();renderAll(); }
  function copySetup(){ if(app.profiles.length<2){toast('Add another character first.');return;}const targets=app.profiles.filter(p=>p.id!==app.activeProfileId);const msg=targets.map((p,i)=>`${i+1}. ${p.name}`).join('\n');const pick=prompt(`Copy quest setup FROM which character?\n\n${msg}`);if(pick===null)return;const src=targets[Number(pick)-1];if(!src){toast('That selection was not valid.','bad');return;}if(!confirm(`Replace ${active().name}'s quest setup with ${src.name}'s setup? Current completion checks will be cleared.`))return;createSnapshot('Before copying character setup');active().daily=src.daily.map(t=>({...t,id:uid('q'),done:false,completedAt:null,updatedAt:nowISO()}));active().weekly=src.weekly.map(t=>({...t,id:uid('q'),done:false,completedAt:null,updatedAt:nowISO()}));saveLocal('Character quest setup copied');renderAll();toast(`Copied ${src.name}'s quest setup.`,'good'); }

  function renderSettings(){ $('setting-hide-completed').checked=!!app.settings.hideCompleted;$('setting-completed-bottom').checked=!!app.settings.completedBottom;$('setting-compact').checked=!!app.settings.compact;$('setting-ui-sounds').checked=!!app.settings.uiSounds;$('setting-autoplay').checked=!!app.settings.autoplay;$('setting-theme').value=['system','light','dark'].includes(app.settings.theme)?app.settings.theme:'system';$('setting-finish-auto').checked=!!app.settings.finishAuto;$('reminders-enabled').checked=!!app.settings.reminders;$('reminder-hours').value=String(app.settings.reminderHours||2);setText('reminder-status',app.settings.reminders?'On':'Off');renderCategoryChips(); }
  function renderCategoryChips(){ const root=$('category-chips');root.replaceChildren();app.categories.forEach(c=>{const chip=document.createElement('span');chip.className='category-chip';chip.append(document.createTextNode(c));if(c!=='General'){const b=document.createElement('button');b.type='button';b.textContent='×';b.title=`Delete ${c}`;b.addEventListener('click',()=>deleteCategory(c));chip.append(b)}root.append(chip)}); }
  function addCategory(){ const c=norm($('new-category-name').value).slice(0,30);if(!c)return;if(app.categories.some(x=>x.toLowerCase()===c.toLowerCase())){toast('That category already exists.');return;}app.categories.push(c);$('new-category-name').value='';saveLocal('Category added');renderCategoryChips(); }
  function deleteCategory(c){ const used=app.profiles.some(p=>[...p.daily,...p.weekly].some(t=>t.category===c));if(used&&!confirm(`Move quests in “${c}” to General and delete this category?`))return;app.profiles.forEach(p=>[...p.daily,...p.weekly].forEach(t=>{if(t.category===c)t.category='General'}));app.categories=app.categories.filter(x=>x!==c);saveLocal('Category deleted',{snapshot:true,snapshotReason:'Before category deletion'});renderAll(); }

  function renderHistory(){ const p=active(),h=historyBucket(p),today=dayKey();let completeDays=0,recorded=0;Object.values(h.daily).forEach(r=>{recorded++;if(r.complete)completeDays++});let streak=0;for(let i=0;i<120;i++){const r=h.daily[shiftKey(today,-i)];if(r?.complete)streak++;else break;}const totalDone=p.daily.filter(t=>t.done).length+p.weekly.filter(t=>t.done).length;
    $('history-summary').innerHTML=`<div class="history-stat"><span>Current checks</span><b>${totalDone}</b></div><div class="history-stat"><span>Complete days</span><b>${completeDays}</b></div><div class="history-stat"><span>Daily streak</span><b>${streak}</b></div>`;
    const cal=$('history-calendar');cal.replaceChildren();for(let i=34;i>=0;i--){const k=shiftKey(today,-i),r=h.daily[k],d=document.createElement('div');d.className='history-day '+(r?.complete?'complete':r?'partial':'');d.innerHTML=`<b>${escapeHTML(formatDateKey(k,{month:'short',day:'numeric'}))}</b><small>${r?`${r.done}/${r.total} done`:'No record'}</small>`;cal.append(d)}
    const weeks=$('weekly-history');weeks.replaceChildren();let wk=weekKey();for(let i=0;i<8;i++){const r=h.weekly[wk],row=document.createElement('div');row.className='weekly-row';row.innerHTML=`<span>Week of ${escapeHTML(formatDateKey(wk,{month:'short',day:'numeric',year:'numeric'}))}</span><b>${r?`${r.done}/${r.total}${r.complete?' ✓':''}`:'No record'}</b>`;weeks.append(row);wk=shiftKey(wk,-7)}
  }
  function renderSnapshots(){ const root=$('snapshot-list'),list=getSnapshots();root.replaceChildren();if(!list.length){root.innerHTML='<div class="empty-state">No snapshots yet. The tracker creates them automatically as you use it.</div>';return;}list.forEach(s=>{const row=document.createElement('div');row.className='snapshot-item';const copy=document.createElement('div');copy.className='snapshot-copy';copy.innerHTML=`<b>${escapeHTML(s.reason||'Snapshot')}</b><small>${new Date(s.at).toLocaleString()}</small>`;const b=document.createElement('button');b.type='button';b.textContent='Restore';b.addEventListener('click',()=>restoreSnapshot(s));row.append(copy,b);root.append(row)}); }
  function restoreSnapshot(s){ if(!confirm('Restore this snapshot and replace your current tracker state?'))return;createSnapshot('Before restoring snapshot');try{app=normalizeApp(JSON.parse(s.data));localStorage.setItem(STORAGE_KEY,JSON.stringify(app));dirtySinceCloud=true;$('snapshot-dialog').close();renderAll();scheduleCloudPush();toast('Snapshot restored.','good')}catch(e){toast('That snapshot could not be restored.','bad')} }

  function base64UrlEncode(str){ const bytes=new TextEncoder().encode(str);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function base64UrlDecode(str){ const b=str.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(str.length/4)*4,'=');const bin=atob(b),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes); }
  function manualCode(){return 'RTNW5-'+base64UrlEncode(JSON.stringify(app))}
  function importManualCode(code){const c=norm(code);if(!c.startsWith('RTNW5-'))throw new Error('This is not a valid RTNW5 sync code.');return normalizeApp(JSON.parse(base64UrlDecode(c.slice(6))));}
  async function copyText(text){ if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.append(ta);ta.select();document.execCommand('copy');ta.remove(); }
  function openSupportDialog(){ const d=$('support-dialog'); if(d&&!d.open)d.showModal(); }
  async function copySupportLink(){ try{await copyText(SUPPORT_URL);toast('Support link copied.','good')}catch(e){prompt('Copy this support link:',SUPPORT_URL)} }
  async function shareTracker(){
    const data={title:'Ragnarok: The New World Tracker | FatherJunJun',text:'Check out the Ragnarok: The New World Tracker by FatherJunJun — a free fan-made tool for managing daily quests, weeklies, multiple characters, reset timers, and progress.',url:TRACKER_URL};
    try{if(navigator.share){await navigator.share(data);return;}await copyText(TRACKER_URL);toast('Tracker link copied.','good')}catch(e){if(e?.name!=='AbortError')toast('Could not share the tracker right now.','bad')}
  }
  function exportBackup(){ const blob=new Blob([JSON.stringify(app,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ragnarok-tracker-backup-${dayKey()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exported.','good'); }
  async function importBackupFile(file){ try{const incoming=normalizeApp(JSON.parse(await file.text()));if(!confirm('Replace this device\'s tracker data with the imported backup?'))return;createSnapshot('Before importing backup');app=incoming;localStorage.setItem(STORAGE_KEY,JSON.stringify(app));dirtySinceCloud=true;renderAll();scheduleCloudPush();toast('Backup imported.','good')}catch(e){toast('That backup file could not be read.','bad')} }

  async function checkCloudHealth(){
    try{const r=await fetch('/api/health',{cache:'no-store'});if(!r.ok)throw new Error('No API');const j=await r.json();cloudConfigured=!!j.cloudConfigured;}
    catch(e){cloudConfigured=false;} renderCloudUI(); if(cloudConfigured&&cloud){await cloudPull(false);if(dirtySinceCloud)await cloudPush(false);startCloudPolling();}
  }
  function pairCode(){ return cloud?`RTNW-CLOUD-${cloud.roomId}.${cloud.secret}`:''; }
  function parsePairCode(code){ const c=norm(code);const m=c.match(/^RTNW-CLOUD-([a-z0-9-]{8,64})\.([A-Za-z0-9_-]{32,128})$/i);if(!m)throw new Error('That pairing code is not valid.');return{roomId:m[1],secret:m[2],revision:0}; }
  async function cloudRequest(body){ const r=await fetch('/api/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'same-origin'});let j={};try{j=await r.json()}catch(e){}if(!r.ok){let message=j.error||`Cloud sync error (${r.status})`;if(r.status===429){const retry=Number(r.headers.get('retry-after')||0);message=retry?`Cloud sync is rate-limited. Try again in about ${Math.max(1,Math.ceil(retry/60))} minute(s).`:'Cloud sync is temporarily rate-limited. Try again shortly.';}const err=new Error(message);err.status=r.status;err.payload=j;throw err;}return j; }
  function renderCloudUI(){ const pill=$('cloud-status-pill'),txt=$('cloud-status-text');if(!cloudConfigured){pill.textContent='Setup needed';pill.className='status-pill';txt.textContent='Cloud-sync code is built in, but this deployment still needs its database connection. Local/offline tracking is fully active.';setText('cloud-mini','Local save');}
    else if(!cloud){pill.textContent='Ready';pill.className='status-pill good';txt.textContent='Cloud service is ready. Create a private pairing code on this device, then join with that code on your PC or phone.';setText('cloud-mini','Cloud ready');}
    else if(cloudAuthInvalid){pill.textContent='Re-pair needed';pill.className='status-pill bad';txt.textContent='This device’s cloud pairing code is no longer valid. Disconnect this device, then join again with the current pairing code.';setText('cloud-mini','Re-pair needed');}
    else{pill.textContent='Connected';pill.className='status-pill good';txt.textContent=`Paired as ${cloud.roomId}. Changes sync automatically while online.`;setText('cloud-mini','Cloud connected');}
    ['cloud-create','cloud-join'].forEach(id=>$(id).disabled=!cloudConfigured||!!cloud);['cloud-sync-now','cloud-copy-code','cloud-disconnect','cloud-rotate','cloud-revoke'].forEach(id=>{if($(id))$(id).disabled=!cloudConfigured||!cloud});
  }
  async function cloudCreate(){
    if(!cloudConfigured)return;
    try{
      const j=await cloudRequest({action:'create',state:deepClone(app)});
      if(!j?.roomId||!j?.secret)throw new Error('Cloud pairing could not be created.');
      cloud={roomId:j.roomId,secret:j.secret,revision:Number(j.revision)||1,lastSync:nowISO()};
      cloudAuthInvalid=false;saveCloud();dirtySinceCloud=false;await copyText(pairCode());toast('Cloud pairing created. Pairing code copied.','good');renderCloudUI();startCloudPolling();
    }catch(e){cloud=null;saveCloud();renderCloudUI();toast(e.message,'bad')}
  }
  function openCloudJoinDialog(){
    if(!cloudConfigured||cloud)return;
    const d=$('cloud-join-dialog');
    $('cloud-join-code').value='';
    if(d&&!d.open)d.showModal();
    setTimeout(()=>$('cloud-join-code')?.focus(),40);
  }
  async function pasteCloudJoinCode(){
    try{
      if(!navigator.clipboard?.readText)throw new Error('Clipboard paste is not available in this browser.');
      const code=await navigator.clipboard.readText();
      if(!code)throw new Error('Your clipboard is empty.');
      $('cloud-join-code').value=code.trim();
      toast('Pairing code pasted.','good');
    }catch(e){toast('Paste the pairing code into the box manually.','bad');$('cloud-join-code')?.focus();}
  }
  async function submitCloudJoin(){
    if(!cloudConfigured||cloud)return;
    const code=$('cloud-join-code').value;
    let incoming;
    try{incoming=parsePairCode(code)}catch(e){toast(e.message,'bad');$('cloud-join-code')?.focus();return;}
    createSnapshot('Before joining cloud sync');
    const previous=cloud;cloud=incoming;saveCloud();
    const connect=$('cloud-join-submit'); if(connect)connect.disabled=true;
    try{
      await cloudPull(true);cloudAuthInvalid=false;
      $('cloud-join-dialog')?.close('connected');
      toast('This device is now paired for automatic sync.','good');renderCloudUI();startCloudPolling();
    }catch(e){cloud=previous;saveCloud();renderCloudUI();toast(e.status===401?'That pairing code could not be authenticated.':e.message,'bad')}
    finally{if(connect)connect.disabled=false;}
  }
  function cloudDisconnect(){ if(!cloud)return;if(!confirm('Disconnect cloud sync on this device? Your local tracker data will stay here.'))return;cloud=null;cloudAuthInvalid=false;saveCloud();clearInterval(cloudPollTimer);cloudPollTimer=null;renderCloudUI();toast('Cloud sync disconnected on this device.'); }
  async function cloudRotate(){
    if(!cloudConfigured||!cloud)return;
    if(!confirm('Rotate the cloud pairing code? The old code will stop working immediately and every other device will need to join again with the new code.'))return;
    try{
      const j=await cloudRequest({action:'rotate',roomId:cloud.roomId,secret:cloud.secret});
      if(!j?.secret)throw new Error('The pairing code could not be rotated.');
      cloud.secret=j.secret;cloud.revision=Number(j.revision)||cloud.revision||0;cloud.lastSync=nowISO();cloudAuthInvalid=false;saveCloud();
      try{await copyText(pairCode());toast('Pairing code rotated. The new code was copied. Re-pair your other devices.','good')}catch(_){prompt('Copy your new pairing code:',pairCode())}
      renderCloudUI();
    }catch(e){toast(e.status===401?'The current pairing code could not be authenticated.':e.message,'bad')}
  }
  async function cloudRevoke(){
    if(!cloudConfigured||!cloud)return;
    if(!confirm('Revoke this cloud pairing for every device? The cloud copy will be deleted. Your tracker data on this device will stay saved locally.'))return;
    try{
      await cloudRequest({action:'revoke',roomId:cloud.roomId,secret:cloud.secret});
      cloud=null;cloudAuthInvalid=false;saveCloud();clearInterval(cloudPollTimer);cloudPollTimer=null;dirtySinceCloud=false;renderCloudUI();setText('save-status','Saved locally');toast('Cloud pairing revoked for all devices. Local data was kept.','good');
    }catch(e){toast(e.status===401?'The current pairing code could not be authenticated.':e.message,'bad')}
  }
  function scheduleCloudPush(){ if(!cloudConfigured||!cloud||!navigator.onLine)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>cloudPush(false).catch(()=>{}),900); }
  async function cloudPush(force=false){ if(!cloudConfigured||!cloud||!navigator.onLine)return;const payload=deepClone(app);try{const j=await cloudRequest({action:'push',roomId:cloud.roomId,secret:cloud.secret,baseRevision:force?undefined:(cloud.revision||0),state:payload});cloudAuthInvalid=false;cloud.revision=j.revision||cloud.revision;cloud.lastSync=nowISO();saveCloud();dirtySinceCloud=false;setText('save-status','Cloud synced · '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));renderCloudUI();}
    catch(e){if(e.status===409&&e.payload?.state){const server=normalizeApp(e.payload.state),serverTime=Date.parse(server.meta?.updatedAt||0),localTime=Date.parse(app.meta?.updatedAt||0);cloud.revision=e.payload.revision||cloud.revision;saveCloud();if(serverTime>=localTime){app=server;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(app));}catch(_){}dirtySinceCloud=false;renderAll();toast('Cloud changes were merged from your other device.');}else{return cloudPush(true);}}else{if(e.status===401){cloudAuthInvalid=true;renderCloudUI();setText('save-status','Saved locally · cloud re-pair needed');}else setText('save-status','Saved locally · cloud waiting');throw e;}}
  }
  async function cloudPull(force=false){ if(!cloudConfigured||!cloud||!navigator.onLine)return;let j;try{j=await cloudRequest({action:'pull',roomId:cloud.roomId,secret:cloud.secret});cloudAuthInvalid=false;}catch(e){if(e.status===401){cloudAuthInvalid=true;renderCloudUI();setText('save-status','Saved locally · cloud re-pair needed');}throw e;}if(!j.state)return;const server=normalizeApp(j.state),revision=j.revision||0;if(force||revision>(cloud.revision||0)){const serverTime=Date.parse(server.meta?.updatedAt||0),localTime=Date.parse(app.meta?.updatedAt||0);if(!dirtySinceCloud||force||serverTime>=localTime){app=server;cloud.revision=revision;cloud.lastSync=nowISO();saveCloud();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(app));}catch(_){}dirtySinceCloud=false;renderAll();}else{cloud.revision=revision;saveCloud();await cloudPush(true);}} }
  function startCloudPolling(){ if(cloudPollTimer)clearInterval(cloudPollTimer);cloudPollTimer=setInterval(()=>{if(document.visibilityState==='visible')cloudPull(false).catch(()=>{})},CLOUD_POLL_MS); }

  async function enableReminders(enabled){ if(enabled){if(!('Notification'in window)){toast('Notifications are not supported by this browser.','bad');return false;}let p=Notification.permission;if(p==='default')p=await Notification.requestPermission();if(p!=='granted'){toast('Notification permission was not granted.','bad');return false;}app.settings.reminders=true;}else app.settings.reminders=false;saveLocal('Reminder settings changed');renderSettings();return true; }
  async function notifyReset(hoursLeft){ const p=active(),left=p.daily.filter(t=>!t.done).length;if(!left)return;const msg=`${left} daily quest${left===1?'':'s'} remaining. Reset is in about ${hoursLeft} hour${hoursLeft===1?'':'s'}.`;toast(msg);try{if(swRegistration?.showNotification)await swRegistration.showNotification('Ragnarok daily reset reminder',{body:msg,icon:'/icon-192.png',badge:'/icon-192.png',tag:`daily-${p.id}-${dayKey()}`});else if(Notification.permission==='granted')new Notification('Ragnarok daily reset reminder',{body:msg,icon:'/icon-192.png',tag:`daily-${p.id}-${dayKey()}`});}catch(e){} }
  function reminderTick(ms){ if(!app.settings.reminders)return;const threshold=(Number(app.settings.reminderHours)||2)*3600000;if(ms>threshold||ms<=0)return;let sent={};try{sent=JSON.parse(localStorage.getItem(REMINDER_KEY)||'{}')}catch(e){}const key=`${active().id}:${dayKey()}:${app.settings.reminderHours}`;if(sent[key])return;sent[key]=nowISO();try{localStorage.setItem(REMINDER_KEY,JSON.stringify(sent))}catch(e){}notifyReset(app.settings.reminderHours); }

  function playSfx(type){ if(!app.settings.uiSounds)return;try{sfxCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=sfxCtx.createOscillator(),g=sfxCtx.createGain();o.frequency.value=type==='done'?880:520;g.gain.setValueAtTime(.035,sfxCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,sfxCtx.currentTime+.11);o.connect(g);g.connect(sfxCtx.destination);o.start();o.stop(sfxCtx.currentTime+.12);}catch(e){} }
  function applyVolume(){const level=clamp(Number($('music-volume').value)/100,0,1);app.settings.musicVolume=Math.round(level*100);try{theme.volume=level}catch(e){}try{localStorage.setItem(STORAGE_KEY,JSON.stringify(app))}catch(e){} }
  function musicButton(){ $('music-toggle').textContent=theme.paused?'♫ Play music':'❚❚ Pause music';$('music-toggle').setAttribute('aria-pressed',String(!theme.paused)); }
  function musicIntroSeen(){try{return localStorage.getItem(MUSIC_INTRO_KEY)==='1'}catch(e){return false}}
  function markMusicIntroSeen(){try{localStorage.setItem(MUSIC_INTRO_KEY,'1')}catch(e){}}
  function showMusicWelcome(){const w=$('welcome');if(!w)return;w.hidden=false;document.body.classList.add('welcome-open');requestAnimationFrame(()=>$('enter-play')?.focus())}
  function hideMusicWelcome(){const w=$('welcome');if(!w)return;w.hidden=true;document.body.classList.remove('welcome-open')}
  function setMusicNeedsGesture(needs){const b=$('music-unlock');if(b)b.hidden=!needs;if(needs&&theme.paused)setText('music-name',`${theme.dataset.name||'Theme of Prontera'} · tap to enable music`)}
  function disarmAudioUnlock(){if(!audioUnlockArmed)return;audioUnlockArmed=false;if(audioUnlockHandler){document.removeEventListener('pointerdown',audioUnlockHandler,true);document.removeEventListener('keydown',audioUnlockHandler,true);audioUnlockHandler=null}}
  function handleMusicStarted(){disarmAudioUnlock();setMusicNeedsGesture(false);musicButton();setText('music-name',`${theme.dataset.name||'Theme of Prontera'} · playing`)}
  function handleMusicBlocked(silentFailure=false){musicButton();setMusicNeedsGesture(true);armAudioUnlock();if(!silentFailure)toast('Tap “Enable music” or anywhere on the tracker to start the music.','bad')}
  function playMusic(silentFailure=false){
    applyVolume();
    let result;
    try{result=theme.play();}catch(e){handleMusicBlocked(silentFailure);return Promise.reject(e)}
    return Promise.resolve(result).then(()=>{handleMusicStarted();return true}).catch(e=>{handleMusicBlocked(silentFailure);throw e});
  }
  function armAudioUnlock(){
    if(audioUnlockArmed)return;
    audioUnlockArmed=true;
    audioUnlockHandler=e=>{
      if(e.type==='keydown'&&['Shift','Control','Alt','Meta','Tab','Escape'].includes(e.key))return;
      const attempt=playMusic(true);
      Promise.resolve(attempt).catch(()=>{});
    };
    document.addEventListener('pointerdown',audioUnlockHandler,true);
    document.addEventListener('keydown',audioUnlockHandler,true);
  }
  function pauseMusic(){disarmAudioUnlock();theme.pause();setMusicNeedsGesture(false);musicButton();setText('music-name',`${theme.dataset.name||'Theme of Prontera'} · paused`)}
  function initMusic(){
    theme.dataset.name='Theme of Prontera';$('music-volume').value=String(app.settings.musicVolume??35);applyVolume();musicButton();setMusicNeedsGesture(false);
    $('enter-play')?.addEventListener('click',()=>{
      markMusicIntroSeen();hideMusicWelcome();app.settings.autoplay=true;
      const attempt=playMusic(false);saveLocal('Music preference changed');renderSettings();Promise.resolve(attempt).catch(()=>{});
    });
    $('enter-quiet')?.addEventListener('click',()=>{markMusicIntroSeen();hideMusicWelcome();app.settings.autoplay=false;pauseMusic();saveLocal('Music preference changed');renderSettings();toast('Entered quietly. You can start music anytime.');});
    $('music-unlock')?.addEventListener('click',()=>{markMusicIntroSeen();const attempt=playMusic(false);Promise.resolve(attempt).catch(()=>{})});
    $('music-toggle').addEventListener('click',()=>{markMusicIntroSeen();if(theme.paused){const attempt=playMusic(false);Promise.resolve(attempt).catch(()=>{})}else pauseMusic()});
    $('music-volume').addEventListener('input',applyVolume);
    $('choose-music').addEventListener('click',()=>$('music-file').click());
    $('music-file').addEventListener('change',()=>{const f=$('music-file').files?.[0];if(!f)return;pauseMusic();if(customMusicUrl)URL.revokeObjectURL(customMusicUrl);customMusicUrl=URL.createObjectURL(f);theme.src=customMusicUrl;theme.dataset.name=f.name;$('restore-music').hidden=false;$('music-file').value='';markMusicIntroSeen();const attempt=playMusic(false);Promise.resolve(attempt).catch(()=>{})});
    $('restore-music').addEventListener('click',()=>{pauseMusic();if(customMusicUrl)URL.revokeObjectURL(customMusicUrl);customMusicUrl=null;theme.src='/assets/prontera.mp3';theme.dataset.name='Theme of Prontera';$('restore-music').hidden=true;markMusicIntroSeen();const attempt=playMusic(false);Promise.resolve(attempt).catch(()=>{})});
    theme.addEventListener('play',handleMusicStarted);theme.addEventListener('pause',musicButton);theme.addEventListener('error',()=>{disarmAudioUnlock();setMusicNeedsGesture(false);setText('music-name',`${theme.dataset.name||'Theme of Prontera'} · could not load`);toast('The music file could not be loaded.','bad')});
    if(app.settings.autoplay){
      if(!musicIntroSeen())showMusicWelcome();
      else{const attempt=playMusic(true);Promise.resolve(attempt).catch(()=>{})}
    }
  }

  function tick(){ const now=new Date(),reset=nextDailyReset(now),ms=reset-now;setText('server-clock',serverClockText(now));setText('daily-countdown',duration(ms));setText('quick-reset',duration(ms,true));reminderTick(ms);const d=dayKey(now),w=weekKey(now);if(d!==lastDay||w!==lastWeek){lastDay=d;lastWeek=w;if(rolloverAll()){createSnapshot('Automatic reset');saveLocal('Server reset');renderAll();toast('Checklist reset for the new server period.','good')}}if(app.settings.finishAuto&&ms<=2*3600000&&active().daily.some(t=>!t.done)){const k=`finish:${active().id}:${dayKey()}`;if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');toast('Reset is close. Finish Before Reset mode is ready if you want it.')}} }

  function bindUI(){
    document.addEventListener('selectstart',e=>{ if(drag) e.preventDefault(); },{passive:false});
    document.addEventListener('contextmenu',e=>{ if(drag || e.target.closest?.('.drag-handle')) e.preventDefault(); });
    $$('[data-dialog-close]').forEach(btn=>btn.addEventListener('click',()=>{ const dialog=btn.closest('dialog'); if(dialog?.open) dialog.close('cancel'); }));
    $$('.modal').forEach(dialog=>dialog.addEventListener('cancel',e=>{ e.preventDefault(); dialog.close('cancel'); }));
    $('toggle-hide-completed').addEventListener('click',()=>{app.settings.hideCompleted=!app.settings.hideCompleted;if(app.settings.hideCompleted)app.settings.completedBottom=false;saveLocal('Filter changed');renderAll()});
    $('toggle-finish-mode').addEventListener('click',()=>{app.settings.finishMode=!app.settings.finishMode;saveLocal('Finish mode changed');renderAll()});
    $('quick-character-select').addEventListener('change',e=>{app.activeProfileId=e.target.value;saveLocal('Character switched');renderAll()});
    $$('[data-collapse]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.collapse;app.settings.collapsedSections[k]=!app.settings.collapsedSections[k];saveLocal('Section view changed');renderKind(k)}));
    $$('[data-add-task]').forEach(b=>b.addEventListener('click',()=>openTaskDialog(b.dataset.addTask)));
    $$('[data-clear-checks]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.clearChecks;if(!confirm(`Clear all ${k} checks? Your quests, notes, and order will stay.`))return;createSnapshot(`Before clearing ${k} checks`);active()[k].forEach(t=>{t.done=false;t.completedAt=null;touch(t)});saveLocal(`${k} checks cleared`);renderKind(k);renderQuick()}));
    $('task-save').addEventListener('click',e=>{e.preventDefault();if(saveTaskFromDialog())$('task-dialog').close()});$('task-delete').addEventListener('click',deleteTaskFromDialog);
    $('add-character').addEventListener('click',()=>openCharacterDialog());$('edit-character').addEventListener('click',()=>openCharacterDialog(active().id));$('copy-character').addEventListener('click',copySetup);$('character-save').addEventListener('click',e=>{e.preventDefault();if(saveCharacter())$('character-dialog').close()});$('character-delete').addEventListener('click',deleteCharacter);
    $('open-history').addEventListener('click',()=>{renderHistory();$('history-dialog').showModal()});$('theme-toggle').addEventListener('click',()=>{app.settings.theme=effectiveTheme()==='dark'?'light':'dark';saveLocal('Theme changed');renderAll()});$('open-settings').addEventListener('click',()=>{renderSettings();$('settings-dialog').showModal()});$('add-category').addEventListener('click',addCategory);$('new-category-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addCategory()}});
    ['open-support','support-card-qr','footer-support','settings-support'].forEach(id=>$(id)?.addEventListener('click',openSupportDialog));$('copy-support-link')?.addEventListener('click',copySupportLink);['share-tracker','settings-share'].forEach(id=>$(id)?.addEventListener('click',shareTracker));
    $('cloud-rotate')?.addEventListener('click',cloudRotate);$('cloud-revoke')?.addEventListener('click',cloudRevoke);
    const settingMap=[['setting-hide-completed','hideCompleted'],['setting-completed-bottom','completedBottom'],['setting-compact','compact'],['setting-ui-sounds','uiSounds'],['setting-autoplay','autoplay'],['setting-finish-auto','finishAuto']];settingMap.forEach(([id,key])=>$(id).addEventListener('change',e=>{app.settings[key]=e.target.checked;if(key==='hideCompleted'&&e.target.checked)app.settings.completedBottom=false;if(key==='completedBottom'&&e.target.checked)app.settings.hideCompleted=false;if(key==='autoplay'){markMusicIntroSeen();if(e.target.checked){const attempt=playMusic(true);Promise.resolve(attempt).catch(()=>{})}else pauseMusic()}saveLocal('Settings changed');renderAll()}));
    $('setting-theme').addEventListener('change',e=>{app.settings.theme=['system','light','dark'].includes(e.target.value)?e.target.value:'system';saveLocal('Theme changed');renderAll()});
    const themeMedia=window.matchMedia?.('(prefers-color-scheme: dark)');themeMedia?.addEventListener?.('change',()=>{if(app.settings.theme==='system')applyTheme()});
    $('restore-snapshot').addEventListener('click',()=>{renderSnapshots();$('snapshot-dialog').showModal()});$('export-backup').addEventListener('click',exportBackup);$('import-backup').addEventListener('click',()=>$('backup-file').click());$('backup-file').addEventListener('change',()=>{const f=$('backup-file').files?.[0];if(f)importBackupFile(f);$('backup-file').value=''});
    $('copy-sync-code').addEventListener('click',async()=>{try{await copyText(manualCode());toast('Manual sync code copied.','good')}catch(e){prompt('Copy this sync code:',manualCode())}});$('import-sync-code').addEventListener('click',()=>{const c=prompt('Paste an RTNW5 manual sync code:');if(c===null)return;try{const incoming=importManualCode(c);if(!confirm('Replace this device\'s tracker data with the imported sync code?'))return;createSnapshot('Before manual sync import');app=incoming;localStorage.setItem(STORAGE_KEY,JSON.stringify(app));dirtySinceCloud=true;renderAll();scheduleCloudPush();toast('Manual sync imported.','good')}catch(e){toast(e.message,'bad')}});
    $('cloud-create').addEventListener('click',cloudCreate);$('cloud-join').addEventListener('click',openCloudJoinDialog);$('cloud-join-paste')?.addEventListener('click',pasteCloudJoinCode);$('cloud-join-submit')?.addEventListener('click',e=>{e.preventDefault();submitCloudJoin()});$('cloud-sync-now').addEventListener('click',async()=>{try{await cloudPull(false);await cloudPush(false);toast('Cloud sync complete.','good')}catch(e){toast(e.message,'bad')}});$('cloud-copy-code').addEventListener('click',async()=>{if(!cloud)return;try{await copyText(pairCode());toast('Pairing code copied.','good')}catch(e){prompt('Copy this pairing code:',pairCode())}});$('cloud-disconnect').addEventListener('click',cloudDisconnect);
    $('reminders-enabled').addEventListener('change',async e=>{const ok=await enableReminders(e.target.checked);if(!ok)e.target.checked=false});$('reminder-hours').addEventListener('change',e=>{app.settings.reminderHours=Number(e.target.value)||2;saveLocal('Reminder timing changed');renderSettings()});
    window.addEventListener('online',()=>{setText('network-status','Online');checkCloudHealth()});window.addEventListener('offline',()=>{setText('network-status','Offline');setText('cloud-mini','Local/offline')});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cloud)cloudPull(false).catch(()=>{})});
    window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&e.newValue){try{const incoming=normalizeApp(JSON.parse(e.newValue));if(Date.parse(incoming.meta.updatedAt)>=Date.parse(app.meta.updatedAt)){app=incoming;renderAll()}}catch(_){}}});
    try{if(window.BroadcastChannel){const bc=new BroadcastChannel('rtnw-v5');bc.onmessage=()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const incoming=normalizeApp(JSON.parse(raw));if(Date.parse(incoming.meta.updatedAt)>=Date.parse(app.meta.updatedAt)){app=incoming;renderAll()}}}catch(_){}};}}catch(e){}
  }

  function isIOSDevice(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
  function isStandaloneDisplay(){return window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true}
  async function initPWA(){
    const installBtn=$('install-app');let deferred=null;const ios=isIOSDevice();
    if(ios&&!isStandaloneDisplay()){installBtn.hidden=false;installBtn.textContent='＋ Add to Home Screen'}
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(!isStandaloneDisplay()){installBtn.hidden=false;installBtn.textContent='＋ Install App'}});
    window.addEventListener('appinstalled',()=>{deferred=null;installBtn.hidden=true;toast('Tracker installed. Welcome to the adventure!','good')});
    installBtn.addEventListener('click',async()=>{
      if(ios&&!isStandaloneDisplay()){const d=$('install-dialog');if(d&&!d.open)d.showModal();return;}
      if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;installBtn.hidden=true;return;}
      toast('Use your browser menu and choose Install App or Add to Home Screen.');
    });
    if(!('serviceWorker'in navigator))return;
    try{swRegistration=await navigator.serviceWorker.register('/sw.js');if(swRegistration.waiting)showUpdate();swRegistration.addEventListener('updatefound',()=>{const nw=swRegistration.installing;nw?.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)showUpdate()})});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadingForUpdate)return;reloadingForUpdate=true;location.reload()});$('apply-update').addEventListener('click',()=>swRegistration?.waiting?.postMessage({type:'SKIP_WAITING'}));setInterval(()=>swRegistration?.update(),60*60*1000);}catch(e){}
  }
  function showUpdate(){$('update-banner').hidden=false}

  async function boot(){
    rolloverAll();recordPeriod(active(),'daily',active().dailyDate);recordPeriod(active(),'weekly',active().weekDate);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(app))}catch(e){}
    bindUI();renderAll();initMusic();initPWA();checkCloudHealth();tick();setInterval(tick,1000);createSnapshot('Tracker v5 startup');setText('network-status',navigator.onLine?'Online':'Offline');
    document.documentElement.dataset.ready='true';
  }

  boot().catch(err=>{console.error(err);toast('Tracker startup encountered an error. Reload the page or restore a backup.','bad')});
})();
