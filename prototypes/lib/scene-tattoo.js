/* no-way-up — 場景:刺青店(平視 ＋ 深度移動)
 *
 * 純繪圖,不碰 DOM。人物沿用 SceneStoreFront.person(),不重畫一套。
 * 結構比照 scene-home.js。
 *
 * 色調:晚上的街邊刺青店。三種光源——
 *   日光燈(白,兩盞全開) / 工作燈(暖白,打在椅子上) / 門口招牌(紅,從玻璃透進來)
 *
 * ⚠ 這間店不是黑幫巢穴。真實的台灣街邊刺青店是亮的、牆上五顏六色、
 *   有電風扇在轉、師傅在滑手機。畫成陰暗巢穴就變成獵奇展示,
 *   正好違反基準線。見 DESIGN_NOTES「色調原則:寫實就好,不要陰森」。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 182;
  const WALK_N = 208, WALK_S = 338;

  const depthScale = y => 0.76 + 0.24 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    ceil:'#e4e2dc', ceilEdge:'#ccc9c1', tube:'#ffffff', housing:'#c6c3ba',
    wallHi:'#e0ddd3', wallLo:'#d5d1c5', wallDirt:'#c6c1b3', kick:'#9fa6a8',
    tile:'#dcdcd6', tileSeam:'#c4c4bc',

    floorA:'#b9c0c4', floorB:'#b2b9be', floorSeam:'#9ba3a8',

    glass:'#5f7079', glassHi:'#8fa3ab', frame:'#8a8f8c', night:'#1a212b',
    neonR:'#e0483a', neonP:'#d05fa0',

    /* 圖牆:紙是米白的,圖是彩的 —— 這面牆是整個場景的顏色來源 */
    paper:'#f3efe2', paperEdge:'#ded8c6', pin:'#b0552f',
    ink1:'#2a2622', ink2:'#b83a2c', ink3:'#3f6ea8', ink4:'#5a9d63',
    ink5:'#d8a13a', ink6:'#7a4a92',

    chairBody:'#2b2e34', chairHi:'#3d424a', chairSeam:'#1e2126',
    chairArm:'#23262b', chairMetal:'#9aa0a6', chairPad:'#33383f',

    bench:'#c9c6bd', benchD:'#adaaa1', benchLeg:'#8d918e',
    machine:'#4a4f57', machineHi:'#6b727c', cord:'#2c2f34',
    wrap:'#dfe6e4', glove:'#3f6ea8', gloveBox:'#e8e4d8',
    steri:'#b8bcc0', steriD:'#93979b', steriLamp:'#5fb87a',

    caseGlass:'#cfe0e4', caseFrame:'#a5a9a6', caseLit:'#f2f7f6',
    stool:'#3a3f46', fan:'#dcd9cf', fanBlade:'#c3c0b6',
    bin:'#5c6166', mag:'#d8563f', plastic:'#7f8a90',

    workLamp:'#ffe9c4', shade:'#b6b3a8',
    mSkin:'#c08e66', mHair:'#221d1a', mTop:'#2f3a44', mTopD:'#25303a', mPants:'#3a3f46'
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
    const o = Object.assign({ lit: true, neon: true, vignette: true, chairFront: true }, opts || {});
    const { px, alp } = tools(g);

    /* 天花板 + 兩盞日光燈(全開,這間店很亮) */
    px(0, 0, W, 26, P.ceil);
    px(0, 24, W, 3, P.ceilEdge);
    for (const lx of [150, 400]) {
      px(lx, 6, 112, 9, P.housing);
      px(lx + 6, 8, 100, 5, P.tube);
      alp(.34, () => px(lx - 12, 14, 136, 14, '#fdfbf2'));
      alp(.15, () => px(lx - 34, 14, 180, 36, '#fdfbf2'));
    }

    /* 後牆 —— 上半白牆,下半貼到腰的磁磚(衛生要求,好擦) */
    px(0, 27, W, 74, P.wallHi);
    px(0, 101, W, FLOOR_TOP - 101 - 7, P.tile);
    for (let x = 0; x < W; x += 32) alp(.5, () => px(x, 101, 1, FLOOR_TOP - 108, P.tileSeam));
    for (let y = 101; y < FLOOR_TOP - 7; y += 26) alp(.4, () => px(0, y, W, 1, P.tileSeam));
    px(0, 99, W, 3, '#c9c5b8');
    alp(.12, () => { px(212, 40, 16, 52, P.wallDirt); px(596, 52, 18, 42, P.wallDirt); });
    px(0, FLOOR_TOP - 7, W, 7, P.kick);
    px(0, FLOOR_TOP - 7, W, 1, '#868e91');

    /* 玻璃門(往街上。外面是暗的,招牌的紅光透進來) */
    (function () {
      const x = 12, y = 36, w = 78, h = FLOOR_TOP - 36 - 7;
      px(x - 5, y - 5, w + 10, h + 6, P.frame);
      px(x, y, w, h, P.night);
      alp(.30, () => px(x, y + h - 30, w, 30, P.glass));
      alp(.22, () => px(x + 6, y + 8, w - 12, 26, P.glassHi));      // 玻璃反光
      px(x + w / 2 - 2, y, 4, h, P.frame);                          // 中框
      px(x + w - 16, y + h / 2 - 8, 5, 18, '#6e736f');              // 門把
      /* 貼在玻璃上的東西:營業時間、一張手寫的「消毒完成」 */
      px(x + 8, y + 44, 22, 14, '#e8e2d2');
      px(x + 44, y + 62, 18, 11, '#e8e2d2');
      if (o.neon) {
        /* 門上方的燈箱招牌,只看得到打進來的光 */
        alp(.28, () => px(x - 6, y - 6, w + 12, 22, P.neonR));
        alp(.10, () => px(x - 14, y - 6, w + 28, 54, P.neonR));
      }
    })();

    /* 等候區:兩張塑膠椅 + 小茶几,茶几上有雜誌跟喝到一半的飲料 */
    (function () {
      const y = FLOOR_TOP - 7;
      for (const cx of [106, 148]) {
        px(cx, y - 44, 34, 5, P.plastic);                           // 椅背
        px(cx, y - 40, 5, 12, P.plastic);
        px(cx + 29, y - 40, 5, 12, P.plastic);
        px(cx, y - 28, 34, 6, P.plastic);                           // 椅面
        px(cx + 3, y - 22, 4, 22, '#6b747a');
        px(cx + 27, y - 22, 4, 22, '#6b747a');
      }
      px(192, y - 30, 44, 5, P.bench);                              // 茶几
      px(196, y - 25, 5, 25, P.benchLeg);
      px(227, y - 25, 5, 25, P.benchLeg);
      px(198, y - 36, 18, 6, P.mag);                                // 雜誌
      px(198, y - 37, 18, 2, '#e8825f');
      px(222, y - 39, 7, 9, '#8fb4dc');                             // 飲料杯
      px(221, y - 41, 9, 3, '#dfe6e4');
    })();

    /* ============ 圖牆 ============
     * 整面貼滿圖稿。這是刺青店最有辨識度的一件事,也是這個場景的顏色來源。
     * 三排,每排一格一格,每格畫一個抽象的圖案。 */
    (function () {
      const x0 = 250, y0 = 34, cw = 42, ch = 34, gap = 4;
      const cols = 8, rows = 2;
      /* 底板 */
      px(x0 - 6, y0 - 6, cols * (cw + gap) + 8, rows * (ch + gap) + 8, '#cfc9b8');
      px(x0 - 6, y0 - 6, cols * (cw + gap) + 8, 3, '#bdb7a6');

      let seed = 7;
      const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
      const inks = [P.ink1, P.ink2, P.ink3, P.ink4, P.ink5, P.ink6];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = x0 + c * (cw + gap), y = y0 + r * (ch + gap);
          px(x, y, cw, ch, P.paper);
          px(x, y, cw, 2, P.paperEdge);
          px(x, y + ch - 2, cw, 2, P.paperEdge);
          /* 每張紙上的圖:兩三塊色 + 幾條線,遠看就是「有東西」 */
          const a = inks[(rnd() * inks.length) | 0], b = inks[(rnd() * inks.length) | 0];
          const bw = 10 + (rnd() * 14 | 0), bh = 8 + (rnd() * 12 | 0);
          const bx = x + 5 + (rnd() * (cw - bw - 10) | 0);
          const by = y + 5 + (rnd() * (ch - bh - 8) | 0);
          alp(.85, () => px(bx, by, bw, bh, a));
          alp(.6,  () => px(bx + 3, by + 3, (bw / 2) | 0, (bh / 2) | 0, b));
          for (let i = 0; i < 3; i++)
            alp(.5, () => px(x + 4 + (rnd() * (cw - 12) | 0), y + 5 + (rnd() * (ch - 10) | 0),
                             6 + (rnd() * 8 | 0), 1, P.ink1));
          px(x + cw / 2 - 2, y - 2, 4, 4, P.pin);                   // 圖釘
        }
      }
    })();

    /* 電風扇(掛在圖牆右邊的牆上) */
    (function () {
      const x = 596, y = 44;
      px(x, y, 30, 30, P.fan);
      px(x + 3, y + 3, 24, 24, P.fanBlade);
      px(x + 13, y + 3, 4, 24, P.fan);
      px(x + 3, y + 13, 24, 4, P.fan);
      px(x + 12, y + 12, 6, 6, '#9a978d');
      px(x + 13, y + 30, 4, 8, '#a8a599');
    })();

    /* ============ 工作檯(靠右牆) ============ */
    (function () {
      const x = 430, y = 138, w = 148;
      px(x, y, w, 7, P.bench);                                      // 檯面
      px(x, y + 7, w, 4, P.benchD);
      px(x + 4, y + 11, 6, FLOOR_TOP - y - 18, P.benchLeg);
      px(x + w - 10, y + 11, 6, FLOOR_TOP - y - 18, P.benchLeg);
      alp(.10, () => px(x + 12, y + 12, w - 26, FLOOR_TOP - y - 20, '#2f2a22'));  // 檯下陰影

      /* 一排墨水瓶 —— 彩色的,這是刺青店的第二個顏色來源 */
      const inks = [P.ink1, P.ink2, P.ink3, P.ink4, P.ink5, P.ink6, P.ink2, P.ink1];
      inks.forEach((c, i) => {
        const ix = x + 8 + i * 11;
        px(ix, y - 13, 8, 13, c);
        alp(.35, () => px(ix, y - 13, 3, 13, '#ffffff'));           // 瓶身高光
        px(ix + 1, y - 16, 6, 3, '#d9d5c8');                        // 瓶蓋
      });

      /* 刺青機 + 線 */
      px(x + 104, y - 16, 9, 16, P.machine);
      px(x + 103, y - 20, 11, 5, P.machineHi);
      px(x + 106, y - 26, 4, 7, P.chairMetal);
      alp(.7, () => { px(x + 96, y - 6, 10, 2, P.cord); px(x + 86, y - 4, 12, 2, P.cord); });

      /* 手套盒 + 保鮮膜 */
      px(x + 118, y - 18, 22, 18, P.gloveBox);
      px(x + 118, y - 18, 22, 4, '#d5d0c0');
      px(x + 124, y - 14, 10, 6, P.glove);
      px(x + 4, y - 24, 14, 11, P.wrap);
      alp(.45, () => px(x + 5, y - 24, 4, 11, '#ffffff'));
    })();

    /* 消毒鍋(工作檯左邊,綠燈亮著 —— 這間店是有在消毒的) */
    (function () {
      const x = 398, y = 128;
      px(x, y, 30, 26, P.steri);
      px(x, y, 30, 4, P.steriD);
      px(x + 3, y + 7, 20, 14, '#8e9296');
      alp(.35, () => px(x + 4, y + 8, 18, 5, '#cfd4d8'));
      px(x + 25, y + 9, 4, 4, P.steriLamp);
      alp(.3, () => px(x + 23, y + 7, 8, 8, P.steriLamp));
      px(x + 2, y + 26, 26, 4, P.steriD);
      px(x + 4, y + 30, 22, FLOOR_TOP - y - 37, P.benchLeg);
    })();

    /* 玻璃展示櫃(最右,裡面是耳環鼻環,自己會發光) */
    (function () {
      const x = 588, y = 116, w = 46, h = FLOOR_TOP - 116 - 7;
      px(x - 3, y - 3, w + 6, h + 4, P.caseFrame);
      px(x, y, w, h, P.caseGlass);
      alp(.55, () => px(x + 2, y + 2, w - 4, 14, P.caseLit));       // 櫃內燈
      px(x, y + 24, w, 2, P.caseFrame);
      px(x, y + 48, w, 2, P.caseFrame);
      for (let i = 0; i < 5; i++) {
        px(x + 5 + i * 8, y + 17, 4, 4, i % 2 ? P.ink5 : P.chairMetal);
        px(x + 6 + i * 8, y + 41, 3, 5, i % 2 ? P.chairMetal : P.ink5);
      }
      alp(.20, () => px(x + 3, y + 4, 8, h - 10, '#ffffff'));       // 玻璃反光
    })();

    /* 垃圾桶(踩開式,旁邊地上一捲掉下來的紙膠帶) */
    (function () {
      const y = FLOOR_TOP + 26;
      px(556, y - 34, 26, 34, P.bin);
      px(556, y - 34, 26, 4, '#71767b');
      px(554, y - 37, 30, 4, '#6a6f74');
      px(586, y - 6, 7, 6, '#c9c6bd');
    })();

    /* 地板 —— 塑膠地板,比家乾淨(要好擦) */
    (function () {
      const T = 40;
      for (let y = FLOOR_TOP; y < H; y += T)
        for (let x = 0; x < W; x += T)
          px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? P.floorA : P.floorB);
      for (let x = 0; x <= W; x += T) alp(.22, () => px(x, FLOOR_TOP, 1, H - FLOOR_TOP, P.floorSeam));
      for (let y = FLOOR_TOP; y <= H; y += T) alp(.16, () => px(0, y, W, 1, P.floorSeam));

      alp(.20, () => px(126, FLOOR_TOP + 2, 156, 56, '#fdfbf2'));   // 日光燈打在地上
      alp(.20, () => px(376, FLOOR_TOP + 2, 156, 56, '#fdfbf2'));
      alp(.10, () => px(100, FLOOR_TOP + 56, 200, 60, '#fdfbf2'));
      alp(.06, () => px(20, FLOOR_TOP, 90, 30, P.neonR));           // 門口招牌的紅

      /* 地上的電線,從工作檯拉到椅子 */
      alp(.5, () => { px(430, FLOOR_TOP + 30, 60, 3, P.cord); px(400, FLOOR_TOP + 33, 34, 3, P.cord); });
    })();

    /* 刺青椅在走道前方,會參與深度排序,所以獨立成函式。
       匯出整張 PNG 時才一起畫。 */
    if (o.chairFront) { chair(g); stool(g); }

    if (o.vignette) {
      alp(.06, () => {
        px(0, 0, W, 10, '#2f2a22'); px(0, H - 12, W, 12, '#2f2a22');
        px(0, 0, 9, H, '#2f2a22'); px(W - 9, 0, 9, H, '#2f2a22');
      });
    }
  }

  /* ---------------- 刺青椅(腳 y = 306,前景遮擋) ----------------
   * 可調式皮躺椅,黑色。玩家從它後面走過去 —— 前景遮擋是空間深度最便宜的來源。
   * 這張椅子是這個場景的重點:你走到它前面,就是要在自己身上留下永久的東西。
   */
  const CHAIR = { x: 268, y: 306, w: 138 };
  function chair(g) {
    const { px, alp } = tools(g);
    const { x, y, w } = CHAIR;
    const seat = y - 46;

    alp(.20, () => px(x - 10, y - 4, w + 26, 8, '#3a4045'));        // 落地陰影

    px(x + w - 44, seat - 52, 44, 54, P.chairBody);                 // 椅背(往右仰)
    px(x + w - 44, seat - 52, 44, 6, P.chairHi);
    px(x + w - 44, seat - 26, 44, 2, P.chairSeam);
    px(x, seat, w, 20, P.chairBody);                                // 坐墊
    px(x, seat, w, 5, P.chairHi);
    px(x + 44, seat, 2, 20, P.chairSeam);
    px(x, seat + 18, w, 6, P.chairSeam);

    px(x - 12, seat + 2, 14, 8, P.chairArm);                        // 扶手(手要放這裡)
    px(x - 12, seat + 2, 14, 3, P.chairPad);
    px(x + w, seat - 6, 14, 8, P.chairArm);

    px(x + w / 2 - 9, seat + 24, 18, 20, P.chairMetal);             // 中柱 + 底座
    px(x + w / 2 - 26, y - 6, 52, 6, P.chairMetal);
    px(x + w / 2 - 26, y - 4, 52, 3, '#7f858b');
    px(x + 6, seat + 24, 8, 14, P.chairMetal);                      // 腳踏
  }

  /* ---------------- 師傅的滾輪椅(在刺青椅左邊) ---------------- */
  const STOOL = { x: 232, y: 318 };
  function stool(g) {
    const { px, alp } = tools(g);
    const { x, y } = STOOL;
    alp(.18, () => px(x - 14, y - 4, 34, 7, '#3a4045'));
    px(x - 13, y - 34, 30, 8, P.stool);
    px(x - 13, y - 34, 30, 3, '#4a505a');
    px(x - 3, y - 26, 8, 16, P.chairMetal);
    px(x - 15, y - 10, 34, 4, P.chairMetal);
    px(x - 15, y - 7, 5, 5, '#6b7076'); px(x + 13, y - 7, 5, 5, '#6b7076');
  }

  /* ---------------- 工作燈(每幀疊加,微微呼吸) ----------------
   * 一盞可調臂的燈,吊在刺青椅正上方。這是全場最亮的一塊,
   * 因為那張椅子是這間店真正發生事情的地方。
   */
  function lampGlow(g, t) {
    const { px, alp } = tools(g);
    const cx = CHAIR.x + CHAIR.w / 2;
    const f = 0.94 + 0.06 * Math.sin(t / 900);

    /* 燈臂 + 燈罩 */
    px(cx + 46, 0, 4, 44, '#a8a599');
    px(cx + 20, 42, 30, 4, '#a8a599');
    px(cx + 6, 46, 34, 12, P.shade);
    px(cx + 6, 46, 34, 3, '#c6c3b8');
    alp(.9 * f, () => px(cx + 10, 58, 26, 4, P.workLamp));

    /* 光錐:三層,越下面越散 */
    alp(.20 * f, () => px(cx - 4, 62, 56, 70, P.workLamp));
    alp(.13 * f, () => px(cx - 24, 128, 96, 74, P.workLamp));
    alp(.08 * f, () => px(cx - 48, 200, 148, 76, P.workLamp));
  }

  /* 建議的互動點 —— 之後掛進 world.html 時直接用這份,不用重打一次座標。
     name 是走過去時畫面下方會顯示的字。 */
  const SPOTS = [
    { id:'door',    name:'門口',   x:6,   w:100, y0:208, y1:338 },
    { id:'wait',    name:'等候區', x:104, w:132, y0:208, y1:262 },
    { id:'flash',   name:'圖牆',   x:250, w:180, y0:208, y1:250 },
    { id:'chair',   name:'刺青椅', x:268, w:138, y0:284, y1:338 },
    { id:'bench',   name:'工作檯', x:430, w:148, y0:208, y1:262 },
    { id:'case',    name:'展示櫃', x:588, w:46,  y0:208, y1:262 }
  ];

  root.SceneTattoo = {
    W, H, P, FLOOR_TOP, WALK_N, WALK_S, CHAIR, STOOL, SPOTS,
    depthScale, renderBackground, chair, stool, lampGlow
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
