const config = require('./lib/config');
const api = require('./lib/api');
const store = require('./lib/store');
const bot = require('./lib/bot');
const webapp = require('./lib/webapp');

let cfg;
try {
  cfg = config.load();
} catch (e) {
  console.log('\n[ISHTGA TUSHMADI]\n' + e.message + '\n');
  process.exit(e.userFacing ? 2 : 1);
}

api.init(cfg.token);
const orders = store.create(cfg.dataDir);
bot.init(cfg, orders);

const PORT = Number(process.env.PORT || 0);
let web = null;
if (PORT) {
  web = webapp.create({ cfg, bot, orders });
  web.server.listen(PORT, () => {
    const os = require('os');
    const ips = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i.address);
    console.log('Mini-ilova: http://localhost:' + PORT + '/app');
    if (ips.length) console.log('  telefonfrom ochish (bir xil Wi-Fi): http://' + ips[0] + ':' + PORT + '/app');
    console.log('  health check (hosting uchun): /');
  });
}

const COMMANDS = [
  { command: 'start', description: "Do'konni ochish" },
];

async function setup() {
  const me = await api.notify('getMe', {});
  if (!me) throw new Error('Token ishlamadi (getMe javob bermadi).');
  process.env.BOT_USERNAME = me.username;
  try {
    await api.notify('setMyCommands', { commands: COMMANDS, scope: { type: 'default' } });
  } catch (e) {
    // menyudagi buyruqlar ro'yxati — kozmetik. Bot ishlashini to'xtatmasligi kerak.
    console.log('setMyCommands: ' + e.message + ' (bot baribir ishlaydi)');
  }
  console.log('Bot: @' + me.username + ' | token: ' + api.mask(cfg.token) + ' (kodga yozilmagan)');
  console.log('Do\'kon: ' + cfg.storeName);
  console.log('Sotuvchi ID: ' + (cfg.adminChatIds.length ? cfg.adminChatIds.join(', ') : (orders.metaAdmin() || 'SOZLANMAGAN — botga /start yozgan birinchi odam sotuvchi bo\'ladi')));
  console.log('Mini-ilova tugmasi: ' + (cfg.webAppUrl ? cfg.webAppUrl : 'YO\'Q — WEB_APP_URL ga https:// manzil kerak'));
  console.log('Buyurtmalar fayli: ' + orders.file + ' | jami: ' + orders.all().length);
  console.log(' polling boshlandi...');
  return me;
}

let offset = 0;
let backoff = 1000;
let stopping = false;

// Ishga tushganda eski navbatni tozalaymiz: aks holda har bir qayta ishga
// tushirishda bot eski "/start" larga yana salom yuboradi.
// Buyurtma (web_app_data) saqlanib qolgan bo'lsa — uni albatta ishlaymiz.
async function drain() {
  let pend = [];
  try {
    pend = await api.notify('getUpdates', { timeout: 0, allowed_updates: ['message'] }, 20000) || [];
  } catch (e) {
    console.log('Navbatni tekshirib bo\'lmadi: ' + e.message);
    return;
  }
  let skip = 0;
  for (const u of pend) {
    const m = u.message;
    if (m && m.web_app_data) {
      try { await bot.handle(u); } catch (e) { console.log('eski web_app_data xato: ' + e.message); }
    } else skip++;
    offset = Math.max(offset, u.update_id + 1);
  }
  if (skip) console.log('Eski ' + skip + ' ta xabar o\'tkazib yuborildi (takror salom yubormaslik uchun)');
}

async function loop() {
  while (!stopping) {
    let updates;
    try {
      updates = await api.notify('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, 70000);
      backoff = 1000;
    } catch (e) {
      if (e.code === 401 || e.code === 409) {
        console.log(e.code === 401 ? 'Token noto\'g\'ri (401). .env ni tekshiring.' : 'Bot\'ning yana bir nusxasi ishlayapti (409). Ikkalasidan birini to\'xtating.');
        process.exit(1);
      }
      const t = new Date().toLocaleTimeString();
      console.log('[' + t + '] ulanuv uzildi: ' + e.message + ' — ' + backoff / 1000 + 's dan so\'ng qayta uriladi');
      await api.sleep(backoff);
      backoff = Math.min(backoff * 2, 30000);
      continue;
    }
    for (const u of updates) {
      offset = Math.max(offset, u.update_id + 1);
      try {
        await bot.handle(u);
      } catch (e) {
        console.log('update ' + u.update_id + ' xato: ' + e.message);
      }
    }
  }
}

process.on('SIGINT', () => { console.log('\nTo\'xtatildi. Buyurtmalar saqlangan: ' + orders.file); process.exit(0); });
process.on('unhandledRejection', (e) => console.log('unhandled: ' + (e && e.message ? e.message : e)));

setup().then(async () => { await drain(); return loop(); }).catch((e) => {
  console.log('Tayyorgarlik xatosi: ' + e.message);
  process.exit(1);
});
