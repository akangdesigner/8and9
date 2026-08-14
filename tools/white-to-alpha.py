# 白底轉透明——跟 black-to-alpha.py 同一招,只是這次來源圖是白底(GPT 生圖
# 存成 JPEG/RGB PNG 時常把透明區壓成接近白色,不是純黑)。一樣用連通分量:
# 只有真正從畫面邊界一路連過來的亮色區域才算背景,物件內部被包住、沒連到
# 邊界的亮部(反光、白色食物、白色托盤)維持不透明。
#
#   python3 tools/white-to-alpha.py 原圖.png 輸出.png [閾值,預設 230]

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label

src, dst = sys.argv[1], sys.argv[2]
thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 230

im = Image.open(src).convert("RGBA")
arr = np.array(im)
bright = arr[:, :, :3].min(axis=2) >= thresh

labels, n = label(bright, structure=np.ones((3, 3)))  # 8-connectivity
border_labels = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
border_labels.discard(0)

bg_mask = np.isin(labels, list(border_labels))
arr[bg_mask, 3] = 0

Image.fromarray(arr).save(dst)
print(f"{src} -> {dst}  ({len(border_labels)} 塊邊界連通白塊挖成透明)")
