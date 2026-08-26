/* no-way-up — 場景:遊藝場室內
 *
 * 純繪圖,不碰 DOM。跟 scene-school.js 同一套規格(640×360,IIFE 掛全域)。
 * 2026-08-26,kc:「遊藝場先做,裡面可以玩一些小遊戲,可以加情緒」+
 * 「真的賭博,情緒一定＋ 金錢賭」——外觀(3D 街上遊藝場招牌+顧場子任務
 * 門口)已經有了,這是第一次真的能走進去的室內。目前只有灰模(FALLBACK),
 * 沒有照片版——跟 store/home/school 當初的先例一樣,先卡位讓場景/機台
 * 邏輯能跑,之後 kc 要生照片再照 HOME_PHOTO 那套 naturalWidth 切換補上,
 * 這個檔案到時候不用整個換掉,只是 game.html 那邊多接一張圖。
 * 色調刻意跟其他室內(寫實、不陰森)不同一掛——這裡是真的要有點俗艷、
 * 閃爍霓虹的賭博場子感,昏暗+高彩度光源。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 182;
  const WALK_N = 208, WALK_S = 338;

  const P = {
    ceil:'#181418', ceilEdge:'#0f0c0f',
    wallHi:'#241c24', wallLo:'#1b151b', kick:'#120e12',
    floorA:'#241d22', floorB:'#1c161a', floorSeam:'#100c0f',

    doorWood:'#3a2c30', doorWoodD:'#281e21',

    slotBody:'#7a1630', slotBodyD:'#4c0d1e', slotScreen:'#160910',
    rouletteFelt:'#0e4d2e', rouletteRim:'#5c3a1a', rouletteWheel:'#2a2020',
    pusherBody:'#123a5c', pusherBodyD:'#0b2540', pusherGlass:'#8fd6ff',
    coin:'#e8c85a'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* 吃角子老虎——直立櫃體,上面一塊暗色螢幕(三顆隨便畫的符號代表轉輪),
     跟 SceneSchool 的 board() 同一個「遠端牆上的視覺焦點」地位之一。 */
  const SLOT = { x: 90, y: 60, w: 70, h: 130 };
  function slotMachine(g) {
    const { px, alp } = tools(g);
    const { x, y, w, h } = SLOT;
    px(x - 5, y - 5, w + 10, h + 10, P.slotBodyD);
    px(x, y, w, h, P.slotBody);
    px(x + 8, y + 14, w - 16, 46, P.slotScreen);
    [0, 1, 2].forEach(i => {
      px(x + 12 + i * 16, y + 24, 10, 26, ['#e8c85a', '#e85a5a', '#5ae87a'][i]);
    });
    px(x + 10, y + h - 34, w - 20, 20, P.slotBodyD);
    alp(.5, () => px(x + 14, y + h - 30, w - 28, 4, '#f2d98a'));
  }

  /* 輪盤桌——低矮圓桌,俯視角只能畫個橢圓意思意思,中間一顆深色輪盤。 */
  const ROULETTE = { x: 280, y: 118, w: 140, h: 60 };
  function rouletteTable(g) {
    const { px, alp } = tools(g);
    const { x, y, w, h } = ROULETTE;
    px(x - 6, y - 6, w + 12, h + 16, P.rouletteRim);
    px(x, y, w, h, P.rouletteFelt);
    const cx = x + w / 2, cy = y + h / 2, r = 22;
    px(cx - r, cy - r * .5, r * 2, r, P.rouletteWheel);
    alp(.6, () => px(cx - r + 4, cy - r * .5 + 3, r * 2 - 8, 3, '#c8a840'));
  }

  /* 推幣機——玻璃罩檯面型,罩子裡露出一堆小方塊代表堆著的代幣。 */
  const PUSHER = { x: 470, y: 70, w: 90, h: 120 };
  function pusherMachine(g) {
    const { px } = tools(g);
    const { x, y, w, h } = PUSHER;
    px(x - 5, y - 5, w + 10, h + 10, P.pusherBodyD);
    px(x, y, w, h, P.pusherBody);
    px(x + 6, y + 10, w - 12, 50, P.pusherGlass);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++)
        px(x + 10 + c * 13, y + 16 + r * 12, 10, 8, P.coin);
    px(x + 10, y + h - 30, w - 20, 18, P.pusherBodyD);
  }

  function renderBackground(g, opts) {
    const o = Object.assign({ vignette: true }, opts || {});
    const { px, alp } = tools(g);

    px(0, 0, W, 26, P.ceil);
    px(0, 24, W, 3, P.ceilEdge);

    px(0, 27, W, 96, P.wallHi);
    px(0, 123, W, FLOOR_TOP - 123 - 6, P.wallLo);
    px(0, FLOOR_TOP - 6, W, 6, P.kick);
    px(0, FLOOR_TOP - 6, W, 1, '#0a070a');

    slotMachine(g);
    rouletteTable(g);
    pusherMachine(g);

    /* 門(左側走出去,跟 scene-school.js 門開在右側鏡射過來,單純視覺
       上不要跟教室構圖同一個方向而已,沒有敘事上的講究)。 */
    (function () {
      const x = 20, y = 40, w = 56, h = FLOOR_TOP - 40 - 6;
      px(x - 4, y - 4, w + 8, h + 5, P.doorWoodD);
      px(x, y, w, h, P.doorWood);
      px(x + 4, y + 12, w - 8, 40, P.doorWoodD);
      px(x + w - 12, y + h / 2 - 6, 5, 14, '#7c7266');
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

    if (o.vignette) {
      alp(.16, () => {
        px(0, 0, W, 10, '#000'); px(0, H - 12, W, 12, '#000');
        px(0, 0, 9, H, '#000'); px(W - 9, 0, 9, H, '#000');
      });
    }
  }

  /* 機台特寫(2026-08-26,kc:「互動應該要彈出一個大框框,要寫實的感覺」)——
     game.html 新增的 #arcadeGame 大面板還沒有真的照片時,用這個畫一個放大
     版的色塊機台頂著,跟 renderBackground() 那組小尺寸色塊是同一套顏色/
     造型,只是佔滿整個 640×420 的特寫畫布,不是縮在房間一角。真的照片
     生出來之後(game.html 那邊的 naturalWidth 判斷)這個函式就不會再被
     呼叫,不用先刪掉。 */
  const CW = 640, CH = 420;
  /* 這三個矩形/圓心是 renderCloseup() 底下三段畫法算出來的同一組數字,
     另外匯出給 game.html 的 agDrawSpin() 用——轉輪閃爍/球轉動的動畫要疊在
     跟靜態色塊「同一個位置」上,不能自己另外猜一組座標,兩邊會對不齊。 */
  const CLOSEUP_SLOT_SCREEN = { x:218, y:66, w:204, h:140 };
  const CLOSEUP_ROULETTE_WHEEL = { cx:320, cy:240, r:82 };
  const CLOSEUP_PUSHER_GLASS = { x:180, y:52, w:280, h:170 };
  function renderCloseup(g, kind) {
    const { px, alp } = tools(g);
    px(0, 0, CW, CH, '#0d0a0d');
    if (kind === 'slot') {
      const w = 260, h = 380, x = (CW - w) / 2, y = (CH - h) / 2;
      px(x - 14, y - 14, w + 28, h + 28, P.slotBodyD);
      px(x, y, w, h, P.slotBody);
      px(x + 28, y + 46, w - 56, 140, P.slotScreen);
      [0, 1, 2].forEach(i => px(x + 42 + i * 58, y + 74, 42, 86, ['#e8c85a', '#e85a5a', '#5ae87a'][i]));
      px(x + 34, y + h - 100, w - 68, 58, P.slotBodyD);
      alp(.5, () => px(x + 46, y + h - 88, w - 92, 9, '#f2d98a'));
    } else if (kind === 'roulette') {
      const w = 460, h = 220, x = (CW - w) / 2, y = (CH - h) / 2 + 30;
      px(x - 16, y - 16, w + 32, h + 40, P.rouletteRim);
      px(x, y, w, h, P.rouletteFelt);
      const cx = x + w / 2, cy = y + h / 2, r = 82;
      px(cx - r, cy - r * .5, r * 2, r, P.rouletteWheel);
      alp(.6, () => px(cx - r + 14, cy - r * .5 + 9, r * 2 - 28, 9, '#c8a840'));
    } else if (kind === 'pusher') {
      const w = 320, h = 380, x = (CW - w) / 2, y = (CH - h) / 2;
      px(x - 16, y - 16, w + 32, h + 32, P.pusherBodyD);
      px(x, y, w, h, P.pusherBody);
      px(x + 20, y + 32, w - 40, 170, P.pusherGlass);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 5; c++)
          px(x + 32 + c * 48, y + 52 + r * 42, 36, 28, P.coin);
      px(x + 30, y + h - 100, w - 60, 56, P.pusherBodyD);
    }
  }

  root.SceneArcade = { W, H, P, FLOOR_TOP, WALK_N, WALK_S, SLOT, ROULETTE, PUSHER, renderBackground, renderCloseup, CW, CH,
    CLOSEUP_SLOT_SCREEN, CLOSEUP_ROULETTE_WHEEL, CLOSEUP_PUSHER_GLASS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
