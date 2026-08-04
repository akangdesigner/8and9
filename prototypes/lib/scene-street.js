/* no-way-up — 場景:街(平視 ＋ 橫向捲動)
 *
 * 這條街比畫面寬:邏輯寬度 1600,畫面只看 640,相機跟著角色走。
 * 捲軸在 Canvas 上比切場景還便宜 —— 只是 drawImage 的時候裁一段。
 *
 * 騎樓柱子畫在最前面當前景遮擋,角色從柱子後面走過去,空間深度就出來了。
 */
(function (root) {
  const W = 1600, H = 360;
  const VIEW_W = 640;                       // 一次看得到多寬
  const FLOOR_TOP = 238;                    // 騎樓地面
  const WALK_N = 262, WALK_S = 332;

  const depthScale = y => 0.80 + 0.20 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    sky:'#131a24',
    wallA:'#b9b2a2', wallB:'#aea695', wallC:'#c3bcac', wallDirt:'#9e9686',
    tile:'#c9c3b4', tileSeam:'#a9a293',
    pillar:'#c6c0b1', pillarD:'#a49d8e', pillarBase:'#8d8779',
    ground:'#a9a496', groundB:'#a19c8f', groundSeam:'#8f8a7e', curb:'#8a8578',
    road:'#3d3f42', roadLine:'#c9c07a',

    barA:'#7d8478', barB:'#6b7167',
    ac:'#d6d2c6', acD:'#b0aca0',
    shutter:'#8e9490', shutterD:'#767c78', shutterRib:'#a0a6a2',

    signR:'#c8352a', signY:'#e8b52c', signG:'#2f8f5a', signB:'#2f6fa8', signW:'#f2efe4',
    neonG:'#5ce08a', neonR:'#ff5a4a',
    glass:'#2a3b48', glassLit:'#cfe4ee',
    storeLit:'#f6f7ec',
    wood:'#8a6b45', woodD:'#6b5234',
    bikeA:'#3a3f46', bikeB:'#5b6472', bikeC:'#7a4a3a',
    pole:'#8a8a84', wire:'#26282c',
    chair:'#c0473a', bucket:'#3f6f9a'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* 店面表 —— 可進去的三間標了 door */
  const SHOPS = [
    { x:0,    kind:'shutter' },
    { x:160,  kind:'home',   door:'home',   sign:'',     signC:P.signW },
    { x:320,  kind:'food',   sign:'麵',     signC:P.signR },
    { x:480,  kind:'betel',  sign:'檳榔',   signC:P.neonG },
    { x:640,  kind:'shutter' },
    { x:800,  kind:'store',  door:'store',  sign:'超商', signC:P.signW },
    { x:960,  kind:'moto',   sign:'機車行', signC:P.signB },
    { x:1120, kind:'drug',   sign:'藥局',   signC:P.signG },
    { x:1280, kind:'shutter' },
    { x:1440, kind:'tattoo', door:'tattoo', sign:'刺青', signC:P.neonR }
  ];
  const SW = 160;

  /* 門的互動範圍(給遊戲端用) */
  const DOORS = SHOPS.filter(s => s.door)
    .map(s => ({ id:s.door, x:s.x + 52, w:58, y0:WALK_N, y1:WALK_S }));

  /* ---------------- 背景 ---------------- */
  function renderBackground(g) {
    const { px, alp } = tools(g);

    px(0, 0, W, H, P.sky);

    /* ===== 二樓以上的立面 ===== */
    SHOPS.forEach((s, i) => {
      const x = s.x;
      px(x, 0, SW, FLOOR_TOP - 78, [P.wallA, P.wallB, P.wallC][i % 3]);
      alp(.14, () => px(x + 12 + (i % 4) * 9, 22, 16, 60, P.wallDirt));
      /* 鐵窗 */
      const wx = x + 26, wy = 34, ww = 62, wh = 50;
      px(wx - 3, wy - 3, ww + 6, wh + 6, '#8f8a7c');
      px(wx, wy, ww, wh, P.sky);
      if ((i * 7) % 3 === 0) alp(.55, () => px(wx, wy, ww, wh, '#e6d9a8'));  // 有人在家
      for (let k = 0; k <= 4; k++) px(wx + k * 15, wy, 2, wh, P.barA);
      px(wx, wy + wh / 2, ww, 2, P.barB);
      /* 冷氣室外機 */
      px(x + 104, 46, 34, 24, P.ac);
      px(x + 104, 46, 34, 3, P.acD);
      px(x + 110, 52, 22, 12, P.acD);
      /* 二樓與一樓之間的雨遮 */
      px(x, FLOOR_TOP - 86, SW, 9, '#7f7a6d');
      px(x, FLOOR_TOP - 78, SW, 3, '#67635a');
    });

    /* ===== 招牌 ===== */
    SHOPS.forEach(s => {
      if (!s.sign) return;
      const x = s.x + 14, y = FLOOR_TOP - 126, w = SW - 28, h = 34;
      px(x - 2, y - 2, w + 4, h + 4, '#3a3833');
      px(x, y, w, h, s.signC);
      alp(.30, () => px(x, y, w, 10, '#fff'));
      /* 字用暗塊示意,灰模階段不畫字 —— 質感那一輪再交給圖 */
      const n = s.sign.length, cw = 20;
      for (let i = 0; i < n; i++)
        px(x + w / 2 - (n * cw) / 2 + i * cw + 3, y + 8, cw - 6, 18, 'rgba(28,26,24,.78)');
      alp(.20, () => px(x - 10, y + h, w + 20, 22, s.signC));      // 招牌打下來的光
    });

    /* ===== 一樓店面 ===== */
    SHOPS.forEach(s => {
      const x = s.x, top = FLOOR_TOP - 75, h = FLOOR_TOP - top;

      if (s.kind === 'shutter') {
        px(x + 8, top, SW - 16, h, P.shutter);
        for (let y = top + 4; y < FLOOR_TOP - 4; y += 7) px(x + 8, y, SW - 16, 3, P.shutterRib);
        px(x + 8, FLOOR_TOP - 6, SW - 16, 6, P.shutterD);
        alp(.16, () => px(x + 20, top + 12, 30, 44, P.wallDirt));
        return;
      }

      if (s.kind === 'home') {
        /* 住家:鐵門 + 信箱 + 一盞小燈 */
        px(x + 8, top, SW - 16, h, P.wallB);
        px(x + 52, top + 6, 58, h - 6, '#8d9490');
        for (let k = 0; k < 6; k++) px(x + 56, top + 14 + k * 10, 50, 3, '#767c78');
        px(x + 98, top + 40, 5, 12, '#5e625f');
        px(x + 18, top + 26, 20, 14, '#7b6a4c');                    // 信箱
        px(x + 18, top + 26, 20, 3, '#5f5238');
        px(x + 74, top - 8, 14, 8, '#d8d2c0');                      // 門燈
        alp(.30, () => px(x + 62, top - 6, 38, 30, '#f4e6b8'));
        return;
      }

      /* 有在營業的店:玻璃 + 燈光 */
      px(x + 8, top, SW - 16, h, P.wallB);
      const gx = x + 16, gw = SW - 32;
      px(gx, top + 6, gw, h - 12, P.glass);
      const lit = s.kind === 'store' ? P.storeLit : P.glassLit;
      alp(s.kind === 'store' ? .92 : .55, () => px(gx + 3, top + 9, gw - 6, h - 18, lit));

      if (s.kind === 'store') {
        px(gx + 3, top + 9, gw - 6, 8, '#d8e2d0');                  // 店裡的貨架剪影
        for (let k = 0; k < 5; k++) px(gx + 10 + k * 22, top + 26, 14, 26, '#c2ccc0');
        px(gx + gw / 2 - 16, top + 12, 32, h - 24, '#e9ede4');      // 自動門
        px(gx + gw / 2, top + 12, 2, h - 24, '#b6bdb2');
        alp(.22, () => px(x, FLOOR_TOP, SW, 44, P.storeLit));       // 光溢到騎樓地上
      } else if (s.kind === 'food') {
        for (let k = 0; k < 3; k++) px(gx + 10 + k * 34, top + 22, 24, 30, '#8a6b45');
        px(gx + 6, top + 14, gw - 12, 6, '#c8352a');
        alp(.14, () => px(x, FLOOR_TOP, SW, 34, '#f0d8a0'));
      } else if (s.kind === 'betel') {
        px(gx + gw / 2 - 22, top + 14, 44, h - 28, '#1f2a26');      // 玻璃小屋
        alp(.75, () => px(gx + gw / 2 - 18, top + 18, 36, h - 36, P.neonG));
        alp(.20, () => px(x + 20, FLOOR_TOP - 96, SW - 40, 100, P.neonG));
      } else if (s.kind === 'moto') {
        for (let k = 0; k < 3; k++) motorbike(g, x + 26 + k * 40, FLOOR_TOP - 4, .8);
      } else if (s.kind === 'drug') {
        px(gx + 8, top + 16, gw - 16, 20, '#2f8f5a');
        alp(.30, () => px(gx + 8, top + 16, gw - 16, 8, '#fff'));
      } else if (s.kind === 'tattoo') {
        alp(.55, () => px(gx + 3, top + 9, gw - 6, h - 18, '#2a1f28'));
        px(gx + 14, top + 18, gw - 28, 34, '#12100f');              // 牆上的圖樣
        for (let k = 0; k < 4; k++) px(gx + 20 + k * 26, top + 24, 18, 22, '#6b4a52');
        alp(.35, () => px(x + 16, FLOOR_TOP - 108, SW - 32, 112, P.neonR));
      }
    });

    /* ===== 騎樓地面 ===== */
    (function () {
      const T = 30;
      for (let y = FLOOR_TOP; y < H; y += T)
        for (let x = 0; x < W; x += T)
          px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? P.ground : P.groundB);
      for (let x = 0; x <= W; x += T) alp(.22, () => px(x, FLOOR_TOP, 1, H - FLOOR_TOP, P.groundSeam));
      for (let y = FLOOR_TOP; y <= H; y += T) alp(.16, () => px(0, y, W, 1, P.groundSeam));
      /* 馬路(畫面最下緣,只看得到一條) */
      px(0, H - 26, W, 4, P.curb);
      px(0, H - 22, W, 22, P.road);
      for (let x = 10; x < W; x += 90) alp(.55, () => px(x, H - 12, 40, 3, P.roadLine));
    })();

    /* ===== 電線杆 + 電線 ===== */
    [280, 760, 1240].forEach(x => {
      px(x, 0, 9, FLOOR_TOP - 74, P.pole);
      px(x - 8, 30, 25, 4, P.pole);
      px(x - 8, 44, 25, 4, P.pole);
    });
    for (let x = 0; x < W; x += 6) {
      const t = (x % 480) / 480;
      const sag = Math.sin(t * Math.PI) * 9;
      px(x, 32 + sag, 6, 2, P.wire);
      px(x, 46 + sag * .8, 6, 2, P.wire);
    }

    /* ===== 停在騎樓外側的機車 ===== */
    [120, 205, 400, 560, 690, 1050, 1180, 1350, 1520].forEach((x, i) =>
      motorbike(g, x, H - 30, 1 + (i % 3) * .06));

    /* ===== 雜物:紅塑膠椅、水桶、盆栽 ===== */
    px(352, FLOOR_TOP + 12, 18, 4, P.chair);
    px(352, FLOOR_TOP + 16, 4, 12, P.chair);
    px(366, FLOOR_TOP + 16, 4, 12, P.chair);
    px(366, FLOOR_TOP + 2, 4, 12, P.chair);
    px(1108, FLOOR_TOP + 14, 16, 14, P.bucket);
    px(1106, FLOOR_TOP + 12, 20, 3, '#5b87b8');
    px(628, FLOOR_TOP + 10, 14, 16, '#8a6b45');
    px(624, FLOOR_TOP + 2, 22, 10, '#3f7a44');
  }

  /* ---------------- 機車 ---------------- */
  function motorbike(g, cx, footY, s) {
    const { px, alp } = tools(g);
    const u = n => Math.round(n * (s || 1));
    alp(.18, () => px(cx - u(22), footY - u(2), u(44), u(5), '#4a4438'));
    px(cx - u(20), footY - u(12), u(10), u(10), P.bikeA);          // 後輪
    px(cx + u(10), footY - u(12), u(10), u(10), P.bikeA);          // 前輪
    px(cx - u(16), footY - u(20), u(32), u(9), P.bikeB);           // 車身
    px(cx - u(14), footY - u(26), u(16), u(7), P.bikeA);           // 座墊
    px(cx + u(8), footY - u(30), u(7), u(12), P.bikeC);            // 前面板
    px(cx + u(6), footY - u(34), u(14), u(4), P.bikeA);            // 龍頭
  }

  /* ---------------- 騎樓柱子(前景,角色從後面走過) ---------------- */
  const PILLARS = [];
  for (let x = 60; x < W; x += 320) PILLARS.push(x);
  function pillars(g) {
    const { px, alp } = tools(g);
    PILLARS.forEach(x => {
      px(x, FLOOR_TOP - 96, 26, H - (FLOOR_TOP - 96) - 6, P.pillar);
      px(x, FLOOR_TOP - 96, 5, H - (FLOOR_TOP - 96) - 6, P.pillarD);
      px(x + 21, FLOOR_TOP - 96, 5, H - (FLOOR_TOP - 96) - 6, P.pillarD);
      px(x - 3, H - 12, 32, 12, P.pillarBase);
      alp(.12, () => px(x + 4, FLOOR_TOP - 40, 14, 30, P.wallDirt));
    });
  }

  root.SceneStreet = {
    W, H, VIEW_W, P, FLOOR_TOP, WALK_N, WALK_S, SHOPS, DOORS, PILLARS,
    depthScale, renderBackground, pillars, motorbike
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
