/* no-way-up — 場景:街(平視 ＋ 橫向捲動 ＋ 深度移動 ＋ 街道網絡)
 *
 * 一條街 = 一份店面清單。makeStreet() 吃清單、吐一個場景物件,
 * 所以「加一條街」的成本是加一份資料,不是寫一個新場景。
 *
 * 街與街之間靠**巷口**接:走到巷口往深處走(↑),就走到另一條街。
 * 不是選單傳送,是走過去。
 *
 * 垂直配置(2026-08-04):
 *   0–110   二樓立面(鐵窗、冷氣)＋ 招牌
 *   110–121 雨遮
 *   121–196 一樓店面
 *   196–334 騎樓地面 ← 可走 220–326
 *   334–360 馬路
 */
(function (root) {
  const H = 360, VIEW_W = 640, SW = 160;
  const FLOOR_TOP = 196;
  const WALK_N = 220, WALK_S = 326;
  const EAVE = FLOOR_TOP - 86;         // 110
  const SHOP_TOP = FLOOR_TOP - 75;     // 121

  const depthScale = y => 0.78 + 0.22 * ((y - WALK_N) / (WALK_S - WALK_N));

  const P = {
    sky:'#131a24',
    wallA:'#b9b2a2', wallB:'#aea695', wallC:'#c3bcac', wallDirt:'#9e9686',
    pillar:'#c6c0b1', pillarD:'#a49d8e', pillarBase:'#8d8779',
    ground:'#a9a496', groundB:'#a19c8f', groundSeam:'#8f8a7e', curb:'#8a8578',
    road:'#3d3f42', roadLine:'#c9c07a',

    barA:'#7d8478', barB:'#6b7167',
    ac:'#d6d2c6', acD:'#b0aca0',
    shutter:'#8e9490', shutterD:'#767c78', shutterRib:'#a0a6a2',

    signR:'#c8352a', signY:'#e8b52c', signG:'#2f8f5a', signB:'#2f6fa8', signW:'#f2efe4',
    neonG:'#5ce08a', neonR:'#ff5a4a', neonP:'#ff4fa0', neonB:'#4fc8f0',
    glass:'#2a3b48', glassLit:'#cfe4ee', storeLit:'#f6f7ec',
    wood:'#8a6b45', woodD:'#6b5234',
    bikeA:'#3a3f46', bikeB:'#5b6472', bikeC:'#7a4a3a',
    pole:'#8a8a84', wire:'#26282c',
    chair:'#c0473a', bucket:'#3f6f9a',

    /* 宮廟 —— 世界觀的核心視覺 */
    tRed:'#9e2b22', tRedD:'#78201a', tRoof:'#6b3a26', tRoofHi:'#8a4e33',
    tGold:'#d4a03c', tGoldD:'#a87c28', tStone:'#cfc7b4', tStoneD:'#a89f8c',
    tLantern:'#e0432f', tDoor:'#7a1e16', tGreen:'#2f6b48',

    alleyDark:'#1c2129', alleyWall:'#8f8a7c', alleyLamp:'#f2e0a8',
    tarp:'#c8352a', tarpB:'#2f6fa8', frame:'#9a9a94'
  };

  function tools(g) {
    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };
    return { px, alp };
  }

  /* ---------------- 機車 ---------------- */
  function motorbike(g, cx, footY, s) {
    const { px, alp } = tools(g);
    const u = n => Math.round(n * (s || 1));
    alp(.18, () => px(cx - u(22), footY - u(2), u(44), u(5), '#4a4438'));
    px(cx - u(20), footY - u(12), u(10), u(10), P.bikeA);
    px(cx + u(10), footY - u(12), u(10), u(10), P.bikeA);
    px(cx - u(16), footY - u(20), u(32), u(9), P.bikeB);
    px(cx - u(14), footY - u(26), u(16), u(7), P.bikeA);
    px(cx + u(8),  footY - u(30), u(7), u(12), P.bikeC);
    px(cx + u(6),  footY - u(34), u(14), u(4), P.bikeA);
  }

  /* ---------------- 宮廟(佔兩格 320 寬,前面是開放的廟埕) ---------------- */
  function temple(g, x) {
    const { px, alp } = tools(g);
    const w = SW * 2;

    /* 屋頂:三層退階 + 兩側翹脊 */
    px(x + 4, 30, w - 8, 16, P.tRoof);
    px(x + 4, 30, w - 8, 4, P.tRoofHi);
    px(x + 16, 18, w - 32, 14, P.tRoof);
    px(x + 16, 18, w - 32, 4, P.tRoofHi);
    px(x + 46, 8, w - 92, 12, P.tRoof);
    px(x + 46, 8, w - 92, 4, P.tRoofHi);
    for (let k = 0; k < 4; k++) {                     // 翹脊
      px(x - 2 + k * 5, 30 - k * 5, 8, 5, P.tRoofHi);
      px(x + w - 6 - k * 5, 30 - k * 5, 8, 5, P.tRoofHi);
    }
    px(x + w / 2 - 10, 2, 20, 8, P.tGold);            // 中脊的裝飾
    px(x + w / 2 - 4, 0, 8, 4, P.tRed);

    /* 廟身 */
    px(x + 10, 46, w - 20, FLOOR_TOP - 46, P.tRed);
    px(x + 10, 46, w - 20, 5, P.tRedD);
    /* 匾額 */
    px(x + w / 2 - 62, 56, 124, 26, P.tGoldD);
    px(x + w / 2 - 58, 60, 116, 18, P.tGold);
    for (let k = 0; k < 3; k++) px(x + w / 2 - 34 + k * 24, 63, 16, 12, 'rgba(40,26,12,.72)');

    /* 紅柱 */
    [22, 96, w - 118, w - 44].forEach(dx => {
      px(x + dx, 88, 22, FLOOR_TOP - 88, P.tRedD);
      px(x + dx + 3, 88, 16, FLOOR_TOP - 88, P.tRed);
      px(x + dx - 4, FLOOR_TOP - 10, 30, 10, P.tStone);
    });
    /* 三個門洞 */
    [x + 48, x + w / 2 - 26, x + w - 100].forEach((dx, i) => {
      const dw = i === 1 ? 52 : 44, top = 100;
      px(dx, top, dw, FLOOR_TOP - top, P.tDoor);
      px(dx, top, dw, 4, P.tGoldD);
      px(dx + dw / 2 - 1, top + 6, 2, FLOOR_TOP - top - 8, P.tGoldD);
      for (let r = 0; r < 3; r++)
        px(dx + 6, top + 14 + r * 20, dw - 12, 3, P.tGoldD);
    });
    /* 一排紅燈籠 */
    for (let k = 0; k < 6; k++) {
      const lx = x + 30 + k * 52;
      px(lx + 6, 84, 2, 8, '#3a2a1a');
      px(lx, 92, 16, 20, P.tLantern);
      px(lx, 96, 16, 3, P.tGold);
      px(lx, 106, 16, 3, P.tGold);
      px(lx + 5, 112, 6, 4, P.tGold);
      alp(.26, () => px(lx - 5, 88, 26, 30, P.tLantern));
    }
    /* 廟埕:沒有騎樓,地面直接鋪石板 */
    for (let gy = FLOOR_TOP; gy < H - 26; gy += 26)
      for (let gx = x; gx < x + w; gx += 34) {
        px(gx, gy, 34, 26, P.tStone);
        alp(.35, () => px(gx, gy, 34, 1, P.tStoneD));
        alp(.35, () => px(gx, gy, 1, 26, P.tStoneD));
      }
    /* 大香爐 */
    const cx = x + w / 2;
    px(cx - 26, FLOOR_TOP + 34, 52, 26, P.tGoldD);
    px(cx - 30, FLOOR_TOP + 30, 60, 6, P.tGold);
    px(cx - 34, FLOOR_TOP + 34, 8, 18, P.tGoldD);
    px(cx + 26, FLOOR_TOP + 34, 8, 18, P.tGoldD);
    alp(.30, () => px(cx - 18, FLOOR_TOP + 8, 36, 24, '#cfc6b4'));   // 香煙
    alp(.16, () => px(cx - 26, FLOOR_TOP - 14, 52, 30, '#cfc6b4'));
    alp(.10, () => px(x + 20, FLOOR_TOP, w - 40, 60, P.tLantern));   // 燈籠打在地上的紅
  }

  /* ---------------- 巷口(街與街之間的接點) ---------------- */
  function alley(g, x) {
    const { px, alp } = tools(g);
    /* 兩側牆往深處收 */
    px(x, 0, SW, FLOOR_TOP + 40, P.alleyDark);
    px(x, 0, 26, EAVE + 11, P.alleyWall);
    px(x + SW - 26, 0, 26, EAVE + 11, P.alleyWall);
    for (let k = 0; k < 5; k++) {
      const inset = 4 + k * 7, dark = 1 - k * .13;
      alp(dark, () => px(x + 26 + inset * 2, EAVE - 4 - k * 6, SW - 52 - inset * 4, 8, P.alleyDark));
    }
    /* 深處那一盞燈 */
    px(x + SW / 2 - 7, 92, 14, 8, '#cfcabc');
    alp(.55, () => px(x + SW / 2 - 20, 96, 40, 34, P.alleyLamp));
    alp(.22, () => px(x + SW / 2 - 34, 96, 68, 64, P.alleyLamp));
    /* 巷子的地面往深處延伸 —— 這一格沒有騎樓地磚 */
    for (let gy = FLOOR_TOP - 30; gy < H - 26; gy += 22) {
      const t = (gy - (FLOOR_TOP - 30)) / (H - 26 - (FLOOR_TOP - 30));
      const inset = Math.round(34 * (1 - t));
      alp(.85, () => px(x + inset, gy, SW - inset * 2, 22, t > .3 ? P.ground : '#6e6a60'));
    }
    /* 冷氣滴水管、電表箱 */
    px(x + 12, 60, 6, 90, '#7c786c');
    px(x + SW - 30, 66, 18, 22, '#9a9488');
    /* 提示用的箭頭色塊(灰模階段的示意,正式版換成美術) */
    alp(.5, () => px(x + SW / 2 - 8, FLOOR_TOP - 44, 16, 5, P.alleyLamp));
    alp(.5, () => px(x + SW / 2 - 5, FLOOR_TOP - 52, 10, 5, P.alleyLamp));
  }

  /* ---------------- 一條街 ---------------- */
  function makeStreet(cfg) {
    const shops = cfg.shops;
    const W = shops.length * SW;
    shops.forEach((s, i) => { s.x = i * SW; });

    const doors  = shops.filter(s => s.door)
      .map(s => ({ id:s.door, x:s.x + 52, w:58, y0:WALK_N, y1:WALK_S }));
    /* 巷口:走到這一格、而且往深處走到底,就換街 */
    const alleys = shops.filter(s => s.kind === 'alley')
      .map(s => ({ to:s.to, x:s.x + 30, w:SW - 60 }));

    const pillarXs = [];
    for (let x = 60; x < W; x += 320) {
      const cell = shops[(x / SW) | 0];
      /* 廟埕跟巷口前面沒有騎樓柱 */
      if (cell && (cell.kind === 'temple' || cell.kind === 'temple2' || cell.kind === 'alley')) continue;
      pillarXs.push(x);
    }
    const curbBikes = [];
    shops.forEach((s, i) => {
      if (s.kind === 'temple' || s.kind === 'temple2' || s.kind === 'alley') return;
      curbBikes.push(s.x + 34 + (i % 3) * 18, s.x + 112 - (i % 2) * 20);
    });

    function renderBackground(g) {
      const { px, alp } = tools(g);
      px(0, 0, W, H, P.sky);

      /* 二樓立面(宮廟、巷口自己畫) */
      shops.forEach((s, i) => {
        if (s.kind === 'temple' || s.kind === 'temple2' || s.kind === 'alley') return;
        const x = s.x;
        px(x, 0, SW, EAVE + 11, [P.wallA, P.wallB, P.wallC][i % 3]);
        alp(.14, () => px(x + 12 + (i % 4) * 9, 8, 16, 44, P.wallDirt));
        const wx = x + 26, wy = 12, ww = 62, wh = 42;
        px(wx - 3, wy - 3, ww + 6, wh + 6, '#8f8a7c');
        px(wx, wy, ww, wh, P.sky);
        if ((i * 7) % 3 === 0) alp(.55, () => px(wx, wy, ww, wh, '#e6d9a8'));
        for (let k = 0; k <= 4; k++) px(wx + k * 15, wy, 2, wh, P.barA);
        px(wx, wy + wh / 2, ww, 2, P.barB);
        px(x + 106, 16, 32, 22, P.ac);
        px(x + 106, 16, 32, 3, P.acD);
        px(x + 112, 22, 20, 11, P.acD);
        px(x, EAVE, SW, 9, '#7f7a6d');
        px(x, EAVE + 8, SW, 3, '#67635a');
      });

      /* 宮廟 */
      shops.forEach(s => { if (s.kind === 'temple') temple(g, s.x); });

      /* 招牌 */
      shops.forEach(s => {
        if (!s.sign) return;
        const x = s.x + 14, y = 66, w = SW - 28, h = 34;
        px(x - 2, y - 2, w + 4, h + 4, '#3a3833');
        px(x, y, w, h, s.signC);
        alp(.30, () => px(x, y, w, 10, '#fff'));
        const n = s.sign.length, cw = 20;
        for (let i = 0; i < n; i++)
          px(x + w / 2 - (n * cw) / 2 + i * cw + 3, y + 8, cw - 6, 18, 'rgba(28,26,24,.78)');
        alp(.18, () => px(x - 10, y + h, w + 20, 14, s.signC));
      });

      /* 一樓店面 */
      shops.forEach(s => {
        const x = s.x, top = SHOP_TOP, h = FLOOR_TOP - top;
        const K = s.kind;
        if (K === 'temple' || K === 'temple2' || K === 'alley') return;

        if (K === 'shutter') {
          px(x + 8, top, SW - 16, h, P.shutter);
          for (let y = top + 4; y < FLOOR_TOP - 4; y += 7) px(x + 8, y, SW - 16, 3, P.shutterRib);
          px(x + 8, FLOOR_TOP - 6, SW - 16, 6, P.shutterD);
          alp(.16, () => px(x + 20, top + 12, 30, 40, P.wallDirt));
          return;
        }
        if (K === 'home') {
          px(x + 8, top, SW - 16, h, P.wallB);
          px(x + 52, top + 4, 58, h - 4, '#8d9490');
          for (let k = 0; k < 6; k++) px(x + 56, top + 12 + k * 10, 50, 3, '#767c78');
          px(x + 98, top + 36, 5, 12, '#5e625f');
          px(x + 18, top + 22, 20, 14, '#7b6a4c');
          px(x + 18, top + 22, 20, 3, '#5f5238');
          px(x + 74, top - 9, 14, 8, '#d8d2c0');
          alp(.32, () => px(x + 60, top - 7, 42, 30, '#f4e6b8'));
          return;
        }
        if (K === 'stall') {
          /* 路邊攤:推車 + 遮陽傘 + 幾張紅塑膠椅 */
          px(x + 8, top, SW - 16, h, P.wallB);
          px(x + 14, top + 10, SW - 28, 6, P.tarp);
          px(x + 14, top + 16, SW - 28, 5, P.tarpB);
          px(x + 30, top + 24, 96, 34, P.frame);
          px(x + 30, top + 24, 96, 5, '#c8c4b8');
          alp(.55, () => px(x + 38, top + 30, 80, 20, '#e8dcc0'));
          alp(.16, () => px(x, FLOOR_TOP, SW, 40, '#f0d8a0'));
          for (let k = 0; k < 3; k++) {
            const cx2 = x + 24 + k * 42;
            px(cx2, FLOOR_TOP + 16, 18, 4, P.chair);
            px(cx2, FLOOR_TOP + 20, 4, 12, P.chair);
            px(cx2 + 14, FLOOR_TOP + 20, 4, 12, P.chair);
            px(cx2 + 14, FLOOR_TOP + 4, 4, 14, P.chair);
          }
          return;
        }

        px(x + 8, top, SW - 16, h, P.wallB);
        const gx = x + 16, gw = SW - 32;
        px(gx, top + 5, gw, h - 10, P.glass);
        const lit = K === 'store' ? P.storeLit : P.glassLit;
        alp(K === 'store' ? .92 : .55, () => px(gx + 3, top + 8, gw - 6, h - 16, lit));

        if (K === 'store') {
          px(gx + 3, top + 8, gw - 6, 7, '#d8e2d0');
          for (let k = 0; k < 5; k++) px(gx + 10 + k * 22, top + 22, 14, 26, '#c2ccc0');
          px(gx + gw / 2 - 16, top + 11, 32, h - 22, '#e9ede4');
          px(gx + gw / 2, top + 11, 2, h - 22, '#b6bdb2');
          alp(.20, () => px(x, FLOOR_TOP, SW, 52, P.storeLit));
        } else if (K === 'food') {
          for (let k = 0; k < 3; k++) px(gx + 10 + k * 34, top + 20, 24, 28, '#8a6b45');
          px(gx + 6, top + 12, gw - 12, 6, '#c8352a');
          alp(.13, () => px(x, FLOOR_TOP, SW, 40, '#f0d8a0'));
        } else if (K === 'betel') {
          px(gx + gw / 2 - 22, top + 12, 44, h - 24, '#1f2a26');
          alp(.75, () => px(gx + gw / 2 - 18, top + 16, 36, h - 32, P.neonG));
          alp(.16, () => px(x + 20, top - 4, SW - 40, h + 46, P.neonG));
        } else if (K === 'moto') {
          for (let k = 0; k < 3; k++) motorbike(g, x + 30 + k * 40, FLOOR_TOP - 6, .72);
        } else if (K === 'drug') {
          px(gx + 8, top + 14, gw - 16, 20, '#2f8f5a');
          alp(.30, () => px(gx + 8, top + 14, gw - 16, 8, '#fff'));
        } else if (K === 'tattoo') {
          alp(.55, () => px(gx + 3, top + 8, gw - 6, h - 16, '#2a1f28'));
          px(gx + 14, top + 16, gw - 28, 32, '#12100f');
          for (let k = 0; k < 4; k++) px(gx + 20 + k * 26, top + 22, 18, 20, '#6b4a52');
          alp(.28, () => px(x + 16, top - 6, SW - 32, h + 50, P.neonR));
        } else if (K === 'arcade') {
          alp(.65, () => px(gx + 3, top + 8, gw - 6, h - 16, '#2a1030'));
          for (let k = 0; k < 4; k++)
            px(gx + 12 + k * 26, top + 16, 18, 34, ['#ff4fa0','#4fc8f0','#ffd24f','#7cff9a'][k]);
          alp(.30, () => px(x + 10, top - 8, SW - 20, h + 54, P.neonP));
        } else if (K === 'net') {
          alp(.60, () => px(gx + 3, top + 8, gw - 6, h - 16, '#12202e'));
          for (let k = 0; k < 6; k++) px(gx + 10 + k * 18, top + 20, 12, 16, P.neonB);
          alp(.22, () => px(x + 14, top - 4, SW - 28, h + 46, P.neonB));
        }
      });

      /* 巷口 */
      shops.forEach(s => { if (s.kind === 'alley') alley(g, s.x); });

      /* 電線杆 + 電線 */
      for (let x = 320; x < W; x += 480) {
        const cell = shops[(x / SW) | 0];
        if (cell && cell.kind === 'temple') continue;
        px(x, 0, 9, FLOOR_TOP + 96, P.pole);
        px(x - 8, 18, 25, 4, P.pole);
        px(x - 8, 32, 25, 4, P.pole);
      }
      for (let x = 0; x < W; x += 6) {
        const t = (x % 480) / 480, sag = Math.sin(t * Math.PI) * 8;
        px(x, 20 + sag, 6, 2, P.wire);
        px(x, 34 + sag * .8, 6, 2, P.wire);
      }

      /* 騎樓地面(宮廟、巷口那幾格自己鋪過了) */
      const T = 30;
      shops.forEach(s => {
        if (s.kind === 'temple' || s.kind === 'temple2' || s.kind === 'alley') return;
        for (let y = FLOOR_TOP; y < H - 26; y += T)
          for (let x = s.x; x < s.x + SW; x += T)
            px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? P.ground : P.groundB);
      });
      for (let x = 0; x <= W; x += T) alp(.20, () => px(x, FLOOR_TOP, 1, H - 26 - FLOOR_TOP, P.groundSeam));
      for (let y = FLOOR_TOP; y <= H - 26; y += T) alp(.14, () => px(0, y, W, 1, P.groundSeam));

      /* 馬路 */
      px(0, H - 26, W, 4, P.curb);
      px(0, H - 22, W, 22, P.road);
      for (let x = 10; x < W; x += 90) alp(.55, () => px(x, H - 12, 40, 3, P.roadLine));
    }

    /* 前景:騎樓柱子 ＋ 停在路邊的機車。角色從它們後面走過去 */
    function pillars(g) {
      const { px, alp } = tools(g);
      pillarXs.forEach(x => {
        const top = EAVE + 11;
        px(x, top, 26, H - top - 8, P.pillar);
        px(x, top, 5, H - top - 8, P.pillarD);
        px(x + 21, top, 5, H - top - 8, P.pillarD);
        px(x - 3, H - 14, 32, 14, P.pillarBase);
        alp(.12, () => px(x + 4, FLOOR_TOP + 20, 14, 40, P.wallDirt));
      });
      curbBikes.forEach((x, i) => motorbike(g, x, H - 20, 1 + (i % 3) * .06));
    }

    return {
      id: cfg.id, name: cfg.name, W, H, wide: W, shops,
      doors, alleys, walkN: WALK_N, walkS: WALK_S,
      renderBackground, pillars
    };
  }

  /* ---------------- 目前的街道網絡(資料只有這一份,遊戲跟匯出工具共用) ----------------
   * 加一條街 = 在這裡加一筆。門用 door 標,巷口用 kind:'alley' + to 標。
   */
  const STREET_DATA = {
    st1: { id:'st1', name:'巷子口', shops:[
      { kind:'shutter' },
      { kind:'home',  door:'home' },
      { kind:'food',  sign:'麵',     signC:P.signR },
      { kind:'betel', sign:'檳榔',   signC:P.neonG },
      { kind:'alley', to:'st2' },
      { kind:'store', door:'store',  sign:'超商', signC:P.signW },
      { kind:'moto',  sign:'機車行', signC:P.signB },
      { kind:'drug',  sign:'藥局',   signC:P.signG },
      { kind:'shutter' },
      { kind:'shutter' }
    ]},
    st2: { id:'st2', name:'廟口', shops:[
      { kind:'shutter' },
      { kind:'stall' },
      { kind:'temple' },
      { kind:'temple2' },
      { kind:'alley', to:'st1' },
      { kind:'arcade', sign:'遊藝場', signC:P.neonP },
      { kind:'tattoo', door:'tattoo', sign:'刺青', signC:P.neonR },
      { kind:'net',    sign:'網咖',   signC:P.neonB },
      { kind:'food',   sign:'宵夜',   signC:P.signY },
      { kind:'shutter' }
    ]}
  };

  root.SceneStreet = {
    H, VIEW_W, SW, P, FLOOR_TOP, WALK_N, WALK_S, STREET_DATA,
    depthScale, makeStreet, motorbike, temple, alley
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
