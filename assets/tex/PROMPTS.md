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
