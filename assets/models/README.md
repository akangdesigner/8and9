# 角色骨架模型

`base-human-idle.glb`、`base-human-walk.glb` 補了會自動換上真人骨架,少了就退回
`scene-city3d.js` 裡程序生成的方塊人,不會壞——跟 `assets/tex/PROMPTS.md` 那套
「缺檔案不會壞」的慣例一樣。

## 現在有幾副骨架

`scene-city3d.js` 的 `MODELS` registry 註冊了八副,對應八組檔名前綴:

| rig id | 來源(Mixamo 角色) | 用在誰 | 檔名前綴 |
|---|---|---|---|
| `m`  | Remy(男性)   | 主角 | `base-human-` |
| `f`  | Sophie(女性) | 阿姨等女性 NPC | `base-human-f-` |
| `m2` | Leonard(男性,短髮)| 阿源——跟主角同性別但要換髮型,髮型是模型內建固定形狀換不了造型,只能整套換一個來源模型 | `base-human-m2-` |
| `m3` | Brian(男性,光頭)| 超商排隊客人/行人湊數,2026-08-20 | `base-human-m3-` |
| `f2` | Megan(女性,短髮)| 超商排隊客人/行人湊數,2026-08-20 | `base-human-f2-` |
| `m4` | Bryce(男性,Teen 分類,蓬髮)| 校門口改管那群人的頭(新角色,2026-08-24) | `base-human-m4-` |
| `m5` | Joe(男性,西裝平頭)| 小美哥(警局門口站崗)——具名角色跟 m3 那群人撞臉,2026-08-31 補的專屬骨架 | `base-human-m5-` |
| `m6` | Josh(男性,深色外套疊短版襯衫、蓬髮)| 旺鴻(機車行老闆)——同一天補的,理由同 m5 | `base-human-m6-` |

`m5`/`m6` 是 2026-08-31 為了「具名角色不該跟背景路人/其他具名角色共用骨架」
這個要求補的——kc 先反應小美哥「特殊角色要特殊骨架」,接著又指出光頭(m3)
早就被工地老闆/刺青師傅/機車行/阿成/阿仁共用,連旺鴻也要換掉。**踩過一次坑:
先試的 Lewis 匯出後全身只有一個 mesh 節點(`Ch12`),跟下面「排隊客人」那節
GirlScout 的坑一樣,套色系統沒辦法把皮膚/衣服分開染,換成 Joe(`Ch33_*`
命名前綴)才是正常的 Fuse 角色包分件拓樸。抓新骨架前務必先用下面「怎麼查
一副新骨架的部件名字」那節的方法讀一次 glb 的 mesh 節點數量,只有 1 個
就代表分不了色,不要下載完、轉檔完才發現要重來。

`m3`/`f2` 是 2026-08-20 為了「排隊客人/行人只有 3 副骨架,肉眼容易抓到重複」
這個待辦補的(見 `docs/DESIGN_NOTES.md` 那節),流程跟前三副完全一樣,只是
從 Mixamo 的「Casual」分類裡挑的——目的是要跟既有三副在體型/髮型上明顯不同,
不是隨便挑。Brian 是光頭,沒有獨立的 Hair mesh,`MODELS.m3.parts` 沒有
`hair` 這個 key,不是漏接。

`m4` 是 2026-08-24 為了新角色補的——kc 明確要求「去找別的骨架」,不要跟
前五副共用同一個身體。Bryce 是 Mixamo 唯一標成「Teen」分類的男生角色,
挑他是因為頭髮比 Remy/Leonard/Brian 明顯蓬鬆有層次、體型是青少年比例,
不是隨便選的。部件名字是 `Ch42_Body1`/`Ch42_Shirt`/`Ch42_Shorts`/
`Ch42_Sneakers`/`Ch42_Hair1`/`Ch42__Eyelashes`(分開的,像 Remy/Leonard,
不是 Sophie 那種整套衣服黏一起換不開),`sit` 動畫是 Mixamo「Sitting Idle」
(椅子坐姿,雙手放膝上)。

每副都是「免費帳號登入下載,兩個各自獨立的動畫(Idle、Walking——Walking 記得勾
**In Place**,不然動畫會帶著角色自己位移,跟遊戲自己算的座標打架)。下載設定:
**FBX Binary,With Skin**(不勾會有肩膀骨骼轉向的已知 bug)」這條路徑做出來的。

`*-idle.glb` 帶 mesh + 骨架 + idle 動畫;`*-walk.glb` **只有骨架 + 走路動畫**,
mesh 在 Blender 匯出前先刪掉了——同一個角色分兩次下載,骨架完全一樣,所以 walk 的
`AnimationClip` 可以直接套到 idle 那份骨架的 `AnimationMixer` 上,不用在 Blender
裡合併成一個檔案。

**加新骨架時,部件名字(哪個 mesh 是上衣/褲子/鞋子)因來源角色而異,不要憑印象猜**——
Remy 是 `Body`/`Tops`/`Bottoms`/`Shoes`/`Hair`/`Eyes`(語意清楚,分開兩個 mesh);
Sophie 是 `Ch02_Body`/`Ch02_Cloth`/`Ch02_Sneakers`/…(整套衣服是同一個 mesh,
上衣下身分不開換色);Leonard 是 `Ch31_Body`/`Ch31_Sweater`/`Ch31_Pants`/…
(分開的,像 Remy)。查法見下面。

## 轉檔:FBX → glb

Mixamo 只給 FBX,這個場景是 Three.js(`GLTFLoader`),要先轉檔。這台機器上用 Blender
的 headless 模式轉(Apple Silicon 沒有 Rosetta 2,`fbx2gltf` 這類現成的 npm 轉檔工具
綁的是 x86_64 執行檔,跑不動,2026-08-12 已驗證):

```bash
blender --background --factory-startup --python fbx2glb.py -- <來源.fbx> <輸出.glb> [full|anim-only]
```

`fbx2glb.py` 用 `bpy.ops.import_scene.fbx` 匯入,`bpy.ops.export_scene.gltf` 匯出,
兩個關鍵設定:

- **`export_materials='NONE'`、`export_image_format='NONE'`**——Mixamo 內建的材質貼圖
  直接匯出會把檔案撐到 30+MB(這個角色分成 Body/Tops/Bottoms/Shoes/Hair/Eyes 好幾個
  部件,每個都帶貼圖)。反正要換成自己的美術方向,原廠貼圖用不到,直接剝掉,
  `idle.glb` 因此從 34MB 降到 1.5MB。
- **`anim-only` 模式**在匯出前把所有非 Armature 物件刪掉,只留骨架+動畫——
  `walk.glb` 用這個模式,通常 90KB 上下,不用重複背一份根本不會顯示出來的 mesh。

## 怎麼查一副新骨架的部件名字

Blender 匯出 log 印的是 mesh **DATA** 名字(像 `Mesh.002`),不是這裡要的
**OBJECT** 名字——那才是 glTF node 名字、才是 `MODELS[rig].parts` 要拿來對應的
key。兩個是不同的東西(2026-08-12 踩過,一開始查錯查到 log 裡的名字)。

匯入 FBX 後印物件名字(轉檔前先查,比較快):

```bash
blender --background --factory-startup --python - -- "來源.fbx" << 'EOF'
import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[sys.argv.index('--')+1], automatic_bone_orientation=True)
for obj in bpy.data.objects: print(obj.name, obj.type)
EOF
```

或轉完 glb 之後直接解 JSON chunk 確認(比較保險,這是最終真的會被 Three.js
讀到的名字):

```python
import struct, json
with open("base-human-xxx-idle.glb", "rb") as f:
    struct.unpack("<4sII", f.read(12))
    n, _ = struct.unpack("<II", f.read(8))
    gltf = json.loads(f.read(n))
for i, node in enumerate(gltf["nodes"]):
    if "mesh" in node: print(i, node.get("name"))
```

## 縮放與朝向(接程式那邊要注意的坑)

`scene-city3d.js` 的 `riggedCharacter()`(`buildPlayer`/`buildNPC` 共用)用
bounding box 自動把模型縮放到指定身高——**一定要先
`model.updateMatrixWorld(true)` 再算 `Box3().setFromObject()`**,不然量到的是
骨架姿勢套用前的錯誤小數值(2026-08-12 踩過:量出 0.638 而不是正確的 3.79,
角色因此被放大好幾倍、鏡頭整個埋進身體裡)。

朝向是換模型來源時才需要重調的旋鈕,目前用到的三副實測都不用轉,見
`buildPlayer()` 裡 `model.rotation.y` 那行的註解。

## 一顆骨架、多套皮膚

見 DESIGN_NOTES「美術與視角」——角色之間的差異優先靠換材質顏色/貼圖做出來
(`buildNPC` 的 `skin`/`hair`/`hood`/`pants`/`shoe` 參數),不是每個角色重找
一次模型。**只有髮型例外**——髮型是模型內建的固定形狀,換不了造型,真的需要
不同髮型才整套換一個來源模型(見上面 `m2` 怎麼加的)。
