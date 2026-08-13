# 超商室內貼圖

2026-08-13 起,超商室內場景已經是「牆面照片 + 各自獨立的 3D 家具(鮮食櫃/
櫃台)」——不要再靠裁一張照片同時湊出牆面跟家具,那是舊做法(`prototypes/
game.html` 裡 `STORE.hot.cut`/舊的 `COUNTER_CUT` 那套),已經在改掉。
**這三張都要重生**,理由詳見 `docs/DESIGN_NOTES.md`「室內固定物件的碰撞」
那節尾巴。

跟 `assets/tex/PROMPTS.md` 同一套規則:**去 GPT 生,不要用本機
ComfyUI**(理由同上,調性要跟現有素材一致,本機 4GB VRAM 也跑不動)。
色調照 `docs/DESIGN_NOTES.md`「色調原則:寫實就好,不要陰森」那節——
**亮、正常、不要壓低彩度、不要陰森氛圍**,這是這個專案的基準線,不是隨口
一句要求。**不要出現真實超商品牌的商標/配色/字樣**(招牌那次踩過這個坑,
見 DESIGN_NOTES「店面／招牌貼圖管線擴充」),商品包裝/貨架標籤一律當成
「自創的一般商品設計」處理。

生完直接用**下面的檔名**放進 `assets/bg/`,程式會自動抓,沒放之前維持
現在的灰模/舊圖狀態,不會壞。

---

## `store-wall.png` — 取代 `store-front.png`,只剩「牆」

現在這張(`store-front.png`)裡的收銀台/螢幕/鮮食櫃,已經被獨立的 3D 物件
取代,但照片裡還畫著這兩樣東西,兩邊會疊在一起變成「重複的櫃台」(kc
截圖抓到)。這張要重生一版**完全不含收銀台家具跟鮮食櫃**的乾淨牆面版本,
其餘保持原本的構圖(門口在左、飲料櫃、貨架,由左到右),因為現有的深度
校正(`NZ_WALL` 等等)是照這個構圖量的,構圖差太多要整組重量。

```
A photorealistic, brightly and evenly lit photograph of the interior back wall
of a small Taiwanese convenience store at night, shot straight-on at eye level
with a very slight downward tilt, filling the frame edge to edge. From left to
right: a pair of glass automatic sliding entrance doors showing a dark empty
street outside; a stainless-steel-framed glass-door drink cooler stocked with
colorful beverage bottles; a wall-mounted metal shelving unit stocked with
colorful bags of snacks and cup noodles; then, on the right side, a section of
plain painted wall with one shelf mounted higher up holding smaller snack and
candy boxes. Important: there is NO checkout counter, NO cash register, NO
monitor, NO desk, and NO other furniture anywhere in the foreground — the
floor in front of the wall is completely empty, showing clean reflective floor
tiles all the way across, including under where a counter might normally sit.
Bright, even, slightly cool white fluorescent ceiling lighting — no dim or
moody lighting, no dramatic shadows, no vignette. No people. No real
convenience store brand logos or readable brand text anywhere — invented
generic packaging and shelf labels only. Landscape orientation, roughly 16:9.
```

## `store-hot-cabinet.png` — 鮮食櫃(獨立家具,不再跟牆面共用一張圖)

`prototypes/game.html` 裡這塊箱體本來就是真的 3D 幾何(`boxFromRect`),
只是貼圖以前是裁自 `store-front.png`。改成專門生一張,長寬比大約 2:1
(對照現有箱體比例,`STORE.hot.w:208 / STORE.hot.h:100`)。

```
A photorealistic, brightly and evenly lit straight-on photograph of a single
stainless-steel-framed glass display case (a hot/fresh-food cabinet) of the
kind used in Taiwanese convenience stores for prepared bento boxes, rice
balls, and snacks. Shot straight-on at a slight downward angle so the whole
case fills the entire frame edge to edge — no background, no wall, no floor,
no other objects, no people, no perspective beyond the case itself. The case
includes a sloped glass front, a stainless steel top rim, and a beige/tan
cabinet base extending down to the bottom edge of the frame. A few generic
bento boxes, rice rolls, and snack trays visible inside, with small blank
price tag holders (no readable text, no real brand). Bright, even, slightly
cool white lighting, no strong shadows. Photorealistic, sharp detail.
Landscape orientation, roughly 2:1.
```

## `store-counter.png` — 櫃台正面(獨立家具)

對應 `buildCounterDesk()` 那個真箱體的正面,長寬比約 1.7:1(對照
`COUNTER_WORLD_WIDTH:3.6 / COUNTER_WORLD_HEIGHT:2.1`)。**這張只要正面
桌板,不要收銀機/螢幕**——那兩個是另外疊上去的小箱體(`COUNTER_MONITOR_MAT`
/`COUNTER_SCREEN_MAT`),混在同一張照片裡反而對不齊。

```
A photorealistic, brightly and evenly lit straight-on photograph of the front
panel of a checkout counter desk from a Taiwanese convenience store — a plain
beige/tan laminate panel with a stainless steel countertop edge visible along
the very top, and a dark base trim along the very bottom where it meets the
floor. The panel fills the entire frame edge to edge — no background, no
register, no monitor, no other objects, no people, no floor, no perspective
beyond the flat front surface itself. Bright, even, slightly cool white
lighting, no strong shadows, no reflections that suggest a wider scene.
Photorealistic, sharp detail. Landscape orientation, roughly 1.7:1.
```

---

## 生完之後要做的事(我這邊,不用 kc 動手)

**已完成(2026-08-13)**:

1. `store-wall.png` 取代 `bgTex` 原本載入的 `store-front.png`
   (`STORE.bgSrc`),`WALL_CUT` 已在新圖上重新量過(`{sx:350,sy:65,
   sw:830,sh:435}`)。暫時的灰色遮色板(`bgMaskCtx.fillRect`)已整段刪掉。
2. `store-hot-cabinet.png` 直接當 `hotTex` 來源,不再裁自背景圖。
3. `store-counter.png` 直接當 `counterFaceTex` 來源,取代原本裁自
   `store-front.png` 的 `COUNTER_FACE_CUT` 暫時座標。
