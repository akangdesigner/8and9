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
    wall:std({map:T.wall,roughness:.96}),
    wallB:std({map:T.wall,color:0xc8bfa8,roughness:.96}),
    wallC:std({map:T.wall,color:0xa89e88,roughness:.96}),
    shutter:std({map:T.shutter,roughness:.65,metalness:.35}),
    red:std({map:T.red,roughness:.85}), redD:std({map:T.red,color:0xb0b0b0,roughness:.85}),
    gold:std({color:0xd8a63c,roughness:.36,metalness:.75,emissive:0x3a2a08,emissiveIntensity:.6}),
    roof:std({color:0x6d3a26,roughness:.85}), curb:std({color:0x8a857a,roughness:.9}),
    pillar:std({map:T.wall,color:0xd0c8b6,roughness:.9}),
    glassOff:std({color:0x1c2731,roughness:.28,metalness:.45}),
    glassLit:std({color:0xe4ead8,emissive:0xf4f6e8,emissiveIntensity:1.1,roughness:.35}),
    metal:std({color:0x3a3f46,roughness:.5,metalness:.6}),
    seat:std({color:0x22262b,roughness:.8}),
    tarp:std({color:0xc03a2c,roughness:.9}), tarpB:std({color:0x2f6fa8,roughness:.9}),
    plastic:std({color:0xc0473a,roughness:.75}),
    tin:std({color:0x6a6f6a,roughness:.7,metalness:.4})
  };

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
      add(box(w,h,d, [M.wall,M.wallB,M.wallC][i%3]), X, h/2, Z);
      solid(X, Z, w/2, d/2);

      const fX = axis==='x' ? X : X + face*(DEPTH/2);
      const fZ = axis==='x' ? Z + face*(DEPTH/2) : Z;
      const faceW = axis==='x' ? alongW-2.6 : .3;
      const faceD = axis==='x' ? .3 : alongW-2.6;
      const offX = axis==='z' ? face*.2 : 0, offZ = axis==='x' ? face*.2 : 0;

      if(s.kind === 'shutter'){
        add(box(faceW,4.4,faceD, M.shutter), fX-offX, 2.3, fZ-offZ, false, true);
      } else {
        const lit = s.kind === 'store';
        add(box(faceW,4.2,faceD, lit?M.glassLit:M.glassOff), fX-offX, 2.3, fZ-offZ, false, true);
        if(lit || s.kind==='tattoo' || s.kind==='arcade')
          lampSpots.push({ x:fX + (axis==='z'?face*2.6:0), y:3.2, z:fZ + (axis==='x'?face*2.6:0),
                           c: lit?0xf6f7ec:(s.sign||0x88aacc), i: lit?30:18, r: lit?28:20 });
      }
      /* 招牌掛在騎樓外緣,不然會被騎樓頂整個擋掉 */
      if(s.sign){
        const sw = axis==='x' ? alongW-2 : .45, sd = axis==='x' ? .45 : alongW-2;
        add(box(sw,2.2,sd, glow(s.sign,1.35)),
            fX + (axis==='z'?face*3.9:0), 8.6, fZ + (axis==='x'?face*3.9:0), false, false);
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
    });
  }

  const S = {
    sh:{kind:'shutter'}, gap:{kind:'gap'},
    food:c=>({kind:'food',sign:c||0xd94a35}), betel:()=>({kind:'betel',sign:0x5ce08a}),
    net:()=>({kind:'net',sign:0x4fc8f0}), arcade:()=>({kind:'arcade',sign:0xff4fa0}),
    moto:()=>({kind:'moto',sign:0x3f8fd8}), drug:()=>({kind:'drug',sign:0x35b06a})
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

  /* 機車 */
  function motorbike(x, z, rot){
    const g = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.TorusGeometry(.45,.14,8,16), M.metal);
    w1.rotation.y = Math.PI/2; w1.position.set(0,.45,-.75); g.add(w1);
    const w2 = w1.clone(); w2.position.z = .75; g.add(w2);
    const part = (w,h,d,m,px,py,pz) => { const b = box(w,h,d,m); b.position.set(px,py,pz); g.add(b); };
    part(.52,.55,1.8, M.seat, 0,.88,0);   part(.58,.3,.95, M.seat, 0,1.24,-.32);
    part(.48,.95,.38, M.metal,0,1.22,.82); part(1.15,.13,.13, M.metal,0,1.65,.76);
    g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x,0,z); g.rotation.y = rot||0; scene.add(g);
    solid(x, z, .85, 1.05);
  }
  H_ROADS.forEach(r => {
    for(let i=0;i<16;i++) motorbike(-84+i*11, r.z-ROAD_HW-1.6, Math.PI/2+(i%2)*.12);
    for(let i=0;i<14;i++) motorbike(-78+i*12, r.z+ROAD_HW+1.6, -Math.PI/2+(i%2)*.1);
  });
  for(let i=0;i<8;i++) motorbike(-40+i*5.6, -84, (i%2)*.2);

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

/* ---------------- 角色(方塊人,之後換模型) ---------------- */
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
  put(box(.86,1.12,.5,M.hood), 0,1.42,0);
  put(box(.6,.58,.58,M.skin),  0,2.28,0);
  put(box(.66,.2,.64,M.hair),  0,2.55,0);
  put(box(.9,.34,.34,M.hood),  0,2.16,-.34);
  const armL = put(box(.24,1,.26,M.hood), -.56,1.44,0);
  const armR = put(box(.24,1,.26,M.hood),  .56,1.44,0);
  const legL = put(box(.3,.92,.32,M.pants), -.22,.5,0);
  const legR = put(box(.3,.92,.32,M.pants),  .22,.5,0);
  const shoeL = put(box(.32,.18,.5,M.shoe), -.22,.09,.06);
  const shoeR = put(box(.32,.18,.5,M.shoe),  .22,.09,.06);
  g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);

  let phase = 0;
  function animate(dt, moving, run){
    if(moving){
      phase += dt*.012*run;
      const sw = Math.sin(phase)*.5;
      legL.rotation.x = sw;  legR.rotation.x = -sw;
      shoeL.rotation.x = sw; shoeR.rotation.x = -sw;
      armL.rotation.x = -sw*.7; armR.rotation.x = sw*.7;
      shoeL.position.z = .06 + sw*.28; shoeR.position.z = .06 - sw*.28;
    } else {
      phase = 0;
      [legL,legR,shoeL,shoeR,armL,armR].forEach(m => m.rotation.x *= .82);
      shoeL.position.z = shoeR.position.z = .06;
    }
  }
  return { group:g, animate };
}
