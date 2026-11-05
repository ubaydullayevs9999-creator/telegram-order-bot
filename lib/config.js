const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = process.env.ENV_FILE || path.join(ROOT, '.env');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function ids(raw) {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^-?\d{4,}$/.test(s));
}

function load() {
  if (fs.existsSync(ENV_FILE)) {
    for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(ENV_FILE, 'utf8')))) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
  const token = String(process.env.BOT_TOKEN || '').trim();
  if (!/^\d{6,}:[\w-]{20,}$/.test(token)) {
    const e = new Error(
      "BOT_TOKEN topilmadi yoki formati noto'g'ri.\n" +
      "1) @BotFather'ga /newbot yozib token oling.\n" +
      '2) .env.example faylini .env ga nusxalang.\n' +
      '3) .env ichida BOT_TOKEN=1234567:AAQ... qiling.\n' +
      'Token hech qachon kodga yoki chatga yozilmaydi.'
    );
    e.userFacing = true;
    throw e;
  }
  let webAppUrl = String(process.env.WEB_APP_URL || '').trim().replace(/\/+$/, '');
  if (webAppUrl && !/^https:\/\/[^\s]+$/i.test(webAppUrl)) {
    console.log('WEB_APP_URL e\'tib olinmadi (https bo\'lishi kerak): ' + webAppUrl.slice(0, 60));
    webAppUrl = '';
  }
  return {
    token,
    adminChatIds: ids(process.env.ADMIN_CHAT_ID || process.env.ADMIN_CHAT_IDS),
    storeName: String(process.env.STORE_NAME || "Kiyim do'koni").trim(),
    dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
    webAppUrl,
  };
}

module.exports = { load, ROOT, ENV_FILE };
