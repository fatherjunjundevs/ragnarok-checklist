const crypto = require('crypto');

const MAX_REQUEST_BYTES = 16_000;
const FETCH_TIMEOUT_MS = 8_000;
const TYPES = new Set(['bug','suggestion','general']);
const AREAS = new Set(['dailies','weeklies','journal','characters','layout','mobile','cloud','other']);

function json(res,status,body,extra={}){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  Object.entries(extra).forEach(([k,v])=>res.setHeader(k,v));
  return res.status(status).json(body);
}
function config(){return{base:String(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:String(process.env.SUPABASE_SERVICE_ROLE_KEY||'')}}
function headers(key,prefer){const h={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};if(prefer)h.Prefer=prefer;return h;}
function sameOriginOrNonBrowser(req){const origin=String(req.headers.origin||'');if(!origin)return true;const host=String(req.headers['x-forwarded-host']||req.headers.host||'');if(!host)return false;if(origin===`https://${host}`)return true;return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)&&origin===`http://${host}`;}
function clientIp(req){const raw=req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.headers['x-real-ip']||'unknown';return String(Array.isArray(raw)?raw[0]:raw).split(',')[0].trim().slice(0,128)||'unknown';}
function hashRateKey(value,key){const salt=process.env.RATE_LIMIT_SALT||key;return crypto.createHmac('sha256',salt).update(String(value),'utf8').digest('hex');}
function clean(value,max){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max);}
function cleanMultiline(value,max){return String(value??'').replace(/\r\n/g,'\n').trim().slice(0,max);}
function safeDiagnostics(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return{};
  const text=(key,max=80)=>clean(input[key],max);
  return {appVersion:text('appVersion',20),browser:text('browser',80),platform:text('platform',60),viewport:text('viewport',30),screen:text('screen',30),displayMode:text('displayMode',30),theme:text('theme',20),online:input.online===true,cloudConfigured:input.cloudConfigured===true};
}
async function dbFetch(url,options={}){return fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});}
async function consumeLimit(base,key,scope,identifier,seconds,limit){
  const r=await dbFetch(`${base}/rest/v1/rpc/check_sync_rate_limit`,{method:'POST',headers:headers(key),body:JSON.stringify({p_scope:scope,p_key_hash:hashRateKey(identifier,key),p_window_seconds:seconds,p_limit:limit})});
  if(!r.ok)throw new Error(`Rate limiter unavailable (${r.status})`);const rows=await r.json();const row=Array.isArray(rows)?rows[0]:rows;return{allowed:row?.allowed===true,resetAt:row?.reset_at||null};
}
function retryAfter(resetAt){const ms=Date.parse(resetAt||'')-Date.now();return Math.max(1,Math.ceil((Number.isFinite(ms)?ms:60000)/1000));}

module.exports=async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'POST required.'});}
  if(!sameOriginOrNonBrowser(req))return json(res,403,{error:'Request origin is not allowed.'});
  if(!String(req.headers['content-type']||'').toLowerCase().includes('application/json'))return json(res,415,{error:'JSON content type required.'});
  const len=Number(req.headers['content-length']||0);if(Number.isFinite(len)&&len>MAX_REQUEST_BYTES)return json(res,413,{error:'Feedback is too large.'});
  const {base,key}=config();if(!base||!key)return json(res,503,{error:'Feedback service is temporarily unavailable.'});
  let body=req.body||{};if(typeof body==='string'){if(Buffer.byteLength(body,'utf8')>MAX_REQUEST_BYTES)return json(res,413,{error:'Feedback is too large.'});try{body=JSON.parse(body)}catch{body={}}}
  try{if(Buffer.byteLength(JSON.stringify(body),'utf8')>MAX_REQUEST_BYTES)return json(res,413,{error:'Feedback is too large.'});}catch{return json(res,400,{error:'Feedback could not be read.'});}

  // Honeypot: silently accept bot-filled submissions without storing them.
  if(clean(body.website,200))return json(res,200,{ok:true});
  const type=clean(body.type,20),area=clean(body.area,30),message=cleanMultiline(body.message,3000),steps=cleanMultiline(body.steps,2000),expected=cleanMultiline(body.expected,1500),contact=clean(body.contact,160);
  if(!TYPES.has(type)||!AREAS.has(area)||message.length<3)return json(res,400,{error:'Please complete the feedback form.'});
  if(type!=='bug'&&(steps||expected))return json(res,400,{error:'Feedback fields are invalid.'});
  const diagnostics=safeDiagnostics(body.diagnostics);
  const ip=clientIp(req);
  const hour=await consumeLimit(base,key,'feedback-ip-hour',ip,3600,6);if(!hour.allowed)return json(res,429,{error:'Too many feedback submissions. Please try again later.'},{'Retry-After':String(retryAfter(hour.resetAt))});
  const day=await consumeLimit(base,key,'feedback-ip-day',ip,86400,20);if(!day.allowed)return json(res,429,{error:'Too many feedback submissions. Please try again later.'},{'Retry-After':String(retryAfter(day.resetAt))});
  const duplicate=await consumeLimit(base,key,'feedback-duplicate',`${ip}|${type}|${area}|${message.toLowerCase()}`,3600,2);if(!duplicate.allowed)return json(res,429,{error:'This feedback was already received recently.'},{'Retry-After':String(retryAfter(duplicate.resetAt))});

  const r=await dbFetch(`${base}/rest/v1/tracker_feedback`,{method:'POST',headers:headers(key,'return=representation'),body:JSON.stringify({feedback_type:type,area,message,steps,expected,contact,diagnostics})});
  if(!r.ok)throw new Error(`Feedback storage failed (${r.status})`);const rows=await r.json();const row=Array.isArray(rows)?rows[0]:null;
  return json(res,200,{ok:true,reference:row?.id?String(row.id).slice(0,8):undefined});
};
