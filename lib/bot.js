const api = require('./api');
const K = require('./keyboards');
const { t, LABELS } = require('./i18n');
const { BY_ID, money } = require('./catalog');

// Botning vazifasi endi bitta: salom berish va mini-ilovani ochish tugmasini
// ko'rsatish. Katalog, savat, buyurtma, admin ro'yxati — hammasi mini-ilovada.
// Sotuvchiga Telegram orqali faqat oddiy matnli bildirishnoma boradi (tugmasiz).

let cfg = null;
let store = null;

function init(config, orderStore) {
  cfg = config;
  store = orderStore;
}

function adminTargets() {
  const set = new Set(cfg.adminChatIds);
  const m = store.metaAdmin();
  if (m) set.add(m);
  return [...set];
}

function guessLang(m) {
  const l = (m && m.from && m.from.language_code) || (m && m.chat && m.chat.locale) || '';
  return String(l).toLowerCase().startsWith('ru') ? 'ru' : 'uz';
}

function parsePhone(value) {
  let d = String(value || '').replace(/[^\d]/g, '');
  if (d.length === 13 && d.startsWith('8998')) d = d.slice(1);          // 8 998 901 23 45 67
  if (d.length === 12 && d.startsWith('998')) return '+' + d;           // 998901234567
  if (d.length === 9 && /^[1-9]\d{8}$/.test(d)) return '+998' + d;      // 901234567
  if (d.length === 10 && d[0] === '8' && /^[1-9]\d{8}$/.test(d.slice(1))) return '+998' + d.slice(1); // 8 90 123 45 67
  return null;
}

// Sotuvchiga boradigan matn: mahsulotlar, jami, mijoz ismi va telefoniga.
function orderText(order) {
  const lang = order.lang === 'ru' ? 'ru' : 'uz';
  const L = LABELS[lang];
  const lines = [L.items + ':'];
  for (const i of order.items) {
    lines.push('\u2022 ' + i.name + ' — ' + i.qty + ' x ' + money(i.price, lang) + ' = ' + money(i.sum, lang));
  }
  lines.push('');
  lines.push(L.name + ': ' + order.customer.name);
  lines.push(L.tel + ': ' + order.customer.phone);
  lines.push(L.addr + ': ' + (order.customer.address || L.noaddr));
  return lines.join('\n');
}

async function sendWelcome(chatId, lang) {
  const kb = K.appKb(lang, cfg.webAppUrl);
  if (!kb) return api.send(chatId, t(lang, 'welcome', { store: cfg.storeName }) + '\n\n' + t(lang, 'app_off'));
  return api.send(chatId, t(lang, 'welcome', { store: cfg.storeName }), kb);
}

// Mini-ilovadan kelgan buyurtma. Jami summa serverda qayta hisoblanadi —
// mijoz brauzeridagi "total" raqamiga ishonilmaydi.
async function orderFromWeb(payload) {
  const p = payload || {};
  const lang = p.lang === 'ru' ? 'ru' : 'uz';
  const name = String(p.name || '').trim().slice(0, 60);
  const phone = parsePhone(p.phone);
  const address = String(p.address || '').trim().slice(0, 300);
  const raw = Array.isArray(p.items) ? p.items : [];
  const items = [];
  for (const it of raw) {
    const prod = BY_ID.get(String(it && it.id));
    if (!prod) continue;
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    items.push({ id: prod.id, name: prod[lang].name, price: prod.price, qty, sum: prod.price * qty });
  }
  if (!items.length) return { error: lang === 'ru' ? 'Корзина пуста' : 'Savat bo\'sh' };
  if (name.length < 2) return { error: lang === 'ru' ? 'Укажите имя' : 'Ismingizni yozing' };
  if (!phone) return { error: lang === 'ru' ? 'Неверный номер телефона' : "Telefon raqami noto'g'ri" };

  const total = items.reduce((s, x) => s + x.sum, 0);
  const buyerId = p.telegram && p.telegram.id ? String(p.telegram.id) : 'web';
  const id = store.nextId();
  const order = store.add({
    id,
    createdAt: new Date().toISOString(),
    chatId: buyerId,
    source: 'web',
    lang,
    status: 'new',
    total,
    items,
    customer: { name, phone, address },
  });

  const L = LABELS[lang];
  const body = t(lang, 'admin_notify', {
    oid: id,
    text: orderText(order),
    total_label: L.total,
    total: money(total, lang),
  });
  const targets = adminTargets();
  for (const a of targets) {
    try {
      await api.send(a, body);
    } catch (e) {
      console.log('admin bildirishnoma (' + a + '): ' + e.message);
    }
  }
  if (!targets.length) console.log('DIQQAT: sotuvchi ID sozlanmagan — buyurtma saqlandi, lekin xabar bormadi.');
  return { ok: true, id, total, notified: targets.length };
}

async function handle(update) {
  const m = update.message;
  if (!m) return;
  const chatId = m.chat.id;
  const lang = guessLang(m);

  // Zaxira yo'l: ilova serverga yetib bormasa, buyurtma Telegram orqali keladi.
  if (m.web_app_data) {
    let payload = null;
    try { payload = JSON.parse(m.web_app_data.data); } catch (e) { payload = null; }
    if (!payload || !Array.isArray(payload.items)) return;
    const out = await orderFromWeb(Object.assign({ lang }, payload, { telegram: { id: chatId } }));
    if (out.error) return api.send(chatId, '\u26A0\uFE0F ' + out.error);
    return api.send(chatId, t(lang, 'done', { oid: out.id, total: money(out.total, lang) }));
  }

  const text = String(m.text || '').trim();
  if (!text) return;

  if (text.startsWith('/start') || text.startsWith('/help') || /^start$/i.test(text)) {
    // Sotuvchi ID sozlanmagan bo'lsa — birinchi /start yozgan odam sotuvchi bo'ladi.
    // /setadmin o'rniga shu: qo'shimcha buyruq yozish shart emas.
    if (!adminTargets().length) {
      store.setMetaAdmin(chatId);
      console.log('Sotuvchi ID avtomatik saqlandi: ' + chatId + " (.env ga ADMIN_CHAT_ID deb yozib qo'ysangiz hostingda ham adashmaydi)");
    }
    return sendWelcome(chatId, lang);
  }

  // Boshqa har qanday xabar: bot suhbat qilmaydi — salom + ilova tugmasi qaytadi.
  return sendWelcome(chatId, lang);
}

module.exports = { init, handle, parsePhone, orderText, orderFromWeb, adminTargets, sendWelcome };
