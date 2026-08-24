/* no-way-up — 場景:教室(平視 ＋ 深度移動)
 *
 * 純繪圖,不碰 DOM。跟 scene-bedroom.js 同一套規格(640×360,IIFE 掛全域)。
 * 2026-08-21,kc:「學校也要建2d場景,跟家一樣重要」+「學生視角,導師站
 * 講台,往右走可以走到走廊」——構圖是學生座位看向前方黑板/講台(跟
 * scene-bedroom.js 面向床/書桌同一個「主要家具在遠端」邏輯,只是這裡的
 * 「床」換成黑板+講台),右側是門(narrative 上算「走廊」,技術上就是
 * 這個場景唯一的出口,沒有另外做一層走廊場景,範圍先縮在這裡)。
 * 色調跟其他室內同一套原則:寫實就好,不要陰森。
 */
(function (root) {
  const W = 640, H = 360;
  const FLOOR_TOP = 182;
  const WALK_N = 208, WALK_S = 338;

  const depthScale = y => 0.76 + 0.24 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    ceil:'#d8d6c8', ceilEdge:'#c0bda8',
    wallHi:'#cfc9b4', wallLo:'#c3bca3', kick:'#a6997c',
    floorA:'#bcae90', floorB:'#b4a688', floorSeam:'#9c8e6f',

    night:'#131b26', nightGlow:'#22344a', winFrame:'#a8a496', bars:'#7e8478',

    board:'#2a3d34', boardFrame:'#5c4a34', chalk:'#dcd8c4',
    podiumTop:'#8a6b45', podiumLeg:'#6b5234',

    deskTop:'#9c8259', deskLeg:'#6b5234', chair:'#7a6248',

    doorWood:'#7c5c3c', doorWoodD:'#5e4530'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* 黑板＋講台:遠端牆上,學生座位望過去的焦點,跟 scene-bedroom.js 的
     BED 同一個地位(「這個房間存在的理由」那件家具)。導師站在講台後面
     (kc:「導師站講台」),這裡先畫台子本身,人物由 game.html 的 WHO/say()
     頭像處理,不在這張背景圖裡畫真人。 */
  const BOARD = { x: 220, y: 30, w: 200, h: 76 };
  function board(g) {
    const { px } = tools(g);
    const { x, y, w, h } = BOARD;
    px(x - 6, y - 6, w + 12, h + 12, P.boardFrame);
    px(x, y, w, h, P.board);
    px(x + 14, y + 16, 60, 3, P.chalk);
    px(x + 14, y + 28, 90, 3, P.chalk);
    px(x + 14, y + 40, 40, 3, P.chalk);
    const px2 = x + w / 2 - 30, py2 = y + h + 10;
    px(px2 - 4, py2 - 4, 68, 34, P.podiumLeg);
    px(px2, py2, 60, 26, P.podiumTop);
  }

  /* 學生座位:一整排排到後面當背景(數量湊「教室感」,不是每張都能互動),
     真正能互動的是 DESK 那個獨立座標(見下面 SPOTS)。
     2026-08-24 kc 抓到動線問題:原本 3 排時最後一排椅子影子畫到 y≈320,
     跟 DESK 桌面(y=306 起)幾乎貼死,門口走到座位那條路視覺上像在穿課桌。
     縮成 2 排,最後一排結束在 y≈286,DESK 前面空出一條乾淨地板。 */
  const DESK_ROWS = 2, DESK_COLS = 4;
  function deskRows(g) {
    const { px, alp } = tools(g);
    const rowY0 = 224, rowGap = 34, colX0 = 70, colGap = 118;
    for (let r = 0; r < DESK_ROWS; r++) {
      for (let c = 0; c < DESK_COLS; c++) {
        const x = colX0 + c * colGap, y = rowY0 + r * rowGap;
        const s = 0.7 + 0.3 * (r / (DESK_ROWS - 1));
        const w = 46 * s, h = 10 * s;
        px(x, y, w, h, P.deskTop);
        px(x + 4 * s, y + h, 6 * s, 14 * s, P.chair);
        alp(.12, () => px(x - 2, y + h + 14 * s, w + 4, 4, '#4a4438'));
      }
    }
  }

  /* 自己的座位:獨立畫在前排、靠近鏡頭,跟其他座位拉開視覺重量,對應
     SPOTS 裡的 'desk' 互動點(上課／偷玩手遊)。
     2026-08-24 kc 抓到動線問題:x=300 疊在背景第三欄課桌(x=306~352)上,
     改成落在欄與欄之間本來就有的空隙(欄距 118、桌寬 46,空隙 72px 綽綽
     有餘)。見下面 DESK_ROWS 那則筆記,兩處是同一個問題的兩個維度。 */
  const DESK = { x: 235, y: 320, w: 70 };
  function desk(g) {
    const { px, alp } = tools(g);
    const { x, y, w } = DESK;
    px(x, y - 14, w, 14, P.deskTop);
    px(x + 6, y, 10, 20, P.chair);
    px(x + w - 16, y, 10, 20, P.chair);
    alp(.16, () => px(x - 4, y + 20, w + 8, 5, '#4a4438'));
  }

  function renderBackground(g, opts) {
    const o = Object.assign({ vignette: true, deskFront: true }, opts || {});
    const { px, alp } = tools(g);

    px(0, 0, W, 26, P.ceil);
    px(0, 24, W, 3, P.ceilEdge);

    px(0, 27, W, 96, P.wallHi);
    px(0, 123, W, FLOOR_TOP - 123 - 6, P.wallLo);
    px(0, FLOOR_TOP - 6, W, 6, P.kick);
    px(0, FLOOR_TOP - 6, W, 1, '#847858');

    board(g);

    /* 側面窗戶,鐵窗跟其他室內同一套語彙,交代教室在樓上。 */
    (function () {
      const x = 40, y = 40, w = 84, h = 56;
      px(x - 5, y - 5, w + 10, h + 10, P.winFrame);
      px(x, y, w, h, P.night);
      alp(.30, () => px(x, y + h - 18, w, 18, P.nightGlow));
      for (let i = 0; i <= 4; i++) px(x + i * 21, y, 3, h, P.bars);
      px(x, y + h / 2 - 1, w, 3, P.bars);
    })();

    /* 走廊門(kc:「往右走可以走到走廊」)——放右側,跟 scene-bedroom.js
       房間門(放左側)鏡射過來,方向感照 kc 講的「往右走」對齊。 */
    (function () {
      const x = W - 68, y = 40, w = 60, h = FLOOR_TOP - 40 - 6;
      px(x - 4, y - 4, w + 8, h + 5, P.doorWoodD);
      px(x, y, w, h, P.doorWood);
      px(x + 4, y + 12, w - 8, 40, P.doorWoodD);
      px(x + 8, y + h / 2 - 6, 5, 14, '#5e625f');
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

    deskRows(g);
    if (o.deskFront) desk(g);

    if (o.vignette) {
      alp(.08, () => {
        px(0, 0, W, 10, '#2f2a22'); px(0, H - 12, W, 12, '#2f2a22');
        px(0, 0, 9, H, '#2f2a22'); px(W - 9, 0, 9, H, '#2f2a22');
      });
    }
  }

  root.SceneSchool = { W, H, P, FLOOR_TOP, WALK_N, WALK_S, BOARD, DESK, depthScale, renderBackground, board, desk };
})(typeof globalThis !== 'undefined' ? globalThis : this);
