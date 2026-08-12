# no-way-up

一款關於**社會底層想翻身**的遊戲。玩家扮演的角色被貼上各種標籤,想往上爬,
但每條路都是關的、或者要付出代價。2026-08-03 起案。

**2026-08-04 起已經有一批可跑的原型**(`prototypes/*.html`,雙擊就開,不用 build)。
設計仍在推進,但**不要再說「沒有任何程式碼」**。

## 開始工作前必讀

**先讀 `docs/DESIGN_NOTES.md`**——裡面有命名與定位的風險評估(為什麼不叫「89 模擬器」)、
核心的標籤系統設計、以及三個「還沒定案、擋住後續設計」的待決事項。
不要在沒讀這份文件的情況下重新設計已經討論過的東西。

## 這個專案的基準線

**笑點朝哪個方向,決定這個作品成不成立。**

- 朝「這群人很 low,你來體驗看看多好笑」→ 做得再精緻都沒得救
- 朝「社會怎麼看待這群人」→ 有機會是好作品

差別在**你站不站在角色那一邊**。所有內容決策都回來對這一條。

## 品牌切割(重要)

這個專案**要跟夜影傭兵團 / BattleCardGame(`D:\BattleCardGame-godot`)分開掛名**,
用另一個工作室名或開發者名發。理由見 DESIGN_NOTES 的「品牌切割」一節——
簡單講是 kc 有在經營 LinkedIn 跟接 n8n 自動化案,兩個名字被搜尋引擎綁在一起很難拆。

寫對外文案、README、發布資訊時記得這件事。

**但 repo 位置不在切割範圍內**:原始碼放 `github.com/akangdesigner/8and9`
(public,2026-08-12 推上去),kc 確認獨立 repo 就夠了,不用另開 GitHub 帳號。
要切的是**對外發布的掛名**(遊戲頁面、社群、商店資訊),不是 code 放哪裡——
這點問過一次了,不要再問第二次。

## 溝通語言

一律用繁體中文回覆,不要用英文。

## 工作模式

- 只有使用者(kc)自己開發,跨多次對話 session 找 Claude 接續——沒有其他真人協作者。
- 目前階段是**討論**,不是實作。kc 要討論時就純聊天,不要急著開計畫、開表單、生一堆檔案。
  提案要具體、有畫面感(講得出「玩家在螢幕前看到什麼」),不要只給抽象框架。
- **方向性的設計決定停下來問 kc;小的、可逆的參數自己選一個做完**,回報時明講
  「這裡我選了 X,不喜歡說一聲就改」。
- **同一個設計決定不要寫三份全文。** 長篇理由**只放 `docs/DESIGN_NOTES.md` 一處**,
  其他地方(程式註解、資料檔 notes)壓成一句話 + 日期 + 指向 DESIGN_NOTES 的哪一節。

## 技術現況(2026-08-04 定案,理由見 DESIGN_NOTES「技術選型」)

**Web 原生,不用 Godot。** 兩層:

- **室內／定點**(家、超商、學校)→ Canvas 2D,零依賴零 build
- **街道／探索** → Three.js

發布為靜態檔,kc 的硬需求是**一個網址就能玩**。
**不要再提議換引擎**——翻案條件只有「確定以 Steam 桌面版為主要通路」。
(HTML 遊戲能不能賣?能。Vampire Survivors 原本就是 HTML5,見 DESIGN_NOTES。)

## Git 慣例

單人興趣專案,直接在 main commit 即可,不需要開分支或發 PR。

## 常用指令

沒有 build step、沒有 package.json、零依賴。

- **室內／定點原型**(純 `<script src>`,非 ES module)直接雙擊 `.html` 開,
  例如 `prototypes/one-day.html`、`prototypes/world.html`、`prototypes/tattoo-room.html`。
- **`prototypes/game.html`**(主線)裡的 3D 街道用 ES module 從 CDN 載入 three.js,
  `file://` 會被 CORS 擋,要先起本機 server:
  ```
  cd prototypes && python -m http.server
  ```
  再開 `http://localhost:8000/game.html`。
- `node tools/render-scene.mjs [--scale 2] [--no-people]`——把 2D 場景灰模輸出成 PNG。
- `node tools/comfy-img2img.mjs [--denoise 0.7] [--model ...]`——對本機 ComfyUI
  (port 8000)打 img2img API 幫灰模上質感;只有 kc 本機能跑(3050 Laptop 4GB VRAM,SD 1.5)。

沒有 lint、沒有測試框架——原型階段靠雙擊瀏覽器肉眼驗證。

## 架構概觀

**入口是 `prototypes/game.html`**(3D 街上走 → 走進門口 → 2D 超商 → 出來回原位)。
其他 `prototypes/*.html` 多半是還沒接進主線的獨立原型,或已完成任務的紀錄——
DESIGN_NOTES「目前的原型」那張表是權威盤點,改動原型後要記得回去更新那張表,
不要自己在別處重新盤點一次。

### 兩種模組寫法並存,不要混用

| 寫法 | 用在哪 | 為什麼 |
|---|---|---|
| **IIFE 掛全域**(`(function(root){...})(window)`,`<script src>` 引入) | 所有 2D 場景模組(`scene-home.js`、`scene-store-front.js`、`scene-tattoo.js`、`scene-street.js`)、`src/tags.js`、`lib/places.js`、`lib/quests.js`、`lib/npc-temple.js`、`lib/story-*.js` | 讓 `.html` 檔可以直接雙擊開,`file://` 不會被 CORS 擋 |
| **ES module**(`export`/`import`) | 只有 3D 相關(`scene-city3d.js`),因為要 `import * as THREE` | 唯一需要本機 server 的路徑(見上面常用指令) |

新增 2D 場景模組時跟著 IIFE 那一套,不要因為「ES module 比較新」就換掉——
那會讓那個場景的原型失去雙擊即開的能力。

### `game.html` 的狀態模型

單一全域物件 `ST`,五條固定指標:`money`(金錢)／`full`(飽足)／
`calm`(歸屬感——顯示名稱已改,程式 key 還沒改,見 DESIGN_NOTES「實作現況」)／
`cool`(帥潮)／`star`(通緝,上限 5)。改動指標一律走 `chg(k, d)`,不要直接寫
`ST.xxx = ...`——`chg` 負責 clamp 範圍、更新 HUD、跳飄字。五條指標各自
「只由什麼改變」的邊界記在 DESIGN_NOTES「五條指標各自管什麼」,那條規則
容易被劇情檔悄悄違反,寫新劇情前先看。

### 劇情資料檔(`lib/story-*.js`)

一個家庭故事線一份檔,固定節點結構(第幾天觸發、`TRUTHS` 真相陣列等)。
現行只接了母・賭(`story-bet.js`)+ 父・喝(`story-drink.js`)這組合,
其餘四條(`story-work.js`、`story-hit.js`、`story-gone.js`、`story-bf.js`)
劇本寫好但冰存,`game.html` 也還沒有這組家庭資料——
見 DESIGN_NOTES「家裡的拉扯 → 範圍:先只做一組父母」。
