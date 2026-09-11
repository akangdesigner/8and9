# 把 dump_uv_regions.py(fine 模式)吐出來的 tris.json 直接畫成可以貼回模型的
# 身體貼圖——不經過生圖工具,程式按部位填色(2026-09-11,教官 Lewis 那輪新增)。
# Lewis 這種「皮膚+衣服黏在同一塊材質」的 Mixamo 角色,衣服顏色沒辦法用
# opts.hood/pants 那套材質換色,只能靠 UV 貼圖(見 assets/models/README.md
# 「單一 mesh 但沒有獨立上衣」)。這裡把每個 UV 三角形按它的骨骼部位填一個
# 純色,再貼回去(buildNPC opts.texRaw)。
#
# 用法:python3 tools/paint_uv_regions.py tris.json 輸出.png '{"shirt":"#8f9b90",...}' [解析度]
#   顏色表的 key 是部位:face/hand/forearm/arm/torso/hips/leg/foot,沒給的用 skin。
#   V 座標的翻轉問題跟 rasterize_uv_regions.py 同一個處理(t['v']*S 不是 1-v),
#   理由見那支腳本檔頭。
import json, sys
from PIL import Image, ImageDraw

tris_path, out_png, colors_json = sys.argv[1], sys.argv[2], sys.argv[3]
S = int(sys.argv[4]) if len(sys.argv) > 4 else 1024
colors = json.loads(colors_json)
skin = colors.get('skin', '#c9a077')

def col(region):
    return colors.get(region, skin)

with open(tris_path) as f:
    tris = json.load(f)

img = Image.new('RGB', (S, S), skin)
d = ImageDraw.Draw(img)
for tri in tris:
    pts = [(t['u'] * S, t['v'] * S) for t in tri]
    regions = [t['region'] for t in tri]
    dom = max(set(regions), key=regions.count)
    c = col(dom)
    d.polygon(pts, fill=c, outline=c)   # outline 同色,把三角形之間的縫補掉
img.save(out_png)
print('saved', out_png, img.size)
