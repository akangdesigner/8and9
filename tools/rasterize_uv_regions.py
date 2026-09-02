# 配 tools/dump_uv_regions.py 用——把它匯出的 tris.json 畫成兩張參考圖。
# 用法:python3 tools/rasterize_uv_regions.py tris.json <輸出目錄> [解析度,預設 1024]
#
# ⚠ V 座標翻轉的坑(2026-09-02,小胖那輪吃過一次虧,見 docs/DESIGN_NOTES.md
# 「小胖」那節「第四輪」的記錄):`dump_uv_regions.py` 讀的是 Blender **匯出
# 前**的內部 UV 資料(V=0 在下),但 Blender 的 glTF exporter 匯出時會把 V
# 整個翻過來(glTF 規格 V=0 在上)——Three.js 在瀏覽器裡讀到的、真正拿來
# 貼圖的 UV,是**匯出後**那份,跟這裡從 Blender 讀到的差一個上下顛倒。
# 這裡故意用 `t['v']*S`(不是 `(1-t['v'])*S`)先把這個落差扳正,讓畫出來的
# 參考圖跟瀏覽器裡實際看到的一致。**不要因為「看起來應該要 1-v 才對」就
# 手滑改回去**——這正是上一輪出包的原因,已經拿瀏覽器裡直接讀出來的
# UV(用同一個 canvas 光柵化手法)驗證過兩者現在對得上。
import json, sys
from PIL import Image, ImageDraw

tris_path = sys.argv[1]
out_dir = sys.argv[2]
S = int(sys.argv[3]) if len(sys.argv) > 3 else 1024

REGION_COLOR = {
    'face':  (255, 230, 50),
    'hand':  (255, 100, 180),
    'foot':  (80, 80, 80),
    'arm':   (50, 150, 255),
    'leg':   (50, 200, 80),
    'torso': (255, 80, 50),
}

with open(tris_path) as f:
    tris = json.load(f)

region_img = Image.new('RGB', (S, S), (20, 20, 20))
rdraw = ImageDraw.Draw(region_img)
wire_img = Image.new('RGB', (S, S), (255, 255, 255))
wdraw = ImageDraw.Draw(wire_img)

for tri in tris:
    pts = [(t['u'] * S, t['v'] * S) for t in tri]
    regions = [t['region'] for t in tri]
    dom = max(set(regions), key=regions.count)
    rdraw.polygon(pts, fill=REGION_COLOR[dom])
    wdraw.polygon(pts, outline=(0, 0, 0))

region_img.save(f'{out_dir}/uv_regions.png')
wire_img.save(f'{out_dir}/uv_template.png')
print('saved', region_img.size, wire_img.size)
