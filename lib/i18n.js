const STRINGS = {
  uz: {
    welcome:
      '<b>{store}</b>\n\n' +
      '\u{1F44B} Hush kelibsiz!\n\n' +
      'Do\'konimiz Telegram ichida ochiladi: rasmlar bilan tanlang, savatga soling, ' +
      'buyurtmangizni bir tugma bilan yuboring.\n\n' +
      '\u{1F4B0} To\'lov: yetkazib berishda yoki kartaga o\'tkazib.\n' +
      '\u{1F69A} Yetkazib berish: Tashkent bo\'ylab 1-2 kun.',
    b_app: '\u{1F6CD}\uFE0F Ilovani ochish',
    app_off:
      '\u26A0\uFE0F Ilova hozircha yopiq (hosting ulanmagan).\n' +
      'Buyurtma uchun sotuvchini telefon orqali chaqiring.',
    done: '\u2705 Buyurtma qabul qilindi.\n\nRaqami: <b>{oid}</b>\nSumma: <b>{total}</b>\n\nSotuvchi siz bilan bog\'lanadi.',
    admin_notify: '<b>\u{1F6E3}\uFE0F Yangi buyurtma {oid}</b>\n\n{text}\n\n<b>{total_label}: {total}</b>\n\u{1F4F1} Mini-ilovadan',
  },
  ru: {
    welcome:
      '<b>{store}</b>\n\n' +
      '\u{1F44B} Добро пожаловать!\n\n' +
      'Наш магазин открывается прямо в Telegram: выбирайте по фото, кладите в корзину ' +
      'и отправляйте заказ одной кнопкой.\n\n' +
      '\u{1F4B0} Оплата: при доставке или переводом на карту.\n' +
      '\u{1F69A} Доставка по Ташкенту: 1-2 дня.',
    b_app: '\u{1F6CD}\uFE0F Открыть приложение',
    app_off: '\u26A0\uFE0F Приложение пока закрыто (хостинг не подключён).\nПозвоните продавцу, чтобы оформить заказ.',
    done: '\u2705 Заказ принят.\n\nНомер: <b>{oid}</b>\nСумма: <b>{total}</b>\n\nПродавец с вами свяжется.',
    admin_notify: '<b>\u{1F6E3}\uFE0F Новый заказ {oid}</b>\n\n{text}\n\n<b>{total_label}: {total}</b>\n\u{1F4F1} Из мини-приложения',
  },
};

const LABELS = {
  uz: { items: 'Tarkibi', name: 'Ism', tel: 'Telefon', addr: 'Manzil', total: 'Yekun', noaddr: 'manzil kiritilmagan' },
  ru: { items: 'Состав', name: 'Имя', tel: 'Телефон', addr: 'Адрес', total: 'Итого', noaddr: 'адрес не указан' },
};

function t(lang, key, vars) {
  const pack = STRINGS[lang] || STRINGS.uz;
  let s = pack[key] !== undefined ? pack[key] : (STRINGS.uz[key] || key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{'+k+'}', String(v));
  }
  return s;
}

module.exports = { t, LABELS, STRINGS };
