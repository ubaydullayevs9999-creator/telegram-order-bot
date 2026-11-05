// Botning nomini, tavsifini va /start ro'yxatdagi buyruq matnini API orqali
// sozlaydi. Rasm (logo) API orqali o'rnatib BO'LMAYDI — uni faqat @BotFather
// /setuserpic orqali qo'yadi.
// Ishga tushirish:  node tools/brand.js            (faqat o'qiydi)
//                  node tools/brand.js --set       (yangilaydi)
const path = require('path');
const fs = require('fs');
const config = require('../lib/config');
const api = require('../lib/api');

const NAME_MAX = 64, SHORT_MAX = 120, DESC_MAX = 200;

function pick(o, key) { return o && o.result && o.result[key]; }

async function main() {
  const cfg = config.load();
  api.init(cfg.token);
  const store = cfg.storeName;

  const desired = {
    name: (store + ' — buyurtma').slice(0, NAME_MAX),
    short: ('Telegram orqali kiyim buyurtma qilish: «' + store + '» mini-ilovasi. To’lov yetkazib berishda.').slice(0, SHORT_MAX),
    desc: ('Do‘konning Telegram ichida ishlaydigan mini-ilovasi: rasmga qarang, o‘lcham va sonini tanlang, savatga soling.' +
      ' Buyurtma sotuvchiga darhol yetib boradi. Savol bo‘lsa sotuvchi o‘zi qo‘ng‘iroq qiladi.').slice(0, DESC_MAX),
  };

  const me = await api.notify('getMe', {});
  console.log('Bot:        @' + pick({ result: me }, 'username'));
  console.log('ID:         ' + pick({ result: me }, 'id'));
  console.log('Hozirgi nom: ' + (me.first_name || '') + (me.last_name ? ' ' + me.last_name : ''));

  const curShort = await api.notify('getMyShortDescription', { language_code: '' });
  const curDesc = await api.notify('getMyDescription', { language_code: '' });
  const curName = await api.notify('getMyName', {});
  console.log('Hozirgi qisqa tavsif: ' + ((curShort && curShort.text) || '(bo\'sh)'));
  console.log('Hozirgi to\'liq tavsif: ' + ((curDesc && curDesc.description) || '(bo\'sh)').slice(0, 80) + '…');
  console.log('Hozirgi ko\'rinadigan nom: ' + ((curName && curName.name) || '(sozlanmagan)'));
  console.log('\nYangilansa:');
  console.log('  nom:        ' + desired.name);
  console.log('  qisqa:      ' + desired.short);
  console.log('  tavsif:     ' + desired.desc);

  if (process.argv.indexOf('--set') < 0) {
    console.log('\nO\'zgartirish uchun:  node tools/brand.js --set');
    console.log('(faqat bo\'sh joylarni to\'ldiradi; biror narsa band bo\'lsa tegmaydi — kuchga --force)');
    return;
  }
  const force = process.argv.indexOf('--force') >= 0;
  const jobs = [
    ['setMyName', { name: desired.name, language_code: '' }, curName && curName.name],
    ['setMyShortDescription', { short_description: desired.short, language_code: '' }, curShort && curShort.text],
    ['setMyDescription', { description: desired.desc, language_code: '' }, curDesc && curDesc.description],
  ];
  for (const [method, params, existing] of jobs) {
    if (existing && !force) { console.log(method + ' — allaqachon to\'ldirilgan, o\'tkazib yuborildi: «' + String(existing).slice(0, 40) + '»'); continue; }
    await api.notify(method, params);
    console.log(method + ' OK');
  }
  await api.notify('setMyCommands', {
    commands: [{ command: 'start', description: "Do'konni ochish" }],
    scope: { type: 'default' },
  });
  console.log('setMyCommands OK');
  console.log('\nQolgan bitta qadam (buni faqat siz qila olasiz):');
  console.log('  @BotFather → /setuserpic → botni tanlang → ' +
    path.relative(path.join(__dirname, '..', '..'), path.join(__dirname, '..', 'assets', 'bot-logo.png')).replace(/\\/g, '/') +
    ' rasmini yuboring.');
  console.log('  Username' + 'ni ham faqat BotFather o\'zgartiradi: /mybot → choose bot → Edit bot → Edit username.');
}

main().catch((e) => {
  console.log('XATO: ' + e.message);
  process.exit(1);
});
