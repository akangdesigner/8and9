# 模型授權

角色骨架(`base-human-*.glb`)是 kc 自己從 Mixamo 轉出來的,見 `README.md`,
不是這份清單管的範圍。這份只記外部撿來的靜態小物模型。

| 檔案 | 名稱 | 作者 | 授權 | 來源 |
|---|---|---|---|---|
| `slide.glb`  | Slide     | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/dDe3njWPbg0 |
| `swing.glb`  | Swing set | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/e-IJdcqZH4p |
| `seesaw.glb` | Seesaw    | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/fBaX63DY389 |
| `litter-bottle.glb`   | Trash Bag        | Quaternius     | Public Domain (CC0) | https://poly.pizza/m/jYrMKg2Q7C |
| `litter-lunchbox.glb` | Floor Trash      | J-Toastie      | CC-BY         | https://poly.pizza/m/3lZLV09iVD |
| `litter-cig.glb`      | Cigar butt       | Poly by Google | CC-BY 3.0     | https://poly.pizza/m/5Q0XzYoSD1X |
| `litter-flyer.glb`    | Debris Papers    | Quaternius     | Public Domain (CC0) | https://poly.pizza/m/CCRSdAJxsD |
| `litter-cup.glb`      | Rubbish          | Poly by Google | CC-BY 3.0     | https://poly.pizza/m/fxU6_KtzTiX |
| `dog.glb` | Dog | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/eDmSVe4TKwF |
| `cat.glb` | Cat | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/6dM1J6f6pm9 |
| `moto-vespa.glb` | Vespa | Jasmine Roberts | CC-BY | https://poly.pizza/m/blGLclvvdEM |
| `lantern.glb` | red lantern | Sophie Kim | CC-BY | https://poly.pizza/m/7PZhxLFiGc2 |
| `candelabra.glb` | Simple Candelabra | Don Carson | CC-BY | https://poly.pizza/m/b07YM_KsRhb |
| `incense-bowl.glb` | Bowl Dirty | Kay Lousberg | Public Domain (CC0) | https://poly.pizza/m/ASUKhSq7pS |
| `street-lamp.glb` | Street lamp | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/8hhAxfVhxyf |
| `food-udon.glb` | Udon | Quaternius | Public Domain (CC0) | https://poly.pizza/m/8eOp8bismL |
| `food-cooking-pot.glb` | Cooking Pot | Quaternius | Public Domain (CC0) | https://poly.pizza/m/jAUb3FoCN7 |
| `food-chopsticks.glb` | Chopsticks | Poly by Google | CC-BY | https://poly.pizza/m/f0piCrI4HrZ |
| `food-rice-bowl.glb` | Bowl of rice | jeremy | CC-BY | https://poly.pizza/m/clVUEgVMIiX |
| `food-drink-cup.glb` | Soda | Quaternius | Public Domain (CC0) | https://poly.pizza/m/IqXSdKUMnY |

CC-BY 3.0 可以商用、可以改,但要留這份 credit——公開發布時記得帶著這份清單
(或至少「遊具模型來自 Poly by Google,CC-BY 3.0」這句話),不要漏掉。

**`litter-*.glb` 這五個檔案的選型史(2026-08-14,長篇理由見
`scene-city3d.js` 的 `LITTER_MODELS` 那段程式註解,這裡只記版本異動,不重複
全文):**
1. 最早三個(bottle/cig/lunchbox)是舊 session 下載、沒留來源的檔案,靠
   SHA-256 雜湊比對反查回 Poly Pizza,分別是 Water bottle(Poly by Google)/
   一份查不到來源的 cig 檔案/Styrofoam Dinner(Kenney)。
2. 查不到來源的 cig 換成「Cigar butt」(Poly by Google,CC-BY 3.0)。
3. kc 玩起來覺得 bottle/lunchbox「很不像垃圾」——原本兩個是乾淨完整的
   產品模型,換成壓扁鋁罐(Soda Can Crushed,Kenney)+ 散落紙屑
   (Floor Trash,J-Toastie)。
4. bottle 換完鋁罐 kc 還是說「很不像」,再換成黑色垃圾袋(Trash Bag,
   Quaternius)——判準從「乾不乾淨」修正成「輪廓認不認得出」。同一輪把
   flyer/cup 兩個一度拿掉的 kind 也用同一個判準補回來:flyer 用 Debris
   Papers(Quaternius),cup 用 Rubbish(Poly by Google)。
上表是目前(第 4 版)的最終狀態,中間版本用過的檔案都沒有留著。

**`dog.glb`/`cat.glb`(2026-08-14):** 街上的小狗原本是跟主角同一套膠囊+球體
灰模拼的,kc 問「貓狗在哪,你要不要去抓一個模型來」,換成 Poly Pizza 的
Dog/Cat(都是 Poly by Google,CC-BY 3.0),順便補了一隻貓——原本只有狗。

**`food-*.glb`(2026-08-19):** 廟埕攤子桌面「擺滿商品」那件事,kc 一開始
想用照片貼圖解決,後來自己抓到「立體物件貼平面照片會很怪」(跟供桌
香爐/燭台同一個教訓,見 `scene-city3d.js` `placeAltarProp()` 那段舊筆記),
決定改抓真的 3D 小物——挑的都是碗麵/碗飯/筷子/鍋子/飲料這種攤子桌上會有
的東西,對應 `game.html` `FOOD` 陣列(魯肉飯/切仔麵/鹹酥雞/自助餐/熱炒/
豆漿)裡的品項。還沒接進 `stall()`,先下載放著,下一輪擺上去。
