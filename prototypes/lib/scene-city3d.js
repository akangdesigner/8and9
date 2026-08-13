/* no-way-up — 3D 街區(街道網格 ＋ 廟埕)
 *
 * 純場景建構,不碰 DOM、不碰遊戲狀態。給兩個地方用:
 *   - prototypes/street3d.html  → 單獨看街景
 *   - prototypes/game.html      → 街上走 ⇄ 進門切 2D 室內
 *
 * 視角決定見 DESIGN_NOTES「2026-08-04 第三次翻案」:
 * 街道 3D(要空間),室內留 2D 平視(要臉)。
 *
 * 這個檔案本身不 import THREE(由呼叫端注入,見 buildCity/buildPlayer 簽名),
 * 但兩邊 host html 的 importmap 都有 three/addons/,所以角色用的
 * RoundedBoxGeometry 可以在這裡直接 import,不用跟著往外傳一層參數。
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const TEX_DIR = new URL('../../assets/tex/', import.meta.url).href;
const MODEL_DIR = new URL('../../assets/models/', import.meta.url).href;

/* ---------------- 外部貼圖共用工具 ----------------
 * assets/tex/ 底下有對應的 png 就換上去,沒有就維持程序生成的灰模,不會壞。
 * 地面/牆/布料這種一張圖要鋪很多次的,AI 生的圖不會真的無縫,直接平鋪會有接縫,
 * 所以鏡像成 2×2 讓它自己接起來(代價是有對稱感)。lift = 疊一層半透明白,
 * AI 給的髒污圖通常偏暗偏高對比,場景燈一打會糊成一團。
 * buildCity 跟 buildPlayer 共用同一份,見 DESIGN_NOTES「美術管線」。 */
function prep(img, opt){
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
}

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

/* 招牌背板／鐵框共用同一份材質(所有招牌長一樣的鐵框很合理,不用一個一個生)。
 * assets/tex/sign-frame.png 補了就會自動換上去,沒補維持深灰灰模。 */
let _signFrameMat = null;
function frameMaterial(THREE){
  if(_signFrameMat) return _signFrameMat;
  _signFrameMat = new THREE.MeshStandardMaterial({ color:0x2a2e34, roughness:.88, metalness:.25 });
  new THREE.ImageLoader().load(TEX_DIR + 'sign-frame.png', img => {
    const t = new THREE.CanvasTexture(prep(img, { mirror:true, lift:.06 }));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    _signFrameMat.map = t; _signFrameMat.color.setHex(0x8f9298); _signFrameMat.needsUpdate = true;
  }, undefined, () => {});
  return _signFrameMat;
}

/* ---------------- 街區尺寸(遊戲端也會用到) ---------------- */
/* ---------------- 店口地面髒污(假接觸陰影) ----------------
 * 真的 AO/SSAO 要動整個 render pipeline,先用一張貼在地上的髒污貼圖騙過去——
 * 店門口比人行道其他地方黑一點、油一點,順便兼差當「東西接地」的暗角。 */
let _grimeTex = null;
function grimeTexture(THREE){
  if(_grimeTex) return _grimeTex;
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S/2,S*.62,4, S/2,S*.62,S*.55);
  g.addColorStop(0,'rgba(0,0,0,.55)'); g.addColorStop(.5,'rgba(0,0,0,.28)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0,0,S,S);
  for(let i=0;i<10;i++){                        // 拖出去的油痕/腳踩痕,不要整片圓形太乾淨
    x.strokeStyle = `rgba(0,0,0,${(.08+Math.random()*.12).toFixed(3)})`;
    x.lineWidth = 6+Math.random()*14;
    const sx = S*(.3+Math.random()*.4), sy = S*.55;
    x.beginPath(); x.moveTo(sx,sy);
    x.lineTo(sx+(Math.random()-.5)*40, sy+40+Math.random()*90);
    x.stroke();
  }
  _grimeTex = new THREE.CanvasTexture(c);
  _grimeTex.colorSpace = THREE.SRGBColorSpace;
  return _grimeTex;
}

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
    tin:std({color:0x6a6f6a,roughness:.7,metalness:.4}),
    /* 店面凹進去的洞:側面看到的材質,故意深色,靠方向光自己暗下去做出深度,
       不用另外做假陰影的面板。 */
    recess:std({color:0x121417,roughness:.97}),
    threshold:std({color:0x24211c,roughness:.92}),
    glass:std({color:0xdbe6ea,transparent:true,opacity:.09,roughness:.12,metalness:.1,depthWrite:false}),
    /* 店面箱體側面(跟招牌箱體側面共用):暗灰鋁框感,吃一點反光就好,
       不要用高 metalness——場景沒 envMap,金屬感全靠環境反射,沒反射源
       的話高 metalness 會整塊黑掉。之前門面箱體側面直接沿用照片材質貼滿六面,
       薄的那圈側面被拉伸的照片(常常是店內天花板的白光)糊成一圈發光邊框,
       看起來像另一種假——側面要單獨換成這個。 */
    alumFrame:std({color:0x33363c,roughness:.42,metalness:.35})
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

  /* ===== 招牌 =====
   * assets/tex/sign-<key>.png,一個招牌文字一張(店名是固定的幾個輪替,不是無限
   * 隨機,生得完)。沒圖之前維持深色底,不再用程式畫字——那個是「像 UI」的來源。
   * 招牌箱體三種尺寸輪替(見 row() 裡的 style),同一張圖要適應三種長寬比,
   * 裁切邏輯跟 shopFront 一樣。 */
  const signCache = {};
  function signImage(key, aspect, emissiveK){
    emissiveK = emissiveK || 1;
    const ck = `${key}|${aspect.toFixed(2)}|${emissiveK}`;
    if(ck in signCache) return signCache[ck];
    const m = std({ color:0x111318, roughness:.6 });
    signCache[ck] = m;
    loader.load(TEX_DIR + `sign-${key}.png`, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      const ia = img.width / img.height;
      if(ia > aspect){ const r = aspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2,0); }
      else { const r = ia/aspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      /* emissiveK:三間特別點名的店亮法不一樣——超商偏過曝、機車行舊招牌整體偏暗、
         藥局比較新所以正常偏亮,不能全部套同一個發光強度。 */
      m.map = t; m.emissiveMap = t; m.emissive.setHex(0xffffff); m.emissiveIntensity = 1.0*emissiveK;
      m.color.setHex(0xffffff); m.roughness = .55; m.needsUpdate = true;
    }, undefined, () => {});
    return m;
  }

  /* ===== 樓上的立面 =====
   * assets/tex/facade-N.png:騎樓頂以上那幾層——鐵窗、冷氣主機、曬的衣服、水管、
   * 加蓋的鐵皮。這是台灣街景資訊量最大的一塊,現在整片是空白磁磚。
   * 只貼朝街那一面,而且是獨立一塊薄板貼在建築正面外側,不動建築本體。
   * 一樓不畫在這張裡:騎樓頂會把它整個擋掉。 */
  /* 只列已經有的檔案。列了還沒生的那幾張的話,四分之三的樓會是空白磁磚,
     跟有貼圖的那幾棟擺在一起太突兀——寧可先全部同一張。 */
  const FACADES = ['facade-1.png', 'facade-2.png'];
  const facadeCache = {};
  function facadeMat(file, aspect, base){
    const key = `${file}|${aspect.toFixed(2)}|${base.color.getHex()}`;
    if(key in facadeCache) return facadeCache[key];
    const m = base.clone();                              // 還沒載到圖就維持磁磚
    facadeCache[key] = m;
    loader.load(TEX_DIR + file, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      const ia = img.width / img.height;
      if(ia > aspect){ const r = aspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2, 0); }
      else { const r = ia/aspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      m.map = t; m.emissiveMap = t; m.emissive.setHex(0xffffff); m.emissiveIntensity = .22;
      m.color.setHex(0xffffff); m.needsUpdate = true;    // 窗戶裡的燈自己微微亮
    }, undefined, () => {});
    return m;
  }

  const box = (w,h,d,m) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  const colliders = [], doors = [], lampSpots = [], play = [];
  let parkBounds = null;                              // 見下面 park(),whereAmI() 要用
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
      /* 廟口路南側(s=-1)正對廟埕那段不放 curb——見下面 temple() 的石板直接
         跟路面接起來,不要有一條硬邊切過廣場(2026-08-13,kc 覺得路網太方正)。 */
      if(r.z === H_ROADS[0].z && s === -1){
        [[-105,-52.5],[52.5,105]].forEach(([x0,x1]) =>
          add(box(x1-x0,.34,.6, M.curb), (x0+x1)/2, .17, r.z + s*(ROAD_HW+.3), false, true));
      } else {
        add(box(210,.34,.6, M.curb), 0, .17, r.z + s*(ROAD_HW+.3), false, true);
      }
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

  /* ===== 樹:圓環跟公園都要用,抽成共用函式(2026-08-13)=====
   * 樹冠先用幾顆多面體堆出灰模輪廓,assets/tex/tree-crown-<variant>.png(1~4,
   * kc 一次生了 4 種變化,見 PROMPTS.md)補了會自動換成兩片十字交叉的去背
   * 照片(常見的「樹卡片」省事作法,不用真的建樹葉幾何)。灰模留著當
   * fallback,不是換掉,沒圖之前不會空著。variant 不同的呼叫用不同編號,
   * 免得整條路每棵樹長得一模一樣。 */
  function buildTree(cx, cz, scale, variant){
    scale = scale || 1; variant = variant || 1;
    add(new THREE.Mesh(new THREE.CylinderGeometry(.32*scale,.48*scale,3.2*scale,8),
        std({ color:0x4a3626, roughness:.95 })), cx, 1.9*scale+.32*scale, cz, true, true);
    const leaves = [[0,3.9,0,2.5],[1.3,3.4,.9,1.6],[-1.2,3.6,-.8,1.7],[.5,4.6,-1.0,1.5]]
      .map(([x,y,z,r]) => add(new THREE.Mesh(new THREE.IcosahedronGeometry(r*scale,0),
        std({ color:0x3c5a2e, roughness:.95 })), cx+x*scale, (y+.32)*scale, cz+z*scale, true, false));
    loader.load(TEX_DIR + `tree-crown-${variant}.png`, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      const cm = new THREE.MeshStandardMaterial({ map:t, transparent:true, alphaTest:.5, side:THREE.DoubleSide, roughness:.9 });
      [0, Math.PI/2].forEach(ry => {
        const card = new THREE.Mesh(new THREE.PlaneGeometry(5.4*scale,5.4*scale), cm);
        card.rotation.y = ry;
        add(card, cx, 4.2*scale, cz, false, false);
      });
      leaves.forEach(m => m.visible = false);
    }, undefined, () => {});
  }

  /* ===== 街道小物:立牌卡片(2026-08-13)=====
   * 電箱/消防栓/盆栽這種東西照片是 3/4 角度拍的,不是店面招牌那種平拍,
   * 沒辦法好好包進盒子幾何的六個面——跟樹冠同一招,做成一片立起來的卡片,
   * 這個遊戲的鏡頭角度變化不大,讀起來就是一個東西站在那裡。沒圖之前退回
   * 一塊素色方塊,不會空著。 */
  const propMats = {};
  function propCard(name, colorFallback){
    if(propMats[name]) return propMats[name];
    const m = std({ color:colorFallback, roughness:.85, transparent:true, alphaTest:.5, side:THREE.DoubleSide });
    propMats[name] = m;
    loader.load(TEX_DIR + `prop-${name}.png`, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      m.map = t; m.color.setHex(0xffffff); m.needsUpdate = true;
    }, undefined, () => {});
    return m;
  }
  function addProp(name, cx, cz, w, h, colorFallback, ry){
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w,h), propCard(name, colorFallback));
    card.rotation.y = ry || 0;
    add(card, cx, h/2, cz, false, false);
    solid(cx, cz, w*.3, w*.3);
  }

  /* ===== 真的灌木叢(2026-08-13,kc 說多面體灰模不是真灌木叢,要真的)=====
   * 跟樹冠同一招(十字交叉去背照片卡片),用 tree-crown-4.png——kc 那批
   * 4 選 1 的樹冠組合圖裡,那張本來就是矮圓形灌木,不是高大的樹,拿來當
   * 灌木叢用剛好合適,不用另外再生一張。bushLine() 沿一條線密集排一串、
   * 大小跟位置都帶點隨機,湊出圍籬那種「長了一排叢」的感覺,不是等距排列
   * 的裝飾品。 */
  const bushMat = std({ color:0x2f4a26, roughness:.9, transparent:true, alphaTest:.5, side:THREE.DoubleSide });
  loader.load(TEX_DIR + 'tree-crown-4.png', img => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    bushMat.map = t; bushMat.color.setHex(0xffffff); bushMat.needsUpdate = true;
  }, undefined, () => {});
  function buildBush(cx, cz, scale){
    const size = 2.1*scale;
    [0, Math.PI/2].forEach(ry => {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(size,size), bushMat);
      card.rotation.y = ry;
      add(card, cx, size*.26, cz, false, false);
    });
  }
  function bushLine(ax, az, bx, bz){
    const dx = bx-ax, dz = bz-az, len = Math.hypot(dx,dz);
    const steps = Math.max(1, Math.round(len/1.15));
    for(let i=0; i<=steps; i++){
      const t = steps ? i/steps : .5;
      buildBush(ax+dx*t+(Math.random()-.5)*.3, az+dz*t+(Math.random()-.5)*.3, .55+Math.random()*.35);
    }
  }

  /* ===== 路口圓環(西園街 ⇄ 中華路)=====
   * kc 覺得整個路網太方正(2026-08-13)——不動路軸線,只在既有十字路口疊一個
   * 圓環,周邊店面/alley 完全不用重算。中間放一棵樹,呼應老市區路口常見的
   * 圓環/路樹景觀,人行道被切成繞過去的弧線而不是直角轉彎。 */
  (function roundabout(){
    const cx = V_ROADS[0].x, cz = H_ROADS[1].z, R = 5.0;
    add(new THREE.Mesh(new THREE.CylinderGeometry(R+.3,R+.3,.17,28), M.curb),
        cx, .085, cz, false, true);
    add(new THREE.Mesh(new THREE.CylinderGeometry(R,R,.3,28),
        std({ color:0x5a6b42, roughness:.96 })), cx, .17+.15, cz, false, true);
    buildTree(cx, cz, 1, 1);
    solid(cx, cz, R*.72, R*.72);
    lampSpots.push({ x:cx, y:4.5, z:cz, c:0xffd9a0, i:26, r:24 });
  })();

  /* ===== 公園:中華路南側切兩個店面寬度出來(2026-08-13,kc 說要真的一塊
   * 公園,不是隨便貼一張素材)=====
   * 跟 temple()/roundabout() 同一套做法——先蓋灰模鎖構圖,草地材質有補圖片
   * 就換,沒有就維持程序生成的綠色;圍籬留一個朝中華路的開口當入口,鞦韆/
   * 長椅用現有的 box helper 湊,不找外部 3D 模型——這整個城市除了角色都是
   * 「灰模 + AI 貼圖」這一套,公園沒有理由換一套做法,換了風格會跟旁邊的店
   * 打起來(見 DESIGN_NOTES「美術管線」)。占掉的兩個店面格數在 row() 那邊
   * 已經改成 S.gap,這裡只補公園本體。 */
  (function park(){
    const x0 = 42, x1 = 66, z0 = -B_LINE-DEPTH/2, z1 = -B_LINE+DEPTH/2;
    const cx = (x0+x1)/2, cz = (z0+z1)/2, gateW = 4;

    /* kc 說我上一版誤解了問題:不是矩形邊緣「貼幾塊裝飾」就好,是這塊地
       打從輪廓就不應該是一個剛好的矩形/正方形(2026-08-13,第二次修正)。
       改成 L 形:東南角整個切掉一塊(缺角),草地跟圍籬都照這個新輪廓走,
       不是先蓋矩形再補丁。缺角大小 NOTCH,切在離入口最遠的那個角落,
       不影響北側入口跟長椅/鞦韆的既有座標(它們都在缺角範圍外)。 */
    const NOTCH = 5;                                    // 缺角邊長
    const cutX = x1 - NOTCH, cutZ = z0 + NOTCH;          // 缺角的內角座標
    const grassMat = std({ color:0x5c7a3e, roughness:.95 });
    add(box(cutX-x0-.6, .12, z1-z0-.6, grassMat), (x0+cutX)/2, .06, cz, false, true);           // 主體(西側全深)
    add(box(x1-cutX-.6, .12, z1-cutZ-.6, grassMat), (cutX+x1)/2, .06, (cutZ+z1)/2, false, true); // 東側上半(缺角剩下的部分)
    loader.load(TEX_DIR + 'grass.png', img => {
      const t = new THREE.CanvasTexture(prep(img, { mirror:true, lift:.1 }));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3,2);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      grassMat.map = t; grassMat.color.setHex(0x9fb583); grassMat.needsUpdate = true;
    }, undefined, () => {});

    /* 矮圍籬:北側(朝路,z1)留 gateW 寬的入口,照 L 形輪廓走六段,不是
       四段矩形。缺角內側兩段(往內切的那個直角)也要圍起來,不然草地跟
       圍籬外的柏油路會直接連在一起。
       2026-08-13 kc 第三次抓到:貼了 hedge.png 之後看起來還是太平整——一塊
       平的箱體貼一張灌木葉子的無縫材質,終究是「一塊有紋路的箱體」,不是
       真的凹凸不平的灌木。箱體降矮當隱形的碰撞底座(矮到幾乎被前面的灌木
       卡片蓋住),真正看得到的外觀改成沿線密集排一排 buildBush() 的去背
       灌木照片卡——跟上面「真的灌木叢」那段同一套,碰撞判定不變。 */
    const hedge = std({ color:0x2a3a22, roughness:.95 });
    const hedgeSeg = (w,d,x,z) => { add(box(w,.4,d, hedge), x, .2, z, false, true); solid(x,z,w/2,d/2); };
    hedgeSeg(cutX-x0, .4, (x0+cutX)/2, z0);                        // 南邊(到缺角前)
    hedgeSeg(.4, cutZ-z0, cutX, (z0+cutZ)/2);                       // 缺角內側:縱段
    hedgeSeg(x1-cutX, .4, (cutX+x1)/2, cutZ);                       // 缺角內側:橫段
    hedgeSeg(.4, z1-cutZ, x1, (cutZ+z1)/2);                         // 東邊(缺角之後到入口)
    hedgeSeg(.4, z1-z0, x0, cz);                                    // 西邊
    const sideW = (x1-x0-gateW)/2;                                  // 北邊剩下的寬度,左右各一段
    hedgeSeg(sideW, .4, x0+sideW/2, z1);                            // 入口左半
    hedgeSeg(sideW, .4, x1-sideW/2, z1);                            // 入口右半

    bushLine(x0, z0, cutX, z0);                                     // 南邊
    bushLine(cutX, z0, cutX, cutZ);                                 // 缺角內側:縱段
    bushLine(cutX, cutZ, x1, cutZ);                                 // 缺角內側:橫段
    bushLine(x1, cutZ, x1, z1);                                     // 東邊
    bushLine(x0, z0, x0, z1);                                       // 西邊
    bushLine(x0, z1, x0+sideW, z1);                                 // 入口左半
    bushLine(x1-sideW, z1, x1, z1);                                 // 入口右半

    /* 長椅 x2,跟 tableSet() 的塑膠桌椅同一種灰模語彙,換成木頭色。
       2026-08-13 kc 說公園比例好怪——上一版座面是 .5 厚的方塊、座高只有 .5,
       跟角色一比像個箱子不像長椅。這個場景 1 單位 ≈ .42 米(見 PLAYER 那節
       身高換算),照現實長椅尺寸(座高 ~.45m、椅背頂 ~.85m)重新推:
       座高 1.0、椅背頂 ~2.1、座板變薄成 .14。 */
    const woodM = std({ color:0x8a6a42, roughness:.85 });
    function bench(x, z, ry){
      const g = new THREE.Group();
      const seat = box(3.0,.14,.8, woodM); seat.position.y = 1.0; g.add(seat);
      [[-1.3,-.28],[1.3,-.28],[-1.3,.28],[1.3,.28]].forEach(([bx,bz]) => {
        const leg = box(.16,1.0,.16, M.metal); leg.position.set(bx,.5,bz); g.add(leg);
      });
      const back = box(3.0,1.1,.14, woodM); back.position.set(0,1.62,-.35); g.add(back);
      g.rotation.y = ry || 0;
      g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
      add(g, x, 0, z, false, false);
      solid(x, z, 1.7, .6);
    }
    /* 長椅挪到入口兩側,不要跟鞦韆同一條 z 排排站——鞦韆的碰撞箱本來就要
       撐到快 3 個單位寬,兩邊都塞東西一定會卡到入口(kc 抓到「走不進去」
       的問題)。 */
    bench(cx-7, cz+3, 0);
    bench(cx+7, cz+3, Math.PI);

    /* 入口兩側各放一個盆栽,呼應現實公園入口常見的做法 */
    addProp('planter', cx-gateW/2-1, z1+.5, 1.0, 1.1, 0x6a7a5a);
    addProp('planter', cx+gateW/2+1, z1+.5, 1.0, 1.1, 0x6a7a5a);

    /* 鞦韆:公園最好認的輪廓,兩個 A 字架 + 一根橫桿 + 兩張坐板。上一版
       h=2.6,比角色(4 單位高)矮,站過去比人還矮一截,完全不像鞦韆架
       (kc 抓到的問題)。現實鞦韆頂桿要高過大人頭頂才不會撞到,換算
       (1 單位≈.42米)大概要 5.5 單位高。兩隻腳原本只在 Z 方向差 .8、
       幾乎貼在一起,看起來是兩根細棒不是「A」——改成用旋轉角度算出腳的
       中心跟長度,讓頂端收在同一點、底端撐開 spread 寬,真的撐成三角形。
       add() 一律吃世界座標,細節見上面同一句註解,這裡不重複。 */
    /* 鞦韆放園區中央、離入口(z1)跟長椅都留夠距離——上一版放在 cz+3.2,
       碰撞箱(w/2+.6 寬、spread+.5 深,再加 blocked() 內建的 .55 緩衝)整個
       蓋到入口那格,人根本走不進去(kc 抓到的問題)。cz 是整個園區的正中間,
       跟南邊圍籬、北邊入口都有超過兩個單位淨空。 */
    (function swing(){
      const sx = cx, sz = cz, w = 3.6, h = 5.5, spread = 1.3;
      const frameM = std({ color:0x5a6068, roughness:.5, metalness:.4 });
      const legLen = Math.hypot(h, spread), tiltAngle = Math.atan2(spread, h);
      [-1,1].forEach(side => {                       // 兩個 A 字架(左右兩端)
        const topX = sx + side*w/2;
        [-1,1].forEach(lean => {                      // 每個架子兩隻斜腳,頂端收在一起、底端撐開
          const leg = box(.16, legLen, .16, frameM);
          leg.rotation.x = lean*tiltAngle;
          add(leg, topX, h/2, sz - lean*spread/2, true, true);
        });
      });
      add(box(w+.3,.16,.16, frameM), sx, h, sz, true, false);   // 橫桿
      [-.9,.9].forEach(seatX => {
        const chainLen = h - 1.0;
        add(box(.7,.1,.4, woodM), sx+seatX, 1.0, sz, false, false);
        [-1,1].forEach(cside => {
          add(box(.04,chainLen,.04, frameM), sx+seatX+cside*.16, 1.0+chainLen/2, sz, false, false);
        });
      });
      solid(sx, sz, w/2+.6, spread+.5);
      play.push({ x:sx, z:sz, label:'鞦韆' });
    })();

    /* 滑梯:跟鞦韆同一招算斜面(頂端收在平台、底端撐開一段水平距離),
       跟 A 字腳的旋轉公式是同一套數學,只是只有一片,不是兩腳夾一個角。
       2026-08-13 kc 要遊樂器材多幾種,不是只有鞦韆。 */
    function buildSlide(sx, sz, faceDir){
      const platH = 1.8, run = 2.3;
      const m = std({ color:0x6a7078, roughness:.5, metalness:.3 });
      add(box(1.0,.15,1.0, m), sx, platH, sz, false, true);                  // 平台
      [-.4,.4].forEach(dx => add(box(.08,platH,.08, m), sx+dx, platH/2, sz-faceDir*.45, true, true)); // 爬梯支柱
      const slideLen = Math.hypot(platH, run), tiltAngle = Math.atan2(run, platH);
      const slide = box(.85,.1,slideLen, m);
      slide.rotation.x = faceDir*tiltAngle;
      add(slide, sx, platH/2, sz - faceDir*run/2, false, true);
      solid(sx, sz - faceDir*run/2, .6, run/2+.6);
      return { x:sx, z:sz-faceDir*run/2, label:'滑梯' };
    }
    play.push(buildSlide(x0+7.5, z0+3, -1));

    /* 翹翹板:中間支柱 + 一根歪一點的長板(不要死板水平)+ 兩邊坐板 */
    function buildSeesaw(sx, sz){
      const m = std({ color:0x5a6068, roughness:.5, metalness:.3 });
      add(box(.5,.6,.5, m), sx, .3, sz, true, true);
      const plank = box(3.2,.14,.5, woodM);
      plank.rotation.z = .12;
      add(plank, sx, .68, sz, false, true);
      [-1,1].forEach(s => add(box(.5,.35,.5, woodM), sx+s*1.35, .68+s*.16, sz, true, false));
      solid(sx, sz, 1.8, .5);
      return { x:sx, z:sz, label:'翹翹板' };
    }
    play.push(buildSeesaw(x1-8, z0+3.2));

    buildTree(x0+2.2, z0+2.2, .8, 3);
    lampSpots.push({ x:cx, y:4.5, z:cz, c:0xffe6c0, i:22, r:22 });
    /* 公園沒有室內場景,不要塞進 doors——那個陣列是給 enterIndoor() 用的,
       塞進去按空白鍵會跳出「室內場景還沒做」,語意不對(公園本來就是走進去
       就好,不用「進門」)。只在 whereAmI() 補一個範圍判斷當地名顯示。 */
    parkBounds = { x0:x0-1, x1:x1+1, z0:z0-1, z1:z1+1 };
  })();

  /* ===== 店面「有厚度」的版本(先在單一店面試,見 DESIGN_NOTES) =====
   * 原本的門面是一片 0.3 厚的板子貼照片,平貼在牆面上,大腦會讀成「一張照片貼在牆上」。
   * 這版把同一張照片材質包進一個真的有深度的洞裡:凹進去的箱體(側面沒圖,交給
   * 方向光自己暗下去做出深度)、鐵框、玻璃反光層、外推的門檻、地面油漬/腳踩痕
   * (假接觸陰影),再加一盞貼著地面的暖光讓騎樓地板/柱子吃到一點店內的光色。 */
  function richStoreFront({ axis, face, fX, fZ, faceW, photoMat }){
    const FRONT = .06, RECESS = .42, BORDER = .22, THICK = .12;
    const nX = axis==='z' ? face : 0, nZ = axis==='x' ? face : 0;   // 面朝哪
    const aX = axis==='x' ? 1 : 0,   aZ = axis==='x' ? 0 : 1;       // 沿牆哪個方向
    const dims = (along,h,thick) => axis==='x' ? [along,h,thick] : [thick,h,along];
    const at = (alongOff,nOff) => [fX+aX*alongOff+nX*nOff, fZ+aZ*alongOff+nZ*nOff];
    const mainIdx = axis==='x' ? (face>0?4:5) : (face>0?0:1);
    const faces = m => Array.from({length:6},(_,i)=>i===mainIdx?photoMat:M.recess);

    const [pcx,pcz] = at(0, FRONT-RECESS/2);
    add(box(...dims(faceW,4.6,RECESS), faces()), pcx, 2.5, pcz, false, true);

    const [gcx,gcz] = at(0, FRONT+.02);
    add(box(...dims(faceW-.3,4.35,.05), M.glass), gcx, 2.5, gcz, false, false);

    const fm = frameMaterial(THREE);
    const [tx,tz] = at(0, FRONT);
    add(box(...dims(faceW+BORDER*2, BORDER, THICK), fm), tx, 4.8+BORDER/2, tz, false, false);
    [-1,1].forEach(sgn => {
      const [sx,sz] = at(sgn*(faceW/2+BORDER/2), FRONT);
      add(box(...dims(BORDER, 4.6+BORDER, THICK), fm), sx, 2.5, sz, false, false);
    });

    const [thx,thz] = at(0, FRONT+.25);
    add(box(...dims(faceW,.14,.6), M.threshold), thx, .09, thz, true, true);

    const decalGeo = new THREE.PlaneGeometry(axis==='x'?faceW+1.2:2.6, axis==='x'?2.6:faceW+1.2);
    const decal = new THREE.Mesh(decalGeo,
      new THREE.MeshBasicMaterial({ map:grimeTexture(THREE), transparent:true, depthWrite:false, opacity:.85 }));
    decal.rotation.x = -Math.PI/2;
    const [dx,dz] = at(0, FRONT+1.0);
    add(decal, dx, .025, dz, false, false);

    const [lx,lz] = at(0, FRONT+.6);
    lampSpots.push({ x:lx, y:.6, z:lz, c:0xffcf9c, i:14, r:10 });
  }

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
      /* 台灣街屋是 3~5 層。舊的 9~13.8 單位換算只有 3.8~5.8 米,建築比招牌高不了多少,
         整條街看起來像一排積木盒子——這是「假」最大的來源,比貼圖還關鍵。 */
      const h = 17 + ((i*7)%3)*5;                        // 7.1 / 9.2 / 11.3 米,約 2~4 層
      const wallM = [M.wall,M.wallB,M.wallC,M.wallD][(i*3)%4];
      add(box(w,h,d, wallM), X, h/2, Z);
      solid(X, Z, w/2, d/2);

      const fX = axis==='x' ? X : X + face*(DEPTH/2);
      const fZ = axis==='x' ? Z + face*(DEPTH/2) : Z;
      const faceW = axis==='x' ? alongW-2.6 : .3;
      const faceD = axis==='x' ? .3 : alongW-2.6;
      const offX = axis==='z' ? face*.2 : 0, offZ = axis==='x' ? face*.2 : 0;

      /* 門面。有 assets/tex/shop-<kind>.png 就整面貼上去,那張圖裡本來就有門、
         櫥窗、堆的東西跟透出來的光——玩家走過去真正在看的是這個,不是牆。
         沒有圖就回到原本的鐵捲門／玻璃。 */
      /* 樓上立面:貼在建築正面外側 0.1 的一塊薄板,從騎樓頂上緣一路到頂 */
      const upY0 = 5.9, upH = h - upY0;
      if(upH > 3){
        const alongF = axis==='x' ? w : d;
        add(box(axis==='x' ? alongF : .14, upH, axis==='x' ? .14 : alongF,
                facadeMat(FACADES[(i*5)%FACADES.length], alongF/upH, wallM)),
            fX + (axis==='z' ? face*.1 : 0), upY0 + upH/2,
            fZ + (axis==='x' ? face*.1 : 0), false, true);
      }

      /* offset 要往街道那邊推(fZ+offZ),不是往回推。原本寫成 fZ-offZ,
         門面整塊 0.3 厚的板子沉進 0.2 深的牆體裡,從街上根本看不到——
         鐵捲門那張貼圖貼上去之後一直沒出現就是這個原因。 */
      if(s.kind === 'shutter'){
        add(box(faceW,4.4,faceD, M.shutter), fX+offX, 2.3, fZ+offZ, false, true);
      } else if(s.proto && shopFront(s.kind)){
        /* 單一店面試做「有厚度」的版本,先不動其他店——比較效果用,見上面 richStoreFront。 */
        richStoreFront({ axis, face, fX, fZ, faceW, photoMat: shopFront(s.kind) });
      } else {
        const lit = s.kind === 'store';
        const photo = shopFront(s.kind);
        /* 照片只貼「朝街那一面」,箱體其餘五面(尤其側面那圈)換成鋁框材質——
           不然側面會顯示同一張照片被拉伸壓扁的樣子,店內天花板的白光糊成一圈
           發光邊框,反而看起來更假。沒照片(玻璃色塊)的店不用管,單色本來就沒有
           拉伸問題。 */
        const mat = photo
          ? Array.from({length:6}, (_,idx) =>
              idx === (axis==='x' ? (face>0?4:5) : (face>0?0:1)) ? photo : M.alumFrame)
          : (lit?M.glassLit:M.glassOff);
        add(box(faceW,4.6,faceD, mat), fX+offX, 2.5, fZ+offZ, false, true);
        if(lit || s.kind==='tattoo' || s.kind==='arcade')
          lampSpots.push({ x:fX + (axis==='z'?face*2.6:0), y:3.2, z:fZ + (axis==='x'?face*2.6:0),
                           c: lit?0xf6f7ec:(s.sign||0x88aacc), i: lit?30:18, r: lit?28:20 });
      }
      /* 招牌掛在騎樓外緣,不然會被騎樓頂整個擋掉。
         尺寸/形狀不要整條街同一個模子——現實是誰先掛誰佔位,不是統一發包:
         有的整片長條貼滿(像機車行那種通到底的招牌),有的方方正正吊中間,
         有的乾脆偏一邊小小一塊。箱體側面用鋁框材質,不是照片拉伸——理由跟
         上面店面箱體同一條。 */
      if(s.signKey){
        const aX = axis==='x' ? 1 : 0, aZ = axis==='x' ? 0 : 1;
        const nX = axis==='z' ? face : 0, nZ = axis==='x' ? face : 0;
        const txt = s.text || s.label;
        /* 三間特別點名的店直接指定尺寸/發光強度,不要跟其他店共用同一套隨機:
           超商是薄壓克力燈箱,矮、偏白、故意稍微過曝;機車行是舊鐵皮招牌字才發光,
           整體偏暗、箱體比例窄高;藥局綠燈箱但比前兩間新,亮度正常偏亮。
           其餘店維持原本的偽隨機三款,但高度整體壓到原本的六到七成
           ——一整排招牌同高同比例同亮法,是「假」感最重的地方。 */
        /* along/vertH 的比例要貼近生圖「招牌本體」的實際長寬比,不是整張 PNG 檔案的
           長寬比——GPT 生招牌常常是黑底置中一塊招牌照片,四周留一圈黑邊(拍照感),
           檔案本身 1536×1024≈1.5:1,但招牌本體常常更扁長。用檔案比例去配 along/vertH
           的話裁切幾乎不會裁到黑邊,黑邊會整圈露在箱體上,跟 kc 指出的「上下黑邊沒
           真正 match」是同一個原因(2026-08-13)。正確做法是先把 PNG 裁到招牌本體
           edge-to-edge(量測非黑色範圍的 bounding box 裁掉黑邊),再用裁完的實際比例
           配 along/vertH——一查發現 store/drug 的原始檔案也有同一個問題(上下各留
           ~10% 黑邊,本體比例其實是 1.9:1,不是檔案的 1.5:1),三張都重裁過了。
           上一版改比例是對的,但同時把尺寸也一起縮太小了,招牌變成貼在一大片空牆上
           的小方塊,比例對但尺寸不合理(kc 抓到的問題)。「薄」講的是壓克力箱體的
           物理深度,不是招牌畫面本身要縮小——尺寸要跟原本一樣佔得住牆面。
           drug 原本 vertH 3.5 比 store 明顯大一號,箱體側面鋁框露出的面積跟著放大,
           讀起來像一塊厚重的方塊而不是薄招牌(kc 抓到的問題)——縮到跟 store 同尺寸。 */
        const ART = {
          store:  { along: alongW-6.5, vertH:2.7,  y:8.0,  emissiveK:1.3 },
          moto:   { along: alongW-5.7, vertH:2.5,  y:7.8,  emissiveK:1.15 },
          drug:   { along: alongW-6.5, vertH:2.7,  y:8.0,  emissiveK:1.1 },
          tattoo: { along: alongW-5.9, vertH:2.8,  y:8.0,  emissiveK:1.15 }
        }[s.kind];
        let along, vertH, y, emissiveK, alongOff = 0;
        if(ART){ ({along,vertH,y,emissiveK} = ART); }
        else {
          const style = (i*7 + txt.length) % 3;
          along = [alongW-7.4, alongW-5.2, alongW-6.4][style];
          vertH = [2.75, 4.2, 3.4][style];
          alongOff = style===2 ? (i%2?1:-1)*(alongW-along)/2*.7 : 0;
          y = 8.0 + ((i*5)%5)*.4 - (style===0?.2:0);
          emissiveK = 1;
        }
        /* 招牌貼牆掛,不用伸長桿子撐出去——那條路線試過了,見 DESIGN_NOTES。
           箱體不能太薄:原本 .45 厚、只探出牆面 .5,側面幾乎跟鏡頭同一條視線,
           看起來就是一張照片貼在牆上(kc 抓到的問題)。但 THICK 1.0 又太厚了
           (2026-08-13 kc 抓到:上下側面那圈變成很寬的黑邊,箱體像塊磚)——
           跟 OUT(離牆多遠,決定投影/立體感)是兩件事,OUT 維持 1.0,只把箱體
           自己的深度 THICK 收窄。側面材質也從純色 alumFrame 換成跟 richStoreFront
           共用的 frameMaterial(sign-frame.png 貼圖,沒補圖時退回深灰),
           純色在黑邊變窄之後看起來更像沒做完,貼圖至少有亮暗變化。 */
        const OUT = 1.0, THICK = .5;
        const sw = axis==='x' ? along : THICK, sd = axis==='x' ? THICK : along;
        const photo = signImage(s.signKey, along/vertH, emissiveK);
        const mainIdx = axis==='x' ? (face>0?4:5) : (face>0?0:1);
        const frame = frameMaterial(THREE);
        add(box(sw,vertH,sd, Array.from({length:6},(_,idx)=>idx===mainIdx?photo:frame)),
            fX + aX*alongOff + nX*OUT, y, fZ + aZ*alongOff + nZ*OUT, false, false);
      }
      if(s.id) doors.push({ id:s.id, name:s.label,
        x: fX + (axis==='z'?face*2.4:0), z: fZ + (axis==='x'?face*2.4:0) });

      const aX = fX + (axis==='z'?face*3.4:0), aZ = fZ + (axis==='x'?face*3.4:0);
      /* 騎樓拿掉大部分——整排柱子雨遮太乾淨太整齊,反而是最假的東西。
         全街只留超商跟魯肉飯(單一店面試做那間)這兩間,其餘直接切齊人行道。
         原本一間店只放一根柱子,靠隔壁店的柱子撐雨遮另一邊——鄰居還有騎樓時
         沒問題,鄰居拿掉之後單獨留下的雨遮就只有單邊有柱子撐,看起來像斷掉一半。
         剩下的這幾間騎樓兩邊都要有柱子,不能再靠鄰居。 */
      const noArcade = !(s.kind==='store' || s.proto);
      if(!noArcade){
        const pT = (i%4===0) ? .6 : .85;
        [-1,1].forEach(edge => {
          const pX = axis==='x' ? X + edge*(UNIT/2-.5) : aX;
          const pZ = axis==='x' ? aZ : Z + edge*(UNIT/2-.5);
          add(box(pT,5.8,pT, M.pillar), pX, 2.9, pZ);
          solid(pX, pZ, pT/2, pT/2);
        });
        const awnM = [M.wallB,M.wallB,M.wallB,M.tin,M.wallD][(i*11)%5];
        const awnY = 5.35 + (((i*13)%7)-3)*.05;
        add(box(axis==='x'?alongW:3.6, .4, axis==='x'?3.6:alongW, awnM),
            fX + (axis==='z'?face*1.9:0), awnY, fZ + (axis==='x'?face*1.9:0));
      }

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
    food:(c,proto)=>{ const n = nFood++ % FOOD.length;
      return { kind:'food', sign:c||0xd94a35, text:FOOD[n], signKey:'food-'+n, proto:!!proto }; },
    betel:()=>{ const n = nBetel++ % BETEL.length;
      return { kind:'betel', sign:0x5ce08a, text:BETEL[n], signKey:'betel-'+n }; },
    net:()=>({kind:'net',sign:0x4fc8f0,text:'網咖',signKey:'net'}),
    arcade:()=>({kind:'arcade',sign:0xff4fa0,text:'遊藝場',signKey:'arcade'}),
    moto:()=>({kind:'moto',sign:0x3f8fd8,text:'機車行',signKey:'moto'}),
    drug:()=>({kind:'drug',sign:0x35b06a,text:'藥局',signKey:'drug'})
  };

  /* 中華路:你家、超商在這條 */
  row({ axis:'x', at:-B_LINE, face:1, from:-72, shops:[
    S.sh, {kind:'home',id:'home',label:'你家'}, S.food(undefined,true), S.betel(), S.gap,
    {kind:'store',id:'store',label:'超商',sign:0xf2efe4,signKey:'store'}, S.moto(), S.drug(), S.sh,
    S.food(0xe8b52c), S.gap, S.gap, S.sh ]});
  row({ axis:'x', at:B_LINE, face:-1, from:-72, shops:[
    S.sh, S.food(), S.sh, S.net(), S.gap,
    {kind:'tattoo',id:'tattoo',label:'刺青店',sign:0xff4a5a,signKey:'tattoo'}, S.arcade(), S.gap, S.betel(),
    S.sh, S.sh, S.food(0xe8b52c), S.sh ]});
  /* 廟口路 */
  row({ axis:'x', at:-78+B_LINE, face:-1, from:-60, shops:[
    S.sh, S.food(), S.betel(), S.gap, S.food(0xe8b52c), S.sh, S.drug(), S.sh, S.net(), S.sh ]});
  /* 後火車站:暗的那一條 */
  row({ axis:'x', at:72-B_LINE, face:1, from:-60, shops:[
    S.sh, S.sh, S.gap, S.sh, S.moto(), S.sh, S.sh, S.sh, S.sh, S.gap ]});
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

  /* ===== 斜巷:跟 alley() 同一套「兩排素牆夾一條走道」邏輯,只是不沿 x/z
   * 軸走,是斜的(2026-08-13——kc 說圓環、廟埕那些都是路口貼裝飾,路本身
   * 還是直的;這條路本身就是斜的,呼應老市區地界不平整長出來的斜切捷徑)。
   * 角度靠 rotation.y = atan2(dx,dz) 轉,跟玩家轉向、alley() 的牆用同一套
   * 三角函數。碰撞箱用旋轉矩形的軸對齊包絡框(AABB)概略擋,巷子兩邊本來
   * 就是空的街廓內部,擋多一點無傷。 */
  const diagAlleys = [];
  function alleyDiag(x0, z0, x1, z1){
    diagAlleys.push({ x0, z0, x1, z1 });
    const dx = x1-x0, dz = z1-z0, len = Math.hypot(dx,dz), ang = Math.atan2(dx,dz);
    const ux = Math.sin(ang), uz = Math.cos(ang);      // 沿線方向單位向量
    const nx = Math.cos(ang), nz = -Math.sin(ang);     // 垂直方向單位向量
    const cx = (x0+x1)/2, cz = (z0+z1)/2;
    const at = (along, side) => [cx + ux*along + nx*side, cz + uz*along + nz*side];
    const HW = 3.6;

    const floor = box(HW*2+8, .28, len, M.walk);
    floor.rotation.y = ang;
    add(floor, cx, .14, cz, false, true);

    [-1,1].forEach(s => {
      const wall = box(6, 13, len, M.wallC);
      wall.rotation.y = ang;
      const [wx,wz] = at(0, s*(HW+3));
      add(wall, wx, 6.5, wz);
      solid(wx, wz, Math.abs(len/2*ux)+Math.abs(3*nx), Math.abs(len/2*uz)+Math.abs(3*nz));
    });
    for(let i=0;i<6;i++){
      const along = -len/2 + (i+.5)*len/6;
      const [jx,jz] = at(along, (i%2?1:-1)*(HW-.3));
      const junk = box(1.6,1.1,1.2, M.tin); junk.rotation.y = ang;
      add(junk, jx, 4.4+((i*3)%3), jz, true, false);
    }
    [-.32,.32].forEach(f => {
      const [lx,lz] = at(len*f, 0);
      add(box(1.3,.32,.9, glow(0xffe6a8,2.0)), lx, 6.4, lz, false, false);
      lampSpots.push({ x:lx, y:6.4, z:lz, c:0xffe6a8, i:26, r:30 });
    });
  }
  alleyDiag(12, B_LINE+DEPTH/2, 48, 72-B_LINE-DEPTH/2);   // 中華路 ⇄ 後火車站,斜的那條

  /* ===== 廟埕 ===== */
  (function temple(){
    const z = -108, W = 34;
    add(box(96,.3,22, M.stone), 0, .15, -92, false, true);
    /* 96×22 的矩形太乾淨了,跟旁邊的路網一樣方正——加幾塊大小不一、卡出去的
       石板,北緣(朝廟口路那側)故意凸進路面凸得深淺不一,讀起來像廣場自己
       長出去蓋過路面,不是切好角的方塊(2026-08-13,kc 覺得路網太方正,配合
       上面 H_ROADS 那段廟口路南側 curb 留空一起看)。y 故意抬 .01 蓋過底板,
       不然邊界重疊的地方會 z-fighting。 */
    [
      [-30, -78, 34, 10],
      [ 22, -76, 26, 14],
      [-52, -94, 14, 18],
      [ 46, -96, 12, 14]
    ].forEach(([x,zz,w,d]) => add(box(w,.3,d, M.stone), x, .16, zz, false, true));
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

  /* ===== 小狗:街上第一個可以摸的互動物件(2026-08-13,kc 要的)=====
   * 跟人物同一套「膠囊+球體」灰模語彙,不用另外找模型或動畫——這隻站著不動,
   * 給人摸的時候用 pets 陣列讓 game.html 判斷距離、觸發獎勵(見那邊
   * interactProp())。放在廟口攤販附近,呼應「小吃攤旁邊常有流浪狗」。 */
  function buildDog(x, z){
    const gcap = (w,h,d,m) => {
      const r = Math.min(w,d)/2, len = Math.max(.001, h-r*2);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r,len,4,8), m);
      mesh.scale.set(w/(r*2), 1, d/(r*2));
      return mesh;
    };
    const gd = new THREE.Group();
    const fur = std({ color:0xa9793f, roughness:.95 });
    const dark = std({ color:0x342519, roughness:.9 });
    const body = gcap(.42,.66,.94, fur); body.rotation.z = Math.PI/2; body.position.set(0,.42,0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24,10,8), fur); head.position.set(0,.5,.5);
    const snout = gcap(.14,.28,.14, dark); snout.rotation.x = Math.PI/2; snout.position.set(0,.44,.66);
    [[-.09,.68,.42],[.09,.68,.42]].forEach(([x2,y2,z2]) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.08,.18,6), dark);
      ear.position.set(x2,y2,z2); ear.rotation.x = -.35; gd.add(ear);
    });
    const tail = gcap(.08,.42,.08, fur); tail.rotation.x = -Math.PI/3; tail.position.set(0,.56,-.5);
    gd.add(body, head, snout, tail);
    [[-.16,-.32],[.16,-.32],[-.16,.28],[.16,.28]].forEach(([x2,z2]) => {
      const leg = gcap(.1,.4,.1, dark); leg.position.set(x2,.2,z2); gd.add(leg);
    });
    gd.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    add(gd, x, 0, z, false, false);
    return gd;
  }
  const pets = [];
  [[28,-90,'小狗']].forEach(([x,z,label]) => {
    buildDog(x, z);
    pets.push({ x, z, label });
  });

  /* ===== 路上的垃圾:撿了 mood 扣一點、star 往好的方向動一點(善值,見
   * DESIGN_NOTES「風評」),寶特瓶額外給一點錢(2026-08-13,kc 要的)。
   * 圖檔 assets/tex/trash-<kind>.png,prompt 見 PROMPTS.md——GPT 生的是純黑底,
   * 要先跑 tools/black-to-alpha.py 把黑轉透明再放進來,不然貼上去會帶一片黑
   * 方塊。沒圖之前用一塊半透明色塊頂著位置,不會壞,跟這個檔案其他貼圖
   * 同一套慣例。撿過的當場把 mesh 從場上移除,一次性,沒做每天重生。 */
  const litterMats = {};
  function litterMaterial(kind, tint){
    if(litterMats[kind]) return litterMats[kind];
    const m = std({ color:tint, roughness:.9, transparent:true, opacity:.85 });
    m.depthWrite = false;
    litterMats[kind] = m;
    loader.load(TEX_DIR + `trash-${kind}.png`, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      m.map = t; m.color.setHex(0xffffff); m.opacity = 1; m.needsUpdate = true;
    }, undefined, () => {});
    return m;
  }
  /* kc 玩起來說看不到垃圾在哪(2026-08-13)。試過在垃圾本身的材質上加
     emissive,效果靠圖片自己的亮度,寶特瓶那種偏透明偏白的照片加了也不明顯,
     不保險。改成在垃圾底下疊一圈跟圖片內容無關的暖色光暈(跟 grimeTexture()
     的假接觸陰影同一招,只是這個是亮的不是暗的)——不管垃圾照片本身多暗,
     地上永遠有一圈微光可以吸引人過去看。 */
  let _litterGlowTex = null;
  function litterGlowTex(){
    if(_litterGlowTex) return _litterGlowTex;
    const S = 128;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(S/2,S/2,0, S/2,S/2,S/2);
    g.addColorStop(0,'rgba(255,232,170,1)'); g.addColorStop(.55,'rgba(255,200,110,.6)');
    g.addColorStop(1,'rgba(255,200,110,0)');
    x.fillStyle = g; x.fillRect(0,0,S,S);
    _litterGlowTex = new THREE.CanvasTexture(c);
    return _litterGlowTex;
  }
  const litter = [];
  [
    [-40,-16.5,'bottle',0xdce8e0],
    [-5, 16.7,'lunchbox',0xc9c2a8],
    [15,-16.5,'cig',0x5a5650],
    [35, 16.7,'flyer',0xd8d2c0],
    [-60,-16.5,'cup',0xc2a0d0],
    /* 2026-08-13 kc 要 10 個,加東西不動原本 5 個的座標——分散到廟口路、
       後火車站那兩排跟中華路剩下的空段,同一組 kind 用第二次。 */
    [70,-16.5,'bottle',0xdce8e0],   // 原本放 50 撞到公園圍籬,2026-08-13 挪開
    [60, 16.7,'lunchbox',0xc9c2a8],
    [-70,16.7,'cig',0x5a5650],
    [-40,-61.5,'flyer',0xd8d2c0],
    [0,  55.5,'cup',0xc2a0d0]
  ].forEach(([x,z,kind,tint]) => {
    /* 人行道那塊 box 是 .3 厚(見 H_ROADS.forEach 的 M.walk,中心 y=.15、頂面在
       y=.3),垃圾之前放在 y=.04/.05——整片埋在人行道厚度裡面,從上面根本
       看不到,難怪 kc 說找不到垃圾(2026-08-13 抓到)。要蓋在人行道「上面」,
       y 一定要大於 .3。 */
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),
      new THREE.MeshBasicMaterial({ map:litterGlowTex(), transparent:true, depthWrite:false,
                                     blending:THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI/2;
    add(glow, x, .32, z, false, false);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4), litterMaterial(kind,tint));
    mesh.rotation.x = -Math.PI/2;
    add(mesh, x, .34, z, false, false);
    /* 貼圖光暈修完之後 kc 說還是找不到——這遊戲的光池(POOL,見下面
       updateLights)只讓離玩家最近的 12 盞真的發光,遠遠看沒點燈的東西
       再怎麼加自發光都不會比旁邊真的在發光的招牌/路燈亮。垃圾直接掛進
       lampSpots,跟路燈用同一套系統,才會真的在地上投出一圈光,走近的時候
       自然被吸引過去,不是等玩家自己去找那塊暗色貼圖。 */
    lampSpots.push({ x, y:.6, z, c:0xffcf8a, i:10, r:7 });
    litter.push({ x, z, kind, mesh, glow });
  });

  /* 街道小物點綴(2026-08-13):消防栓、電箱,純裝飾、不能互動,單純讓街上
     多一點雜物不要太乾淨。座標挑跟垃圾點同一條人行道線(z=-16.5,已經驗證
     過站得到、看得到),但錯開 x,不要疊到垃圾點或店面招牌。 */
  addProp('hydrant', -52, -16.5, .9, 1.2, 0xa0402c);
  addProp('utilitybox', -30, -16.5, 1.1, 1.4, 0x4a5a42);

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
    if(parkBounds && x > parkBounds.x0 && x < parkBounds.x1 && z > parkBounds.z0 && z < parkBounds.z1) return '小公園';
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

  return { colliders, doors, alleys, diagAlleys, pets, litter, play, lampSpots, updateLights, whereAmI, blocked, materials:M };
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
   曾經為了看到樓上立面拉到 1.55,kc 說「調回去 原本的視角還好」——
   樓上是遠景才看得到的東西,不值得為它改掉近景的構圖。
   fov 40 是望遠端:退遠 ＋ 縮視角,角色在畫面上反而更大,招牌也還收得進來,
   而且背景會被壓平,街看起來更像一條街,不像一個模型。 */
export const CAM = { dist:22, high:11, lookY:.78, fov:40 };

/* 角色材質:皮膚／頭髮／帽 T／褲子／鞋子／眼睛。方塊人 fallback 跟真人骨架模型
 * 共用同一份材質物件——換衣服只要在這裡改,兩邊畫面會一起變,不用各改一次。
 * 衣服／褲子／鞋子補真實布料貼圖,沒補就維持純色灰模。貼圖本身拍的就是
 * 「深藏青／深灰」布料,顏色已經到位了——不能再乘一次原本那個一樣深的純色,
 * 兩層深色疊乘會整個人變全黑剪影,分不出帽 T 跟褲子(2026-08-12 kc 測出來的坑)。
 * 貼圖到位後改乘白色 = 貼圖顏色直接用。
 * 皮膚不補:方塊臉/骨架模型的臉貼真實皮膚照片只會更像面具,維持純色。
 *
 * 顏色不寫死在這裡——讀 lib/character.js 的 globalThis.Character,2D 室內
 * (scene-store-front.js 的 P.pcXxx)也讀同一份,兩邊才不會各改各的、
 * 看起來像換了個人(2026-08-12 kc:「就是一致啊」)。這個檔案是 ES module,
 * 但 module 腳本可以直接讀 globalThis,只要 host html 把 character.js 排在
 * <script type="module"> 之前載入就好,不用 import。 */
function buildCharacterMaterials(THREE){
  const C = globalThis.Character;
  const M = {
    skin:new THREE.MeshStandardMaterial({color:C.skin,roughness:.85}),
    hair:new THREE.MeshStandardMaterial({color:C.hair,roughness:.9}),
    hood:new THREE.MeshStandardMaterial({color:C.hood,roughness:.9}),
    pants:new THREE.MeshStandardMaterial({color:C.pants,roughness:.9}),
    shoe:new THREE.MeshStandardMaterial({color:C.shoe,roughness:.9}),
    eyes:new THREE.MeshStandardMaterial({color:0x1a1512,roughness:.4})
  };
  [ { mat:M.hood,  file:C.tex.hood  },
    { mat:M.pants, file:C.tex.pants },
    { mat:M.shoe,  file:C.tex.shoe  }
  ].forEach(o => {
    new THREE.ImageLoader().load(TEX_DIR + o.file, img => {
      const t = new THREE.CanvasTexture(prep(img, { mirror:true, lift:.1 }));
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      o.mat.map = t; o.mat.color.setHex(0xffffff); o.mat.needsUpdate = true;
    }, undefined, () => {});
  });
  return M;
}

/* 方塊人:2026-08-12 之前的唯一畫法,現在降級成「模型還沒載到/載入失敗」時的
 * fallback,邏輯完全沒動,只是包成一個 helper 讓 buildPlayer 可以在載入成功後
 * 把它整組拆掉。回傳的 rig 是掛在呼叫端傳進來的 parent 底下的一個 Group。
 * M 由呼叫端傳進來(跟真人模型共用同一份材質,見 buildCharacterMaterials)。 */
function buildPrimitiveRig(THREE, parent, M){
  /* 邊角磨圓一點,鞋子這種本來就方正的東西才用——半徑要小於最薄部位的一半 */
  const box = (w,h,d,m) => new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.045), m);
  /* 軀幹、手、腳:2026-08-12 從箱子改膠囊體(圓柱體+兩端半球)。
   * 整體風格是寫實(見 DESIGN_NOTES「色調原則」),貼了真實布料照片之後
   * 方塊的直角邊反而穿幫——照片級材質要包在圓潤的形狀上才讀得出是人,
   * 不然就是「人偶包壁紙」。半徑跟著窄邊走,寬邊拉伸,壓成橢圓截面。 */
  const capsule = (w,h,d,m) => {
    const r = Math.min(w,d)/2;
    const len = Math.max(.001, h - r*2);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m);
    mesh.scale.set(w/(r*2), 1, d/(r*2));
    return mesh;
  };
  /* 頭:同樣理由換橢球,不再是箱子。 */
  const sphere = (w,h,d,m) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.5, 16, 12), m);
    mesh.scale.set(w, h, d);
    return mesh;
  };
  const g = new THREE.Group();
  const put = (b,x,y,z) => { b.position.set(x,y,z); g.add(b); return b; };

  put(capsule(.75,1.31,.43, M.hood), 0, 2.63, 0);   // 連帽外套(軀幹)
  put(box(.21,.20,.21, M.skin),      0, 3.33, 0);   // 脖子
  put(sphere(.53,.58,.55, M.skin),   0, 3.65, 0);   // 頭
  put(box(.58,.16,.59, M.hair),      0, 3.95, 0);   // 頭髮
  put(box(.70,.33,.25, M.hood),      0, 3.28, -.28); // 兜帽垂在背後

  /* 手腳掛 pivot:髖在 1.96,肩在 3.23 */
  const limb = (x, y, w, h, d, m, zOff) => {
    const p = new THREE.Group(); p.position.set(x, y, 0);
    const b = capsule(w, h, d, m); b.position.set(0, -h/2, zOff||0); p.add(b);
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
  parent.add(g);

  let phase = 0;
  function animate(dt, moving, run){
    if(moving){
      phase += dt*.0082*run;                        // 腿長了,步頻要慢一點才不像小碎步
      /* run>1(按 Shift)不是只變快——手腳擺動幅度也跟著放大、身體前傾、
         加一點垂直彈跳,不然只是「加速播放的走路」,看不出跑步的肢體感
         (kc 抓到的問題)。跟下面 gltf 版本用同一套「幅度+前傾+彈跳」邏輯。 */
      const amp = run > 1 ? .74 : .52;
      const sw = Math.sin(phase)*amp;
      legL.rotation.x = sw;      legR.rotation.x = -sw;
      armL.rotation.x = -sw*.75; armR.rotation.x = sw*.75;
      g.rotation.x = run > 1 ? .12 : 0;
      g.position.y = run > 1 ? Math.abs(Math.sin(phase))*.06 : 0;
    } else {
      phase = 0;
      g.rotation.x *= .8; g.position.y *= .8;
      [legL,legR,armL,armR].forEach(p => p.rotation.x *= .82);
    }
  }
  return { rig:g, animate };
}

/* 真人骨架模型:2026-08-12 開始接,見 DESIGN_NOTES「美術與視角」。
 * *-idle.glb 帶 mesh + 骨架 + idle 動畫;*-walk.glb 只有骨架 + 走路動畫
 * (Blender 匯出時把 mesh 拿掉了,省下重複的幾何跟材質)。兩份是同一個
 * Mixamo 角色分兩次下載,骨架完全一樣,所以 walk 的 AnimationClip 可以
 * 直接套到 idle 那份骨架的 AnimationMixer 上,不用在 Blender 裡合併成
 * 一個檔案。缺檔案/載入失敗時 onError 什麼都不做,場上就一直是方塊人——
 * 跟這個檔案其他地方「缺材質貼圖不會壞」是同一套慣例(見 prep() 的說明)。
 *
 * 兩套骨架:'m'(Remy,男性,主角在用)跟 'f'(Sophie,女性,2026-08-12
 * 為了廟口角色補的)。**不同來源模型,Blender 匯出時部件名字不保證一樣**——
 * Remy 是 Body/Tops/Bottoms/Shoes/Hair/Eyes/Eyelashes(語意清楚,上衣褲子
 * 分開兩個 mesh);Sophie 是 Ch02_Body/Ch02_Cloth/Ch02_Sneakers/Ch02_Hair/
 * Ch02_Eyelashes/Ch02_Socks(**整套衣服是同一個 mesh「Cloth」,上衣跟褲子
 * 沒辦法分開換色**,只能當一件「服裝」整體換一個顏色;也沒有獨立的 Eyes)。
 * 加新骨架時務必先照這個方法查實際部件名,不要憑印象猜:
 *   python3 -c "import struct,json; ..." 解 glb 的 JSON chunk 印 node.name
 * (Blender 匯出 log 印的是 mesh DATA 名字如 'Mesh.002',不是這裡要的
 * OBJECT 名字/glTF node 名字,兩個是不同的東西,2026-08-12 踩過)。 */
const MODELS = {
  m: { idle:'base-human-idle.glb',   walk:'base-human-walk.glb', run:'base-human-run.glb',
       parts: { Body:'skin', Tops:'hood', Bottoms:'pants', Shoes:'shoe',
                 Hair:'hair', Eyes:'eyes', Eyelashes:'eyes' } },
  f: { idle:'base-human-f-idle.glb', walk:'base-human-f-walk.glb',
       parts: { Ch02_Body:'skin', Ch02_Cloth:'hood', Ch02_Sneakers:'shoe',
                 Ch02_Hair:'hair', Ch02_Eyelashes:'eyes', Ch02_Socks:'pants' } },
  /* 2026-08-12 為了阿源另外接的:同是男性,但髮型/五官跟 Remy(m)不一樣——
     髮型是模型內建的固定形狀換不了造型,只能整套換一個模型來換髮型。
     Ch31_Collar 是毛衣領口內襯那一小塊,跟 Sweater 用同一個顏色最自然。 */
  m2: { idle:'base-human-m2-idle.glb', walk:'base-human-m2-walk.glb',
        parts: { Ch31_Body:'skin', Ch31_Sweater:'hood', Ch31_Collar:'hood',
                  Ch31_Pants:'pants', Ch31_Shoes:'shoe', Ch31_Hair:'hair',
                  Ch31_Eyelashes:'eyes' } }
};

/* 快取:每個 glb 只 fetch+parse 一次,buildPlayer 跟 buildNPC(2026-08-12 起
 * 可以做多個角色)都從這裡拿同一份解析結果,不用每個角色重新下載一次檔案。
 * AnimationClip 是純資料,可以被多個角色的 AnimationMixer 共用,不用複製;
 * 但 model.scene 一定要用 cloneSkinned(SkeletonUtils.clone)複製——naive
 * .clone() 會斷骨骼綁定,而且同一個 Object3D 不能同時掛在兩個角色底下。 */
const _gltfCache = {};
function loadModel(file){
  if(!_gltfCache[file]) _gltfCache[file] = new Promise((resolve, reject) => {
    new GLTFLoader().load(MODEL_DIR + file, resolve, undefined, reject);
  });
  return _gltfCache[file];
}

/* 把載入好的 idle glb 套到一個新角色身上:複製骨架、依 rig.parts 套材質、
 * 用 bounding box 校正身高。player 跟 NPC 共用這一段。
 * mats 是 buildCharacterMaterials() 或呼叫端自己準備的 {skin,hair,hood,pants,shoe,eyes}。 */
function riggedCharacter(THREE, idleGltf, mats, heightUnits, parts){
  const model = cloneSkinned(idleGltf.scene);

  /* 縮放:模型原生單位不保證跟這個場景「1 unit≈0.42 米」一致,用 bounding box
   * 校正到指定身高,不用賭 Blender 匯出時的精確縮放值。一定要先
   * updateMatrixWorld(true) 再量 Box3,不然骨架姿勢還沒套用,量到的會是
   * 隨便一個很小的預設值(2026-08-12 踩過,量出 0.638 而不是正確的 3.79,
   * 角色因此被放大好幾倍、鏡頭整個埋進身體裡)。 */
  model.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(heightUnits / (box3.max.y - box3.min.y));

  /* Eyes/Eyelashes(有的話)不是要換裝的部位,mats.eyes 給個深色材質,
   * 免得空白貼圖在臉上變成一片死白。 */
  model.traverse(o => {
    if(!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const key = parts[o.name];
    if(key) o.material = mats[key];
  });
  return model;
}

/* 刺青(2026-08-12):不用 DecalGeometry——那個機制是對著 SkinnedMesh 的
 * 綁定姿勢(bind pose)幾何投影出一塊靜態網格,骨架一動畫變形,貼花不會跟著
 * 走,會凍結在原地跟手臂分離。改成一片貼了圖的小平面,**直接掛在骨骼底下**
 * 當子物件——骨頭轉、平面跟著轉,不會有這個問題。代價是手臂真的彎起來的時候
 * 貼圖不會跟著肌肉起伏變形,但這個遊戲的鏡頭距離看不出這個差異。
 *
 * tex 沒給圖之前用 opts.color 畫一個純色佔位面板,好確認位置抓得準不準;
 * 之後圖生出來,呼叫端把 tex 換成真的 CanvasTexture 就好,這個函式不用動。
 * boneName 要用 model 內部實際的骨骼名字。Mixamo 原始骨架名字是
 * 'mixamorig:RightForeArm' 這種帶冒號的格式,但 GLTFLoader 讀進來之後冒號
 * 會被拿掉,變成 'mixamorigRightForeArm'(2026-08-12 肉眼查出來的,查文件
 * 沒查到這條——GLTFLoader/PropertyBinding 對節點名字有自己的處理)。
 * 前臂是 'mixamorigRightForeArm'/'mixamorigLeftForeArm'。 */
function addTattoo(THREE, model, opts){
  const bone = model.getObjectByName(opts.boneName);
  if(!bone) return null;
  const mat = opts.tex
    ? new THREE.MeshStandardMaterial({ map:opts.tex, transparent:true, roughness:.6,
        polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 })
    : new THREE.MeshStandardMaterial({ color:opts.color||0xff2244, transparent:true,
        opacity:.6, roughness:.6 });
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.size[0], opts.size[1]), mat);

  /* 骨骼本身在 FBX 裡就帶了單位換算用的縮放(這個角色量出來是 0.0106,
   * 幾乎是針孔大小),size/offset 是 mesh 的 local 值,掛到骨骼底下會被那個
   * 縮放乘一次,不抵銷掉的話 size:[.35,.5] 這種「跟場景其他東西同單位」的
   * 數字會變成看不見的小點(2026-08-12 踩過)。用骨骼的 world scale 反過來
   * 放大 mesh 自己的 scale,offset 也要除掉同一個倍率,兩邊才會抵銷乾淨。
   *
   * local 座標軸的意思(2026-08-12 用 AxesHelper 實測,不是猜的):
   * **local X 是沿著骨頭方向,從手肘指向手腕**——offset[0] 正值 = 往手腕移。
   * Y/Z 是垂直骨頭的兩個方向(手臂表面往外/往前後),要哪一個當「貼在外側」
   * 得肉眼試,rotation 同理是繞這三個 local 軸轉,不是世界座標。 */
  bone.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); bone.getWorldScale(ws);
  mesh.scale.set(1/ws.x, 1/ws.y, 1/ws.z);
  mesh.position.set(opts.offset[0]/ws.x, opts.offset[1]/ws.y, opts.offset[2]/ws.z);
  mesh.rotation.set(opts.rotation[0], opts.rotation[1], opts.rotation[2]);
  bone.add(mesh);
  return mesh;
}

/* 白底黑線稿轉成透明背景——白色的地方變透明,黑線留下來,不用另外處理
 * alpha channel。亮度(luminance)當 alpha 的反相:越亮越透明。 */
function tattooTexture(THREE, img){
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for(let i=0; i<d.data.length; i+=4){
    const lum = (d.data[i]*.299 + d.data[i+1]*.587 + d.data[i+2]*.114) / 255;
    d.data[i]=20; d.data[i+1]=16; d.data[i+2]=14;      // 線稿本身固定用深色,不管原圖顏色
    d.data[i+3] = Math.round((1-lum)*255);              // 越白越透明
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildPlayer(THREE, scene){
  const g = new THREE.Group();
  scene.add(g);

  const M = buildCharacterMaterials(THREE);
  const primitive = buildPrimitiveRig(THREE, g, M);
  let mode = 'primitive';
  let mixer = null, idleAction = null, walkAction = null, runAction = null, activeAction = null, model = null;
  let runPhase = 0;                                   // 只在「跑步動畫還沒載到」的過渡期用,見下面

  const rig = MODELS.m;                               // 主角固定用 Remy(男性)這副骨架
  loadModel(rig.idle).then(idleGltf => {
    model = riggedCharacter(THREE, idleGltf, M, PLAYER.height, rig.parts);

    /* 朝向:2026-08-12 實測 Remy 這份模型面向剛好跟場景一致,不用轉。
     * 之後換別的來源模型如果肉眼看反了,改這行成 Math.PI。 */
    model.rotation.y = 0;

    g.remove(primitive.rig);
    g.add(model);
    mode = 'gltf';

    mixer = new THREE.AnimationMixer(model);
    if(idleGltf.animations[0]){
      idleAction = mixer.clipAction(idleGltf.animations[0]);
      activeAction = idleAction;
      idleAction.play();
    }

    loadModel(rig.walk).then(walkGltf => {
      if(walkGltf.animations[0]) walkAction = mixer.clipAction(walkGltf.animations[0]);
    }).catch(() => {});
    /* 2026-08-13 從 Mixamo 抓的專門跑步動作(Remy,In Place 勾選,流程見
       assets/models/README.md)——同一副骨架、同一支 mixer 直接套,不用另外
       處理。在這之前(下面 fallback)是把走路動畫加速播放頂著用。 */
    if(rig.run) loadModel(rig.run).then(runGltf => {
      if(runGltf.animations[0]) runAction = mixer.clipAction(runGltf.animations[0]);
    }).catch(() => {});
  }).catch(() => {});

  function animate(dt, moving, run){
    if(mode === 'primitive'){ primitive.animate(dt, moving, run); return; }
    if(!mixer) return;
    if(walkAction && idleAction){
      const useRun = moving && run > 1 && runAction;
      if(!useRun) walkAction.timeScale = run;         // 還沒載到跑步動畫時,退回舊做法頂著
      if(runAction) runAction.timeScale = 1;          // 跑步動畫節奏本身就對,不用再乘 run
      const next = useRun ? runAction : (moving ? walkAction : idleAction);
      if(next !== activeAction){                      // 狀態切換才 crossfade,不是每幀都呼叫
        activeAction.fadeOut(.15);
        next.reset().fadeIn(.15).play();
        activeAction = next;
      }
      /* model 的前傾/彈跳只在「用跑步動畫」以外的情況疊加——真的跑步動畫
         自己就有正確的前傾跟手臂擺動,再疊會變成兩層前傾一起加乘,反而怪。
         這段只是 runAction 還沒載到那幾秒的過渡效果,見上面 fallback。 */
      if(model){
        if(!useRun && moving && run > 1){
          runPhase += dt*.011*run;
          model.rotation.x = .12;
          model.position.y = Math.abs(Math.sin(runPhase))*.05;
        } else {
          runPhase = 0;
          model.rotation.x *= .8;
          model.position.y *= .8;
        }
      }
    }
    mixer.update(dt/1000);                            // dt 這個檔案裡是毫秒,AnimationMixer 吃秒數
  }
  return { group:g, animate, eyeY:PLAYER.eyeY, height:PLAYER.height };
}

/* NPC:一顆骨架、換一套材質顏色站著不動(idle 動畫,不接 walk——現有的廟口
 * NPC 本來就是站著,要走動再照 buildPlayer 那套接 walk)。
 * 跟 buildPlayer 共用同一份 idle glb(loadModel 快取),不用重新下載一次。
 * 沒有方塊人 fallback——NPC 這批本來就是這次才新增的,沒有「舊畫法」要相容。
 *
 * opts: { x, z, rotationY, rig, height, skin, hair, hood, pants, shoe, tex, tattoo }
 * (顏色用 '#rrggbb')。rig 是 'm'(男性,Remy)/'f'(女性,Sophie)/'m2'
 * (男性,Leonard,髮型跟 Remy 不同)之一,不填預設 'm'——見上面 MODELS 的
 * 註解,'f' 那副骨架上衣褲子是同一個 mesh,hood/pants 兩個顏色只有 hood
 * 會生效(當作整件服裝的顏色),pants 沒地方套,先不管。height 不填預設
 * 跟主角一樣高(PLAYER.height,4.0 單位)。髮型是模型內建的固定形狀,
 * 換不了造型,只能換顏色(mats.hair)或整套換一個 rig(見 'm2' 怎麼加的)。
 * tex 可選:{ hood, pants, shoe } 貼真實材質圖(assets/tex/ 底下的檔名),
 * 沒給就是純色。tattoo 不填就沒有刺青,填 {} 用預設位置(右前臂外側)+
 * 紅色佔位色塊,填 { texFile } 用真的白底黑線稿(assets/tex/ 底下的檔名,
 * 會自動跑 tattooTexture() 把白底轉透明),見 addTattoo() 的說明。
 * 回傳 { group, animate }——animate(dt) 要接進呼叫端的 render loop,
 * 不然 idle 動畫的骨架姿勢不會更新,角色會卡在瀏覽器抓到檔案那一刻的預設姿勢。 */
export function buildNPC(THREE, scene, opts){
  const g = new THREE.Group();
  g.position.set(opts.x || 0, .3, opts.z || 0);
  scene.add(g);

  const rig = MODELS[opts.rig || 'm'];
  const M = {
    skin: new THREE.MeshStandardMaterial({ color:opts.skin,  roughness:.85 }),
    hair: new THREE.MeshStandardMaterial({ color:opts.hair,  roughness:.9 }),
    hood: new THREE.MeshStandardMaterial({ color:opts.hood,  roughness:.9 }),
    pants:new THREE.MeshStandardMaterial({ color:opts.pants, roughness:.9 }),
    shoe: new THREE.MeshStandardMaterial({ color:opts.shoe,  roughness:.9 }),
    eyes: new THREE.MeshStandardMaterial({ color:0x1a1512,   roughness:.4 })
  };

  /* opts.tex 可選:{ hood, pants, shoe } 貼真實材質圖(assets/tex/ 底下的檔名),
   * 跟 buildCharacterMaterials() 同一套 prep() 處理,沒給就維持上面的純色。 */
  if(opts.tex){
    Object.entries(opts.tex).forEach(([slot, file]) => {
      if(!file || !M[slot]) return;
      new THREE.ImageLoader().load(TEX_DIR + file, img => {
        const t = new THREE.CanvasTexture(prep(img, { mirror:true, lift:.08 }));
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        M[slot].map = t; M[slot].color.setHex(0xffffff); M[slot].needsUpdate = true;
      }, undefined, () => {});
    });
  }

  let mixer = null;
  loadModel(rig.idle).then(idleGltf => {
    const model = riggedCharacter(THREE, idleGltf, M, opts.height || PLAYER.height, rig.parts);
    model.rotation.y = opts.rotationY || 0;
    g.add(model);

    mixer = new THREE.AnimationMixer(model);
    if(idleGltf.animations[0]) mixer.clipAction(idleGltf.animations[0]).play();

    /* 刺青:opts.tattoo 沒給就不加。要在 mixer 先跑過一次 update 之後才能算
     * 位置——不然骨架還停在匯入時的預設姿勢(T-pose,手臂平舉),不是站立
     * 時手臂垂下來的樣子,用 T-pose 量出來的位置會歪到肩膀附近去
     * (2026-08-12 踩過)。boneName/size/offset/rotation 沒給用預設值
     * (右前臂外側),不同 rig 手臂粗細/骨骼方向不保證一樣,先當成起點,
     * 實際擺放要肉眼調。 */
    if(opts.tattoo){
      mixer.update(0.0001);
      const t = opts.tattoo;
      const place = tex => addTattoo(THREE, model, {
        boneName: t.boneName || 'mixamorigRightForeArm',
        tex, color: t.color,
        size: t.size || [.22, .3],
        offset: t.offset || [.16, .06, 0],           // X 往手腕移一點,Y 往外一點(用 AxesHelper 實測過的軸向)
        rotation: t.rotation || [0, 0, 0]
      });
      /* texFile:白底黑線稿的檔名(assets/tex/),loadModel 快取這裡用不到——
       * 每個角色的刺青圖不一定一樣,不用共用快取。載入失敗就退回 tex/color
       * (通常是 undefined,變成佔位色塊)。 */
      if(t.texFile){
        new THREE.ImageLoader().load(TEX_DIR + t.texFile,
          img => place(tattooTexture(THREE, img)), undefined, () => place(t.tex));
      } else place(t.tex);
    }
  }).catch(() => {});

  function animate(dt){ if(mixer) mixer.update(dt/1000); }
  return { group:g, animate };
}
