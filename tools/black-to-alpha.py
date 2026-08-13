# 黑底轉透明——垃圾/招牌/公園小物這些貼圖是純黑底拍的物件照片,這個把「連到
# 畫面邊界的那塊黑」轉成 alpha=0,疊在地上或立牌的 decal 才不會帶一整片黑方塊。
# 跟 assets/tex/PROMPTS.md 的規格配套用。
#
#   python3 tools/black-to-alpha.py 原圖.png 輸出.png [閾值,預設 24]
#
# 只挖「連到邊界」的黑,不是整張圖裡所有暗於閾值的像素都挖掉——物件自己身上
# 很深的陰影摺痕(消防栓照片踩過這個坑,2026-08-13)常常也暗到踩進同一個
# 閾值,如果整張圖無腦挖,物件表面會被挖出鋸齒狀的洞。用連通分量:只有真正
# 從畫面邊界一路連過來的黑色區域才算背景,物件內部被包住、沒連到邊界的暗處
# 維持不透明。

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label

src, dst = sys.argv[1], sys.argv[2]
thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 24

im = Image.open(src).convert("RGBA")
arr = np.array(im)
dark = arr[:, :, :3].max(axis=2) <= thresh

labels, n = label(dark, structure=np.ones((3, 3)))  # 8-connectivity
border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
border_labels.discard(0)

bg_mask = np.isin(labels, list(border_labels))
arr[bg_mask, 3] = 0

Image.fromarray(arr).save(dst)
print(f"{src} -> {dst}  ({len(border_labels)} 塊邊界連通黑塊挖成透明)")
