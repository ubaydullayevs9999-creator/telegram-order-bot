// Hosting rejimini tekshiradi: web-server.js alohida jarayon sifatida ochiladi,
// soxta Telegram API'ga ulanadi, polling QILMASLIGI va buyurtma yuborishi
// isbotlanadi. Ishga tushirish:  node tools/hosting-test.js
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TG_PORT = 8126;
const APP_PORT = 8127;
const TOKEN = '999999:HOSTING-TOKEN-abcdefghijklmnopqrs';
const ADMIN = '777002';
const BUYER = '4243';

const calls = [];
const sent = [];
const results = [];
function check(name, ok, detail) {
  results.push({ name, pass: !!ok, detail: ok ? '' : String(detail === undefined ? '' : detail).slice(0, 220) });
}

const fakeTg = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const method = req.url.split('/').pop();
    if (req.url.indexOf('/bot' + TOKEN + '/') !== 0) {
      calls.push('BADPATH:' + method);
      res.writeHead(404); return res.end('bad path');
    }
    let p = {};
    try { p = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { p = {}; }
    calls.push(method + ':' + p.chat_id);
    sent.push({ method, params: p });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result: method === 'getMe'
      ? { id: 9, username: 'hosting_bot', first_name: 'Hosting' }
      : { message_id: 1, chat: { id: p.chat_id }, text: p.text || '' } }));
  });
});

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-host-'));
const NODE = path.join(__dirname, '..', '..', 'runtime', 'node-v24.22.2-win-x64', 'node.exe');
const child = spawn(NODE, [path.join(__dirname, '..', 'web-server.js')], {
  env: Object.assign({}, process.env, {
    TELEGRAM_API_BASE: 'http://127.0.0.1:' + TG_PORT,
    BOT_TOKEN: TOKEN,
    ADMIN_CHAT_ID: ADMIN,
    DATA_DIR: DATA,
    ENV_FILE: path.join(os.tmpdir(), 'hosting-yoq.env'),
    PORT: String(APP_PORT),
  }),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { out += d; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const U = (p) => 'http://127.0.0.1:' + APP_PORT + p;
async function GET(p) {
  const res = await fetch(U(p)).catch((e) => null);
  if (!res) return { status: 0, text: '', type: '' };
  return { status: res.status, text: await res.text(), type: res.headers.get('content-type') || '' };
}
async function POST(p, body) {
  const res = await fetch(U(p), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .catch(() => null);
  if (!res) return { status: 0, json: null, text: '' };
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json, text };
}

(async () => {
  await new Promise((r) => fakeTg.listen(TG_PORT, '127.0.0.1', r));

  let t0 = Date.now();
  while (Date.now() - t0 < 20000 && !out.includes('hosting rejimi')) await wait(200);
  check('web-server.js ishga tushdi (hosting rejimi)', out.includes('hosting rejimi'), out.slice(-250));
  check('Port muhitdan olindi (PORT=' + APP_PORT + ')', out.includes('port ' + APP_PORT), out.slice(-200));
  check('Token log\'da maskalangan, to\'liq yozilmagan',
    /token: 99999/.test(out) && !out.includes(TOKEN), out.slice(-120));
  check('Sotuvchi ID log\'da', out.includes(ADMIN));

  await wait(1200);
  check('POLLING YO\'Q — getUpdates chaqirilmadi', !calls.some((c) => c.indexOf('getUpdates') === 0), calls.join(','));
  check('getMe ham chaqirilmadi (web rejimda kerak emas)', !calls.some((c) => c.indexOf('getMe') === 0), calls.join(','));

  const health = await GET('/');
  check('GET / — health check 200', health.status === 200 && health.text.includes('order-bot'), health.status + ' ' + health.text.slice(0, 40));
  const healthz = await GET('/healthz');
  check('GET /healthz — 200 (Render varianti)', healthz.status === 200, healthz.status);

  const page = await GET('/app');
  check('GET /app — 200 HTML', page.status === 200 && page.type.includes('text/html'), page.status + ' ' + page.type);
  check('/app — kirish ekrani bor', page.text.includes('id="gate"') && page.text.includes('id="gPhone"'));
  check('/app — Telegram WebApp SDK ulangan', page.text.includes('telegram-web-app.js'));

  const cat = await GET('/api/catalog');
  let cj = null; try { cj = JSON.parse(cat.text); } catch (e) {}
  check('GET /api/catalog — 6 ta kiyim', cj && cj.products.length === 6, cj && cj.products.length);
  check('Katalogda faqat kiyim-kuchak (telefon/goldiq yo\'q)',
    cj && JSON.stringify(cj.products.map((p) => p.uz.name)) ===
      JSON.stringify(['Futbolka (pamuk)', 'Jinsi shim', 'Kofta (sviter)', 'Paypoq (3 juft)', 'Kurtka', 'Xudli (hoodie)']),
    cj && cj.products.map((p) => p.uz.name).join(', '));
  check('Narxlar so\'mda, 2 tilda', cj && cj.currency === "so'm" && cj.products.every((p) => p.uz.name && p.ru.name && p.price > 0));

  const img = await GET('/img/tshirt.jpg');
  check('GET /img/tshirt.jpg — 200 image/jpeg', img.status === 200 && img.type === 'image/jpeg', img.status + ' ' + img.type);
  const trav = await GET('/img/..%2F..%2F.env');
  check('Path traversal (/img/../../.env) rad etildi', trav.status === 404 || !trav.text.includes('BOT_TOKEN'), trav.status + ' ' + trav.text.slice(0, 50));
  const nf = await GET('/api/nope');
  check('Noma\'lum yo\'l → 404', nf.status === 404, nf.status);

  // --- buyurtma: hosting rejimida ham sotuvchiga yetib boradi ---
  sent.length = 0;
  const ord = await POST('/api/order', {
    name: 'Malika', phone: '90 123 45 67', address: 'Chilonzor 12', lang: 'uz',
    items: [{ id: 'p1', qty: 2 }, { id: 'p6', qty: 1 }], telegram: { id: Number(BUYER) },
  });
  check('POST /api/order — 200 + buyurtma raqami', ord.status === 200 && ord.json && ord.json.ok && /^B-\d{4}$/.test(ord.json.id),
    ord.status + ' ' + ord.text.slice(0, 90));
  check('Summa serverda qayta hisoblandi (85 000 x2 + 180 000)', ord.json && ord.json.total === 350000, ord.json && ord.json.total);
  await wait(500);
  const note = sent.filter((s) => s.method === 'sendMessage' && String(s.params.chat_id) === ADMIN);
  check('Sotuvchiga Telegram bildirishnoma ketdi', note.length === 1 && note[0].params.text.includes('Malika'),
    note.length ? note[0].params.text.replace(/\n/g, ' | ').slice(0, 150) : 'xabar yo\'q');
  check('Bildirishnomada tugmalar yo\'q', note.length === 1 && !note[0].params.reply_markup);
  check('Mijozga qo\'shimcha xabar ketmadi',
    !sent.some((s) => String(s.params.chat_id) === BUYER), sent.map((s) => s.params.chat_id).join(','));
  const db = fs.readFileSync(path.join(DATA, 'orders.json'), 'utf8');
  check('Buyurtma DATA_DIR/orders.json ga yozildi', db.includes('Malika') && db.includes('350000'), db.slice(0, 100));
  check('Token hech bir so\'rovda yo\'q', !JSON.stringify(sent).includes(TOKEN));

  // --- xavfsizlik: tez-tez urinish to\'xtatiladi ---
  let blocked = false;
  for (let i = 0; i < 24; i++) {
    const r = await POST('/api/order', { name: 'X', phone: '901234567', address: '', lang: 'uz', items: [{ id: 'p1', qty: 1 }] });
    if (r.status === 429) { blocked = true; break; }
  }
  check('20 so\'rov/daqiga chegaralandi (429)', blocked);

  child.kill();
  fakeTg.close();
  let failed = 0;
  for (const x of results) {
    if (!x.pass) failed++;
    console.log((x.pass ? 'OK   ' : 'FAIL ') + x.name + (x.detail ? '  <<  ' + x.detail : ''));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' hosting tekshiruvi o\'tdi');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log('HOSTING TEST CRASH: ' + (e && e.stack || e));
  try { child.kill(); fakeTg.close(); } catch (_) {}
  process.exit(2);
});
