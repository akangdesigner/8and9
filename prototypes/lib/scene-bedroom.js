/* no-way-up — 場景:主角房間(平視 ＋ 深度移動)
 *
 * 純繪圖,不碰 DOM。跟 scene-home.js 同一套規格(640×360,IIFE 掛全域),
 * 只是房間小、東西少——這裡唯一的功能是「走到床邊按空白鍵 = 睡覺」,見
 * docs/DESIGN_NOTES.md「家裡的拉扯」跟「第七條:體力」那節的「回家睡覺」。
 * 色調跟客廳同一套原則:寫實就好,不要陰森。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 182;
  const WALK_N = 208, WALK_S = 338;

  const depthScale = y => 0.76 + 0.24 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    ceil:'#ded9cb', ceilEdge:'#c7c1b0',
    wallHi:'#d7c9ac', wallLo:'#cbbb9c', kick:'#ad9d80',
    floorA:'#c9bda1', floorB:'#c2b599', floorSeam:'#aea079',

    night:'#131b26', nightGlow:'#22344a', bars:'#7e8478', winFrame:'#a8a496',

    doorWood:'#9c7c53', doorWoodD:'#7b6040',

    bedFrame:'#8a6b45', bedFrameD:'#6b5234', sheet:'#e4ddc9', sheetD:'#cfc6ac',
    blanket:'#5c7080', blanketD:'#465968', pillow:'#efe9d8',

    deskTop:'#8a6b45', deskLeg:'#6b5234', lampBase:'#33363c', lampShade:'#e8dcb0',
    book:'#5a6a86', bookB:'#8a4a3c',

    posterBg:'#9aa6b5', posterInk:'#3a4452'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  const BED = { x: 60, y: 300, w: 168, h: 96 };
  function bed(g) {
    const { px, alp } = tools(g);
    const { x, y, w, h } = BED;
    const top = y - h;
    px(x - 4, top - 4, w + 8, h + 8, P.bedFrameD);
    px(x, top, w, h, P.bedFrame);
    px(x + 4, top + 4, w - 8, h * 0.4, P.sheet);
    px(x + 4, top + 4, w - 8, 3, P.sheetD);
    px(x + 10, top + h * 0.32, w - 20, h * 0.5, P.blanket);
    px(x + 10, top + h * 0.32, w - 20, 4, P.blanketD);
    px(x + 14, top + 8, 34, 18, P.pillow);
    alp(.16, () => px(x - 6, y - 3, w + 16, 6, '#4a4438'));
  }

  const DESK = { x: 452, y: 296, w: 122 };
  function desk(g) {
    const { px, alp } = tools(g);
    const { x, y, w } = DESK;
    const top = y - 50;
    px(x, top, w, 7, P.deskTop);
    px(x + 4, top + 7, 6, 42, P.deskLeg);
    px(x + w - 10, top + 7, 6, 42, P.deskLeg);
    px(x + 10, top - 18, 8, 18, P.lampBase);
    px(x + 4, top - 26, 20, 10, P.lampShade);
    px(x + 40, top - 10, 22, 10, P.book);
    px(x + 40, top - 10, 22, 2, '#3d4a60');
    px(x + 64, top - 8, 18, 8, P.bookB);
    alp(.14, () => px(x - 2, y - 2, w + 4, 5, '#4a4438'));
  }

  function renderBackground(g, opts) {
    const o = Object.assign({ vignette: true, bedFront: true }, opts || {});
    const { px, alp } = tools(g);

    px(0, 0, W, 26, P.ceil);
    px(0, 24, W, 3, P.ceilEdge);

    px(0, 27, W, 96, P.wallHi);
    px(0, 123, W, FLOOR_TOP - 123 - 6, P.wallLo);
    px(0, FLOOR_TOP - 6, W, 6, P.kick);
    px(0, FLOOR_TOP - 6, W, 1, '#8f836b');

    /* 窗戶(小,鐵窗,跟客廳同一套語彙) */
    (function () {
      const x = 300, y = 40, w = 84, h = 56;
      px(x - 5, y - 5, w + 10, h + 10, P.winFrame);
      px(x, y, w, h, P.night);
      alp(.30, () => px(x, y + h - 18, w, 18, P.nightGlow));
      for (let i = 0; i <= 4; i++) px(x + i * 21, y, 3, h, P.bars);
      px(x, y + h / 2 - 1, w, 3, P.bars);
    })();

    /* 牆上貼一張舊海報,交代這裡是個十幾歲小孩的房間 */
    (function () {
      const x = 420, y = 44, w = 46, h = 60;
      px(x, y, w, h, P.posterBg);
      alp(.5, () => { px(x + 6, y + 10, w - 12, 6, P.posterInk); px(x + 6, y + 22, w - 20, 5, P.posterInk); });
    })();

    /* 房間門(走出去 = 回客廳) */
    (function () {
      const x = 8, y = 40, w = 60, h = FLOOR_TOP - 40 - 6;
      px(x - 4, y - 4, w + 8, h + 5, P.doorWoodD);
      px(x, y, w, h, P.doorWood);
      px(x + 4, y + 12, w - 8, 40, P.doorWoodD);
      px(x + w - 12, y + h / 2 - 6, 5, 14, '#5e625f');
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

    if (o.bedFront) { bed(g); desk(g); }

    if (o.vignette) {
      alp(.08, () => {
        px(0, 0, W, 10, '#2f2a22'); px(0, H - 12, W, 12, '#2f2a22');
        px(0, 0, 9, H, '#2f2a22'); px(W - 9, 0, 9, H, '#2f2a22');
      });
    }
  }

  root.SceneBedroom = { W, H, P, FLOOR_TOP, WALK_N, WALK_S, BED, DESK, depthScale, renderBackground, bed, desk };
})(typeof globalThis !== 'undefined' ? globalThis : this);
