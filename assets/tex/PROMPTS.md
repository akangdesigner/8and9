# 3D 街的材質貼圖

把生好的圖用**下面的檔名**丟進這個資料夾就會自動貼上去,不用改程式。
少哪一張就那個材質維持灰模,不會壞,可以一張一張補。

**去 GPT 生,不要用本機 ComfyUI。** 超商內部那張(`assets/bg/store-front.png`)是 GPT 生的,
街的材質要跟它同一個來源風格才會一致;本機的 majicmix 是人像寫實模型,
畫出來會變成畫面裡的第三種調性。(而且 3050 只有 4GB,2026-08-04 試了三次
KSampler 全部死在 CUDA error,一張都沒生出來。)

## 規格

- **正方形**,GPT 預設 1024×1024 就對了
- **正面平拍,不要有光影方向**——貼圖自己帶陰影的話,3D 場景的燈一打上去會有兩套影子
- **不用管無縫**。程式載入時會鏡像成 2×2 再平鋪,接縫自己會消失
- 如果 GPT 給的圖有邊框、留白、或看得出是「一面牆在某個場景裡」,
  跟它說 `fill the entire frame with only the surface, no context` 再生一次

> 圖還沒放的時候,瀏覽器 console 會有幾條 404 紅字,那是正常的——
> 就是在說這張還沒補。放進來就不見了。

---

## `wall.png` — 建築外牆(最有感的一張,先生這張)

```
A flat, straight-on photograph of a weathered apartment building exterior wall in Taiwan,
covered edge to edge in small rectangular ceramic tiles, beige and dirty grey. Black mold
streaks running down from above, water stains, cracked grout lines, a few missing tiles.
The wall surface fills the entire square frame — no windows, no doors, no sky, no ground,
no people, no perspective. Shot perfectly straight on so the surface is flat. Even overcast
lighting, no strong shadows, no vignette. Photorealistic, sharp detail.
This is a tileable texture reference image for a 3D game.
```

## `shutter.png` — 鐵捲門(街上一半的店是拉下來的)

```
A flat, straight-on photograph of a closed metal rolling shutter door on a Taiwanese
shopfront. Horizontal ribbed slats, faded green-grey paint, rust streaks along the bottom
edge, dents and scratches, torn remains of taped paper notices. The shutter fills the entire
square frame — no walls, no ground, no signage, no text, no people, no perspective.
Even lighting, no strong shadows. Photorealistic, sharp detail.
This is a tileable texture reference image for a 3D game.
```

## `road.png` — 柏油路面

```
A photograph of worn asphalt road surface shot from directly overhead, camera pointing
straight down. Darker patched repair strips, oil stains, hairline cracks, scattered fine
gravel, faded paint traces. The road surface fills the entire square frame — no cars,
no people, no curbs, no lane markings, no perspective. Even overcast lighting, no shadows.
Photorealistic, sharp detail. This is a tileable texture reference image for a 3D game.
```

## `walk.png` — 人行道／騎樓地磚

```
A photograph of a Taiwanese sidewalk shot from directly overhead, camera pointing straight
down, paved with square concrete tiles, grey and faded beige, slightly uneven and sunken in
places, dirt packed into the joints, old stains and gum marks. The paving fills the entire
square frame — no people, no curb, no road, no perspective. Even overcast lighting,
no shadows. Photorealistic, sharp detail. This is a tileable texture reference image for a 3D game.
```

## `stone.png` — 廟埕石板地(選配)

廟埕現在用的是程序生成的石紋。先做完上面四張看效果,不夠再補這張。

```
A photograph of an old stone-paved temple courtyard floor in Taiwan shot from directly
overhead, camera pointing straight down. Large irregular granite slabs, worn smooth in the
middle, moss and dirt in the gaps, scattered incense ash and scorch marks. The paving fills
the entire square frame — no people, no walls, no perspective. Even overcast lighting,
no shadows. Photorealistic, sharp detail. This is a tileable texture reference image for a 3D game.
```

## `grass.png` — 公園草地(2026-08-13,kc 決定要做真的公園才需要這張)

跟上面幾張材質同規格(填滿整個畫面、可以無縫、程式會鏡像鋪開),不是
`trash-*`/`prop-*` 那種黑底去背卡片。`scene-city3d.js` 的 `park()` 在用,
沒補之前維持程序生成的純綠色方塊。

```
A photograph of a small patch of slightly patchy, worn park lawn grass in Taiwan,
shot from directly overhead, camera pointing straight down. Mix of green and
yellowing grass, some bare dirt patches, scattered fallen leaves. The grass fills
the entire square frame — no people, no path, no curb, no perspective. Even overcast
lighting, no shadows. Photorealistic, sharp detail. This is a tileable texture
reference image for a 3D game.
```

## `hedge.png` — 公園矮圍籬(2026-08-13)

跟 `grass.png` 同規格(填滿整個畫面、可以無縫,不是黑底去背卡片)。
`scene-city3d.js` 的 `park()` 在用,貼在圍籬箱體的側面,沒補之前維持程序
生成的深綠色。正面平拍一叢修剪過的矮灌木葉牆,近距離、密實。

```
A photograph of a trimmed low boxwood hedge wall, shot straight-on at close range,
dense small green leaves filling the entire square frame, slightly uneven trim,
some yellowing leaves and small gaps mixed in for realism. No ground, no sky,
no pot, no other objects, no perspective. Even overcast lighting, no strong
shadows. Photorealistic, sharp detail. This is a tileable texture reference
image for a 3D game.
```

---

## `trash-<kind>.png` —— 路上可撿的垃圾(2026-08-13)

跟上面那些「鋪滿整個畫面的無縫材質」不是同一種用法——這幾張是**貼在地上的單一
物件貼圖**(decal,平躺的一塊 plane,不是牆面/地面材質),所以規格不一樣:

- **純黑底,物件置中,正上方俯拍**——不是「填滿整個畫面」,黑色背景要留著,
  因為程式會用 `tools/black-to-alpha.py` 把黑轉透明,物件才會像真的躺在地上,
  不是貼了一塊黑方塊。
- 目前規劃 5 種:`trash-bottle.png`(寶特瓶,唯一會加錢的)、
  `trash-lunchbox.png`(保麗龍便當盒)、`trash-cig.png`(菸蒂堆)、
  `trash-flyer.png`(皺傳單)、`trash-cup.png`(手搖杯)。
- **不要有真實品牌**——寶特瓶標籤、飲料杯都要交代「invented generic
  design,no real brand logo」,理由跟超商招牌那次一樣(見 DESIGN_NOTES
  「店面／招牌貼圖管線擴充」的商標風險那段),GPT 對「台灣街頭垃圾」的訓練
  資料一樣可能夾帶真實超商/手搖飲品牌。

生完之後,黑底轉透明:

```bash
python3 tools/black-to-alpha.py 原圖.png assets/tex/trash-bottle.png
```

### `trash-bottle.png` — 寶特瓶

```
A photograph of a single crushed empty plastic beverage bottle lying on its side,
Taiwan convenience store style bottle, label peeling and faded with no real brand
logo or readable text (invented generic label design only), some dirt and dust on
the surface. Shot from directly above on a pure solid black background, even
lighting, no shadow, no other objects, no ground surface visible. Photorealistic.
```

### `trash-lunchbox.png` — 保麗龍便當盒

```
A photograph of an empty styrofoam takeout lunchbox, lid open, greasy stains and
a few rice grains stuck inside, a pair of used disposable wooden chopsticks resting
on top. Shot from directly above on a pure solid black background, even lighting,
no shadow, no other objects, no ground surface visible. Photorealistic.
```

### `trash-cig.png` — 菸蒂堆

```
A photograph of a small scattered pile of 4-5 discarded cigarette butts, some with
ash smudges, on a completely black surface. Shot from directly above, even
lighting, no shadow, no other objects, no ground surface visible. Photorealistic.
```

### `trash-flyer.png` — 皺廣告傳單

```
A photograph of a crumpled discarded paper flyer, mostly unfolded but wrinkled,
printed text blurred/illegible (invented generic layout, no real brand or store
name), slightly dirty. Shot from directly above on a pure solid black background,
even lighting, no shadow, no other objects, no ground surface visible. Photorealistic.
```

### `trash-cup.png` — 手搖飲料杯

```
A photograph of an empty plastic bubble-tea style drink cup lying on its side, straw
still inserted, a little melted ice residue, no real brand logo (invented generic
plain cup design only). Shot from directly above on a pure solid black background,
even lighting, no shadow, no other objects, no ground surface visible. Photorealistic.
```

---

## `tree-crown-<1~4>.png` —— 路樹的樹冠(2026-08-13,已補圖)

跟 `trash-*` 同一種用法(貼在卡片上的去背照片,不是鋪滿畫面的材質),但這張是
**立起來的卡片,不是躺在地上**——`scene-city3d.js` 的 `buildTree()` 拿這張貼成
兩片十字交叉的平面立牌,從大多數角度看都有葉子擋著,不用真的建樹葉幾何。
沒圖之前維持現在的多面體灰模樹冠,不會壞。

**已經生好放進去了**,一次生 4 種變化(2×2 組合圖,`tools/crop-grid.py` 切開,
`tools/black-to-alpha.py` 去背),`buildTree(cx,cz,scale,variant)` 的 `variant`
(1~4)對應挑哪一張,同一條路上的樹不會長得一模一樣。原始 prompt(之後要再生
變化或换掉某一種可以照這個):

```
A single image divided into a clean 2x2 grid of 4 separate photographs, each showing
a different small tree or shrub crown viewed from the side at eye level (banyan/ficus
type trees and a rounded shrub, common Taiwanese street greenery). Each cell is fully
separated by a thin margin with its own pure solid black background, no bleed between
cells, consistent even lighting in each cell, no trunk or branches visible past the
leaf mass edges, no ground surface. Photorealistic, sharp detail.
```

---

## `prop-<name>.png` —— 街道小物立牌(2026-08-13,已補圖)

跟樹冠同一招(立牌卡片,不是躺地上的 decal),`scene-city3d.js` 的 `addProp()`
用。已經生好放進去了:`prop-utilitybox.png`(電箱)、`prop-hydrant.png`
(消防栓,街上裝飾用)、`prop-planter.png`(盆栽,公園入口兩側)、
`prop-bench.png`(長椅,目前公園裡用的是灰模長椅,這張先留著沒接上)。
原始 prompt(2×2 組合圖,同一套切法):

```
A single image divided into a clean 2x2 grid of 4 separate photographs of different
Taiwanese street objects, each in its own cell on a pure solid black background,
separated by a thin margin: top-left a weathered green metal electrical utility box;
top-right a rusty red fire hydrant; bottom-left a cracked concrete flower planter
with a small potted plant; bottom-right a simple worn wooden park bench viewed from
the side. No real government or brand logos on any object — invented generic design
only. Each cell shot from a similar 3/4 front angle, consistent even lighting, no
shadows crossing between cells, no ground surface visible. Photorealistic, sharp detail.
```

**已知小坑**:消防栓那張的頂蓋收邊陰影深到踩進純黑,`black-to-alpha.py` 的
邊界連通判斷在那一小圈會失效,挖出幾個鋸齒小洞——是背景太黑跟物件陰影太黑
撞到同一個值,程式端分不出來,不是工具寫錯。這張是小型街景裝飾,鋸齒不明顯
的話先不管;要根治得重生一張陰影別壓到全黑。
