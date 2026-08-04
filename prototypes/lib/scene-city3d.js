/* no-way-up — 3D 街區(街道網格 ＋ 廟埕)
 *
 * 純場景建構,不碰 DOM、不碰遊戲狀態。給兩個地方用:
 *   - prototypes/street3d.html  → 單獨看街景
 *   - prototypes/game.html      → 街上走 ⇄ 進門切 2D 室內
 *
 * 視角決定見 DESIGN_NOTES「2026-08-04 第三次翻案」:
 * 街道 3D(要空間),室內留 2D 平視(要臉)。
 */

/* ---------------- 程序生成貼圖(零外部檔案) ---------------- */
function makeTextures(THREE){
  const tex = (size, draw, rep) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const grit = (x,S,n,a) => { for(let i=0;i<n;i++){
    x.fillStyle = `rgba(0,0,0,${(Math.random()*a).toFixed(3)})`;
    x.fillRect(Math.random()*S, Math.random()*S, 1+Math.random()*3, 1+Math.random()*3); } };

  return {
    stone: tex(256,(x,S)=>{ x.fillStyle='#8d887b'; x.fillRect(0,0,S,S);
      for(let i=0;i<4;i++)for(let j=0;j<4;j++){ const v=132+Math.random()*26;
        x.fillStyle=`rgb(${v|0},${(v-5)|0},${(v-16)|0})`; x.fillRect(i*64+2,j*64+2,60,60); }
      grit(x,S,2600,.16); },[10,10]),
    walk: tex(256,(x,S)=>{ x.fillStyle='#7e7a70'; x.fillRect(0,0,S,S);
      for(let i=0;i<8;i++)for(let j=0;j<8;j++){ const v=140+Math.random()*18;
        x.fillStyle=`rgb(${v|0},${(v-4)|0},${(v-12)|0})`; x.fillRect(i*32+1.5,j*32+1.5,29,29); }
      grit(x,S,2000,.14); },[6,6]),
    road: tex(256,(x,S)=>{ x.fillStyle='#3c4046'; x.fillRect(0,0,S,S);
      for(let i=0;i<5000;i++){ const v=40+Math.random()*40;
        x.fillStyle=`rgba(${v|0},${(v+2)|0},${(v+6)|0},.6)`; x.fillRect(Math.random()*S,Math.random()*S,2,2); }
      x.fillStyle='rgba(0,0,0,.22)';
      for(let i=0;i<12;i++) x.fillRect(Math.random()*S,Math.random()*S,20+Math.random()*40,3); },[8,8]),
    wall: tex(256,(x,S)=>{ x.fillStyle='#8a8272'; x.fillRect(0,0,S,S);
      for(let j=0;j<16;j++)for(let i=0;i<8;i++){ const v=158+Math.random()*22;
        x.fillStyle=`rgb(${v|0},${(v-8)|0},${(v-26)|0})`; x.fillRect(i*32+1,j*16+1,30,14); }
      x.fillStyle='rgba(60,52,40,.20)';
      for(let i=0;i<7;i++) x.fillRect(Math.random()*S,Math.random()*S,6+Math.random()*22,30+Math.random()*60);
      grit(x,S,1400,.12); },[2,2]),
    shutter: tex(128,(x,S)=>{ x.fillStyle='#6b716d'; x.fillRect(0,0,S,S);
      for(let j=0;j<S;j+=8){ x.fillStyle='#7f857f'; x.fillRect(0,j,S,5);
        x.fillStyle='#5a605c'; x.fillRect(0,j+5,S,3); } grit(x,S,700,.2); },[3,2]),
    red: tex(128,(x,S)=>{ x.fillStyle='#8e281f'; x.fillRect(0,0,S,S);
      for(let i=0;i<900;i++){ const v=Math.random()*40;
        x.fillStyle=`rgba(${(150+v)|0},${(44+v/2)|0},${(34+v/2)|0},.5)`;
        x.fillRect(Math.random()*S,Math.random()*S,3,3); } },[2,2])
  };
}

/* ---------------- 招牌 ----------------
 * 暗底 ＋ 亮字,map 跟 emissiveMap 用同一張,所以夜裡發光的只有字,底板是暗的。
 * 整塊一起發光看起來像燈箱廣告,台灣街上的招牌是字在亮。 */
function signMaterial(THREE, text, hex, axis, face){
  const W = 512, H = 144;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const r = (hex>>16)&255, g = (hex>>8)&255, b = hex&255;
  const mix = k => `rgb(${(r+(255-r)*k)|0},${(g+(255-g)*k)|0},${(b+(255-b)*k)|0})`;

  x.fillStyle = `rgb(${r*.18|0},${g*.18|0},${b*.18|0})`; x.fillRect(0,0,W,H);
  x.strokeStyle = mix(.1); x.lineWidth = 7; x.strokeRect(4,4,W-8,H-8);
  const font = s => `bold ${s}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
  let fs = 112; x.font = font(fs);
  while(x.measureText(text).width > W-60 && fs > 40){ fs -= 4; x.font = font(fs); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = mix(.5);
  x.fillText(text, W/2, H/2 + 4);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const lit = new THREE.MeshStandardMaterial({
    map:t, emissive:0xffffff, emissiveMap:t, emissiveIntensity:1.5, roughness:.6 });
  const back = new THREE.MeshStandardMaterial({ color:0x2a2e34, roughness:.85 });

  /* BoxGeometry 的面順序:[+x, -x, +y, -y, +z, -z]。只有朝街心那面印字。 */
  const idx = axis === 'x' ? (face > 0 ? 4 : 5) : (face > 0 ? 0 : 1);
  return Array.from({length:6}, (_, i) => i === idx ? lit : back);
}

/* ---------------- 街區尺寸(遊戲端也會用到) ---------------- */
export const CITY = {
  ROAD_HW: 9, WALK_W: 7, UNIT: 12, DEPTH: 11,
  H_ROADS: [ { z:-78, name:'廟口路' }, { z:0, name:'中華路' }, { z:72, name:'後火車站' } ],
  V_ROADS: [ { x:-84, name:'西園街' }, { x:84, name:'東和街' } ],
  get B_LINE(){ return this.ROAD_HW + this.WALK_W + this.DEPTH/2; },   // 21.5
  bounds: { x:[-104,104], z:[-118,92] },
  spawn: { x:0, z:-11.5 }                                             // 中華路北側人行道
};

/* ---------------- 建整個街區 ---------------- */
export function buildCity(THREE, scene){
  const T = makeTextures(THREE);
  const { ROAD_HW, WALK_W, UNIT, DEPTH, H_ROADS, V_ROADS, B_LINE } = CITY;

  const std = o => new THREE.MeshStandardMaterial(o);
  const glow = (c,i) => std({ color:c, emissive:c, emissiveIntensity:i||1.6, roughness:.5 });
  const M = {
    stone:std({map:T.stone,roughness:.95}), walk:std({map:T.walk,roughness:.94}),
    road:std({map:T.road,roughness:.8,metalness:.06}),
    /* 四種牆色。台灣街屋是一戶一戶自己貼的,隔壁跟你不會同一批磁磚——
       換成真實照片之後這個色差要拉更開,不然整條街糊成同一個顏色。 */
    wall:std({map:T.wall,color:0xe8e2d4,roughness:.96}),
    wallB:std({map:T.wall,color:0xd8c49a,roughness:.96}),
    wallC:std({map:T.wall,color:0x9aa2a6,roughness:.96}),
    wallD:std({map:T.wall,color:0xb08a76,roughness:.96}),
    shutter:std({map:T.shutter,roughness:.65,metalness:.35}),
    red:std({map:T.red,roughness:.85}), redD:std({map:T.red,color:0xb0b0b0,roughness:.85}),
    gold:std({color:0xd8a63c,roughness:.36,metalness:.75,emissive:0x3a2a08,emissiveIntensity:.6}),
    roof:std({color:0x6d3a26,roughness:.85}), curb:std({color:0x8a857a,roughness:.9}),
    pillar:std({map:T.wall,color:0xd0c8b6,roughness:.9}),
    glassOff:std({color:0x1c2731,roughness:.28,metalness:.45}),
    glassLit:std({color:0xe4ead8,emissive:0xf4f6e8,emissiveIntensity:1.1,roughness:.35}),
    metal:std({color:0x3a3f46,roughness:.5,metalness:.6}),
    tarp:std({color:0xc03a2c,roughness:.9}), tarpB:std({color:0x2f6fa8,roughness:.9}),
    plastic:std({color:0xc0473a,roughness:.75}),
    tin:std({color:0x6a6f6a,roughness:.7,metalness:.4})
  };

  /* ---- 外部貼圖 ----
   * assets/tex/ 底下有對應的 png 就換上去,沒有就維持上面那張程序生成的。
   * 缺檔案不會壞,只是質感回到灰模,所以可以一張一張補。
   * 尺寸不限,但要能上下左右接起來(tileable),不然牆上會看到接縫。 */
  const TEX_DIR = new URL('../../assets/tex/', import.meta.url).href;

  /* 地面那種一張圖鋪幾十公尺的,AI 生的圖不會真的無縫,直接平鋪會出現一條一條接縫,
     所以鏡像成 2×2 讓它自己接起來(代價是有對稱感)。
     牆跟鐵捲門是一個面貼一整張,根本不重複,鏡像反而多一份對稱,不要做。
     lift = 疊一層半透明白:AI 給的髒污圖通常偏暗偏高對比,場景燈一打會整條街糊成一團。 */
  const prep = (img, opt) => {
    const W = img.width, H = img.height, m = opt.mirror ? 2 : 1;
    const c = document.createElement('canvas'); c.width = W*m; c.height = H*m;
    const x = c.getContext('2d');
    if(opt.mirror){
      [[1,1,0,0], [-1,1,-W*2,0], [1,-1,0,-H*2], [-1,-1,-W*2,-H*2]].forEach(([sx,sy,dx,dy]) => {
        x.save(); x.scale(sx,sy); x.drawImage(img, dx, dy, W, H); x.restore();
      });
    } else x.drawImage(img, 0, 0);
    if(opt.lift){ x.fillStyle = `rgba(255,255,255,${opt.lift})`; x.fillRect(0,0,W*m,H*m); }
    return c;
  };

  const loader = new THREE.ImageLoader();
  /* tint 只在真的載到圖的時候才套:AI 給的是白天平光的照片,直接丟進夜景會太亮
     (柏油會變水泥路)。程序生成的那張本來就調過了,不能再乘一次。 */
  [ { mats:[M.wall, M.wallB, M.wallC, M.wallD], file:'wall.png', rep:[1,1], lift:.16 },
    { mats:[M.shutter], file:'shutter.png', rep:[1,1], tint:0xa8b0ac },
    { mats:[M.road],  file:'road.png',  rep:[5,5], mirror:true, tint:0x6a7178 },
    { mats:[M.walk],  file:'walk.png',  rep:[3,3], mirror:true, tint:0xc2beb4 },
    { mats:[M.stone], file:'stone.png', rep:[5,5], mirror:true, tint:0xcfcabc }
  ].forEach(o => {
    loader.load(TEX_DIR + o.file, img => {
      const t = new THREE.CanvasTexture(prep(img, o));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.rep[0], o.rep[1]);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      o.mats.forEach(m => { m.map = t; if(o.tint) m.color.setHex(o.tint); m.needsUpdate = true; });
    }, undefined, () => {});                 // 沒這張圖就算了,不要吵
  });

  /* ===== 店家門面 =====
   * assets/tex/shop-<kind>.png,一種店一張(所有檳榔攤長一樣,要變體之後再加)。
   * emissiveMap 用同一張:店內的燈自己會亮,不然騎樓底下什麼都看不見。
   * 圖的長寬比跟門面對不上就取中間裁切,不要拉伸——AI 給的多半是 3:2,門面是 1.96:1。 */
  const FRONT_ASPECT = (UNIT - .4 - 2.6) / 4.6;
  const frontMats = {};
  function shopFront(kind){
    if(!kind || kind === 'shutter' || kind === 'gap') return null;
    if(kind in frontMats) return frontMats[kind];

    /* 還沒載到圖的時候要跟原本長得一模一樣,不能因為多了這條管線就變差 */
    const m = std(kind === 'store'
      ? { color:0xe4ead8, emissive:0xf4f6e8, emissiveIntensity:1.1, roughness:.35 }
      : { color:0x1c2731, roughness:.28, metalness:.45 });
    loader.load(TEX_DIR + `shop-${kind}.png`, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      const ia = img.width / img.height;
      if(ia > FRONT_ASPECT){ const r = FRONT_ASPECT/ia; t.repeat.set(r,1); t.offset.set((1-r)/2, 0); }
      else { const r = ia/FRONT_ASPECT; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      m.map = t; m.emissiveMap = t; m.emissive.setHex(0xffffff); m.emissiveIntensity = .55;
      m.color.setHex(0xffffff); m.roughness = .6; m.metalness = 0; m.needsUpdate = true;
    }, undefined, () => {});
    frontMats[kind] = m;
    return m;
  }

  const box = (w,h,d,m) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  const colliders = [], doors = [], lampSpots = [];
  const add = (mesh,x,y,z,cast,recv) => {
    mesh.position.set(x,y,z);
    mesh.castShadow = cast !== false; mesh.receiveShadow = recv !== false;
    scene.add(mesh); return mesh;
  };
  const solid = (x,z,hw,hd) => colliders.push({x,z,hw,hd});

  /* ===== 路面 ===== */
  H_ROADS.forEach(r => {
    add(box(210,.2,ROAD_HW*2, M.road), 0, 0, r.z, false, true);
    [-1,1].forEach(s => {
      add(box(210,.3,WALK_W, M.walk), 0, .15, r.z + s*(ROAD_HW+WALK_W/2), false, true);
      add(box(210,.34,.6, M.curb), 0, .17, r.z + s*(ROAD_HW+.3), false, true);
    });
    for(let x=-100;x<104;x+=7) add(box(3.4,.02,.2, glow(0xb8ad72,.3)), x, .11, r.z, false, true);
  });
  V_ROADS.forEach(r => {
    add(box(ROAD_HW*2,.2,172, M.road), r.x, 0, -3, false, true);
    [-1,1].forEach(s => {
      add(box(WALK_W,.3,172, M.walk), r.x + s*(ROAD_HW+WALK_W/2), .15, -3, false, true);
      add(box(.6,.34,172, M.curb), r.x + s*(ROAD_HW+.3), .17, -3, false, true);
    });
  });

  /* ===== 一排店面 ===== */
  function row(cfg){
    const { axis, at, face, from, shops } = cfg;
    shops.forEach((s, i) => {
      const p = from + i*UNIT;
      const X = axis === 'x' ? p : at;
      const Z = axis === 'x' ? at : p;
      if(s.kind === 'gap') return;                       // 留空,巷子從這裡穿過去

      const alongW = UNIT - .4;
      const w = axis==='x' ? alongW : DEPTH;
      const d = axis==='x' ? DEPTH  : alongW;
      const h = 9 + ((i*7)%3)*2.4;
      add(box(w,h,d, [M.wall,M.wallB,M.wallC,M.wallD][(i*3)%4]), X, h/2, Z);
      solid(X, Z, w/2, d/2);

      const fX = axis==='x' ? X : X + face*(DEPTH/2);
      const fZ = axis==='x' ? Z + face*(DEPTH/2) : Z;
      const faceW = axis==='x' ? alongW-2.6 : .3;
      const faceD = axis==='x' ? .3 : alongW-2.6;
      const offX = axis==='z' ? face*.2 : 0, offZ = axis==='x' ? face*.2 : 0;

      /* 門面。有 assets/tex/shop-<kind>.png 就整面貼上去,那張圖裡本來就有門、
         櫥窗、堆的東西跟透出來的光——玩家走過去真正在看的是這個,不是牆。
         沒有圖就回到原本的鐵捲門／玻璃。 */
      if(s.kind === 'shutter'){
        add(box(faceW,4.4,faceD, M.shutter), fX-offX, 2.3, fZ-offZ, false, true);
      } else {
        const lit = s.kind === 'store';
        add(box(faceW,4.6,faceD, shopFront(s.kind) || (lit?M.glassLit:M.glassOff)),
            fX-offX, 2.5, fZ-offZ, false, true);
        if(lit || s.kind==='tattoo' || s.kind==='arcade')
          lampSpots.push({ x:fX + (axis==='z'?face*2.6:0), y:3.2, z:fZ + (axis==='x'?face*2.6:0),
                           c: lit?0xf6f7ec:(s.sign||0x88aacc), i: lit?30:18, r: lit?28:20 });
      }
      /* 招牌掛在騎樓外緣,不然會被騎樓頂整個擋掉 */
      if(s.sign){
        const sw = axis==='x' ? alongW-1.2 : .45, sd = axis==='x' ? .45 : alongW-1.2;
        const txt = s.text || s.label;
        /* 高度錯開:一整排招牌切齊會像百貨公司,台灣街上是誰先掛誰佔位 */
        add(box(sw,2.7,sd, txt ? signMaterial(THREE, txt, s.sign, axis, face) : glow(s.sign,1.35)),
            fX + (axis==='z'?face*3.9:0), 8.3 + ((i*5)%3)*.62, fZ + (axis==='x'?face*3.9:0), false, false);
      }
      if(s.id) doors.push({ id:s.id, name:s.label,
        x: fX + (axis==='z'?face*2.4:0), z: fZ + (axis==='x'?face*2.4:0) });

      const aX = fX + (axis==='z'?face*3.4:0), aZ = fZ + (axis==='x'?face*3.4:0);
      const pX = axis==='x' ? X - UNIT/2 + .5 : aX;
      const pZ = axis==='x' ? aZ : Z - UNIT/2 + .5;
      add(box(.85,5.8,.85, M.pillar), pX, 2.9, pZ);
      solid(pX, pZ, .42, .42);
      add(box(axis==='x'?alongW:3.6, .4, axis==='x'?3.6:alongW, M.wallB),
          fX + (axis==='z'?face*1.9:0), 5.35, fZ + (axis==='x'?face*1.9:0));

      /* 騎樓頂下面那支日光燈。沒有它騎樓底下全黑,鐵捲門跟店門都看不見。
         全部一樣亮會像機場走廊——每七間壞一支,冷白暖白混著,才像有人在管跟沒人在管
         的店混在同一條街上。強度小、範圍小,不會搶掉招牌。 */
      const tX = fX + (axis==='z'?face*1.9:0), tZ = fZ + (axis==='x'?face*1.9:0);
      const tubeW = axis==='x' ? alongW-3.4 : .16, tubeD = axis==='x' ? .16 : alongW-3.4;
      const dead = (i*5)%7 === 3;
      const warm = (i*3)%5 < 2;
      const cLamp = warm ? 0xf2e3c0 : 0xdfe8f0;
      add(box(tubeW, .12, tubeD,
              dead ? std({color:0x555b60,roughness:.7}) : glow(cLamp, 1.05)),
          tX, 5.06, tZ, false, false);
      if(!dead) lampSpots.push({ x:tX, y:4.9, z:tZ, c:cLamp, i:warm?11:10, r:13 });
    });
  }

  /* 店名。台灣街的辨識度幾乎全在招牌那幾個字上,同類型的店輪流換名字,
     整條街才不會像同一間開了八家。 */
  const FOOD = ['魯肉飯','切仔麵','鹹酥雞','自助餐','熱炒','豆漿'];
  const BETEL = ['檳榔','阿美檳榔','雙葉檳榔'];
  let nFood = 0, nBetel = 0;
  const S = {
    sh:{kind:'shutter'}, gap:{kind:'gap'},
    food:c=>({kind:'food',sign:c||0xd94a35,text:FOOD[nFood++ % FOOD.length]}),
    betel:()=>({kind:'betel',sign:0x5ce08a,text:BETEL[nBetel++ % BETEL.length]}),
    net:()=>({kind:'net',sign:0x4fc8f0,text:'網咖'}), arcade:()=>({kind:'arcade',sign:0xff4fa0,text:'遊藝場'}),
    moto:()=>({kind:'moto',sign:0x3f8fd8,text:'機車行'}), drug:()=>({kind:'drug',sign:0x35b06a,text:'藥局'})
  };

  /* 中華路:你家、超商在這條 */
  row({ axis:'x', at:-B_LINE, face:1, from:-72, shops:[
    S.sh, {kind:'home',id:'home',label:'你家'}, S.food(), S.betel(), S.gap,
    {kind:'store',id:'store',label:'超商',sign:0xf2efe4}, S.moto(), S.drug(), S.sh,
    S.food(0xe8b52c), S.sh, S.sh, S.sh ]});
  row({ axis:'x', at:B_LINE, face:-1, from:-72, shops:[
    S.sh, S.food(), S.sh, S.net(), S.gap,
    {kind:'tattoo',id:'tattoo',label:'刺青店',sign:0xff4a5a}, S.arcade(), S.sh, S.betel(),
    S.sh, S.sh, S.food(0xe8b52c), S.sh ]});
  /* 廟口路 */
  row({ axis:'x', at:-78+B_LINE, face:-1, from:-60, shops:[
    S.sh, S.food(), S.betel(), S.gap, S.food(0xe8b52c), S.sh, S.drug(), S.sh, S.net(), S.sh ]});
  /* 後火車站:暗的那一條 */
  row({ axis:'x', at:72-B_LINE, face:1, from:-60, shops:[
    S.sh, S.sh, S.gap, S.sh, S.moto(), S.sh, S.sh, S.sh, S.sh, S.sh ]});
  /* 縱街 */
  row({ axis:'z', at:-84-B_LINE, face:1, from:-58, shops:[ S.sh,S.food(),S.sh,S.sh,S.betel(),S.sh,S.sh,S.sh ]});
  row({ axis:'z', at: 84+B_LINE, face:-1, from:-58, shops:[ S.sh,S.sh,S.net(),S.sh,S.sh,S.food(),S.sh,S.sh ]});

  /* ===== 巷子:把兩條橫街接起來,走過去就是了 ===== */
  const alleys = [];
  function alley(x, z0, z1){
    alleys.push({ x, z0, z1 });                        // 小地圖要畫,別在外面重算一次
    const HW = 3.2, len = Math.abs(z1-z0), cz = (z0+z1)/2;
    add(box(HW*2+8, .28, len, M.walk), x, .14, cz, false, true);
    [-1,1].forEach(s => {
      add(box(6, 13, len, M.wallC), x + s*(HW+3), 6.5, cz);
      solid(x + s*(HW+3), cz, 3, len/2);
    });
    for(let i=0;i<5;i++){
      const zz = z0 + (i+.5)*(z1-z0)/5;
      add(box(1.6,1.1,1.2, M.tin), x + (i%2?1:-1)*(HW-.3), 4.4+((i*3)%3), zz, true, false);
      if(i%2) add(box(1.2,1.1,1.2, std({color:0x3f444b,roughness:.9})), x - (HW-1), .6, zz);
    }
    [0, .32].forEach(f => {
      const lz = cz + (z1-z0)*f;
      add(box(1.3,.32,.9, glow(0xffe6a8,2.0)), x, 6.4, lz, false, false);
      lampSpots.push({ x, y:6.4, z:lz, c:0xffe6a8, i:26, r:30 });
    });
  }
  alley(-72 + 4*UNIT, -B_LINE - DEPTH/2, -78 + B_LINE + DEPTH/2);   // 中華路 ⇄ 廟口路
  alley(-60 + 2*UNIT,  B_LINE + DEPTH/2,  72 - B_LINE - DEPTH/2);   // 中華路 ⇄ 後火車站

  /* ===== 廟埕 ===== */
  (function temple(){
    const z = -108, W = 34;
    add(box(96,.3,22, M.stone), 0, .15, -92, false, true);
    add(box(W,12,9, M.red), 0, 6, z); solid(0, z, W/2, 4.5);
    add(box(W+4,1.3,11, M.roof), 0, 12.4, z);
    add(box(W-6,1.2,9.5, M.roof), 0, 13.6, z);
    add(box(W-16,1.1,8, M.roof), 0, 14.7, z);
    [-1,1].forEach(s => { for(let k=0;k<4;k++)
      add(box(2.2,.8,2.2, M.roof), s*(W/2+1.4-k*.5), 12.6+k*.75, z+(k-1.5)*2.6); });
    add(box(2.4,1.2,2.4, M.gold), 0, 15.5, z);
    add(box(9,2.2,.5, M.gold), 0, 9.2, z+4.7, false, false);
    [-13,-5,5,13].forEach(x => { add(box(1.7,8.5,1.7, M.redD), x, 4.25, z+5.2); solid(x, z+5.2, .85,.85); });
    [[-9,3.4],[0,4.4],[9,3.4]].forEach(([x,w]) =>
      add(box(w,6,.4, std({color:0x6e1c14,roughness:.8})), x, 3, z+4.6, false, true));
    for(let k=0;k<8;k++){
      const x = -14.5 + k*4.15;
      add(box(.16,1.1,.16, M.metal), x, 9.4, z+5.3, false, false);
      add(box(1.5,1.9,1.5, glow(0xe8442e,1.35)), x, 8, z+5.3, false, false);
    }
    lampSpots.push({ x:0, y:8, z:z+11, c:0xff8a5a, i:50, r:44 });
    const wash = new THREE.SpotLight(0xffd0a0, 90, 44, .72, .55, 1.4);
    wash.position.set(0, 7, z+24); wash.target.position.set(0, 8, z+4);
    scene.add(wash, wash.target);
    [-15.5,15.5].forEach(x => { add(box(2,1,2.6, M.curb), x, .8, z+7.4);
      add(box(1.4,1.8,1.6, M.curb), x, 2.1, z+7); solid(x, z+7.2, 1.1, 1.4); });
    doors.push({ id:'temple', name:'宮廟', x:0, z:z+10 });
    add(box(5,2.4,3.4, M.gold), 0, 1.5, z+22);
    add(box(6,.5,4.2, M.gold), 0, 2.9, z+22, false, false);
    solid(0, z+22, 2.6, 1.8);
    lampSpots.push({ x:0, y:4, z:z+22, c:0xffb066, i:24, r:22 });
    add(box(4.4,7,4.4, M.red), 24, 3.6, z+20); solid(24, z+20, 2.2, 2.2);
    add(box(5,1,5, M.roof), 24, 7.4, z+20);
  })();

  /* 攤子 + 塑膠桌椅 */
  function stall(x, z, c){
    add(box(6.4,.4,3.6, c), x, 3.5, z, true, false);
    [[-2.9,1.5],[2.9,1.5],[-2.9,-1.5],[2.9,-1.5]].forEach(([a,b]) =>
      add(box(.2,3.4,.2, M.metal), x+a, 1.7, z+b));
    add(box(5.6,1.7,2.4, M.metal), x, 1.1, z);
    add(box(5.8,.25,2.6, std({color:0xd8cdb4,roughness:.8})), x, 2.05, z, false, true);
    add(box(.5,.24,.5, glow(0xfff0cc,1.4)), x, 3.15, z, false, false);
    lampSpots.push({ x, y:3.05, z, c:0xffd79a, i:18, r:16 });
    solid(x, z, 3, 1.8);
  }
  stall(-22,-92, M.tarp); stall(-13,-92, M.tarpB); stall(20,-90, M.tarp);
  function tableSet(x, z){
    add(box(2.6,.16,2.6, M.plastic), x, 1.5, z);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b]) => add(box(.14,1.5,.14, M.plastic), x+a*1.05, .75, z+b*1.05));
    [[-2.4,0],[2.4,0],[0,2.4]].forEach(([a,b]) => {
      add(box(1.1,.12,1.1, M.plastic), x+a, .9, z+b);
      add(box(1.1,1.1,.12, M.plastic), x+a, 1.4, z+b-.5, true, false); });
    solid(x, z, 2.6, 2.6);
  }
  tableSet(-18,-86); tableSet(-9,-87); tableSet(16,-85);

  /* 機車 2026-08-04 拿掉:方塊拼出來的機車太假(kc)。相機壓低之後它們就在
     畫面正中間,一整排黑團塊,比沒有還糟。要放回來就得是真的模型或 sprite。
     舊的方塊版在 git 裡:git show cf8cb7a:prototypes/lib/scene-city3d.js */

  /* 電線杆 + 路燈 */
  H_ROADS.forEach(r => {
    for(let x=-90;x<=96;x+=32){
      add(box(.5,15,.5, M.pillar), x, 7.5, r.z-ROAD_HW-.8);
      add(box(2.8,.22,.22, M.pillar), x, 13.2, r.z-ROAD_HW-.8);
      add(box(1.2,.32,.8, glow(0xffd9a0,2.4)), x+1.5, 12, r.z-ROAD_HW+.2, false, false);
      lampSpots.push({ x:x+1.5, y:12, z:r.z-ROAD_HW+.2, c:0xffd9a0, i:40, r:46 });
    }
  });

  /* ===== 光源池 =====
     場景有 60 幾個燈點,但 forward render 一次吃不了那麼多(硬塞會拖垮甚至編不出 shader)。
     只讓離玩家最近的 12 盞真的發光,其餘靠 emissive 自己亮。 */
  const POOL = [];
  for(let i=0;i<12;i++){ const l = new THREE.PointLight(0xffffff, 0, 1, 2); scene.add(l); POOL.push(l); }
  function updateLights(px, pz){
    lampSpots.forEach(s => { const dx = s.x-px, dz = s.z-pz; s._d = dx*dx + dz*dz; });
    lampSpots.sort((a,b) => a._d - b._d);
    POOL.forEach((l,i) => {
      const s = lampSpots[i];
      if(s && s._d < 90*90){ l.position.set(s.x,s.y,s.z); l.color.setHex(s.c);
                             l.intensity = s.i; l.distance = s.r; }
      else l.intensity = 0;
    });
  }

  function whereAmI(x, z){
    for(const r of H_ROADS) if(Math.abs(z-r.z) < ROAD_HW+WALK_W+2) return r.name;
    for(const r of V_ROADS) if(Math.abs(x-r.x) < ROAD_HW+WALK_W+2) return r.name;
    if(z < -84) return '廟埕';
    return '巷子';
  }
  function blocked(x, z){
    for(const c of colliders)
      if(Math.abs(x-c.x) < c.hw+.55 && Math.abs(z-c.z) < c.hd+.55) return true;
    return false;
  }

  return { colliders, doors, alleys, lampSpots, updateLights, whereAmI, blocked, materials:M };
}

/* ---------------- 角色 ----------------
 * 還是方塊,但比例照真人抓:舊版是 3.4 頭身的樂高比例,遠看就是玩具。
 * 街上相機在 29 高、23 遠,臉根本看不到——決定像不像人的是**頭身比跟剪影**,
 * 不是面數。臉留給 2D 室內(見 DESIGN_NOTES「美術與視角」)。
 * 四肢掛在 pivot 上(髖、肩),不是繞自己中心轉,腿長了才擺得像走路。 */
/* 身高 4.0:用車道半寬(ROAD_HW=9,雙向道約 7.5 米)回推,1 單位 ≈ 0.42 米,
   4.0 單位 ≈ 1.7 米。舊的 3.2 只有 1.34 米,站在機車旁邊像國中生。 */
export const PLAYER = { height:4.0, eyeY:3.65 };

/* 相機。2026-08-04 kc 定案壓低:「29 高那張看起來像地圖」。
   高 9、距 17 是站在街上的高度,磁磚跟柏油在這個距離才看得到質感。
   再低就看不到招牌了——招牌掛在 8.3~11,相機壓到 6 的話整排會被切在畫面外。
   lookY 是看向角色的哪個高度(0=腳、1=頭頂),抬高一點才把招牌收進畫面上緣。
   fov 40 是望遠端:退遠 ＋ 縮視角,角色在畫面上反而更大,招牌也還收得進來,
   而且背景會被壓平,街看起來更像一條街,不像一個模型。 */
export const CAM = { dist:22, high:11, lookY:.78, fov:40 };

export function buildPlayer(THREE, scene){
  const M = {
    skin:new THREE.MeshStandardMaterial({color:0xc1926e,roughness:.85}),
    hair:new THREE.MeshStandardMaterial({color:0x241d19,roughness:.9}),
    hood:new THREE.MeshStandardMaterial({color:0x4a5563,roughness:.9}),
    pants:new THREE.MeshStandardMaterial({color:0x333a44,roughness:.9}),
    shoe:new THREE.MeshStandardMaterial({color:0x191c21,roughness:.9})
  };
  const box = (w,h,d,m) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  const g = new THREE.Group();
  const put = (b,x,y,z) => { b.position.set(x,y,z); g.add(b); return b; };

  put(box(.75,1.31,.43, M.hood),  0, 2.63, 0);      // 連帽外套
  put(box(.21,.20,.21, M.skin),   0, 3.33, 0);      // 脖子
  put(box(.53,.58,.55, M.skin),   0, 3.65, 0);      // 頭
  put(box(.58,.16,.59, M.hair),   0, 3.95, 0);      // 頭髮
  put(box(.70,.33,.25, M.hood),   0, 3.28, -.28);   // 兜帽垂在背後

  /* 手腳掛 pivot:髖在 1.96,肩在 3.23 */
  const limb = (x, y, w, h, d, m, zOff) => {
    const p = new THREE.Group(); p.position.set(x, y, 0);
    const b = box(w, h, d, m); b.position.set(0, -h/2, zOff||0); p.add(b);
    g.add(p); return p;
  };
  const armL = limb(-.48, 3.23, .21, 1.28, .24, M.hood);
  const armR = limb( .48, 3.23, .21, 1.28, .24, M.hood);
  const legL = limb(-.19, 1.96, .29, 1.88, .31, M.pants);
  const legR = limb( .19, 1.96, .29, 1.88, .31, M.pants);
  [legL, legR].forEach(p => {
    const s = box(.33,.20,.53, M.shoe); s.position.set(0,-1.78,.09); p.add(s);
  });

  g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);

  let phase = 0;
  function animate(dt, moving, run){
    if(moving){
      phase += dt*.0082*run;                        // 腿長了,步頻要慢一點才不像小碎步
      const sw = Math.sin(phase)*.52;
      legL.rotation.x = sw;      legR.rotation.x = -sw;
      armL.rotation.x = -sw*.75; armR.rotation.x = sw*.75;
    } else {
      phase = 0;
      [legL,legR,armL,armR].forEach(p => p.rotation.x *= .82);
    }
  }
  return { group:g, animate, eyeY:PLAYER.eyeY, height:PLAYER.height };
}
