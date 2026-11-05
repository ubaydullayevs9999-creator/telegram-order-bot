// Bot logotipi — oq-qora, minimalizm. 512x512 PNG, 0 ta npm paketi.
// Ishlatish: @BotFather -> /setuserpic -> bot -> assets/bot-logo.png
// Variantlar: qora (asosiy), oq (teskari), ramkali, shaffof.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 512;
const SS = 4;                 // supersample: 2048x2048 chizib, 4x4 o'rtacha bilan kichraytirish
const W = SIZE * SS;

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// colorType 2 = RGB, 6 = RGBA
function png(pixels, w, h, withAlpha) {
  const ch = withAlpha ? 4 : 3;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = withAlpha ? 6 : 2;
  const row = 1 + w * ch;
  const raw = Buffer.alloc(h * row);
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0;
    pixels.copy(raw, y * row + 1, y * w * ch, (y + 1) * w * ch);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const BLACK = [0x00, 0x00, 0x00];
const WHITE = [0xff, 0xff, 0xff];

function roundRectDist(x, y, ccx, cy, hw, hh, r) {
  const dx = Math.abs(x - ccx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r; // <0 => ichida
}

function segDist(x, y, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp01(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1));
  return Math.hypot(x - (ax + t * vx), y - (ay + t * vy));
}

// ---- kofta (hanger): minimal, yupqa chiziq, ko'p bo'sh joy ----
const CX = W / 2;
const LW = W * 0.030;             // chiziq qalinligi
const BAR_Y = W * 0.605;          // yelka chizig'i
const APEX = [CX, W * 0.405];     // uchligi
const LEFT = [W * 0.215, BAR_Y];
const RIGHT = [W - W * 0.215, BAR_Y];
const HOOK_R = W * 0.068;
const HOOK_CY = W * 0.305;

function inkDist(x, y) {
  // ilgak: ochiq halqa (pastki chap teref ochiq)
  const dist = Math.hypot(x - CX, y - HOOK_CY);
  const ang = Math.atan2(y - HOOK_CY, x - CX);          // -PI..PI
  let d = Math.abs(dist - HOOK_R) - LW / 2;
  const inArc = ang > -2.30 && ang < 0.55;
  if (!inArc) d = Infinity;

  // bo'yin: ilgakdan uchligigacha tik chiziq
  if (Math.abs(x - CX) < LW / 2 && y >= HOOK_CY && y <= APEX[1] + LW * 0.45) d = Math.min(d, -LW / 2);

  // yelka: uchli uchburchak + gorizontal chiziq
  let s = segDist(x, y, LEFT[0], LEFT[1], APEX[0], APEX[1]) - LW / 2;
  s = Math.min(s, segDist(x, y, APEX[0], APEX[1], RIGHT[0], RIGHT[1]) - LW / 2);
  s = Math.min(s, segDist(x, y, LEFT[0], LEFT[1], RIGHT[0], RIGHT[1]) - LW / 2);
  return Math.min(d, s);
}

const EDGE = LW * 0.42;           // yumshatish (antialias) kengligi
const cover = (d) => clamp01(0.5 - d / EDGE);

const R = W * 0.205;              // dumaloq burchak
const HW = W / 2 - W * 0.015;
const HH = W / 2 - W * 0.015;

const VARIANTS = [
  { file: 'bot-logo.png', alpha: false, shape: 'square', bg: BLACK, ink: WHITE, outside: WHITE,
    note: 'asosiy: qora kvadrat + oq kofta' },
  { file: 'bot-logo-light.png', alpha: false, shape: 'square', bg: WHITE, ink: BLACK, outside: BLACK,
    note: 'teskari: oq kvadrat + qora kofta' },
  { file: 'bot-logo-frame.png', alpha: false, shape: 'frame', bg: WHITE, ink: BLACK, outside: WHITE,
    note: 'ramkali: oq fon + ingichka qora ramka' },
  { file: 'bot-logo-transparent.png', alpha: true, shape: 'none', bg: BLACK, ink: BLACK, outside: BLACK,
    note: 'shaffof: faqat qora belgi' },
];

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

for (const v of VARIANTS) {
  const ch = v.alpha ? 4 : 3;
  const buf = Buffer.alloc(SIZE * SIZE * ch);
  const total = SS * SS;

  for (let oy = 0; oy < SIZE; oy++) {
    for (let ox = 0; ox < SIZE; ox++) {
      let r = 0, g = 0, b = 0, aSum = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ox * SS + sx, y = oy * SS + sy;

          let inShape = true;
          let d = inkDist(x, y);
          if (v.shape === 'square' || v.shape === 'none') {
            inShape = roundRectDist(x, y, CX, W / 2, HW, HH, R) <= 0;
          } else if (v.shape === 'frame') {
            const dOut = roundRectDist(x, y, CX, W / 2, HW, HH, R);
            const dIn = roundRectDist(x, y, CX, W / 2, HW - W * 0.075, HH - W * 0.075, R * 0.62);
            inShape = dOut <= 0;
            // bitta ingichka ramka chizig'i (ichki chegaradan)
            d = Math.min(d, Math.abs(dIn) - W * 0.0075);
          }

          if (!inShape) {
            if (v.alpha) { aSum += 0; r += v.outside[0]; g += v.outside[1]; b += v.outside[2]; }
            else { r += v.outside[0]; g += v.outside[1]; b += v.outside[2]; }
            continue;
          }

          const c = cover(d);
          r += lerp(v.bg[0], v.ink[0], c);
          g += lerp(v.bg[1], v.ink[1], c);
          b += lerp(v.bg[2], v.ink[2], c);
          if (v.alpha) aSum += c;
        }
      }

      const o = (oy * SIZE + ox) * ch;
      buf[o] = Math.round(r / total);
      buf[o + 1] = Math.round(g / total);
      buf[o + 2] = Math.round(b / total);
      if (v.alpha) buf[o + 3] = Math.round(clamp01(aSum / total) * 255);
    }
  }

  const target = path.join(outDir, v.file);
  fs.writeFileSync(target, png(buf, SIZE, SIZE, v.alpha));
  console.log((v.file + ' ').padEnd(27) + (v.alpha ? 'RGBA ' : 'RGB  ') + SIZE + 'x' + SIZE + '  ' + v.note);
}
