/* no-way-up — 場景:學校走廊(平視 ＋ 鎖深度水平走,跟房間同一套)
 *
 * 純繪圖,不碰 DOM。跟 scene-bedroom.js 同一套規格(640×360,IIFE 掛全域)。
 * 2026-08-28,kc:「之後學校會設計走廊,教室門出去後接走廊,然後接外面,
 * 走廊有繳費機跟教官」——把 scene-school.js 那句「往右走到走廊,技術上
 * 只是這個場景唯一的出口」的舊留白補上,真的做成一個場景,插在教室跟
 * 街上中間。理由/整條動線見 docs/DESIGN_NOTES.md「第七條:體力」節下面
 * 「沒誘因去做別的事」那則筆記(睡覺門檻+扣體力連動扣飽足感同一輪)。
 * 色調跟其他室內同一套原則:寫實就好,不要陰森。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 182;
  const WALK_N = 208, WALK_S = 338;

  const depthScale = y => 0.76 + 0.24 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    ceil:'#d2cfc0', ceilEdge:'#bab5a0',
    wallHi:'#c7c2ac', wallLo:'#bcb497', kick:'#9c8f72',
    floorA:'#b4a689', floorB:'#ac9e81', floorSeam:'#948667',

    lockerBody:'#5c7488', lockerBodyD:'#48596a', lockerVent:'#3a4854', lockerHandle:'#d8d0b8',

    doorWood:'#7c5c3c', doorWoodD:'#5e4530',
    dayLight:'#cfe0e8', dayLightGlow:'#e8f0ee',

    kioskBody:'#3a4048', kioskBodyD:'#282c32', kioskScreen:'#4fd0c8', kioskSlot:'#161819',
    deskTop:'#8a6b45', deskLeg:'#6b5234', paperStack:'#e8e2cc'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* 置物櫃排:純裝飾,交代「這裡是走廊」,跟教室的排排課桌同一個作用
     (湊場景感,不能互動)。 */
  function lockers(g) {
    const { px } = tools(g);
    const y = 44, w = 46, h = 78, gap = 4, n = 6, x0 = 210;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (w + gap);
      px(x - 2, y - 2, w + 4, h + 4, P.lockerBodyD);
      px(x, y, w, h, P.lockerBody);
      px(x + 6, y + 10, 4, 40, P.lockerVent);
      px(x + w - 14, y + h / 2 - 3, 6, 6, P.lockerHandle);
    }
  }

  /* 繳費機(kc:「走廊有繳費機」)——註冊費在這裡繳,互動邏輯在
     game.html 的 openTuitionKiosk()。 */
  const KIOSK = { x: 150, y: 320, w: 70, h: 118 };
  function kiosk(g) {
    const { px, alp } = tools(g);
    const { x, y, w, h } = KIOSK;
    const top = y - h;
    px(x - 3, top - 3, w + 6, h + 6, P.kioskBodyD);
    px(x, top, w, h, P.kioskBody);
    px(x + 8, top + 12, w - 16, 44, P.kioskScreen);
    alp(.5, () => px(x + 12, top + 16, w - 24, 8, '#eafffb'));
    px(x + 14, top + 66, w - 28, 8, P.kioskSlot);
    px(x + w / 2 - 10, top + 84, 20, 14, P.kioskSlot);
    alp(.16, () => px(x - 4, y - 3, w + 8, 5, '#2a271e'));
  }

  /* 教官岗哨桌——教官站崗的小桌子,桌上一疊表格。人物由 game.html 的
     WHO/say() 頭像處理,不畫進背景圖裡(跟教室講台/黑板同一個先例,
     教室裡導師也沒有另外畫真人)。 */
  const DESK = { x: 430, y: 320, w: 84 };
  function desk(g) {
    const { px, alp } = tools(g);
    const { x, y, w } = DESK;
    const top = y - 50;
    px(x, top, w, 8, P.deskTop);
    px(x + 6, top + 8, 7, 42, P.deskLeg);
    px(x + w - 13, top + 8, 7, 42, P.deskLeg);
    px(x + 12, top - 10, 30, 10, P.paperStack);
    px(x + 12, top - 13, 30, 3, '#d0c8a8');
    alp(.16, () => px(x - 3, y - 2, w + 6, 5, '#4a4438'));
  }

  function renderBackground(g, opts) {
    const o = Object.assign({ vignette: true }, opts || {});
    const { px, alp } = tools(g);

    px(0, 0, W, 26, P.ceil);
    px(0, 24, W, 3, P.ceilEdge);

    px(0, 27, W, 96, P.wallHi);
    px(0, 123, W, FLOOR_TOP - 123 - 6, P.wallLo);
    px(0, FLOOR_TOP - 6, W, 6, P.kick);
    px(0, FLOOR_TOP - 6, W, 1, '#7c7156');

    lockers(g);

    /* 左門:回教室(跟 scene-school.js 走廊門同一個木門畫法,方向鏡射)。 */
    (function () {
      const x = 8, y = 40, w = 60, h = FLOOR_TOP - 40 - 6;
      px(x - 4, y - 4, w + 8, h + 5, P.doorWoodD);
      px(x, y, w, h, P.doorWood);
      px(x + 4, y + 12, w - 8, 40, P.doorWoodD);
      px(x + w - 12, y + h / 2 - 6, 5, 14, '#5e625f');
    })();

    /* 右門:走出去,外面是白天街上——跟教室/房間那種夜景鐵窗不同色調,
       故意亮一點,讀起來像「走廊盡頭有光」,呼應這扇門通往外面。 */
    (function () {
      const x = W - 68, y = 34, w = 60, h = FLOOR_TOP - 34 - 6;
      px(x - 4, y - 4, w + 8, h + 5, '#8a9aa0');
      px(x, y, w, h, P.dayLight);
      alp(.5, () => px(x + 6, y + 6, w - 12, h - 12, P.dayLightGlow));
      px(x + w / 2 - 1, y, 2, h, '#8a9aa0');
      px(x, y + h * 0.55, w, 2, '#8a9aa0');
    })();

    /* 地板 */
    (function () {
      const T = 34;
      for (let y = FLOOR_TOP; y < H; y += T)
        for (let x = 0; x < W; x += T)
          px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? P.floorA : P.floorB);
      for (let x = 0; x <= W; x += T) alp(.24, () => px(x, FLOOR_TOP, 1, H - FLOOR_TOP, P.floorSeam));
      for (let y = FLOOR_TOP; y <= H; y += T) alp(.18, () => px(0, y, W, 1, P.floorSeam));
    })();

    kiosk(g);
    desk(g);

    if (o.vignette) {
      alp(.08, () => {
        px(0, 0, W, 10, '#2f2a22'); px(0, H - 12, W, 12, '#2f2a22');
        px(0, 0, 9, H, '#2f2a22'); px(W - 9, 0, 9, H, '#2f2a22');
      });
    }
  }

  root.SceneCorridor = { W, H, P, FLOOR_TOP, WALK_N, WALK_S, KIOSK, DESK, depthScale, renderBackground, kiosk, desk };
})(typeof globalThis !== 'undefined' ? globalThis : this);
