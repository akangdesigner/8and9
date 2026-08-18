# 綠幕轉透明——跟 black-to-alpha.py 同一招(連通分量,只挖「連到畫面邊界」
# 的綠,不是整張圖裡所有偏綠的像素都挖掉),只是判斷「是不是綠幕」的規則
# 換成色度判斷(G 明顯比 R/B 都亮),不是純粹的暗度閾值。
#
#   python3 tools/green-to-alpha.py 原圖.png 輸出.png [margin,預設 1.15]
#
# margin 是「G 要比 R、B 亮多少倍才算綠幕」的寬鬆度,數字越大越保守(挖得
# 越少),人物身上如果有偏綠的東西(不常見)可以調大這個值避免被誤挖。

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label

src, dst = sys.argv[1], sys.argv[2]
margin = float(sys.argv[3]) if len(sys.argv) > 3 else 1.15

im = Image.open(src).convert("RGBA")
arr = np.array(im).astype(np.int32)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
green = (g > 60) & (g > r * margin) & (g > b * margin)

labels, n = label(green, structure=np.ones((3, 3)))  # 8-connectivity
border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
border_labels.discard(0)

bg_mask = np.isin(labels, list(border_labels))
arr = np.array(im)
arr[bg_mask, 3] = 0

# 邊緣去綠溢色(spill):留下來的像素如果 G 分量比 R/B 明顯偏高但沒有連到邊界
# (通常是頭髮/衣服邊緣被綠幕反光沾到一點綠),把 G 壓到 R/B 的較大值,避免
# 合成到新背景上時人物邊緣還留一圈綠邊。
spill = (~bg_mask) & (g > r) & (g > b)
arr[spill, 1] = np.maximum(arr[spill, 0], arr[spill, 2])

Image.fromarray(arr).save(dst)
print(f"{src} -> {dst}  ({len(border_labels)} 塊邊界連通綠塊挖成透明)")
