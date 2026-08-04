/* no-way-up — 拿灰模去 ComfyUI 上質感
 *
 * 為什麼不用 MCP 的 generate_image:
 *   那邊要把「前端 workflow 格式」轉成「API 格式」,LoadImageOutput 這類節點會轉失敗。
 *   直接打 ComfyUI 的 HTTP API 反而單純,而且 denoise 這種關鍵參數才調得到。
 *
 * 用法:
 *   node tools/comfy-img2img.mjs
 *   node tools/comfy-img2img.mjs --denoise 0.7 --model dreamshaper_8.safetensors
 *   node tools/comfy-img2img.mjs --image blockout-store-empty.png --tag empty
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://127.0.0.1:8000';
const COMFY = 'C:\\comfyfile';

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const IMAGE    = val('--image', 'blockout-store.png');
const MODEL    = val('--model', 'majicmixRealistic_v7.safetensors');
const DENOISE  = parseFloat(val('--denoise', '0.55'));
const STEPS    = parseInt(val('--steps', '28'), 10);
const CFG      = parseFloat(val('--cfg', '7.5'));
const SEED     = parseInt(val('--seed', String(Math.floor(Math.random() * 1e15))), 10);
const TAG      = val('--tag', 'store');

const POSITIVE = val('--prompt',
  'interior of a Taiwanese convenience store at night, top down three quarter view, ' +
  'harsh fluorescent ceiling lighting, glossy tiled floor with wet reflections, ' +
  'shelves stocked with packaged goods, hot food display case with bento boxes, ' +
  'checkout counter, drink fridges glowing along the back wall, ' +
  'muted desaturated color palette, gritty realistic materials, dirty worn surfaces, ' +
  'moody oppressive atmosphere, cinematic lighting, detailed textures, game background art');

const NEGATIVE = val('--negative',
  'blurry, lowres, text, watermark, signature, deformed, extra limbs, ' +
  'bright saturated colors, cheerful, cartoon, flat lighting, oversaturated, jpeg artifacts');

/* 灰模是 render-scene.mjs 寫進 output 的,LoadImage 讀的是 input,所以先搬過去 */
const src = path.join(COMFY, 'output', IMAGE);
if (!fs.existsSync(src)) {
  console.error(`找不到 ${src}\n先跑: node tools/render-scene.mjs`);
  process.exit(1);
}
fs.copyFileSync(src, path.join(COMFY, 'input', IMAGE));

/* ComfyUI API 格式 — 直接手寫,不經過前端格式轉換 */
const graph = {
  '4':  { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: MODEL } },
  '11': { class_type: 'LoadImage',              inputs: { image: IMAGE, upload: 'image' } },
  '12': { class_type: 'VAEEncode',              inputs: { pixels: ['11', 0], vae: ['4', 2] } },
  '6':  { class_type: 'CLIPTextEncode',         inputs: { text: POSITIVE, clip: ['4', 1] } },
  '7':  { class_type: 'CLIPTextEncode',         inputs: { text: NEGATIVE, clip: ['4', 1] } },
  '3':  { class_type: 'KSampler', inputs: {
            seed: SEED, steps: STEPS, cfg: CFG,
            sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: DENOISE,
            model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['12', 0] } },
  '8':  { class_type: 'VAEDecode',  inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9':  { class_type: 'SaveImage',  inputs: { filename_prefix: `nwu-${TAG}`, images: ['8', 0] } }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log(`模型 ${MODEL}`);
console.log(`denoise ${DENOISE} / steps ${STEPS} / cfg ${CFG} / seed ${SEED}`);
console.log(`輸入 ${IMAGE}\n`);

const post = await fetch(`${API}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: graph, client_id: 'no-way-up' })
});

if (!post.ok) {
  console.error('提交失敗:', post.status, await post.text());
  process.exit(1);
}
const { prompt_id } = await post.json();
console.log(`已排入佇列 ${prompt_id}`);

let waited = 0;
for (;;) {
  await sleep(2500); waited += 2.5;
  const hist = await (await fetch(`${API}/history/${prompt_id}`)).json();
  const rec = hist[prompt_id];
  if (rec) {
    if (rec.status?.status_str === 'error') {
      console.error('\n執行失敗:');
      for (const m of rec.status.messages || [])
        if (m[0] === 'execution_error') console.error(JSON.stringify(m[1], null, 2).slice(0, 1200));
      process.exit(1);
    }
    const imgs = Object.values(rec.outputs || {}).flatMap(o => o.images || []);
    if (imgs.length) {
      console.log(`\n完成（${waited.toFixed(0)}s）`);
      for (const im of imgs)
        console.log(path.join(COMFY, im.type === 'output' ? 'output' : im.type, im.subfolder || '', im.filename));
      break;
    }
  }
  if (waited % 20 < 2.5) process.stdout.write(`  ...${waited.toFixed(0)}s\n`);
  if (waited > 900) { console.error('\n超過 15 分鐘,放棄'); process.exit(1); }
}
