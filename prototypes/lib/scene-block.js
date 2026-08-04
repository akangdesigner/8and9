/* no-way-up — 視角實驗:相機拉高的平視(街區)
 *
 * 這不是斜俯視,是把**相機抬高**的平視:
 *   - 建築只畫一樓 ＋ 招牌,二樓直接切掉(相機高了就看不到)
 *   - 地面吃掉畫面 58%,可走深度 190px(現行平視是 106px)
 *   - 地面上散著機車、紙箱、盆栽、塑膠椅 —— **有東西可以繞,空間感才是真的**
 *
 * 目的:拿到八成的空間自由,但角色仍然看得到臉。
 * 跟 scene-street.js(現行平視)並排比較用,見 prototypes/view-compare.html。
 */
(function (root) {
  const W = 640, H = 360;
  const SHOP_BOTTOM = 130;                 // 店面下緣 = 地面起點
  const WALK_N = 146, WALK_S = 332;        // 可走深度 186px
  const CURB = 338;                        // 路緣

  const depthScale = y => 0.62 + 0.38 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    wallA:'#b9b2a2', wallB:'#aea695', wallC:'#c3bcac', wallDirt:'#9e9686',
    shutter:'#8e9490', shutterRib:'#a0a6a2', shutterD:'#767c78',
    glass:'#2a3b48', storeLit:'#f6f7ec', glassLit:'#cfe4ee',
    signR:'#c8352a', signW:'#f2efe4', neonG:'#5ce08a',

    ground:'#a8a396', groundB:'#a19c90', groundC:'#9c9789',
    seam:'#8d887c', wet:'#c6cbc6', drain:'#6f6b61',
    curb:'#8a8578', road:'#3d3f42', roadLine:'#c9c07a',

    bikeA:'#3a3f46', bikeB:'#5b6472', bikeC:'#7a4a3a',
    box:'#a8845a', boxD:'#87683f', bag:'#4d5259', bagD:'#3b3f45',
    plant:'#3f7a44', pot:'#8a6b45', chair:'#c0473a',
    pole:'#8a8a84', wire:'#26282c'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* ---------------- 地面上散著的東西 ----------------
   * 每個都有 y,會跟角色一起深度排序 —— 你可以走到它前面或後面。
   * r 是碰撞半徑,遊戲端拿去擋。
   */
  const OBJECTS = [
    { kind:'moto',  x:96,  y:308, r:26 },
    { kind:'moto',  x:168, y:326, r:26 },
    { kind:'box',   x:292, y:232, r:16 },
    { kind:'box',   x:314, y:246, r:16 },
    { kind:'bag',   x:392, y:280, r:15 },
    { kind:'chair', x:236, y:296, r:12 },
    { kind:'plant', x:520, y:246, r:13 },
    { kind:'plant', x:548, y:238, r:13 },
    { kind:'moto',  x:474, y:322, r:26 }
  ];

  function drawObject(g, o) {
    const { px, alp } = tools(g);
    const k = depthScale(o.y);
    const u = n => Math.round(n * k);
    const x = o.x, b = o.y;

    if (o.kind === 'moto') {
      alp(.20, () => px(x - u(24), b - u(3), u(48), u(7), '#4a4438'));
      px(x - u(20), b - u(13), u(11), u(11), P.bikeA);
      px(x + u(10), b - u(13), u(11), u(11), P.bikeA);
      px(x - u(16), b - u(22), u(33), u(10), P.bikeB);
      px(x - u(14), b - u(29), u(17), u(8), P.bikeA);
      px(x + u(8),  b - u(34), u(8), u(14), P.bikeC);
      px(x + u(5),  b - u(38), u(15), u(5), P.bikeA);
    } else if (o.kind === 'box') {
      alp(.20, () => px(x - u(14), b - u(2), u(28), u(5), '#4a4438'));
      px(x - u(13), b - u(24), u(26), u(24), P.box);
      px(x - u(13), b - u(24), u(26), u(4), '#c09a68');
      px(x - u(13), b - u(13), u(26), u(2), P.boxD);
    } else if (o.kind === 'bag') {
      alp(.20, () => px(x - u(13), b - u(2), u(26), u(5), '#4a4438'));
      px(x - u(12), b - u(20), u(24), u(20), P.bag);
      px(x - u(9),  b - u(24), u(18), u(6), P.bagD);
      px(x - u(3),  b - u(27), u(6), u(4), P.bagD);
    } else if (o.kind === 'chair') {
      alp(.18, () => px(x - u(10), b - u(2), u(20), u(4), '#4a4438'));
      px(x - u(9), b - u(16), u(18), u(4), P.chair);
      px(x - u(9), b - u(12), u(4), u(12), P.chair);
      px(x + u(5), b - u(12), u(4), u(12), P.chair);
      px(x + u(5), b - u(30), u(4), u(15), P.chair);
      px(x - u(9), b - u(30), u(18), u(4), P.chair);
    } else if (o.kind === 'plant') {
      alp(.18, () => px(x - u(11), b - u(2), u(22), u(4), '#4a4438'));
      px(x - u(9), b - u(16), u(18), u(16), P.pot);
      px(x - u(9), b - u(16), u(18), u(3), '#a5825a');
      px(x - u(12), b - u(30), u(24), u(15), P.plant);
      px(x - u(6),  b - u(38), u(12), u(10), '#4f9152');
    }
  }

  /* ---------------- 背景:店面 ＋ 一大片地 ---------------- */
  function renderBackground(g) {
    const { px, alp } = tools(g);

    /* ===== 店面(只有一樓，二樓被相機切掉了) ===== */
    const SHOPS = [
      { x:0,   kind:'store',   sign:'超商', signC:P.signW },
      { x:160, kind:'food',    sign:'麵',   signC:P.signR },
      { x:320, kind:'betel',   sign:'檳榔', signC:P.neonG },
      { x:480, kind:'shutter' }
    ];
    SHOPS.forEach((s, i) => {
      const x = s.x, SW = 160;
      px(x, 0, SW, SHOP_BOTTOM, [P.wallA, P.wallB, P.wallC][i % 3]);
      alp(.12, () => px(x + 14 + i * 7, 44, 16, 46, P.wallDirt));

      /* 招牌貼著畫面上緣 —— 相機高了,招牌就被切掉一半 */
      if (s.sign) {
        px(x + 12, 0, SW - 24, 30, '#3a3833');
        px(x + 14, 0, SW - 28, 26, s.signC);
        const n = s.sign.length, cw = 20;
        for (let k = 0; k < n; k++)
          px(x + SW / 2 - (n * cw) / 2 + k * cw + 3, 6, cw - 6, 16, 'rgba(28,26,24,.78)');
      }

      const top = 38, h = SHOP_BOTTOM - top;
      if (s.kind === 'shutter') {
        px(x + 8, top, SW - 16, h, P.shutter);
        for (let y = top + 4; y < SHOP_BOTTOM - 4; y += 8) px(x + 8, y, SW - 16, 3, P.shutterRib);
        px(x + 8, SHOP_BOTTOM - 7, SW - 16, 7, P.shutterD);
        return;
      }
      const gx = x + 16, gw = SW - 32;
      px(gx, top, gw, h, P.glass);
      if (s.kind === 'store') {
        alp(.94, () => px(gx + 3, top + 3, gw - 6, h - 6, P.storeLit));
        for (let k = 0; k < 5; k++) px(gx + 9 + k * 22, top + 22, 15, 34, '#c2ccc0');
        px(gx + gw / 2 - 17, top + 6, 34, h - 9, '#e9ede4');
        px(gx + gw / 2, top + 6, 2, h - 9, '#b6bdb2');
      } else if (s.kind === 'food') {
        alp(.55, () => px(gx + 3, top + 3, gw - 6, h - 6, P.glassLit));
        for (let k = 0; k < 3; k++) px(gx + 10 + k * 34, top + 26, 26, 40, '#8a6b45');
        px(gx + 6, top + 10, gw - 12, 7, P.signR);
      } else {
        px(gx + gw / 2 - 24, top + 6, 48, h - 12, '#1f2a26');
        alp(.78, () => px(gx + gw / 2 - 20, top + 10, 40, h - 20, P.neonG));
      }
    });
    px(0, SHOP_BOTTOM - 5, W, 5, '#8f8a7c');

    /* ===== 地面 —— 畫面的 58%,這才是空間 ===== */
    for (let y = SHOP_BOTTOM; y < CURB; y += 34)
      for (let x = 0; x < W; x += 34)
        px(x, y, 34, 34, (((x / 34) | 0) + ((y / 34) | 0)) % 2 ? P.ground : P.groundB);
    for (let x = 0; x <= W; x += 34) alp(.20, () => px(x, SHOP_BOTTOM, 1, CURB - SHOP_BOTTOM, P.seam));
    for (let y = SHOP_BOTTOM; y <= CURB; y += 34) alp(.15, () => px(0, y, W, 1, P.seam));

    /* 排水溝、人孔蓋、幾灘水 */
    px(0, 302, W, 7, P.drain);
    for (let x = 6; x < W; x += 22) px(x, 303, 12, 5, '#5a564d');
    px(430, 236, 30, 16, '#7e7a70');
    alp(.55, () => px(433, 238, 24, 12, '#8d887c'));
    alp(.22, () => { px(40, 250, 70, 22, P.wet); px(250, 268, 54, 16, P.wet);
                     px(520, 292, 64, 18, P.wet); });

    /* 超商的光鋪在地上一大片 —— 光是空間感的另一半 */
    alp(.26, () => px(0, SHOP_BOTTOM, 170, 96, P.storeLit));
    alp(.13, () => px(0, SHOP_BOTTOM + 90, 210, 90, P.storeLit));
    alp(.10, () => px(320, SHOP_BOTTOM, 160, 70, P.neonG));
    alp(.09, () => px(160, SHOP_BOTTOM, 160, 60, '#f0d8a0'));

    /* 路緣 + 馬路 */
    px(0, CURB, W, 5, P.curb);
    px(0, CURB + 5, W, H - CURB - 5, P.road);
    for (let x = 12; x < W; x += 84) alp(.5, () => px(x, CURB + 12, 38, 3, P.roadLine));
  }

  /* ---------------- 前景:電線杆(角色從後面走過) ---------------- */
  function foreground(g) {
    const { px, alp } = tools(g);
    px(596, 0, 11, H - 8, P.pole);
    px(586, 30, 32, 5, P.pole);
    px(586, 48, 32, 5, P.pole);
    alp(.14, () => px(600, 300, 26, 50, '#4a4438'));
    for (let x = 0; x < W; x += 6) {
      const t = (x % 640) / 640, sag = Math.sin(t * Math.PI) * 6;
      px(x, 34 + sag, 6, 2, P.wire);
    }
  }

  /* ---------------- 角色的長影子(斜光,空間感的另一半) ---------------- */
  function shadow(g, cx, footY) {
    const { px, alp } = tools(g);
    const k = depthScale(footY);
    alp(.16, () => {
      for (let i = 0; i < 9; i++)
        px(cx + i * 4 * k, footY - 2 - i * 1.2 * k, Math.round(20 * k), Math.round(5 * k), '#3a3630');
    });
  }

  root.SceneBlock = {
    W, H, P, SHOP_BOTTOM, WALK_N, WALK_S, CURB, OBJECTS,
    depthScale, renderBackground, drawObject, foreground, shadow
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
