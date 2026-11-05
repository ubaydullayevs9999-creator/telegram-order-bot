// Real ishga tushirilgan botni tekshiradi: index.js ni alohida jarayon sifatida
// ochamiz, soxta Telegram API'ga ulaymiz va haqiqiy HTTP so'rovlar yuboramiz.
// Ishga tushirish:  node tools/smoke.js
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 8124;          // soxta Telegram API
const APP = 8125;           // index.js ochadigan mini-ilova
const TOKEN = '999999:SMOKE-TOKEN-abcdefghijklmnopqrst';
const ADMIN = '777001';
const BUYER = '4242';
const APP_URL = 'https://demo.onrender.com/app';

const calls = [];           // method:chat_id
const sent = [];            // to'liq parametrlar
const queue = [];           // getUpdates navbati
let drained = 0;            // ishga tushishda o'qilgan (va tashlab yuborilgan) update
const results = [];
function check(name, ok, detail) {
  results.push({ name, pass: !!ok, detail: ok ? '' : String(detail === undefined ? '' : detail).slice(0, 200) });
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const method = req.url.split('/').pop();
    if (req.url.indexOf('/bot' + TOKEN + '/') !== 0) {
      res.writeHead(404);
      return res.end('bad path — token yo\'lga qo\'ymaydi');
    }
    if (method === 'getUpdates') {
      let gp = {};
      try { gp = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { gp = {}; }
      calls.push('getUpdates:timeout=' + gp.timeout);
      const batch = queue.splice(0, queue.length);
      if (gp.timeout === 0) drained += batch.length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, result: batch }));
    }
    let p = {};
    try { p = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { p = { multipart: true }; }
    calls.push(method + ':' + p.chat_id);
    sent.push({ method, params: p });
    const result = method === 'getMe'
      ? { id: 9, username: 'smoke_bot', first_name: 'Smoke' }
      : { message_id: 9000 + sent.length, chat: { id: p.chat_id }, text: p.text || '' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
  });
});

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-smoke-'));
// Botgacha yetib bormagan ESKI xabar: qayta ishga tushganda takror javob
// yubormasligi kerak (drain).
queue.push({ update_id: 5, message: {
  message_id: 55, chat: { id: 9999, type: 'private' }, from: { id: 9999, is_bot: false }, date: 1, text: '/start' } });
const child = spawn(path.join(__dirname, '..', '..', 'runtime', 'node-v24.22.2-win-x64', 'node.exe'),
  [path.join(__dirname, '..', 'index.js')], {
    env: Object.assign({}, process.env, {
      TELEGRAM_API_BASE: 'http://127.0.0.1:' + PORT,
      BOT_TOKEN: TOKEN,
      ADMIN_CHAT_ID: ADMIN,
      WEB_APP_URL: APP_URL,
      DATA_DIR: DATA,
      ENV_FILE: path.join(os.tmpdir(), 'smoke-yoq.env'),
      PORT: String(APP),
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { out += d; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function pushText(chatId, text) {
  queue.push({ update_id: 100 + queue.length, message: {
    message_id: 700 + queue.length,
    chat: { id: Number(chatId), type: 'private' },
    from: { id: Number(chatId), is_bot: false, first_name: 'Test' },
    date: 1, text,
  } });
}
async function toBot(text) {
  const before = sent.length;
  pushText(BUYER, text);
  const t = Date.now();
  while (Date.now() - t < 10000 && sent.length === before) await wait(150);
  await wait(250);
  return sent.slice(before);
}

(async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  let t0 = Date.now();
  while (Date.now() - t0 < 20000 && !out.includes('polling boshlandi')) await wait(200);
  check('index.js polling boshladi', out.includes('polling boshlandi'), out.slice(-200));
  check('getMe orqali bot nomi chiqdi', out.includes('@smoke_bot'));
  check('Token log\'da maskalangan, to\'liq yo\'q', /token: 99999/.test(out) && !out.includes(TOKEN));
  check('Mini-ilova URL log\'da ko\'rsatildi', out.includes(APP_URL), out.slice(-300));

  const health = await fetch('http://127.0.0.1:' + APP + '/').then((r) => r.text()).catch((e) => 'ERR ' + e.message);
  check('Health endpoint (hosting uchun) javob berdi', health.includes('order-bot'), health.slice(0, 80));
  check('getUpdates chaqirildi', calls.some((c) => c.indexOf('getUpdates') === 0));
  check('Ishga tushishda eski navbat o\'qildi (timeout: 0)',
    calls.includes('getUpdates:timeout=0') && drained === 1, calls.join(',') + ' | drained=' + drained);
  check('Eski xabarga takror javob yuborilmadi',
    !sent.some((s) => String(s.params.chat_id) === '9999'), JSON.stringify(sent.map((s) => s.params.chat_id)));
  check('Long-polling so\'rovi 25 soniyalik', calls.includes('getUpdates:timeout=25'), calls.join(','));

  // /start — bitta salom + ilova tugmasi
  let r = await toBot('/start');
  check('/start — bitta xabar', r.length === 1, r.length + ' ta: ' + r.map((x) => x.method).join(','));
  check('/start — salom matni bor', r[0] && /Hush kelibsiz/.test(r[0].params.text), r[0] && r[0].params.text.slice(0, 60));
  const kb = r[0] && r[0].params.reply_markup ? JSON.parse(JSON.stringify(r[0].params.reply_markup)) : null;
  check('/start — web_app tugmasi (HTTPS)',
    !!(kb && kb.inline_keyboard[0][0].web_app && kb.inline_keyboard[0][0].web_app.url === APP_URL),
    JSON.stringify(kb || {}).slice(0, 120));
  check('Tugmada eski callback menyusi yo\'q',
    !JSON.stringify(kb || {}).includes('callback_data'));

  // Bot suhbat qilmaydi: istalgan yozuv shu salomni qaytaradi
  r = await toBot('salom, qanaqa kiyimlar bormi');
  check('Oddiy yozuv → faqat salom (suhbat yo\'q)', r.length === 1 && /Hush kelibsiz/.test(r[0].params.text),
    r.length + ' ta xabar');
  r = await toBot('/orders');
  check('/orders ham suhbat qilmaydi', r.length === 1 && !JSON.stringify(r[0].params).includes('ro\'yxat'), r.length + '');

  // Ilova sahifasi + buyurtma haqiqiy jarayon orqali
  const page = await fetch('http://127.0.0.1:' + APP + '/app');
  const html = await page.text();
  check('/app — 200 HTML', page.status === 200 && page.headers.get('content-type').includes('text/html'), page.status);
  check('/app — kirish ekrani (ism + telefon)', html.includes('id="gate"') && html.includes('id="gPhone"'));

  const before = sent.length;
  const ord = await fetch('http://127.0.0.1:' + APP + '/api/order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sardor', phone: '901234567', address: '', lang: 'uz',
      items: [{ id: 'p1', qty: 1 }, { id: 'p5', qty: 1 }], telegram: { id: Number(BUYER) } }),
  });
  const oj = await ord.json().catch(() => null);
  check('POST /api/order — 200', ord.status === 200 && oj && oj.ok, ord.status + ' ' + JSON.stringify(oj));
  check('Yekun summa serverda: 85 000 + 320 000', oj && oj.total === 405000, oj && oj.total);
  await wait(400);
  const n = sent.slice(before).filter((s) => s.method === 'sendMessage' && String(s.params.chat_id) === ADMIN);
  check('Sotuvchiga 1 ta bildirishnoma ketdi', n.length === 1, sent.slice(before).map((s) => s.method + ':' + s.params.chat_id).join(','));
  check('Bildirishnomada tugmalar YO\'Q', n.length === 1 && !n[0].params.reply_markup,
    JSON.stringify(n[0] && n[0].params.reply_markup));
  check('Bildirishnomada ism, telefon, summa',
    n.length === 1 && ['Sardor', '+998901234567', '405 000'].every((x) => n[0].params.text.includes(x)),
    n.length ? n[0].params.text.replace(/\n/g, ' | ').slice(0, 140) : '');
  const db = fs.readFileSync(path.join(DATA, 'orders.json'), 'utf8');
  check('Buyurtma diskdagi orders.json ga tushdi', db.includes('Sardor') && db.includes('405000'), db.slice(0, 120));
  check('Begonaga xabar ketmadi',
    !sent.slice(before).some((s) => String(s.params.chat_id) === BUYER));
  check('Token hech bir so\'rovga kirmadi', !JSON.stringify(sent).includes(TOKEN));

  child.kill();
  server.close();
  let failed = 0;
  for (const x of results) {
    if (!x.pass) failed++;
    console.log((x.pass ? 'OK   ' : 'FAIL ') + x.name + (x.detail ? '  <<  ' + x.detail : ''));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' smoke (real jarayon) tekshiruvi o\'tdi');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log('SMOKE CRASH: ' + (e && e.stack || e));
  try { child.kill(); server.close(); } catch (_) {}
  process.exit(2);
});
