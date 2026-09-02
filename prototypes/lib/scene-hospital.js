/* no-way-up — 場景:醫院病房(平視,靜態,不能走動)
 *
 * 純繪圖,不碰 DOM。跟 scene-bedroom.js/scene-school.js 同一套規格
 * (640×360,IIFE 掛全域),但這裡**不提供 SPOTS/走動**——這幕是阿嬤
 * 過世那天的一次性事件(見 game.html「阿嬤在醫院」那段長筆記),整段
 * 是 say()/playBeats() 鎖住輸入的對話場景,跟越式按摩室內同一個做法
 * (game.html updateIndoor() 開頭 `if(PLACE==='hospital') return;`),
 * 不是可以反覆走進來的固定點,所以沒有門的互動、沒有碰撞框。
 * 色調跟其他室內同一套原則:寫實就好,不要陰森——病房故意不用慘白日光燈
 * 那種恐怖片調子,用暖一點的夜燈黃,像深夜還有人陪著的病房。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 182;
  const WALK_N = 208, WALK_S = 338;

  const depthScale = y => 0.76 + 0.24 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    ceil:'#d9dbd6', ceilEdge:'#c3c5be',
    wallHi:'#cfd6d0', wallLo:'#c2cac2', kick:'#a3ab9f',
    floorA:'#b9beb2', floorB:'#b1b6aa', floorSeam:'#98a08f',

    night:'#131b26', nightGlow:'#3a4a3e', winFrame:'#a8a496', bars:'#7e8478',

    bedFrame:'#8f938c', bedFrameD:'#6f736c', sheet:'#e8e6dc', sheetD:'#d2cfc0',
    blanket:'#7a9084', blanketD:'#5c6f64', pillow:'#f0eee2',

    poleBase:'#8a8f89', poleRod:'#c7ccc4', bag:'#dfe7de',

    monitor:'#2a2f2c', monitorScreen:'#3a6a52', monitorLine:'#7fd9a8',

    chair:'#9c8a6a', chairD:'#7a6b52',

    curtain:'#cdb98f', curtainD:'#a8946c'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* 病床:遠端牆邊,這個房間存在的理由,跟 scene-bedroom.js 的 BED 同一個
     地位。阿嬤本人不畫進背景圖裡(跟講台上的老師同一個先例——人物由
     game.html 的 say()/WHO 頭像處理),這裡只畫床本身跟床頭監視器/點滴架。 */
  const BED = { x: 232, y: 46, w: 176, h: 88 };
  function bed(g) {
    const { px, alp } = tools(g);
    const { x, y, w, h } = BED;
    px(x - 5, y - 5, w + 10, h + 10, P.bedFrameD);
    px(x, y, w, h, P.bedFrame);
    px(x + 6, y + 6, w - 12, h * 0.42, P.sheet);
    px(x + 6, y + 6, w - 12, 3, P.sheetD);
    px(x + 12, y + h * 0.36, w - 24, h * 0.52, P.blanket);
    px(x + 12, y + h * 0.36, w - 24, 4, P.blanketD);
    px(x + 18, y + 10, 38, 20, P.pillow);
    alp(.14, () => px(x - 6, y + h + 2, w + 16, 6, '#3a3a30'));

    /* 點滴架,床頭右側 */
    const px0 = x + w + 18;
    px(px0 - 2, y - 40, 4, 96, P.poleRod);
    px(px0 - 14, y + 52, 28, 4, P.poleBase);
    px(px0 - 8, y - 48, 16, 10, P.bag);

    /* 心電監視器,床頭左側牆上 */
    const mx = x - 34, my = y - 4;
    px(mx, my, 28, 20, P.monitor);
    px(mx + 3, my + 3, 22, 14, P.monitorScreen);
    px(mx + 4, my + 10, 3, 3, P.monitorLine);
    px(mx + 8, my + 6, 3, 8, P.monitorLine);
    px(mx + 12, my + 10, 3, 3, P.monitorLine);
    px(mx + 16, my + 8, 3, 6, P.monitorLine);
  }

  /* 陪病椅,床邊靠前——這是媽坐的地方,構圖上放在能被玩家視線帶到的位置。 */
  const CHAIR = { x: 130, y: 300 };
  function chair(g) {
    const { px, alp } = tools(g);
    const { x, y } = CHAIR;
    px(x, y - 30, 34, 8, P.chair);
    px(x, y - 22, 8, 24, P.chairD);
    px(x + 26, y - 22, 8, 24, P.chairD);
    alp(.14, () => px(x - 4, y + 2, 42, 5, '#3a3a30'));
  }

  function renderBackground(g, opts) {
    const o = Object.assign({ vignette: true }, opts || {});
    const { px, alp } = tools(g);

    px(0, 0, W, 26, P.ceil);
    px(0, 24, W, 3, P.ceilEdge);

    px(0, 27, W, 96, P.wallHi);
    px(0, 123, W, FLOOR_TOP - 123 - 6, P.wallLo);
    px(0, FLOOR_TOP - 6, W, 6, P.kick);
    px(0, FLOOR_TOP - 6, W, 1, '#7c8476');

    /* 隔簾,側牆——暗示這是共用病房隔出來的一格,不是獨立單人房。 */
    (function () {
      const x = 486, y = 30, w = 118, h = FLOOR_TOP - 30 - 6;
      px(x, y, w, h, P.curtain);
      for (let i = 0; i < 6; i++) alp(.12, () => px(x + i * 20, y, 3, h, P.curtainD));
    })();

    /* 窗戶,左側——夜色,暗示這是傍晚接到電話之後的深夜。 */
    (function () {
      const x = 34, y = 40, w = 88, h = 56;
      px(x - 5, y - 5, w + 10, h + 10, P.winFrame);
      px(x, y, w, h, P.night);
      alp(.30, () => px(x, y + h - 18, w, 18, P.nightGlow));
      for (let i = 0; i <= 4; i++) px(x + i * 22, y, 3, h, P.bars);
      px(x, y + h / 2 - 1, w, 3, P.bars);
    })();

    bed(g);
    chair(g);

    /* 地板 */
    (function () {
      const T = 34;
      for (let y = FLOOR_TOP; y < H; y += T)
        for (let x = 0; x < W; x += T)
          px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? P.floorA : P.floorB);
      for (let x = 0; x <= W; x += T) alp(.20, () => px(x, FLOOR_TOP, 1, H - FLOOR_TOP, P.floorSeam));
      for (let y = FLOOR_TOP; y <= H; y += T) alp(.16, () => px(0, y, W, 1, P.floorSeam));
    })();

    if (o.vignette) {
      alp(.10, () => {
        px(0, 0, W, 10, '#242820'); px(0, H - 12, W, 12, '#242820');
        px(0, 0, 9, H, '#242820'); px(W - 9, 0, 9, H, '#242820');
      });
    }
  }

  root.SceneHospital = { W, H, P, FLOOR_TOP, WALK_N, WALK_S, BED, CHAIR, depthScale, renderBackground, bed, chair };
})(typeof globalThis !== 'undefined' ? globalThis : this);
