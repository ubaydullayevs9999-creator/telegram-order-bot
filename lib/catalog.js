const path = require('path');

const IMG = (f) => path.join(__dirname, '..', 'assets', 'img', f);

// Kiyim-do'kon katalogi: faqat kiyim. Rasm fayllari haqiqiy fotosurat
// (manbalar: assets/img/CREDITS.txt). Mijozga sotilganda shu ro'yxat
// va rasm fayllari almashtiriladi — narxlar so'mda.
const PRODUCTS = [
  { id: 'p1', img: IMG('tshirt.jpg'), price: 85000,
    uz: { name: 'Futbolka (pamuk)', desc: '100% paxta, oq rang, S-XL o\'lchamlar' },
    ru: { name: 'Футболка (хлопок)', desc: '100% хлопок, белый цвет, размеры S-XL' } },
  { id: 'p2', img: IMG('jeans.jpg'), price: 220000,
    uz: { name: 'Jinsi shim', desc: 'Klassik kesim, ko\'k, 42-52 o\'lcham' },
    ru: { name: 'Джинсы', desc: 'Классический крой, синий, размер 42-52' } },
  { id: 'p3', img: IMG('sweater.jpg'), price: 195000,
    uz: { name: 'Kofta (sviter)', desc: 'Yukma mato, qish uchun, S-XL' },
    ru: { name: 'Свитер / кофта', desc: 'Плотная вязка, на зиму, S-XL' } },
  { id: 'p4', img: IMG('socks.jpg'), price: 35000,
    uz: { name: 'Paypoq (3 juft)', desc: 'Paxta aralashmasi, turli ranglar' },
    ru: { name: 'Носки (3 пары)', desc: 'Хлопковая смесь, разные цвета' } },
  { id: 'p5', img: IMG('jacket.jpg'), price: 320000,
    uz: { name: 'Kurtka', desc: 'Yengil qishki, M-XXL o\'lcham' },
    ru: { name: 'Куртка', desc: 'Лёгкая зимняя, размер M-XXL' } },
  { id: 'p6', img: IMG('hoodie.jpg'), price: 180000,
    uz: { name: 'Xudli (hoodie)', desc: 'Ichki moli bilan, pastel ranglar, S-XL' },
    ru: { name: 'Худи', desc: 'С подкладкой, пастельные тона, S-XL' } },
];

const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

function money(n, lang) {
  const s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return lang === 'ru' ? s + ' сом' : s + " so'm";
}

module.exports = { PRODUCTS, BY_ID, money };
