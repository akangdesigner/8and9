# 綠幕轉透明。判斷「是不是綠幕」用色度(G 明顯比 R/B 都亮),不是暗度閾值。
#
# 2026-08-25 第二輪(kc 換了張淺綠背景的參考圖,抓到「桌子後面椅背跟抽屜
# 中間那個縫還是綠的」):原本只挖「連到畫面邊界」的那塊綠色連通分量,是
# 為了避免人物身上如果穿綠色衣服被整塊誤挖成透明。但這批教室素材的人物
# 沒有穿綠,家具本身有鏤空(椅背跟桌子中間的縫)會露出背景色,那個縫是
# 一塊獨立、不連到畫面邊界的綠色區域,原本的連通分量判斷法挖不到,整片
# 淺綠(這次背景色比較不飽和,比暗度判斷更容易被忽略)就這樣露出來了。
#
# **改成「不限邊界連通」的第一版直接放行所有色度判斷是綠的像素,結果
# 更糟**:書本紙頁邊緣、木紋高光這些前景材質邊界,反鋸齒(anti-alias)
# 跟背景綠混色之後,常常沿著整條邊緣拉出一條連續、但只有 1~2px 寬的
# 「偏綠色帶」——單看面積可能有幾百甚至上千像素(書頁那條邊線很長),
# 光用「面積夠大就是背景」這個門檻(第一次修法)濾不掉,冒出一整排沿著
# 書頁/木紋邊緣的白色雜訊(kc 截圖裡書頁跟男生肩膀那圈雜訊就是這個)。
#
# 真正的分別不是面積,是「夠不夠厚」:真背景(主體那塊 + 家具鏤空露出
# 的縫)是實心的一片,腐蝕(erosion)幾個 px 後主體還在;上面說的細長
# 色帶寬度不夠,腐蝕後直接消失。做法:先腐蝕整張 green mask,看哪些
# 連通分量「腐蝕後還有倖存像素」,只有這些分量的原始範圍(腐蝕前)才當
# 背景——細長色帶腐蝕後歸零、天然被排除,不用另外判斷「這是不是縫隙」。
# 面積門檻(`min_hole_px`)保留當第二道保險,擋掉極小的實心誤判。
#
#   python3 tools/green-to-alpha.py 原圖.png 輸出.png [margin,預設 1.15] [feather,預設 4] [min_hole_px,預設 300]
#
# margin 是「G 要比 R、B 亮多少倍才算綠幕」的寬鬆度,數字越大越保守(挖得
# 越少),人物身上如果有偏綠的東西(不常見)可以調大這個值避免被誤挖。
#
# 2026-08-25(kc:「去背去乾淨啦」):原本整塊硬邊二值化(alpha 只有 0/255),
# 頭髮絲那種細節邊緣會是硬鋸齒,合成到新背景上看起來很粗糙。改成 bg_mask
# 邊緣往外展開 `feather` px 的那圈環狀區域,用連續的綠色純度算 alpha
# (0~255 漸層),不是整塊一刀切。
#
# 2026-08-25 同一天,kc 玩起來截圖抓到「綠幕根本沒清掉」——本機用 PIL
# alpha_composite() 核對看不出問題,瀏覽器裡縮放貼圖(canvas drawImage
# 把裁圖從原始尺寸縮到疊圖實際大小,見 game.html 那幾個 *_TWEAK)卻會
# 冒出綠邊。根因:alpha=0 的全透明像素,RGB 沒有跟著清掉,還是原始的
# 鮮綠色——canvas 縮放用未預乘(un-premultiplied)雙線性內插,會把這些
# 「藏在透明像素裡的綠色」跟旁邊不透明的人物像素混色算出中間值,縮放
# 比例越大(這次是 680px 縮到 ~325px,超過 2 倍)越明顯。PIL 的
# alpha_composite() 是正確處理 alpha 的合成,不會露出這個底色,才會本機
# 核對不出來。修法:所有非完全不透明的像素,RGB 都往「離它最近的完全
# 不透明像素」外推(color extension/邊緣延展),不管後面拿去怎麼縮放、
# 怎麼合成,透明像素底下都不再藏著綠色。

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, binary_erosion, distance_transform_edt, label

src, dst = sys.argv[1], sys.argv[2]
margin = float(sys.argv[3]) if len(sys.argv) > 3 else 1.15
feather = int(sys.argv[4]) if len(sys.argv) > 4 else 4
min_hole_px = int(sys.argv[5]) if len(sys.argv) > 5 else 300

im = Image.open(src).convert("RGBA")
arr = np.array(im).astype(np.float32)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
green = (g > 60) & (g > r * margin) & (g > b * margin)

labels, n = label(green, structure=np.ones((3, 3)))  # 8-connectivity
sizes = np.bincount(labels.ravel())
sizes[0] = 0   # 背景標籤(不是綠色的部分)本身不算
eroded = binary_erosion(green, iterations=2)   # 見上面「細長雜訊」那段筆記
survive = np.unique(labels[eroded])
survive = survive[survive != 0]
big_labels = [lb for lb in survive if sizes[lb] >= min_hole_px]
bg_mask = np.isin(labels, big_labels)

# 羽化帶:bg_mask 往前景方向展開 feather px 的那圈環狀區域,用連續的
# 「G 比 R/B 亮多少」當 alpha(越綠越透明),不是非 0 即 255。
dilated = binary_dilation(bg_mask, iterations=feather)
ring = dilated & ~bg_mask
key = g - np.maximum(r, b)          # 越大越綠;乾淨的人物像素通常 <=0
soft_alpha = 1 - np.clip(key / 60.0, 0, 1)   # 1=不透明,0=全透明

alpha = np.full(g.shape, 255.0, dtype=np.float32)
alpha[bg_mask] = 0
alpha[ring] = soft_alpha[ring] * 255

# 邊緣去綠溢色(spill):只在 `ring`(bg_mask 外圍那圈羽化帶,真的被判定
# 是邊緣的地方)裡,G 分量比 R/B 明顯偏高的像素把 G 壓到 R/B 的較大值,
# 避免合成到新背景上時人物邊緣還留一圈綠邊。**v9 的坑**:原本不限
# `ring`,只要「alpha>0 且偏綠」全圖都套用——書頁邊緣那圈因為色度判斷
# 太厚(白色書頁跟淺綠背景的反鋸齒過渡帶很寬,見上面 min_hole_px 那段
# 的說明)被連通分量判斷正確擋在 bg_mask 外面、維持不透明,但這裡又把它
# 們的 G 壓白,變成一整圈不透明的白色斑點(kc 截圖裡的白色噴濺)。限制
# 在 `ring` 內,這批「判定成前景」的邊緣雜訊就不會被誤動。
spill = ring & (g > r) & (g > b)
g = np.where(spill, np.maximum(r, b), g)

# 色彩外推(color extension):完全不透明(alpha==255)的像素當「有效顏色」,
# **只動完全透明(alpha==0)的像素**,羽化帶(0<alpha<255)不要碰——那些
# 像素的顏色是上面 spill 那段算出來的正確反鋸齒顏色(頭髮絲/邊緣的真實
# 半透明混色)。v8 的坑:原本連羽化帶也一起套用最近像素外推,拿书頁那種
# 大面積亮白前景當「最近的有效像素」灌進去,書頁旁邊本來該是淡淡的正確
# 半透明色,結果變成一整片刷白——kc 截圖裡書頁周圍那圈白色噴濺,就是
# 這段誤傷了本來沒問題的羽化帶。分兩段做:
# 1) 完全透明、且離輪廓夠近(extend_radius px 以內)——換成離它最近那顆
#    有效像素的顏色,防止縮放取樣把這塊藏著的顏色內插進畫面。
# 2) 完全透明、且離輪廓夠遠——換成中性灰,不留殘色。
opaque = alpha >= 255
fully_transparent = alpha <= 0
distances, (iy, ix) = distance_transform_edt(~opaque, return_indices=True)
extend_radius = feather + 12
near_edge = fully_transparent & (distances <= extend_radius)
far_transparent = fully_transparent & ~near_edge
r = np.where(near_edge, r[iy, ix], np.where(far_transparent, 128.0, r))
g = np.where(near_edge, g[iy, ix], np.where(far_transparent, 128.0, g))
b = np.where(near_edge, b[iy, ix], np.where(far_transparent, 128.0, b))

out = np.stack([r, g, b, alpha], axis=-1).clip(0, 255).astype(np.uint8)
Image.fromarray(out).save(dst)
print(f"{src} -> {dst}  ({len(big_labels)} 塊面積 >= {min_hole_px}px 的綠色連通分量挖成透明,邊緣羽化 {feather}px)")
