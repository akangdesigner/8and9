# 3D 街的材質貼圖

把生好的圖用**下面的檔名**丟進這個資料夾就會自動貼上去,不用改程式。
少哪一張就那個材質維持灰模,不會壞,可以一張一張補。

**去 GPT 生,不要用本機 ComfyUI。** 超商內部那張(`assets/bg/store-front.png`)是 GPT 生的,
街的材質要跟它同一個來源風格才會一致;本機的 majicmix 是人像寫實模型,
畫出來會變成畫面裡的第三種調性。(而且 3050 只有 4GB,生一批會一直卡。)

## 規格

- **正方形**,1024×1024 就夠(貼上去會縮,再大只是變慢)
- **正面平拍,不要有透視、不要有光影方向**——貼圖自己帶陰影的話,
  3D 場景的燈一打上去會出現兩套影子
- 不用勉強要求無縫。程式載入時會鏡像成 2×2 再平鋪,接縫自己會消失

> 圖還沒放的時候,瀏覽器 console 會有幾條 404 紅字,那是正常的——
> 就是在說這張還沒補。放進來就不見了。

## 四張

### `wall.png` — 建築外牆(最有感的一張,先生這張)

> Photo of a weathered Taiwanese apartment building exterior wall, covered in small
> rectangular ceramic tiles (二丁掛), beige and dirty grey, black mold streaks running
> down from above, water stains, cracked and patched grout lines, some tiles missing.
> Flat straight-on view of the wall surface only, no windows, no sky, no perspective,
> no people. Evenly lit, overcast daylight, no strong shadows. Photorealistic, high detail.

### `shutter.png` — 鐵捲門(街上一半的店是拉下來的)

> Photo of a closed metal rolling shutter door, horizontal ribbed slats, faded green-grey
> paint, rust streaks near the bottom edge, scratches and dents, a few torn remains of
> taped paper notices. Flat straight-on view, no perspective, no people, no text.
> Evenly lit, no strong shadows. Photorealistic, high detail.

### `road.png` — 柏油路面

> Photo of worn asphalt road surface seen from directly above, patched with darker
> repair strips, oil stains, hairline cracks, scattered fine gravel, faded paint traces.
> Top-down flat view, no perspective, no cars, no people, no road markings.
> Evenly lit, no shadows. Photorealistic, high detail.

### `walk.png` — 人行道／騎樓地磚

> Photo of a Taiwanese sidewalk paved with square concrete tiles seen from directly above,
> grey and faded beige, uneven and slightly sunken in places, dirt in the joints,
> stains and old gum marks. Top-down flat view, no perspective, no people.
> Evenly lit, no shadows. Photorealistic, high detail.

## 還有一張是選配

`stone.png` — 廟埕的石板地。廟埕現在用的是同一套程序生成的石紋,
先做完上面四張看效果,不夠再補這張。
