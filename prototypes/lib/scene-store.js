/* no-way-up — 場景：超商（3/4 斜俯視灰模）
 *
 * 這份是純繪圖邏輯,不碰 DOM。同時被兩邊使用:
 *   - prototypes/store-topdown.html  → 瀏覽器預覽
 *   - tools/render-scene.mjs         → 輸出 PNG 給 ComfyUI 圖生圖當構圖底
 *
 * ctx 只需要實作 fillStyle / fillRect / globalAlpha 三樣。
 */
(function (root) {
  const W = 640, H = 360;
  const WALL_H = 70;          // 後牆與地板的分界

  const C = {
    ceilShadow:'#3c4048', wallTop:'#b4b8aa', wall:'#aeb2a4', wallLow:'#9aa08f', kick:'#7e8478',
    floorA:'#a6aa9e', floorB:'#9ea295', floorLine:'#8f9488', floorGlow:'#c6cabc',
    night:'#0d1420', glass:'#1b2836', frame:'#535b64', frameLit:'#6d7681',
    fridge:'#69737c', fridgeDark:'#464f58', fridgeGlass:'#22414f', fridgeGlow:'#63b4c8',
    shelfTop:'#9ba095', shelfFace:'#7c8177', shelfEdge:'#6a6f66',
    hotTop:'#a9683a', hotFace:'#7f4c29', hotInner:'#9aa094',
    counterTop:'#8e8574', counterFace:'#6f6455',
    goodsA:'#8c6f52', goodsB:'#6d7f8c', goodsC:'#8a7f5c', goodsD:'#7a6a80', goodsE:'#6f8272',
    bento:'#cfc4ac', bentoLid:'#b5a98f', tagY:'#d7ae3c', tagW:'#ddd9cc',
    pcHood:'#39434f', pcHoodD:'#2b333d', pcPants:'#2e333b', pcHair:'#241d19', pcSkin:'#c99a76',
    npcShirt:'#dee2de', npcShirtD:'#c0c5c0', npcPants:'#333c52', npcHair:'#1f1b18',
    npcSkin:'#d8ad88', npcBag:'#57482f',
    clShirt:'#dcd8c9', clVest:'#33604a', clHair:'#211c18', clSkin:'#d3a67f',
    ink:'#1c1f24'
  };

  function render(g, opts) {
    const o = Object.assign({ people: true, light: true, grid: false }, opts || {});

    const px = (x, y, w, h, c) => {
      if (c) g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const alp = (a, fn) => { g.globalAlpha = a; fn(); g.globalAlpha = 1; };

    /* ---------- 地板 ---------- */
    function drawFloor() {
      const T = 32;
      for (let y = WALL_H; y < H; y += T)
        for (let x = 0; x < W; x += T)
          px(x, y, T, T, (((x / T) | 0) + ((y / T) | 0)) % 2 ? C.floorA : C.floorB);

      if (o.grid) {
        for (let x = 0; x <= W; x += T) px(x, WALL_H, 1, H - WALL_H, C.floorLine);
        for (let y = WALL_H; y <= H; y += T) px(0, y, W, 1, C.floorLine);
      } else {
        for (let x = 0; x <= W; x += T) alp(.35, () => px(x, WALL_H, 1, H - WALL_H, C.floorLine));
        for (let y = WALL_H; y <= H; y += T) alp(.25, () => px(0, y, W, 1, C.floorLine));
      }
    }

    /* ---------- 後牆 ---------- */
    function drawWall() {
      px(0, 0, W, 10, C.ceilShadow);
      px(0, 10, W, 34, C.wallTop);
      px(0, 44, W, WALL_H - 44 - 6, C.wallLow);
      px(0, WALL_H - 6, W, 6, C.kick);
      px(0, WALL_H, W, 1, '#767c70');
    }

    /* ---------- 自動門（左上）,門外是夜 ---------- */
    function drawDoor() {
      const x = 34, y = 8, w = 118, h = WALL_H - 8;
      px(x - 4, y - 4, w + 8, h + 4, C.frame);
      px(x, y, w, h, C.night);
      alp(.5, () => px(x, y, w, 20, '#18243a'));
      alp(.45, () => px(x + 70, y + 6, 34, 34, '#3c4a2e'));   // 路燈光暈
      px(x + 82, y + 10, 9, 3, '#d9cb95');
      px(x + 10, y + 16, 26, 10, '#141d2a');                  // 對街暗招牌
      px(x + w / 2 - 1, y, 2, h, C.frameLit);
      px(x, y, 2, h, C.frameLit); px(x + w - 2, y, 2, h, C.frameLit);
      px(x, y + h - 5, w, 5, C.frameLit);
      alp(.13, () => { for (let i = 0; i < 14; i++) px(x + 8 + i * 3, y + 6 + i * 3, 5, 3, '#ffffff'); });
    }

    /* ---------- 後牆的飲料冰櫃 ---------- */
    function drawBackFridges() {
      for (let i = 0; i < 3; i++) {
        const x = 182 + i * 86, y = 12, w = 78, h = WALL_H - 12 - 4;
        px(x - 2, y - 2, w + 4, h + 4, C.fridgeDark);
        px(x, y, w, h, C.fridge);
        px(x + 3, y + 3, w - 6, h - 9, C.fridgeGlass);
        for (let r = 0; r < 3; r++) {
          const sy = y + 6 + r * 16;
          px(x + 4, sy + 12, w - 8, 2, '#2d5867');
          for (let b = 0; b < 9; b++) {
            px(x + 5 + b * 8, sy + 2, 6, 10, [C.goodsA, C.goodsB, C.goodsC, C.goodsE][(b + r + i) % 4]);
            px(x + 6 + b * 8, sy, 3, 2, '#c3cbd0');
          }
        }
        alp(.20, () => px(x + 3, y + 3, w - 6, h - 9, C.fridgeGlow));
        alp(.11, () => { for (let k = 0; k < 12; k++) px(x + 8 + k * 4, y + 6 + k * 4, 6, 3, '#ffffff'); });
        px(x, y, w, 2, '#98a2ab');
      }
    }

    /* ---------- 櫃台（右上,頂面＋正面厚度） ---------- */
    function drawCounter() {
      const x = 458, yTop = 78, w = W - 458 - 6, dTop = 30, dFace = 18;
      px(x - 6, 8, w + 8, 26, '#9aa094');                     // 後方菸櫃
      for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++)
        px(x - 2 + i * 21, 11 + r * 12, 17, 9, [C.goodsA, C.goodsD, C.goodsC, C.goodsB][(i + r) % 4]);
      px(x - 6, 8, w + 8, 2, '#aab0a4');
      px(x, yTop, w, dTop, C.counterTop);
      px(x, yTop, w, 2, '#9c9382');
      px(x, yTop + dTop, w, dFace, C.counterFace);
      px(x, yTop + dTop, w, 1, '#5e5445');
      px(x + 22, yTop - 12, 34, 14, '#4c525c');               // 收銀機
      px(x + 22, yTop + 2, 34, 8, '#3c424b');
      px(x + 25, yTop - 9, 28, 8, '#79c4b6');
      px(x + 92, yTop - 10, 16, 12, '#d7d1bd');               // 集點立牌
      px(x + 94, yTop - 8, 12, 4, '#a8543c');
    }

    /* ---------- 島型貨架:頂面（俯視）＋ 正面厚度 ---------- */
    function island(x, y, w, dTop, dFace, rows, cols) {
      px(x, y, w, dTop, C.shelfTop);
      px(x, y, w, 2, '#a9aea2');
      px(x, y + dTop, w, dFace, C.shelfFace);
      px(x, y + dTop, w, 1, C.shelfEdge);
      px(x, y + dTop + dFace - 2, w, 2, '#5f645c');
      for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
        const bw = (w - 8) / cols, bh = (dTop - 8) / rows;
        const bx = x + 4 + i * bw, by = y + 4 + r * bh;
        px(bx, by, bw - 3, bh - 3, [C.goodsA, C.goodsB, C.goodsC, C.goodsD, C.goodsE][(i * 2 + r * 3) % 5]);
        alp(.22, () => px(bx, by, bw - 3, 2, '#ffffff'));
      }
      alp(.16, () => px(x + 3, y + dTop + dFace, w - 6, 5, '#3d4249'));
    }

    /* ---------- 鮮食開放櫃:這一幕的重點 ---------- */
    function hotFood() {
      const x = 352, y = 150, w = 176, dTop = 54, dFace = 26;
      px(x - 3, y - 3, w + 6, dTop + dFace + 4, C.hotFace);
      px(x, y, w, dTop, C.hotInner);
      px(x, y, w, 3, C.hotTop);
      px(x, y + dTop, w, dFace, C.hotFace);
      px(x, y + dTop, w, 2, '#63391d');
      px(x, y + dTop + dFace - 3, w, 3, '#5a3419');
      // 後排空一半（晚上八點了）,前排是黃標
      [1, 1, 0, 1, 0, 1].forEach((h, i) => {
        if (!h) return;
        const bx = x + 8 + i * 27;
        px(bx, y + 7, 22, 18, C.bento); px(bx, y + 7, 22, 5, C.bentoLid);
        alp(.20, () => px(bx, y + 7, 22, 2, '#ffffff'));
      });
      [1, 1, 1, 1, 1, 0].forEach((h, i) => {
        if (!h) return;
        const bx = x + 8 + i * 27;
        px(bx, y + 30, 22, 18, C.bento); px(bx, y + 30, 22, 5, C.bentoLid);
        px(bx, y + 45, 22, 3, C.tagY);
        alp(.20, () => px(bx, y + 30, 22, 2, '#ffffff'));
      });
      px(x + 10, y + dTop + 7, 26, 11, C.tagW);               // 正價牌
      px(x + 120, y + dTop + 7, 26, 11, C.tagY);              // 黃標牌
      alp(.16, () => px(x + 3, y + dTop + dFace, w - 6, 6, '#3d4249'));
    }

    /* ---------- 人物:正面站立,約 42px 高 ----------
     * dir: 'down' 正面 | 'up' 背面 | 'downRight' 半側面朝右下
     */
    function person(cx, footY, p) {
      const { dir = 'down', skin, hair, top, topD, pants, bag = false, hood = false, hold = false } = p;
      const x = Math.round(cx), b = Math.round(footY);

      alp(.20, () => px(x - 9, b - 2, 18, 5, '#3b4046'));      // 影子

      px(x - 7, b - 13, 6, 12, pants);                         // 腿
      px(x + 1, b - 13, 6, 12, pants);
      px(x - 8, b - 3, 7, 3, C.ink);                           // 鞋
      px(x + 1, b - 3, 7, 3, C.ink);

      px(x - 8, b - 29, 16, 17, top);                          // 身體
      px(x - 8, b - 29, 16, 4, topD);
      px(dir === 'downRight' ? x + 5 : x - 8, b - 28, 3, 15, topD);

      if (bag) {                                               // 書包
        px(x - 11, b - 27, 5, 13, C.npcBag);
        px(x - 8, b - 30, 16, 3, '#463a26');
      }
      px(x - 11, b - 27, 3, 13, top);                          // 手臂
      px(x + 8, b - 27, 3, 13, top);
      px(x - 11, b - 15, 3, 3, skin);
      px(x + 8, b - 15, 3, 3, skin);

      if (hold) {                                              // 手上的黃標便當
        px(x + 9, b - 18, 12, 8, C.bento);
        px(x + 9, b - 18, 12, 3, C.bentoLid);
        px(x + 9, b - 21, 5, 3, C.tagY);
      }

      const hy = b - 42;                                       // 頭
      px(x - 6, hy, 12, 13, skin);
      px(x - 7, hy - 2, 14, 6, hair);
      px(x - 7, hy + 2, 2, 6, hair);
      px(x + 5, hy + 2, 2, 6, hair);
      if (hood) {
        px(x - 9, hy - 3, 18, 8, C.pcHoodD);
        px(x - 9, hy + 3, 3, 9, C.pcHoodD);
        px(x + 6, hy + 3, 3, 9, C.pcHoodD);
      }
      if (dir === 'up') {
        px(x - 6, hy, 12, 11, hair);                           // 背面:只看到後腦
      } else if (dir === 'downRight') {
        px(x - 1, hy + 5, 2, 2, C.ink);
        px(x + 4, hy + 5, 2, 2, C.ink);
        px(x - 6, hy, 6, 4, hair);
      } else {
        px(x - 4, hy + 5, 2, 2, C.ink);
        px(x + 2, hy + 5, 2, 2, C.ink);
      }
    }

    /* ---------- 光:看不到燈本身,只看得到光 ---------- */
    function lighting() {
      if (!o.light) return;
      for (const [by, bh] of [[92, 26], [196, 26], [300, 26]]) {
        alp(.13, () => px(20, by, W - 40, bh, C.floorGlow));
        alp(.08, () => px(8, by - 7, W - 16, bh + 14, C.floorGlow));
      }
      alp(.10, () => px(176, WALL_H, 268, 40, C.fridgeGlow));  // 冰櫃冷光溢到地板
      alp(.14, () => px(20, WALL_H, 150, 62, '#1b2942'));      // 門外滲進來的夜
      alp(.20, () => {
        px(0, 0, W, 12, '#0b0e14'); px(0, H - 14, W, 14, '#0b0e14');
        px(0, 0, 10, H, '#0b0e14'); px(W - 10, 0, 10, H, '#0b0e14');
      });
      alp(.10, () => { px(0, 0, W, 26, '#0b0e14'); px(0, H - 30, W, 30, '#0b0e14'); });
    }

    /* ---------- 組裝 ---------- */
    drawFloor();
    drawWall();
    drawDoor();
    drawBackFridges();

    // 店員先畫、櫃台後畫 —— 讓櫃台擋住他的下半身,這才是超商櫃台真正的樣子
    if (o.people)
      person(548, 76, { dir:'down', skin:C.clSkin, hair:C.clHair, top:C.clVest, topD:'#27503c', pants:'#3a4048' });
    drawCounter();

    island(58, 128, 150, 44, 20, 2, 5);
    island(58, 246, 150, 44, 20, 2, 5);
    hotFood();

    if (o.people) {
      // 同學:已經走到中央走道,停住,身體轉向主角
      person(250, 215, { dir:'downRight', skin:C.npcSkin, hair:C.npcHair, top:C.npcShirt, topD:C.npcShirtD, pants:C.npcPants, bag:true });
      // 主角:背對鏡頭,面向鮮食櫃,手上是黃標便當。他什麼都不知道
      person(430, 268, { dir:'up', skin:C.pcSkin, hair:C.pcHair, top:C.pcHood, topD:C.pcHoodD, pants:C.pcPants, hood:true, hold:true });
    }

    lighting();
  }

  root.SceneStore = { W, H, C, render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
