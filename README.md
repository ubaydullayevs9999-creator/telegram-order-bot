# Telegram mini-ilova do'koni — demo

Xizmat narxining mazmuni: **mijoz Telegram'da bot'ni ochadi → "Ilovani ochish"
tugmasini bosadi → Telegram ichida rasmli do'kon sahifasi ochiladi → savatga
soladi → "Buyurtma berish" bosadi → sotuvchining Telegram'iga bir zumda xabar
tushadi.** Bot'ning o'zi suhbat qilmaydi — u faqat eshik.

**0 ta npm paketi.** Faqat Node.js'ning o'z `fetch`'i. `npm install` shart emas.

---

## 1. Bot qismi (yupqa eshik)

| Mijoz nima qiladi | Bot nima javob beradi |
|---|---|
| `/start` bosadi | Bitta salom xabari: do'kon nomi + "🛍️ Ilovani ochish" tugmasi |
| Oddiy yozuv yoki boshqa buyruq yozadi | Xuddi shu salom xabari (suhbat, menyu, ro'yxat yo'q) |
| "Ilovani ochish" | Telegram ichida mini-ilova ochiladi |

Sotuvchi uchun buyruqlar va holat tugmalari **ketib qoldi**: buyurtma matnini
oladi, xolos. Javobni o'zi yozadi yoki qo'ng'iroq qiladi.

## 1b. Mini-ilova (`web/index.html`)

| Bosqich | Nima bor |
|---|---|
| Kirish ekrani | **Ism + telefon** so'raladi (bir marta). Raqam `+998…` bo'lib saqlanadi va keyingi tashrifda qayta so'ralmaydi |
| Katalog | 6 ta kiyim — haqiqiy fotolar, narx so'mda, O'zb/Rus tugmasi |
| Savat | `＋` / `－`, jami summa, pastda yopishib turadigan "Buyurtma berish" paneli |
| Buyurtma formasi | Ism + telefon (avtomatik to'ldirilgan) + **«↺ Saqlangan ma'lumotni qo'yish»** tugmasi — boshqa kishi nomidan buyurtma qilsa, raqamni o'zi yozadi. Manzil **ixtiyoriy** |
| Tasdiq | «Buyurtma raqami: B-0001» + yekun summa. Savat tozalanadi |
| Sotuvchi | Telegram'ga matn keladi: tarkibi, yekun, ism, telefon, manzil. Tugmalar yo'q |
| Mavzu | Telegram'ning qorong'i/yorug' rejimiga o'zi moslashadi, tebranish (haptic) effekti bor |

Xavfsizlik: yekun summa, soni va mahsulotlar **serverda qayta hisoblanadi** —
sahifani o'zgartirib arzon narx yuborib bo'lmaydi.

## 2. Sotuvchini aniqlash (`/setadmin` shart emas)

`ADMIN_CHAT_ID` `.env` da to'ldirilgan bo'lsa — shu kishi buyurtmalarni oladi.
Bo'sh bo'lsa, **botga birinchi bo'lib `/start` yozgan kishi** avtomatik sotuvchi
bo'lib `data/orders.json` ichidagi `meta.adminChatId` ga yoziladi (bir marta).
Keyin istalgan mijoz `/start` yozsa ham sotuvchi bo'la olmaydi.

---

## 3. Ishga tushirish — lokal (eng tez yo'l)

### 3.1 Token olish (Sardor o'zi qiladi, 1 daqiqa)
1. Telegram'da **@BotFather** ni oching.
2. `/newbot` yozing → nom (masalan `Kiyim do'koni`) → username (`kiyim_demo_bot`).
3. BotFather bir qator **token** beradi: `1234567890:AAHxxxxxxxx-xxxxxxxxxxxxx`.
4. Token'ni **hech kimga yubormang** — chatga, rasmga, screenshot'ga yozmang.

### 3.2 Sozlash
```
cd C:\Users\lenovo\Documents\Qoder\2026-11-05\53d3fc2d\bot
copy .env.example .env
notepad .env
```
```
BOT_TOKEN=shu_yerga_token
ADMIN_CHAT_ID=hozircha_bo_sh_qoldiring
STORE_NAME=Kiyim do'koni
WEB_APP_URL=
PORT=
```

### 3.3 Ishga tushirish (mini-ilova bilan)
```
set PORT=8130 && ..\runtime\node-v24.22.2-win-x64\node.exe index.js
```
Konsolda:
```
Mini-ilova: http://localhost:8130/app
  telefonfrom ochish (bir xil Wi-Fi): http://192.168.1.33:8130/app
Bot: @sizning_botingiz | token: 12345...Xy (kodga yozilmagan)
 polling boshlandi...
```
Telefon brauzerida `http://192.168.1.33:8130/app` ni oching (laptop bilan **bir
xil Wi-Fi** da bo'lsa yetarli) — savat, buyurtma, sotuvchiga xabar haqiqatan ishlaydi.

### 3.4 Botning nomini/tavsifini to'ldirish (5 soniya)
```
..\runtime\node-v24.22.2-win-x64\node.exe tools\brand.js --set
```
Nom, qisqa tavsif, to'liq tavsif va `/start` ro'yxatidagi buyruq matnini API
orqali yozib qo'yadi (band bo'lgan joyga tegmaydi). **Rasm (logo) API orqali
o'rnatilmaydi** — uni faqat @BotFather qo'yadi:
`/setuserpic` → botni tanlang → `bot/assets/bot-logo.png` faylini yuboring.

Logotiplar (oq-qora, minimalizm — `node tools\make-logo.js` bilan qayta chiziladi):

| Fayl | Qayerda |
|---|---|
| `assets/bot-logo.png` | **asosiy** — qora kvadrat + oq kofta (BotFather uchun shu) |
| `assets/bot-logo-light.png` | teskari — oq kvadrat + qora kofta (yorug' interfeys) |
| `assets/bot-logo-frame.png` | ramkali — oq fon + ingichka ramka (sayt, hujjat, presentatsiya) |
| `assets/bot-logo-transparent.png` | shaffof — faqat belgi (har qanday fon ustiga) |

### 3.5 To'xtatish
Konsolda `Ctrl + C` yoki oyna yopilsa bo'ldi. Buyurtmalar `data/orders.json` da qoladi.

---

## 4. Hosting — "Ilovani ochish" tugmasi uchun HTTPS shart

Telegram `web_app` tugmasini **faqat `https://`** manzil bilan qo'yadi. `WEB_APP_URL`
bo'sh bo'lsa bot salomni tugmasiz yuboradi (hech narsa buzilmaydi).
Local Wi-Fi manzili (`http://192.168.1.x`) Telegram tugmasi uchun yaramaydi —
uni faqat telefon brauzerida ochib ko'rsatasiz.

| Yo'l | Qanday | Kamchiligi |
|---|---|---|
| **Render.com (bepul)** | repo → New Web Service → start **`node web-server.js`**, env: `BOT_TOKEN`, `ADMIN_CHAT_ID`, `STORE_NAME` (`PORT` ni o'zi beradi). Keyin `WEB_APP_URL=https://<nom>.onrender.com/app` | Free rejada 15 daqiqada uxladi, birinchi ochilish 30-50 sek sekin |
| **Railway.app** | bir xil, `$5` bepul kredit | hisob kerak |
| **VPS (~150 000 so'm/oy)** | `pm2 start index.js --name dokon` + domen + Caddy/certbot | mijozga sotganda eng to'g'ri yo'l — manzil siznikida bo'ladi |

**Muhim:** hostingga **faqat `web-server.js`** qo'yiladi (mini-ilova + buyurtma
qabuli). Bot polling'ini (`index.js`) kompyuterda qoldirasiz — bepul Render
15 daqiqada uxlab, polling'ni o'ldiradi. `web-server.js` `getUpdates` ni
umumiy chaqirmaydi (testda isbotlangan).

To'liq qadam-baqadam: `docs/render-deploy.md` (loyiha papkasida).

`.env` ga `WEB_APP_URL` ni to'ldiring va qayta ishga tushiring — `/start` ostida
🛍️ tugma paydo bo'ladi.

---

## 5. Pull-back (orqaga qaytarish)

| Vaziyat | Qaytarish |
|---|---|
| Kodni buzib qo'ydingiz | `git checkout -- .` yoki `git stash` |
| Buyurtmalar fayli buzildi | `data/orders.json` avtomatik `orders.json.corrupt-<vaqt>` ga ko'chiriladi, bot bo'sh rejimda davom etadi |
| Ikkinchi mijoz kerak | `.env` dagi `STORE_NAME` va `BOT_TOKEN` ni almashtiring — 1 daqiqada yangi do'kon |
| Token ochiq qolib ketdi | BotFather → `/revoke` → yangi token → faqat `.env` ga |

**Har mijozdan oldin tekshiruv (jami 139 ta):**
```
..\runtime\node-v24.22.2-win-x64\node.exe tools\simulate.js       # 39 ta mantiq
..\runtime\node-v24.22.2-win-x64\node.exe tools\webapp-test.js    # 50 ta mini-ilova
..\runtime\node-v24.22.2-win-x64\node.exe tools\smoke.js           # 25 ta real jarayon
..\runtime\node-v24.22.2-win-x64\node.exe tools\hosting-test.js    # 25 ta hosting rejimi
```

---

## 6. Xavfsizlik qoidalari (bu loyihada bajarilgan)

1. Token **faqat** `.env` (lokal) yoki hosting env'ida. Kod, README, e'lon va
   frontend'da token yo'q — testlar buni avtomatik tekshiradi (`web/index.html`
   ichida `BOT_TOKEN` / `ADMIN_CHAT_ID` izlari ham yo'q).
2. `.gitignore` `.env` va `data/` ni tashqarida qoldiradi.
3. Bot konsolda token'ni maskalaydi: `token: 12345...Xy` (birinchi 5 + oxirgi 2 belgi).
4. `/img/` yo'li `path.basename` oq ro'yxati bilan himoyalangan — `..%2f.env` kabi
   urinishlar 404 qaytadi.
5. Bir IP dan daqiqasiga 20 ta buyurtma, so'rov tanasi 20 KB dan oshmaydi.
6. Demo'da to'lov olinmaydi (na Pulxo, na Click) — faqat buyurtma yig'ish.

## 7. Fayl tuzilishi

```
bot/
  index.js              kirish: polling + mini-ilova serveri (PORT bo'lsa)
  web-server.js         kirish: FAQAT mini-ilova serveri (Render/Railway uchun)
  start.cmd             ikki marta bosib ishga tushirish
  .env.example          nusxalab .env qiling
  lib/
    config.js           .env o'qish, token tekshirish, WEB_APP_URL
    api.js              Telegram API (fetch), rasm multipart, 429 retry, timeout
    bot.js              salom + buyurtmani qabul qilish (suhbat yo'q), telefon normalash
    catalog.js          6 ta kiyim (UZ/RU, narx so'm, .jpg)
    i18n.js             matnlar UZ + RU
    keyboards.js        "Ilovani ochish" (web_app) tugmasi
    store.js            orders.json (atomik yozish, buzilgan fayldan qaytish)
    webapp.js           mini-ilova serveri: /app, /api/catalog, /api/order, /img
  web/index.html        mini-ilova sahifasi (bitta fayl; tashqi CDN yo'q)
  assets/
    bot-logo.png        asosiy logo: qora kvadrat + oq kofta (BotFather /setuserpic)
    bot-logo-light.png  teskari variant (oq kvadrat + qora kofta)
    bot-logo-frame.png  ramkali variant (sayt/hujjat uchun)
    bot-logo-transparent.png shaffof variant (har qanday fon ustiga)
    img/*.jpg           haqiqiy kiyim fotolari (Pexels, bepul litsenziya)
    img/CREDITS.txt     rasm manbalari + o'zingizniki bilan almashtirish tarzi
  tools/
    make-logo.js        logotiplarni qayta chizish (0 paket, PNG'ni o'zi yozadi)
    brand.js            bot nomi/tavsifi/commands ni API orqali sozlash
    simulate.js         39 ta mantiq tekshiruvi (soxta Telegram bilan)
    webapp-test.js      50 ta mini-ilova tekshiruvi (server + API + sahifa)
    smoke.js            25 ta real jarayon tekshiruvi (index.js ni chindan ochadi)
    hosting-test.js     25 ta hosting tekshiruvi (web-server.js, polling yo'qligi)
```
