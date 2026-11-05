// Bot uchun soya-server testi: haqiqiy Telegram'ga ulanmaydi.
// Tekshiriladi: salom + "Ilovani ochish" tugmasi, suhbat yo'qligi,
// sotuvchini avtomatik aniqlash, mini-ilova buyurtmasi va xavfsizlik.
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PORT = 8123;
const ADMIN = '777001';
const USER = '555001';
const USER_RU = '555002';
const APP_URL = 'https://demo-dokon.onrender.com/app';

process.env.TELEGRAM_API_BASE = 'http://127.0.0.1:' + PORT;
process.env.BOT_TOKEN = '123456:SIMULATION-TOKEN-abcdefghij';
process.env.ADMIN_CHAT_ID = ADMIN;
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-sim-'));
process.env.STORE_NAME = 'Demo Do\'kon';
process.env.WEB_APP_URL = APP_URL;
process.env.ENV_FILE = path.join(process.env.DATA_DIR, 'yoq.env');

const sent = [];
let updateId = 100;
const queue = [];

// Telegram haqiqatan tekshiradigan maydonlar. Bunday validatsiya soxta
// serverda bo'lmasa, koddagi xato faqat real API'da chiqadi.
const bad = [];
function validate(method, p) {
  if (method === 'setMyCommands') {
    if (!Array.isArray(p.commands)) return "can't parse BotCommand: expected an Array";
    for (const c of p.commands) {
      if (!c || typeof c !== 'object' || Array.isArray(c)) return "can't parse BotCommand: expected an Object";
      if (!/^[a-z0-9_]{1,32}$/.test(String(c.command || ''))) return 'BotCommand command invalid';
      if (typeof c.description !== 'string' || c.description.length < 1 || c.description.length > 256) return 'BotCommand description invalid';
    }
    return null;
  }
  if (method === 'sendMessage' || method === 'editMessageText') {
    if (p.chat_id === undefined || p.chat_id === null) return 'chat_id is required';
    if (typeof p.text !== 'string' || !p.text.length) return 'text is required';
    if (p.text.length > 4096) return 'Message too long';
    if (method === 'editMessageText' && !p.message_id) return 'message_id is required';
    if (p.reply_markup && !p.reply_markup.inline_keyboard) return 'reply_markup invalid';
    for (const row of (p.reply_markup && p.reply_markup.inline_keyboard) || []) {
      for (const b of row) {
        if (!b.text) return 'button text required';
        if (b.web_app && !/^https:\/\//i.test(b.web_app.url || '')) return 'web_app url must be HTTPS';
        if (!b.url && !b.callback_data && !b.web_app && !b.request_contact) return 'button action required';
      }
    }
    return null;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const method = req.url.split('/').pop();
    if (method === 'getUpdates') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, result: queue.splice(0, queue.length) }));
    }
    let params = {};
    if (buf.length) { try { params = JSON.parse(buf.toString('utf8')); } catch (e) { params = { unparsed: true }; } }
    const problem = validate(method, params);
    if (problem) {
      bad.push(method + ': ' + problem);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: ' + problem }));
    }
    sent.push({ method, params, at: sent.length });
    const result = method === 'getMe'
      ? { id: 1, username: 'demo_order_bot', first_name: 'Demo' }
      : method === 'sendMessage'
        ? { message_id: 9000 + sent.length, date: 1, chat: { id: params.chat_id }, text: params.text || '' }
        : true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
  });
});

function base(chatId, from) {
  return {
    message_id: 5000 + (++updateId),
    chat: { id: Number(chatId), type: 'private' },
    from: Object.assign({ id: Number(chatId), is_bot: false, first_name: 'Test' }, from || {}),
    date: Math.floor(Date.now() / 1000),
  };
}
// update yasovchilar (step() ga beriladi)
const M = (chatId, text, from) => ({ update_id: updateId, message: Object.assign(base(chatId, from), { text }) });
const WA = (chatId, data) => ({ update_id: updateId, message: Object.assign(base(chatId), { web_app_data: { button_send_result: 'x', data } }) });

function textOf(s) { return String(s.params.text || ''); }
function kbOf(s) { return s.params.reply_markup; }

function after(idx, chatId, contains) {
  for (let i = idx; i < sent.length; i++) {
    const s = sent[i];
    if (s.method !== 'sendMessage') continue;
    if (String(s.params.chat_id) === String(chatId)) {
      if (!contains || textOf(s).includes(contains)) return s;
    }
  }
  return null;
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: cond ? '' : String(detail === undefined ? '' : detail).slice(0, 300) });
}

let bot;
async function step(...items) {
  const before = sent.length;
  for (const u of items) queue.push(u);
  while (queue.length) {
    const batch = queue.splice(0, queue.length);
    for (const u of batch) await bot.handle(u);
  }
  return before;
}

(async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const config = require('../lib/config');
  const api = require('../lib/api');
  const store = require('../lib/store');
  bot = require('../lib/bot');
  const cfg = config.load();
  api.init(cfg.token);
  const orders = store.create(cfg.dataDir);
  bot.init(cfg, orders);

  // ---- 1. Salom ekrani ----
  let i = await step(M(USER, '/start'));
  const w = after(i, USER, 'Hush kelibsiz');
  check('/start salom + do\'kon nomini qaytaradi', w && w.params.text.includes('Demo Do'), w && textOf(w).slice(0, 60));
  check('/start bitta tugma: "Ilovani ochish"', w && kbOf(w) && kbOf(w).inline_keyboard.length === 1 &&
    kbOf(w).inline_keyboard[0][0].text.includes('Ilovani ochish'), JSON.stringify(kbOf(w)));
  check('Tugma mini-ilovani ochadi (web_app + https)', w && kbOf(w).inline_keyboard[0][0].web_app.url === APP_URL,
    JSON.stringify(kbOf(w).inline_keyboard[0][0]));
  check('Suhbat tugmalari (callback_data) qolmagan', !JSON.stringify(kbOf(w)).includes('callback_data'), JSON.stringify(kbOf(w)));
  check('Sotuvchi ID sozlangan — qo\'shimcha xabar yuborilmaydi',
    sent.slice(i).filter((s) => String(s.params.chat_id) === USER).length === 1,
    sent.slice(i).map((s) => textOf(s).slice(0, 30)).join(' | '));

  i = await step(M(USER_RU, '/start', { language_code: 'ru' }));
  const wr = after(i, USER_RU, 'Добро пожаловать');
  check('Rus tilida ruscha salom', wr && wr.params.text.includes('Добро пожаловать'), wr && textOf(wr).slice(0, 60));
  check('Ruscha tugma: "Открыть приложение"', wr && kbOf(wr).inline_keyboard[0][0].text.includes('Открыть приложение'), JSON.stringify(kbOf(wr)));

  i = await step(M(USER, 'salom nima bor'));
  check('Oddiy xabarga ham faqat salom + tugma', after(i, USER, 'Hush kelibsiz') && sent.slice(i).length === 1,
    sent.slice(i).map((s) => textOf(s).slice(0, 40)).join(' | '));

  i = await step(M(USER, '/orders'), M(USER, '/setadmin'), M(USER, '/id'));
  check('/orders, /setadmin, /id endi kerak emas', sent.slice(i).every((s) => textOf(s).includes('Hush kelibsiz')),
    sent.slice(i).map((s) => textOf(s).slice(0, 40)).join(' | '));

  // ---- 2. Sotuvchini avtomatik aniqlash (/setadmin o'rniga) ----
  const cfg2 = { token: cfg.token, adminChatIds: [], storeName: 'Demo Do\'kon', dataDir: cfg.dataDir, webAppUrl: '' };
  const orders2 = store.create(fs.mkdtempSync(path.join(os.tmpdir(), 'bot-sim2-')));
  bot.init(cfg2, orders2);
  i = await step(M(USER, '/start'));
  check('ADMIN_CHAT_ID bo\'sa — birinchi /start sotuvchi bo\'ladi', orders2.metaAdmin() === USER, orders2.metaAdmin());
  const w2 = after(i, USER, 'Hush kelibsiz');
  check('WEB_APP_URL bo\'lmasa tugma yo\'q, lekin ogohlantirish bor', w2 && !kbOf(w2) && w2.params.text.includes('Ilova hozircha yopiq'),
    JSON.stringify(kbOf(w2)));
  bot.init(cfg, orders);

  // ---- 3. Mini-ilova buyurtmasi ----
  const payload = {
    name: 'Sardor', phone: '901234567', address: '', lang: 'uz',
    items: [{ id: 'p2', qty: 1 }, { id: 'p3', qty: 2 }, { id: 'yoq', qty: 5 }],
    total: 1, telegram: { id: Number(USER) },
  };
  const mark = sent.length;
  const out = await bot.orderFromWeb(payload);
  const note = after(mark, ADMIN, 'Yangi buyurtma B-0001');
  check('Buyurtma raqami B-0001', out.ok && out.id === 'B-0001', JSON.stringify(out));
  check('Jami summa serverda qayta hisoblandi (220000 + 2*195000)', out.total === 610000, out.total);
  check('Manzil bo\'sh bo\'lsa ham buyurtma qabul qilinadi', out.ok === true, JSON.stringify(out));
  check('Noma\'lum mahsulot (id "yoq") rad etildi', note && !textOf(note).includes('yoq'), note && textOf(note));
  check('Bildirishnomada ism + telefon + summa bor',
    note && ['Sardor', '+998901234567', '610 000'].every((x) => textOf(note).includes(x)), note && textOf(note).replace(/\n/g, ' | '));
  check('Bildirishnomada holat tugmalari YO\'Q', note && !kbOf(note), JSON.stringify(note && kbOf(note)));
  check('Mijozga Telegram\'da tasdiq yuborilmaydi (ilova o\'zi ko\'rsatadi)',
    !sent.some((s) => String(s.params.chat_id) === USER && textOf(s).includes('Buyurtma qabul qilindi')),
    sent.filter((s) => String(s.params.chat_id) === USER).map((s) => textOf(s).slice(0, 30)).join(' | '));
  const o = orders.find('B-0001');
  check('orders.json da source=web, status=new, 2 qator', o && o.source === 'web' && o.status === 'new' && o.items.length === 2, JSON.stringify(o));
  check('orders.json fayli diskda bor', fs.existsSync(orders.file), orders.file);

  const bad1 = await bot.orderFromWeb({ name: 'A', phone: '901234567', items: [{ id: 'p1', qty: 1 }] });
  check('1 harfli ism rad etildi', bad1.error && /Ism/i.test(bad1.error), JSON.stringify(bad1));
  const bad2 = await bot.orderFromWeb({ name: 'Sardor', phone: '12', items: [{ id: 'p1', qty: 1 }] });
  check('Noto\'g\'ri telefon rad etildi', bad2.error && /Telefon/i.test(bad2.error), JSON.stringify(bad2));
  const bad3 = await bot.orderFromWeb({ name: 'Sardor', phone: '901234567', items: [] });
  check('Bo\'sh savat rad etildi', bad3.error && /Savat/i.test(bad3.error), JSON.stringify(bad3));

  i = await step(WA(USER, JSON.stringify({ name: 'Anvar', phone: '998901112233', address: 'Yunusobod 3', items: [{ id: 'p1', qty: 2 }] })));
  check('web_app_data zaxira yo\'li ham ishlaydi (B-0002)', after(i, ADMIN, 'B-0002') && after(i, USER, 'Buyurtma qabul qilindi'),
    sent.slice(i).map((s) => s.params.chat_id + ':' + textOf(s).slice(0, 24)).join(' | '));
  i = await step(WA(USER, 'bu JSON emas'));
  check('Buzuq web_app_data jimgina o\'tkazib yuboriladi', sent.length === i, sent.slice(i).map((s) => textOf(s).slice(0, 30)).join(' | '));

  // ---- 4. Telefon formatlari ----
  check('Noto\'g\'ri raqamlar rad etiladi', ['12', '89012345678901234', 'ab', ''].every((x) => bot.parsePhone(x) === null));
  const phoneCases = [['+998901234567', '+998901234567'], ['901234567', '+998901234567'], ['998901234567', '+998901234567'],
    ['+998 90 111 22 33', '+998901112233'], ['8 90 111 22 33', '+998901112233'], ['8998901234567', '+998901234567'],
    ['+99890', null], ['90123456', null], ['99890123456', null]];
  check('Telefon formatlari to\'g\'ri ishlaydi', phoneCases.every(([in_, ex]) => bot.parsePhone(in_) === ex),
    phoneCases.map(([x]) => x + '=' + bot.parsePhone(x)).join(' | '));
  check('Telefonni qayta normalash o\'zgartirmaydi (saqlangan raqam forma qaytib kelganda)',
    ['+998901234567', '+998901112233'].every((x) => bot.parsePhone(bot.parsePhone(x)) === bot.parsePhone(x)),
    bot.parsePhone(bot.parsePhone('+998901234567')));

  // ---- 5. Katalog: faqat kiyim + haqiqiy fotolar ----
  const { PRODUCTS } = require('../lib/catalog');
  check('Katalogda 6 ta mahsulot bor', PRODUCTS.length === 6, PRODUCTS.length);
  check('Telefon g\'ilofi va sumka yo\'q', !PRODUCTS.some((p) => /g'ilofi|Sumka|Чехол|Сумка/i.test(p.uz.name + ' ' + p.ru.name)),
    PRODUCTS.map((p) => p.uz.name).join(', '));
  check('Har bir rasm — haqiqiy foto (.jpg, 20KB+)', PRODUCTS.every((p) => fs.existsSync(p.img) && fs.statSync(p.img).size > 20000 && /\.jpg$/i.test(p.img)),
    PRODUCTS.map((p) => path.basename(p.img) + '=' + (fs.existsSync(p.img) ? fs.statSync(p.img).size : 'YOQ')).join(', '));
  check('Rasm manbasi hujjatlashtirilgan (CREDITS.txt)', fs.existsSync(path.join(__dirname, '..', 'assets', 'img', 'CREDITS.txt')));
  check('Bot logotipi tayyor (512x512 PNG)', (() => {
    const f = path.join(__dirname, '..', 'assets', 'bot-logo.png');
    if (!fs.existsSync(f)) return false;
    const b = fs.readFileSync(f);
    return b.slice(1, 4).toString('latin1') === 'PNG' && b.readUInt32BE(16) === 512;
  })(), 'assets/bot-logo.png');

  // ---- 6. Xavfsizlik ----
  check('Token hech bir API chaqiruvida yo\'q', !JSON.stringify(sent).includes('SIMULATION-TOKEN'));
  check('Telegram validatsiyasidan o\'tmagan so\'rov yo\'q', bad.length === 0, bad.join(' | '));
  const files = ['index.js', 'README.md', '.env.example', 'start.cmd', '.gitignore'].map((f) => path.join(__dirname, '..', f))
    .concat(['config.js', 'api.js', 'bot.js', 'catalog.js', 'i18n.js', 'keyboards.js', 'store.js', 'webapp.js'].map((f) => path.join(__dirname, '..', 'lib', f)))
    .concat([path.join(__dirname, '..', 'web', 'index.html')])
    .filter((f) => fs.existsSync(f));
  const allText = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  check('Kod/referensiya fayllarida token yo\'q', !/SIMULATION-TOKEN-abcdefghij/.test(allText.replace(/process\.env\.BOT_TOKEN/g, '')));
  check('.gitignore .env ni qoplaydi', fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8').includes('.env'));
  const envPath = path.join(__dirname, '..', '.env');
  check('Haqiqiy token (agar .env bo\'lsa) kodga tushmagan',
    !fs.existsSync(envPath) || !allText.includes((fs.readFileSync(envPath, 'utf8').split('BOT_TOKEN=')[1] || '@@').split(/\r?\n/)[0]),
    'real token must stay in .env');
  check('Frontend\'da token/secret yo\'q', !/BOT_TOKEN|ADMIN_CHAT_ID/.test(fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')));

  server.close();
  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? 'OK   ' : 'FAIL ') + r.name + (r.detail ? '  <<  ' + r.detail : ''));
  }
  console.log('\n' + (results.length - failed) + '/' + results.length + ' tekshiruv o\'tdi');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log('SIMULATION CRASH: ' + (e && e.stack || e));
  server.close();
  process.exit(2);
});
