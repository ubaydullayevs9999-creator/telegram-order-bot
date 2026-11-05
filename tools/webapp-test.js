// Mini-ilova (WebApp) testi: haqiqiy server + soxta Telegram API.
// Ishga tushirish:  node tools/webapp-test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const TOKEN = '123456:AAtesttoken-for-webapp-0000000';
const ADMIN = '777001';
const BUYER = '555002';
const FAKE_TG_PORT = 8124;   // soxta Telegram API
const APP_PORT = 10099;       // mini-ilova serveri

const results = [];
function check(name, ok, detail) {
  results.push({ name, pass: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 160) });
}

// --- soxta Telegram API -----------------------------------------------------
const sent = [];
let updId = 0;
const fake = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const method = req.url.split('/').pop();
    let params = {};
    try { params = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { params = {}; }
    sent.push({ method, params });
    const result = method === 'getMe'
      ? { id: 1, username: 'webapp_test_bot', first_name: 'Test' }
      : method === 'sendMessage'
        ? { message_id: 7000 + sent.length, date: 1, chat: { id: params.chat_id }, text: params.text || '' }
        : true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
  });
});

function msg(chatId, extra) {
  return { update_id: ++updId, message: Object.assign({
    message_id: 6000 + updId,
    chat: { id: Number(chatId), type: 'private' },
    from: { id: Number(chatId), is_bot: false, first_name: 'Mijoz' },
    date: Math.floor(Date.now() / 1000),
  }, extra || {}) };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function G(p, u) {
  const res = await fetch('http://127.0.0.1:' + p + u);
  return { code: res.status, text: await res.text(), type: res.headers.get('content-type') || '' };
}
async function PO(p, u, o) {
  const res = await fetch('http://127.0.0.1:' + p + u, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { code: res.status, text, json };
}

(async () => {
  check('web/index.html mavjud', fs.existsSync(path.join(__dirname, '..', 'web', 'index.html')));
  const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  check('Sahifada tashqi CDN yo\'q (faqat telegram.org)',
    !/cdn\.jsdelivr|unpkg\.com|googleapis|cloudflare/.test(html),
    (html.match(/https?:\/\/[^"' ]+/g) || []).join(', '));
  check('Telegram WebApp SDK + theme ishlatiladi',
    html.includes('telegram-web-app.js') && html.includes('window.Telegram'));
  check('Kirish ekrani bor: ism + telefon so\'raydi',
    /id="gate"/.test(html) && /id="gName"/.test(html) && /id="gPhone"/.test(html) && /gBtn/.test(html));
  check('Ma\'lumot localStorage\'da saqlanadi (keyingi safar avtomatik)',
    /ob_profile_v1/.test(html) && /localStorage/.test(html));
  check('Formada saqlangan ma\'lumotni qo\'yish tugmasi bor',
    /data-a="fill"/.test(html) && /Saqlangan ma/.test(html));
  check('Forma ism/telefonni avtomatik to\'ldiradi', /profile\.name/.test(html) && /profile\.phone/.test(html));
  check('Manzil ixtiyoriy ekanligi ko\'rsatilgan', /ixtiyoriy/i.test(html));
  check('Holat tugmalari (Qabul qilindi/Yo\'lda) ilovada yo\'q', !/accepted|shipped|Yetkazildi/.test(html));

  await new Promise((r) => fake.listen(FAKE_TG_PORT, r));

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webapp-test-'));
  process.env.BOT_TOKEN = TOKEN;
  process.env.ADMIN_CHAT_ID = ADMIN;
  process.env.WEB_APP_URL = 'https://demo.onrender.com/app';
  process.env.DATA_DIR = dataDir;
  process.env.ENV_FILE = path.join(dataDir, 'yoq-env-fayli');
  process.env.TELEGRAM_API_BASE = 'http://127.0.0.1:' + FAKE_TG_PORT;

  const config = require('../lib/config');
  const api = require('../lib/api');
  const store = require('../lib/store');
  const bot = require('../lib/bot');
  const keyboards = require('../lib/keyboards');
  const webapp = require('../lib/webapp');

  const cfg = config.load();
  check('WEB_APP_URL config\'ga kirdi', cfg.webAppUrl === 'https://demo.onrender.com/app', cfg.webAppUrl);
  api.init(cfg.token);
  const orders = store.create(cfg.dataDir);
  bot.init(cfg, orders);

  const w = webapp.create({ cfg, bot, orders });
  await new Promise((r) => w.server.listen(APP_PORT, r));

  const health = await G(APP_PORT, '/');
  check('Health (/) 200', health.code === 200 && health.text.includes('order-bot'), health.code + ' ' + health.text.trim());

  const page = await G(APP_PORT, '/app');
  check('/app — 200 HTML', page.code === 200 && page.type.includes('text/html') && page.text.includes('<!doctype'),
    page.code + ' ' + page.type);

  const catRes = await G(APP_PORT, '/api/catalog');
  const cat = JSON.parse(catRes.text);
  check('/api/catalog — 6 ta mahsulot', catRes.code === 200 && cat.products.length === 6, cat.products.length);
  check('Katalog ikki tilli (uz + ru nomlar)',
    cat.products.every((x) => x.uz && x.uz.name && x.ru && x.ru.name && /[\u0400-\u04FF]/.test(x.ru.name)));
  check('Faqat kiyim: g\'ilofi/sumka yo\'q',
    !cat.products.some((x) => /g'ilofi|Sumka|Чехол|Сумка/i.test(x.uz.name + ' ' + x.ru.name)),
    cat.products.map((x) => x.uz.name).join(', '));
  check('Rasm yo\'llari mahalliy (/img/)', cat.products.every((x) => String(x.img).startsWith('/img/')), cat.products[0].img);
  check('Katalog javobida token yo\'q', !catRes.text.includes(TOKEN));

  const imgName = cat.products[0].img.split('/')[2];
  const imgRes = await fetch('http://127.0.0.1:' + APP_PORT + '/img/' + imgName);
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  check('Rasm served (JPEG foto, 20 KB+)',
    imgRes.status === 200 && (imgRes.headers.get('content-type') || '').includes('image/jpeg') && imgBuf.length > 20000,
    imgRes.status + ' ' + (imgRes.headers.get('content-type') || '') + ' ' + imgBuf.length + ' bayt');
  check('Rasm kesh bilan (telefon tez ochiladi)', /max-age=86400/.test(imgRes.headers.get('cache-control') || ''),
    imgRes.headers.get('cache-control'));
  const trav = await fetch('http://127.0.0.1:' + APP_PORT + '/img/..%2f..%2f.env');
  check('/img/ traversal bloklandi (.env o\'qilmadi)', trav.status === 404, trav.status);
  const trav2 = await fetch('http://127.0.0.1:' + APP_PORT + '/img/..%2f..%2f.env%2ejpg');
  check('Traversal .jpg ko\'rinishida ham bloklandi', trav2.status === 404, trav2.status);
  const notFound = await G(APP_PORT, '/api/yoq');
  check('Noma\'lum yo\'l → 404', notFound.code === 404, notFound.code);

  // --- buyurtma: ilova orqali -----------------------------------------------
  sent.length = 0;
  const ok = await PO(APP_PORT, '/api/order', {
    name: 'Sardor', phone: '901234567', address: 'Chilonzor 12-kvartal, 45-uy', lang: 'uz',
    items: [{ id: 'p1', qty: 2 }, { id: 'p4', qty: 1 }],
    telegram: { id: Number(BUYER) },
  });
  check('POST /api/order — 200 + buyurtma raqami', ok.code === 200 && ok.json && ok.json.ok && /^B-\d{4}$/.test(ok.json.id),
    ok.code + ' ' + ok.text.slice(0, 90));
  check('Jami summa serverda qayta hisoblandi', ok.json && ok.json.total === 85000 * 2 + 35000, ok.json && ok.json.total);
  const saved = orders.all();
  check('Buyurtma orders.json ga tushdi (source=web)',
    saved.length === 1 && saved[0].items.length === 2 && saved[0].source === 'web',
    JSON.stringify(saved[0] && { id: saved[0].id, total: saved[0].total, chatId: saved[0].chatId }));
  const notify = sent.filter((s) => s.method === 'sendMessage' && String(s.params.chat_id) === ADMIN);
  check('Sotuvchiga Telegram bildirishnoma ketdi', notify.length === 1 && notify[0].params.text.includes('B-0001'),
    notify.length ? notify[0].params.text.replace(/\n/g, ' | ').slice(0, 130) : 'xabar yo\'q');
  check('Bildirishnomada telefon + manzil bor',
    notify.length === 1 && notify[0].params.text.includes('+998901234567') && notify[0].params.text.includes('Chilonzor'));
  check('Bildirishnomada tugmalar YO\'Q (faqat matn)',
    notify.length === 1 && !notify[0].params.reply_markup, JSON.stringify(notify[0] && notify[0].params.reply_markup));
  check('Mijozga qo\'shima Telegram xabari ketmadi',
    sent.filter((s) => s.method === 'sendMessage' && String(s.params.chat_id) === BUYER).length === 0,
    sent.map((s) => s.params.chat_id).join(','));

  // --- manzil ixtiyoriy -------------------------------------------------------
  sent.length = 0;
  const noAddr = await PO(APP_PORT, '/api/order', { name: 'Doniyor', phone: '901234567', address: '', lang: 'uz', items: [{ id: 'p2', qty: 1 }] });
  check('Manzil yozmasa ham buyurtma qabul qilinadi', noAddr.code === 200 && noAddr.json.ok, noAddr.code + ' ' + noAddr.text.slice(0, 70));
  const nNote = sent.filter((s) => s.method === 'sendMessage' && String(s.params.chat_id) === ADMIN)[0];
  check('Bildirishnomada "manzil kiritilmagan" deb yoziladi', nNote && /manzil kiritilmagan/.test(nNote.params.text),
    nNote && nNote.params.text.replace(/\n/g, ' | ').slice(0, 140));

  // --- oldirincha normalangan telefon (xotira: kirishda saqlangan raqam forma
  //     qaytib kelganda 400 qaytargar edi) ------------------------------------
  sent.length = 0;
  const plus = await PO(APP_PORT, '/api/order', { name: 'Malika', phone: '+998901234567', address: 'Yunusobod 4', lang: 'uz', items: [{ id: 'p4', qty: 1 }] });
  check('Allabochga normalangan telefon (+998...) qabul qilindi', plus.code === 200 && plus.json.ok,
    plus.code + ' ' + plus.text.slice(0, 90));
  const pNote = sent.filter((s) => s.method === 'sendMessage' && String(s.params.chat_id) === ADMIN)[0];
  check('Bildirishnomada telefon +998 ko\'rinishida', pNote && pNote.params.text.includes('+998901234567'),
    pNote && pNote.params.text.replace(/\n/g, ' | ').slice(0, 120));

  // --- frontend normPhone server bilan bir xil ishlaydi ---------------------
  const fnSrc = (html.match(/function normPhone\(v\)[\s\S]*?\n\}/) || [''])[0];
  let front = null;
  try { front = eval('(' + fnSrc + ')'); } catch (e) { front = null; }
  const cases = ['+998901234567', '901234567', '998901234567', '+998 90 111 22 33', '8 90 111 22 33', '8998901234567', '12', 'ab', '', '+99890'];
  check('Sahifadagi normPhone topildi', !!fnSrc && typeof front === 'function', fnSrc.slice(0, 60) || 'topilmadi');
  check('Sahifa + server telefon qoidalari bir xil',
    typeof front === 'function' && cases.every((c) => front(c) === bot.parsePhone(c)),
    typeof front === 'function' ? cases.map((c) => c + '=' + front(c) + '/' + bot.parsePhone(c)).join(' | ') : 'funksiya yo\'q');

  // --- noto\'g\'ri ma'lumotlar ----------------------------------------------
  const badPhone = await PO(APP_PORT, '/api/order', { name: 'Ali', phone: '12', address: 'X', items: [{ id: 'p1', qty: 1 }] });
  check('Noto\'g\'ri telefon → 400', badPhone.code === 400 && !!(badPhone.json && badPhone.json.error), badPhone.code + ' ' + badPhone.text.slice(0, 70));
  const emptyCart = await PO(APP_PORT, '/api/order', { name: 'Ali', phone: '901234567', address: 'X', items: [] });
  check('Bo\'sh savat → 400', emptyCart.code === 400, emptyCart.code);
  const fakeId = await PO(APP_PORT, '/api/order', { name: 'Ali', phone: '901234567', address: 'X', items: [{ id: 'p99', qty: 1 }] });
  check('Yo\'q mahsulot ID rad etildi', fakeId.code === 400, fakeId.code + ' ' + fakeId.text.slice(0, 70));
  const noName = await PO(APP_PORT, '/api/order', { name: '', phone: '901234567', address: 'X', items: [{ id: 'p1', qty: 1 }] });
  check('Ismsiz buyurtma rad etildi', noName.code === 400, noName.code);
  const bigQty = await PO(APP_PORT, '/api/order', { name: 'Ali', phone: '901234567', address: 'X', items: [{ id: 'p1', qty: 9999 }] });
  check('9999 dona → 99 ga chegaralandi', bigQty.code === 200 && bigQty.json.total === 85000 * 99, bigQty.json && bigQty.json.total);

  // --- zaxira yo'l: web_app_data xabari orqali ------------------------------
  sent.length = 0;
  await bot.handle(msg(BUYER, { web_app_data: { data: JSON.stringify({
    name: 'Gulnora', phone: '+998901112233', address: 'Yunusobod 4-mikroraion', lang: 'uz',
    items: [{ id: 'p3', qty: 1 }] }) } }));
  await wait(250);
  const viaMsg = orders.all().filter((o) => o.customer.name === 'Gulnora');
  check('web_app_data orqali ham buyurtma saqlandi', viaMsg.length === 1 && viaMsg[0].total === 195000,
    JSON.stringify(viaMsg[0] && viaMsg[0].total));
  check('web_app_data → sotuvchiga xabar (tugmasiz)',
    sent.filter((s) => s.method === 'sendMessage' && String(s.params.chat_id) === ADMIN && !s.params.reply_markup).length === 1);

  // --- /start salomi + ilova tugmasi ----------------------------------------
  const kbUz = keyboards.appKb('uz', cfg.webAppUrl);
  const first = kbUz.inline_keyboard[0][0];
  check('/start tugmasi — mini-ilovani ochadi',
    !!(first.web_app && first.web_app.url === 'https://demo.onrender.com/app'), JSON.stringify(first).slice(0, 110));
  check('Tugma matni o\'zbekcha', /Ilovani ochish/.test(first.text), first.text);
  check('Ruscha tugma ham bor', /Открыть приложение/.test(keyboards.appKb('ru', cfg.webAppUrl).inline_keyboard[0][0].text));
  check('URL bo\'lmasa tugma yo\'q (https talab qilinadi)', keyboards.appKb('uz', '') === undefined);

  sent.length = 0;
  await bot.handle(msg(BUYER, { text: '/start' }));
  await wait(250);
  const startMsg = sent.find((s) => s.method === 'sendMessage' && String(s.params.chat_id) === BUYER);
  check('Real /start javobida web_app tugmasi bor',
    !!(startMsg && /web_app/.test(JSON.stringify(startMsg.params.reply_markup || {}))),
    JSON.stringify((startMsg && startMsg.params.reply_markup) || {}).slice(0, 120));
  check('Salom matnida "Hush kelibsiz" bor',
    !!(startMsg && /Hush kelibsiz/.test(startMsg.params.text)),
    startMsg ? startMsg.params.text.replace(/\n/g, ' | ').slice(0, 80) : 'javob yo\'q');
  check('/start da bittadan ortiq xabar yo\'q (suhbat qilinmaydi)',
    sent.filter((s) => String(s.params.chat_id) === BUYER).length === 1,
    sent.map((s) => s.params.chat_id + ':' + (s.params.text || '').slice(0, 20)).join(' | '));
  check('Token hech bir API so\'roviga kirmadi', !JSON.stringify(sent).includes(TOKEN));

  w.server.close();
  fake.close();
  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'OK   ' : 'FAIL ') + r.name + (r.detail ? '  <<  ' + r.detail : ''));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + " mini-ilova tekshiruvi o'tdi");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log('CRASH: ' + (e && e.stack || e));
  try { process.exit(2); } catch (_) {}
});
