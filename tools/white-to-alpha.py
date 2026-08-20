# 白底轉透明——對話頭像(clerk/pc/mom/dad 之後那批,見 game.html
# drawPortrait())是純白/淺灰底拍的證件照,drawPortrait() 會先鋪一層深藏青
# (#1b202b)再疊頭像上去,白底不去掉的話對話框裡會看到一塊突兀的方塊,
# 跟深色 UI 對不起來。跟 black-to-alpha.py(挖黑底,給垃圾/招牌那批物件照用)
# 是同一個道理的反過來,這支專門給頭像這種「淺色背景、深色/膚色主體」用。
#
#   python3 tools/white-to-alpha.py 原圖.png 輸出.png [閾值,預設 230]
#
# 一樣用連通分量:只有真正從畫面邊界一路連過來的亮色區域才算背景,人臉/
# 衣服上偶爾出現的高光反光(額頭、鼻樑)不會被誤挖,因為那些光斑通常被
# 深色像素包住、沒連到邊界。

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label

src, dst = sys.argv[1], sys.argv[2]
thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 230

im = Image.open(src).convert("RGBA")
arr = np.array(im)
light = arr[:, :, :3].min(axis=2) >= thresh

labels, n = label(light, structure=np.ones((3, 3)))  # 8-connectivity
border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
border_labels.discard(0)

bg_mask = np.isin(labels, list(border_labels))
arr[bg_mask, 3] = 0

Image.fromarray(arr).save(dst)
print(f"{src} -> {dst}  ({len(border_labels)} 塊邊界連通亮色塊挖成透明)")
