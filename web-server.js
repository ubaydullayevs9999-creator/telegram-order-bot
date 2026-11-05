// Hostning ichida ishlaydigan kirish nuqta: FAQAT mini-ilova serveri.
// Bot polling QILMAYDI — polling Sizning kompyuteringizda (index.js) qoladi,
// shuning uchun Render bepul rejimida uyquga ketishi muammo emas.
//
// Render sozlamalari:
//   Runtime      : Node
//   Build command: (bo'sh — npm paketi yo'q)
//   Start command: node web-server.js
//   Env (Secret):  BOT_TOKEN, ADMIN_CHAT_ID, STORE_NAME
//   Health check : /
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

// Render/Railway PORT ni o'zi beradi; lokal testda 8130.
const PORT = Number(process.env.PORT || 8130);
const HOST = process.env.HOST || '0.0.0.0';

const web = webapp.create({ cfg, bot, orders });

web.server.listen(PORT, HOST, () => {
  console.log('Mini-ilova (hosting rejimi): port ' + PORT);
  console.log('  ilova:  /app');
  console.log('  health: /');
  console.log('  API:    GET /api/catalog | POST /api/order');
  console.log('Do\'kon: ' + cfg.storeName + ' | token: ' + api.mask(cfg.token) + ' (kodda yo\'q)');
  console.log('Sotuvchi: ' + (cfg.adminChatIds.length ? cfg.adminChatIds.join(', ') : 'SOZLANMAGAN'));
  console.log('Buyurtmalar fayli: ' + orders.file + ' | jami: ' + orders.all().length);
});

process.on('SIGTERM', () => { console.log('to\'xtatildi (SIGTERM)'); process.exit(0); });
process.on('SIGINT', () => { console.log('to\'xtatildi'); process.exit(0); });
process.on('unhandledRejection', (e) => console.log('unhandled: ' + (e && e.message ? e.message : e)));
