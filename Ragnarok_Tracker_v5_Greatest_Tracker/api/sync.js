const crypto = require('crypto');

const MAX_STATE_BYTES = 750_000;
const MAX_REQUEST_BYTES = 800_000;
const MAX_PROFILES = 50;
const MAX_TASKS_PER_KIND = 500;
const MAX_TOTAL_TASKS = 10_000;
const ROOM_RE = /^[a-z0-9-]{8,64}$/i;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DUMMY_SECRET_HASH = '0'.repeat(64);
const FETCH_TIMEOUT_MS = 8_000;

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}
function hashRateKey(value, key) {
  const salt = process.env.RATE_LIMIT_SALT || key;
  return crypto.createHmac('sha256', salt).update(String(value), 'utf8').digest('hex');
}
function safeEqual(a, b) {
  try {
    const aa = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch { return false; }
}
function randomSecret() {
  return crypto.randomBytes(32).toString('base64url');
}
function randomRoomId() {
  return `realm-${crypto.randomBytes(16).toString('hex')}`;
}
function json(res, status, body, extraHeaders = {}) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.status(status).json(body);
}
function config() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { base, key };
}
function headers(key, prefer) {
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  return h;
}
function clientIp(req) {
  const raw = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  return String(Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim().slice(0, 128) || 'unknown';
}
function sameOriginOrNonBrowser(req) {
  const origin = String(req.headers.origin || '');
  if (!origin) return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (!host) return false;
  if (origin === `https://${host}`) return true;
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) && origin === `http://${host}`;
}
function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function isString(v, min, max) { return typeof v === 'string' && v.length >= min && v.length <= max; }
function isIsoDate(v) { return typeof v === 'string' && v.length <= 64 && Number.isFinite(Date.parse(v)); }
function isDateKey(v) { return typeof v === 'string' && DATE_KEY_RE.test(v); }
function hasUnsafeKeys(value, depth = 0) {
  if (depth > 12) return true;
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return true;
    if (hasUnsafeKeys(value[key], depth + 1)) return true;
  }
  return false;
}
function validateTask(task) {
  if (!isObject(task)) return false;
  if (!isString(task.id, 1, 128) || !isString(task.name, 1, 80)) return false;
  if (typeof task.done !== 'boolean' || typeof task.favorite !== 'boolean') return false;
  if (!isString(task.note, 0, 500) || !isString(task.category, 1, 30)) return false;
  if (!Number.isInteger(task.priority) || task.priority < 0 || task.priority > 3) return false;
  if (!isIsoDate(task.updatedAt)) return false;
  if (task.completedAt !== null && task.completedAt !== undefined && !isIsoDate(task.completedAt)) return false;
  return true;
}
function validateProfile(profile) {
  if (!isObject(profile)) return false;
  if (!isString(profile.id, 1, 128) || !isString(profile.name, 1, 40)) return false;
  if (!isString(profile.className, 0, 40) || !isString(profile.avatar, 1, 32)) return false;
  if ('accent' in profile && !['gold','teal','violet','rose','emerald','sky'].includes(profile.accent)) return false;
  if (!isDateKey(profile.dailyDate) || !isDateKey(profile.weekDate) || !isIsoDate(profile.updatedAt)) return false;
  if (!Array.isArray(profile.daily) || !Array.isArray(profile.weekly)) return false;
  if (profile.daily.length > MAX_TASKS_PER_KIND || profile.weekly.length > MAX_TASKS_PER_KIND) return false;
  if (!profile.daily.every(validateTask) || !profile.weekly.every(validateTask)) return false;
  return true;
}
function validateSettings(settings) {
  if (!isObject(settings)) return false;
  const bools = ['hideCompleted','completedBottom','compact','uiSounds','autoplay','finishMode','finishAuto','reminders'];
  for (const key of bools) if (key in settings && typeof settings[key] !== 'boolean') return false;
  if ('theme' in settings && !['system','light','dark'].includes(settings.theme)) return false;
  if ('musicVolume' in settings && (!Number.isFinite(Number(settings.musicVolume)) || Number(settings.musicVolume) < 0 || Number(settings.musicVolume) > 100)) return false;
  if ('reminderHours' in settings && ![1,2,3,6].includes(Number(settings.reminderHours))) return false;
  if ('collapsedSections' in settings) {
    if (!isObject(settings.collapsedSections)) return false;
    for (const key of Object.keys(settings.collapsedSections)) if (!['daily','weekly'].includes(key) || typeof settings.collapsedSections[key] !== 'boolean') return false;
  }
  if ('collapsedCategories' in settings) {
    if (!isObject(settings.collapsedCategories)) return false;
    for (const kind of ['daily','weekly']) {
      const group = settings.collapsedCategories[kind];
      if (group === undefined) continue;
      if (!isObject(group) || Object.keys(group).length > 80) return false;
      for (const [name, value] of Object.entries(group)) if (!isString(name, 1, 30) || typeof value !== 'boolean') return false;
    }
  }
  return Buffer.byteLength(JSON.stringify(settings), 'utf8') <= 50_000;
}
function validateHistory(history) {
  if (!isObject(history) || Object.keys(history).length > MAX_PROFILES + 20) return false;
  for (const [profileId, buckets] of Object.entries(history)) {
    if (!isString(profileId, 1, 128) || !isObject(buckets)) return false;
    for (const [kind, limit] of [['daily',140],['weekly',80]]) {
      const bucket = buckets[kind];
      if (bucket === undefined) continue;
      if (!isObject(bucket) || Object.keys(bucket).length > limit) return false;
      for (const [dateKey, row] of Object.entries(bucket)) {
        if (!isDateKey(dateKey) || !isObject(row)) return false;
        if (!Number.isInteger(row.done) || !Number.isInteger(row.total) || row.done < 0 || row.total < 0 || row.done > row.total || row.total > MAX_TASKS_PER_KIND) return false;
        if (typeof row.complete !== 'boolean' || !isIsoDate(row.updatedAt)) return false;
      }
    }
  }
  return true;
}
function validateState(state) {
  if (!isObject(state) || hasUnsafeKeys(state)) return 'Tracker state is invalid.';
  let encoded;
  try { encoded = JSON.stringify(state); } catch { return 'Tracker state is invalid.'; }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_STATE_BYTES) return 'Tracker state is too large to sync.';
  if (state.version !== 5) return 'Unsupported tracker state version.';
  if (!Array.isArray(state.profiles) || state.profiles.length < 1 || state.profiles.length > MAX_PROFILES) return 'Tracker profiles are invalid.';
  if (!state.profiles.every(validateProfile)) return 'Tracker profile data is invalid.';
  const profileIds = new Set(state.profiles.map(p => p.id));
  if (profileIds.size !== state.profiles.length) return 'Tracker profile IDs are invalid.';
  const totalTasks = state.profiles.reduce((n, p) => n + p.daily.length + p.weekly.length, 0);
  if (totalTasks > MAX_TOTAL_TASKS) return 'Tracker contains too many tasks.';
  if (!isString(state.activeProfileId, 1, 128) || !profileIds.has(state.activeProfileId)) return 'Active profile is invalid.';
  if (!Array.isArray(state.categories) || state.categories.length < 1 || state.categories.length > 40 || !state.categories.every(x => isString(x, 1, 30))) return 'Tracker categories are invalid.';
  if (!validateSettings(state.settings)) return 'Tracker settings are invalid.';
  if (!validateHistory(state.history || {})) return 'Tracker history is invalid.';
  if (!isObject(state.meta) || !isIsoDate(state.meta.updatedAt) || !isIsoDate(state.meta.createdAt) || !isString(String(state.meta.appVersion || ''), 1, 20)) return 'Tracker metadata is invalid.';
  return null;
}
async function dbFetch(url, options = {}) {
  return fetch(url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}
async function fetchRow(base, key, roomId) {
  const url = `${base}/rest/v1/tracker_states?room_id=eq.${encodeURIComponent(roomId)}&select=room_id,secret_hash,payload,revision,updated_at`;
  const r = await dbFetch(url, { headers: headers(key) });
  if (!r.ok) throw new Error(`Database read failed (${r.status})`);
  const rows = await r.json();
  return rows[0] || null;
}
async function consumeRateLimit(base, key, scope, identifier, windowSeconds, limit) {
  const r = await dbFetch(`${base}/rest/v1/rpc/check_sync_rate_limit`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({
      p_scope: scope,
      p_key_hash: hashRateKey(identifier, key),
      p_window_seconds: windowSeconds,
      p_limit: limit
    })
  });
  if (!r.ok) throw new Error(`Rate limiter unavailable (${r.status})`);
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return {
    allowed: row?.allowed === true,
    remaining: Math.max(0, Number(row?.remaining) || 0),
    resetAt: row?.reset_at || null
  };
}
function retryAfterSeconds(resetAt) {
  const ms = Date.parse(resetAt || '') - Date.now();
  return Math.max(1, Math.ceil((Number.isFinite(ms) ? ms : 60_000) / 1000));
}
async function enforceLimit(res, base, key, scope, identifier, windowSeconds, limit) {
  const result = await consumeRateLimit(base, key, scope, identifier, windowSeconds, limit);
  if (result.allowed) return true;
  const retry = retryAfterSeconds(result.resetAt);
  json(res, 429, { error: 'Too many requests. Please try again later.' }, { 'Retry-After': String(retry) });
  return false;
}
async function authenticate(base, key, roomId, secret, ip, res) {
  const row = await fetchRow(base, key, roomId);
  const incoming = hashSecret(secret);
  const stored = row?.secret_hash || DUMMY_SECRET_HASH;
  const valid = !!row && safeEqual(stored, incoming);
  if (!valid) {
    const failed = await consumeRateLimit(base, key, 'auth-failure-ip', ip, 900, 20);
    if (!failed.allowed) {
      const retry = retryAfterSeconds(failed.resetAt);
      json(res, 429, { error: 'Too many authentication attempts. Please try again later.' }, { 'Retry-After': String(retry) });
    } else {
      json(res, 401, { error: 'Cloud pairing authentication failed.' });
    }
    return null;
  }
  return row;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'POST required.' });
  }
  if (!sameOriginOrNonBrowser(req)) return json(res, 403, { error: 'Request origin is not allowed.' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return json(res, 415, { error: 'JSON content type required.' });
  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return json(res, 413, { error: 'Request is too large.' });

  const { base, key } = config();
  if (!base || !key) return json(res, 503, { error: 'Cloud sync is not configured yet.' });

  let body = req.body || {};
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) return json(res, 413, { error: 'Request is too large.' });
    try { body = JSON.parse(body); } catch { body = {}; }
  } else {
    try { if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_REQUEST_BYTES) return json(res, 413, { error: 'Request is too large.' }); } catch { body = {}; }
  }
  if (!isObject(body) || hasUnsafeKeys(body)) body = {};
  const action = String(body.action || '');
  if (!['create', 'pull', 'push', 'rotate', 'revoke'].includes(action)) return json(res, 400, { error: 'Invalid sync action.' });

  const ip = clientIp(req);
  try {
    if (!await enforceLimit(res, base, key, 'request-ip-minute', ip, 60, 180)) return;

    if (action === 'create') {
      if (!await enforceLimit(res, base, key, 'create-ip-hour', ip, 3600, 5)) return;
      if (!await enforceLimit(res, base, key, 'create-ip-day', ip, 86400, 20)) return;
      const stateError = validateState(body.state);
      if (stateError) return json(res, stateError.includes('too large') ? 413 : 400, { error: stateError });

      for (let attempt = 0; attempt < 3; attempt++) {
        const roomId = randomRoomId();
        const secret = randomSecret();
        const insertUrl = `${base}/rest/v1/tracker_states`;
        const r = await dbFetch(insertUrl, {
          method: 'POST', headers: headers(key, 'return=representation'),
          body: JSON.stringify({ room_id: roomId, secret_hash: hashSecret(secret), payload: body.state, revision: 1 })
        });
        if (r.ok) {
          const rows = await r.json();
          const created = rows[0] || {};
          return json(res, 200, { ok: true, roomId, secret, revision: Number(created.revision) || 1, updatedAt: created.updated_at });
        }
        if (r.status !== 409) throw new Error(`Database insert failed (${r.status})`);
      }
      throw new Error('Could not allocate unique room ID');
    }

    const roomId = String(body.roomId || '');
    const secret = String(body.secret || '');
    if (!ROOM_RE.test(roomId) || !SECRET_RE.test(secret)) return json(res, 400, { error: 'Invalid cloud pairing credentials.' });
    if (!await enforceLimit(res, base, key, 'room-ip-minute', `${ip}|${roomId}`, 60, 60)) return;
    if (!await enforceLimit(res, base, key, 'room-minute', roomId, 60, 120)) return;

    const row = await authenticate(base, key, roomId, secret, ip, res);
    if (!row) return;

    if (action === 'pull') {
      return json(res, 200, { ok: true, state: row.payload, revision: Number(row.revision) || 0, updatedAt: row.updated_at });
    }

    if (action === 'rotate') {
      if (!await enforceLimit(res, base, key, 'rotate-room-hour', roomId, 3600, 6)) return;
      const newSecret = randomSecret();
      const r = await dbFetch(`${base}/rest/v1/tracker_states?room_id=eq.${encodeURIComponent(roomId)}&revision=eq.${Number(row.revision) || 0}`, {
        method: 'PATCH', headers: headers(key, 'return=representation'),
        body: JSON.stringify({ secret_hash: hashSecret(newSecret), updated_at: new Date().toISOString() })
      });
      if (!r.ok) throw new Error(`Database credential rotation failed (${r.status})`);
      const rows = await r.json();
      if (!rows.length) return json(res, 409, { error: 'Cloud state changed. Sync and try again.' });
      return json(res, 200, { ok: true, secret: newSecret, revision: Number(rows[0].revision) || Number(row.revision) || 0, updatedAt: rows[0].updated_at });
    }

    if (action === 'revoke') {
      if (!await enforceLimit(res, base, key, 'revoke-room-hour', roomId, 3600, 6)) return;
      const r = await dbFetch(`${base}/rest/v1/tracker_states?room_id=eq.${encodeURIComponent(roomId)}`, {
        method: 'DELETE', headers: headers(key, 'return=minimal')
      });
      if (!r.ok) throw new Error(`Database revoke failed (${r.status})`);
      return json(res, 200, { ok: true, revoked: true });
    }

    const stateError = validateState(body.state);
    if (stateError) return json(res, stateError.includes('too large') ? 413 : 400, { error: stateError });

    const currentRevision = Number(row.revision) || 0;
    const requestedRevision = body.baseRevision;
    if (requestedRevision !== undefined && Number(requestedRevision) !== currentRevision) {
      return json(res, 409, { error: 'Cloud state changed on another device.', state: row.payload, revision: currentRevision, updatedAt: row.updated_at });
    }

    const nextRevision = currentRevision + 1;
    const updateUrl = `${base}/rest/v1/tracker_states?room_id=eq.${encodeURIComponent(roomId)}&revision=eq.${currentRevision}`;
    const r = await dbFetch(updateUrl, {
      method: 'PATCH', headers: headers(key, 'return=representation'),
      body: JSON.stringify({ payload: body.state, revision: nextRevision, updated_at: new Date().toISOString() })
    });
    if (!r.ok) throw new Error(`Database update failed (${r.status})`);
    const rows = await r.json();
    if (!rows.length) {
      const latest = await fetchRow(base, key, roomId);
      if (!latest) return json(res, 401, { error: 'Cloud pairing authentication failed.' });
      return json(res, 409, { error: 'Cloud state changed on another device.', state: latest.payload, revision: Number(latest.revision) || currentRevision, updatedAt: latest.updated_at });
    }
    return json(res, 200, { ok: true, revision: Number(rows[0].revision) || nextRevision, updatedAt: rows[0].updated_at });
  } catch (error) {
    console.error('cloud-sync', { message: error?.message, action, at: new Date().toISOString() });
    return json(res, 503, { error: 'Cloud sync is temporarily unavailable.' });
  }
};
