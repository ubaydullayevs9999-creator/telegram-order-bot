const fs = require('fs');
const path = require('path');

const STATUSES = ['new', 'accepted', 'shipped', 'done', 'cancelled'];

function create(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'orders.json');
  let db = { seq: 0, meta: {}, orders: [] };

  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed.orders)) {
        db = { seq: parsed.seq || 0, meta: parsed.meta || {}, orders: parsed.orders };
      }
    } catch (e) {
      fs.renameSync(file, file + '.corrupt-' + Date.now());
    }
  }

  function flush() {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, file);
  }

  return {
    nextId() {
      db.seq += 1;
      flush();
      return 'B-' + String(db.seq).padStart(4, '0');
    },
    add(order) {
      db.orders.push(order);
      flush();
      return order;
    },
    all() {
      return db.orders.slice();
    },
    latest(n) {
      return db.orders.slice(-n).reverse();
    },
    forChat(chatId, n) {
      return db.orders.filter((o) => String(o.chatId) === String(chatId)).slice(-(n || 5)).reverse();
    },
    find(id) {
      return db.orders.find((o) => o.id.toUpperCase() === String(id).toUpperCase());
    },
    setStatus(id, status) {
      const o = db.orders.find((x) => x.id === id);
      if (!o || !STATUSES.includes(status)) return null;
      o.status = status;
      o.updatedAt = new Date().toISOString();
      flush();
      return o;
    },
    counts() {
      const c = {};
      for (const s of STATUSES) c[s] = 0;
      for (const o of db.orders) c[o.status] = (c[o.status] || 0) + 1;
      return c;
    },
    metaAdmin() {
      return db.meta && db.meta.adminChatId ? String(db.meta.adminChatId) : null;
    },
    setMetaAdmin(chatId) {
      db.meta = db.meta || {};
      db.meta.adminChatId = String(chatId);
      flush();
      return db.meta.adminChatId;
    },
    file,
  };
}

module.exports = { create, STATUSES };
