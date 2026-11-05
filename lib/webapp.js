const fs = require('fs');
const path = require('path');
const http = require('http');
const { PRODUCTS } = require('./catalog');

const WEB_DIR = path.join(__dirname, '..', 'web');
const IMG_DIR = path.join(__dirname, '..', 'assets', 'img');
const HTML = path.join(WEB_DIR, 'index.html');

const IMGS = {
  p1: 'tshirt.jpg', p2: 'jeans.jpg', p3: 'sweater.jpg',
  p4: 'socks.jpg', p5: 'jacket.jpg', p6: 'hoodie.jpg',
};

const MAX_BODY = 20 * 1024;
const IMG_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function catalog(cfg) {
  return {
    store: cfg.storeName,
    currency: "so'm",
    products: PRODUCTS.map((p) => ({
      id: p.id,
      img: '/img/' + (IMGS[p.id] || ''),
      price: p.price,
      uz: { name: p.uz.name, desc: p.uz.desc },
      ru: { name: p.ru.name, desc: p.ru.desc },
    })),
  };
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function file(res, filePath, type, maxAge) {
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': maxAge ? 'public, max-age=' + maxAge : 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too_big'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeImg(name) {
  const base = path.basename(String(name || ''));
  if (!/^[a-z0-9_-]{1,40}\.(png|jpe?g)$/i.test(base)) return null;
  const full = path.join(IMG_DIR, base);
  return fs.existsSync(full) ? full : null;
}

// deps: { cfg, bot, orders } — bot.orderFromWeb buyurtmani saqlaydi va
// sotuvchiga Telegram xabarini yuboradi.
function create(deps) {
  const cfg = deps.cfg;
  const bot = deps.bot;
  const hits = new Map();

  function throttle(ip) {
    const now = Date.now();
    const e = hits.get(ip) || { n: 0, t: now };
    if (now - e.t > 60000) { e.n = 0; e.t = now; }
    e.n += 1;
    hits.set(ip, e);
    return e.n <= 20;
  }

  const handler = async (req, res) => {
    const url = String(req.url || '/').split('?')[0];
    const ip = (req.socket.remoteAddress || '?').replace(/^.*:/, '');

    if (req.method === 'GET' && (url === '/' || url === '/health' || url === '/healthz')) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('order-bot ok\n');
    }
    if (req.method === 'GET' && (url === '/app' || url === '/app/index.html')) {
      if (!fs.existsSync(HTML)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('web/index.html topilmadi');
      }
      return file(res, HTML, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url === '/api/catalog') {
      return json(res, 200, catalog(cfg));
    }
    if (req.method === 'GET' && url.startsWith('/img/')) {
      const full = safeImg(url.slice(5));
      if (!full) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('no image');
      }
      return file(res, full, IMG_TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream', 86400);
    }
    if (req.method === 'POST' && url === '/api/order') {
      if (!throttle(ip)) return json(res, 429, { error: 'Juda ko\'p urinish — 1 daqiqa kuting.' });
      let payload;
      try {
        payload = JSON.parse(await readBody(req));
      } catch (e) {
        return json(res, 400, { error: e.message === 'too_big' ? 'Juda katta so\'rov' : 'JSON o\'qilmadi' });
      }
      try {
        const out = await bot.orderFromWeb(payload);
        if (out && out.error) return json(res, 400, { error: out.error });
        return json(res, 200, out);
      } catch (e) {
        console.log('POST /api/order xato: ' + e.message);
        return json(res, 500, { error: 'Server xatosi: buyurtma saqlanmadi' });
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  };

  const server = http.createServer((req, res) => {
    handler(req, res).catch((e) => {
      console.log('webapp: ' + (e && e.message));
      try { json(res, 500, { error: 'server' }); } catch (_) {}
    });
  });

  return { server, catalog, handler };
}

module.exports = { create, catalog, IMGS };
