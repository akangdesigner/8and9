/* no-way-up — 場景:超商(平視 ＋ 深度移動)
 *
 * 純繪圖,不碰 DOM。兩邊共用:
 *   - prototypes/store-walk.html   → 可走動的互動原型
 *   - tools/render-scene.mjs       → 輸出乾淨背景 PNG,拿去給 GPT 上質感
 *
 * ctx 只需要 fillStyle / fillRect / globalAlpha 三樣。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 176;                 // 地板起點(後牆底)
  const WALK_N = 198, WALK_S = 332;      // 角色可走的深度範圍(腳的 y)
  const HOT = { x: 236, y: 262, w: 186, hFace: 46 };   // 鮮食櫃,y 是它的「腳」
  const TUBES = [[40, 180], [240, 380], [440, 590]];   // 日光燈管

  const depthScale = y => 0.76 + 0.24 * ((y - WALK_N) / (WALK_S - WALK_N));

  /* 把 hex 顏色調暗一點,拿來配陰影/次要色調,不用另外手挑一個色碼——
   * 主色改了,配色跟著變,不會漂移。 */
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.round(((n >> v) & 255) * k);
    return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
  };

  /* 色調基準:真實的台灣超商,晚上八點——裡面亮到有點刺眼,外面才是暗的。
     不要陰森。歧視發生在明亮正常的地方,那才是重點。見 DESIGN_NOTES「美術與視角」。 */
  const P = {
    ceil:'#3e444c', ceilRib:'#333941', tube:'#ffffff', tubeOff:'#e4eae0', housing:'#b0b9b1',
    wallHi:'#dfe2d8', wallLo:'#d5d9cd', wallDirt:'#cbcfc3', kick:'#adb2a5',
    floorA:'#ced2c8', floorB:'#c7cbc1', floorSeam:'#b6bbb0', floorGloss:'#f2f4ec',
    night:'#101825', nightGlow:'#263a55', street:'#f2e4b0', lamp:'#4c5c3a',
    doorFrame:'#8a939d', doorGlass:'#1d2d3f', doorLit:'#334a66',
    fridgeBody:'#909aa2', fridgeEdge:'#6e7780', fridgeGlass:'#2c5768', fridgeLit:'#84d8ee',
    bottleA:'#e2542c', bottleB:'#2faa60', bottleC:'#f4c317', bottleD:'#2f82d2',
    shelfMetal:'#b6bab1', shelfDark:'#8e938a', shelfPlate:'#c2c7bd',
    hotBody:'#d4762f', hotDark:'#a15a22', hotInner:'#c4c9bf',
    bento:'#e8dfc8', bentoLid:'#cfc3a4', tagY:'#f0c22c', tagW:'#f2efe4', ink:'#191c21',
    counter:'#9c8c72', counterTop:'#b3a68c', reg:'#5a626d', regScreen:'#7fd4c4',
    /* 主角外觀不寫死在這裡——讀 lib/character.js 那份共用資料,3D 街上跟這裡
     * 才不會各改各的、看起來像換了個人(2026-08-12 kc:「就是一致啊」)。
     * pcHoodD 是帽 T 的陰影色,用 shade() 從 pcHood 算,不用另外挑色碼。 */
    pcSkin:root.Character.skin, pcHair:root.Character.hair, pcHood:root.Character.hood,
    pcHoodD:shade(root.Character.hood, .78), pcPants:root.Character.pants,
    pcShoe:root.Character.shoe,
    npcSkin:'#d6ab86', npcHair:'#1d1916', npcShirt:'#f2f5f2', npcShirtD:'#d8ddd8',
    npcPants:'#3a4460', npcBag:'#6b5a3c',
    /* clVest 改成 LIFE POINT 招牌那個紫色(assets/tex/sign-store.png 上取樣,
       #4a09b6),讓店員看起來像穿了這家店的制服,不是隨便一件毛衣。2026-08-13
       kc 提的,見 DESIGN_NOTES「室內固定物件的碰撞」那節旁邊那則筆記。這是
       純色近似,不是真的印花/名牌制服貼圖——那個等級要另外生一張像阿源
       (`char-yuan-shirt.png`)那種材質圖,現在先用同色系。 */
    clSkin:'#cfa279', clHair:'#201b17', clVest:'#4a09b6', clShirt:'#eceadd'
  };

  /* 把 ctx 包成 px / alp 兩個小工具 */
  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* ---------------- 背景(不含人物、不含顆粒) ---------------- */
  function renderBackground(g, opts) {
    /* hotFood/vignette 預設開 —— 匯出 PNG 時要完整的一張。
       遊戲裡兩個都關掉:鮮食櫃要參與深度排序,暗角要蓋在人物之上。 */
    const o = Object.assign({ doorOpen: 0, taken: false, flick: false,
                              vignette: true, hotFood: true }, opts || {});
    const { px, alp } = tools(g);

    /* 天花板與日光燈 */
    px(0, 0, W, 38, P.ceil);
    for (let x = 0; x < W; x += 40) px(x, 0, 2, 38, P.ceilRib);
    px(0, 36, W, 2, '#171b22');
    for (const [a, b] of TUBES) {
      px(a - 3, 12, (b - a) + 6, 14, P.housing);
      px(a, 15, b - a, 8, o.flick ? P.tubeOff : P.tube);
      alp(.40, () => px(a - 6, 25, (b - a) + 12, 16, '#f4faf0'));
      alp(.22, () => px(a - 14, 25, (b - a) + 28, 34, '#f4faf0'));
    }

    /* 後牆 */
    px(0, 38, W, 84, P.wallHi);
    px(0, 122, W, FLOOR_TOP - 122 - 7, P.wallLo);
    alp(.20, () => { px(96, 60, 30, 70, P.wallDirt); px(300, 52, 18, 90, P.wallDirt); px(590, 70, 26, 60, P.wallDirt); });
    px(0, FLOOR_TOP - 7, W, 7, P.kick);
    px(0, FLOOR_TOP - 7, W, 1, '#6d7267');

    /* 自動門 */
    (function () {
      const x = 10, y = 44, w = 116, h = FLOOR_TOP - 44 - 7, s = Math.round(o.doorOpen * 26);
      px(x - 4, y - 4, w + 8, h + 6, P.doorFrame);
      px(x, y, w, h, P.night);
      alp(.55, () => px(x + 62, y + 8, 40, 42, P.lamp));       // 外面的路燈
      px(x + 78, y + 12, 8, 3, P.street);
      px(x + 8, y + 30, 30, 12, '#101823');                    // 對街暗掉的招牌
      alp(.35, () => px(x, y + h - 26, w, 26, P.nightGlow));   // 濕掉的地面反光
      leaf(x + 2 - s); leaf(x + w / 2 + s);
      function leaf(lx) {
        px(lx, y + 2, w / 2 - 4, h - 4, P.doorGlass);
        alp(.42, () => px(lx, y + 2, w / 2 - 4, 26, P.doorLit));
        px(lx, y + 2, w / 2 - 4, 3, '#5e6874'); px(lx, y + h - 8, w / 2 - 4, 6, '#5e6874');
        px(lx, y + 2, 2, h - 4, '#5e6874'); px(lx + w / 2 - 6, y + 2, 2, h - 4, '#5e6874');
        alp(.12, () => { for (let i = 0; i < 11; i++) px(lx + 4 + i * 2, y + 8 + i * 4, 5, 3, '#fff'); });
      }
    })();

    /* 飲料冰櫃 */
    (function () {
      const x = 140, y = 48, w = 158, h = FLOOR_TOP - 48 - 7;
      px(x - 3, y - 3, w + 6, h + 5, P.fridgeEdge);
      px(x, y, w, h, P.fridgeBody);
      for (let d = 0; d < 3; d++) {
        const dx = x + 4 + d * 52;
        px(dx, y + 4, 46, h - 11, P.fridgeGlass);
        for (let r = 0; r < 4; r++) {
          const sy = y + 9 + r * 26;
          px(dx + 2, sy + 19, 42, 2, '#28505f');
          for (let b = 0; b < 6; b++) {
            px(dx + 3 + b * 7, sy + 4, 5, 15, [P.bottleA, P.bottleB, P.bottleC, P.bottleD][(b + r + d) % 4]);
            px(dx + 4 + b * 7, sy + 1, 3, 3, '#c0c8cd');
          }
        }
        alp(.18, () => px(dx, y + 4, 46, h - 11, P.fridgeLit));
        alp(.10, () => { for (let i = 0; i < 14; i++) px(dx + 3 + i * 3, y + 8 + i * 5, 6, 3, '#fff'); });
        px(dx + 42, y + 30, 2, 26, '#9aa4ad');                 // 門把
      }
      px(x, y, w, 3, '#8e98a1');
    })();

    /* 靠牆貨架 */
    (function () {
      const x = 316, y = 64, w = 126, h = FLOOR_TOP - 64 - 7;
      px(x - 2, y - 2, w + 4, h + 4, P.shelfDark);
      px(x, y, w, h, P.shelfMetal);
      for (let r = 0; r < 4; r++) {
        const sy = y + 6 + r * 24;
        px(x + 3, sy + 17, w - 6, 3, P.shelfPlate);
        for (let i = 0; i < 7; i++)
          px(x + 4 + i * 17, sy + 3, 14, 14, [P.bottleA, P.bottleD, P.bottleC, '#7a6a80', '#6f8272'][(i + r) % 5]);
      }
    })();

    /* 櫃台 */
    (function () {
      const x = 462, yTop = 118, w = W - 462 - 8, h = FLOOR_TOP - 118 - 7;
      px(x - 4, 52, w + 8, 60, '#93998c');                     // 後面的菸櫃
      for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++)
        px(x + i * 22, 56 + r * 18, 18, 13, [P.bottleA, '#7a6a80', P.bottleC, P.bottleD][(i + r) % 4]);
      px(x, yTop, w, h, P.counter);
      px(x, yTop, w, 4, P.counterTop);
      px(x + 16, yTop - 20, 40, 20, P.reg);                    // 收銀機
      px(x + 20, yTop - 16, 32, 10, P.regScreen);
      px(x + 76, yTop - 14, 20, 14, '#d5cfba'); px(x + 78, yTop - 11, 16, 5, '#a4523a');
    })();

    /* 地板 */
    (function () {
      const T = 32;
      for (let y = FLOOR_TOP; y < H; y += T)
        for (let x = 0; x < W; x += T)
          px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? P.floorA : P.floorB);
      for (let x = 0; x <= W; x += T) alp(.30, () => px(x, FLOOR_TOP, 1, H - FLOOR_TOP, P.floorSeam));
      for (let y = FLOOR_TOP; y <= H; y += T) alp(.22, () => px(0, y, W, 1, P.floorSeam));
      for (const [a, b] of TUBES) {                            // 燈打在地上的反光
        alp(.22, () => px(a + 6, FLOOR_TOP + 6, (b - a) - 12, 54, P.floorGloss));
        alp(.13, () => px(a + 20, FLOOR_TOP + 58, (b - a) - 40, 70, P.floorGloss));
      }
      alp(.10, () => px(150, FLOOR_TOP, 180, 40, P.fridgeLit)); // 冰櫃冷光溢出
      alp(.05, () => px(10, FLOOR_TOP, 130, 50, '#2a4568'));    // 門口滲進來的夜(很淡就好)
    })();

    if (o.hotFood) hotFood(g, o.taken);

    /* 暗角壓到幾乎看不見 —— 只是收一下畫面邊緣,不製造氣氛 */
    if (o.vignette) {
      alp(.09, () => {
        px(0, 0, W, 12, '#2a3038'); px(0, H - 14, W, 14, '#2a3038');
        px(0, 0, 10, H, '#2a3038'); px(W - 10, 0, 10, H, '#2a3038');
      });
    }
  }

  /* ---------------- 鮮食櫃(會參與深度排序,所以獨立成函式) ---------------- */
  function hotFood(g, taken) {
    const { px, alp } = tools(g);
    const { x, y, w, hFace } = HOT;
    const top = y - hFace - 26;
    px(x - 3, top - 3, w + 6, hFace + 32, P.hotDark);
    px(x, top, w, 26, P.hotInner);                             // 頂面
    px(x, top, w, 4, P.hotBody);
    [1, 1, 0, 1, 1, 0, 1].forEach((h, i) => {                  // 便當,空了幾格
      if (!h || (i === 4 && taken)) return;
      const bx = x + 8 + i * 25;
      px(bx, top + 6, 20, 15, P.bento);
      px(bx, top + 6, 20, 4, P.bentoLid);
      if (i >= 3) px(bx, top + 18, 20, 3, P.tagY);             // 黃標
      alp(.22, () => px(bx, top + 6, 20, 2, '#fff'));
    });
    px(x, y - hFace, w, hFace, P.hotBody);                     // 正面
    px(x, y - hFace, w, 3, '#5f3618');
    px(x, y - 5, w, 5, '#57320f');
    px(x + 12, y - hFace + 10, 30, 13, P.tagW);                // 正價牌
    px(x + 128, y - hFace + 10, 30, 13, P.tagY);               // 黃標牌
    alp(.20, () => px(x + 4, y, w - 8, 6, '#3a3f46'));         // 落地陰影
  }

  /* ---------------- 人物:平視,看得到臉 ----------------
   * face: 'L' | 'R' | 'B'(背對) | 'F'(正面)
   */
  function person(g, cx, footY, o) {
    const { px, alp } = tools(g);
    const { face = 'F', skin, hair, top, topD, pants, shoe = P.ink, bag = false, hood = false,
            hold = false, walk = 0, s = 1 } = o;
    /* k 可以直接指定 —— 換成真實背景圖之後,深度縮放要跟著那張圖的地面走,
       不再是模組內建的 WALK_N/WALK_S。 */
    const k = (o.k != null ? o.k : depthScale(footY)) * s;
    const u = n => Math.round(n * k);
    const x = Math.round(cx), b = Math.round(footY);

    alp(.22, () => px(x - u(16), b - u(3), u(32), u(7), '#33383f'));

    const swing = walk ? (walk > 0 ? u(4) : -u(4)) : 0;
    px(x - u(12), b - u(34), u(11), u(34), pants);
    px(x + u(2),  b - u(34), u(11), u(34), pants);
    px(x - u(13) - swing, b - u(6), u(14), u(6), shoe);
    px(x + u(1)  + swing, b - u(6), u(14), u(6), shoe);

    px(x - u(15), b - u(74), u(30), u(42), top);
    px(x - u(15), b - u(74), u(30), u(9), topD);
    if (face === 'L') px(x - u(15), b - u(72), u(6), u(38), topD);
    if (face === 'R') px(x + u(9),  b - u(72), u(6), u(38), topD);

    if (bag) {
      px(x - u(20), b - u(68), u(9), u(30), P.npcBag);
      px(x - u(15), b - u(76), u(30), u(6), '#42361f');
    }
    px(x - u(20), b - u(72), u(6), u(30), top);
    px(x + u(14), b - u(72), u(6), u(30), top);
    px(x - u(20), b - u(43), u(6), u(7), skin);
    px(x + u(14), b - u(43), u(6), u(7), skin);

    if (hold) {
      const hx = face === 'L' ? x - u(30) : x + u(16);
      px(hx, b - u(48), u(20), u(13), P.bento);
      px(hx, b - u(48), u(20), u(5), P.bentoLid);
      px(hx, b - u(53), u(9), u(5), P.tagY);
    }

    const hy = b - u(102);
    px(x - u(12), hy, u(24), u(28), skin);
    px(x - u(13), hy - u(4), u(26), u(12), hair);
    px(x - u(13), hy + u(4), u(4), u(13), hair);
    px(x + u(9),  hy + u(4), u(4), u(13), hair);
    if (hood) {
      px(x - u(17), hy - u(6), u(34), u(16), P.pcHoodD);
      px(x - u(17), hy + u(6), u(5), u(20), P.pcHoodD);
      px(x + u(12), hy + u(6), u(5), u(20), P.pcHoodD);
    }
    /* 臉 —— 平視最值錢的地方 */
    if (face === 'B') {
      px(x - u(12), hy, u(24), u(24), hair);                   // 背對:只有後腦
    } else if (face === 'F') {
      px(x - u(7), hy + u(12), u(5), u(5), P.ink);
      px(x + u(3), hy + u(12), u(5), u(5), P.ink);
      alp(.35, () => px(x - u(2), hy + u(20), u(5), u(2), '#8a6a55'));
    } else {
      const d = face === 'R' ? 1 : -1;
      px(x + d * u(3) - u(2), hy + u(12), u(5), u(5), P.ink);  // 側臉一隻眼
      px(x + d * u(12), hy + u(14), u(3), u(4), skin);         // 鼻尖
      px(x - d * u(13), hy - u(2), u(10), u(10), hair);
    }
  }

  root.SceneStoreFront = {
    W, H, P, FLOOR_TOP, WALK_N, WALK_S, HOT, TUBES,
    depthScale, renderBackground, hotFood, person
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
