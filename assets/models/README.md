# 角色骨架模型

`base-human-idle.glb`、`base-human-walk.glb` 補了會自動換上真人骨架,少了就退回
`scene-city3d.js` 裡程序生成的方塊人,不會壞——跟 `assets/tex/PROMPTS.md` 那套
「缺檔案不會壞」的慣例一樣。

## 現在有幾副骨架

`scene-city3d.js` 的 `MODELS` registry 註冊了十二副,對應十二組檔名前綴:

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
| `m7` | James(男性,連帽衫+哈倫褲)| 小胖(廟口)——2026-09-02 補,靠 `buildNPC()` 的 `opts.widen` 加寬 X/Z 撐胖,不是真的換胖體型模型;衣服花紋靠 UV 貼圖不是材質分件,見下面「單一 mesh 但沒有獨立上衣」那節 | `base-human-m7-` |
| `f3` | Jody(女性,短深髮、運動休閒)| 越式按摩(巷子那位+室內第二角色)——2026-09-03,理由同 m5/m6(具名角色不該跟 `f` 共用),見下方段落 | `base-human-f3-` |
| `f4` | Elizabeth(女性,捲髮、條紋毛衣+牛仔褲)| 備用,還沒接到任何角色,2026-09-03 一起下載轉檔收著 | `base-human-f4-` |
| `f5` | Kate(女性,金髮、襯衫西裝褲)| 備用,還沒接到任何角色,2026-09-03 一起下載轉檔收著 | `base-human-f5-` |

`f3`/`f4`/`f5` 是 2026-09-03 為了越式按摩那位補的——kc:「你能不能找到別的
女生模型啊」,原本借用 `f`(Sophie),跟「阿姨等背景女性 NPC」共用同一副,
理由同 m5/m6。kc 接著要求「先換好 然後三個都下載 才可以自由換路人」——
Mixamo 搜 casual/girl 篩出三個候選給 kc 選(截圖比對他丟的大頭貼參考圖,
挑頭髮色調最接近的),三副都下載轉檔,只有 f3(Jody)接上角色,f4/f5
先收進 registry 給以後補路人用,不是白下載。三副都是 Body/Shirt/Pants/
Shoes/Hair/Eyelashes 各自獨立 mesh 節點的乾淨拓樸(不是 kid/Ortiz 那種
單一合併 mesh),換色不會踩坑——雖然三副匯入後材質 slot 是共用的(例如
Jody 的 Body/Pants/Shirt/Sneakers 全部指到同一個 `Ch38_body` 材質),
但 `riggedCharacter()` 完全不讀原始材質,是照 `parts[物件名字]` 直接
整個替換成自己的染色材質,共用材質這件事對換色系統沒有影響,不用另外
拆分。

`m5`/`m6` 是 2026-08-31 為了「具名角色不該跟背景路人/其他具名角色共用骨架」
這個要求補的——kc 先反應小美哥「特殊角色要特殊骨架」,接著又指出光頭(m3)
早就被工地老闆/刺青師傅/機車行/阿成/阿仁共用,連旺鴻也要換掉。**踩過一次坑:
先試的 Lewis 匯出後全身只有一個 mesh 節點(`Ch12`),跟下面「排隊客人」那節
GirlScout 的坑一樣,套色系統沒辦法把皮膚/衣服分開染,換成 Joe(`Ch33_*`
命名前綴)才是正常的 Fuse 角色包分件拓樸。抓新骨架前務必先用下面「怎麼查
一副新骨架的部件名字」那節的方法讀一次 glb 的 mesh 節點數量,只有 1 個
就代表分不了色,不要下載完、轉檔完才發現要重來。

**只有 1 個 mesh 節點不一定死路一條**——2026-09-02 小胖那輪(kc:「去下載
一個年輕胖子」)先試了 Ortiz(唯一算胖的角色),匯出後真的只有一顆 mesh
`Ch43` 而且材質也只有 1 個 slot,這種才是真的死路,只能整個人同一個顏色
(或像 `MODELS.kid` 那樣乾脆放棄換色,見下面「排隊客人」那節)。退回正常
體型的 James(`Ch06`),同樣只有 1 個 mesh 節點,但用下面「怎麼查一副新
骨架的部件名字」那節查材質 slot 的指令,查出**材質 slot 其實有 3 個**——
mesh 節點數量分不開,不代表材質也沒分開。`tools/fbx2glb_split.py` 用
Blender 的 `mesh.separate(type='MATERIAL')` 先把合併的 mesh 按 slot
切開重新命名再匯出。**下次遇到「只有 1 個 mesh 節點」不要直接放棄**,
先查材質 slot 數量再決定要不要用這個角色。

⚠ **材質 slot 分得開,不代表那個 slot 就是你以為的部位**——James 這
3 個 slot 分別是 `Ch06_body`(皮膚+上衣+褲子全部黏在同一塊,沒有獨立
上衣區域)、`Ch06_body1`(其實是鞋子)、`Ch06_eyelashes`。第一輪憑
poly 數量猜「比較大那塊(`Ch06_body`)是皮膚、小塊(`Ch06_body1`)是
衣服」,結果貼圖貼到鞋子上,kc 玩起來抓到「完全沒套用到皮膚」。**下次
分完材質後,先把每一塊單獨渲染出來看是什麼形狀,不要只憑 poly 數量或
slot 順序猜語意**——見下面「單一 mesh 但沒有獨立上衣:用 UV 貼圖救」
那節,這種情況材質再怎麼分也生不出「上衣」這個部位,得改用 UV 貼圖。

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

**只有 1 個 mesh 物件時,再查一次材質 slot 數量**——mesh 物件分不開不代表
材質也沒分開(見下面「只有 1 個 mesh 節點不一定死路一條」那節),查法:

```bash
blender --background --factory-startup --python - -- "來源.fbx" << 'EOF'
import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[sys.argv.index('--')+1], automatic_bone_orientation=True)
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        print(obj.name, 'material_slots:', [s.name for s in obj.material_slots])
EOF
```

材質 slot 數 > 1 的話用 `tools/fbx2glb_split.py` 轉檔(取代 `fbx2glb.py`),
按材質切開重新命名再匯出,細節見那支腳本檔頭筆記。**分完務必把每一塊
單獨渲染出來看是什麼形狀再決定 parts 怎麼對應**,不要只憑 poly 數量猜
(教訓見上面「材質 slot 分得開,不代表那個 slot 就是你以為的部位」)。

## 單一 mesh 但沒有獨立上衣:用 UV 貼圖救

James 這類角色材質再怎麼分,也分不出「上衣」這個部位——`Ch06_body`
就是皮膚+衣服黏死在同一塊材質,材質分割這條路走不通。這種情況改用
UV 貼圖:把那塊材質的 UV 攤平圖匯出來,照著攤平圖畫,花紋只畫在
軀幹/手臂對應的區域,臉/手保留皮膚色,貼回去之後視覺上看起來就像
「上衣」,即使底層還是同一塊材質。

```bash
blender --background --factory-startup --python tools/dump_uv_regions.py -- <來源.fbx> tris.json [材質名稱]
python3 tools/rasterize_uv_regions.py tris.json <輸出目錄>
```

產生兩張圖:`uv_template.png`(純線稿,生圖工具照這張畫)、`uv_regions.png`
(按骨骼分類的部位色塊對照:紅=軀幹、藍=手臂、綠=腿、黃=臉、粉紅=手,
人看這張認區塊)。部位判斷是骨骼名字關鍵字比對,袖口/褲管交界會有點
誤差,是給人類參考的粗略分類,不是精準裁切線。

兩張圖丟給生圖工具(把 UV 線稿當模板貼進 prompt),生出來的完整貼圖
`opts.tex` 那套鏡射不能用(那是給「只畫半邊、靠對稱補滿」的花紋設計的,
UV 精準貼圖鏡射了會整個對不上)——改用 `buildNPC()` 的 `opts.texRaw`,
直接套原圖,不經過 `prep()` 處理。範例見 `game.html` 小胖那個 `buildNPC()`
呼叫(`texRaw:{ skin:'char-fat-body-uv.png' }`)。

⚠ **`rasterize_uv_regions.py` 的 V 座標已經修過一次上下顛倒的坑**(見
腳本檔頭那段說明 + `docs/DESIGN_NOTES.md`「小胖」那節第四輪)——Blender
匯出前的內部 UV 跟 glTF 匯出後 Three.js 實際讀到的 UV 差一個上下顛倒,
兩支腳本現在已經扳正,正常用不會再踩到,只是提醒別自己「看起來該加
`1-v`」手滑改回去。真的要驗證貼圖對不對,**不要只截圖 zoom 一小塊**,
要把整個模型在夠亮的環境下單獨渲染出來看,見 `docs/DESIGN_NOTES.md`
同一節結尾那條教訓。

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
