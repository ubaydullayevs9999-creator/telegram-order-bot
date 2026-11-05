const fs = require('fs');
const path = require('path');

const BASE = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';

let token = null;
let prefix = null;

function init(tokenValue) {
  if (!tokenValue) throw new Error('BOT_TOKEN empty');
  token = tokenValue.trim();
  prefix = BASE + '/bot' + token;
}

function mask(value) {
  if (!value) return '';
  return value.slice(0, 5) + '...' + value.slice(-2);
}

async function raw(method, body, asForm, timeoutMs) {
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 45000;
  const opts = asForm
    ? { method: 'POST', body, signal: AbortSignal.timeout(ms) }
    : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    };
  const res = await fetch(prefix + '/' + method, opts);
  let json;
  try {
    json = await res.json();
  } catch (e) {
    const err = new Error('telegram ' + method + ': javob JSON emas (HTTP ' + res.status + ')');
    err.code = res.status;
    throw err;
  }
  if (!json.ok) {
    const err = new Error('telegram ' + method + ': ' + (json.description || json.error_code));
    err.code = json.error_code;
    err.parameters = json.parameters;
    throw err;
  }
  return json.result;
}

async function call(method, params, timeoutMs) {
  try {
    return await raw(method, params, false, timeoutMs);
  } catch (e) {
    if (e.code === 429) {
      await sleep((e.parameters && e.parameters.retry_after || 3) * 1000);
      return raw(method, params, false, timeoutMs);
    }
    throw e;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function send(chatId, text, keyboard) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: keyboard,
  });
}

async function sendPhoto(chatId, filePath, caption, keyboard) {
  if (!filePath || !fs.existsSync(filePath)) return send(chatId, caption, keyboard);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  if (keyboard) form.append('reply_markup', JSON.stringify(keyboard));
  form.append('photo', new Blob([fs.readFileSync(filePath)], { type: 'image/png' }), path.basename(filePath));
  try {
    return await raw('sendPhoto', form, true);
  } catch (e) {
    if (e.code === 400) return send(chatId, caption, keyboard);
    throw e;
  }
}

async function edit(chatId, messageId, text, keyboard) {
  return call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

async function notify(method, params, timeoutMs) {
  return call(method, params, timeoutMs);
}

module.exports = { init, mask, send, sendPhoto, edit, notify, sleep };
