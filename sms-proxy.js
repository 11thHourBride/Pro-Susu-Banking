// ═══════════════════════════════════════════════════════
//  Pro Susu Banking — SMS Proxy Server
//  Run: node sms-proxy.js
//  Keeps your SMS API key off the browser entirely.
// ═══════════════════════════════════════════════════════

const http  = require('http');
const https = require('https');
const url   = require('url');
const fs    = require('fs');
const path  = require('path');

// ── Load .env file ────────────────────────────────────
// Simple .env parser — no extra packages needed
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌  .env file not found. Copy .env.example to .env and fill in your keys.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  });
}
loadEnv();

const PORT       = parseInt(process.env.PROXY_PORT || '3300', 10);
const SMS_PROV   = (process.env.SMS_PROVIDER  || 'arkesel').toLowerCase();
const API_KEY    = process.env.SMS_API_KEY    || '';
const SENDER_ID  = process.env.SMS_SENDER_ID  || 'PROSUSU';
// Hubtel only
const HUB_CLIENT = process.env.HUBTEL_CLIENT_ID     || '';
const HUB_SECRET = process.env.HUBTEL_CLIENT_SECRET || '';

if (!API_KEY && SMS_PROV !== 'hubtel') {
  console.warn('⚠️  SMS_API_KEY is empty in .env — requests will fail.');
}

// ── CORS headers helper ───────────────────────────────
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Read full request body ────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end',  ()    => resolve(body));
    req.on('error', reject);
  });
}

// ── Normalise Ghanaian number ─────────────────────────
function cleanPhone(phone) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('233')) return d;
  if (d.startsWith('0'))   return '233' + d.slice(1);
  return '233' + d;
}

// ── HTTPS POST helper ─────────────────────────────────
function httpsPost(hostname, path, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── HTTPS GET helper (mNotify uses GET) ───────────────
function httpsGet(hostname, pathWithQuery) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname, path: pathWithQuery }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
  });
}

// ── Provider: Arkesel v2 ──────────────────────────────
async function sendArkesel(recipient, message) {
  const body = JSON.stringify({
    sender     : SENDER_ID,
    message    : message,
    recipients : [cleanPhone(recipient)]
  });
  const result = await httpsPost(
    'sms.arkesel.com',
    '/api/v2/sms/send',
    { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body
  );
  const json = JSON.parse(result.body);
  if (json.status === 'success') return { ok: true };
  return { ok: false, error: json.message || json.data?.message || result.body };
}

// ── Provider: mNotify ─────────────────────────────────
async function sendMnotify(recipient, message) {
  const phone = cleanPhone(recipient);
  const qs    = `?key=${encodeURIComponent(API_KEY)}`
              + `&to=${phone}`
              + `&msg=${encodeURIComponent(message)}`
              + `&sender_id=${encodeURIComponent(SENDER_ID)}`;
  const result = await httpsGet('apps.mnotify.net', '/smsapi' + qs);
  const code   = result.body.trim();
  if (code === '1000' || code.startsWith('1000')) return { ok: true };
  return { ok: false, error: 'mNotify code: ' + code };
}

// ── Provider: Hubtel ─────────────────────────────────
async function sendHubtel(recipient, message) {
  const body = JSON.stringify({
    From               : SENDER_ID,
    To                 : cleanPhone(recipient),
    Content            : message,
    RegisteredDelivery : true
  });
  const auth = Buffer.from(`${HUB_CLIENT}:${HUB_SECRET}`).toString('base64');
  const result = await httpsPost(
    'smsc.hubtel.com',
    '/v1/messages/send',
    { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' },
    body
  );
  const json = JSON.parse(result.body);
  if (json.Status === 0 || json.status === 'success') return { ok: true };
  return { ok: false, error: json.Message || json.message || result.body };
}

// ── Main request handler ──────────────────────────────
const server = http.createServer(async (req, res) => {
  setCORS(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);

  // ── POST /send-sms ────────────────────────────────
  if (req.method === 'POST' && parsed.pathname === '/send-sms') {
    try {
      const raw     = await readBody(req);
      const payload = JSON.parse(raw);
      const phone   = payload.phone;
      const message = payload.message;

      if (!phone || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'phone and message are required' }));
        return;
      }

      console.log(`[SMS] → ${phone} via ${SMS_PROV}: ${message.slice(0, 60)}...`);

      let result;
      if      (SMS_PROV === 'mnotify') result = await sendMnotify(phone, message);
      else if (SMS_PROV === 'hubtel')  result = await sendHubtel(phone, message);
      else                             result = await sendArkesel(phone, message);

      console.log(`[SMS] ${result.ok ? '✅ sent' : '❌ failed: ' + result.error}`);

      res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

    } catch (err) {
      console.error('[SMS] Server error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // ── GET /status ───────────────────────────────────
  if (req.method === 'GET' && parsed.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status   : 'running',
      provider : SMS_PROV,
      senderId : SENDER_ID,
      port     : PORT,
      keySet   : !!API_KEY
    }));
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  📱 Pro Susu Banking — SMS Proxy Server');
  console.log('  ─────────────────────────────────────');
  console.log(`  Status  : Running`);
  console.log(`  Address : http://127.0.0.1:${PORT}`);
  console.log(`  Provider: ${SMS_PROV}`);
  console.log(`  Sender  : ${SENDER_ID}`);
  console.log(`  API Key : ${'*'.repeat(Math.min(API_KEY.length, 8))}... (hidden)`);
  console.log('');
  console.log('  Tip: Keep this terminal window open while using the app.');
  console.log('');
});