const crypto = require('crypto');

const MAX_STATE_BYTES = 750_000;
const ROOM_RE = /^[a-z0-9-]{8,64}$/i;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}
function safeEqual(a, b) {
  try {
    const aa = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch { return false; }
}
function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
async function fetchRow(base, key, roomId) {
  const url = `${base}/rest/v1/tracker_states?room_id=eq.${encodeURIComponent(roomId)}&select=room_id,secret_hash,payload,revision,updated_at`;
  const r = await fetch(url, { headers: headers(key), cache: 'no-store' });
  if (!r.ok) throw new Error(`Database read failed (${r.status})`);
  const rows = await r.json();
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required.' });
  const { base, key } = config();
  if (!base || !key) return json(res, 503, { error: 'Cloud sync is not configured yet.' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  const action = body.action;
  const roomId = String(body.roomId || '');
  const secret = String(body.secret || '');
  if (!ROOM_RE.test(roomId) || !SECRET_RE.test(secret)) return json(res, 400, { error: 'Invalid cloud pairing credentials.' });
  if (!['pull', 'push'].includes(action)) return json(res, 400, { error: 'Invalid sync action.' });

  try {
    const secretHash = hashSecret(secret);
    let row = await fetchRow(base, key, roomId);

    if (action === 'pull') {
      if (!row) return json(res, 404, { error: 'Cloud pairing not found.' });
      if (!safeEqual(row.secret_hash, secretHash)) return json(res, 403, { error: 'Incorrect cloud pairing code.' });
      return json(res, 200, { ok: true, state: row.payload, revision: Number(row.revision) || 0, updatedAt: row.updated_at });
    }

    const state = body.state;
    if (!state || typeof state !== 'object' || Array.isArray(state)) return json(res, 400, { error: 'Tracker state is required.' });
    const size = Buffer.byteLength(JSON.stringify(state), 'utf8');
    if (size > MAX_STATE_BYTES) return json(res, 413, { error: 'Tracker state is too large to sync.' });

    if (!row) {
      const insertUrl = `${base}/rest/v1/tracker_states`;
      const r = await fetch(insertUrl, {
        method: 'POST', headers: headers(key, 'return=representation'),
        body: JSON.stringify({ room_id: roomId, secret_hash: secretHash, payload: state, revision: 1 })
      });
      if (!r.ok) {
        // Another request may have created the room between read and insert.
        row = await fetchRow(base, key, roomId);
        if (!row) throw new Error(`Database insert failed (${r.status})`);
      } else {
        const rows = await r.json(); const created = rows[0];
        return json(res, 200, { ok: true, revision: Number(created?.revision) || 1, updatedAt: created?.updated_at });
      }
    }

    if (!safeEqual(row.secret_hash, secretHash)) return json(res, 403, { error: 'Incorrect cloud pairing code.' });
    const currentRevision = Number(row.revision) || 0;
    const requestedRevision = body.baseRevision;
    if (requestedRevision !== undefined && Number(requestedRevision) !== currentRevision) {
      return json(res, 409, { error: 'Cloud state changed on another device.', state: row.payload, revision: currentRevision, updatedAt: row.updated_at });
    }

    const nextRevision = currentRevision + 1;
    const updateUrl = `${base}/rest/v1/tracker_states?room_id=eq.${encodeURIComponent(roomId)}&revision=eq.${currentRevision}`;
    const r = await fetch(updateUrl, {
      method: 'PATCH', headers: headers(key, 'return=representation'),
      body: JSON.stringify({ payload: state, revision: nextRevision, updated_at: new Date().toISOString() })
    });
    if (!r.ok) throw new Error(`Database update failed (${r.status})`);
    const rows = await r.json();
    if (!rows.length) {
      row = await fetchRow(base, key, roomId);
      return json(res, 409, { error: 'Cloud state changed on another device.', state: row?.payload, revision: Number(row?.revision)||currentRevision, updatedAt: row?.updated_at });
    }
    return json(res, 200, { ok: true, revision: Number(rows[0].revision) || nextRevision, updatedAt: rows[0].updated_at });
  } catch (error) {
    console.error('cloud-sync', error);
    return json(res, 500, { error: 'Cloud sync is temporarily unavailable.' });
  }
};
