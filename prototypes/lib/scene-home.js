/* no-way-up — 場景:家(平視 ＋ 深度移動)
 *
 * 純繪圖,不碰 DOM。人物沿用 SceneStoreFront.person(),不重畫一套。
 *
 * 色調:晚上十一點半的老公寓客廳。三種光源——
 *   日光燈(白，只開一盞) / 電視(藍白，會閃) / 神明燈(紅，一直亮著)
 * 寫實就好，不要陰森。見 DESIGN_NOTES「色調原則」。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 182;
  const WALK_N = 208, WALK_S = 338;

  const depthScale = y => 0.76 + 0.24 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    ceil:'#ded9cb', ceilEdge:'#c7c1b0', tube:'#ffffff', housing:'#c2beb0',
    wallHi:'#ddd1b7', wallLo:'#d1c4a8', wallDirt:'#c3b69b', kick:'#b3a488',
    floorA:'#d7ccb3', floorB:'#d0c4aa', floorSeam:'#bcaf95',

    night:'#131b26', nightGlow:'#22344a', bars:'#7e8478', winFrame:'#a8a496',

    doorMetal:'#8d9490', doorMetalD:'#6f7672', doorWood:'#9c7c53', doorWoodD:'#7b6040',
    shoeBox:'#a98c62', shoeBoxD:'#876f4d',

    godWood:'#63391f', godWoodD:'#4a2915', godCloth:'#8f2a20', godClothD:'#6e1f18',
    godGold:'#c9a24a', godLamp:'#ef5136', godSmoke:'#cfc6b4',

    sofa:'#5b6472', sofaD:'#464e5b', sofaHi:'#6d7686', cushion:'#7d6a58',
    teaTable:'#8a6b45', teaTableD:'#6b5234', glassTop:'#b9c3c0',

    tvStand:'#7d6244', tvBody:'#24272c', tvScreen:'#8fb4dc',
    fridge:'#e7e6df', fridgeD:'#cdccc3', magnet:'#d8563f',

    diningTop:'#c0a074', diningLeg:'#8a6b45', paper:'#f2ece0', paperInk:'#4a4438',
    cal:'#e8dfcb', calRed:'#b83a2c', clock:'#e6e2d6',

    momSkin:'#c99a72', momHair:'#2a2320', momTop:'#b8656a', momTopD:'#964f54',
    momPants:'#3f4654',
    dadSkin:'#b98a63', dadHair:'#26201c', dadTop:'#d8d3c4', dadTopD:'#b8b2a2',
    dadPants:'#4a4a52'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* ---------------- 背景 ---------------- */
  function renderBackground(g, opts) {
    const o = Object.assign({ tvOn: true, godLamp: true, vignette: true, sofaFront: true }, opts || {});
    const { px, alp } = tools(g);

    /* 天花板 + 一盞日光燈 */
    px(0, 0, W, 26, P.ceil);
    px(0, 24, W, 3, P.ceilEdge);
    px(268, 6, 104, 9, P.housing);
    px(274, 8, 92, 5, P.tube);
    alp(.34, () => px(258, 14, 124, 14, '#fdfbf2'));
    alp(.16, () => px(238, 14, 164, 34, '#fdfbf2'));

    /* 後牆 */
    px(0, 27, W, 96, P.wallHi);
    px(0, 123, W, FLOOR_TOP - 123 - 6, P.wallLo);
    alp(.16, () => { px(392, 44, 22, 74, P.wallDirt); px(126, 38, 14, 60, P.wallDirt);
                     px(590, 60, 20, 50, P.wallDirt); });
    px(0, FLOOR_TOP - 6, W, 6, P.kick);
    px(0, FLOOR_TOP - 6, W, 1, '#8f836b');

    /* 大門(鐵門 + 玄關鞋櫃) */
    (function () {
      const x = 10, y = 40, w = 76, h = FLOOR_TOP - 40 - 6;
      px(x - 4, y - 4, w + 8, h + 5, P.doorMetalD);
      px(x, y, w, h, P.doorMetal);
      for (let i = 0; i < 5; i++) px(x + 6, y + 10 + i * 22, w - 12, 3, P.doorMetalD);
      px(x + w - 14, y + h / 2 - 6, 5, 14, '#5e625f');            // 門把
      alp(.10, () => px(x, y, w, 20, '#fff'));
      /* 鞋櫃 + 幾雙鞋 */
      const sx = 96, sy = 138;
      px(sx, sy, 54, FLOOR_TOP - sy - 6, P.shoeBox);
      px(sx, sy, 54, 4, P.shoeBoxD);
      px(sx + 4, sy + 12, 20, 7, '#3d4149'); px(sx + 28, sy + 12, 20, 7, '#6d5a44');
      px(sx + 4, sy + 26, 20, 7, '#8c3f3a');
    })();

    /* 神明桌 —— 台灣客廳的中心。兩盞紅燈整夜亮著。 */
    (function () {
      const x = 168, top = 128, w = 84;
      /* 上方的神像框 */
      px(x + 8, 46, w - 16, 62, P.godWoodD);
      px(x + 12, 50, w - 24, 54, '#d9c9a6');
      alp(.55, () => px(x + 18, 56, w - 36, 42, '#b89a6a'));
      px(x + 10, 44, w - 20, 4, P.godGold);
      /* 桌身 */
      px(x, top, w, 8, P.godWood);
      px(x + 2, top + 8, w - 4, FLOOR_TOP - top - 14, P.godWoodD);
      px(x, top + 8, w, 14, P.godCloth);                          // 紅桌巾
      px(x, top + 20, w, 3, P.godClothD);
      for (let i = 0; i < 7; i++) px(x + 4 + i * 12, top + 22, 5, 5, P.godGold);
      /* 香爐、水果 */
      px(x + w / 2 - 9, top - 9, 18, 9, '#7a6a52');
      px(x + w / 2 - 11, top - 11, 22, 3, '#8d7c62');
      if (o.godLamp) {
        for (const lx of [x + 8, x + w - 16]) {
          px(lx, top - 14, 8, 14, '#6b4a2e');
          px(lx + 1, top - 18, 6, 6, P.godLamp);
          alp(.26, () => px(lx - 1, top - 21, 10, 11, P.godLamp));
          alp(.09, () => px(lx - 5, top - 25, 18, 19, P.godLamp));
        }
      }
      px(x + 22, top - 7, 6, 7, '#c46a2e'); px(x + 30, top - 6, 6, 6, '#d8a13a');
    })();

    /* 窗戶 + 鐵窗(在沙發上方) */
    (function () {
      const x = 286, y = 44, w = 104, h = 64;
      px(x - 5, y - 5, w + 10, h + 10, P.winFrame);
      px(x, y, w, h, P.night);
      alp(.30, () => px(x, y + h - 22, w, 22, P.nightGlow));
      alp(.55, () => { px(x + 20, y + 16, 6, 4, '#f0dfa8'); px(x + 74, y + 30, 4, 3, '#f0dfa8'); });
      for (let i = 0; i <= 5; i++) px(x + i * 20, y, 3, h, P.bars);
      px(x, y + h / 2 - 1, w, 3, P.bars);
      px(x - 5, y + h + 3, w + 10, 4, P.winFrame);
    })();

    /* 月曆 + 時鐘 */
    (function () {
      px(432, 46, 34, 46, P.cal);
      px(432, 46, 34, 11, P.calRed);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++)
        alp(.5, () => px(435 + i * 5, 61 + r * 8, 3, 3, '#7d7466'));
      px(120, 52, 22, 22, P.clock);
      px(122, 54, 18, 18, '#f6f3ea');
      px(130, 58, 2, 8, '#3a352c'); px(130, 62, 6, 2, '#3a352c');
    })();

    /* 電視櫃 + 電視 */
    (function () {
      const x = 470, y = 140, w = 80;
      px(x, y, w, FLOOR_TOP - y - 6, P.tvStand);
      px(x, y, w, 4, '#96784f');
      const tx = x + 6, ty = 96, tw = w - 12, th = 42;
      px(tx - 2, ty - 2, tw + 4, th + 4, '#15171a');
      px(tx, ty, tw, th, P.tvBody);
      if (o.tvOn) {
        px(tx + 3, ty + 3, tw - 6, th - 6, P.tvScreen);
        alp(.30, () => px(tx + 3, ty + 3, tw - 6, (th - 6) / 2, '#e8f2ff'));
      } else px(tx + 3, ty + 3, tw - 6, th - 6, '#1b1e23');
      px(x + w / 2 - 3, ty + th, 6, 4, '#15171a');
    })();

    /* 冰箱 */
    (function () {
      const x = 566, y = 78, w = 44, h = FLOOR_TOP - 78 - 6;
      px(x - 3, y - 3, w + 6, h + 5, P.fridgeD);
      px(x, y, w, h, P.fridge);
      px(x, y + 34, w, 3, P.fridgeD);
      px(x + w - 7, y + 12, 3, 18, '#b0aea4');
      px(x + w - 7, y + 44, 3, 22, '#b0aea4');
      px(x + 6, y + 8, 11, 14, P.paper);                          // 貼在門上的單子
      px(x + 20, y + 10, 6, 6, P.magnet);
      px(x + 8, y + 46, 14, 10, P.paper);
    })();

    /* 房間門(往裡面走 = 睡覺) */
    (function () {
      const x = 620, y = 40, w = 18, h = FLOOR_TOP - 40 - 6;
      px(x - 4, y - 4, w + 6, h + 5, P.doorWoodD);
      px(x, y, w, h, P.doorWood);
      px(x + 2, y + 12, w - 6, 40, P.doorWoodD);
      px(x + 2, y + 60, w - 6, 40, P.doorWoodD);
    })();

    /* 地板 */
    (function () {
      const T = 34;
      for (let y = FLOOR_TOP; y < H; y += T)
        for (let x = 0; x < W; x += T)
          px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? P.floorA : P.floorB);
      for (let x = 0; x <= W; x += T) alp(.26, () => px(x, FLOOR_TOP, 1, H - FLOOR_TOP, P.floorSeam));
      for (let y = FLOOR_TOP; y <= H; y += T) alp(.20, () => px(0, y, W, 1, P.floorSeam));
      alp(.20, () => px(250, FLOOR_TOP + 4, 142, 58, '#fdfbf2'));   // 日光燈打在地上
      alp(.11, () => px(230, FLOOR_TOP + 60, 182, 62, '#fdfbf2'));
      alp(.05, () => px(176, FLOOR_TOP, 72, 22, P.godLamp));        // 神明燈的紅
    })();

    /* 沙發、餐桌、曬衣架在走道前方,會參與深度排序,所以獨立成函式。
       匯出整張 PNG 時才一起畫。 */
    if (o.sofaFront) { sofa(g); dining(g); rack(g); }

    if (o.vignette) {
      alp(.08, () => {
        px(0, 0, W, 10, '#2f2a22'); px(0, H - 12, W, 12, '#2f2a22');
        px(0, 0, 9, H, '#2f2a22'); px(W - 9, 0, 9, H, '#2f2a22');
      });
    }
  }

  /* ---------------- 沙發(腳 y = 300) ---------------- */
  const SOFA = { x: 262, y: 300, w: 150, h: 74 };
  function sofa(g) {
    const { px, alp } = tools(g);
    const { x, y, w } = SOFA;
    const back = y - 74;
    px(x, back, w, 40, P.sofa);                                   // 椅背
    px(x, back, w, 5, P.sofaHi);
    px(x - 12, back + 6, 14, 46, P.sofaD);                        // 扶手
    px(x + w - 2, back + 6, 14, 46, P.sofaD);
    px(x, back + 38, w, 22, P.sofaHi);                            // 坐墊
    px(x + w / 2 - 1, back + 38, 2, 22, P.sofaD);
    px(x, back + 58, w, 16, P.sofaD);                             // 前緣
    px(x + 12, back + 12, 26, 24, P.cushion);                     // 抱枕
    alp(.18, () => px(x - 8, y - 4, w + 24, 7, '#4a4438'));       // 落地陰影
  }

  /* ---------------- 餐桌(腳 y = 268,靠牆) ---------------- */
  const DINING = { x: 432, y: 268, w: 92 };
  function dining(g, hasLetter) {
    const { px, alp } = tools(g);
    const { x, y, w } = DINING;
    const top = y - 44;
    px(x, top, w, 7, P.diningTop);
    px(x, top + 7, w, 3, P.diningLeg);
    px(x + 5, top + 10, 7, 34, P.diningLeg);
    px(x + w - 12, top + 10, 7, 34, P.diningLeg);
    /* 桌上:一封拆開的信、一個碗 */
    if (hasLetter !== false) {
      px(x + 12, top - 9, 26, 9, P.paper);
      px(x + 12, top - 9, 26, 2, '#ddd5c4');
      px(x + 15, top - 6, 15, 1, P.paperInk);
      px(x + 15, top - 4, 11, 1, P.paperInk);
      px(x + 36, top - 7, 9, 7, '#e6dcc8');                       // 被撕開的封口
    }
    px(x + 58, top - 7, 16, 7, '#e8e2d2');
    px(x + 60, top - 9, 12, 3, '#cfc7b4');
    alp(.16, () => px(x - 2, y - 3, w + 4, 6, '#4a4438'));
  }

  /* ---------------- 曬衣架(前景,玩家從它後面走過) ----------------
   * 客廳晾衣服是台灣公寓的標配。放在最前方當前景遮擋,空間深度立刻出來。
   */
  const RACK = { x: 30, y: 352, w: 186 };
  function rack(g) {
    const { px, alp } = tools(g);
    const { x, y, w } = RACK;
    const top = y - 116;
    alp(.14, () => px(x - 6, y - 5, w + 12, 8, '#4a4438'));
    px(x, top, 5, 116, '#b6b9b1');                                // 立柱
    px(x + w - 5, top, 5, 116, '#b6b9b1');
    px(x - 10, y - 6, 25, 6, '#a3a69e');                          // 底座
    px(x + w - 15, y - 6, 25, 6, '#a3a69e');
    px(x, top, w, 5, '#c6c9c0');                                  // 橫桿
    /* 掛著的東西:制服襯衫、T恤、毛巾、洗到發白的內衣 */
    const hang = [
      [14, 62, 40, '#eeead9', '#dcd7c4'],                          // 白制服
      [60, 54, 36, '#43506b', '#36415a'],                          // 深色 T
      [102, 46, 30, '#c9d2cc', '#b3bdb7'],                         // 毛巾
      [138, 40, 34, '#e6e2d4', '#d3cec0']
    ];
    hang.forEach(([dx, h, cw, c, cd]) => {
      px(x + dx + cw / 2 - 5, top + 3, 10, 6, '#9aa0a6');         // 衣架
      px(x + dx, top + 8, cw, h, c);
      px(x + dx, top + 8, cw, 5, cd);
      px(x + dx, top + 8 + h - 4, cw, 4, cd);
    });
  }

  /* ---------------- 電視的光(每幀疊加,會閃) ---------------- */
  function tvGlow(g, t) {
    const { px, alp } = tools(g);
    const f = 0.55 + 0.45 * Math.abs(Math.sin(t / 620) * Math.cos(t / 260));
    alp(.16 * f, () => px(430, 92, 172, 96, P.tvScreen));
    alp(.11 * f, () => px(360, FLOOR_TOP, 280, 78, P.tvScreen));
    alp(.07 * f, () => px(262, 210, 170, 60, P.tvScreen));
  }

  root.SceneHome = {
    W, H, P, FLOOR_TOP, WALK_N, WALK_S, SOFA, DINING, RACK,
    depthScale, renderBackground, sofa, dining, rack, tvGlow
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
