/* no-way-up — 把場景灰模輸出成 PNG
 *
 * 用途:產生給 ComfyUI 圖生圖當「構圖底」的圖。AI 只負責上質感,
 *      視角、站位、貨架擺哪全部由灰模鎖死,跨場景才會一致。
 *
 * 用法:
 *   node tools/render-scene.mjs                        # 預設輸出全部
 *   node tools/render-scene.mjs --scale 2 --no-people  # 放大兩倍、不畫人
 *
 * 沒有任何 npm 依賴 — PNG 編碼用 node 內建 zlib 手寫。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/* ---------------- 極簡 canvas:只實作 fillStyle / fillRect / globalAlpha ---------------- */
class MiniCtx {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.buf = Buffer.alloc(w * h * 4);
    for (let i = 3; i < this.buf.length; i += 4) this.buf[i] = 255;  // 不透明黑底
    this.globalAlpha = 1;
    this._c = [0, 0, 0, 255];
  }
  set fillStyle(v) { this._c = parseColor(v); }
  get fillStyle() { return this._c; }

  fillRect(x, y, w, h) {
    let x0 = Math.round(x), y0 = Math.round(y);
    let x1 = x0 + Math.round(w), y1 = y0 + Math.round(h);
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(this.w, x1); y1 = Math.min(this.h, y1);
    if (x1 <= x0 || y1 <= y0) return;

    const [r, g, b, a8] = this._c;
    const a = (a8 / 255) * this.globalAlpha;
    if (a <= 0) return;
    const inv = 1 - a;
    for (let py = y0; py < y1; py++) {
      let i = (py * this.w + x0) * 4;
      for (let pxx = x0; pxx < x1; pxx++, i += 4) {
        this.buf[i]     = (r * a + this.buf[i]     * inv + 0.5) | 0;
        this.buf[i + 1] = (g * a + this.buf[i + 1] * inv + 0.5) | 0;
        this.buf[i + 2] = (b * a + this.buf[i + 2] * inv + 0.5) | 0;
        this.buf[i + 3] = 255;
      }
    }
  }
  clearRect() { /* 灰模不需要 */ }
}

function parseColor(v) {
  if (Array.isArray(v)) return v;
  const s = String(v).trim();
  if (s[0] === '#') {
    const hex = s.slice(1);
    if (hex.length === 3)
      return [...hex].slice(0, 3).map(c => parseInt(c + c, 16)).concat(255);
    if (hex.length === 6 || hex.length === 8) {
      const n = [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16));
      return n.concat(hex.length === 8 ? parseInt(hex.substr(6, 2), 16) : 255);
    }
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map(t => parseFloat(t));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  throw new Error(`看不懂的顏色: ${v}`);
}

/* ---------------- PNG 編碼(zlib 是 node 內建) ---------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;  // 8-bit RGBA

  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;                                          // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* 最近鄰放大 — 保持邊緣銳利,不要模糊掉構圖 */
function upscale(buf, w, h, s) {
  if (s === 1) return { buf, w, h };
  const W = w * s, H = h * s, out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const sy = (y / s) | 0;
    for (let x = 0; x < W; x++) {
      const si = (sy * w + ((x / s) | 0)) * 4, di = (y * W + x) * 4;
      out[di] = buf[si]; out[di+1] = buf[si+1]; out[di+2] = buf[si+2]; out[di+3] = 255;
    }
  }
  return { buf: out, w: W, h: H };
}

/* ---------------- 載入場景模組(都是 IIFE,掛在 globalThis) ---------------- */
function load(file) {
  (0, eval)(fs.readFileSync(path.join(ROOT, 'prototypes', 'lib', file), 'utf8'));
}
load('scene-store-front.js');   // 平視(現行方向)
load('scene-home.js');          // 平視:家
load('scene-street.js');        // 平視:街(比畫面寬,橫向捲動)
load('scene-store.js');         // 3/4 斜俯視(已擱置,留著備查)

/* ---------------- 找桌面(OneDrive 會把它搬走,而且可能是中文名) ---------------- */
function desktopDir() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  for (const c of ['OneDrive/桌面', 'OneDrive/Desktop', 'Desktop', '桌面'])
    { const p = path.join(home, ...c.split('/')); if (fs.existsSync(p)) return p; }
  return null;
}

/* ---------------- CLI ---------------- */
const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

function write(file, png) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log(`  ✓ ${file}  (${(png.length / 1024).toFixed(0)} KB)`);
}

const scale = parseInt(val('--scale', '2'), 10);
const COMFY_OUT = 'C:\\comfyfile\\output';
const DESKTOP = desktopDir();

/* ===== 平視:乾淨背景(沒有人、沒有顆粒)—— 這張是拿去給 GPT 上質感的 ===== */
{
  const S = globalThis.SceneStoreFront;
  const draw = (opts, sc) => {
    const ctx = new MiniCtx(S.W, S.H);
    S.renderBackground(ctx, opts);
    const up = upscale(ctx.buf, S.W, S.H, sc);
    return encodePNG(up.w, up.h, up.buf);
  };

  console.log(`平視背景 ${S.W}×${S.H} ×${scale}`);
  const png = draw({ doorOpen: 0, taken: false }, scale);

  if (DESKTOP) write(path.join(DESKTOP, 'store-front-blockout.png'), png);
  else console.log('  ! 找不到桌面資料夾,跳過');

  write(path.join(ROOT, 'prototypes', 'out', 'store-front-blockout.png'), png);
}

/* ===== 家:客廳。沙發跟餐桌要一起畫進去 —— 這張是完整的一張,拿去上質感 ===== */
{
  const S = globalThis.SceneHome;
  const ctx = new MiniCtx(S.W, S.H);
  S.renderBackground(ctx, { sofaFront: true, tvOn: true, godLamp: true });
  const up = upscale(ctx.buf, S.W, S.H, scale);
  const png = encodePNG(up.w, up.h, up.buf);

  console.log(`家 ${S.W}×${S.H} ×${scale}`);
  if (DESKTOP) write(path.join(DESKTOP, 'home-blockout.png'), png);
  write(path.join(ROOT, 'prototypes', 'out', 'home-blockout.png'), png);
}

/* ===== 街:每條 1600 寬。太寬了不放大,拿去上質感時要分段餵 ===== */
{
  const S = globalThis.SceneStreet;
  for (const key of Object.keys(S.STREET_DATA)) {
    const st = S.makeStreet(S.STREET_DATA[key]);
    const ctx = new MiniCtx(st.W, st.H);
    st.renderBackground(ctx);
    st.pillars(ctx);
    const png = encodePNG(st.W, st.H, ctx.buf);

    console.log(`街「${st.name}」 ${st.W}×${st.H} ×1`);
    const name = `street-${key}-blockout.png`;
    if (DESKTOP) write(path.join(DESKTOP, name), png);
    write(path.join(ROOT, 'prototypes', 'out', name), png);
  }
}

/* ===== 斜俯視:已擱置,只在明確要求時才出 ===== */
if (flag('--topdown')) {
  const S = globalThis.SceneStore;
  const draw = (opts, sc) => {
    const ctx = new MiniCtx(S.W, S.H);
    S.render(ctx, opts);
    const up = upscale(ctx.buf, S.W, S.H, sc);
    return encodePNG(up.w, up.h, up.buf);
  };
  console.log(`斜俯視 ${S.W}×${S.H}`);
  if (fs.existsSync(COMFY_OUT)) {
    write(path.join(COMFY_OUT, 'blockout-store.png'), draw({ people: true, light: true }, 1));
    write(path.join(COMFY_OUT, 'blockout-store-empty.png'), draw({ people: false, light: true }, 1));
  }
  write(path.join(ROOT, 'prototypes', 'out', 'store-blockout.png'), draw({ people: true, light: true }, 2));
}

console.log('完成。');
