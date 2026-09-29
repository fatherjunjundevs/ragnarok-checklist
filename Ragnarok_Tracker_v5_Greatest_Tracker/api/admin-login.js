
const crypto=require('crypto');
const ACCESS_COOKIE='rtnw_admin_access',REFRESH_COOKIE='rtnw_admin_refresh',FETCH_TIMEOUT_MS=8000;
function cfg(){return{base:String(process.env.SUPABASE_URL||'').replace(/\/$/,''),publishKey:String(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||''),serviceKey:String(process.env.SUPABASE_SERVICE_ROLE_KEY||''),adminEmail:String(process.env.ADMIN_EMAIL||'').trim().toLowerCase()}}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Pragma','no-cache');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
function cookies(req){const out={};String(req.headers.cookie||'').split(';').forEach(part=>{const i=part.indexOf('=');if(i<0)return;const k=part.slice(0,i).trim(),raw=part.slice(i+1).trim();try{out[k]=decodeURIComponent(raw)}catch{out[k]=raw}});return out}
function cookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0,Math.floor(maxAge))}`}
function setSession(res,data){res.setHeader('Set-Cookie',[cookie(ACCESS_COOKIE,data.access_token||'',Math.max(60,Math.min(Number(data.expires_in)||3600,3600))),cookie(REFRESH_COOKIE,data.refresh_token||'',60*60*24*30)])}
function clearSession(res){res.setHeader('Set-Cookie',[cookie(ACCESS_COOKIE,'',0),cookie(REFRESH_COOKIE,'',0)])}
function sameOrigin(req){const origin=String(req.headers.origin||'');if(!origin)return true;const host=String(req.headers['x-forwarded-host']||req.headers.host||'');if(!host)return false;if(origin===`https://${host}`)return true;return /^(localhost|127\\.0\\.0\\.1)(:\\d+)?$/i.test(host)&&origin===`http://${host}`}
function ip(req){const raw=req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.headers['x-real-ip']||'unknown';return String(Array.isArray(raw)?raw[0]:raw).split(',')[0].trim().slice(0,128)||'unknown'}
function hash(v,key){return crypto.createHmac('sha256',process.env.RATE_LIMIT_SALT||key).update(String(v),'utf8').digest('hex')}
async function f(url,options={}){return fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)})}
async function limit(req,scope,seconds,count){const{base,serviceKey}=cfg();if(!base||!serviceKey)return{allowed:false};const r=await f(`${base}/rest/v1/rpc/check_sync_rate_limit`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({p_scope:scope,p_key_hash:hash(ip(req),serviceKey),p_window_seconds:seconds,p_limit:count})});if(!r.ok)return{allowed:false};const rows=await r.json(),row=Array.isArray(rows)?rows[0]:rows;return{allowed:row?.allowed===true}}
async function user(base,publishKey,token){if(!token)return null;const r=await f(`${base}/auth/v1/user`,{headers:{apikey:publishKey,Authorization:`Bearer ${token}`}});return r.ok?r.json():null}
async function refresh(base,publishKey,token){if(!token)return null;const r=await f(`${base}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:publishKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:token})});return r.ok?r.json():null}
async function requireAdmin(req,res){const{base,publishKey,adminEmail}=cfg();if(!base||!publishKey||!adminEmail)return{error:'Admin authentication is not configured.',status:503};const c=cookies(req);let u=await user(base,publishKey,c[ACCESS_COOKIE]||'');if(!u&&c[REFRESH_COOKIE]){const s=await refresh(base,publishKey,c[REFRESH_COOKIE]);if(s?.access_token){setSession(res,s);u=s.user||await user(base,publishKey,s.access_token)}}if(!u||String(u.email||'').trim().toLowerCase()!==adminEmail){clearSession(res);return{error:'Admin sign-in required.',status:401}}return{user:u}}

module.exports=async function handler(req,res){
if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'POST required.'})}
if(!sameOrigin(req))return json(res,403,{error:'Request origin is not allowed.'});
if(!String(req.headers['content-type']||'').toLowerCase().includes('application/json'))return json(res,415,{error:'JSON content type required.'});
const{base,publishKey,adminEmail}=cfg();if(!base||!publishKey||!adminEmail)return json(res,503,{error:'Admin authentication is not configured yet.'});
const lim=await limit(req,'admin-login-ip',900,8);if(!lim.allowed)return json(res,429,{error:'Too many sign-in attempts. Please try again later.'});
let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={}}}const password=String(body.password||'');if(password.length<8||password.length>256)return json(res,401,{error:'Invalid admin credentials.'});
const r=await f(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:publishKey,'Content-Type':'application/json'},body:JSON.stringify({email:adminEmail,password})});
if(!r.ok)return json(res,401,{error:'Invalid admin credentials.'});const s=await r.json();if(!s.access_token||!s.refresh_token||String(s.user?.email||'').trim().toLowerCase()!==adminEmail)return json(res,401,{error:'Invalid admin credentials.'});
setSession(res,s);return json(res,200,{ok:true});
};
