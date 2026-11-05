const { t } = require('./i18n');

// Bot endi faqat bitta narsa qiladi: salom berish va mini-ilovani ochish
// tugmasini ko'rsatish. Shuning uchun bu faylda bitta klaviatura qoldi.
// WEB_APP_URL bo'sh bo'lsa tugma yo'ladi (Telegram https talab qiladi).
function appKb(lang, url) {
  if (!url) return undefined;
  return { inline_keyboard: [[{ text: t(lang, 'b_app'), web_app: { url } }]] };
}

module.exports = { appKb };
