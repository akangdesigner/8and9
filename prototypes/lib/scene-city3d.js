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

/* 機車車色貼圖檔名(2026-08-17)——見 applyMotoSkin() 那段的說明。這裡先把
   檔名列出來,圖還沒生出來之前 loadModel 抓不到檔案會直接跳過、維持原本
   純色材質(跟專案其他地方「缺檔案不會壞」同一個慣例),kc 生完圖存到
   assets/tex/ 底下同名檔案就會自動吃到,不用再改這段。 */
const MOTO_SKINS = [
  'moto-skin-white.png','moto-skin-red.png','moto-skin-navy.png','moto-skin-black.png',
  'moto-skin-silver.png','moto-skin-yellow.png','moto-skin-orange.png','moto-skin-green.png',
  'moto-skin-pink.png','moto-skin-cream.png','moto-skin-sticker.png','moto-skin-rust.png'
];

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

/* 街道骨架收緊(2026-08-21,kc:「我希望我的地圖格局就是一個正方形3x3
 * [後來確認是 3 橫 2 縱]的街道,然後廟城往外凸一塊區域」)——路網本身早就
 * 是 3 橫(廟口路/中華路/後火車站)+ 2 縱(西園街/東和街),數量沒錯,問題是
 * bounds 比 V_ROADS 的路面+人行道邊緣還寬了一截(每邊多出約 20 單位),
 * 那圈沒人規劃過的空地就是這一整輪黑洞、繞路漏洞的根:地圖邊界跟實際
 * 路網對不齊。改法(方案圖見對話紀錄那個 artifact):
 *   - V_ROADS 不動(x:±84),bounds.x 收緊到跟它的路面+人行道外緣剛好貼齊
 *     (84+ROAD_HW/2+WALK_W=84+16=100,原本 104 那 4 個單位純浪費)。
 *   - H_ROADS 三條路的間距順手拉對稱:廟口路 -78→-84、後火車站 72→84,
 *     跟中華路(0)兩邊各差 84,核心變成乾淨的 2×2 街廓正方形,bounds.z
 *     南緣同步收到 100(跟 x 同一個邊界寬度,真的是正方形)。
 *   - 廟埕維持原本寬度/做法,只從新的廟口路(z:-84)那條線往北獨立凸出去,
 *     不算進這個 2×2 裡——圍牆本身只有北牆(templeCompoundWall 的 zN)
 *     跟著路一起挪到 -84,南牆/西牆/東牆跟裡面的宮廟本體、攤子、供桌全部
 *     不動,省得牽動已經調好的內容(kc 確認過「不算大改」)。北牆挪動後
 *     gateSpan 也要跟著新的 bounds.x[1]=100 對齊,不然又會重演「牆比地圖
 *     窄一圈」那次繞路漏洞。bounds.z 北緣(-118)維持不動,南牆(-116)離
 *     它還有 2 個單位緩衝,跟以前一樣。
 *   - 中華路那排店/你家/超商/刺青店這些現有內容位置不動,要怎麼分配進
 *     2×2 街廓之後再談,這輪只確定骨架。 */
export const CITY = {
  ROAD_HW: 9, WALK_W: 7, UNIT: 12, DEPTH: 11,
  H_ROADS: [ { z:-84, name:'廟口路' }, { z:0, name:'中華路' }, { z:84, name:'後火車站' } ],
  V_ROADS: [ { x:-84, name:'西園街' }, { x:84, name:'東和街' } ],
  get B_LINE(){ return this.ROAD_HW + this.WALK_W + this.DEPTH/2; },   // 21.5
  /* 2026-08-28,kc:「還是這樣欸」進不去——真正的原因不是碰撞箱,是這裡。
     z[1]=100 是這個世界的硬邊界(updateCity() 每幀把 pos.z clamp 在這個
     範圍內),後火車站那排(火車站/警察局/工地)都貼著這條線蓋,原本
     設計就是「只能站在馬路上看,不能真的走進去」的背景。工地內部圍籬
     一路蓋到 z=119,只把碰撞箱做開沒有用,z 座標物理上到不了 103 以後
     ——不管 blocked() 怎麼算都是 false 也沒用,pos.z 每幀都被夾回 100。
     拉到 122(蓋過工地背牆 119 一截),才是真正讓玩家走得進去的那個開關。
     連帶影響:火車站/警察局門口那段街也一起解鎖了,不是只有工地——
     兩邊建築本體都各自有 solid() 擋著,不會被穿模,只是玩家現在可以
     站到比以前更北的空地上,不是壞事。 */
  /* x[0] 一度 -100→-112(2026-09-04,配合醫院廣場腹地拉寬邊界,同一招
     z[1] 100→122 那次的理由),第七輪 kc「不要廣場」退回最小可行版本
     之後跟著退回 -100——沒有廣場地板,拉寬邊界只會讓玩家走進沒鋪過的
     空地,見 hospitalCompound() 開頭那則筆記。 */
  bounds: { x:[-100,100], z:[-118,122] },
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
    /* metal/tin 的 metalness(2026-08-18 第十八輪,kc 說「燈光也可以 tweak」
       順便查的):場景沒有 envMap,金屬感全靠環境反射撐,`alumFrame` 那顆
       材質的註解早就寫過「不要用高 metalness,沒反射源會整塊黑掉」,但
       metal/tin 這兩顆一直沒套用同一條教訓,原本 .6/.4 在暗巷這種光源少
       的地方會被吃成死黑。第一次壓到 .2/.15 還是不夠——冷氣機箱體貼近
       走道側牆(±x 法線),巷子的光源(路燈/補光)大多架在高處往下照,
       跟箱體正面法線夾角接近垂直,漫射光本來就吃得少,殘留一點
       metalness 就足以再把僅剩的漫射光吃掉一截。乾脆全部歸零,跟這個
       場景大多數材質(M.wall/M.roof 這批預設 metalness=0)同一個量級,
       不留任何要靠環境反射撐的成分。 */
    metal:std({color:0x3a3f46,roughness:.5,metalness:0}),
    tarp:std({color:0xc03a2c,roughness:.9}), tarpB:std({color:0x2f6fa8,roughness:.9}),
    plastic:std({color:0xc0473a,roughness:.75}),
    tin:std({color:0x6a6f6a,roughness:.7,metalness:0}),
    /* 香爐座、供桌各自開專屬材質,不要沿用 M.curb/M.gold——那兩個共用材質
       還貼在路緣石、屋脊/門楣上,直接貼圖會連累不相干的地方。 */
    incenseStone:std({color:0x8a857a,roughness:.9}),
    altarTable:std({color:0x7a4a2a,roughness:.6}),
    /* 夜市攤位、巷子雜物,同一批新增(2026-08-14) */
    stallTop:std({color:0xd8cdb4,roughness:.8}),
    wire:std({color:0x17171a,roughness:.85}),
    /* 店面凹進去的洞:側面看到的材質,故意深色,靠方向光自己暗下去做出深度,
       不用另外做假陰影的面板。 */
    recess:std({color:0x121417,roughness:.97}),
    /* 巷子地板(2026-08-18 第三輪,照 kc 給的參考截圖重規劃——整條地板都是
       濕的,不是原本兩塊突兀的積水色塊):MeshPhysicalMaterial 加 clearcoat,
       低 roughness 讓路燈的光沿走道拉出長長一條反光,參考圖那種濕潤柏油感
       主要就是這個效果撐出來的,不是貼圖本身多細緻。原本的 alleyWet(兩塊
       獨立矩形積水)整塊拿掉,改成地板材質本身統一濕,不用再算積水位置。 */
    alleyFloor: new THREE.MeshPhysicalMaterial({ map:T.walk, roughness:.5, metalness:.12, clearcoat:1, clearcoatRoughness:.1 }),
    /* 巷子牆面(同一輪):原本沿用 M.wallC——跟全城建築外牆共用同一顆材質,
       貼圖重複率也跟大馬路店面一樣稀疏,讀起來像放大的建築外牆,不是窄巷
       磁磚牆。開一顆獨立材質,同一張 wall.png 但重複率抓密一截(磁磚縫更
       密)、tint 更暗更髒,才跟大街店面拉開差異。 */
    /* alley-wall.png(2026-08-18 第五輪):kc 生的專屬巷子磁磚牆照片(小磁磚
       格+鏽漬水痕+管線孔洞,比借用的 wall.png 髒得多),換掉借用大街外牆
       貼圖那版。照片本身已經很暗很髒,tint 不用再像借圖那版硬壓暗
       (0x585048 那顆是為了湊乾淨貼圖硬加的,換真的髒貼圖之後太暗會死黑),
       改用接近中性的淺色 tint 只是微調,不要蓋掉照片本身的細節。
       第九輪(同一天):kc 抓到疊在牆上的水管/電表卡/海報卡太小太暗、
       在暗巷裡讀不出來,提案「牆壁本身就該包含這些東西」——kc 重生了
       第二版 alley-wall.png,直接把管線/電表箱/海報都拍進同一張照片裡,
       換掉這張之後拿掉原本疊加的 3D 水管/電表卡/海報卡(見下面 alley()/
       alleyDiag() 的異動)。**這張圖檔名沒變,只是內容整個換了**,loader
       那筆補上 `?v=2` 破快取——`shop-home.png` 那次踩過同一個坑(見那節
       筆記),忘記加版號的話瀏覽器會一直吃到舊版。
       第十輪(同一天):kc 抓到「重複性太高」——這張圖上的電表/管線/海報
       都是特定位置的獨一無二細節,不是磁磚縫那種天生可以無縫重複的紋理,
       用 rep:[2,1] 貼滿整面 24 單位長的牆,同一組電表/海報會在牆上重複
       出現兩次,一眼看得出是複製貼上。kc 要的是「一開始的尺寸就直接貼一張
       圖」——整面牆只放這張照片一次,不重複,不夠長的部分接受裁切,不要
       拉伸(跟 shopFront() 處理門面貼圖長寬比對不上的手法一模一樣,見那個
       函式的註解)。三種巷子(`alley()` 兩次、`alleyDiag()` 一次)的牆長度
       都不一樣(24/18/約 40),不能再共用同一顆材質+同一組 repeat 設定,
       改成 `alleyWallMaterial(len)`——每種長度各自算一次裁切、各自一顆
       材質,圖只載入一次(`alleyWallImg`/`alleyWallImgPromise` 快取），
       不同長度的牆各自套自己的 repeat/offset,不會共用同一顆材質物件。
       第十一輪(同一天):kc 進一步講清楚——不只是裁切邏輯要對,**生圖
       當下的長寬比就該先貼近牆的比例**,不要生正方形再裁,裁掉的部分等於
       白生。kc 重生第三版 alley-wall.png,改成寬幅橫幅(1672×941,約
       16:9),電表/管線/海報三種細節横向分散在畫面左/中/右三段,不是全部
       擠在正中央——這樣不管哪段長度的牆裁到哪一塊,大概率都裁得到東西,
       不會裁出一片空牆。`alleyWallMaterial(len)` 的裁切邏輯不用跟著改
       (原本就是照 img.width/img.height 現算,寬幅圖自動吃到更小的裁切
       幅度),只有 `?v=3` 版號要往上加。
       第十四輪(同一天):kc 說「正面用這個,因為變電箱要額外貼圖」——
       第四版 alley-wall.png(1683×934)拿掉了電表箱那個獨一無二的細節,
       只留管線/海報/黴斑/補丁磁磚這種可以重複出現不奇怪的紋理,電表箱
       改回獨立貼圖(kc 生圖中,還沒交回來,等圖到了用 addProp() 接一張
       新卡片,不是回頭改 alley-wall.png)。版號跟著加到 `?v=4`。 */
    /* M.alleyWall 這個共用材質已經拿掉了(見上面第十輪筆記)——改用下面的
       alleyWallMaterial(len) 現場生成,每種牆長度各一顆,不要在這裡補回來。 */
    /* 巷子紙箱堆(2026-08-18 第七輪):純色沒貼圖,跟 M.roof/M.curb 這批
       材質同一個慣例——舊瓦楞紙箱本來就沒什麼反光,純色布朗撐得住,
       不用等貼圖。 */
    cardboard:std({color:0xa8895c,roughness:.95}),
    /* 巷子牆側面(2026-08-18 第十三輪):kc 說純色太素,直接指定用第一版
       alley-wall.png(存成 alley-wall-side.png,還是原本那張沒有電表/管線
       獨一無二細節的磁磚+黴斑照片——這張沒有「特定位置的一次性細節」,
       是天生可以重複貼的紋理,不會踩到主牆那張「repeat 會露出複製貼上」
       的坑,直接照 M.wall 那批貼圖同一套 rep+mirror 慣例貼就好,不用
       alleyWallMaterial(len) 那套裁切邏輯。 */
    alleyWallSide: std({ color:0xc2bcae, roughness:.9 }),
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
     (柏油會變水泥路)。程序生成的那張本來就調過了,不能再乘一次。
     根因修好(2026-08-19,見 DESIGN_NOTES「貼圖 color 沒重置」那節):下面
     forEach 裡以前是 `if(o.tint) m.color.setHex(o.tint)`,沒給 tint 的規則
     材質色永遠不會重置——`M` 裡預先給了非白色 placeholder 的那批(tarp/
     tarpB/metal/plastic/curb/roof/templeDoor/gold/stallTop/incenseStone/
     altarTable,共 11 顆)全部中招,貼圖有載入但被 placeholder 色乘到接近
     看不出來,巷子/廟埕看起來像沒貼圖。改成永遠重置(沒給 tint 就設回白,
     不再是「沒給就不動」),一次修掉整批,以後新增規則也不會再忘記補
     tint。 */
  [ { mats:[M.wall, M.wallB, M.wallC, M.wallD], file:'wall.png', rep:[1,1], lift:.16 },
    { mats:[M.shutter], file:'shutter.png', rep:[1,1], tint:0xa8b0ac },
    { mats:[M.road],  file:'road.png',  rep:[5,5], mirror:true, tint:0x6a7178 },
    { mats:[M.walk],  file:'walk.png',  rep:[3,3], mirror:true, tint:0xc2beb4 },
    { mats:[M.alleyFloor], file:'walk.png', rep:[3,3], mirror:true, tint:0x2e2a26 },
    { mats:[M.alleyWallSide], file:'alley-wall-side.png', rep:[1,2], mirror:true },
    { mats:[M.stone], file:'stone.png', rep:[5,5], mirror:true, tint:0xcfcabc },
    /* 冷氣機/電表箱的貼圖(ac-unit.png/meterbox-unit.png 系列)第二十四輪
       改成 wallUnit() 自己直接 loader.load(),不再借這條共用管線掛在
       M.tin/M.meterboxTex 上——M.tin 其實還有別的用途(騎樓雨遮材質,見
       row() 裡的 awnM),之前掛在它身上等於雨遮偶爾會被 AC 機身照片糊到,
       是個沒被抓到的舊坑,這輪順便拔掉。 */
    { mats:[M.incenseStone], file:'incense-stone.png', rep:[1,1], mirror:true, lift:.1 },
    { mats:[M.altarTable], file:'altar-table.png', rep:[1,1], mirror:true, lift:.1 },
    { mats:[M.roof], file:'temple-roof.png', rep:[2,1], mirror:true, lift:.12 },
    /* red/redD 之前只有 makeTextures() 程序生成的噪點,沒有真照片(2026-08-14
       kc 抓到,以為這批廟口貼圖已經包含牆面,其實沒有)——補上。 */
    { mats:[M.red, M.redD], file:'temple-wall.png', rep:[2,1], mirror:true, lift:.14 },
    { mats:[M.gold], file:'temple-gold.png', rep:[1,1], mirror:true, lift:.1 },
    { mats:[M.curb], file:'curb.png', rep:[6,1], mirror:true, lift:.1 },
    { mats:[M.tarp], file:'tarp-red.png', rep:[1,1], mirror:true, lift:.12 },
    { mats:[M.tarpB], file:'tarp-blue.png', rep:[1,1], mirror:true, lift:.12 },
    { mats:[M.plastic], file:'plastic-red.png', rep:[1,1], mirror:true, lift:.1 },
    { mats:[M.metal], file:'metal-frame.png', rep:[1,1], mirror:true, lift:.08 },
    { mats:[M.stallTop], file:'stall-top.png', rep:[1,1], mirror:true, lift:.1 },
    /* 紙箱堆(2026-08-18 第二十八輪):crateStack() 兩顆箱子共用同一顆材質貼滿
       六面(頂上那顆還會亂轉角度),跟冷氣機/電表箱不同,紙箱沒有正面/側面
       之分,不用三視圖/六面圖,一張無縫可重複貼的滿版材質照就夠——跟
       tarp-red.png/metal-frame.png 那批同一套用法。tint:0xffffff 照 M.tin
       那次抓到的根因(見上面第十九輪筆記)一起補,不留同一個坑。 */
    { mats:[M.cardboard], file:'cardboard.png', rep:[1,1], mirror:true, tint:0xffffff, lift:.1 }
    /* 巷子配電箱不走這條(材質貼滿六面)管線,見下面 alley() 改用 addProp('utilitybox',...)——
       2026-08-18 抓到 utility-box.png 這張其實是廟金雕花貼圖貼錯,已經有現成對的
       prop-utilitybox.png(街上原本就在用的綠色鐵箱)可以借,直接改用卡片貼法。 */
  ].forEach(o => {
    loader.load(TEX_DIR + o.file, img => {
      const t = new THREE.CanvasTexture(prep(img, o));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.rep[0], o.rep[1]);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      o.mats.forEach(m => { m.map = t; m.color.setHex(o.tint || 0xffffff); m.needsUpdate = true; });
    }, undefined, () => {});                 // 沒這張圖就算了,不要吵
  });

  /* ===== 店家門面 =====
   * assets/tex/shop-<kind>.png,一種店一張(所有檳榔攤長一樣,要變體之後再加)。
   * emissiveMap 用同一張:店內的燈自己會亮,不然騎樓底下什麼都看不見。
   * 圖的長寬比跟門面對不上就取中間裁切,不要拉伸——AI 給的多半是 3:2,門面是 1.96:1。
   *
   * 門面變體(2026-08-19):food/betel 這種同業態開很多間的,原本全部共用
   * 同一張 shop-<kind>.png,店數一多「身體」重複感就跑出來(kc 抓到)。
   * 呼叫端可以多傳一個 variant(食物/檳榔攤現在用跟招牌 signKey 同一個
   * 輪替編號),會先試 shop-<kind>-<variant>.png,404 就退回原本共用那張
   * ——不補新照片之前畫面跟現在完全一樣,之後 kc 生一張補一張就好,不用
   * 一次生滿。variant 沒傳(其他業態,店數少不需要變體)行為不變。 */
  const FRONT_ASPECT = (UNIT - .4 - 2.6) / 4.6;
  const frontMats = {};
  function shopFront(kind, variant){
    if(!kind || kind === 'shutter' || kind === 'gap') return null;
    const ck = variant == null ? kind : `${kind}-${variant}`;
    if(ck in frontMats) return frontMats[ck];

    /* 還沒載到圖的時候要跟原本長得一模一樣,不能因為多了這條管線就變差 */
    const m = std(kind === 'store'
      ? { color:0xe4ead8, emissive:0xf4f6e8, emissiveIntensity:1.1, roughness:.35 }
      : { color:0x1c2731, roughness:.28, metalness:.45 });
    const applyImg = img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      const ia = img.width / img.height;
      if(ia > FRONT_ASPECT){ const r = FRONT_ASPECT/ia; t.repeat.set(r,1); t.offset.set((1-r)/2, 0); }
      else { const r = ia/FRONT_ASPECT; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      m.map = t; m.emissiveMap = t; m.emissive.setHex(0xffffff); m.emissiveIntensity = .55;
      m.color.setHex(0xffffff); m.roughness = .6; m.metalness = 0; m.needsUpdate = true;
    };
    /* 2026-08-17:shop-home.png 這輪反覆重生了好幾版,瀏覽器一直吃到舊快取
       看不到最新版(這個 session 已經在別的貼圖上踩過同一個坑)——只有這個
       kind 加 ?v=,其他 kind 目前沒在改,不用跟著動。以後 home 這張圖
       再換內容,把 v 往上加。 */
    const baseFile = TEX_DIR + `shop-${kind}.png` + (kind === 'home' ? '?v=2' : '');
    if(variant == null){
      loader.load(baseFile, applyImg, undefined, () => {});
    } else {
      loader.load(TEX_DIR + `shop-${kind}-${variant}.png`, applyImg, undefined,
        () => loader.load(baseFile, applyImg, undefined, () => {}));
    }
    frontMats[ck] = m;
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

  /* ===== 廟門(2026-08-20)=====
   * assets/tex/temple-door-<key>.png,中門/左右次間門神各自一張——真的廟中門
   * 秦叔寶/尉遲恭雙將、次間文官加冠晉爵,三扇門長得不一樣。不走上面 M 陣列
   * 那條 mirror:true 的可平鋪材質管線(那套是拿來蓋掉接縫的無縫材質做法,
   * 鏡射會把一張完整的門神畫切成 4 小塊鏡像貼在同一扇門上,人像會變得很怪)
   * ——改用跟 signImage() 一樣「整張圖只貼一次、依比例置中裁切」的做法。 */
  const doorCache = {};
  function templeDoorMat(key, aspect){
    const ck = `${key}|${aspect.toFixed(2)}`;
    if(ck in doorCache) return doorCache[ck];
    const m = std({ color:0x6e1c14, roughness:.8 });
    doorCache[ck] = m;
    loader.load(TEX_DIR + `temple-door-${key}.png`, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      const ia = img.width / img.height;
      if(ia > aspect){ const r = aspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2,0); }
      else { const r = ia/aspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      m.map = t; m.color.setHex(0xffffff); m.roughness = .6; m.needsUpdate = true;
    }, undefined, () => {});
    return m;
  }

  /* ===== 樓上的立面 =====
   * assets/tex/facade-N.png:騎樓頂以上那幾層——鐵窗、冷氣主機、曬的衣服、水管、
   * 加蓋的鐵皮。這是台灣街景資訊量最大的一塊,現在整片是空白磁磚。
   * 只貼朝街那一面,而且是獨立一塊薄板貼在建築正面外側,不動建築本體。
   * 一樓不畫在這張裡:騎樓頂會把它整個擋掉。 */
  /* 只列已經有的檔案。列了還沒生的那幾張的話,四分之三的樓會是空白磁磚,
     跟有貼圖的那幾棟擺在一起太突兀——寧可先全部同一張。
     facade-3.png(2026-08-20)補上第三張,輪替母數變 3。 */
  const FACADES = ['facade-1.png', 'facade-2.png', 'facade-3.png'];
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
  /* 場景地標文字牌(2026-08-19,kc 說廟埕那批方塊分不出哪個是哪個,截圖
     裡全部糊成色塊)——不是遊戲內容,是給 kc 邊玩邊對照用的除錯標籤,
     game.html 拿這份清單投影到螢幕上疊字,跟 doors/alleys 同一套「buildCity
     算好座標,game.html 只管畫」分工。座標不要跟 stall()/temple() 那邊的
     數字重複寫死兩份,直接在原本 add 的地方順手 push 一筆。 */
  const landmarks = [];
  /* 攤子遮雨簾垂長吵了三輪(2026-08-19,kc:「到底難在哪裡你給我滑桿」)——
     與其我猜一個數字、截圖、kc 不滿意、再猜一個數字,直接把垂簾的
     mesh 暴露出去,讓 game.html 那邊接一個滑桿面板(__dbg.tweakStall())
     即時改 scale.y/position.y,kc 自己拖到滿意為止,最後那個數字才是
     定案,不用再來回猜。 */
  const stallValance = [];
  /* 警察局貼圖滑桿(2026-08-27,kc:「你開滑桿讓我調整貼圖位置跟縮放」)——
     wallFront/wallSideA/wallSideB 在 policeStation() 那個 IIFE 裡是區域
     變數,外面存取不到,這裡先開一個空物件佔位,IIFE 裡蓋好材質之後把
     三個材質塞進來,最後隨 return 一起交給 game.html 那邊的滑桿面板即時改
     .map.repeat/.map.offset,跟 stallValance 那套「暴露 mesh 給滑桿」同一招。 */
  const policeWall = {};
  /* 警車大小/位置滑桿(2026-08-27,kc:「你給我滑桿,我來調整大小跟位置」)——
     2026-08-31 改成陣列(kc:「都要一樣大小...然後讓我調整位置」發現原本
     單一物件的坑:4 台警車各自呼叫 realPoliceCar(),但都寫進同一個
     policeCarRef,每呼叫一次(或每顆 glb 非同步載入完成)就整個覆蓋掉,
     滑桿最後只會抓到隨機哪一台——改成跟下面 constructionRef.cones 同一招,
     每台各自一筆 {group,baseX,baseY,baseZ} entry,push 進陣列,滑桿套
     共用倍率/位移到全部台上,個別的基準座標(門口/路邊排開那些不同站位)
     不會被互相蓋掉。 */
  const policeCarRef = { cars: [] };
  /* 公車亭高度滑桿(2026-09-01)——kc 兩輪都說尺寸不對(先嫌矮、又嫌
     「改回來」的版本怪),用猜的數字第三次還是有可能猜錯。跟
     policeCarRef 同一招,把整組公車亭包進一個 THREE.Group,滑桿只調
     group.scale(以地面 y=0 為軸心整組縮放,原點固定住地面不會飄走),
     kc 現場拉到滿意直接看最終倍率,我再把倍率乘回底下的常數寫死,不用
     再靠螢幕截圖來回猜。 */
  const busStopRef = {};
  /* 施工工地滑桿(2026-08-28,kc:「三角錐我也要調整」,同一輪也要能調怪手)
     ——跟 policeCarRef 同一招,但工地裡怪手/交通錐各有多台,不是單一 ref,
     用陣列蒐集每一台的 group/基準座標,滑桿套一個共用倍率/位移到全部
     實例上,不用逐台各開一組滑桿。 */
  const constructionRef = { bulldozers: [], cones: [] };
  /* 越式按摩門(2026-09-03)——kc 說「我沒看到」,黑洞面板存在但看不到,
     開一顆滑桿讓他自己現場拉找出正確的退牆深度,不用再靠截圖來回猜。
     buildAlleyShopfront() 填,game.html tweakMassageDoor() 讀。 */
  const massageDoorRef = {};
  let parkBounds = null;                              // 見下面 park(),whereAmI() 要用
  const add = (mesh,x,y,z,cast,recv) => {
    mesh.position.set(x,y,z);
    mesh.castShadow = cast !== false; mesh.receiveShadow = recv !== false;
    scene.add(mesh); return mesh;
  };
  const solid = (x,z,hw,hd) => colliders.push({x,z,hw,hd});

  /* ===== 路面 ===== */
  H_ROADS.forEach(r => {
    /* 廟口路的路面/人行道伸進廟城裡面了(2026-08-21,kc 截圖抓到「黃線上面
       不會有路啊」)——原本廟口路南側(s=-1,朝廟城那側)不放 curb 是舊設計
       (石板直接跟路面接起來,見下面那則舊筆記),那時候廟城還沒有圍牆。
       現在廟城有實心圍牆了(z:-84 剛好是廟口路的路中心線),路面/人行道
       symmetric 蓋在路中心兩側,南側那一半(z:-84~-93 路面、-93~-100 人行道)
       直接蓋進圍牆裡面的廟城範圍,牆才 .6 薄,擋不住整條完整寬度的路。
       改成廟口路只蓋北側(城市這一側,s=1)的路面/人行道,南側(廟城那側)
       整段不蓋——圍牆本身+廟城自己的石板地面接手那一側,路真的在牆內
       消失,不會再看到路面/黃線切進廟城裡面。 */
    const templeRoad = r.z === H_ROADS[0].z;
    if(templeRoad){
      add(box(210,.2,ROAD_HW, M.road), 0, 0, r.z + ROAD_HW/2, false, true);
    } else {
      add(box(210,.2,ROAD_HW*2, M.road), 0, 0, r.z, false, true);
    }
    (templeRoad ? [1] : [-1,1]).forEach(s => {
      add(box(210,.3,WALK_W, M.walk), 0, .15, r.z + s*(ROAD_HW+WALK_W/2), false, true);
      add(box(210,.34,.6, M.curb), 0, .17, r.z + s*(ROAD_HW+.3), false, true);
    });
    for(let x=-100;x<104;x+=7) add(box(3.4,.02,.2, glow(0xb8ad72,.3)), x, .11, r.z, false, true);
  });
  /* 側街路面伸過頭了(2026-08-21,kc 畫圖確認過:「正方形四邊都是乾淨
     直角,只有廟埕本身凸出去,街道不能凸出去」)——depth 172、中心 z:-3
     是舊尺寸,算出來北端到 z:-89,比新的正方形北邊界(廟口路,z:-84)
     還多凸 5 個單位,直接畫進廟埕凸出區裡,變成「街道也跟著凸出去了」。
     街道骨架收緊之後正方形是 z:[-84,84](見檔案開頭 CITY 定義那則筆記),
     side street 路面/人行道/curb 三層都要精確卡在這個範圍,depth 改成
     168、中心 z:0,南北兩端剛好落在正方形邊界上,不多不少。 */
  V_ROADS.forEach(r => {
    add(box(ROAD_HW*2,.2,168, M.road), r.x, 0, 0, false, true);
    [-1,1].forEach(s => {
      add(box(WALK_W,.3,168, M.walk), r.x + s*(ROAD_HW+WALK_W/2), .15, 0, false, true);
      add(box(.6,.34,168, M.curb), r.x + s*(ROAD_HW+.3), .17, 0, false, true);
    });
  });

  /* ===== 樹:圓環/公園/校門口/算命攤都要用,抽成共用函式 =====
   * 原本(2026-08-13)是灰模多面體+billboard 卡片樹(assets/tex/
   * tree-crown-<variant>.png 裁成十字交叉的去背照片),近看/繞到側面
   * 會露餡。2026-08-27 kc 先在算命攤那棵試「能不能用真的樹3D」,滿意
   * 之後要求「其他地方的樹都要換」——整個場景全部改成這個真的低模樹
   * 模型(Tree,Quaternius,CC0,授權見 assets/models/CREDITS.md,跟
   * food 系列、litter 系列同一個 Quaternius 家族),跟 lantern/
   * incense-bowl 那套「先蓋灰模占位,glb 載到再替換」的手法一樣。舊版
   * billboard 卡片樹(連同 tree-crown-*.png)整個拿掉,沒有留著——
   * 那批貼圖檔案灌木(buildBush)還在用,不要跟著刪掉。 */
  function realTree(x, z, targetSize){
    const fallback = box(1.2, targetSize, 1.2, std({ color:0x3c5a2e, roughness:.9 }));
    const holder = add(fallback, x, targetSize/2, z, true, false);
    loadModel('tree-01.glb').then(gltf => {
      scene.remove(holder);
      add(propModel(THREE, gltf, targetSize, 'y', Math.random()*Math.PI*2), x, 0, z, true, false);
    }).catch(() => {});
  }

  /* 警車/交通錐(2026-08-27,kc 看了施工工地/警察局的概念圖回饋:「三角錐
     警車這種適用真的3d,建築本身用灰模方塊但要有點變化」)——這兩樣是
     獨立的小道具,不是建築量體,套跟樹/機車同一招「先蓋灰模占位,glb 到
     了再替換」。Quaternius 家族,CC0,授權見 assets/models/CREDITS.md。
     車身沿用 parkMoto() 那套「lockAxis:'z' 撐滿車長」的縮放邏輯。 */
  function realPoliceCar(x, z, ry, scale, yOff){
    const s = scale || 1, y0 = yOff || 0;
    const fallback = box(2*s, .9*s, 4.4*s, std({ color:0x1c2226, roughness:.4, metalness:.3 }));
    const holder = add(fallback, x, .55*s+y0, z, true, false);
    const entry = { group:holder, baseX:x, baseY:.55*s+y0, baseZ:z };
    policeCarRef.cars.push(entry);
    loadModel('police-car.glb').then(gltf => {
      scene.remove(holder);
      const g = propModel(THREE, gltf, 4.4, 'z', ry || 0);
      g.scale.setScalar(s);
      add(g, x, y0, z, true, false);
      entry.group = g; entry.baseY = y0;
    }).catch(() => {});
  }
  // 2026-08-28,kc 開滑桿把交通錐拉到 2.18 倍說「定案」——原本 targetSize .7,烤進去變 1.53,不留在滑桿上
  const CONE_SIZE = .7 * 2.18;
  function realTrafficCone(x, z){
    const fallback = new THREE.Mesh(new THREE.CylinderGeometry(0,.28*2.18,.55*2.18,10), std({ color:0xe8622a, roughness:.6 }));
    const holder = add(fallback, x, .28*2.18, z, true, false);
    const entry = { group:holder, baseX:x, baseY:.28*2.18, baseZ:z };
    constructionRef.cones.push(entry);
    loadModel('traffic-cone.glb').then(gltf => {
      scene.remove(holder);
      const g = propModel(THREE, gltf, CONE_SIZE, 'y');
      add(g, x, 0, z, true, false);
      entry.group = g; entry.baseY = 0;
    }).catch(() => {});
  }
  /* 怪手/土堆(2026-08-27,kc:「這幾個是要真的3d吧」——上一輪誤用了
     addProp() 那套「立牌照片卡」做法,kc 糾正:設備類道具(怪手)要跟
     警車/交通錐同一套真 3D 模型手法,照片才是留給警察局那種建築立面用。
     2026-08-28:poly.pizza 上找不到真的手臂+抓斗挖土機(CC0/CC-BY 免費
     池子裡沒有),kc 確認先用「Bulldozer」推土機(Poly by Google,CC-BY
     3.0,assets/models/bulldozer.glb)頂位置,函式名維持 realExcavator
     沒改(場景語意還是「工地裡的重機具」,不是特指推土機這個字),之後
     真的挖土機模型到位只要換 loadModel() 那行檔名。土堆不是「載入模型」
     的東西,維持幾何,但改成扁平不規則堆疊(不是圓滾滾像球)。 */
  function realExcavator(x, z, ry){
    const fallback = box(2, 1.4, 4, std({ color:0xe8b23a, roughness:.5, metalness:.15 }));
    const holder = add(fallback, x, .7, z, true, false);
    const entry = { group:holder, baseX:x, baseY:.7, baseZ:z, baseRy:ry||0 };
    constructionRef.bulldozers.push(entry);
    loadModel('bulldozer.glb').then(gltf => {
      scene.remove(holder);
      const g = propModel(THREE, gltf, 4, 'z', ry || 0);
      add(g, x, 0, z, true, false);
      entry.group = g; entry.baseY = 0;
    }).catch(() => {});
  }
  /* 沙包(2026-08-28,kc:「工地內部放幾個真的沙包」)——跟怪手/土堆同一套
     「真 3D 模型,先素色箱體頂著」手法,不用另外設計。sandbags.glb
     (Sandbags,J-Toastie,CC-BY,poly.pizza,授權見 assets/models/
     CREDITS.md)本身就是一落疊起來的沙包,不用像土堆那樣自己疊多顆。 */
  function realSandbag(x, z, ry){
    const fallback = box(1.4, .7, 1, std({ color:0xb0966a, roughness:.9 }));
    const holder = add(fallback, x, .35, z, false, true);
    loadModel('sandbags.glb').then(gltf => {
      scene.remove(holder);
      add(propModel(THREE, gltf, 1.4, 'x', ry || 0), x, 0, z, false, true);
    }).catch(() => {});
    solid(x, z, .7, .5);   // 2026-08-28,kc 要求工地內部可以走進去逛之後補的,不然沙包會被穿模走過去
  }
  /* 2026-08-28,kc 看了工地隔著大門缺口的樣子回報「為何有奇怪的球」——
     舊版拿圓球體疊 3 顆逼近土堆,舊註解雖然寫著要做成「扁平不規則堆疊,
     不是圓滾滾像球」,但實作沒有真的壓扁,球體疊球體看起來還是一串球。
     壓扁過一輪(38~46% Y 軸)還是不夠,kc 接著要求「土要用真的3d」——
     跟怪手/警車同一套手法,壓扁球堆當 fallback(loadModel 失敗前先頂著,
     不是空的),glb 到位就換成真模型(dirt-pile.glb,Soil mount,apelab,
     CC-BY,poly.pizza 上找的,授權見 assets/models/CREDITS.md)。 */
  function dirtPile(x, z, r){
    const m = std({ color:0x6b4a30, roughness:1 });
    const fallback = new THREE.Group();
    [[0,0,r,.42],[r*.55,r*.4,r*.62,.38],[-r*.45,r*.32,r*.58,.46],[r*.1,-r*.4,r*.5,.4]].forEach(([dx,dz,rr,fy]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rr,7,5), m);
      s.scale.set(1, fy, 1);
      s.position.set(dx, rr*fy, dz);
      s.castShadow = true; s.receiveShadow = true;
      fallback.add(s);
    });
    const holder = add(fallback, x, 0, z, false, true);
    loadModel('dirt-pile.glb').then(gltf => {
      scene.remove(holder);
      add(propModel(THREE, gltf, r*2.2, 'x', Math.random()*Math.PI*2), x, 0, z, false, true);
    }).catch(() => {});
    solid(x, z, r*.7, r*.7);   // 2026-08-28,kc 要求工地內部可以走進去逛之後補的,不然土堆會被穿模走過去
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

  /* ===== 真的灌木叢(2026-08-13,kc 說多面體灰模不是真灌木叢,要真的;
   * 同一天第二次修正:kc 抓到整排都只用 tree-crown-4.png 一張圖,沿著
   * 籬笆密集排列時同一張照片的圓頂輪廓+高光位置一直重複,看起來像複製
   * 貼上;第三次修正:改成 3 片/60° 靜態十字排列,俯視縫隙有縮小,但 kc
   * 站近了看還是整片破綻(平面邊緣、卡片間的黑縫都看得一清二楚)——因為
   * 鏡頭是繞角色轉的第三人稱(見 game.html updateCity 的 camYaw),灌木
   * 的朝向固定不動,玩家繞到側面/走近時卡片幾乎一定會被看到側邊。真正
   * 的解法不是加卡片數量,是讓卡片跟招牌一樣「隨時轉向鏡頭」(billboard)
   * ——只要卡片永遠正對鏡頭,就永遠不會被看到邊緣。改成每叢一個 THREE.Group
   * 裝 2 片夾角 36° 的卡片(留一點厚度感,又不會露出明顯側邊),group 本身
   * 不再是固定角度,每幀由 updateBushBillboards() 轉向鏡頭。 */
  const bushMats = [1,2,3,4].map(v => {
    const m = std({ color:0x2f4a26, roughness:.9, transparent:true, alphaTest:.5, side:THREE.DoubleSide });
    loader.load(TEX_DIR + `tree-crown-${v}.png`, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      m.map = t; m.color.setHex(0xffffff); m.needsUpdate = true;
    }, undefined, () => {});
    return m;
  });
  const bushGroups = [];
  function buildBush(cx, cz, scale, variant){
    const size = 2.1*scale;
    const mat = bushMats[(variant-1+bushMats.length) % bushMats.length];
    const g = new THREE.Group();
    [-1, 1].forEach(side => {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(size,size), mat);
      card.rotation.y = side * (Math.PI/10);
      if(Math.random() < .5) card.scale.x *= -1;
      card.castShadow = true; card.receiveShadow = false;
      g.add(card);
    });
    g.userData.twist = (Math.random()-.5)*.6;      // 每叢留一點朝向誤差,不然轉向鏡頭後又長一樣
    add(g, cx, size*.26, cz, false, false);
    bushGroups.push(g);
  }
  /* game.html 的 updateCity() 每幀呼叫,camX/camZ 傳鏡頭現在的世界座標——
     跟角色朝向鏡頭用同一個 atan2(dx,dz) 公式(見 game.html camYaw 那段),
     不是這裡自己另發明一套。 */
  function updateBushBillboards(camX, camZ){
    for(const g of bushGroups){
      g.rotation.y = Math.atan2(camX - g.position.x, camZ - g.position.z) + g.userData.twist;
    }
  }
  function bushLine(ax, az, bx, bz){
    const dx = bx-ax, dz = bz-az, len = Math.hypot(dx,dz);
    const steps = Math.max(1, Math.round(len/1.15));
    let prevVariant = 0;
    for(let i=0; i<=steps; i++){
      const t = steps ? i/steps : .5;
      let variant = 1 + Math.floor(Math.random()*4);
      if(variant === prevVariant) variant = 1 + (variant % 4);   // 強制跟前一叢不同圖
      prevVariant = variant;
      buildBush(ax+dx*t+(Math.random()-.5)*.3, az+dz*t+(Math.random()-.5)*.3, .55+Math.random()*.35, variant);
    }
  }
  /* 雜草區(2026-08-27,kc 看了算命攤北牆那排 bushLine() 截圖:「灌木叢
     太小,那邊就是雜草區,至少要圍牆一半高,而且要很雜亂」,第一版拉大
     buildBush() 參數之後 kc 還是不滿意:「不夠雜而且我不想要灌木,我想要
     真的草」——問題不是尺寸,是素材本身:buildBush() 用的 tree-crown
     系列是圓頂樹冠剪影,不管怎麼調參數看起來都是「一叢修剪過的灌木球」,
     不是野草。整個換掉,不再用 buildBush()/billboard 卡片這條路,改用
     兩款真的 3D 草叢模型(grass-tall.glb/grass-01.glb,Quaternius,CC0,
     授權見 assets/models/CREDITS.md)散開種,跟 realTree() 同一套「先蓋
     灰模占位,glb 到了再替換」,但這裡刻意種得極密、極亂:尺寸 1.3~2.9
     (templeWall() 的 wallH=3,大半叢逼近甚至撐到牆高,不是勉強過半)、
     每叢隨機朝向(Math.random()*Math.PI*2,不像 bushLine() 那些灌木統一
     面朝一個方向)、沿線偏移拉到 ±2.2、間距壓到 len/.5(比第一版
     weedPatch 的 len/.7 更密)——密到叢與叢大量重疊、高矮參差不齊,
     讀起來是荒廢很久沒人管的野草地,不是照著線種的一排植栽。 */
  /* 2026-08-27,kc:「大部分要是綠色雜草」,測完發現兩款草模型的貼圖實際
     在遊戲裡都偏橘黃(grass-tall.glb 的 Grass.png 是四色橫紋,橘黃那條
     UV 佔比明顯比綠色那條大;grass-01.glb 的 Atlas.png 原本以為是純綠,
     強制全部用這款测過才發現一樣是橘黃色系,判斷錯了)。不再賭下一個
     模型的貼圖顏色,直接不用原始貼圖,材質換成幾種深淺綠色的純色
     (WEED_GREENS),只留模型的形狀(草葉輪廓、彎折),顏色 100% 保證
     是綠色,顏色深淺交錯製造自然感,不是死板同一色。 */
  const WEED_GREENS = [0x3f6b2a, 0x4a8a3f, 0x5a9c4a, 0x2f5a24, 0x6bb04f];
  function weedClump(x, z, targetSize, variant){
    const fallback = box(.6, targetSize, .6, std({ color:0x4a6b2f, roughness:.95 }));
    const holder = add(fallback, x, targetSize/2, z, true, false);
    loadModel(variant === 1 ? 'grass-tall.glb' : 'grass-01.glb').then(gltf => {
      scene.remove(holder);
      const group = propModel(THREE, gltf, targetSize, 'y', Math.random()*Math.PI*2);
      const greenMat = std({ color: WEED_GREENS[Math.floor(Math.random()*WEED_GREENS.length)], roughness:.9 });
      group.traverse(o => { if(o.isMesh) o.material = greenMat; });
      add(group, x, 0, z, true, false);
    }).catch(() => {});
  }
  function weedPatch(ax, az, bx, bz){
    const dx = bx-ax, dz = bz-az, len = Math.hypot(dx,dz);
    const steps = Math.max(1, Math.round(len/.5));
    for(let i=0; i<=steps; i++){
      const t = steps ? i/steps : .5;
      const variant = Math.random() < .5 ? 1 : 2;   // 兩款只留形狀差異,顏色已經統一由 greenMat 控制
      weedClump(ax+dx*t+(Math.random()-.5)*3.4, az+dz*t+(Math.random()-.5)*3.4, 1.3+Math.random()*1.6, variant);
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
    const roundGrass = std({ color:0x5a6b42, roughness:.96 });
    add(new THREE.Mesh(new THREE.CylinderGeometry(R,R,.3,28),
        roundGrass), cx, .17+.15, cz, false, true);
    /* 跟公園草地共用同一張 grass.png(已經有圖),不用另外生——這裡沒沿用
       公園那份 grassMat,是因為它是 buildPark() 內部局部變數,拿不到。 */
    loader.load(TEX_DIR + 'grass.png', img => {
      const t = new THREE.CanvasTexture(prep(img, { mirror:true, lift:.12 }));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3,3);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      roundGrass.map = t; roundGrass.color.setHex(0x9fb583); roundGrass.needsUpdate = true;
    }, undefined, () => {});
    realTree(cx, cz, 6);
    solid(cx, cz, R*.72, R*.72);
    lampSpots.push({ x:cx, y:4.5, z:cz, c:0xffd9a0, i:26, r:24 });
  })();

  /* ===== 街頭藝人的表演區(2026-08-20,kc:「街頭藝人要特別一點吧,要有個
   * 地方讓他演唱,要有麥克風架,要有一些路人圍觀」)=====
   * 座標刻意跟 game.html 的 BUSKER_POS 對齊——那個常數決定「人站在哪」跟
   * 「歌聲音量隨距離淡出」的中心點,這裡決定「舞台長什麼樣子」,兩個檔案
   * 本來就是分工(這座城市的靜態幾何在 scene-city3d.js、動態的人/劇情在
   * game.html),不是漏同步——如果以後要搬街頭藝人的位置,這兩處都要
   * 一起動,跟 ALLEY_WORKER 那組座標在兩個檔案各自硬寫一份是同一個既有
   * 慣例。
   * 舞台是一片圓木平台(重用 M.stallTop,攤子桌面同一張木紋貼圖,整座
   * 城市除了角色都是「灰模+AI貼圖」這套,不要為了一個舞台另開一條材質
   * 管線)。麥克風架是三段灰模疊出來的:寬底盤(穩定感)+ 細長桿 + 麥克風
   * 頭(小球),沒有找外部模型——體積小、造型單純,程序生成比找/轉一個
   * 3D 模型划算,跟遊具/垃圾桶那批小物同一個判斷。
   * 2026-08-26 第二次搬家(kc 截圖指定,搬進中華路遊藝場/阿美檳榔中間的
   * 巷口凹室,見 game.html BUSKER_POS 那則長筆記)——bx/bz 跟著改成
   * (10,23),R 沒有動:凹室淨空量出來大約 6 個單位寬,`blocked()` 的
   * 0.55 判定緩衝讓真正的牆面比量出來的邊界再寬一點,5.2 直徑的舞台放
   * 正中央還留得出一截空間,先不縮小,真的太擠再調。 */
  (function buskerStage(){
    const bx = 10, bz = 23, R = 2.6;
    add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, .3, 24), M.stallTop),
        bx, .15, bz, false, true);
    add(new THREE.Mesh(new THREE.CylinderGeometry(R+.12, R+.12, .12, 24), M.curb),
        bx, .06, bz, false, true);
    /* 麥克風架站在舞台前緣、面對巡邏路人常走的那條人行道(不是舞台正中央,
       不然會擋住街頭藝人本人站的位置——他的座標見 game.html BUSKER_POS,
       這裡往前推 .9 個單位剛好在他身前)。 */
    const micX = bx - .6, micZ = bz + .7;
    add(box(.7,.06,.7, M.metal), micX, .33, micZ, false, true);   // 三腳架簡化成一片寬底盤
    add(new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,3.1,10), M.metal),
        micX, .36+1.55, micZ, false, false);
    add(new THREE.Mesh(new THREE.SphereGeometry(.09,10,8), M.metal),
        micX, .36+3.15, micZ, false, false);
    solid(bx, bz, R*.55, R*.55);   // 只擋舞台中段,麥克風架跟舞台邊緣留給路人站
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

    /* 長椅:2026-08-14 從純色箱體組的 3D 長椅換成跟 planter/hydrant 同一套的
       照片卡片(prop-bench.png 早就生好放著,只是沒接程式——見 addProp()
       上面的說明,3/4 角度照片包不進箱體六個面,做成立起來的卡片)。
       w/h 比例照實拍長椅的內容比例配(約 1.44:1),沒圖之前退回素色卡片。 */
    /* 長椅挪到入口兩側,不要跟鞦韆同一條 z 排排站——鞦韆的碰撞箱本來就要
       撐到快 3 個單位寬,兩邊都塞東西一定會卡到入口(kc 抓到「走不進去」
       的問題)。2026-08-13 換成真 3D 遊具後,鞦韆/滑梯/翹翹板改用實際佔地
       長度反推位置(見上面 placeGltfProp() 那段),長椅位置跟著重算一次,
       每邊留至少 0.3~0.5 個單位淨空,不要憑感覺挪。 */
    addProp('bench', cx-8, cz+3, 2.6, 1.8, 0x8a6a42, 0);
    addProp('bench', x1-2.5, cz+3, 2.6, 1.8, 0x8a6a42, Math.PI);

    /* 入口兩側各放一個盆栽,呼應現實公園入口常見的做法 */
    addProp('planter', cx-gateW/2-1, z1+.5, 1.0, 1.1, 0x6a7a5a);
    addProp('planter', cx+gateW/2+1, z1+.5, 1.0, 1.1, 0x6a7a5a);

    /* 遊樂器材:2026-08-13 箱體版本改了三輪(鞦韆比例、滑梯顏色/部件、滑梯
       比例)kc 還是說「超怪」,最後 kc 自己拍板「小東西用真的 3D 是可以的」
       ——手刻箱體撐不住這種需要一眼認出細節的小物,整條街靠大量重複量體
       堆出來才划算(見 DESIGN_NOTES「美術管線」),遊樂器材不是這個情況。
       改抓 Poly Pizza(收 Google Poly 舊模型,低模風格跟這座城市的箱體美術
       搭得起來)的免費模型,CC-BY 3.0,授權見 assets/models/CREDITS.md。
       placeGltfProp() 用 propModel() 把模型縮放/置中/貼地,沒載到圖之前先用
       一塊灰色箱體佔位(跟 addProp()/bushMat 那套「沒圖不會壞」同一慣例),
       solid() 的碰撞箱獨立於視覺模型載入與否,同步先站好位置,不等非同步
       載入完成才能走路互動。
       這幾個模型是寫實比例(swing.glb 光是橫桿跨距換算就快 3 米),整個抓
       進來會塞爆這個小公園,所以 targetSize/lockAxis 不是照「身高」撐滿,
       是照「這座小公園擠得下的佔地長度」反推——鞦韆撐橫桿跨距、滑梯撐
       滑道總長、翹翹板撐板長,回推出來的高度自然比人高一截(仍然滿足
       「滑梯至少要比人高」那條硬要求),但不是寫實原始比例。下面每個
       solid() 的半寬/半深都是照 propModel() 縮放後量出來的實際佔地反推,
       不是憑感覺抓的數字,跟長椅/圍籬之間的間距見呼叫處旁的座標算式。 */
    function placeGltfProp(file, targetSize, lockAxis, sx, sz, ry, halfW, halfD){
      const fallback = box(halfW*2, targetSize, halfD*2, std({ color:0x5a6068, roughness:.7 }));
      const holder = add(fallback, sx, targetSize/2, sz, true, true);
      loadModel(file).then(gltf => {
        scene.remove(holder);
        add(propModel(THREE, gltf, targetSize, lockAxis, ry), sx, 0, sz, false, false);
      }).catch(() => {});
      solid(sx, sz, halfW, halfD);
    }

    /* 鞦韆放園區中央、離入口(z1)跟長椅都留夠距離——見上面同一段「碰撞箱
       蓋到入口」的踩坑記錄,cz 是整個園區的正中間。ry=90° 把模型原本沿
       local Z 的橫桿跨距轉到世界 X 軸,搭這座公園東西向比較寬的地形。 */
    (function swing(){
      const sx = cx, sz = cz;
      placeGltfProp('swing.glb', 6.4, 'z', sx, sz, Math.PI/2, 3.4, 2.0);
      play.push({ x:sx, z:sz, label:'鞦韆' });
    })();

    /* 滑梯:targetSize 撐的是滑道+爬梯合計的佔地長度(lockAxis='z',模型
       原始比例是等長分兩邊),不是平台高度——縮放後的高度大概 5.3 個單位,
       比角色(4)高一截,滿足「滑梯要比人高才滑得下去」那條硬要求
       (kc 抓到的問題,見這段之前的討論)。ry 決定滑道朝哪邊,目測校過。 */
    function buildSlide(sx, sz, ry){
      placeGltfProp('slide.glb', 7.5, 'z', sx, sz, ry, .82, 3.95);
      return { x:sx, z:sz, label:'滑梯' };
    }
    play.push(buildSlide(49.15, cz, 0));

    /* 翹翹板:targetSize 撐板長(lockAxis='x'),6.0 是先定「翹翹板本來該多大」
       (跟鞦韆的 6.4、滑梯的 7.5 同一個量級),不是先看縫隙多寬反推——上一版
       3.6 就是反過來做的,結果 kc 說「太細太小」。轉 90 度(ry)讓板子長邊
       改沿南北向,東西向只占鞦韆右邊原本就有的空隙,不會逼近長椅。 */
    function buildSeesaw(sx, sz, ry){
      placeGltfProp('seesaw.glb', 6.0, 'x', sx, sz, ry, 1.7, 3.2);
      return { x:sx, z:sz, label:'翹翹板' };
    }
    play.push(buildSeesaw(59.6, cz, Math.PI/2));

    realTree(x0+2.2, z0+2.2, 5);
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
      } else if(s.proto && shopFront(s.kind, s.bodyIdx)){
        /* 單一店面試做「有厚度」的版本,先不動其他店——比較效果用,見上面 richStoreFront。 */
        richStoreFront({ axis, face, fX, fZ, faceW, photoMat: shopFront(s.kind, s.bodyIdx) });
      } else {
        const lit = s.kind === 'store';
        const photo = shopFront(s.kind, s.bodyIdx);
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
        /* food-5(豆漿)是 kc 故意生的直式招牌(sign-food-5.png,1024×1536),
           跟其他招牌共用的三款橫式輪替(style 0~2,見下面 else 分支)硬套會被
           signImage() 的置中裁切吃掉大半直式文字。這裡照圖片實際比例
           (1024/1536≈0.667)另外開一個窄高的箱體,不吃 style 輪替。 */
        const SIGN_OVERRIDE = { 'food-5': { along:2.0, vertH:3.0, y:8.0, emissiveK:1 } }[s.signKey];
        let along, vertH, y, emissiveK, alongOff = 0;
        if(SIGN_OVERRIDE){ ({along,vertH,y,emissiveK} = SIGN_OVERRIDE); }
        else if(ART){ ({along,vertH,y,emissiveK} = ART); }
        else {
          const style = (i*7 + txt.length) % 3;
          along = [alongW-7.4, alongW-5.2, alongW-6.4][style];
          /* 2026-08-14 kc 抓到:這三款 vertH 是 along/vertH≈1.53 的舊設定,沒拿
             真的招牌圖驗證過。實際生出來的食物攤招牌(sign-food-*.png)是滿版無黑邊、
             實測 along/vertH≈2.0(見上面 store/drug 那段「量測非黑色範圍」的同一套
             方法),差了快 25%,裁切會吃掉左右快一成二的字。縮小 vertH 貼近 2.0,
             along(店面寬度 footprint)不動。 */
          vertH = [2.1, 3.2, 2.6][style];
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

        /* 騎樓頂下面那支日光燈。沒有它騎樓底下全黑,鐵捲門跟店門都看不見。
           全部一樣亮會像機場走廊——每七間壞一支,冷白暖白混著,才像有人在管跟沒人在管
           的店混在同一條街上。強度小、範圍小,不會搶掉招牌。
           2026-08-13 kc 抓到:這支燈原本跟上面的雨遮不同一個 if 區塊,騎樓大砍之後
           大多數店沒有雨遮了,這支燈卻還照樣點,變成浮在半空中沒有東西掛著的光管——
           挪進 !noArcade 裡面,燈只在真的有雨遮可以掛的店才出現。 */
        const tX = fX + (axis==='z'?face*1.9:0), tZ = fZ + (axis==='x'?face*1.9:0);
        const tubeW = axis==='x' ? alongW-3.4 : .16, tubeD = axis==='x' ? .16 : alongW-3.4;
        const dead = (i*5)%7 === 3;
        const warm = (i*3)%5 < 2;
        const cLamp = warm ? 0xf2e3c0 : 0xdfe8f0;
        add(box(tubeW, .12, tubeD,
                dead ? std({color:0x555b60,roughness:.7}) : glow(cLamp, 1.05)),
            tX, 5.06, tZ, false, false);
        if(!dead) lampSpots.push({ x:tX, y:4.9, z:tZ, c:cLamp, i:warm?11:10, r:13 });
      }
    });
  }

  /* 店名。台灣街的辨識度幾乎全在招牌那幾個字上,同類型的店輪流換名字,
     整條街才不會像同一間開了八家。 */
  const FOOD = ['魯肉飯','切仔麵','鹹酥雞','自助餐','熱炒','豆漿'];
  const BETEL = ['檳榔','阿美檳榔','雙葉檳榔'];
  /* 網咖、遊藝場(2026-08-14 kc 定案)都只留 1 間,不比照 FOOD/BETEL 開陣列——
     街上 slot 數本來就只有 1 個,不需要備用店名。 */
  let nFood = 0, nBetel = 0;
  const S = {
    sh:{kind:'shutter'}, gap:{kind:'gap'},
    food:(c,proto)=>{ const n = nFood++ % FOOD.length;
      return { kind:'food', sign:c||0xd94a35, text:FOOD[n], signKey:'food-'+n, bodyIdx:n, proto:!!proto }; },
    betel:()=>{ const n = nBetel++ % BETEL.length;
      return { kind:'betel', sign:0x5ce08a, text:BETEL[n], signKey:'betel-'+n, bodyIdx:n }; },
    net:()=>({kind:'net',sign:0x4fc8f0,text:'網咖',signKey:'net'}),
    /* id/label(2026-08-26)——遊藝場原本純外觀(顧場子任務只用得到門口
       座標當視覺地標),這輪 kc 要求「裡面可以走進去玩小遊戲」,補上 id
       讓 row() 那段既有的 `if(s.id) doors.push(...)` 自動把它算進
       city.doors,跟 store/home/school 走同一條 enterIndoor() 路徑,不用
       另外開一套進場機制。 */
    arcade:()=>({kind:'arcade',sign:0xff4fa0,text:'遊藝場',signKey:'arcade',id:'arcade',label:'遊藝場'}),
    moto:()=>({kind:'moto',sign:0x3f8fd8,text:'機車行',signKey:'moto'}),
    drug:()=>({kind:'drug',sign:0x35b06a,text:'藥局',signKey:'drug'})
    /* 醫院原本在這裡當 row() 店面(2026-09-03),2026-09-04 改成獨立建築
       (hospitalCompound(),見下面 row() 之後),不再是 S 底下的一個 shop
       kind,S.hospital() 已經拿掉。 */
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
  /* 廟口路那排店整組刪掉了(2026-08-21,kc:「外面那些實體下城建築刪掉」)
     ——上一輪才剛把 at 從寫死的舊路口(-78)修成跟著新路口(-84+B_LINE)
     走,結果 kc 從廟埕裡看,這排真建築(有窗戶/冷氣機/真貼圖)還是從矮牆
     後面探出頭,判定是矮牆(3.2 高)加上緊鄰城市這個組合本身有問題,連
     同上面的圍牆一起整組拿掉。這排原本是 10 個 shop slot(S.sh/S.food/
     S.betel/S.drug 混搭,沒有 id,不是任務相關的固定店家),刪掉不影響
     其他劇情/任務邏輯。之後要重新決定廟口路這一段要不要蓋房子、蓋多遠,
     跟圍牆一起再議。 */
  /* ===== 後火車站:商業大樓區 + 學校 + 火車站(2026-08-26,kc:「這區應該是
     商業大樓區,而非住宅區,然後學校跟火車站不應該是這種死板的方塊,應該要
     跟公園一樣獨立設計」+「這三塊就是最後那一整排」)=====
     整條街原本用 row() 那套「箱體 3~5 層+鐵捲門/店面貼圖」的住宅店面美術
     (跟中華路同一套,學校原本也只是這排裡的一格,還沒補 shop-school.png
     就退回素色箱體)。整排拆掉換成 backStation():辦公大樓(玻璃帷幕,材質
     色調做出效果,不用等貼圖)+ 學校(圍牆+校門,獨立輪廓)+ 火車站(全新
     地標,原本只是路名沒有真的建築)。跟 park() 同一套「灰模+材質」做法,
     不找外部模型(見 DESIGN_NOTES「美術管線」)。
     佈局(沿用原本這排的 z 基準 84-B_LINE=62.5,face=1 面朝 +z 那側的
     人行道/馬路):
     - 學校中心維持在 x=-36(city.doors 'school' 這個 id、門口座標大家已經
       在用,不搬家),深度維持一般建築的 DEPTH(57~68),避免跟 x=-36 那條
       直巷 alley() 的既有終點(z:57)打架——這條巷子本來就是「走到這排
       建築背牆為止」,沒有多留深度給它。
     - x≈48 那格維持空地——小美哥(BROTHER)固定站位在那(見 game.html
       BROTHER 定義),不要蓋房子擋住他,也是斜巷 alleyDiag() 的終點
       (12,27)→(48,57)。
     - 火車站擺中段(x≈4,整條街視覺焦點)。
     - 其餘範圍蓋辦公大樓,5 棟,高度用索引錯開(45/55/65 個單位,約
       15~22 樓),比原本店面(17~27 個單位,2~4 樓)高得多才有大樓感。
     一樓大廳/校名牌/站名牌這類「一眼認出是什麼」的字卡,先用純色色塊
     佔位,之後 kc 生圖再補(跟其他店家先例一致,這輪先告訴 kc 需要哪幾張
     圖,不硬等)。 */
  (function backStation(){
    const rowZ = 84 - B_LINE, front = rowZ + DEPTH/2;   // 62.5 / 68——沿用原本這排的基準跟街面線

    /* 辦公大樓(2026-08-26 v3,方向整個重來)——先後踩過兩個坑,都是 kc
       糾正的:
       1.「為何大門口會發光」——一樓大廳暖光原本是 M.glassLit(招牌級亮度)
         疊一顆強 lampSpot,玩家走近就過曝死白,後來改貼真照片解決。
       2.「你要給真實比例,不然上面會貼不到」——照片只貼了裙樓(8 個單位),
         上面塔樓段還是素色,晚上幾乎全黑,大樓像是裙樓以上直接消失;
         改成裙樓貼「入口」裁圖、塔樓貼「單層樓窗花」裁圖重複拼貼,結果
         kc 再次打回票:「要整棟大樓懂嗎,不然上面沒圖啊,就跟之前住宅區
         一樣」——重複拼貼一小塊窗花,讀起來跟 M.wall 那種磚牆貼圖重複
         鋪滿是同一個「假」問題,不是真的在看一棟大樓。
       改成跟學校同一套做法:每棟樓用**一張涵蓋整棟正面**的完整照片,不
       裁、不重複拼貼。原本 5 棟細長塔樓(寬 10、高 45~65,寬高比
       1:4.5~1:6.5)這種比例 AI 生不出來,改成 3 棟比較寬的樓(寬 14~18、
       統一高度 50,寬高比落在 1:2.8~1:3.6,比較接近生圖工具的直式比例
       上限),數量少但量體更實在。三棟各自一張不同材質的整棟大樓照片
       (kc 還沒生完,先用素色佔位,圖到了再換,見下面 TOWERS 那個表)。
       三個位置卡在學校(x:-48~-24)、火車站(x:-8~16)、小美哥固定站位
       (x≈48 那格,不能蓋房子擋住他)這三個既有地標中間,見各自 x/w
       旁邊的間隙備註。 */
    /* 三張整棟大樓照片(2026-08-26,kc 生的)——1/2 已經到位,都是去背
       RGBA(前兩張同一棟深藍灰玻璃帷幕,一張白底一張去背,用去背那張;
       第三張古銅色帷幕),材質要開 transparent 不然去背邊緣會出現黑邊。
       第三棟(淺灰石材)kc 還沒生,file 指到一個目前不存在的檔名,圖片
       404 會靜默失敗、維持素色佔位,之後補圖不用改這裡的程式碼。 */
    const TOWERS = [
      { x:-58, w:18, file:'office-tower-1.png', sideFile:'office-tower-1-side.png', color:0x8a97a0 },   // 西側,學校西邊到街區邊界那段——深藍灰玻璃帷幕。側面 2026-08-27 補上(kc 生的圖一開始被誤放成大樓3正面,kc 糾正「我給你的是側面」才發現配對錯,原始生圖同樣左右留了近 30% 黑邊,裁法跟大樓3那次一樣)
      { x:-16, w:14, file:'office-tower-2.png', sideFile:'office-tower-2-side.png?v=2', color:0xb08858 },   // 學校跟火車站中間,只有 16 寬的窄縫,樓也窄一點——古銅色帷幕,側面 v2(2026-08-26,kc:「他是大樓二」,原本以為 v2 那張是大樓一,修正)
      { x:28,  w:18, file:'office-tower-3.png', sideFile:'office-tower-3-side.png?v=2', color:0xc8c4ba }    // 火車站跟小美哥站位(x≈48)中間——淺灰石材。正面+側面 2026-08-27
      // 同一輪重生(kc 一次生兩張,一張真的填滿畫面、一張側面又留了黑邊,裁法
      // 跟前面幾次一樣),側面加 ?v=2 破快取,取代掉先前那張磁磚特寫拉伸版。
    ];
    TOWERS.forEach(cfg => {
      const h = 50, w = cfg.w, d = DEPTH;
      const towerSideA = std({ color:cfg.color, roughness:.7 });   // +x 面
      const towerSideB = std({ color:cfg.color, roughness:.7 });   // -x 面(跟 A 鏡射,見下面說明)
      /* transparent:true 拿掉了(2026-08-26,kc:「你貼圖比例真的有破圖,
         你貼超過」)——底部那條深藍色不是位置貼歪,是去背照片(office-
         tower-1/2.png 是 RGBA)邊緣殘留的半透明像素在 transparent:true
         材質上直接跟場景背景色(深藍夜空)混色穿透。這幾張圖本來就是
         「整棟樓填滿畫面」的構圖,沒有真的需要透明的地方,材質改成不透明
         (忽略 alpha 通道),邊緣殘留的半透明像素只會顯示自己的 RGB 顏色,
         不會透到背景。 */
      const towerFront = std({ color:cfg.color, roughness:.7 });
      new THREE.ImageLoader().load(TEX_DIR + cfg.file, img => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        const targetAspect = w/h, ia = img.width/img.height;
        if(ia > targetAspect){ const r = targetAspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2,0); }
        else { const r = ia/targetAspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
        t.needsUpdate = true;
        towerFront.map = t; towerFront.color.setHex(0xffffff); towerFront.needsUpdate = true;
      }, undefined, () => {});   // 圖還沒生的話載入會 404,靜默失敗,維持素色佔位
      /* 側面(2026-08-26 v2,kc:「側面完全沒貼準,側面貼圖不能用重複的
         也要一樣高度,不然一樓會對不起來」)——v1 是正方形純材質重複拼貼
         (跟學校側牆同一招),結果側面樓層高度、一樓入口高度都跟正面那張
         「真實整棟樓照片」對不上,轉角處接不起來。改成跟正面同一招:
         kc 拿正面照片當參考重生了「同一棟樓的側面」(樓層數/一樓入口
         高度比例對齊正面),裁切不拉伸、不重複,side 面寬深比是 d:h
         (11:50,三棟大樓深度一樣所以比例都一樣)。
         **v3(同一天,kc:「你要水平翻轉再貼,不然前後會顛倒」)**——
         BoxGeometry 的 +x/-x 兩個側面 UV 方向天生相反,同一張材質不做
         任何調整直接指定給兩側,會有一側把照片裡「入口/大廳那端」貼到
         建築的後段去(前後顛倒)。改成兩側各自一顆材質,B 面(-x)在
         裁完之後額外把 repeat.x 取負、offset.x 對應補上 1,做水平翻轉,
         這樣兩側看到的入口端都對齊建築真正的正面(rowZ+DEPTH/2 那端),
         不會一側對一側不對。 */
      if(cfg.sideFile){
        new THREE.ImageLoader().load(TEX_DIR + cfg.sideFile, img => {
          const targetAspect = d/h, ia = img.width/img.height;
          let r, off;
          if(ia > targetAspect){ r = targetAspect/ia; off = (1-r)/2; }
          else { r = 1; off = 0; }   // ia<=targetAspect 這批圖用不到(現有側面圖都偏窄長),先只處理寬邊裁切這條路徑
          const ry = ia > targetAspect ? 1 : (ia/targetAspect);
          const offy = ia > targetAspect ? 0 : (1-ry)/2;

          /* v4(2026-08-27,kc:「你側面貼反了,兩邊都要水平翻轉」)——v3 猜的
             UV 奇偶對調(A 不翻/B 翻)兩面看起來都是反的,不是只有一面錯。
             實際要的方向剛好對調:A 翻、B 不翻,直接互換原本 v3 的兩組
             repeat/offset 公式。 */
          const tA = new THREE.Texture(img);
          tA.colorSpace = THREE.SRGBColorSpace; tA.anisotropy = 4;
          tA.repeat.set(-r, ry); tA.offset.set(off + r, offy);
          tA.needsUpdate = true;
          towerSideA.map = tA; towerSideA.color.setHex(0xffffff); towerSideA.needsUpdate = true;

          const tB = new THREE.Texture(img);
          tB.colorSpace = THREE.SRGBColorSpace; tB.anisotropy = 4;
          tB.repeat.set(r, ry); tB.offset.set(off, offy);
          tB.needsUpdate = true;
          towerSideB.map = tB; towerSideB.color.setHex(0xffffff); towerSideB.needsUpdate = true;
        }, undefined, () => {});
      }
      add(box(w,h,d, [towerSideA,towerSideB,towerSideA,towerSideA,towerFront,towerSideA]), cfg.x, h/2, rowZ);
      solid(cfg.x, rowZ, w/2, d/2);
      /* 「一樓大廳暖光」那塊獨立道具(2026-08-26,kc:「這板子是幹啥的」)
         ——整棟樓改貼真照片之後,照片本身就有大廳暖光的畫面,這塊卡片
         變成純粹擋在照片前面的多餘東西,直接刪掉。 */
    });

    /* 學校:x:[-48,-24](24 寬,兩個店面格的量體),z 維持一般建築深度
       57~68(理由見上面「佈局」筆記,不要跟直巷 alley() 打架)。矮圍牆
       沿輪廓走,街面那一側(z=front)留 4 寬的校門缺口,跟 park() 的
       hedgeSeg()/入口留白同一套做法。教學大樓退到後段(z 偏小,離街遠
       一點),前段留校門內的空地。 */
    (function school(){
      const x0=-48, x1=-24, z0=rowZ-DEPTH/2, z1=front, gateW=6, gx=-36;   // gateW 4→6(2026-08-26,kc:「門寬一點」)
      const fenceH = 2.4;
      /* 矮牆顏色(2026-08-26,kc 給的校門設計示意圖「矮牆(淺灰)」swatch)——
         原本 0xb8b2a2 偏米黃,換成示意圖標的淺灰,跟門柱/橫樑那組灰階
         一致。 */
      const fence = std({ color:0xc4c4c0, roughness:.9 });
      const fenceSeg = (w,d,x,z) => { add(box(w,fenceH,d, fence), x, fenceH/2, z); solid(x,z,w/2,d/2); };
      fenceSeg(x1-x0, .4, (x0+x1)/2, z0);                       // 後牆
      fenceSeg(.4, z1-z0, x0, (z0+z1)/2);                       // 西牆
      fenceSeg(.4, z1-z0, x1, (z0+z1)/2);                       // 東牆
      const sideW = (x1-x0-gateW)/2;
      fenceSeg(sideW, .4, x0+sideW/2, z1);                      // 校門左半
      fenceSeg(sideW, .4, x1-sideW/2, z1);                      // 校門右半

      const bW=20, bH=26, bD=7, bz=z0+bD/2+1.2;
      /* 教學大樓外牆貼圖(2026-08-26,kc 生的照片,1086×1448≈0.75:1,跟
         建築正面 20×26≈0.769:1 幾乎同一個比例,裁切量很小)。只有正面
         (+z,BoxGeometry 材質陣列 index4)貼照片,其餘五面維持素色,理由
         跟 row() 店面箱體側面同一條——貼圖被拉伸貼滿六面,側面會糊成一圈
         怪異拉伸感。跟 alleyWallMaterial() 同一招:材質先建好占位(素色),
         圖異步載入完成才套 map,不卡場景初始化。
         **v2(同一天,kc:「大樓貼圖就是純大樓,植物是用真的3d素材」)**——
         這張照片下緣烤了一截草地+灌木叢進去,直接貼滿整面牆會讓灌木變成
         貼在牆上的平面貼紙。裁掉下緣約 15%(repeat.y/offset.y),只用
         上面純建築立面那段,真正的灌木改用下面 bushLine() 補(跟 park()
         那圈籬笆灌木同一套技法,見 feedback_bush_billboard_technique
         那則記憶——3 片 60° 卡片,不是兩片十字)。下次生這張圖的 prompt
         要明講「純建築,不要草地/灌木/前景雜物」,不用再裁。 */
      /* **v3(同一天,kc:「側面是不是也要貼圖」)**——這棟是獨立地標,不像
         一般排屋兩側被鄰居擋住,側面(±x,材質陣列 index0/1)真的看得到,
         值得貼。
         **v4(同一天,kc:「很怪,感覺側面要是純材質圖」)**——v3 那版是從
         正面照片裁一條窄的貼上去,裁到窗戶/陽台的局部碎片,拼不成一面
         合理的側牆,看起來很怪。改成真正的「純材質」磁磚貼圖,均勻連續
         的米白色磚紋,沒有窗戶/陽台這類具體建築細節,本來就是設計來重複
         拼貼的,用 RepeatWrapping 真的貼滿側面(不是裁一塊塞滿,是讓紋理
         重複),side 寬深比 bD:bH=7:26,repeat 抓 (1,4) 大致對到磚紋本身
         的密度,看起來像磁磚牆材質本身,不是某張照片的局部。
         **v5(同一天,kc 換了一版磚紋更明顯的貼圖重生)**——同一個檔名
         覆蓋(`school-wall-side.png?v=2`,1086×1448),接法不用改,只是
         破一下快取。 */
      const schoolWallSide = std({ color:0xb8b2a4, roughness:.9 });
      const schoolWallFront = std({ color:0xb8b2a4, roughness:.9 });
      const schoolWallSideX = std({ color:0xffffff, roughness:.9 });
      new THREE.ImageLoader().load(TEX_DIR + 'school-wall.png', img => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        t.repeat.set(1,.85); t.offset.set(0,.15);   // 裁掉下緣 15%(草地/灌木那截)
        t.needsUpdate = true;
        schoolWallFront.map = t; schoolWallFront.color.setHex(0xffffff); schoolWallFront.needsUpdate = true;
      }, undefined, () => {});
      new THREE.ImageLoader().load(TEX_DIR + 'school-wall-side.png?v=2', img => {
        const ts = new THREE.Texture(img);
        ts.colorSpace = THREE.SRGBColorSpace; ts.anisotropy = 4;
        ts.wrapS = ts.wrapT = THREE.RepeatWrapping; ts.repeat.set(1,4);
        ts.needsUpdate = true;
        schoolWallSideX.map = ts; schoolWallSideX.needsUpdate = true;
      }, undefined, () => {});
      add(box(bW,bH,bD, [schoolWallSideX,schoolWallSideX,schoolWallSide,schoolWallSide,schoolWallFront,schoolWallSide]), gx, bH/2, bz);
      solid(gx, bz, bW/2, bD/2);
      bushLine(gx-bW/2+1.5, bz+bD/2+.3, gx+bW/2-1.5, bz+bD/2+.3);   // 大樓正面地面真的灌木叢,不是烤進貼圖裡那截
      /* 校門(2026-08-26,kc:「學校前面的板子應該改做成一個校門」)——原本
         只是一塊立牌,改成真的校門:兩根門柱夾住校門缺口,上面一根橫樑,
         校名牌掛在橫樑上(貼圖見下面)。
         **v2(同一天,kc:「門太低矮了啦,而且招牌太小又卡在裡面」)**——
         postH 4.2→7(角色身高約 4 個單位,原本的門柱只比人高一點點)。
         **v3(同一天,kc 給了一張校門設計示意圖+一張去背的新招牌圖)**——
         照示意圖五個標號重做:①橫樑維持,顏色改成示意圖標的「水泥橫樑
         (淺灰)」;②門柱加粗(postW .9→1.3)、顏色改成「米白色磁磚」
         那個色調(跟教學大樓貼圖色調呼應,不是重貼同一張會露餡的照片,
         只是顏色一致);③新增雙開鐵門,填滿校門缺口,顏色「鐵門(深綠灰)」
         ——玩家不需要真的走過門柱之間那個缺口(city.doors 的觸發點在
         z1+2.4,已經在鐵門外側的人行道上),鐵門做實心不影響互動;
         ④矮牆延伸維持(見上面 fence 那則筆記,顏色也對到「矮牆(淺灰)」);
         ⑤細節質感(磁磚污漬/鏽蝕)這輪不做程序化風化,交給貼圖本身的
         寫實感撐。招牌換成 kc 重生的去背版(`school-sign.png?v=2`,RGBA
         透明背景,2170×725≈3:1,套 transparent 材質才不會把黑底一起
         貼上去)。 */
      const gatePost = std({ color:0xe8e2d4, roughness:.9 });      // 米白色磁磚色調
      const postH = 7, postW = 1.3;
      [gx-gateW/2, gx+gateW/2].forEach(px => {
        add(box(postW,postH,postW, gatePost), px, postH/2, z1-.3);
        solid(px, z1-.3, postW/2, postW/2);
      });
      add(box(gateW+postW,.7,postW, std({ color:0xb4b4ae, roughness:.85 })), gx, postH+.35, z1-.3);   // 橫樑,水泥淺灰

      /* 雙開鐵門(2026-08-26 v4,kc:「你沒有做鐵門啊」)——v3 那版是一整塊
         實心色板,跟旁邊矮牆同一個調調,遠看看不出是「門」,讀起來就是
         牆的延伸。改成真的欄杆結構:上下橫桿夾一排直鐵條,中間留缝隙,
         才有鐵柵門該有的「看得穿」視覺特徵。寬度改抓兩根門柱內側的淨空
         (gateW-postW),v3 那版寬度算錯,伸進了門柱本體裡。
         **v5(同一天,kc:「門寬一點,是雙門的感覺」)**——gateW 4→6(見上面
         宣告那行);v4 那版雖然叫「雙開鐵門」,視覺上其實是一整排連續的
         鐵條,看不出「兩扇門」的接縫。改成真的兩片獨立門葉,各自有自己的
         上下橫桿+4 根鐵條,中間留一根較粗的直桿當接合處,兩片之間再留一條
         窄縫——這樣才讀得出「兩扇門在中間合起來」,不是一整排等距鐵條。 */
      const gateDoor = std({ color:0x3c4a44, roughness:.55, metalness:.25 });
      const gInner = gateW - postW, gz = z1-.15, gy0 = .2, gy1 = postH-.6;
      const leafW = gInner/2 - .15, leafGap = .3, barPerLeaf = 4;
      [-1,1].forEach(side => {
        const lc = gx + side*(leafW/2 + leafGap/2);
        add(box(leafW,.18,.16, gateDoor), lc, gy0+.09, gz, false, true);   // 這扇門的底橫桿
        add(box(leafW,.18,.16, gateDoor), lc, gy1-.09, gz, false, true);   // 這扇門的頂橫桿
        for(let i=1;i<=barPerLeaf;i++){
          const bx = lc - leafW/2 + leafW*i/(barPerLeaf+1);
          add(box(.1,gy1-gy0-.2,.1, gateDoor), bx, (gy0+gy1)/2, gz, false, true);
        }
      });
      add(box(.18,gy1-gy0,.2, gateDoor), gx, (gy0+gy1)/2, gz, false, true);   // 中縫接合處,比一般鐵條粗
      solid(gx, gz, gInner/2, .15);

      /* 校名招牌貼圖(2026-08-26,kc 重生的去背版,2170×725≈3:1,RGBA
         透明背景——material 要開 transparent,不然黑底會一起貼上去)。
         **v4(同一天,kc:「招牌太裡面」)**——門柱加粗(postW→1.3)之後
         橫樑跟著變厚,前緣推到 z1+.35,原本招牌 z1+.2 反而被吃進橫樑
         深度裡面,看起來卡在裡面。往前推到 z1+.6,清楚露在橫樑正面外。
         **v5(同一天,kc:「招牌要滿版」)**——用 PIL 量過這張去背圖,實際
         招牌內容只佔畫布 (63,96)-(2107,665)(2170×725 裡面),四周留了
         一圈透明邊,直接貼滿整面板子會讓招牌看起來縮在中間、四周有一圈
         空白,不是滿版。用 repeat/offset 裁掉那圈透明邊,只取真正有內容
         的範圍貼滿板子。 */
      const schoolSignMat = std({ color:0xffffff, roughness:.5, transparent:true });
      new THREE.ImageLoader().load(TEX_DIR + 'school-sign.png?v=2', img => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        t.repeat.set(.942,.785); t.offset.set(.029,.083);
        t.needsUpdate = true;
        schoolSignMat.map = t; schoolSignMat.needsUpdate = true;
      }, undefined, () => {});
      add(box(gateW+1.4,1.8,.15, schoolSignMat), gx, postH+.35, z1+.6, false, true);   // 校名牌,橫跨兩根柱子、貼在橫樑正面外側
      const pole = std({ color:0xaaaaaa, roughness:.4, metalness:.3 });
      add(box(.18,7,.18, pole), gx-3, 3.5, z1-2);                // 旗桿
      realTree(x0+2.5, z1-2, 5);
      realTree(x1-2.5, z1-2, 5);
      lampSpots.push({ x:gx, y:4, z:z1-1, c:0xfff2d8, i:14, r:14 });
      landmarks.push({ x:gx, y:bH+1, z:bz, text:'高中' });
      doors.push({ id:'school', name:'高中', x:gx, z:z1+2.4 });   // 沿用 row() 原本算出來的門口座標(-36, 70.4)
    })();

    /* 公車亭(2026-09-01,第四輪)——kc 看了前一輪(復原成火車站原始座標)
       之後說「不是用舊版本 是要改成圖片的版本 要嚴格參考這個感覺」+
       兩個具體結構問題:「會有兩排柱子」「柱子跟屋頂應該是在底座內」。
       前一輪把「復原舊版」當成目標是理解錯了——kc 真正要的一直是那張
       參考圖的結構,舊版 trainStationV2 只是拿來說明「不要每輪偷改骨架」
       的反例,不是真的要蓋回火車站。這輪把材質做得不錯的那版(canvas
       貼圖,commit 5422f57)找回來,疊上兩個結構修正:柱子改成前後兩排
       (不是一排),雨遮跟柱子整組往月台內側收(margin 內縮,不再貼齊或
       超出月台邊緣)。細節見 docs/DESIGN_NOTES.md「公車亭兩排柱子+內縮
       結構(第四輪)」節。 */
    (function busStop(){
      const cx = -36;                              // 對齊學校校門 gx,沿用舊站位置
      const rowZn = 84 + B_LINE, frontN = rowZn - DEPTH/2;   // 105.5 / 100,跟辦公大樓/警察局同一條建築線
      /* 2026-09-01,kc:「站長室拿掉」——東端原本留給站務室的 officeW(6)
         沒有跟著拿掉,L 維持 32(開放候車區 26 + 東端空出來的 6),避免
         拿掉站務室之後連帶把雨遮/柱子/月台寬度也跟著改(kc 一再糾正的
         「不要偷改沒被要求的東西」),東端現在就是雨遮下的空地,沒有
         建築,人可以直接走過去。 */
      const L = 32, openW = 26;
      const platD = 7, platH = .3;
      const setback = 1;
      const nearZ = frontN + setback;               // 底座(月台)最靠馬路那一側
      const farZ  = nearZ + platD;                  // 底座最靠裡那一側
      const platCz = (nearZ+farZ)/2;
      const xW = cx - L/2, xE = cx + L/2;            // 西端(招牌)/東端(原站務室,現在空著)
      const openCx = xW + openW/2;
      const postH = 9, canopyT = .5;

      /* 柱子/屋頂內縮量:雨遮跟兩排柱子的footprint 比底座(platD)小
         margin*2,底座邊緣露出一圈(月台前緣多留走道、後緣多留跟牆的
         距離),不是雨遮/柱子直接貼齊或超出底座邊界(kc:「柱子跟屋頂
         應該是在底座內才對」)。 */
      const margin = 1;
      const frontRowZ = nearZ + margin;             // 前排柱子(靠馬路那排)
      const backRowZ  = farZ - margin;               // 後排柱子(靠牆那排)
      const wallZ = backRowZ + .15;                  // 背牆貼在後排柱子後面一點點

      const busStopGroup = new THREE.Group();
      scene.add(busStopGroup);
      busStopRef.group = busStopGroup;
      const addG = (mesh,x,y,z,cast,recv) => {
        mesh.position.set(x,y,z);
        mesh.castShadow = cast !== false; mesh.receiveShadow = recv !== false;
        busStopGroup.add(mesh); return mesh;
      };

      const mkTex = (w,h,draw,rx,ry) => {
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        draw(c.getContext('2d'), w, h);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        if(rx||ry){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx||1, ry||1); }
        t.needsUpdate = true;
        return t;
      };
      const rnd = (seed => () => (seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff)(7);
      const speckle = (ctx,w,h,n,alpha,tone) => {
        for(let i=0;i<n;i++){
          ctx.fillStyle = `rgba(${tone},${tone},${tone},${alpha*rnd()})`;
          ctx.fillRect(rnd()*w, rnd()*h, 1+rnd()*2, 1+rnd()*2);
        }
      };

      const roofTex = mkTex(128,32,(ctx,w,h)=>{
        ctx.fillStyle='#1e3a5f'; ctx.fillRect(0,0,w,h);
        for(let x=0;x<w;x+=8){ ctx.fillStyle = x%16===0 ? '#28507f' : '#193150'; ctx.fillRect(x,0,4,h); }
        ctx.fillStyle='rgba(180,190,200,.12)';
        for(let i=0;i<10;i++) ctx.fillRect(rnd()*w, 0, 1, h);
        ctx.fillStyle='rgba(20,20,20,.15)';
        for(let i=0;i<6;i++){ const bx=rnd()*w, by=rnd()*h; ctx.beginPath(); ctx.ellipse(bx,by,6,3,0,0,7); ctx.fill(); }
      }, Math.round((L-margin*2)/4), 2);
      const canopyMat = std({ color:0xffffff, map:roofTex, roughness:.82 });

      const postTex = mkTex(16,64,(ctx,w,h)=>{
        ctx.fillStyle='#c7c9c4'; ctx.fillRect(0,0,w,h);
        ctx.fillStyle='rgba(255,255,255,.25)';
        for(let x=0;x<w;x+=3) ctx.fillRect(x,0,1,h);
        ctx.fillStyle='rgba(120,90,60,.35)';
        ctx.fillRect(0,h-10,w,10);
        speckle(ctx,w,h,40,.15,90);
      }, 1, Math.round(postH/.3));
      const postMat = std({ color:0xffffff, map:postTex, roughness:.6, metalness:.35 });

      const tactileTex = mkTex(32,8,(ctx,w,h)=>{
        ctx.fillStyle='#e2ab34'; ctx.fillRect(0,0,w,h);
        ctx.fillStyle='#c98f22';
        for(let x=1;x<w;x+=3) ctx.fillRect(x,1,1.4,h-2);
      }, Math.round(L/2), 1);
      const yellow = std({ color:0xffffff, map:tactileTex, roughness:.65 });

      const wallTex = mkTex(64,64,(ctx,w,h)=>{
        ctx.fillStyle='#141f38'; ctx.fillRect(0,0,w,h);
        ctx.fillStyle='rgba(0,0,0,.2)';
        for(let i=0;i<8;i++) ctx.fillRect(rnd()*w,0,2,h*(.4+rnd()*.6));
        speckle(ctx,w,h,60,.06,200);
      }, Math.round(openW/6), Math.round((postH-.2)/6));
      /* 深藍色大板子(背牆)改透明壓克力(2026-09-01,kc:「不是公告牌
         是深藍色的大板子」——上一輪誤把「公告的板子」理解成 4 張小資訊
         牌,kc 指的其實是這片整面的背牆)。transparent+低 roughness 做
         出壓克力光澤感,存進 busStopRef.wall 給 __dbg.tweakBusStopWall()
         滑桿即時調 opacity/roughness。 */
      const wallMat = std({ color:0xffffff, map:wallTex, roughness:.15, metalness:0, transparent:true, opacity:.55 });
      busStopRef.wall = wallMat;

      const tileTex = mkTex(32,32,(ctx,w,h)=>{
        ctx.fillStyle='#aeb2ac'; ctx.fillRect(0,0,w,h);
        ctx.strokeStyle='rgba(70,74,70,.5)'; ctx.lineWidth=1;
        ctx.strokeRect(1,1,w-2,h-2);
        speckle(ctx,w,h,50,.1,60);
      }, Math.round(L/1.5), Math.round(platD/1.5));
      const platformTopMat = std({ color:0xffffff, map:tileTex, roughness:.8 });
      const concreteSideTex = mkTex(64,16,(ctx,w,h)=>{
        ctx.fillStyle='#55584f'; ctx.fillRect(0,0,w,h);
        ctx.fillStyle='rgba(0,0,0,.25)';
        for(let i=0;i<10;i++) ctx.fillRect(rnd()*w,0,1,h);
        ctx.fillStyle='rgba(0,0,0,.3)';
        ctx.fillRect(0,h-3,w,3);
      }, Math.round(L/4), 1);
      const platformSideMat = std({ color:0xffffff, map:concreteSideTex, roughness:.9 });
      const concrete = [platformSideMat,platformSideMat,platformTopMat,platformSideMat,platformSideMat,platformSideMat];

      const benchTex = mkTex(64,16,(ctx,w,h)=>{
        ctx.fillStyle='#5a3d24'; ctx.fillRect(0,0,w,h);
        for(let y=0;y<h;y+=4){ ctx.fillStyle = y%8===0 ? '#6e4c2c' : '#4c331e'; ctx.fillRect(0,y,w,2); }
        speckle(ctx,w,h,30,.1,30);
      }, 3, 1);
      const benchMat = std({ color:0xffffff, map:benchTex, roughness:.7 });

      const binTex = mkTex(32,40,(ctx,w,h)=>{
        ctx.fillStyle='#2f5a3c'; ctx.fillRect(0,0,w,h);
        ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fillRect(0,0,w,4);
        ctx.strokeStyle='#dfe8d8'; ctx.lineWidth=2;
        ctx.strokeRect(w/2-6,h/2-8,12,14);
        ctx.beginPath(); ctx.moveTo(w/2-8,h/2-8); ctx.lineTo(w/2+8,h/2-8); ctx.stroke();
      });
      const binMat = std({ color:0xffffff, map:binTex, roughness:.7 });
      const recycTex = mkTex(32,40,(ctx,w,h)=>{
        ctx.fillStyle='#cfd2cb'; ctx.fillRect(0,0,w,h);
        ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(0,0,w,4);
        ctx.strokeStyle='#2e6b45'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(w/2,h/2-2,7,0,Math.PI*1.5); ctx.stroke();
      });
      const recycMat = std({ color:0xffffff, map:recycTex, roughness:.6, metalness:.15 });

      const lightMat = std({ color:0xffffff, emissive:0xdfe8ff, emissiveIntensity:1.2 });

      const signPlate = (w,h,draw) => mkTex(w,h,(ctx,ww,hh)=>{
        ctx.fillStyle='#0f2a4d'; ctx.fillRect(0,0,ww,hh);
        ctx.strokeStyle='#c7cdd6'; ctx.lineWidth=4;
        ctx.strokeRect(2,2,ww-4,hh-4);
        draw(ctx,ww,hh);
      });
      /* 招牌文字改「永安公車站」(2026-09-01,kc:「招牌幫我寫 永安公車站」
         ——沿用旁邊「永安高中」同一個地名前綴,不是站名亂編)。 */
      const signMat = std({ color:0xffffff, map:signPlate(256,72,(ctx,w,h)=>{
        ctx.fillStyle='#fff'; ctx.font='bold 30px sans-serif'; ctx.textAlign='center';
        ctx.fillText('永安公車站', w/2, h*.46);
        ctx.font='13px sans-serif'; ctx.fillStyle='#cfe0f2';
        ctx.fillText('Yong An Bus Stop', w/2, h*.78);
      }), roughness:.5 });

      /* 底座(月台):往外再長更多單位(kc:「底座要往外長更多單位」)——
         兩側各多 baseExtra、後側(遠離馬路那端)多 baseExtra,前緣(靠
         馬路那側,nearZ)不動,不然會壓到馬路(跟舊筆記「不要壓到馬路」
         同一個理由)。柱子/雨遮/背牆/長椅/站務室全部維持原座標不動,
         只有這塊底座本身變大,margin(內縮量)沒有跟著變,所以底座
         看起來會比雨遮/柱子多露出一大圈。 */
      const baseExtra = 3;
      const baseW = L + baseExtra*2, baseD = platD + baseExtra;
      const baseCz = nearZ + baseD/2;
      addG(box(baseW, platH, baseD, concrete), cx, platH/2, baseCz);
      /* 2026-09-01,kc:「前排柱子不應該有擋板 那邊人可以直接走上去才對」
         ——原本整塊底座蓋一顆大 collider,玩家/路人整個候車區都走不進去
         (跟原本火車站「月台不能隨便走上去」同一套邏輯照抄過來,但公車
         亭應該是開放空間,人本來就該能直接走上月台等車)。拿掉這顆大
         collider,只留真的擋人的東西:背牆(下面補一顆專屬 collider)、
         柱子(前面 postXs 迴圈裡各自的小 collider)、站務室(自己的
         collider)。 */
      addG(box(baseW, .05, .35, yellow), cx, platH+.03, nearZ+.15, false, true);

      /* 背牆,貼在後排柱子後面——專屬 collider(上面那顆整塊底座的大
         collider拿掉了,背牆本身還是實體,要單獨補一顆才不會被走穿)。 */
      solid(openCx, wallZ, openW/2, .15);
      addG(box(openW, postH-.2, .2, wallMat), openCx, (postH-.2)/2, wallZ, false, true);

      /* 雨遮:寬度/深度都比底座小 margin*2,整個內縮在底座範圍內,不再
         貼齊或超出底座邊緣。 */
      const canopyW = L - margin*2, canopyD = (backRowZ-frontRowZ) + margin*1.2;
      addG(box(canopyW, canopyT, canopyD, canopyMat), cx, postH+canopyT/2, platCz, false, true);

      /* 柱子分前後兩排(kc:「會有兩排柱子」),同一組 x 位置各站一根,
         前排在 frontRowZ(靠馬路)、後排在 backRowZ(靠牆)。 */
      const postN = 5;
      const postXs = [];
      for(let i=0;i<postN;i++) postXs.push(xW + i*(openW/(postN-1)));
      postXs.push(xE-.3);   // 東端收邊柱,撐住站務室上方那段雨遮
      postXs.forEach(px => {
        [frontRowZ, backRowZ].forEach(pz => {
          addG(box(.3, postH, .3, postMat), px, postH/2, pz);
          solid(px, pz, .25, .25);
        });
      });

      /* 候車資訊牌,貼在背牆上——2026-09-01 這輪確認過「透明壓克力」講的
         是背牆(見上面 wallMat),不是這 4 張小資訊牌,維持原本不透明的
         色塊看板,不用跟著透明。 */
      const boardTex = [
        signPlate(220,180,(ctx,w,h)=>{
          ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
          ctx.fillText('公車路線圖', w/2, 26);
          ctx.strokeStyle='#8fb8e0'; ctx.lineWidth=2;
          for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(20,40+i*22); ctx.lineTo(w-20,40+i*22+(rnd()*16-8)); ctx.stroke(); }
          ctx.fillStyle='#e2ab34';
          for(let i=0;i<6;i++){ ctx.beginPath(); ctx.arc(30+rnd()*(w-60), 40+rnd()*110, 3, 0, 7); ctx.fill(); }
        }),
        signPlate(220,180,(ctx,w,h)=>{
          ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
          ctx.fillText('公車時刻表', w/2, 26);
          ctx.font='9px monospace'; ctx.textAlign='left';
          for(let r=0;r<10;r++){ ctx.fillText(`${(6+r).toString().padStart(2,'0')}:00  ${(6+r).toString().padStart(2,'0')}:30`, 24, 44+r*13); }
        }),
        signPlate(220,180,(ctx,w,h)=>{
          ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
          ctx.fillText('公車資訊', w/2, 26);
          const routes=['12','25','307','紅5'];
          routes.forEach((r,i)=>{
            const rx=40+(i%2)*100, ry=54+Math.floor(i/2)*60;
            ctx.fillStyle='#d94a35'; ctx.beginPath(); ctx.arc(rx,ry,22,0,7); ctx.fill();
            ctx.fillStyle='#fff'; ctx.font='bold 18px sans-serif'; ctx.textAlign='center';
            ctx.fillText(r, rx, ry+6);
          });
        }),
        signPlate(220,180,(ctx,w,h)=>{
          ctx.fillStyle='#2f6b45'; ctx.fillRect(4,4,w-8,h-8);
          ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
          ctx.fillText('搭公車 愛地球', w/2, 30);
          ctx.strokeStyle='#dfe8d8'; ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(w/2,h/2+16,26,0,7); ctx.stroke();
          ctx.fillStyle='#dfe8d8'; ctx.font='11px sans-serif';
          ctx.fillText('公共運輸 減少碳排', w/2, h-16);
        })
      ].map(tex => std({ color:0xffffff, map:tex, roughness:.6 }));
      /* 小看板存進 busStopRef.boardMeshes,給 __dbg.tweakBusStopBoards()
         滑桿調大小/間距/高度(kc:「讓我調整小看板」)——跟 tweakBusStopWall
         用同一組資訊調 opacity/roughness 是兩回事,這裡調的是量體本身,
         每個 mesh 記住自己相對 openCx/platH+1.9/wallZ-.2 的基準位移,
         滑桿套倍率時才不會每次疊加算錯。
         2026-09-01,kc 現場拉滑桿拉到滿意(大小 1.92、間距 1.26、高度
         +2.0)+ 直接說「高度偏移改2.0」定案,寫死當新的基準值——滑桿
         再打開時是從這個新基準往上疊,不是從沒縮放的原始大小開始。 */
      const boardScale = 1.92, boardSpacing = 1.26, boardDy = 2.0, boardDz = 0;
      const boardN = 4;
      busStopRef.boardMeshes = [];
      busStopRef.boardsCenterX = openCx;
      for(let i=0;i<boardN;i++){
        const bx = xW + (openW/(boardN+1))*(i+1);
        const dx = (bx-openCx)*boardSpacing;
        const by = platH+1.9+boardDy, bz = wallZ-.2+boardDz;
        const m = addG(box(2.0, 1.6, .12, boardTex[i]), openCx+dx, by, bz, false, true);
        m.scale.setScalar(boardScale);
        busStopRef.boardMeshes.push({ mesh:m, dx, baseY:by, baseZ:bz });
      }

      /* 長椅/垃圾桶/資源回收桶改真 3D 模型(2026-09-01,kc:「原本的回收桶
         跟椅子之類的3d要換成真的」——跟警車/交通錐 2026-08-27 同一個理由,
         道具類跟建築量體分開處理,道具用真模型)。Quaternius/CC0 或
         CC-BY,授權見 assets/models/CREDITS.md。先蓋灰模占位,glb 到了
         再替換(跟 realPoliceCar/realTrafficCone 同一套手法),位置/座標
         完全沿用原本 box 版本的數字,只換掉最後那個 box() 呼叫。 */
      /* 模型存進 busStopRef.benchMeshes/trashBinMesh/recycleBinMesh,給
         __dbg.tweakBusStopProps() 滑桿調比例(kc:「比例要調整」)。長椅
         比例 2026-09-01 kc 現場拉滑桿拉到 2.46 定案,直接烤進去當基準值
         (scale.setScalar(BENCH_SCALE),不是 1)。垃圾桶/資源回收桶原本
         共用一顆滑桿,kc:「垃圾桶兩個要分開」——改成兩顆獨立 ref,各自
         基準值先沿用 kc 拉過的 2.32(還沒進一步分開調之前兩個一樣),
         滑桿再開會是從這個基準各自往上疊。 */
      const BENCH_SCALE = 2.46, BIN_SCALE = 2.32;
      const benchN = 4;
      busStopRef.benchMeshes = [];
      for(let i=0;i<benchN;i++){
        const bx = xW + (openW/(benchN+1))*(i+1), bz = backRowZ-.8;
        const fallback = addG(box(1.8,.5,.6, benchMat), bx, platH+.25, bz, false, true);
        loadModel('bench.glb').then(gltf => {
          busStopGroup.remove(fallback);
          const g = addG(propModel(THREE, gltf, 1.8, 'x'), bx, platH, bz, true, true);
          g.scale.setScalar(BENCH_SCALE);
          busStopRef.benchMeshes.push({ mesh:g, baseX:bx, baseY:platH, baseZ:bz });
        }).catch(() => {});
      }

      /* 垃圾桶+資源回收桶,擺在站務室旁——兩個各自獨立的 ref,不再共用
         一個陣列/一顆滑桿。 */
      [
        /* 2026-09-01,kc:「分開是指位置分開啦」——原本 xW+openW-1.1/-.2
           只隔 0.9,兩顆放大到 2.32 倍(寬度約 1.3~1.4)之後會疊在一起,
           拉開到隔 2(東端站務室拿掉之後這塊空間夠用)。 */
        { x:xW+openW-2.0, file:'trash-bin.glb', mat:binMat, key:'trashBinMesh' },
        { x:xW+openW+0,   file:'recycle-bin.glb', mat:recycMat, key:'recycleBinMesh' }
      ].forEach(({x:bx, file, mat, key}) => {
        const bz = backRowZ-.5;
        const fallback = addG(box(.6,.8,.55, mat), bx, platH+.4, bz, false, true);
        loadModel(file).then(gltf => {
          busStopGroup.remove(fallback);
          const g = addG(propModel(THREE, gltf, .8, 'y'), bx, platH, bz, true, true);
          g.scale.setScalar(BIN_SCALE);
          busStopRef[key] = { mesh:g, baseX:bx, baseY:platH, baseZ:bz };
        }).catch(() => {});
      });

      /* 站務室整個拿掉(2026-09-01,kc:「站長室拿掉」)——原本這裡是候車室
         大方塊改的小房間(門/窗/站務室牌子),東端那塊區域現在空著,維持
         原樣不用另外填東西(雨遮/柱子/L 的寬度都沒有跟著縮,只是東端
         少了一棟小建築,底下變成開放空間)。 */

      /* 雨遮下的燈,前後兩排柱子中間各一盞。 */
      for(let i=0;i<postN;i++){
        const px = xW + i*(openW/(postN-1)) + (openW/(postN-1))/2;
        if(px > xW+openW) continue;
        addG(box(.5,.06,.25, lightMat), px, postH-.08, platCz, false, true);
        lampSpots.push({ x:px, y:postH-.3, z:platCz, c:0xdce8f2, i:9, r:11 });
      }

      /* 招牌:西端雨遮上方。 */
      addG(box(6, 1.4, .2, signMat), xW+2.5, postH+canopyT+1, frontRowZ, false, true);
      landmarks.push({ x:xW+2.5, y:postH+canopyT+2, z:frontRowZ, text:'永安公車站' });

      /* 公車停靠區路面標線。 */
      const roadMarkTex = mkTex(256,96,(ctx,w,h)=>{
        ctx.clearRect(0,0,w,h);
        ctx.strokeStyle='rgba(240,230,200,.9)'; ctx.lineWidth=4;
        ctx.strokeRect(6,6,w-12,h-12);
        ctx.fillStyle='rgba(240,230,200,.9)'; ctx.font='bold 26px sans-serif'; ctx.textAlign='center';
        ctx.fillText('公車停靠區', w/2, h/2+9);
      });
      const roadMark = new THREE.Mesh(new THREE.PlaneGeometry(openW-2, 3),
        new THREE.MeshStandardMaterial({ map:roadMarkTex, transparent:true, roughness:.7 }));
      roadMark.rotation.x = -Math.PI/2;
      addG(roadMark, openCx, .02, nearZ-4.5, false, true);
    })();
  })();

  /* 警察局 + 施工工地(2026-08-27,kc 生了一張參考圖,兩棟分站在新火車站
     兩側——「把警察局跟施工工地放上去」)。量體改了兩輪:
     第一輪照 kc 的示意圖字面公尺數做(10×10、兩層樓 7 高)——kc 打回票
     「不對,是你的車站警察局都太小,你要不要看看人家大樓多大」,示意圖
     標的公尺數是圖面本身的比例參考,不是要求照real-world literal尺寸縮小;
     這個城市其他建築(辦公大樓 50 高、學校 26 高、街屋 17~27 高)都是
     誇張過的高度感,警察局要對齊同一套視覺量級,不是照現實 2 層樓的真實
     公尺數。第二輪拉高到 16(footprint 也跟著放寬到 13×13),跟旁邊的
     辦公大樓/火車站站在一起才不會像玩具。警車/交通錐維持真 3D 模型
     (realPoliceCar/realTrafficCone)。跟火車站同一套北側座標基準:
     rowZn=84+B_LINE(105.5)、frontN=rowZn-DEPTH/2(100)。 */
  (function policeStation(){
    const cx=-78, bW=13, bD=13, bH=16;
    const rowZn = 84 + B_LINE, frontN = rowZn - DEPTH/2;   // 105.5 / 100
    const bz = frontN + bD/2;
    /* 2026-08-27,kc 生了正面+側面真照片(同一組提示詞、同一張畫面分兩半
       生的,樓層線對得上,見對話紀錄),換掉原本band/窗排/門/警徽那堆
       手拼色塊——警徽、「警察局」字樣、「立警為公/執法為民」門聯、窗戶、
       雙開門全部烤進照片裡了,不用再疊一次。裁切公式跟辦公大樓那套一樣
       (targetAspect 比對,fill 滿版)。側面 UV 翻轉的坑也踩過一次了
       (見大樓側面 v4 那則筆記),這裡直接用同一個翻轉方向。 */
    const wallSideA = std({ color:0xc2beae, roughness:.85 });   // +x 面
    const wallSideB = std({ color:0xc2beae, roughness:.85 });   // -x 面
    const wallFront = std({ color:0xc2beae, roughness:.85 });
    const wallPlain = std({ color:0xc2beae, roughness:.85 });   // 頂/底/背面,不貼圖,純色
    policeWall.front = wallFront; policeWall.sideA = wallSideA; policeWall.sideB = wallSideB;
    policeWall.bW = bW; policeWall.bH = bH; policeWall.bD = bD;
    new THREE.ImageLoader().load(TEX_DIR + 'police-station.png', img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      /* 2026-08-27,kc 用 __dbg.tweakPolice() 滑桿現場拉到滿意的最終數字,
         直接寫死,不再用公式算(公式版本的裁切基準點跟 kc 視覺判斷對不上,
         拉滑桿比再猜一次公式準)。 */
      t.repeat.set(1, .83); t.offset.set(0, 0);
      t.needsUpdate = true;
      wallFront.map = t; wallFront.color.setHex(0xffffff); wallFront.needsUpdate = true;
    }, undefined, () => {});
    new THREE.ImageLoader().load(TEX_DIR + 'police-station-side.png', img => {
      /* 同上,kc 滑桿現場拉定的最終數字:r=1、off=0、ry=.51、offy=0,
         直接寫死,鏡射公式(A 取負、B 不取負)維持不動。 */
      const r = 1, off = 0, ry = .51, offy = 0;
      const tA = new THREE.Texture(img);
      tA.colorSpace = THREE.SRGBColorSpace; tA.anisotropy = 4;
      tA.repeat.set(-r, ry); tA.offset.set(off+r, offy);
      tA.needsUpdate = true;
      wallSideA.map = tA; wallSideA.color.setHex(0xffffff); wallSideA.needsUpdate = true;
      const tB = new THREE.Texture(img);
      tB.colorSpace = THREE.SRGBColorSpace; tB.anisotropy = 4;
      tB.repeat.set(r, ry); tB.offset.set(off, offy);
      tB.needsUpdate = true;
      wallSideB.map = tB; wallSideB.color.setHex(0xffffff); wallSideB.needsUpdate = true;
    }, undefined, () => {});
    /* 2026-08-27,kc:「正面滑桿完全沒反應,你只貼了環狀的側面,正常應該是
       背面不貼、正面一張、側面兩張」——抓到真正的坑:警察局在北側,正面
       朝 -z(面向街道那側,frontN=100 是建築最小 z 那端),不是像南側大樓
       那樣朝 +z。原本沿用大樓的 index4(+z)=front,結果 wallFront 貼到
       玩家看不到的背面,玩家真正看到的那面(index5,-z)反而是 wallSideA
       (側面材質重複用在 top/bottom/back 四個面,才會像「側面材質包住整棟
       樓」)。改成 index5=wallFront(真正朝街那面)、top/bottom/back
       (index2/3/4)換成不貼圖的純色 wallPlain,不再借用側面材質湊數。 */
    add(box(bW,bH,bD, [wallSideA,wallSideB,wallPlain,wallPlain,wallPlain,wallFront]), cx, bH/2, bz);
    solid(cx, bz, bW/2, bD/2);
    /* 屋頂女兒牆,矮矮一圈收邊,不是貼圖範圍。 */
    const parapetM = std({ color:0x9c988c, roughness:.8 });
    add(box(bW+.5, .5, bD+.5, parapetM), cx, bH+.25, bz, false, true);
    /* 台階,收在建築線內側(照片裡的台階只是示意,實際碰撞/踏板還是要
       真的幾何)。 */
    add(box(4.6,.35,1.4, std({color:0x9c988c,roughness:.85})), cx, .18, frontN+.7, false, true);
    landmarks.push({ x:cx, y:bH+1.2, z:bz-bD/2, text:'警察局' });
    /* 2026-08-27,kc:「有個奇怪的空板子」——下面原本立的獨立招牌柱是個
       純色箱體,沒有貼文字,現在正面照片本身已經烤進「立警為公/執法為民」
       門聯了,這根多出來的空板子純粹是多餘的贅物,直接刪掉,不用另外
       想要不要補文字上去。 */
    /* 2026-08-27,kc:「你確定?這是警局沒錯唷還有警車勒」——貼圖真的有接上,
       但晚上這面牆沒有燈直接照,PBR 材質沒光就整張照片(警徽/白字)一起
       壓黑,細節讀不出來。招牌柱那顆路燈對著柱子自己,沒有對準建築正面。
       補一顆專門對著警徽/「警察局」字樣那塊(約 bH-3 高)的暖光,跟辦公
       大樓入口暖光同一招。 */
    lampSpots.push({ x:cx, y:bH-3, z:frontN+2, c:0xfff0d8, i:16, r:16 });
    /* 路燈用既有的真 3D 路燈道具(獨立招牌柱已刪,見上面那則筆記)。 */
    placeAlleyLamp(cx+6.4, frontN-1.4);

    /* 警車停在門口路邊(路面上,不是建築腳印,純視覺道具,不擋路)。
       真 3D 模型(realPoliceCar)。
       2026-08-31,kc:「我要個別調整」——改了 tweakPoliceCarPanel() 讓
       4 台可以各自單獨拉(見 game.html 那則筆記),kc 現場調成「兩台一組
       分站門口左右」確認過(截圖核對),座標直接改成絕對值寫死,不再用
       cx/frontN 相對式子——4 台縮放統一 1.92,不是各自不同。 */
    realPoliceCar(-87.7, 104.75, Math.PI, 1.92, -.1);
    realPoliceCar(-64.15, 105.4, Math.PI, 1.92);
    realPoliceCar(-93.4, 104.2, Math.PI * .9, 1.92);
    realPoliceCar(-68.6, 105.3, Math.PI, 1.92);
  })();

  (function constructionSite(){
    /* 2026-08-28,kc 截圖回報「重點是他的大小根本不對,人家車站這麼大欸」
       ——原本 14×10 的小圍籬跟旁邊 50 高辦公大樓/放大 3 倍的火車站站在
       一起像自家後院工地。第一輪先放大基地跟裡面小道具的量體/數量
       (14×10→36×16),kc 接著推翻更早那條「不要骨架大樓」的舊決定:
       「工地會有大樓骨架啊因為是大樓施工,圍牆更高」——這輪補上真的
       在蓋的大樓骨架(裸柱+樓板,沒貼皮,故意讀出「還沒蓋完」),圍籬
       再拉高一截。灰模怪手/土堆/貨櫃屋等地面道具維持,不是被骨架取代,
       是骨架旁邊真的還在整地的樣子。
       cx 兩側量過的空間:東邊到小美哥固定站位(x=48)還有 12 個單位淨空
       (siteW 36→右緣 x=38),西邊到火車站站體最右側量體(pylonX≈-13.8)
       還有超過 30 個單位,遠遠夠用。 */
    const cx=20, siteW=36, siteD=16;
    const rowZn = 84 + B_LINE, frontN = rowZn - DEPTH/2;
    /* 2026-08-28,kc:「施工空地後移一點對齊車站」——原本貼在跟警察局同一條
       frontN 建築線上,比火車站整組退後(setback=3,見上面 trainStationV2
       那段「不要壓到馬路,對齊同一條路的房子」)還要往路那側凸出一截,
       兩棟站在一起不齊。套用跟火車站同一個 setback 數字,不是隨便挑的。 */
    const siteSetback = 3;
    const siteZ0 = frontN + siteSetback, siteZ1 = siteZ0+siteD, siteCz = (siteZ0+siteZ1)/2;
    const fenceH = 6;   // 2026-08-28 3.4→6,kc:「圍牆更高」——工地要蓋大樓,圍籬本來就該高過人視線很多,不是矮欄杆

    /* 圍籬:灰色鐵皮浪板+橘色收邊柱(照參考圖的材質表換掉)。矩形周界
       等距立收邊柱,四邊各補一片浪板牆——基地放大後長邊(siteW=36)
       柱子間距沿用原本密度,不再只有頭尾+中點三根。 */
    /* 圍籬鐵皮浪板貼圖(2026-08-28,kc 生了一張可平鋪的浪板照片,fence-panel.png)
       ——kc 原話「正面側面跟上面同步要生成不然會很怪」,但實際只生了一張
       (單張可平鋪材質,不是三視圖)。解法:6 面都套同一張圖(同一個來源
       絕對「同步」),只是依各面實際尺寸各自算 repeat,不會不成比例。
       圖片非同步載入,先用素色 fallback 頂著,loadImg 到了才回填每個排隊
       中材質的 map(跟 office-tower 那套「先素色再貼圖」同一招)。 */
    const FENCE_TILE = 2.6;   // 世界單位,一張圖大概蓋這個寬度,肉眼抓感覺,不是精算
    const fencePendingMats = [];
    let fencePanelImg = null;
    new THREE.ImageLoader().load(TEX_DIR + 'fence-panel.png', img => {
      fencePanelImg = img;
      fencePendingMats.forEach(({mat, rx, ry}) => {
        const t = new THREE.Texture(img);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        t.repeat.set(rx, ry);
        t.needsUpdate = true;
        mat.map = t; mat.color.setHex(0xffffff); mat.needsUpdate = true;
      });
    }, undefined, () => {});
    function fenceEdgeMat(rx, ry){
      const m = std({ color:0x9a9a96, roughness:.8, metalness:.15 });
      fencePendingMats.push({ mat:m, rx, ry });
      return m;
    }
    /* 大門缺口兩側那兩段圍籬,正面(街上看得到那面)各貼一張不同的告示牌
       全景——kc 一開始生一張(施工中/CONSTRUCTION+永安營造+工地編號),
       第二輪又生一張(安全第一/危險注意/施工期間/安全帽),kc:「兩張圖片
       一張左一張右」,不是後面那張蓋過前面那張,兩張都要留、各自站一邊。
       跟 office-tower 那組整棟照片同一套「裁切不拉伸、不重複貼」做法,
       不是像浪板材質那樣 RepeatWrapping 鋪滿。只貼在朝向街道那一面
       (-z,人站在缺口外看到的那面),朝基地內側那面(+z)還是浪板材質,
       不用跟著換。 */
    const fenceSignCache = {};   // file -> { img, pending:[{mat,faceW}] }
    function applyFenceSign(mat, faceW, img){
      const t = new THREE.Texture(img);
      const targetAspect = faceW/fenceH, ia = img.width/img.height;
      if(ia > targetAspect){ const r = targetAspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2,0); }
      else { const r = ia/targetAspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.needsUpdate = true;
      mat.map = t; mat.color.setHex(0xffffff); mat.needsUpdate = true;
    }
    function fenceSignMat(faceW, file){
      const m = std({ color:0x9a9a96, roughness:.8 });
      let entry = fenceSignCache[file];
      if(!entry){
        entry = fenceSignCache[file] = { img:null, pending:[] };
        new THREE.ImageLoader().load(TEX_DIR + file, img => {
          entry.img = img;
          entry.pending.forEach(({mat:pm, faceW:pw}) => applyFenceSign(pm, pw, img));
        }, undefined, () => {});
      }
      if(entry.img) applyFenceSign(m, faceW, entry.img); else entry.pending.push({ mat:m, faceW });
      return m;
    }
    /* bigFaceW:大面(看得到的那個方向)實際寬度;orient 'z' 是牆板(正面/背面
       朝 ±z,窄邊朝 ±x,像正面/背面那兩段圍籬);'x' 是側牆(大面朝 ±x,窄邊
       朝 ±z,像東西兩側那兩段)。回傳 [+x,-x,+y,-y,+z,-z] 六面材質陣列,
       頂/底(±y)也套同一張圖(kc 要求跟正面/側面同步,不留素色)。
       signFile:只有大門缺口兩側那兩段圍籬傳檔名,朝街道那面(-z)換成
       告示牌全景,不是每段圍籬都套;兩段各傳不同檔名,不是同一張。 */
    function fenceMats(bigFaceW, orient, signFile){
      const bigRepX = Math.max(1, bigFaceW/FENCE_TILE), bigRepY = Math.max(1, fenceH/FENCE_TILE);
      const big = fenceEdgeMat(bigRepX, bigRepY);
      const outward = signFile ? fenceSignMat(bigFaceW, signFile) : big;
      const edge = fenceEdgeMat(1, bigRepY);
      const top = fenceEdgeMat(bigRepX, .3);
      return orient === 'z' ? [edge,edge,top,top,big,outward] : [big,big,top,top,edge,edge];
    }
    /* 橘色收邊柱貼圖(2026-08-28,kc 生的 post-orange.png,鏽蝕橘漆鐵件,
       可平鋪)——柱子是 CylinderGeometry,預設 UV 就是繞圓周方向 0~1、
       高度方向 0~1,直接套材質會自動包住圓柱,不用另外處理面陣列。
       圍籬正面的門楣橫樑(box 幾何)也共用同一顆材質,同一根柱子/橫樑
       同一種鏽蝕鐵件,不用分開生一張。 */
    const postM = std({ color:0xe8862a, roughness:.6 });
    new THREE.ImageLoader().load(TEX_DIR + 'post-orange.png', img => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set(1, 3);
      t.needsUpdate = true;
      postM.map = t; postM.color.setHex(0xffffff); postM.needsUpdate = true;
    }, undefined, () => {});
    const postsLong = 5, postsShort = 3;
    /* 2026-08-28,kc:「牆壁開一個門」——正面圍籬中間留一段缺口當出入口
       (gateW=8,置中),兩片牆各自變短,缺口兩側補一對比其他收邊柱粗一圈
       的門柱。原本 postsLong 那圈柱子如果照舊等距排,中間那根(px=cx)會
       剛好卡在缺口正中間,改成正面(siteZ0)柱子位置改用明講的清單,跳過
       缺口、補上門柱;背面(siteZ1)沒有門,柱子維持原本等距。 */
    const gateW = 8, gateX0 = cx-gateW/2, gateX1 = cx+gateW/2;
    const frontPostXs = [cx-siteW/2, 9, gateX0, gateX1, 31, cx+siteW/2];
    frontPostXs.forEach(px => {
      const isGate = px === gateX0 || px === gateX1;
      add(new THREE.Mesh(new THREE.CylinderGeometry(isGate?.2:.14, isGate?.2:.14, fenceH+.3, 6), postM), px, (fenceH+.3)/2, siteZ0);
    });
    for(let i=0;i<postsLong;i++){
      const px = cx - siteW/2 + i*(siteW/(postsLong-1));
      add(new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,fenceH+.3,6), postM), px, (fenceH+.3)/2, siteZ1);
    }
    for(let i=0;i<postsShort;i++){
      const pz = siteZ0 + i*(siteD/(postsShort-1));
      add(new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,fenceH+.3,6), postM), cx-siteW/2, (fenceH+.3)/2, pz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,fenceH+.3,6), postM), cx+siteW/2, (fenceH+.3)/2, pz);
    }
    // 正面圍籬拆成缺口兩側兩段(西段 2→16、東段 24→38),缺口本身不補牆板
    const westSegW = (gateX0-(cx-siteW/2))+.3, eastSegW = ((cx+siteW/2)-gateX1)+.3;
    add(box(westSegW, fenceH, .15, fenceMats(westSegW,'z','fence-sign-west.png')), (cx-siteW/2+gateX0)/2, fenceH/2, siteZ0, false, true);
    add(box(eastSegW, fenceH, .15, fenceMats(eastSegW,'z','fence-sign-east.png')), (gateX1+cx+siteW/2)/2, fenceH/2, siteZ0, false, true);
    add(box(siteW+.3,fenceH,.15, fenceMats(siteW+.3,'z')), cx, fenceH/2, siteZ1, false, true);
    add(box(.15,fenceH,siteD, fenceMats(siteD,'x')), cx-siteW/2, fenceH/2, siteCz, false, true);
    add(box(.15,fenceH,siteD, fenceMats(siteD,'x')), cx+siteW/2, fenceH/2, siteCz, false, true);
    /* 門楣:缺口上方一根橫樑框住出入口,不然單看兩根柱子容易讀成「牆破了
       一個洞」而不是門。2026-08-28,kc 追問「板子沒換我給你的素材」——
       這根橫樑之前跟收邊柱共用 postM(鏽蝕橘漆鐵件),但 kc 最早給的
       「RC柱/樑貼圖」三合一參考圖(中間那塊,beam-lintel.png,清水模
       混凝土樑+對拉孔)本來就是要給這根橫樑用的,不是鐵件。改成獨立
       材質,不再跟收邊柱共用同一顆。 */
    const lintelM = std({ color:0x9a9890, roughness:.85 });
    new THREE.ImageLoader().load(TEX_DIR + 'beam-lintel.png', img => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set(2, 1);
      t.needsUpdate = true;
      lintelM.map = t; lintelM.color.setHex(0xffffff); lintelM.needsUpdate = true;
    }, undefined, () => {});
    add(box(gateW+.6, .4, .3, lintelM), cx, fenceH+.35, siteZ0, false, true);
    /* 2026-08-28,kc:「工地內部要讓我可以走進去逛啊」——原本整塊基地
       (含大門缺口)用一個大矩形 solid() 封死,人根本進不去,只能隔著
       缺口看。改成照實際圍籬牆板的形狀分開註冊碰撞(西段/東段/背牆/
       兩側牆,缺口本身不擋),玩家可以從缺口真的走進去。裡面的柱子/
       土堆/貨櫃屋/管料堆/沙包各自在下面補碰撞,不然會穿模走過去。 */
    solid(9, siteZ0, westSegW/2, .3);
    solid(31, siteZ0, eastSegW/2, .3);
    solid(cx, siteZ1, (siteW+.3)/2, .3);
    solid(cx-siteW/2, siteCz, .3, siteD/2);
    solid(cx+siteW/2, siteCz, .3, siteD/2);

    /* 圍籬內地板(2026-08-28,kc:「鋪滿圍牆內的地板」)——原本裡面是跟外面
       人行道同一塊地磚材質,只有零星幾件道具漂在上面,隔著大門缺口看進去
       看不出「這裡是工地」。鋪一塊平面蓋滿整個基地,压过原本的路面。
       同一天 kc 補了 site-ground.png(混凝土地坪+泥土+輪胎痕+腳印+水漬,
       可平鋪,無明顯重複感)——素色先頂著,圖到位換成真材質,repeat 抓
       基地實際尺寸/TILE 去算,不是憑感覺硬套一個數字。 */
    const groundM = std({ color:0x5a4530, roughness:1 });
    new THREE.ImageLoader().load(TEX_DIR + 'site-ground.png', img => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const GROUND_TILE = 5;   // 世界單位,一張圖大概蓋這個範圍,肉眼抓感覺
      t.repeat.set((siteW-.3)/GROUND_TILE, (siteD-.3)/GROUND_TILE);
      t.needsUpdate = true;
      groundM.map = t; groundM.color.setHex(0xffffff); groundM.needsUpdate = true;
    }, undefined, () => {});
    add(box(siteW-.3, .06, siteD-.3, groundM), cx, .03, siteCz, false, true);

    /* 素色警示牌拿掉了(2026-08-28)——fence-sign.png 那張告示牌全景已經
       涵蓋「施工中/安全第一/危險注意」這些內容,兩塊素色板子留著會跟
       新告示牌的訊息重複。遠景導航用的飄浮字(跟「火車站」「警察局」
       同一套,站遠一點就看得到,跟近看才讀得到的牆面貼圖是兩個層級)
       維持不動。交通錐擺在缺口出入口正前方(原本沿整段西側排,跟「這是
       門口」的閱讀對不上)。 */
    landmarks.push({ x:cx, y:3.6, z:siteZ0, text:'施工中\n請小心安全' });
    /* 交通錐(2026-08-28,kc 開滑桿把縮放拉到 2.18 後說「定案」——把這個倍率
       直接烤進 propModel targetSize,不留在滑桿上,滑桿之後打開預設回到 1
       代表「在這個新基準上再調」,不是每次都要重新拉到 2.18。kc 同一輪
       又追加「不要這麼密集,分散一點,有一些也放在圍牆內」——原本 9 個錐
       等距排一長條,放大後擠在一起變成一面牆;改成大門口只留 4 個,其餘
       散在圍牆內個別道具旁邊(見下面 dirtPile/skelW 那段之後的「圍牆內
       交通錐」)。**再下一輪 kc 又抓到「不要擋住門口」**——上面 4 個原本
       卡在 gateX0~gateX1(16~24)整個缺口寬度正中間,直接堵住走道;改成
       兩側各兩個,貼著門柱外側站,缺口中央(x:16~24)淨空。 */
    [gateX0-2.6, gateX0-1.1, gateX1+1.1, gateX1+2.6].forEach((cxn, i) =>
      realTrafficCone(cxn, siteZ0-1.4 + (i%2===0? -.3 : .3)));

    /* 大樓骨架(2026-08-28 新增,kc:「工地會有大樓骨架啊因為是大樓施工」)
       ——裸柱+樓板,不貼皮、不裝窗,故意讀出「還在蓋,沒完工」,跟旁邊
       已經貼滿玻璃帷幕照片的辦公大樓/火車站區分開。佔基地後半段(離馬路
       較遠那側),前半段留給地面施工道具(怪手/土堆/貨櫃屋),跟真工地
       「後面在往上蓋、前面在整地」的分工一致。5×3 柱網,蓋到第 7 層
       (骨架本身沒有到頂,頂端露出比樓板高一截的柱子/鋼筋,暗示還要繼續
       往上蓋),高度落在辦公大樓(50)跟警察局(16)之間,壓過火車站雨遮
       (10)一截,才撐得住「這裡以後也會是一棟大樓」的份量。 */
    const skelW = 22, skelD = 10, skelCz = siteZ1 - skelD/2 - 1;
    const floorH = 5.5, builtFloors = 7, skelH = floorH*builtFloors;
    /* 柱子貼圖(2026-08-28,kc 生的 skeleton-column.png,清水模板模紋+對拉孔,
       可平鋪)——四面都用同一顆材質(柱子沒有正反面之分,跟圍籬那種要分
       正面/側面/頂面不一樣),repeat.y 抓一個板模高度的量級去算重複次數,
       repeat.x 抓 1(柱寬 .7 個單位,大概就是一塊板模寬)。非同步載入前
       先素色頂著。 */
    const COL_TILE = 1.4;
    const colM = std({ color:0x8c8c86, roughness:.9 });
    new THREE.ImageLoader().load(TEX_DIR + 'skeleton-column.png?v=2', img => {   // v2:kc 重生了一版板模紋更細緻的(2026-08-28 下午,跟樓板底部/施工地面同一批)
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set(1, skelH/COL_TILE);
      t.needsUpdate = true;
      colM.map = t; colM.color.setHex(0xffffff); colM.needsUpdate = true;
    }, undefined, () => {});
    /* 樓板底部貼圖(2026-08-28,kc 生的 skeleton-slab-under.png)——這棟
       骨架沒有獨立的「樑」幾何(只有柱+樓板,見上面骨架那則筆記),kc 給的
       ②號圖用途寫「樓板底部/天花板」,直接貼在樓板的底面(-y,人站在
       下一層抬頭看到的那面)最合理,不用先補樑才能用。頂面(+y,走在
       上面那層的地板)維持素色——這棟骨架玩家爬不上去,頂面幾乎看不到,
       不用跟著換材質陣列六面都貼。
       **同一天 kc 追問「空中的板子」還是素色**——原本以為的「板子」先後
       猜成門楣、貨櫃屋都猜錯,kc 講明是這片樓板本身,指的是站在下面
       抬頭會看到的那圈外露厚度邊緣(±x/±z 那 4 個窄面,不是底面,底面
       已經貼過了)。這圈邊緣本質上就是一條清水模樑的斷面,直接借用門楣
       already 在用的 beam-lintel.png,不用再生一張。 */
    const slabM = std({ color:0x9a9a90, roughness:.85 });
    const slabUnderM = std({ color:0x8a887e, roughness:.9 });
    const slabEdgeM = std({ color:0x9a9890, roughness:.85 });
    new THREE.ImageLoader().load(TEX_DIR + 'skeleton-slab-under.png', img => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set(skelW/4, skelD/4);
      t.needsUpdate = true;
      slabUnderM.map = t; slabUnderM.color.setHex(0xffffff); slabUnderM.needsUpdate = true;
    }, undefined, () => {});
    new THREE.ImageLoader().load(TEX_DIR + 'beam-lintel.png', img => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set(3, 1);
      t.needsUpdate = true;
      slabEdgeM.map = t; slabEdgeM.color.setHex(0xffffff); slabEdgeM.needsUpdate = true;
    }, undefined, () => {});
    /* 樓板頂面(2026-08-28,kc:「沒錯了,但上面也要貼」)——原本想說玩家
       爬不上去頂面幾乎看不到就沒貼,kc 還是要貼滿。kc 生的
       skeleton-slab-top.png 是水泥地+菸蒂+腳印+血漬,可平鋪,圖裡混了
       幾個像遊戲 UI 浮動傷害數字的黃色/紅色箭頭+數字(+1200/+800/GL/x3
       那些)——不確定是不是生圖不小心把「遊戲畫面」的意象也生進去了,
       先照樣貼,鋪滿之後那些小記號分散開來,讀起來比較像工地噴漆記號,
       如果看了覺得奇怪,那就是這個。 */
    new THREE.ImageLoader().load(TEX_DIR + 'skeleton-slab-top.png', img => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set(skelW/4, skelD/4);
      t.needsUpdate = true;
      slabM.map = t; slabM.color.setHex(0xffffff); slabM.needsUpdate = true;
    }, undefined, () => {});
    // [+x,-x,+y,-y,+z,-z]——邊緣(±x/±z)貼梁貼圖,頂面(+y)貼樓板頂貼圖,底面(-y)貼樓板底貼圖
    const slabMats = [slabEdgeM,slabEdgeM,slabM,slabUnderM,slabEdgeM,slabEdgeM];
    const rebarM = std({ color:0x3a3a38, roughness:.5, metalness:.4 });
    const nx=5, nz=3;
    const colXs = Array.from({length:nx}, (_,i) => cx - skelW/2 + i*(skelW/(nx-1)));
    const colZs = Array.from({length:nz}, (_,i) => skelCz - skelD/2 + i*(skelD/(nz-1)));
    colXs.forEach(px => colZs.forEach(pz => {
      add(box(.7, skelH, .7, colM), px, skelH/2, pz);
      // 頂端露出的鋼筋,暗示骨架還沒封頂
      const r = new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.4,6), rebarM);
      add(r, px+.15, skelH+1.2, pz+.15, false, true);
      solid(px, pz, .45, .45);   // 玩家可以走進來逛之後,柱子要擋人,不然穿模
    }));
    for(let f=1; f<=builtFloors; f++){
      add(box(skelW, .5, skelD, slabMats), cx, f*floorH, skelCz, false, true);
    }

    /* 2026-08-28,kc:「你要把道具放到牆壁外我才看得到」——圍籬拉到 6 之後
       站在街上完全看不到裡面的怪手,搬到大門缺口正前方的人行道上(跟警車
       停在警察局門口同一套做法,z 落在人行道帶 93~100 之內,不用額外
       註冊 solid()),框住新開的大門缺口,一眼就看得到,滑桿(見 game.html
       tweakConstructionPanel)也才調得出效果。基地裡面(骨架旁邊)留給
       土堆/貨櫃屋/管料堆這些不用特寫、繼續藏在圍籬後面也沒差的道具。 */
    realExcavator(cx-11, siteZ0-4, -.3);
    realExcavator(cx+11, siteZ0-4, .35);

    /* 場地內部(骨架旁邊):四堆土丘(幾何,不規則堆疊)+ 兩間貨櫃屋
       + 一落鋼筋/管料堆——地面施工道具維持,骨架蓋在後半段不取代它們。
       2026-08-27 kc 糾正過一次做法(先誤用照片卡,又改回真 3D)。 */
    const frontCz = siteZ0 + 2.8;   // 前半段中心線,離骨架(skelCz≈110)有 4+ 單位淨空
    /* 2026-08-28,kc:「不行欸進不去」——上一輪補了土堆/沙包的碰撞之後才
       發現這兩堆(cx-2/cx+2 那組)剛好卡在大門缺口(x:16~24)正對著的
       走道正中間,player 從門口直直走進來會被擋住,不是真的進不去,是
       要繞很小的縫才過得去,體感就是「卡住」。挪離開缺口正對的走道,
       不再擋在 x:16~24 這條線上。 */
    dirtPile(cx-10, frontCz-1.2, 1.8);
    dirtPile(cx+16, frontCz-.6, 1.5);
    dirtPile(cx-16, frontCz+1, 1.6);
    dirtPile(cx+10, frontCz+1.8, 1.3);

    /* 貨櫃屋套真貼圖(2026-08-28,kc:「這塊板子還是素色啊,要貼這個的三面」)
       ——之前的舊筆記寫「貨櫃屋形狀本來就是箱子不用拍照/建模」,指的是
       幾何不用做成模型,不是不用貼材質;kc 截圖看到晚上暗色調下素色箱體
       讀起來像一塊沒貼圖的灰板,還是要貼。用 kc 最早那張「RC柱/樑貼圖」
       三合一參考圖裡剩下沒用到的兩塊(頂部那張大面板、最下面那條樑,
       中間那條樑已經給門楣用了):頂面(+y)貼 container-top.png,
       前後長面(±z)貼 beam-lintel.png(跟門楣同一張,反正都是清水模),
       左右短面(±x)貼 container-side.png,底面看不到維持素色。 */
    const containerTopM = std({ color:0x8c8c86, roughness:.85 });
    const containerFrontM = std({ color:0x8c8c86, roughness:.85 });
    const containerSideM = std({ color:0x8c8c86, roughness:.85 });
    new THREE.ImageLoader().load(TEX_DIR + 'container-top.png', img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      containerTopM.map = t; containerTopM.color.setHex(0xffffff); containerTopM.needsUpdate = true;
    }, undefined, () => {});
    new THREE.ImageLoader().load(TEX_DIR + 'beam-lintel.png', img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      containerFrontM.map = t; containerFrontM.color.setHex(0xffffff); containerFrontM.needsUpdate = true;
    }, undefined, () => {});
    new THREE.ImageLoader().load(TEX_DIR + 'container-side.png', img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      containerSideM.map = t; containerSideM.color.setHex(0xffffff); containerSideM.needsUpdate = true;
    }, undefined, () => {});
    const containerBottomM = std({ color:0x4a4a44, roughness:.9 });
    // [+x,-x,+y,-y,+z,-z]
    const containerMats = [containerSideM, containerSideM, containerTopM, containerBottomM, containerFrontM, containerFrontM];
    add(box(4,2.6,2.4, containerMats), cx-siteW/2+3, 1.3, siteZ0+2.2);
    add(box(4,2.6,2.4, containerMats), cx-siteW/2+8, 1.3, siteZ0+2.2);
    solid(cx-siteW/2+3, siteZ0+2.2, 2, 1.2);
    solid(cx-siteW/2+8, siteZ0+2.2, 2, 1.2);

    /* 鋼筋/管料堆:一落等長圓柱橫躺堆疊,補基地內容,不是照片也不是玩偶,
       跟怪手/土堆同一套幾何手法。 */
    const pipeM = std({ color:0x8a6b3a, roughness:.6, metalness:.2 });
    const pipeCx = cx+siteW/2-8, pipeCz = siteZ0+2.5;
    solid(pipeCx+.4, pipeCz, .9, .5);
    [[0,0],[.42,0],[.84,0],[.21,.36],[.63,.36],[.42,.72]].forEach(([dx,dy]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,3.2,8), pipeM);
      p.rotation.z = Math.PI/2;
      add(p, pipeCx+dx, .22+dy, pipeCz, false, true);
    });

    /* 圍牆內交通錐(2026-08-28,kc:「有一些也放在圍牆內」)——散在土堆/
       貨櫃屋/管料堆旁邊當警戒標示,不是全部堆在大門口,位置跟著上面
       dirtPile/貨櫃屋/管料堆座標錯開,不疊在道具正中心。 */
    [[15.5,103.6],[33.5,104.2],[7.5,108.4],[32.5,109.2],[20,110.5]].forEach(([px,pz]) => realTrafficCone(px, pz));

    /* 沙包(2026-08-28,kc:「工地內部放幾個真的沙包」)——散在圍牆內幾個
       還算空的角落,跟土堆/貨櫃屋/管料堆錯開,不疊在一起。 */
    realSandbag(13, 104.5, .3);
    realSandbag(27, 106.2, -.5);
    realSandbag(24, 110, 1.1);   // 原本 x=20 卡在大門缺口正對的走道上,同一輪挪開

    /* 走失狗任務用的道具狗(2026-08-28,kc 來回改過兩輪:第一版做了真的
       找得到、第二版嫌「工地太明顯」拿掉、第三版又要求「狗要真的出現在
       工地,我是說提示不要講」——這輪確定的規矩是:狗真的在工地裡,但
       任務面板的文字提示不能直接寫「工地」,要透過跟工地老闆
       (talkToForeman())對話才會拿到「好像有在工地裡看到」這個口頭
       線索,見 game.html TATTOO_DOG 那則長筆記。跟上面 placePet()
       (temple() 那兩隻永遠站著給人摸的裝飾寵物)共用同一顆 dog.glb
       模型跟灰模佔位手法,但這隻預設藏起來(visible=false),只有玩家
       在刺青店接下任務之後,game.html 才會把它打開——不進 pets[] 那份
       「隨時可摸,+mood」清單,平常根本不存在於畫面上。位置挑在骨架
       柱網東北角一塊空地(22,113):跟最近的柱子(20,113)/(25.5,113)、
       東側沙包(24,110)都隔了安全距離,不疊土堆/貨櫃屋/管料堆/交通錐
       既有道具(座標見上面那一串),narratively 讀起來像躲在骨架角落。
       `constructionRef.dog` 是可變參照(gltf 非同步載入完成後從灰模
       佔位換成真模型,參照跟著更新)——跟 `constructionRef.bulldozers/
       cones` 同一個「暴露給 game.html 讀寫」的模式,不是新發明一套。 */
    {
      const dogFallback = box(.5, .9, 1.8, std({ color:0x5a4a38, roughness:.9 }));
      constructionRef.dog = add(dogFallback, 22, .3+.45, 113, true, true);
      constructionRef.dog.visible = false;
      loadModel('dog.glb').then(gltf => {
        scene.remove(constructionRef.dog);
        const real = propModel(THREE, gltf, 1.6, 'z', 0);
        real.visible = false;
        add(real, 22, .3, 113, false, false);
        constructionRef.dog = real;
      }).catch(() => {});
    }

    /* Decal 貼圖(2026-08-28,kc 生的第二張才有真的 alpha 通道——第一張是
       四合一縮圖,RGB 沒有透明通道,那輪只接了柱子/樓板底/地面三張,見上面
       那次的筆記)。原圖是一整張大 sprite sheet,不是切好的單一圖示,用
       Python(PIL+scipy.ndimage.label,連通元件分析抓每個圖示的 bounding
       box)裁出三塊乾淨、沒有跟旁邊圖示疊在一起的區域:警示膠帶條紋、
       兩種裂縫/剝落痕跡,其餘(水泥字樣袋子、保特瓶、木板……)混在一起
       裁不乾淨沒有用。貼法跟 propCard()/addProp() 同一套 alphaTest 卡片,
       但這裡要平躺在地上(rotation.x=-PI/2),不是站著的立牌。 */
    const decalMats = {};
    function decalMat(name){
      if(decalMats[name]) return decalMats[name];
      const m = std({ color:0x9a9488, roughness:.9, transparent:true, alphaTest:.35, side:THREE.DoubleSide });
      decalMats[name] = m;
      new THREE.ImageLoader().load(TEX_DIR + `decal-${name}.png`, img => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
        m.map = t; m.color.setHex(0xffffff); m.needsUpdate = true;
      }, undefined, () => {});
      return m;
    }
    function groundDecal(name, x, z, w, h, ry){
      const card = new THREE.Mesh(new THREE.PlaneGeometry(w,h), decalMat(name));
      card.rotation.x = -Math.PI/2;
      card.rotation.z = ry || 0;
      add(card, x, .07, z, false, true);   // 地板箱體(高 .06,中心 y=.03)頂面在 y=.06,貼花要蓋在上面,不是埋進箱體裡
    }
    /* 2026-08-28,kc:「我怎看不出來」——查證過不是穿模/沒載到(scene 裡
       貼花物件真的在,材質/貼圖都對),是原本擺的位置剛好卡在大門橫樑
       投下來的陰影裡,晚上光線暗,黃黑條紋的對比被陰影吃掉大半,肉眼
       幾乎看不到。挪到陰影範圍外、彼此不跟土堆/貨櫃屋/管料堆疊在一起
       的空地,尺寸也放大一截。 */
    groundDecal('tape', 30, 108, 4.8, 1, .3);
    groundDecal('tape', 14, 111.5, 3.6, .77, -.4);
    groundDecal('crack1', 25, 116, 2.4, 4, .4);
    groundDecal('crack2', 9, 116.5, 2.6, 3.8, -.6);
  })();

  /* 縱街——這兩排原本各多開一個 food/betel slot,會讓 nFood/nBetel 的計數器
     繞回 FOOD.length/BETEL.length 重複到前面已經出現過的店名(2026-08-14 kc
     抓到「麵店」重複)。FOOD 6 種、BETEL 3 種都已經在前面的排用滿,這裡多出來
     的 slot 換成拉鐵門的店面(S.sh,已有 shutter.png),不再喊 S.food()/S.betel()。
     西園街第 4/5 格(2026-09-04)讓給 hospitalCompound()——醫院原本
     (2026-09-03)是塞進 row() 當一間 12 米單店面,kc 隔天推翻「應該跟
     工地一樣獨立做醫院」,見 DESIGN_NOTES 待辦清單那節+下面 hospitalCompound()
     開頭的長筆記。這裡改成兩格 S.gap 空出腹地,建築本體挪到 row() 外面
     自己蓋,不再走 row() 的單店面板+貼圖裁切那套。 */
  row({ axis:'z', at:-84-B_LINE, face:1, from:-58, shops:[ S.sh,S.sh,S.sh,S.gap,S.gap,S.sh,S.sh,S.sh ]});
  row({ axis:'z', at: 84+B_LINE, face:-1, from:-58, shops:[ S.sh,S.sh,S.sh,S.sh,S.sh,S.sh,S.sh,S.sh ]});

  /* ===== 醫院(獨立建築,2026-09-04)=====
   * 2026-09-03 先塞進 row() 當一間 12 米單店面(S.hospital()),kc 隔天說
   * 「可是診所啊罵躺在裡面很怪欸」→「我是不是應該跟工地一樣獨立做醫院」
   * ——問過方向(位置維持西園街原本這格,量體比照警察局/工地),這裡是
   * 那個決定的落地,取代上面 row() 第 4/5 格(S.gap,S.gap)空出來的位置。
   *
   * 中間(第二~六輪)一路加參考圖立面細節(花圃/招牌/雨遮/台階)+廣場
   * 腹地+滑桿面板,結果 kc 連續踩到好幾個坑(縫隙、地板破洞、越改越爛、
   * 滑桿死區、console 指令),來回好幾輪都在修這些附加細節,反而模糊了
   * 「這棟樓到底該站在哪裡」這個最基本的問題。2026-09-04 第七輪 kc 喊
   * 停:「不要廣場 你聽我說 你先放一個醫院主體的長方體 我們先調整長方體
   * 位置」——退回最小可行版本,只留一個長方體+碰撞箱,其餘(廣場地板/
   * 雨遮/招牌/花圃/台階/扶手/急診招牌/雙路燈)全部拿掉,等位置/量體
   * 定案之後才按同一個順序疊回去,不要在位置都還沒定案時就疊一堆細節
   * 互相干擾判斷。CITY.bounds.x[0] 也跟著退回 -100(沒有廣場就不用拉寬
   * 邊界讓玩家走進去,拉了反而會走進沒鋪地板的區域)。
   *
   * 2026-09-04 第八輪,kc 自己拉滑桿定案位置/量體(x:-113、z:-16.5、
   * w:24、d:24.5、h:21),寫死當新預設值,說「更新完後 在前面加兩個
   * 長方形花圃以及路燈」——照上面「一項項疊回去」的順序,這輪只加這
   * 兩樣(花圃+路燈),不要一次把招牌/雨遮/台階/扶手全部疊回來。花圃
   * 位置跟著 HOSPITAL 設定值算(大樓正面 = x+d/2),滑桿再調 x/z/w/d
   * 花圃會跟著大樓一起動;路燈用 `placeAlleyLamp()`(async 載入真 3D
   * 路燈模型,不方便隨滑桿重建,見 fortuneStall 周邊裝飾同一個理由)
   * 只在這裡放一次,之後再調位置滑桿路燈不會跟著動,需要的話手動改
   * 這裡的座標。
   *
   * 2026-09-04 第九輪,kc:「加上樓梯 在花圃中間 然後給我滑感」——
   * `stepsW`/`stepsD` 加進同一個 `HOSPITAL` 設定值,台階跟花圃一樣
   * 位置算式跟著 x/z/w/d 走,面板同步加兩個滑桿(不用等 kc 再抱怨滑桿
   * 不見了)。寬度預設 6,跟兩側花圃內緣淨空(w=24 時約 7.4)留一點
   * margin,不會一開始就穿模卡進花圃裡。 */
  const HOSPITAL = { x:-113, z:-16.5, w:24, d:24.5, h:21, stepsW:6, stepsD:3 };
  /* 2026-09-04 第十輪,kc:「我們先貼醫院的圖好了」——立面照片先只做
     正面(+x,面向街道那面),跟 policeStation() 同一套「素色先頂著,
     圖到位就換上」做法:hospitalFrontM 是正面專用材質,其餘 5 面
     (含背面/頂/底/兩側)共用 hospitalSideM 素色,不用另外生側面照片
     ——大樓深(d)雖然拉到 24.5,但巷子/隔壁店面擋住了兩側視角,玩家
     實際只看得到正面。圖檔 assets/tex/hospital-front.png,repeat/
     offset 先給一組保守初始值(1,1 / 0,0),kc 生完圖之後用
     tweakHospitalTexturePanel() 現場裁切,不用我猜公式。 */
  const hospitalFrontM = std({ color:0xb5b0a2, roughness:.75 });
  const hospitalSideM = std({ color:0x9c988c, roughness:.85 });
  new THREE.ImageLoader().load(TEX_DIR + 'hospital-front.png', img => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.repeat.set(1, 1); t.offset.set(0, 0);
    t.needsUpdate = true;
    hospitalFrontM.map = t; hospitalFrontM.color.setHex(0xffffff); hospitalFrontM.needsUpdate = true;
  }, undefined, () => {});
  const hospitalPotM = std({ color:0x7c7568, roughness:.9 });    // 花圃箱體
  const hospitalLeafM = std({ color:0x3f6b3a, roughness:.85 });  // 花圃植栽,先拿一塊綠色箱體佔位
  const hospitalStepM = std({ color:0x9c988c, roughness:.85 });  // 台階,跟警察局台階同一色
  /* 招牌(2026-09-04 第十輪第二次,kc:「奇怪招牌應該要分開吧」)——原本
     打算把「仁和醫院」字樣烤進 hospital-front.png 那張整面照片裡,跟
     policeStation() 同一招。kc 抓到:一般店面(row() 那套)招牌本來就是
     獨立的 signKey/signImage() 小物件,跟店面照片分開——這樣以後招牌
     文字要換、要重生圖,不用整張立面照片重拍,尺寸/位置也能自己調不被
     照片比例綁死。這裡先用一塊灰色招牌板佔位(跟 row() 招牌那套的完整
     signKey/signImage() 管線比,這裡量體是獨立蓋的,不走 row(),暫時
     沒有現成的 signKey 掛,先用素色板子,之後生招牌小圖再貼上去,不用
     另外接一套新機制)。 */
  const hospitalSignM = std({ color:0xe8e6de, roughness:.6 });
  const hospitalCollider = { x:0, z:0, hw:0, hd:0 };
  const hospitalPotColliders = [ { x:0, z:0, hw:0, hd:0 }, { x:0, z:0, hw:0, hd:0 } ];
  const hospitalDoor = { id:'hospital', name:'仁和醫院', x:0, z:0 };
  colliders.push(hospitalCollider, ...hospitalPotColliders);
  doors.push(hospitalDoor);
  let hospitalParts = [];
  function buildHospital(){
    hospitalParts.forEach(m => scene.remove(m));
    hospitalParts = [];
    const { x, z, w, d, h, stepsW, stepsD } = HOSPITAL;
    const put = (...a) => hospitalParts.push(add(...a));
    /* BoxGeometry 六面材質陣列順序 [+x,-x,+y,-y,+z,-z](跟 row() 那段
       `mainIdx = axis==='x'?(face>0?4:5):(face>0?0:1)` 反推出來的順序
       一致)——index0 是 +x,正是大樓朝街道那面。 */
    put(box(w, h, d, [hospitalFrontM, hospitalSideM, hospitalSideM, hospitalSideM, hospitalSideM, hospitalSideM]), x, h/2, z);
    hospitalCollider.x = x; hospitalCollider.z = z; hospitalCollider.hw = w/2; hospitalCollider.hd = d/2;
    /* 門口互動座標貼著大樓面向街道那一側(+x 面)往外推 2.4,跟 row()
       原本 `if(s.id) doors.push(...)` 的算式同一招——沒有廣場,玩家站在
       人行道(x<=-93,見 CITY.WALK_W)就能觸發,不用走進大樓量體範圍。 */
    const frontX = x + d/2;
    hospitalDoor.x = frontX + 2.4; hospitalDoor.z = z;

    /* 招牌板,橫在入口上方,獨立於立面照片(見上面長筆記)——寬度跟樓梯
       同一個量級(stepsW+3,比入口寬一截才夠壓場),高度固定 2.2,y 用
       大樓高的比例抓(h*.32),大樓高滑桿調整時招牌高度會跟著等比例走。 */
    put(box(.3, 2.2, stepsW+3, hospitalSignM), frontX + .2, h*.32, z, false, true);
  }
  buildHospital();
  /* 雙路燈,貼花圃外側框住入口——只在初始定案位置放一次(見上面長筆記),
     不隨滑桿重建。 */
  placeAlleyLamp(HOSPITAL.x + HOSPITAL.d/2 + 3, HOSPITAL.z - HOSPITAL.w*.32);
  placeAlleyLamp(HOSPITAL.x + HOSPITAL.d/2 + 3, HOSPITAL.z + HOSPITAL.w*.32);

  /* 花圃+樓梯換真 3D 模型(2026-09-04 第十一輪,kc:「樓梯跟花圃有沒有
     3d模型」→「先給我花圃/樓梯」)——跟樹/路燈/警車/長椅同一套「先蓋
     灰模占位,glb 到了再替換」手法(見 realTree()/placeAlleyLamp() 等
     函式)。從 poly.pizza 下載:`planter-bushes.glb`(Planter & Bushes,
     J-Toastie,CC-BY,跟 litter-lunchbox.glb 同一個作者)、`stairs.glb`
     (Stairs,Quaternius,CC0),存進 assets/models/,記得補 CREDITS.md。
     位置跟花圃/台階原本的 box 版本(x/z/w/d 算出來的 frontX 等)完全
     沿用同一組數字,只是這輪固定寫死不再隨 x/z/w/d 滑桿即時重畫——跟
     雙路燈同一個理由(位置已經定案,滑桿階段結束,見上面雙路燈那則
     筆記)。
     2026-09-04 第十二輪,kc:「讓我調整大小跟花圃要轉90度」——跟
     tweakPoliceCarPanel()/tweakBusStopProps() 同一招,存 ref(mesh+
     基準座標)給 game.html 開滑桿即時調 scale/rotation.y,不用我猜角度
     猜半天。花圃初始旋轉直接套 90°(kc 已經講明是 90 度,不用再靠滑桿
     從 0 試),滑桿還是留著方便之後再微調。 */
  const hospitalPropRef = { planters: [], stairs: null };
  const hospFrontX = HOSPITAL.x + HOSPITAL.d/2, hospZ = HOSPITAL.z, hospW = HOSPITAL.w;
  [hospZ - hospW*.22, hospZ + hospW*.22].forEach((pz, i) => {
    hospitalPotColliders[i].x = hospFrontX + .8; hospitalPotColliders[i].z = pz;
    hospitalPotColliders[i].hw = .9; hospitalPotColliders[i].hd = 1.6;
    const fallback = [
      add(box(1.8, .7, 3.2, hospitalPotM), hospFrontX + .8, .35, pz, false, true),
      add(box(1.3, .5, 2.6, hospitalLeafM), hospFrontX + .8, .82, pz, false, true)
    ];
    loadModel('planter-bushes.glb').then(gltf => {
      fallback.forEach(m => scene.remove(m));
      const g = add(propModel(THREE, gltf, 3.2, 'z'), hospFrontX + .8, 0, pz, true, true);
      g.rotation.y = Math.PI/2;
      hospitalPropRef.planters.push({ mesh:g, baseX:hospFrontX + .8, baseY:0, baseZ:pz });
    }).catch(() => {});
  });
  {
    const stepsFallback = add(box(HOSPITAL.stepsD, .35, HOSPITAL.stepsW, hospitalStepM),
      hospFrontX + HOSPITAL.stepsD/2, .18, hospZ, false, true);
    loadModel('stairs.glb').then(gltf => {
      scene.remove(stepsFallback);
      const g = add(propModel(THREE, gltf, HOSPITAL.stepsW, 'x'), hospFrontX + HOSPITAL.stepsD/2, 0, hospZ, true, true);
      g.rotation.y = Math.PI/2;
      hospitalPropRef.stairs = { mesh:g, baseX:hospFrontX + HOSPITAL.stepsD/2, baseY:0, baseZ:hospZ };
    }).catch(() => {});
  }
  /* landmark 飄浮字先不加——量體/立面(招牌/台階/雨遮)還沒疊完,等
     全部定案再補一次,不要現在加了之後之後又要跟著搬。 */

  /* ===== 巷子:把兩條橫街接起來,走過去就是了 =====
   * 冷氣機/電表箱箱體尺寸沿革(第十五→二十二輪,2026-08-18):從「一張照片
   * 貼滿六面被拉伸」一路修到「拿 PIL 量正面+側面雙視圖的真實 bounding box
   * 反推長寬高比例」,中間還踩過「兩張圖不是乾淨 50/50 對切」的坑。最後量出
   * 冷氣機正面 953×776(w:h=1.228)、側面 440×789(d:h=0.558);電表箱正面
   * 697×977(w:h=0.713)、側面 434×953(d:h=0.455)。第二十四輪把這批箱體從
   * `acBoxMats`/`meterboxMats`(MeshStandardMaterial+場景燈光,材質陣列
   * 邏輯)整個換掉,改用下面 wallUnit() 那套(MeshBasicMaterial,正面貼 ±x、
   * 側面貼 ±z),數值定案版本見下面 AC_DIMS/MB_DIMS 那兩行,這裡不重複列。 */
  /* 巷子牆貼圖,一種長度一顆材質(2026-08-18 第十輪,理由見上面 M 那段
     「第十輪」註解——不能像其他貼圖一樣共用一顆材質+repeat 貼滿整面牆,
     這張圖的電表/管線/海報都是特定位置的獨一無二細節,repeat 兩次就是
     複製貼上,一眼看得出來)。圖只真的下載一次(`alleyWallImg` 快取
     HTMLImageElement,`alleyWallPending` 存還沒套用的 callback),每種
     長度各自建一顆 Texture 算自己的裁切,跟 shopFront() 處理門面長寬比
     對不上時的手法一模一樣:圖比目標窄就裁切上下,圖比目標寬就裁切
     左右,不拉伸。 */
  let alleyWallImg = null;
  const alleyWallPending = [];
  loader.load(TEX_DIR + 'alley-wall.png?v=4', img => {
    alleyWallImg = img;
    alleyWallPending.forEach(fn => fn(img));
    alleyWallPending.length = 0;
  }, undefined, () => {});
  const alleyWallMats = {};
  function alleyWallMaterial(len){
    if(alleyWallMats[len]) return alleyWallMats[len];
    const m = std({ color:0xcac2b2, roughness:.92 });
    alleyWallMats[len] = m;
    const apply = img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const targetAspect = len/13, ia = img.width/img.height;
      if(ia > targetAspect){ const r = targetAspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2,0); }
      else { const r = ia/targetAspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      t.needsUpdate = true;
      m.map = t; m.color.setHex(0xffffff); m.needsUpdate = true;
    };
    if(alleyWallImg) apply(alleyWallImg); else alleyWallPending.push(apply);
    return m;
  }
  /* 巷子牆的側面(2026-08-18 第十二輪,kc 截圖抓到):`box(6,13,len,m)` 傳
     單一材質會貼滿全部六面,包括巷口露出來的那個窄側面(6×13,跟牆厚同寬)
     ——那個面套的裁切是照「長邊面向走道」那個比例算的(len:13),硬套到
     窄側面上會被擠壓變形。kc 原話「只要貼巷子內部的大牆就好,這種側面貼
     純材質即可」——改傳材質陣列,只有 ±x 那兩個面向走道的大面貼照片,
     其餘四面(含側面/頂/底)貼一顆沒有貼圖的純色材質(貼近照片平均色調,
     不會突兀跳色)。BoxGeometry 材質陣列順序是 [+x,-x,+y,-y,+z,-z],跟
     `acBoxMats` 那組已經在用的順序一致。第十三輪:純色被 kc 打回票,
     `M.alleyWallSide` 換成第一版 alley-wall.png(見上面 M 那段註解),
     這裡直接引用 M 物件那顆,不再是這個函式自己的區域變數。 */
  function alleyWallFaces(len){
    const front = alleyWallMaterial(len);
    return [front, front, M.alleyWallSide, M.alleyWallSide, M.alleyWallSide, M.alleyWallSide];
  }
  /* 巷子路燈(2026-08-18):原本是一顆浮貼牆上、居中懸空的發光箱體,kc 說
     「奇怪的燈」——換真的路燈模型,跟 placeLantern()/temple() 同一套
     「沒載到模型前先用發光箱體佔位,不會空著」邏輯。模型抓 Poly Pizza
     的免費路燈(Poly by Google,CC-BY 3.0,授權見 assets/models/CREDITS.md,
     跟 dog/cat/lantern 同一個作者家族)。改成立在巷子地板上、貼著一側牆
     (不再懸空居中),跟 H_ROADS 那批路燈同一種「立在人行道邊」邏輯,
     只是矮一截配合巷子比例(巷子牆只有 13 高,撐不住大路那種 15 單位
     燈柱)。solid() 給一顆小碰撞,跟其他立地道具同一套慣例,細長柱體
     不太會真的擋到人。第十八輪:kc 說「路燈要高一點」,7.5→10(還是比
     牆矮,13 高的牆撐不住太誇張的燈柱,但比原本高快 1/3)。 */
  function placeAlleyLamp(x, z){
    const size = 10, headY = size*.9;
    const fallback = box(1.3,.32,.9, glow(0xffb060,2.0));
    const holder = add(fallback, x, headY, z, false, false);
    loadModel('street-lamp.glb').then(gltf => {
      scene.remove(holder);
      add(propModel(THREE, gltf, size, 'y', 0), x, 0, z, true, false);
    }).catch(() => {});
    /* 光強度/顏色(2026-08-18 第三輪,照參考圖加深暗巷裡那圈燈池的對比):
       原本 i:26 太均勻,整條巷子被打得差不多亮——調高強度、縮小 r(範圍),
       讓光在燈下拉出一圈明顯的亮池,離開範圍很快就吃掉,不是均勻打亮全巷。
       顏色也調暖一截(0xffe6a8→0xffb060),搭配巷子牆變暗之後對比更明顯。
       第十八輪:kc 明講「燈光也可以 tweak」,連續好幾輪東西看不到,這次
       直接把範圍/強度拉高一截(r:20→30,i:46→60),不再堅持第三輪那種
       「只有燈下一小圈亮」的緊縮效果,換取整條巷子細節讀得出來優先。 */
    lampSpots.push({ x, y:headY, z, c:0xffb060, i:60, r:30 });
    solid(x, z, .3, .3);
  }
  /* 巷子補光(2026-08-18 第十六輪):kc 連續好幾輪抓到「牆上的東西根本沒有
     啊」——冷氣機箱體實測(拿 __dbg 把材質暫時換成高強度發光色驗證過)
     材質/貼圖/幾何全部是對的,問題是路燈那組 i:46,r:20(第三輪為了「一圈
     圈亮池」故意調緊的,見上面那則註解)範圍太小、太集中,牆面大半段
     只剩全城共用的 hemisphere/directional 環境光在撐,而那組環境光本來
     就是給室外大街用的亮度,巷子牆的暗色材質(M.tin/M.metal 這批)在那個
     亮度下幾乎讀不出來。不能動全城共用的環境光(會拖動大街觀感),改成
     在巷子中央加一顆大範圍、低強度的暖灰補光——只墊高巷子這個局部範圍的
     基礎亮度,不再造出第二圈搶眼的亮池(半徑夠大、強度夠低,肉眼看不太
     出來這是一顆燈,只會覺得巷子整體沒那麼死黑)。
     第十八輪:跟路燈那組一起調亮(i:16→28,r:34→42),kc 明講可以 tweak
     燈光,不用再手下留情。 */
  function alleyFill(x, z){
    /* y 從 7→4.5(第十八輪同一次調整):冷氣機箱體貼牆、面朝走道(±x
       法線),高度落在 4.4 附近——原本補光架在 y:7(接近路燈高度),
       跟箱體正面法線幾乎垂直,漫射光貢獻很少。補光壓低到跟箱體同一個
       高度帶,光線方向比較貼平走道,照到箱體正面的角度才有效。 */
    lampSpots.push({ x, y:4.5, z, c:0xcfa980, i:28, r:42 });
  }
  /* 巷子橫牽電線(2026-08-18 第六輪,照 kc 給的參考截圖——那張最上緣有一條
     斜斜橫過巷子的電纜,現在的巷子頭頂完全是空的)。跟 H_ROADS 電線杆之間
     牽線同一套 TubeGeometry+QuadraticBezierCurve3 做法,只是這裡是牆對牆
     橫跨巷子寬度,不是杆對杆沿街跑。純裝飾,沒有碰撞、沒有陰影(跟街上
     那批電線同一個理由:細長 tube 陰影意義不大,省效能)。 */
  function alleyWire(x0, z0, x1, z1, y, sag){
    const p0 = new THREE.Vector3(x0, y, z0);
    const p1 = new THREE.Vector3(x1, y, z1);
    const mid = new THREE.Vector3((x0+x1)/2, y-sag, (z0+z1)/2);
    const wire = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 10, .035, 4, false),
      M.wire
    );
    wire.castShadow = false; wire.receiveShadow = false;
    scene.add(wire);
  }
  /* 紙箱堆/排水溝蓋(2026-08-18 第七輪,kc 說「還久得很」,繼續補雜物,
     不等貼圖那條線也一起推):牆角堆疊兩顆大小不一的紙箱打斷牆基那條
     太乾淨的線,溝蓋借 M.recess(本來就是深色凹陷材質)貼在地板上,
     跟 litter 同一套「墊在地板厚度之上、不要埋進去」的 y=.29。都不呼叫
     solid() 除了紙箱堆——紙箱堆疊起來有實際體積,擋一下路合理;溝蓋是
     平貼地板的裝飾,不擋。 */
  /* 第十七輪修正(2026-08-18,kc 截圖抓到「奇怪樓梯」):原本上面那顆小箱子
     用 (x+.18, z-.12) 位移疊在下面那顆的一個角上,兩顆大小又不一樣,輪廓
     疊出一階一階的樓梯形狀,不像紙箱堆。改成兩顆箱子同一個 (x,z) 中心
     疊放,只用旋轉(不是位移)做出「隨手疊的、沒對齊」的感覺——旋轉不會
     破壞疊放的外輪廓,位移會。
     第二十八輪(2026-08-18,cardboard.png 貼圖接上之後):kc 說「紙箱可以
     多一點有雜物感」——原本只有兩顆乾淨疊放的箱子,規規矩矩一個壓一個,
     看起來像剛搬來的貨,不像巷子裡沒人管的舊紙箱堆。補兩個元素:一顆
     斜靠在主堆旁邊、位置偏移+z 軸也歪斜(不是單純疊高,像是堆不下滑下來
     靠著的那顆);一片壓扁攤平的紙箱(高度壓到 .12,接近攤平的破紙箱)
     躺在地上,暗示「這堆東西已經放很久、有的已經被踩爛/淋濕塌掉」。
     solid() 範圍跟著新的外輪廓放大一點,不然扁掉那片紙箱會讓人穿模走過去。
     **待辦已排查(2026-08-19)**:kc 回報「箱子根本沒貼到圖」那次,重新用
     __dbg.at() 傳到 crateStack() 實際座標近看截圖,貼圖其實有正確渲染
     (看得到瓦楞紙摺痕),不是程式漏接——結論見 DESIGN_NOTES「紙箱貼圖
     待辦排查」那節,不在這裡重複整段理由。 */
  function crateStack(x, z){
    const base = box(1.0,.8,.8, M.cardboard);
    base.rotation.y = .12;
    add(base, x, .4, z, true, false);
    const top = box(.7,.6,.6, M.cardboard);
    top.rotation.y = .35;
    add(top, x, 1.1, z, true, false);
    const lean = box(.55,.5,.45, M.cardboard);
    lean.rotation.y = -.6; lean.rotation.z = .22;
    add(lean, x+.62, .25, z-.38, true, false);
    const flat = box(.85,.12,.65, M.cardboard);
    flat.rotation.y = .8;
    add(flat, x-.68, .07, z+.42, true, false);
    solid(x, z, .95, .85);
  }
  function drainGrate(x, z){
    const g = new THREE.Mesh(new THREE.PlaneGeometry(.7,.5), M.recess);
    g.rotation.x = -Math.PI/2;
    add(g, x, .29, z, false, false);
  }
  /* 冷氣機/電表箱掛牆版本(2026-08-18 第二十四輪):在大街上用綠色佔位方塊+
     debugTexturedBox() 驗證過「正面貼 ±x、側面貼 ±z、頂/底/背面留素色」這套
     BoxGeometry 材質陣列邏輯沒問題之後,kc 直接要求砍掉大街測試方塊跟巷子裡
     舊的 acBoxMats/meterboxMats 註解版本(材質陣列邏輯換了,沿用舊註解容易
     對錯位置),兩種箱體用同一套做法直接掛回真的巷子牆上。目前還是用
     MeshBasicMaterial(不吃場景燈光)——先把「掛牆位置對不對、貼圖對不對」
     這件事驗證掉,巷子那組場景燈光不夠亮的問題(見上面 alleyFill 那一長串
     燈光筆記)之後再處理,不要混在一起 debug。掛牆高度不能太低:kc 明講
     「不要太低」,電表箱之前用 addProp() 卡片版直接貼地面(底部碰地,y=h/2)
     ——這輪兩種箱體都抬到腰部以上的掛牆高度(冷氣 y=5.4 接近牆頂、電表箱
     y=2.4 齊腰),不是隨手擺在地上的雜物。
     第二十五輪:kc 補了頂面照片(跟正面/側面同一批六宮格參考圖裡的第三張),
     貼上 +y(這個俯視視角的鏡頭其實常常看得到方塊頂面,不是無所謂的面)。
     沒有底面照片——箱體貼牆懸空,底面朝下對著巷子地板,這個鏡頭角度看不到,
     不生圖硬湊,留素色深灰(不再用綠色佔位,綠色是「還沒貼圖」的訊號,頂面
     補上之後只剩底面沒有真的照片,用接近鐵皮的深灰比亮綠色合理)。 */
  /* 明暗度(2026-08-18 第二十七輪):kc 說貼圖看起來太亮太平——這批照片是
     白天平光拍的產品照,MeshBasicMaterial 不吃場景光照,貼上去就是原圖
     100% 亮度,跟巷子其他材質(靠 M.wall/M.tin 這批 tint 壓過的貼圖,見上面
     loader 那段「AI 給的是白天平光的照片,直接丟進夜景會太亮」的同一個
     教訓)比起來太搶眼、也太平沒有明暗層次。用同一招——貼圖真的載入後把
     材質色從純白壓到 WALLUNIT_TINT 這個灰階,乘掉一截亮度。這裡選了
     0xb0b0b0(~69%),不喜歡的話這一個常數改掉就好,不用逐一改呼叫點。 */
  const WALLUNIT_TINT = 0xb0b0b0;
  function wallUnit(w, h, d, frontFile, sideFile, topFile, cx, cy, cz, ry){
    const flat = c => new THREE.MeshBasicMaterial({ color:c });
    const frontMat = flat(0x22ff44), sideMat = flat(0x22ff44), topMat = flat(0x22ff44);
    const bottomMat = flat(0x2a2a28);
    const mesh = add(box(w, h, d, [frontMat, frontMat, topMat, bottomMat, sideMat, sideMat]), cx, cy, cz, true, false);
    mesh.rotation.y = ry || 0;
    [[frontFile, frontMat], [sideFile, sideMat], [topFile, topMat]].forEach(([file, mat]) => {
      loader.load(TEX_DIR + file, img => {
        const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
        mat.map = t; mat.color.setHex(WALLUNIT_TINT); mat.needsUpdate = true;
      });
    });
    return mesh;
  }
  /* 冷氣機管線(2026-08-18 第二十七輪):kc 抓到「冷氣機附近沒有管線很怪」
   * ——真的冷氣室外機一定有一條銅管/排水管沿牆面往下接,現在箱體是憑空
   * 貼在牆上,沒有這條線索就很像 3D 建模隨手擺的道具,不像真的裝過的
   * 設備。補一條簡單的直管,從箱體底部沿牆拉到地面,借 M.wire(已經是
   * 深色,巷子橫牽電線同一顆材質)不用另開材質。只給冷氣機加,電表箱
   * 本身不接這種外露管線,不用比照辦理。 */
  function addPipe(x, yTop, yBot, z, r){
    const h = yTop - yBot;
    if(h <= 0) return;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r||.045, r||.045, h, 6), M.wire);
    mesh.position.set(x, yBot + h/2, z);
    mesh.castShadow = false; mesh.receiveShadow = false;
    scene.add(mesh);
  }
  const AC_DIMS = [.78,1.4,1.72];
  const AC_FILES = ['ac-unit.png?v=4', 'ac-unit-side.png', 'ac-unit-top.png'];
  const MB_DIMS = [.59,1.3,.93];
  const MB_FILES = ['meterbox-unit.png?v=2', 'meterbox-unit-side.png', 'meterbox-unit-top.png'];
  /* 掛牆高度分層(2026-08-18 第二十六輪):kc 丟了一張擺放參考圖,標示冷氣
     室外機高/中/低三檔(離地約 2.6m/1.2m/0.4m)、電箱「橫向一排」跟「單個」
     兩檔(離地約 1.8m/1.0m),明講「不要全部同一高度」「不要全部對齊」。
     1 單位≈0.42 米(跟下面 PLAYER 那條註解換算 Vespa 車長用的同一個比例尺),
     離地高度換算成箱體中心 y 要加半個箱高(add() 吃的是幾何中心,不是底部):
     冷氣 h=1.4→半高 .7,電箱 h=1.3→半高 .65。 */
  const AC_Y = { high: 2.6/.42 + .7, mid: 1.2/.42 + .7, low: .4/.42 + .7 };
  const MB_Y = { row: 1.8/.42 + .65, single: 1.0/.42 + .65 };
  const AC_TIER = ['high','mid','low'];
  const alleys = [];
  /* 嵌進巷子牆面的窄店門,比照 richStoreFront() 的「凹進去+鋁框+暖光」
     邏輯簡化(巷子門面本來就該窄小寒酸,不是正常店面規格)。side:+1 東牆
     (內面朝 -x)/-1 西牆(內面朝 +x),z 是沿巷子長度的世界座標。 */
  function buildAlleyShopfront(x, HW, sz, side, cfg){
    const { id, label } = cfg;
    const DW = 2.4, DH = 4.4, RECESS = .3;
    const innerX = x + side*HW;                       // 巷子牆內側面(面朝走道)
    /* 門半開(2026-09-03,kc:「門做成半開 裡面黑色就好反正很昏暗」)——
       不用等 shop-massage.png 這張圖了,退回不用貼圖的做法:凹進去那個
       洞維持全黑(近黑色,不是 M.recess 那個帶一點灰的深色,巷子本來就暗,
       黑洞看起來就是「看不清楚裡面」,不用假裝有東西可看),門片本身是
       另一塊獨立薄板,繞著門洞其中一側的軸轉開一個角度,擋住大半個門洞、
       露出一道黑縫——比「門關著」更清楚讀出「這是一扇門,不是一塊死板」。 */
    /* 黑洞深度(2026-09-03 第二輪,kc:「原本的門要拔掉啊 那邊就是變成挖
       一個黑洞的感覺」)——第一版黑色面板跟門片幾乎貼在同一個深度,兩塊
       東西疊在一起,看起來像「兩扇門」而不是「一扇門開著、後面是暗的」。
       黑色面板退到牆裡面 HOLE_DEPTH(接近 richStoreFront 那套真的洞的
       深度量級),門片留在洞口附近,深度分開了才讀得出「這是洞,不是另
       一片板子」。 */
    /* 第四輪,kc:「原本的牆壁是一個正方體 所以你需要挖洞進去 做不到也
       很簡單 針對門的地方再貼一張沒有厚度的純黑紙就可以了」——牆本身是
       alley() 蓋的一整塊實心箱體,沒有真的挖穿(three.js 沒有現成的
       CSG 布林運算,真的要挖要把牆拆成好幾塊箱體繞開洞口,成本高很多)。
       採 kc 給的簡單解法:不用箱體,退進牆裡的位置改貼一張零厚度的
       PlaneGeometry(沒有側面/邊緣可以被誤讀成「另一塊板子」),法向
       朝走道(-side 方向),兩面都上色(DoubleSide)保險。 */
    /* 第五輪,kc:「我沒看到」——查出真正的原因:牆本身是實心箱體
       (`x±3` 都是牆),HOLE_DEPTH=1.1 把這片紙埋在牆的實心體積裡面,
       牆自己的正面(貼圖那面)整片擋在紙前面,紙從任何角度都被遮住,
       等於根本沒有畫出來。退牆深度該是負值(往走道那側探出一點點,
       貼在牆面上,不是往牆裡塞)——改成 -.03(比牆面略凸一點點,避免
       跟牆面同一深度打架/z-fighting),同時留一顆滑桿(見 game.html
       tweakMassageDoorPanel())讓 kc 自己現場找感覺對的深度,不用再靠
       截圖來回猜。 */
    /* 第六輪,kc:「這邊要做成純黑的黑洞不能有反光 不能會破功」——位置
       對了之後才發現剩下的問題是材質:`std()` 是 MeshStandardMaterial
       (PBR),就算 roughness 拉到 .95 還是會吃光源算高光,巷子那盞粉紅
       招牌燈近距離打上去會在紙片上留一點亮斑,黑洞看起來像「有光澤的
       深色板子」而不是真的無反射的洞。換成 MeshBasicMaterial——完全
       不計算光照,不管旁邊有幾盞燈都固定是同一個純黑色,沒有高光可以
       破功。 */
    const HOLE_DEPTH = -.03;
    const dark = new THREE.MeshBasicMaterial({ color:0x000000, side:THREE.DoubleSide });
    const holePlane = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), dark);
    holePlane.rotation.y = -side * Math.PI/2;
    add(holePlane, innerX + side*HOLE_DEPTH, DH/2, sz, false, false);
    /* 第七輪,kc:「給我提示詞我去生圖好了 做成凹進去的嘿嘿感」——沒圖
       之前維持純黑(MeshBasicMaterial 不吃光,上面第六輪那則筆記),圖
       生完直接放 assets/tex/shop-massage.png 就會自動接上,不用再改
       程式。裁切邏輯跟 shopFront()/signImage() 同一套(依實際門片寬高
       比 DW/DH 置中裁切,不拉伸),套圖後材質顏色要轉白(MeshBasicMaterial
       的 color 跟 map 是相乘關係,黑底 0x000000 乘任何貼圖都還是純黑,
       這是 shopFront() 的 applyImg() 也在做的同一步,不是新踩的坑)。
       材質維持 MeshBasicMaterial(不吃光),圖片本身的明暗就要靠生圖時
       自己壓,不能指望場景燈光幫忙打暗。 */
    loader.load(TEX_DIR + 'shop-massage.png', img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const targetAspect = DW/DH, ia = img.width/img.height;
      if(ia > targetAspect){ const r = targetAspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2,0); }
      else { const r = ia/targetAspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      t.needsUpdate = true;
      dark.map = t; dark.color.setHex(0xffffff); dark.needsUpdate = true;
    }, undefined, () => {});
    massageDoorRef.holePlane = holePlane;
    massageDoorRef.base = { innerX, side, sz };
    const fm = frameMaterial(THREE);
    /* 第三輪,kc:「還是有鐵門 要刪掉」——上面那塊「門框」原本是一整塊
       實心薄板(`box(.16, DH+.3, DW+.3, fm)`),尺寸幾乎跟門洞一樣大,
       等於在洞口正前方又焊了一塊鐵灰色平板,肉眼看起來就是第二扇關著
       的鐵門,不是裝飾邊框。不是「調淡」的問題,是這塊板子整個不該
       存在——直接刪掉,門洞邊緣就交給牆體本身的厚度收邊,不用額外補
       一圈假框。 */
    /* 門片:鉸鏈設在門洞靠 z0(sz-DW/2)那一側,繞 Y 軸轉開,材質沿用
       frameMaterial()(門框同一種深色木紋,沒圖時退回深灰,不用另開一顆
       材質)。轉開方向讓門片往走道外推(側面法線 -side),跟人從走道
       推門進去的直覺一致。門片留在洞口(接近牆面),不跟著黑色面板退進去
       ——門是「開著擋在洞口旁邊」,不是也躲進黑洞裡。 */
    const leafW = DW * .92, leafT = .08, hingeZ = sz - DW/2;
    const doorGroup = new THREE.Group();
    doorGroup.position.set(innerX + side*(RECESS*.5), DH/2, hingeZ);
    doorGroup.rotation.y = -side * .55;
    const leaf = box(leafT, DH - .1, leafW, fm);
    leaf.position.set(0, 0, leafW/2);
    leaf.castShadow = true; leaf.receiveShadow = true;
    doorGroup.add(leaf);
    scene.add(doorGroup);
    massageDoorRef.doorGroup = doorGroup;
    /* 第八輪,kc:「為何有奇怪的招牌 刪掉啦」——原本比照 row() 店面掛一塊
       縮小壓暗的招牌箱體,kc 覺得奇怪,直接刪掉不留。巷子裡這種門本來
       就不用掛招牌才符合「暗巷、不張揚」的調性,少一塊東西反而更對。 */
    /* 燈的強度(2026-09-03 第二輪)——原本 i:9 把退進牆裡的黑洞打得太亮,
       黑洞變成一片粉紅,跟「裡面黑色就好」的要求相反。壓到 i:3,只留一點
       曖昧的粉紅色氣氛(招牌本身的光),不會把黑洞蓋過去。 */
    lampSpots.push({ x:innerX - side*.4, y:3.4, z:sz, c:0xd8608c, i:3, r:7 });
    doors.push({ id, name:label, x:innerX - side*1.6, z:sz });
  }
  /* 巷子店面(2026-09-03,kc:「兩個店都要3D場景裡面有店面」)——越式按摩
     那位 ALLEY_WORKER(game.html)一直是站在巷子的素牆(冷氣機/電表箱那套
     通用裝飾)前面講話,沒有真的店門,「有店面」名不符實。alley() 加一個
     可選的第五參數 opts.shopfront,只有 光明巷 那通呼叫會傳,太平巷不受
     影響。材質沿用 shopFront()/signImage() 既有管線(沒圖先素色,kc 生完
     `assets/tex/shop-massage.png`/`sign-massage.png` 自動接上),不用另開
     一套貼圖系統。 */
  function alley(x, z0, z1, name, opts){
    alleys.push({ x, z0, z1, name });                  // 小地圖要畫,別在外面重算一次
    /* 巷子寬度(2026-08-18 第四輪加寬到 3.6、第九輪 kc 說「不要加寬好了」
       改回來)——維持 3.2,跟 alleyDiag() 的 3.6 不一致,kc 接受這個不一致,
       不用特地拉齊。 */
    const HW = 3.2, len = Math.abs(z1-z0), cz = (z0+z1)/2;
    const sf = opts && opts.shopfront;
    add(box(HW*2+8, .28, len, M.alleyFloor), x, .14, cz, false, true);
    [-1,1].forEach(s => {
      add(box(6, 13, len, alleyWallFaces(len)), x + s*(HW+3), 6.5, cz);
      solid(x + s*(HW+3), cz, 3, len/2);
    });
    /* 第二十四輪:掛牆版冷氣機/電表箱(見上面 wallUnit 那則長筆記)。第二十六輪
       照 kc 的擺放參考圖重排:冷氣 4 顆輪流吃 AC_Y 高/中/低三檔,不再全部
       同一個 y;電箱從「3 顆各自散開」改成「1 排 3 個緊靠+1 個單獨」,跟
       參考圖裡「電箱(橫向一排)」+「電箱(單個)」那組構圖一致。第二十七輪
       每顆冷氣機補一條 addPipe() 管線(見上面那則筆記),偏移量抓箱體
       正面寬度(AC_DIMS[2])的 .42 倍,落在箱體邊緣附近、不會穿模。
       有 shopfront 時,跳過跟店面同一側、z 落在店門範圍內的那顆冷氣機
       ——不然箱體會直接穿模長在店門正中央。 */
    [.1,.38,.64,.9].forEach((f, i) => {
      const zz = z0 + (z1-z0)*f;
      const side = i%2 ? 1 : -1;
      if(sf && sf.side === side && Math.abs(zz - sf.z) < 2.5) return;
      const ux = x + side*(HW-.3);
      const uy = AC_Y[AC_TIER[i%3]];
      wallUnit(...AC_DIMS, ...AC_FILES, ux, uy, zz);
      addPipe(ux, uy - AC_DIMS[1]/2, .3, zz + AC_DIMS[2]*.42);
    });
    if(sf) buildAlleyShopfront(x, HW, sf.z, sf.side, sf);
    const mbRowZ = z0 + (z1-z0)*.5;
    [-1.1,0,1.1].forEach(dz =>
      wallUnit(...MB_DIMS, ...MB_FILES, x - (HW-.3), MB_Y.row, mbRowZ + dz));
    wallUnit(...MB_DIMS, ...MB_FILES, x + (HW-.3), MB_Y.single, z0 + (z1-z0)*.18);
    [0, .32].forEach((f, i) => {
      const lz = cz + (z1-z0)*f;
      placeAlleyLamp(x + (i%2?1:-1)*(HW-.6), lz);
    });
    [[.12,12.3,.5],[.45,11.7,.9],[.78,12.5,.35]].forEach(([f,y,sag]) => {
      const zz = z0 + (z1-z0)*f;
      alleyWire(x-(HW+3), zz, x+(HW+3), zz+1.2, y, sag);
    });
    crateStack(x + (HW-.6), z0 + (z1-z0)*.58);
    crateStack(x - (HW-.6), z0 + (z1-z0)*.28);
    drainGrate(x - (HW-.5), z0 + (z1-z0)*.84);
    alleyFill(x, cz);
  }
  /* 兩條巷子的端點也是寫死舊路口位置(-78/72),街道骨架收緊後路口挪到
     -84/84,巷子端點沒跟著移就會接不到新的店面排(同一輪 kc 截圖「怪房子」
     抓到的另一處)。
     巷名(2026-09-02,kc:「每條巷子都要有名字」)——這條(嫖妓互動那條)
     kc 親自定案「光明巷」,反諷意味明顯(呼應 CLAUDE.md 基準線,是巷子
     的名字在反諷,不是嘲笑角色本身)。另外兩條 kc 沒指定,挑了兩個台灣
     巷弄常見、語感中性的名字(太平巷/自強巷),不強加反諷——不是每條巷
     都要複製「光明巷」那個反差,那樣會濫用同一招。這兩個是我選的,kc
     不喜歡可以直接換。 */
  /* shopfront.z=-38 對齊 game.html 的 ALLEY_WORKER.z(-38)——她站的位置
     本來就已經偏東牆(x:-22.3,巷子中心 x=-24),店門開在她面前那面牆上,
     不用另外挪她的座標。 */
  alley(-72 + 4*UNIT, -B_LINE - DEPTH/2, -84 + B_LINE + DEPTH/2, '光明巷',
    { shopfront:{ side:1, z:-38, id:'massage', label:'越式按摩' } });   // 中華路 ⇄ 廟口路
  alley(-60 + 2*UNIT,  B_LINE + DEPTH/2,  84 - B_LINE - DEPTH/2, '太平巷');   // 中華路 ⇄ 後火車站

  /* ===== 斜巷:跟 alley() 同一套「兩排素牆夾一條走道」邏輯,只是不沿 x/z
   * 軸走,是斜的(2026-08-13——kc 說圓環、廟埕那些都是路口貼裝飾,路本身
   * 還是直的;這條路本身就是斜的,呼應老市區地界不平整長出來的斜切捷徑)。
   * 角度靠 rotation.y = atan2(dx,dz) 轉,跟玩家轉向、alley() 的牆用同一套
   * 三角函數。碰撞箱用旋轉矩形的軸對齊包絡框(AABB)概略擋,巷子兩邊本來
   * 就是空的街廓內部,擋多一點無傷。 */
  const diagAlleys = [];
  function alleyDiag(x0, z0, x1, z1, name){
    diagAlleys.push({ x0, z0, x1, z1, name });
    const dx = x1-x0, dz = z1-z0, len = Math.hypot(dx,dz), ang = Math.atan2(dx,dz);
    const ux = Math.sin(ang), uz = Math.cos(ang);      // 沿線方向單位向量
    const nx = Math.cos(ang), nz = -Math.sin(ang);     // 垂直方向單位向量
    const cx = (x0+x1)/2, cz = (z0+z1)/2;
    const at = (along, side) => [cx + ux*along + nx*side, cz + uz*along + nz*side];
    const HW = 3.6;

    const floor = box(HW*2+8, .28, len, M.alleyFloor);
    floor.rotation.y = ang;
    add(floor, cx, .14, cz, false, true);

    [-1,1].forEach(s => {
      const wall = box(6, 13, len, alleyWallFaces(len));
      wall.rotation.y = ang;
      const [wx,wz] = at(0, s*(HW+3));
      add(wall, wx, 6.5, wz);
      solid(wx, wz, Math.abs(len/2*ux)+Math.abs(3*nx), Math.abs(len/2*uz)+Math.abs(3*nz));
    });
    /* 掛牆版冷氣機/電表箱,同一套跟 alley() 一致(見上面 wallUnit 那則
       筆記,高度分層見 AC_Y/MB_Y 那則第二十六輪筆記)。斜巷用 at(along, side)
       換算世界座標,fixture 跟牆一樣要轉 ry=ang,不然貼圖面沒對齊斜巷的
       走道方向。第二十七輪管線同一套,offset 加在 along 那個分量上
       (跟著 ux/uz 方向走,不是世界座標的 z),斜巷才不會偏掉。 */
    [-.4,-.1,.2,.45].forEach((f, i) => {
      const side = (i%2?1:-1)*(HW-.3);
      const [jx,jz] = at(len*f, side);
      const uy = AC_Y[AC_TIER[i%3]];
      wallUnit(...AC_DIMS, ...AC_FILES, jx, uy, jz, ang);
      const [px,pz] = at(len*f + AC_DIMS[2]*.42, side);
      addPipe(px, uy - AC_DIMS[1]/2, .3, pz);
    });
    [-1.1,0,1.1].forEach(dAlong => {
      const [rx,rz] = at(dAlong, -(HW-.3));
      wallUnit(...MB_DIMS, ...MB_FILES, rx, MB_Y.row, rz, ang);
    });
    {
      const [sx,sz] = at(len*-.3, HW-.3);
      wallUnit(...MB_DIMS, ...MB_FILES, sx, MB_Y.single, sz, ang);
    }
    [-.32,.32].forEach((f, i) => {
      const [lx,lz] = at(len*f, (i%2?1:-1)*(HW-.6));
      placeAlleyLamp(lx, lz);
    });
    [[-.35,12.3,.5],[0,11.7,.9],[.35,12.5,.35]].forEach(([f,y,sag]) => {
      const [wx0,wz0] = at(len*f, -(HW+3));
      const [wx1,wz1] = at(len*f, HW+3);
      alleyWire(wx0, wz0, wx1, wz1, y, sag);
    });
    const [cx2,cz2] = at(len*.2, HW-.6); crateStack(cx2, cz2);
    /* 第二十八輪:同一輪加密紙箱堆(見上面 crateStack() 那則筆記),沿線距離
       挑得夠遠(along=len*.4 vs 其他雜物大多落在 along≈0 附近),不會疊到
       電表箱排/水溝蓋。 */
    const [cx3,cz3] = at(len*.4, -(HW-.6)); crateStack(cx3, cz3);
    const [dx2,dz2] = at(len*-.2, -(HW-.5)); drainGrate(dx2, dz2);
    alleyFill(cx, cz);
  }
  alleyDiag(12, B_LINE+DEPTH/2, 48, 84-B_LINE-DEPTH/2, '自強巷');   // 中華路 ⇄ 後火車站,斜的那條(同一批舊路口 72→84 的坑)

  /* ===== 廟埕 ===== */
  (function temple(){
    const z = -108, W = 34;
    /* 廣場鋪面收整齊到廟口路邊界(2026-08-21,kc:「路面鋪超過廟的區域看起來
       很怪」)——石板原本故意凸出去蓋過路面(見下面舊筆記,2026-08-13 那次
       決定),那時候前提是有圍牆擋著,凸出的部分躲在牆後面看不到。現在廟口
       (z:-84)整段沒有牆、完全開放,石板凸出的南緣直接跟廟口路的柏油
       貼在一起,沒有東西界定分界,看起來很突兀。改成主石板+南緣那兩塊
       (原本凸出最多的)北緣不動、南緣收齊到 z:-84,跟廟口路邊界對齊,
       不再凸過去;離廟口路更遠的那兩塊(-100/-102,本來就沒凸出邊界)
       維持原樣,深淺變化還在,只是不再跟路面重疊。 */
    add(box(96,.3,19, M.stone), 0, .15, -93.5, false, true);
    /* 96×22 的矩形太乾淨了,跟旁邊的路網一樣方正——加幾塊大小不一、卡出去的
       石板,北緣(朝廟口路那側)故意凸進路面凸得深淺不一,讀起來像廣場自己
       長出去蓋過路面,不是切好角的方塊(2026-08-13,kc 覺得路網太方正,配合
       上面 H_ROADS 那段廟口路南側 curb 留空一起看)。y 故意抬 .01 蓋過底板,
       不然邊界重疊的地方會 z-fighting。 */
    [
      [-30, -86.5, 34, 5],
      [ 22, -86.5, 26, 5],
      [-52, -100, 14, 18],
      [ 46, -102, 12, 14]
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
    [[-9,3.4,'left'],[0,4.4,'center'],[9,3.4,'right']].forEach(([x,w,key]) =>
      add(box(w,6,.4, templeDoorMat(key, w/6)), x, 3, z+4.6, false, true));
    /* 燈籠:2026-08-14 kc 抓到「發光箱體很假」——原本是一顆會發光的純色箱子,
       換成 Poly Pizza 的免費燈籠模型(red lantern,Sophie Kim,CC-BY,授權見
       assets/models/CREDITS.md),跟遊具/垃圾/寵物同一套 propModel() 縮放置底
       邏輯,只是這裡是「掛著」不是「站在地上」——bottomY 往回推,讓模型
       中心對到原本箱體中心的高度,不是貼地。沒載到模型前先用原本的發光箱體
       佔位,不會空著。lampSpots 保留,模型本身不發光,還是要靠這個補光。 */
    function placeLantern(x, y, z){
      const size = 1.5, bottomY = y - size/2;
      const fallback = box(size, size, size, glow(0xe8442e,1.35));
      const holder = add(fallback, x, y, z, false, false);
      loadModel('lantern.glb').then(gltf => {
        scene.remove(holder);
        add(propModel(THREE, gltf, size, 'y', 0), x, bottomY, z, false, false);
      }).catch(() => {});
      lampSpots.push({ x, y, z, c:0xff8a5a, i:14, r:12 });
    }
    for(let k=0;k<8;k++){
      const x = -14.5 + k*4.15;
      add(box(.16,1.1,.16, M.metal), x, 9.4, z+5.3, false, false);
      placeLantern(x, 8, z+5.3);
    }
    lampSpots.push({ x:0, y:8, z:z+11, c:0xff8a5a, i:50, r:44 });
    const wash = new THREE.SpotLight(0xffd0a0, 90, 44, .72, .55, 1.4);
    wash.position.set(0, 7, z+24); wash.target.position.set(0, 8, z+4);
    scene.add(wash, wash.target);
    [-15.5,15.5].forEach(x => { add(box(2,1,2.6, M.incenseStone), x, .8, z+7.4);
      add(box(1.4,1.8,1.6, M.incenseStone), x, 2.1, z+7); solid(x, z+7.2, 1.1, 1.4);
      landmarks.push({ x, y:2.1, z:z+7, text:'香爐座' }); });
    doors.push({ id:'temple', name:'宮廟', x:0, z:z+10 });
    landmarks.push({ x:0, y:9, z:z+4.6, text:'宮廟' });
    /* 供桌:2026-08-14 kc 截圖抓到「一塊實心方塊」——原本是兩層疊死的箱體,
       完全不透光,不管貼什麼圖上去,輪廓都只會讀成一塊磚。拆成四支腳+裙板+
       薄桌面,腳跟腳之間留空隙透光,才讀得出「桌子」而不是「箱子」
       (跟 stall() 那次「幾何問題不是貼圖問題」是同一個教訓)。
       z+22→z+16(2026-08-21 街道骨架收緊):北牆跟著廟口路一起挪到 -84
       (見檔案開頭 CITY 定義那則筆記),供桌原本在舊門洞(-78)南邊 8 個
       單位——沒跟著挪的話,供桌 solid() 的碰撞範圍會直接堵在新門洞正
       中央(z:-84 那條線),整個廟埕變成走不進去。整組供桌(桌腳/桌面/
       landmark/lampSpot/香爐蠟燭)共用同一個 z+22 錨點,一起改成 z+16
       (跟牆同樣的 -6 位移),恢復原本離門洞的淨空,供桌本身的內部相對
       位置完全不動。 */
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b]) =>
      add(box(.4,2.2,.4, M.altarTable), a*2.1, 1.1, z+16+b*1.5));
    [ [4.6,.5,.3, 0,1.5], [4.6,.5,.3, 0,-1.5],
      [.3,.5,3.2, 2.1,0], [.3,.5,3.2, -2.1,0]
    ].forEach(([w,h,d,ax,az]) => add(box(w,h,d, M.altarTable), ax, 1.95, z+16+az));
    add(box(6,.35,4.4, M.altarTable), 0, 2.35, z+16, false, false);
    landmarks.push({ x:0, y:2.9, z:z+16, text:'供桌' });
    solid(0, z+16, 2.6, 1.8);
    lampSpots.push({ x:0, y:4, z:z+16, c:0xffb066, i:24, r:22 });
    /* 供桌桌面上的擺設:2026-08-14 kc 截圖抓到「桌面空的,還是看不出來是幹嘛
       的」——形狀對了,但一張沒放任何東西的桌子讀不出「拜拜的供桌」,要靠
       上面擺的東西(燭台、香爐)才認得出用途,不是靠桌子本身的造型。
       跟 lantern 同一套:抓 Poly Pizza 免費模型,CC-BY/CC0,授權見
       assets/models/CREDITS.md。placeAltarProp() 沒有 solid()——這兩個小物
       站在桌面上,不擋角色走路。 */
    const tableTopY = 2.525;
    /* lockAxis 選哪個軸很關鍵(這個檔案的 propModel() 註解已經講過同一個教訓,
       這裡又踩了一次):2026-08-14 kc 抓到「香爐很怪、疊在一起」——量了實際
       bounding box 才發現 incense-bowl.glb 是矮胖的扁盤(x/z=0.95, y 只有
       0.3),鎖 y 高度去撐 targetSize 會把它整個放大到 1.9×1.9,蓋過半張桌子。
       候台(candelabra.glb)是瘦高的(y=0.495 最大),鎖 y 是對的。 */
    function placeAltarProp(file, targetSize, lockAxis, x, z, tint, ry, hideNames){
      const fallback = box(targetSize*.6, targetSize*.5, targetSize*.6, std({ color:0xb8b0a0, roughness:.8 }));
      const holder = add(fallback, x, tableTopY + targetSize*.25, z, false, false);
      loadModel(file).then(gltf => {
        scene.remove(holder);
        const model = propModel(THREE, gltf, targetSize, lockAxis, ry || 0);
        /* tint(2026-09-02,功德箱用)——donation-box.glb 原始材質是投票箱的
           淺灰藍,擺在紅燈籠/金色供桌旁邊很突兀,不是這遊戲的美術方向
           (見 CLAUDE.md 基準線,不該讓道具讀起來像廉價塑膠箱)。跟
           moto-vespa 那套「算 box-projected UV 貼真材質」不同量級,這裡
           只是簡單把材質換成跟供桌同一個木頭色(M.altarTable 的
           0x7a4a2a),不用另外做貼圖。 */
        if(tint) model.traverse(o => { if(o.isMesh && o.material) o.material.color.setHex(tint); });
        /* hideNames(2026-09-02,功德箱用)——donation-box.glb(投票箱)原本
           插槽裡插了一張選票,kc:「上面的投票可以拿掉嗎」——console 現場
           查過 mesh 節點,四塊(Node-Mesh/_1/_2/_3)裡 Node-Mesh_3 頂點數
           最少(24)、bounding box 最窄最高,是那張選票,先藏了這塊。
           ⚠ 第二輪,kc:「箱子上面還是有個怪東西欸」——Node-Mesh_2(984
           頂點,四塊裡最複雜的一塊)是投票箱那個「插槽漏斗」的立體造型
           (投票箱特有的斜切開口機構,功德箱沒有這種東西),藏掉選票之後
           這塊漏斗本身還立在箱子上方,讀起來就是「怪東西」。一起藏掉,
           剩下 Node-Mesh/_1 兩塊(箱體本體)——藏完是一個乾淨的平頂箱子,
           沒有可見的投錢口,但這個距離/視角本來就看不出細節,乾淨箱型
           讀起來已經夠像「功德箱」,不需要另外生一個洞。 */
        if(hideNames) model.traverse(o => { if(hideNames.includes(o.name)) o.visible = false; });
        add(model, x, tableTopY, z, false, false);
      }).catch(() => {});
    }
    /* 2026-08-14 kc 再抓兩個問題:香爐太小、裡面空的插不出香插進去的樣子;
       燭台原本擺供桌正中間後面,改成左右分列(香爐居中——跟現實供桌「香爐
       中間、燭台兩側」的擺法一樣)。 */
    placeAltarProp('candelabra.glb', .8, 'y', -1.5, z+16);
    placeAltarProp('candelabra.glb', .8, 'y', 1.5, z+16);
    placeAltarProp('incense-bowl.glb', .85, 'x', 0, z+16);
    /* 功德箱(2026-09-02,kc:「你先去下載功德箱 放上桌子」)——來源/挑選
       理由見 assets/models/CREDITS.md donation-box.glb 那則筆記。擺在
       香爐/燭台那排前面(z+16+1.3,比 z+16 更靠近玩家那側),不要疊在
       同一排——這裡就是既有 ALTAR 選單/nearProp 講的「功德箱」那個互動
       點,擺近一點方便玩家找到。瘦高造型(Y 軸最長),鎖 y 撐大小,跟
       candelabra 同一個判斷。 */
    placeAltarProp('donation-box.glb', 1, 'y', 0, z+16+1.3, 0x7a4a2a, Math.PI/2, ['Node-Mesh_2', 'Node-Mesh_3']);
    /* 香爐本身只是個素面碗,不管貼多真的圖或抓多細的模型,單一個碗形狀
       都讀不出「香爐」——真正讓人一眼認出來的是插著香的輪廓(細長桿+
       頂端一點紅光),不是碗,而且香要插在「裡面裝的東西」上,不能整支
       浮空穿過碗底——加一層土色的香灰/沙填料,填到接近碗口高度,香從
       這層填料裡插出來,不是從碗裡憑空冒出來。 */
    const incenseZ = z+16, ashY = tableTopY + .2;
    add(new THREE.Mesh(new THREE.CylinderGeometry(.33,.35,.1,16),
        std({ color:0x9a8060, roughness:.95 })), 0, ashY, incenseZ, false, false);
    [[-.12,.86],[.1,.94],[-.02,.78]].forEach(([dx,h]) => {
      add(box(.03,h,.03, std({ color:0x8a6a42, roughness:.8 })), dx, ashY+h/2, incenseZ, false, false);
      add(box(.06,.08,.06, glow(0xff6a3a,1.6)), dx, ashY+h, incenseZ, false, false);
    });
    add(box(4.4,7,4.4, M.red), 24, 3.6, z+20); solid(24, z+20, 2.2, 2.2);
    add(box(5,1,5, M.roof), 24, 7.4, z+20);
  })();

  /* ===== 廟城圍牆(2026-08-21,第五版——方向搞反了)=====
   * 前幾版一直把「靠近廟口路、有門洞那面」當成北牆保留、把最深處那面當
   * 南牆拆掉——kc 直接罵醒:廟口(entrance)面向城市/廟口路那側是**南**
   * (現實廟宇座北朝南的傳統方位,入口朝南),最深處(離城市最遠、宮廟
   * 本體後方)才是**北**。整個方向反了,連著改錯好幾輪還一直自信滿滿地
   * 用查證資料「確認」自己是對的,其實驗證的前提本身就錯了。
   * 改成真正對的版本:西/東牆不動;靠廟口路那面(zN=-84,「靠近機車的
   * 這面牆」)整段拆掉、不留門洞——南側(廟口)完全開放,像現實很多廟埕
   * 前埕直接對外開放、沒有實體門牆,只有廣場本身當作進出的緩衝;北面
   * (zS=-116,宮廟本體後方,遠離城市那側)蓋一整面牆,不用留門洞(那側
   * 本來就不是入口)。 */
  (function templeWall(){
    const xL=-62, xR=57, zN=-84, zS=-116, wallH=3.0, wallT=.6;
    const wallMeshes = [];
    const wall = (w,d,x,z) => {
      const mat = new THREE.MeshStandardMaterial({ color:0x9aa2a6, roughness:.96 });
      const m = add(box(w,wallH,d, mat), x, wallH/2, z, false, true);
      wallMeshes.push({ mesh:m, faceLen: Math.max(w,d) });
      const pad = 1.2;   // 防穿模(騎機車單幀位移可達 0.8,見更早那則筆記)
      solid(x, z, Math.max(w/2, pad), Math.max(d/2, pad));
    };
    wall(wallT, zN-zS, xL, (zN+zS)/2);   // 西牆
    wall(wallT, zN-zS, xR, (zN+zS)/2);   // 東牆
    wall(xR-xL+wallT, wallT, (xL+xR)/2, zS);   // 北牆(宮廟本體後方,遠離城市那側,整面不留門洞)

    loader.load(TEX_DIR + 'wall.png', img => {
      const canvas = prep(img, { lift:.16 });
      wallMeshes.forEach(({ mesh, faceLen }) => {
        const t = new THREE.CanvasTexture(canvas);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        t.repeat.set(Math.max(1, Math.round(faceLen/wallH)), 1);
        mesh.material.map = t; mesh.material.needsUpdate = true;
      });
    }, undefined, () => {});

    /* 院內鋪面補滿——牆是實心的,但鋪面缺口一樣會在牆邊看穿到背景色
       (2026-08-21 更早那輪踩過)。蓋一塊底層石板墊在 temple() 那批石板
       下面,補滿沒鋪到的邊角。 */
    add(box(xR-xL-wallT, .2, zN-zS-wallT, M.stone), (xL+xR)/2, .1, (zN+zS)/2, false, true);
  })();

  /* 攤子 + 塑膠桌椅
     2026-08-14 kc 截圖抓到「一堆方塊看不出來是幹嘛的」——支架原本 .2 粗,貼了
     金屬材質之後在正常鏡頭距離幾乎看不見,屋頂板跟桌面板中間空了快 1.1 個單位
     的空氣,兩塊板子讀起來像各自飄著,不是同一個攤子。改法兩條:支架加粗到
     看得見;屋頂邊緣加一圈帆布垂簾(跟現實攤子的遮雨布垂邊同一個道理),
     把屋頂到桌面那段空氣用同一塊布視覺上接起來,不是真的加高攤體。 */
  /* 攤子招牌(2026-08-19):桌面貼圖修好(見 DESIGN_NOTES「廟埕材質 color
     沒重置」)之後桌面本身有木紋了,但整攤還是看不出來在賣什麼——沒有專屬
     招牌照片之前,先借用街上食物店家同一批 sign-food-*.png(這遊戲本來就有
     「同一種店長一樣」的慣例,見 shopFront() 檳榔攤那則),掛一塊小招牌在
     攤子開口那面,至少讀得出「這裡在賣吃的、賣什麼」。真正「桌面擺滿商品」
     的照片還沒生,先不做,那個要另外生圖,見 DESIGN_NOTES。
     掛的位置抓在屋頂(y=3.5)跟桌面(y=2.05)中間、valance 前緣(z±1.74)
     再往外一點——z+1.65 是猜的「玩家/鏡頭在南邊」那側,跟 kc 核對過再調。 */
  /* signKey/propIdx 分開(2026-08-19,kc 要求兩攤改賣「東山鴨頭」/「廟口
     乾麵」):原本 foodIdx 一個數字同時決定招牌(borrow 街上 sign-food-N.png)
     跟桌面小物,兩攤要換成不在 FOOD 陣列裡的新品項,招牌撐不住只用數字
     編號了,拆成 signKey(招牌檔名,見 signImage())+ propIdx(桌面小物挑哪一
     組,見下面那個陣列,跟招牌名字脫鉤,鴨頭/乾麵先借用最接近的碗+筷子
     那組頂著,不是精準對應)兩個獨立參數。 */
  /* 展示櫃貼圖(2026-08-19,kc 修正方向:不是貼在桌面頂面,是貼在「正面
     朝客人」那片玻璃上——原本想法是俯視拍托盤貼桌面頂,kc 指出更好的做法:
     直接拍一張「玻璃展示櫃正面、裡面看得到食材」的照片(跟她一開始給的
     參考照片同一個角度),貼在一片朝向鏡頭的直立平面上。這樣照片本身
     拍出來的深度感/透視(櫃子裡的層次)會保留,而且因為是貼在正面直立面,
     鏡頭幾乎正對著看,不會有俯視貼圖那種「攤平了很怪」的透視錯位問題——
     跟 signImage() 那些招牌能貼得住是同一個道理。跟 shopFront()/signImage()
     同一套「單張裁切、不鏡射」邏輯,差別是這裡不用發光(emissiveMap)——
     展示櫃不用自己發光,場景燈光照到就好。 */
  const trayMats = {};
  function trayMaterial(file, aspect){
    const key = file + '|' + aspect.toFixed(2);
    if(key in trayMats) return trayMats[key];
    const m = std({ color:0xa8895c, roughness:.9 });   // 沒圖之前跟 M.stallTop 同色,不會壞
    trayMats[key] = m;
    loader.load(TEX_DIR + file, img => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      const ia = img.width / img.height;
      if(ia > aspect){ const r = aspect/ia; t.repeat.set(r,1); t.offset.set((1-r)/2,0); }
      else { const r = ia/aspect; t.repeat.set(1,r); t.offset.set(0,(1-r)/2); }
      m.map = t; m.color.setHex(0xffffff); m.roughness = .6; m.needsUpdate = true;
    }, undefined, () => {});
    return m;
  }
  function stall(x, z, c, signKey, propIdx, name, trayFile, sideFile, topFile){
    /* 柱子高度(2026-08-19):3.4(原始)→4.0(第一輪抓到「柱子太矮」)→
       4.5(kc 這輪再加半節)。仍然貼地 y=0 到頂,不是整根往上飄,棚頂/
       垂簾/招牌照上一輪同一個邏輯跟著抬(這次多抬 .5)、桌面/櫃檯完全
       不動。 */
    add(box(6.4,.4,3.6, c), x, 4.6, z, true, false);
    [[-2.9,1.5],[2.9,1.5],[-2.9,-1.5],[2.9,-1.5]].forEach(([a,b]) =>
      add(box(.32,4.5,.32, M.metal), x+a, 2.25, z+b));
    /* 遮雨簾垂長:壓薄到 .2、頂邊貼著棚頂底部(4.4,柱子加高跟著抬)
       不動,可以用 __dbg.tweakStall() 滑桿現場調。 */
    stallValance.push(...[ [6.4,.2,.12, 0,1.74], [6.4,.2,.12, 0,-1.74],
      [.12,.2,3.4, 3.14,0], [.12,.2,3.4, -3.14,0]
    ].map(([w,h,d,ax,az]) => add(box(w,h,d, c), x+ax, 4.3, z+az, false, false)));
    /* 展示櫃貼圖(2026-08-19,kc:「貼起來超怪而且中間為何有地方沒貼到」)
       ——根因:櫃體正面(下面這塊)跟桌面(下面下面那塊)是兩個獨立的 box,
       中間桌面那塊有 .5 高的側邊本來只貼 M.stallTop 木紋(以為頂面貼了
       就好,沒想到桌面自己的正面窄邊也會被鏡頭看到),兩塊都貼食材圖的
       中間夾了一條原木色的縫,讀起來像「貼一半」。改法:桌面正面那條窄邊
       也貼同一顆 caseFrontMat(跟櫃體正面共用同一個材質物件,不是重新
       裁一次),縫補起來,上下看起來是同一片食材連續下來,不是兩張各自
       獨立的圖各貼各的。
       BoxGeometry 材質陣列順序是 [+x,-x,+y,-y,+z,-z],z+ 是客人/鏡頭那側
       (跟招牌/垂簾那些 z+ 偏移同一個既有慣例)。 */
    /* 頂面貼圖(2026-08-20):原本頂面偷懶借 trayFile(正面食材那張)重裁,
       kc 抓到「這就是整個櫃子的貼圖」——kc 生的圖其實是一張俯視鐵檯面
       (含醬料碗/免洗筷)+ 正面展示櫃 + 側面玻璃小窗三個視角合成的參考圖,
       頂面該用真的俯視那段,不是拿正面照重裁一個很怪的比例上去。沒給
       topFile 就退回 trayFile(舊兩攤/沒給頂圖的情況不會壞)。 */
    const caseFrontMat = trayFile ? trayMaterial(trayFile, 5.6/1.7) : null;
    const caseSideMat = trayFile && sideFile ? trayMaterial(sideFile, 2.4/1.7) : null;
    const caseTopMat = trayFile ? trayMaterial(topFile || trayFile, 5.8/2.6) : null;
    add(box(5.6,1.7,2.4, trayFile
      ? [caseSideMat || M.metal, caseSideMat || M.metal, M.metal, M.metal, caseFrontMat, M.metal]
      : M.metal), x, 1.1, z);
    /* 桌面板加厚(2026-08-19,kc 截圖抓到「桌面根本看不到」):.25 太薄,
       這個俯角鏡頭幾乎看不到正面那條邊,木紋貼圖等於白貼。加厚到 .5,
       正面可視面積變兩倍,肉眼才讀得出來是塊桌板,不是一條線。長寬比
       抓桌面實際的 5.8/2.6。
       桌面 box 跟展示櫃 box 是兩個不同東西的坑(2026-08-20,kc:「攤位是
       兩個長方體結合」)——桌面(薄薄 .5 高的檯板)一開始正面/側面借展示
       櫃(1.7 高的玻璃櫃)的照片貼圖硬套,不管是接續共用還是各自貼,
       讀起來都不對(食材招牌照片不是拍給這片窄邊用的,素材沒有專門
       對應)。kc 拍板:桌面只有頂面(+y)是真的俯視照片(caseTopMat),
       四個側邊(±x/±z)全部退回素面 M.metal(鐵灰,跟展示櫃鐵框同色系),
       讀作「桌面鑲一圈鐵邊架在櫃子上」,不勉強套用不對應的照片。 */
    add(box(5.8,.5,2.6, trayFile
      ? [M.metal, M.metal, caseTopMat, M.metal, M.metal, M.metal]
      : M.stallTop), x, 2.2, z, false, true);
    /* 攤位 3D 小物(2026-08-19,kc:「開始放攤位3D小物了」)——跟供桌
       candelabra/incense-bowl 同一套 placeAltarProp() 做法(見上面 temple()
       那段),不是貼圖:立體物件貼平面照片會很怪這個教訓已經在供桌那次
       踩過一次,不要在攤子重踩。桌面頂面在 y=2.45(stallTop 中心 2.2+
       高度 .5 的一半)。三攤各自配對應 FOOD 品項的小物(見 game.html
       FOOD 陣列 0=魯肉飯/1=切仔麵/2=鹹酥雞),lockAxis 是憑碗/鍋這類矮胖
       物件「鎖高度會被撐爆」的教訓猜的(跟 incense-bowl 那次同一個坑),
       擺完效果不對再調,不是精算過的定案。 */
    const stallTopY = 2.45;
    function placeStallProp(file, targetSize, lockAxis, dx, dz){
      const fallback = box(targetSize*.6, targetSize*.5, targetSize*.6, std({ color:0xb8b0a0, roughness:.8 }));
      const holder = add(fallback, x+dx, stallTopY + targetSize*.25, z+dz, false, false);
      loadModel(file).then(gltf => {
        scene.remove(holder);
        add(propModel(THREE, gltf, targetSize, lockAxis, 0), x+dx, stallTopY, z+dz, false, false);
      }).catch(() => {});
    }
    ([
      [['food-rice-bowl.glb', .5, 'x', -1.3, .3], ['food-chopsticks.glb', .45, 'x', -.55, .35], ['food-drink-cup.glb', .45, 'y', 1.5, .2]],
      [['food-udon.glb', .55, 'x', -1.2, .3], ['food-chopsticks.glb', .45, 'x', -.4, .35]],
      [['food-cooking-pot.glb', .6, 'x', -1.1, .2], ['food-drink-cup.glb', .45, 'y', 1.3, .2]]
      /* propIdx 3+(算命攤等非食物攤):沒有對應的食物小物陣列,直接落到
         下面 `|| []`,桌面維持空的,不會硬塞碗筷上去。 */
    ][propIdx] || []).forEach(([file, size, axis, dx, dz]) => placeStallProp(file, size, axis, dx, dz));
    /* 拿掉小發光方塊(2026-08-19,同一輪):跟上面同一張截圖抓到的問題——
       這顆小方塊(emissiveIntensity 1.4)在攤子開口那個小範圍裡,跟現在
       新加的招牌(也是發光材質)疊在一起,兩顆一起被 UnrealBloomPass 吃到
       糊成一片死白,把桌面/招牌都蓋過去。招牌本身已經有「這攤有燈」的
       效果,這顆純裝飾方塊留著只會扣分,直接拔掉。lampSpots 是真的場景
       光源,留著負責照亮攤子,跟這顆純視覺方塊是兩回事,不受影響。 */
    lampSpots.push({ x, y:3.05, z, c:0xffd79a, i:18, r:16 });
    /* 招牌被遮住(2026-08-19,kc 截圖抓到):原本塞在桌面(y 2.2 上緣 2.45)
       跟遮雨簾(y 2.8~3.3)中間那條窄縫裡,加厚桌面那次(見上面那則筆記)
       又把縫再壓窄一截,招牌大半截被遮雨簾擋住,只有下緣一小條露出來。
       挪到棚頂(box(6.4,.4,3.6,c) 的頂在 y 3.7)上方、往前推(z+1.9,比
       遮雨簾的 z+1.74 更靠外)——像真的夜市攤子懸掛式招牌那樣浮在棚子
       上緣前方,不會被自己的棚子擋到。
       招牌變厚+貼在遮雨棚(2026-08-20,kc:「他有厚度好嗎而且應該貼在
       遮雨棚」)——原本是零厚度的 PlaneGeometry 飄在棚頂正上方(y 5.35,
       高過棚頂 4.4~4.8 那個範圍),讀起來像一張浮空的紙,跟棚子沒有
       接觸關係。改成有厚度的 box(招牌本體 .15 深,只有朝客人那面 +z 貼
       signImage(),其餘 5 面用邊框材質)。
       第一版 Y 放 4.5,結果整塊卡進棚頂(4.4~4.8)的體積裡,跟屋頂 box
       互相穿插——kc 抓到「不要卡在棚內」。第一次改法猜成往下垂掛(y
       降到 3.7),kc 糾正:高度(Y)不用動,她要的是「往外推出來一點」
       ——單純沿 Z 再往前推,讓招牌整塊挪出屋頂(z±1.8)/遮雨簾(z 1.74)
       的體積範圍,不要垂直掉到棚子下緣。Y 退回 4.5,Z 從原本貼齊遮雨簾
       的 z+1.74(半個招牌厚度都還在屋頂 z+1.8 範圍內,還是有穿插)推到
       z+2.1,整塊完全離開屋頂跟遮雨簾的 Z 範圍,才是「不卡在棚內」。
       邊框顏色(kc:「要跟招牌顏色一樣不是黑」)——原本用固定的深咖啡色
       `signFrame`,跟每攤招牌自己的顏色沒關係。改用呼叫 stall() 時傳進來
       的 `c`(棚布/遮雨簾同一顆材質,鴨頭攤紅色、乾麵攤藍色),邊框跟
       棚子顏色統一,不是每攤都套同一款深色框。 */
    const signW = 2.0, signH = 1.0, signD = .15;
    add(box(signW, signH, signD,
        [c, c, c, c, signImage(signKey, signW/signH, 1), c]),
        x, 4.5, z + 2.1, false, false);
    solid(x, z, 3, 1.8);
    /* 地標牌要有名字(2026-08-19,kc:「要有招牌名稱啊」)——原本三攤都
       只顯示「攤子」,分不出哪攤賣什麼,改成顯示真的品項名字(沒給 name
       就退回「攤子」,不會空著)。 */
    landmarks.push({ x, y:4.6, z, text:name || '攤子' });
  }
  /* 東山鴨頭/廟口乾麵(2026-08-19,kc 要求):sign-duck-head.png/
     sign-dry-noodle.png 還沒生,prompt 已經在對話裡給 kc,生圖之前這兩塊
     招牌會先顯示 signImage() 的深色佔位底,不會壞、不用等圖才能推這次改動。
     第三攤(鹹酥雞,原本借用街上 sign-food-2.png 那套)2026-08-20 kc 直接
     刪掉——場上只留兩個真的有貼圖/有老闆站的攤子,不要留一個空殼攤位。
     鹹酥雞這個品項本身沒有跟著消失,阿姨(`npc-temple.js` 完整劇情角色)
     還是鹹酥雞攤老闆,她的座標(game.html NPCS,x:6,z:-86)本來就跟這個
     3D 攤位 box 沒有綁在一起,刪這個 box 不影響她的劇情。 */
  stall(-22,-92, M.tarp, 'duck-head', 0, '老大東山鴨頭', 'stall-duck-case-front.png', 'stall-duck-case-side.png', 'stall-duck-case-top.png');
  stall(-13,-92, M.tarpB, 'dry-noodle', 1, '廟口乾麵', 'stall-noodle-case-front.png', 'stall-noodle-case-side.png', 'stall-noodle-case-top.png');
  /* 算命攤(2026-08-27)——kc 第一版位置(x=-31,跟鴨頭/乾麵同排)被 kc
     推翻:「角落一點,而且他就是一個桌子上面放簽筒」。不是食物攤那種
     棚架+玻璃展示櫃(stall() 那套骨架),改成極簡的一張桌子+籤筒,搬到
     廟埕西側角落(x=-50,z=-96)——剛好落在上面那批「廣場自己長出去」的
     不規則石板(-52,-100,14,18)那塊上,離鴨頭/乾麵那排有段距離,讀起來
     像廟埕角落自己冒出來的小攤,不是跟食物攤湊成一排。顧攤的人(神棍)
     是會動的 3D 角色,放在 game.html NPCS(見那邊的 FORTUNE 註解),
     這裡只蓋桌子+籤筒的靜態場景,兩邊座標要對齊。 */
  /* 桌子尺寸滑桿(2026-08-27,kc:「桌子太小啊,讓我調整」)——跟
     tweakStall() 遮雨簾滑桿同一招:不要我猜數字、截圖、kc 不滿意、
     再猜一輪,直接把尺寸(w/d/legH)暴露給 game.html 的滑桿面板即時改,
     kc 自己拉到滿意為止。整組(桌面+四腳+籤筒+籤)重蓋比另外算縮放/
     位移代數簡單,一律先清掉舊 mesh 再照最新尺寸重畫一次。 */
  /* 最終尺寸(2026-08-27)——kc 自己拉滑桿拉到桌寬 3.45/桌深 2.95/桌高
     2.20 定案,寫死進預設值,滑桿還留著(方便之後想再調)。 */
  const FORTUNE_STALL = { x:-50, z:-96, w:3.45, d:2.95, legH:2.2 };
  const fortuneStallCollider = { x:FORTUNE_STALL.x, z:FORTUNE_STALL.z, hw:1.0, hd:1.6 };
  colliders.push(fortuneStallCollider);
  landmarks.push({ x:FORTUNE_STALL.x, y:FORTUNE_STALL.legH+.6, z:FORTUNE_STALL.z, text:'算命攤' });
  let fortuneStallParts = [];
  function buildFortuneStall(){
    fortuneStallParts.forEach(m => scene.remove(m));
    fortuneStallParts = [];
    const { x, z, w, d, legH } = FORTUNE_STALL, topH = .12;
    fortuneStallParts.push(add(box(w, topH, d, M.altarTable), x, legH + topH/2, z, false, true));
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sz]) =>
      fortuneStallParts.push(add(box(.12, legH, .12, M.altarTable),
        x+sx*(w/2-.15), legH/2, z+sz*(d/2-.15))));
    /* 籤筒:竹筒(圓柱)+ 幾支參差高度的籤(細長圓柱),沒有另外做「插在
       填料裡」那套(incense-bowl 那節的做法)——籤筒本來就是空筒插滿籤,
       不需要沙土填料那層。籤筒本身大小不跟著桌子滑桿變,固定擺在桌面
       靠邊角(相對桌寬/桌深的比例位置,桌子變大時跟著挪開,不會飄出
       桌緣外)。 */
    const canY = legH + topH, bambooMat = std({color:0xd9c48a,roughness:.75});
    const canX = x - w*.14, canZ = z - d*.15;
    fortuneStallParts.push(add(new THREE.Mesh(new THREE.CylinderGeometry(.16,.14,.34,16),
        std({color:0xa8863a,roughness:.8})), canX, canY+.17, canZ, false, false));
    [[-.28,-.19,.5],[-.22,-.12,.58],[-.26,-.09,.46],[-.3,-.15,.54],[-.22,-.22,.5]]
      .forEach(([dx,dz,h]) => fortuneStallParts.push(
        add(new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,h,6), bambooMat),
        canX+dx, canY+.34+h/2-.05, canZ+dz, false, false)));
    fortuneStallCollider.hw = w/2 + .1;
    fortuneStallCollider.hd = d/2 + 1.1;
  }
  buildFortuneStall();
  /* 算命攤周邊裝飾(2026-08-27,kc:「附近能不能多加一些裝飾,火把或啥的
     裝神弄鬼,也可以放一些大樹植物機車都可以」)——火把是新的簡單發光
     道具(木桿+發光多面體火焰,跟供桌香爐那顆發光小方塊同一招,不用
     找素材);大樹/盆栽/機車全部直接呼叫既有函式(realTree/addProp/
     parkMoto),沒有另外蓋系統。位置貼著西牆那一側,圍出「算命攤自己的
     角落」,跟鴨頭/乾麵那排的熱鬧感區隔開。（原本這裡還有灌木叢
     bushLine(),kc 這輪要求「灌木叢拔掉,樹要放算命攤四個角落」,樹的
     位置改到下面桌子四角那段,灌木整個拿掉。） */
  function mysticTorch(x, z){
    add(new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,1.8,8),
        std({ color:0x3a2a1a, roughness:.9 })), x, .9, z, true, false);
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(.22,0),
        glow(0xff7a2a,1.8)), x, 1.95, z, false, false);
    lampSpots.push({ x, y:2.0, z, c:0xff8a3a, i:20, r:14 });
  }
  [[-52.3,-95.3],[-47.7,-95.3]].forEach(([tx,tz]) => mysticTorch(tx,tz));
  /* 樹改放桌子四個角落(2026-08-27,kc:「灌木叢拔掉,樹要放算命攤四個
     角落啊」)——原本是靠西牆放一棵大樹+一排灌木,kc 要的是四棵樹圍住
     桌子四角,灌木叢整個拿掉(不是縮小,是不要)。四個角落抓桌子中心
     (-50,-96)外推 3 個單位(比桌子本身 w=3.45/d=2.95 的半徑再大一圈,
     樹冠才不會整棵貼進桌子/火把裡),尺寸從單棵時的 7 降到 6——四棵
     一起站,原本那個大小會太擠。 */
  [[-53,-99],[-47,-99],[-53,-93],[-47,-93]].forEach(([tx,tz]) => realTree(tx, tz, 6));
  addProp('planter', -47, -99.5, 1.0, 1.3, 0x3c5a2e);
  /* 灌木叢搬到北側圍牆前(2026-08-27,kc:「灌木叢改放在最北面圍牆前面
     好了,然後有個任務要找桃木劍,會在裡面看到」)——上一輪整個拿掉,
     這輪要回來但換位置:不是貼西牆,是貼廟埕北牆(templeWall() 的
     zS=-116,南側 z:-84 是開放的廟口入口,北牆是最深處那一整片實牆)。
     z 抓 -113(離牆面 3 個單位,牆本身碰撞箱 pad 1.2,留出淨空不會卡
     模型),x 置中對齊算命攤(-50),跟桌子隔著一段廟埕空地。這叢灌木
     同時是 game.html BUSH_SPOT 那個跑腿任務的藏劍點,座標要跟這裡的
     視覺位置對上,兩邊改動時要一起改。
     同一天再一輪,kc 看截圖回饋「灌木叢太小,那邊就是雜草區,至少要
     圍牆一半高,而且要很雜亂」——改叫 weedPatch()(不是 bushLine(),
     那個給公園/校門口那種修剪整齊的籬笆用,不要跟著這裡一起變高變
     亂),尺寸/密度/亂度都比一般灌木叢誇張,詳細參數見 weedPatch()
     定義那則筆記。
     再一輪,kc:「範圍大一點」——線段從 20 個單位(-60~-40)拉到 30
     (-60~-30),東側往算命攤桌子那個方向多推 10 個單位(西側 -60 貼著
     西牆的安全距離不動,不能再往西推),配合 weedPatch() 內部同時加大的
     偏移量,雜草區實際涵蓋的面積比長度數字看起來更寬,不是只拉長一條線。 */
  weedPatch(-60, -113, -30, -113);
  /* 機車(parkMoto)要等下面 `const motos = []` 先跑過(TDZ,const 不像
     function 宣告會被 hoist),這裡先留呼叫點的位置註解,實際呼叫挪到
     那個陣列宣告後面(見下面「算命攤機車」那行)。 */
  function tableSet(x, z){
    add(box(2.6,.16,2.6, M.plastic), x, 1.5, z);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b]) => add(box(.14,1.5,.14, M.plastic), x+a*1.05, .75, z+b*1.05));
    [[-2.4,0],[2.4,0],[0,2.4]].forEach(([a,b]) => {
      add(box(1.1,.12,1.1, M.plastic), x+a, .9, z+b);
      add(box(1.1,1.1,.12, M.plastic), x+a, 1.4, z+b-.5, true, false); });
    solid(x, z, 2.6, 2.6);
  }
  tableSet(-18,-86); tableSet(-9,-87);

  /* ===== 小狗/貓:街上可以摸的互動物件 =====
   * 2026-08-13 先用跟人物同一套「膠囊+球體」灰模湊了一隻不會動的狗當佔位。
   * 2026-08-14 kc 問「貓狗在哪,你要不要去抓一個模型來」——換成 Poly Pizza
   * 的免費低模動物(跟垃圾/遊具同一個來源家族,CC-BY,授權見
   * assets/models/CREDITS.md),順便補了一隻貓。跟 placeGltfProp()(遊具那段)
   * 同一套「沒圖先用灰色箱體佔位」慣例,但**不呼叫 solid()**——摸貓狗不用
   * 擋路,跟垃圾那批同一個道理。lockAxis 用 'z':這兩個模型匯出時身體
   * 長度(鼻子到尾巴)都落在 z 軸,撐這個方向的長度比撐站立高度更直覺。 */
  const pets = [];
  /* groundY:2026-08-14 kc 截圖抓到「浮在半空中」——兩隻都放在廟埕主石板
     (96×22,見上面 temple() 的第一個 add(),中心 y=.15、高 .3,頂面在
     y=.3)上面,但座標一直用世界底線 y=0 放,腳整段埋進石板裡,露出來的只有
     身體上半段,看起來像浮空。跟垃圾/家具同一個教訓:貼地物件的高度不能
     憑空假設 0,要對到真正站的那塊地板頂面。 */
  function placePet(file, x, z, label, targetSize, groundY, ry){
    const fallback = box(.5, targetSize*.5, targetSize, std({ color:0x5a4a38, roughness:.9 }));
    const holder = add(fallback, x, groundY + targetSize*.25, z, true, true);
    loadModel(file).then(gltf => {
      scene.remove(holder);
      add(propModel(THREE, gltf, targetSize, 'z', ry), x, groundY, z, false, false);
    }).catch(() => {});
    pets.push({ x, z, label });
  }
  placePet('dog.glb', 28, -90, '小狗', 1.8, .3, 0);   // 2026-08-14 kc 說「狗狗要大隻一點」,1.3→1.8
  placePet('cat.glb', -28, -90, '貓', 1.3, .3, 0);   // 2026-08-14 kc 說「貓太小隻了」,.9→1.3

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
  /* 垃圾從貼圖平面換真 3D 模型(2026-08-13 起,現況 2026-08-14 定案)——
     跟遊樂器材同一套 propModel()/loadModel(),差別是**不呼叫 solid()**:
     垃圾放在地上讓人踩過去,不該擋路,遊具那邊 placeGltfProp() 的碰撞行為
     不能直接照搬。litterMaterial()/PlaneGeometry 那段 fallback 邏輯還留著,
     只在模型非同步載入完成前的那半秒頂著,不是永久狀態。

     五個 kind 選模型的唯一標準,是實機玩過反覆修出來的一條線:
     **「這個東西站在馬路邊,一眼看得出是被丟掉的,不是剛擺上去的商品」**。
     bottle/lunchbox 第一版選了「乾淨完整的產品模型」(寶特瓶噴頭瓶身完整、
     保麗龍便當盒潔白無瑕),kc 反應「很不像垃圾」;bottle 第二版換成壓扁
     鋁罐,kc 玩起來還是說「這個鋁罐很不像」——圓滾滾的東西在這個鏡頭距離
     容易被讀成球或裝飾品,不是罐子本身錯,是「站起來的圓形物」這種輪廓
     天生不夠一眼識別。**現在的判準是輪廓,不是材質乾不乾淨**:黑色垃圾袋
     鼓起來的形狀、攤開的紙屑、混雜的小垃圾堆,不管多遠多小都認得出來,
     這才是選型時真正要看的東西。

     五個現行模型跟來源(CREDITS.md 有完整表):
     - bottle → **黑色垃圾袋**(Quaternius「Trash Bag」,CC0)。是立著放的
       東西,LITTER_SIZE 的 lockAxis 用 'y'(撐高度),跟其他幾種撐水平長度
       不一樣,不要照抄。
     - lunchbox → 一小撮**散落紙屑**(J-Toastie「Floor Trash」,CC-BY,作者
       簡介就寫「Reminder to not litter」)。
     - cig → **壓扁菸蒂**(Poly by Google「Cigar butt」,CC-BY 3.0)。
     - flyer → 一小撮**攤開碎紙片**(Quaternius「Debris Papers」,CC0,
       tag 直接寫 #Trash)。跟 lunchbox 都是紙屑概念但模型不同,顯示名稱
       維持「傳單」(可以唸成被撕爛的傳單),跟 lunchbox 的「紙屑」分開。
     - cup → **混雜垃圾堆**(Poly by Google「Rubbish」,CC-BY 3.0——黑色
       小袋+散落雜物)。已經完全不是杯子形狀,`LITTER_KIND_NAME`
       (game.html)裡的顯示名稱改成「垃圾堆」,不要再叫「手搖杯」。
     flyer/cup 中間一度整個從地圖上拿掉過(kc 說「平面的都丟掉,完全用不到」
     ——那時候還沒找到合適的 3D 模型),這次補回來的不是原本設想的「傳單/
     咖啡杯」那兩個模型,是照上面的判準另外挑的。

     LITTER_SIZE 每種的目標尺寸/撐滿軸是這次先湊的數字,還沒逐一在實機
     反覆校正比例,kc 玩起來覺得太大/太小可以再調,不用回來問。
     垃圾能不能被看到:kc 玩起來說看不到垃圾在哪(2026-08-13)。試過在垃圾
     本身的材質上加 emissive、疊一圈暖色光暈(additive blending)、把光暈掛進
     lampSpots 系統讓它像路燈一樣真的在地上投光——三次調整下來 kc 最後說
     「我不要光圈」,直接不要這個方向,不是再調淡一點的問題。整段光暈/點光源
     拿掉,垃圾能不能被看到回歸貼圖本身+墊高到人行道上面(見下面 y=.34 那條
     真正的結構性修正,這個沒有問題、保留)+真 3D 模型撐開的體積感+2026-08-14
     這輪改成輪廓更好認的模型。不要回頭加光暈。 */
  const LITTER_MODELS = {
    bottle:'litter-bottle.glb', cig:'litter-cig.glb', lunchbox:'litter-lunchbox.glb',
    flyer:'litter-flyer.glb', cup:'litter-cup.glb'
  };
  /* [lockAxis, targetSize]——lockAxis 撐的是模型「該撐滿的那個方向」:大部分
     垃圾躺在地上,撐水平最長的軸('x');bottle 是垃圾袋,立著放,撐的是
     高度('y'),不要照抄其他幾種。 */
  const LITTER_SIZE = {
    bottle:['y', .9], cig:['x', .4], lunchbox:['x', 1.1],
    flyer:['x', .7], cup:['x', 1.2]
  };
  const litter = [];
  [
    /* 出生點旁那排「五種樣式一次比對」的臨時陳列(2026-08-13 加、
       2026-08-14 比完拿掉)——垃圾模型都換成看得出是垃圾的版本後比對
       階段結束,回到原本分散在地圖上的 10 個定位,不在出生點常駐。 */
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
    [0,  55.5,'cup',0xc2a0d0],
    /* 中華路⇄廟口路那條巷子(嫖妓互動,見 DESIGN_NOTES)牆角三件,2026-08-18
       回應 kc「地上也不知道是啥」——x 貼著兩側牆內緣(alley(-24,-27,-51),
       走道淨寬 -27.2~-20.8,見 alley() 內 solid() 那組數字),z 跟
       ALLEY_WORKER(game.html,x:-22.3,z:-38)錯開,不疊到她的互動範圍。 */
    [-26,-31,'bottle',0xdce8e0],   // 垃圾袋堆在牆角
    [-22,-45,'cig',0x5a5650],
    [-26,-47,'flyer',0xd8d2c0],
    /* 廟城地板垃圾(2026-08-21,kc:「廟城幫我多放一些地板垃圾」)——七個
       點都用 __dbg.city.blocked() 現場量過確認不是站在攤子/供桌/香爐座
       那些 solid() 範圍裡,散在廟埕開放的鋪面上,不聚成一堆。 */
    [-45,-88,'cig',0x5a5650],
    [35,-90,'bottle',0xdce8e0],
    [10,-85,'flyer',0xd8d2c0],
    [-35,-105,'lunchbox',0xc9c2a8],
    [45,-108,'cup',0xc2a0d0],
    [20,-102,'cig',0x5a5650],
    [-50,-100,'bottle',0xdce8e0]
  ].forEach(([x,z,kind,tint]) => {
    /* 人行道那塊 box 是 .3 厚(見 H_ROADS.forEach 的 M.walk,中心 y=.15、頂面在
       y=.3),垃圾之前放在 y=.04/.05——整片埋在人行道厚度裡面,從上面根本
       看不到,難怪 kc 說找不到垃圾(2026-08-13 抓到)。要蓋在人行道「上面」,
       y 一定要大於 .3。這條是結構性修正,跟上面拿掉的光暈無關,保留。 */
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4), litterMaterial(kind,tint));
    mesh.rotation.x = -Math.PI/2;
    add(mesh, x, .34, z, false, false);
    /* entry 是同一個物件被 litter 陣列跟 game.html 的互動判定共用參照,
       模型載入完成後直接改 entry.mesh,不用把 entry 整個換掉——撿垃圾時
       game.html 呼叫 scene.remove(l.mesh),不管當下是貼圖平面還是真模型都要
       撿得到、移得掉。 */
    const entry = { x, z, kind, mesh };
    litter.push(entry);
    const modelFile = LITTER_MODELS[kind];
    if(modelFile){
      const [lockAxis, targetSize] = LITTER_SIZE[kind];
      loadModel(modelFile).then(gltf => {
        scene.remove(entry.mesh);
        entry.mesh = add(propModel(THREE, gltf, targetSize, lockAxis), x, .34, z, false, false);
      }).catch(() => {});
    }
  });

  /* 街道小物點綴(2026-08-13):消防栓、電箱,純裝飾、不能互動,單純讓街上
     多一點雜物不要太乾淨。座標挑跟垃圾點同一條人行道線(z=-16.5,已經驗證
     過站得到、看得到),但錯開 x,不要疊到垃圾點或店面招牌。 */
  addProp('hydrant', -52, -16.5, .9, 1.2, 0xa0402c);
  addProp('utilitybox', -30, -16.5, 1.1, 1.4, 0x4a5a42);

  /* 大街上的除錯測試方塊(第二十→二十三輪)已經整段拿掉——貼圖/材質陣列
     邏輯都驗證過沒問題了,第二十四輪直接把同一套做法(見上面 wallUnit)
     部署回真的巷子牆上,不用再留大街上的佔位裝飾。 */

  /* 機車 2026-08-04 拿掉(方塊拼裝太假),2026-08-14 用真的低模模型補回來——
     Vespa,Jasmine Roberts,CC-BY,授權見 assets/models/CREDITS.md,跟垃圾/
     貓狗同一個 poly.pizza 資源家族。原始模型量出來 x:1.65 y:3.20 z:4.38
     (任意單位),z 是車長那個軸,lockAxis 用它撐 targetSize。1 單位≈0.42米
     (見下面 PLAYER 那條註解),真 Vespa 車長約 1.8 米→4.3 單位,回推車高
     約 3.14 單位(~1.3 米,含照後鏡,比例合理)。ry=0 就是「車頭朝建築物」
     的沿街停法(model 預設 forward 就是 z 軸,不用轉),鏡頭壓低之後這樣
     排比車頭朝路中央更像真的停車格。
     先只停在兩間機車行(宏吉機車行/中華路 shop 中心實測 x=0、後火車站那間
     同名店實測 x=-12,兩個數字是照 city.doors 的 store 門口反推校正過的,
     不是原本假設的「格子中心 = from+i*UNIT+UNIT/2」那條公式——那條漏算了
     半格,2026-08-14 拿 store 門口實際座標(-12,-13.6)驗出來的)門口各兩台,
     不是整條街鋪滿——鋪滿之前想先讓 kc 看一眼這個模型觀感,跟遊具/垃圾
     同一套「不確定先小規模上」的做法。z 座標沿用上面已經驗證過站得到、
     看得到的人行道深度(-13/59,同一條算式:路中心 z ± 13)。
     2026-08-14 第二輪:機車可以騎了(kc 要的),於是拿掉 solid()——騎走
     之後車會跟著玩家移動,原地留一顆固定的碰撞箱會變成路中間卡一個
     「看不見的牆」,比不擋路更糟。停在路邊被穿過去這點瑕疵先接受。
     entry 進 motos 陣列給 game.html 判斷「站得夠近可以按空白鍵騎上去」+
     騎乘時把這個 group 的 position 每幀同步成玩家位置(不是另外複製一顆
     機車模型),下車時把 x/z 更新成當下位置——同一台車換位置停,不是憑空
     多一台。ridden 這個旗標擋掉「同一台車被騎走的時候還能被第二次選到」。 */
  const motos = [];
  /* skinIdx:每台車停放時固定分配一種車色(見上面 MOTO_SKINS 清單),同一台
     車換位置停(下車重新停放)不會跟著換色——applyMotoSkin() 只在這裡呼叫
     一次,不是每次移動都重算。 */
  function parkMoto(x, z, skinIdx, forSale){
    const fallback = box(1.6, 3.1, 4.3, std({ color:0x555b60, roughness:.7 }));
    const holder = add(fallback, x, 1.55, z, true, false);
    /* owned/forSale(2026-08-17,kc 要求)——forSale 標記「停在機車行門口、
       可以花錢買下」的那台,owned 是買下之後的狀態。其餘沒標 forSale 的車
       永遠是「別人的」,騎了都算借用(game.html 那邊扣風評)。這兩個欄位
       只是資料,判斷跟扣分邏輯都在 game.html 的 mountMoto()/interactProp()。 */
    const entry = { x, z, group:holder, ridden:false, forSale:!!forSale, owned:false };
    motos.push(entry);
    /* return entry(2026-09-03)——現生一台車(見上面 spawnMoto 那則筆記)
       呼叫端要拿到這個 entry 才能標 owned/存起來,不是純副作用函式了。
       group 這時候還是 fallback 灰盒子(glb 還沒載完),但 x/z/owned 這些
       欄位呼叫端當下就用得到,不用等 glb 載完才能標記。 */
    loadModel('moto-vespa.glb').then(gltf => {
      scene.remove(holder);
      const propGroup = propModel(THREE, gltf, 4.3, 'z');
      entry.group = add(propGroup, x, 0, z, false, false);
      applyMotoSkin(THREE, propGroup, MOTO_SKINS[skinIdx % MOTO_SKINS.length]);
      /* setSkin(2026-09-03,kc:「應該是老闆會讓你選顏色 你買了之後才會出現」)
         ——買下 forSale 那台之後,game.html 的 buyMoto() 要能現場換車色,
         不是只有停車那一刻分配到的固定色。掛在 entry 上讓外部呼叫,跟
         buildNPC() 回傳 setFacing/setHelmet 那些「呼叫端外部觸發、內部
         實作細節留在這個檔案」同一個模式,applyMotoSkin() 保持不 export。 */
      entry.setSkin = idx => applyMotoSkin(THREE, propGroup, MOTO_SKINS[idx % MOTO_SKINS.length]);
    }).catch(() => {});
    return entry;
  }
  /* 2026-08-17 從 4 台擴到 12 台,湊滿 MOTO_SKINS 的顏色數——沿用原本兩處
     機車行門口的人行道深度(z=-13/59,見上面的驗證註解),往同一條街的
     兩側/更遠處延伸,不是憑空挑座標:
     - 中華路北側(z=-13)原本 2 台再加 2 台(x 往外延伸)
     - 中華路南側(z=+13,對稱到馬路另一邊)加 2 台
     - 後火車站那側(z=59)原本 2 台再加 2 台
     - 後火車站對面(z=85,對稱到馬路另一邊)加 2 台
     沒有一一肉眼核對每個點會不會卡到店面招牌/道具,kc 玩起來覺得哪台卡到
     再回頭挪。
     2026-08-21:kc「只會有一間機車行」——後火車站那間分店拆了(見上面
     row() 那則筆記),z=59/z=85 這六台跟著拿掉,不留「門口沒有店卻停著
     機車行的車」這種對不上的畫面。中華路那 6 台(z=-13/z=13)維持原樣。 */
  /* forSale 展示車拿掉了(2026-09-03,kc:「不要有展示車」)——上一輪才
     加的「銀色展示車」這輪直接推翻,門口(中華路 x=3,z=-13)那個位置
     空著,不再預先停一台可以買的車。買車現在完全是跟 talkToMotoBoss()
     對話走完整套流程(我要買車→付款方式→選色)之後,才用下面 spawnMoto
     (=parkMoto 本體,見 return 那行)在這個座標**現生一台**,不是預先
     擺一台等玩家選色。其餘 5 台(別人的車,不能買)維持原樣。 */
  [
    [9,-13],[21,-13],[27,-13],
    [3,13],[9,13]
  ].forEach(([x,z], i) => parkMoto(x, z, i, false));
  /* 算命攤機車(2026-08-27,kc:「也可以放一些...機車都可以」)——停在
     角落附近,靠西牆那側,不算進上面「機車行門口」那批的清點。 */
  parkMoto(-56, -90, 6, false);
  /* 街上擴充停車位,補滿剩下 5 色(2026-08-28)——停在廟口路城市這一側
     人行道(z=-71,那排店 2026-08-21 整組拆掉後空出來的地段,見上面
     row() 那則筆記),不是機車行的車,單純街上停放,理由/交叉核對見
     DESIGN_NOTES「街上停車位擴充」節。 */
  [ [-54,7], [-18,8], [6,9], [30,10], [54,11] ]
    .forEach(([x,skinIdx]) => parkMoto(x, -71, skinIdx, false));

  /* 電線杆 + 路燈 */
  H_ROADS.forEach(r => {
    for(let x=-90;x<=96;x+=32){
      add(box(.5,15,.5, M.pillar), x, 7.5, r.z-ROAD_HW-.8);
      add(box(2.8,.22,.22, M.pillar), x, 13.2, r.z-ROAD_HW-.8);
      add(box(1.2,.32,.8, glow(0xffd9a0,2.4)), x+1.5, 12, r.z-ROAD_HW+.2, false, false);
      lampSpots.push({ x:x+1.5, y:12, z:r.z-ROAD_HW+.2, c:0xffd9a0, i:40, r:46 });
    }
  });

  /* 電線亂牽(2026-08-14,豐富街道第一輪,見對話紀錄不重複寫在 DESIGN_NOTES——
     這條純視覺、參數不用回頭問 kc)。台灣街上電線杆之間牽好幾條下垂電纜是
     一眼認得出的元素,兩條粗細/垂度錯開的纜線一起牽比單一條更像電纜束。
     只沿同一條 H_ROADS 串接相鄰電線杆,V_ROADS 沒有電線杆(上面那段迴圈
     只跑在 H_ROADS 底下),路口之間(廟口路/中華路/後火車站)不互牽,不然
     線會纏成一團。純裝飾,沒有碰撞、沒有陰影(細長 tube 陰影意義不大,
     省效能)。 */
  H_ROADS.forEach(r => {
    const z = r.z-ROAD_HW-.8, y = 13.15;
    const xs = []; for(let x=-90;x<=96;x+=32) xs.push(x);
    for(let i=1;i<xs.length;i++){
      [[.06,.55],[-.09,.9]].forEach(([dz,sag]) => {
        const p0 = new THREE.Vector3(xs[i-1], y, z+dz);
        const p1 = new THREE.Vector3(xs[i],   y, z+dz);
        const mid = new THREE.Vector3((xs[i-1]+xs[i])/2, y-sag, z+dz);
        const wire = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 10, .035, 4, false),
          M.wire
        );
        wire.castShadow = false; wire.receiveShadow = false;
        scene.add(wire);
      });
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
    /* 巷名(2026-09-02,kc:「每條巷子都要有名字」)——alley()/alleyDiag()
       現在都收了 name,這裡查表回傳,不用另外維護一份範圍表。直巷用
       x 是否落在牆內(HW+3 是牆中心偏移,+2 抓寬鬆一點的容許範圍)+ z
       落在 z0~z1 之間;斜巷借 alleyDiag() 建牆時同一套投影數學(沿線/
       垂直分量),抓 along/side 兩個方向各自的容許範圍。查不到才 fall
       back 舊的通用「巷子」,理論上不會發生(三條巷子已經涵蓋所有巷子
       範圍),留著純保險。 */
    for(const a of alleys)
      if(Math.abs(x-a.x) < 3.2+3+2 && z >= Math.min(a.z0,a.z1)-2 && z <= Math.max(a.z0,a.z1)+2) return a.name;
    for(const a of diagAlleys){
      const dx = a.x1-a.x0, dz = a.z1-a.z0, len = Math.hypot(dx,dz);
      const ux = dx/len, uz = dz/len, nx = -uz, nz = ux;
      const cx = (a.x0+a.x1)/2, cz = (a.z0+a.z1)/2;
      const relX = x-cx, relZ = z-cz;
      const along = relX*ux + relZ*uz, side = relX*nx + relZ*nz;
      if(Math.abs(along) < len/2+2 && Math.abs(side) < 3.6+3+2) return a.name;
    }
    if(z < -84) return '廟埕';
    return '巷子';
  }
  function blocked(x, z){
    for(const c of colliders)
      if(Math.abs(x-c.x) < c.hw+.55 && Math.abs(z-c.z) < c.hd+.55) return true;
    return false;
  }

  /* 遠景(2026-08-21):天空漸層+星星那版 kc 打回票——「放真正的房子方塊,
   * 要嘛放城市遠景圖片,選一種」,選了方塊。第一版方塊蓋在 CITY.bounds
   * 外圍、離廟埕牆有 42~47 單位空地,牆邊看不到;補了一版貼著牆的近景,
   * 但用的是純色 MeshBasicMaterial 剪影——kc 接著問「為何不要放真的房屋
   * 方塊」,問到真正的問題:近到站在牆邊幾步就看得到的東西,用一塊沒有
   * 任何細節的扁平色塊,怎麼看都是明顯的假背板,跟旁邊有磚紋、有鐵窗
   * 貼圖的真建築擺在一起特別穿幫。改成直接借用上面 row() 蓋真實店面用的
   * 同一套材質:牆身用 M.wall/wallB/wallC/wallD(街上建築同一批磚紋磁磚
   * 貼圖,不是純色),正面再疊一塊 facadeMat() 鐵窗貼圖(跟樓上立面同一張
   * facade-N.png,窗戶會自己微微發光,見 facadeMat 裡的 emissiveMap)——
   * 這一圈遠景本質上就是「城市继续往外延伸」,材質、貼圖都跟真建築一樣,
   * 不是另外發明一套簡化版素材,遠處自然靠 scene.fog 霧化變暗,不用手動
   * 調暗一顆假顏色。 */
  (function skylineRing(){
    const bx0=-104, bx1=104, bz0=-118, bz1=92, edgeGap=16, spacing=22;
    const wallMats = [M.wall, M.wallB, M.wallC, M.wallD];
    /* 房子加在奇怪的地方(2026-08-21,kc 截圖圈出藍圖上那條牆的線,問
       「是要加在這個線上」)——原本每一棟的「離牆/離邊界多遠」都另外加了
       一個 Math.random() 亂數(*14 或 *4),疊在本來就隨機的寬度 w 上面,
       等於每棟房子面向牆的那條邊各自飄在不同距離,前緣參差不齊,不是
       貼齊一條線的街景,看起來就是亂丟。改成 placeTower() 直接吃「要貼齊
       的那條線座標」(nearLine),用那棟房子自己算出來的寬度反推中心點,
       讓面向線的那條邊永遠精確貼在 nearLine 上——寬度/高度還是隨機给
       天際線一點高低變化,但前緣對齊,讀起來才是一整排貼著邊界/貼著牆
       蓋出來的房子,不是隨手灑的方塊。 */
    function placeTower(nearLine, along, axis, face, hMin, hMax){
      const perp = 11+Math.random()*9, alongLen = 11+Math.random()*9;
      const h = (hMin??16)+Math.random()*((hMax??50)-(hMin??16));
      const wallM = wallMats[Math.floor(Math.random()*wallMats.length)];
      // axis==='x': 沿 x 排(北/南邊界),perp 是 z 方向(厚度);axis==='z': 沿 z 排(東/西邊界),perp 是 x 方向(厚度)
      const w = axis==='x' ? alongLen : perp, d = axis==='x' ? perp : alongLen;
      const cx = axis==='x' ? along : nearLine - face*(perp/2);
      const cz = axis==='x' ? nearLine - face*(perp/2) : along;
      add(box(w, h, d, wallM), cx, h/2, cz, false, false);
      const upY0 = 5.9, upH = h-upY0;
      if(upH > 3){
        const alongF = axis==='x' ? w : d;
        add(box(axis==='x' ? alongF : .14, upH, axis==='x' ? .14 : alongF,
                facadeMat(FACADES[Math.floor(Math.random()*FACADES.length)], alongF/upH, wallM)),
            cx + (axis==='z' ? face*(w/2+.1) : 0), upY0+upH/2,
            cz + (axis==='x' ? face*(d/2+.1) : 0), false, false);
      }
    }
    /* 廟城以上不要有任何房子(2026-08-21,kc 看藍圖確認:「廟城區域以上
       不要有任何其他建築房子」)——北排(貼著地圖北緣 bz0-edgeGap)整組拿掉,
       那排本來就在廟埕正後方,離廟埕屋頂只有 20 個單位,矮矮一顆廟探出去
       背後卻頂著一整排 50 高的樓,顯然不對。西/東兩排本來從地圖最北緣
       (bz0-edgeGap)開始蓋,涵蓋了廟埕整段凸出區的高度——改成從 -84(廟口路,
       正方形的北邊界)開始,只沿著「正方形核心」那一段蓋,不再跟廟埕same
       z 範圍重疊,廟埕凸出區左右兩側現在也不會冒出房子。 */
    /* 2026-08-27,kc:「把那排假房子全部拆掉」——不是留白給以後蓋警察局/
       施工大樓那種「先佔位」問題,是這排遠景天際線背牆(bz1+edgeGap=108)
       本身太醜、貼太近會穿幫,要整個刪掉,範圍抓大一點,不要留邊緣露出來
       (kc 截圖抓到 x:[-70,-5] 那次還留了 -76/12 兩棟在旁邊)。x:[-100,40]
       整段清空,涵蓋新火車站(x≈-36)+ 兩側大樓 + 之後警察局/施工大樓的
       範圍,其餘城市邊界(廟口路那側等)照舊不動。 */
    for(let x=bx0-edgeGap; x<=bx1+edgeGap; x+=spacing){
      if(x >= -100 && x <= 40) continue;
      placeTower(bz1+edgeGap, x, 'x', -1);
    }
    for(let z=-84; z<=bz1+edgeGap; z+=spacing){
      placeTower(bx0-edgeGap, z, 'z', 1);
      placeTower(bx1+edgeGap, z, 'z', -1);
    }

    /* 廟埕西/東牆外側近景那批房子拔掉了(2026-08-21,kc:「先把廟口外面
       奇怪的房子刪掉」)——這批貼著牆蓋的方塊來回改了好幾輪(純色剪影→
       真材質→貼齊隔線),kc 一直沒滿意,先整組移除,不留著佔位置。牆本身
       (templeCompoundWall,貼圖比例已經修好,repeat 是整數對齊隔線)加上
       牆外靠 scene.fog 霧化的天空漸層,先這樣頂著。外圍那圈 CITY.bounds
       邊界的 placeTower() 迴圈(上面那兩段 for)留著沒動,那個離得遠,不是
       這次「廟口外面」在講的東西。之後要重新處理廟口牆外的背景,選項見
       這次聊天紀錄:純方塊、kc 自己生的 assets/tex/skyline-temple.png
       大圖(貼牆做法已經寫過一次,見對話紀錄),或別的做法,到時候再議,
       不要看到舊註解就自動接回這批 tower。 */
  })();

  /* spawnMoto:parkMoto() 本體直接掛出去(2026-09-03,配合「不要有展示車」
     那輪——買車現在要現生一台,見上面 forSale 那段長筆記),回傳新 entry
     讓呼叫端(game.html)自己標 owned/存起來,不是回傳 void。 */
  return { colliders, doors, alleys, diagAlleys, pets, litter, play, motos, lampSpots, landmarks, stallValance, fortuneStall:{ cfg:FORTUNE_STALL, rebuild:buildFortuneStall }, hospital:{ cfg:HOSPITAL, rebuild:buildHospital }, hospitalWall:{ front:hospitalFrontM }, hospitalProps:hospitalPropRef, updateLights, updateBushBillboards, whereAmI, blocked, materials:M, policeWall, policeCar:policeCarRef, construction:constructionRef, busStop:busStopRef, massageDoor:massageDoorRef, spawnMoto:parkMoto };
}

/* ---------------- 角色 ----------------
 * 還是方塊,但比例照真人抓:舊版是 3.4 頭身的樂高比例,遠看就是玩具。
 * 街上相機在 29 高、23 遠,臉根本看不到——決定像不像人的是**頭身比跟剪影**,
 * 不是面數。臉留給 2D 室內(見 DESIGN_NOTES「美術與視角」)。
 * 四肢掛在 pivot 上(髖、肩),不是繞自己中心轉,腿長了才擺得像走路。 */
/* 身高 4.0:用車道半寬(ROAD_HW=9,雙向道約 7.5 米)回推,1 單位 ≈ 0.42 米,
   4.0 單位 ≈ 1.7 米。舊的 3.2 只有 1.34 米,站在機車旁邊像國中生。 */
export const PLAYER = { height:4.0, eyeY:3.65 };

/* 天空背景(2026-08-21):outdoor 場景原本 scene.background 是純色,鏡頭只要
 * 看到建築/牆頂以上就是死板一片黑——kc 截圖抓到「這不是一個很完整的小鎮,
 * 背景不能這樣」。中間試過「漸層加星星加月亮」貼圖,kc 直接打回票:
 * scene.background 是貼在螢幕空間的一張圖,轉鏡頭天空完全不會動,是騙眼睛
 * 的招數,不是「有東西撐著地平線」——「要嘛放真正的房子方塊,要嘛放城市
 * 遠景圖片,選一種」。選了 buildCity() 裡的 skylineRing()(真的 3D 方塊,
 * 會隨鏡頭轉、有遮擋關係)當地平線那一圈,這裡只留最基本的直向漸層墊在
 * skylineRing 後面當天色,不裝飾、不騙眼睛,純粹是比純色更順眼的底色。 */
export function skyGradient(THREE, top = '#0d141e', bottom = '#242c40'){
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
 * 現在五套骨架:'m'(Remy,男性,主角在用)、'f'(Sophie,女性,2026-08-12
 * 為了廟口角色補的)、'm2'(Leonard,男性換髮型)、'm3'/'f2'(Brian/Megan,
 * 2026-08-20 為了排隊客人/行人湊數補的,見下面 MODELS 裡各自的註解)。
 * **不同來源模型,Blender 匯出時部件名字不保證一樣**——
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
       /* 2026-08-14 補的單次動作(不是走路/待機那種循環動畫,見 buildPlayer()
          的 playOnce()):pickup 撿垃圾彎腰、pet 摸(狗)蹲下。從 Mixamo 抓,
          流程跟 idle/walk/run 同一套(README.md「轉檔」那節),anim-only 模式
          轉檔,只有骨架+動畫沒有 mesh。
          ⚠️ pet_low:kc 反應「貓還是完全沒摸到,貓要摸得更低」——貓/狗共用
          同一顆「Petting Animal」動畫,原本的 Animal Size 是照狗的高度調的,
          貓比較矮,手伸出去的位置對不到貓身上,不是貓的模型放錯,是動作本身
          沒對到。Mixamo 那顆動畫的 Animal Size 拉到 0 會整個蹲到地上,另外
          存一份專門給貓用,不要跟 pet 共用同一個檔案——見 game.html 的
          interactProp() 依 pet.label 選要放哪一個。 */
       once: { pickup:'base-human-pickup.glb', pet:'base-human-pet.glb', pet_low:'base-human-pet-low.glb' },
       /* sit 不放進 once——騎機車一次可能持續很久,不是「播一次就回 idle」
          那種手勢,是要一直撐著的姿勢,所以跟 idle/walk/run 同一套處理
          (見 buildPlayer 的 sitAction),animate() 多一個 riding 參數決定
          要不要蓋掉 idle/walk/run 選擇。 */
       sit:'base-human-sit.glb',
       /* lie(2026-08-18,爸爸醉倒改版):Mixamo「Lying Down」動畫,靜態躺姿
          （不是咳嗽/嘔吐那種帶動作的版本，見 DESIGN_NOTES「爸爸 v3」節後續
          更新）。轉檔流程跟 sit 完全一樣。 */
       lie:'base-human-lie.glb',
       parts: { Body:'skin', Tops:'hood', Bottoms:'pants', Shoes:'shoe',
                 Hair:'hair', Eyes:'eyes', Eyelashes:'eyes' } },
  f: { idle:'base-human-f-idle.glb', walk:'base-human-f-walk.glb',
       /* sit 一開始試過借 rig 'm' 的 base-human-sit.glb(2026-08-18,媽媽坐
          沙發那張截圖想借用)——**骨骼名字雖然都是 mixamorig:xxx 標準命名,
          但 Sophie 跟 Remy 的骨骼比例/T-pose 沒對齊,套上去整個人扭曲變形
          (脖子拉長、身體塌陷),不能跨 rig 共用**,截圖存證見對話紀錄。
          改成 Mixamo 選 Sophie 角色重下載一顆「Sitting」動畫轉出
          base-human-f-sit.glb,流程跟 rig 'm' 的 sit 完全一樣。 */
       sit:'base-human-f-sit.glb',
       parts: { Ch02_Body:'skin', Ch02_Cloth:'hood', Ch02_Sneakers:'shoe',
                 Ch02_Hair:'hair', Ch02_Eyelashes:'eyes', Ch02_Socks:'pants' } },
  /* 2026-08-12 為了阿源另外接的:同是男性,但髮型/五官跟 Remy(m)不一樣——
     髮型是模型內建的固定形狀換不了造型,只能整套換一個模型來換髮型。
     Ch31_Collar 是毛衣領口內襯那一小塊,跟 Sweater 用同一個顏色最自然。 */
  m2: { idle:'base-human-m2-idle.glb', walk:'base-human-m2-walk.glb',
        parts: { Ch31_Body:'skin', Ch31_Sweater:'hood', Ch31_Collar:'hood',
                  Ch31_Pants:'pants', Ch31_Shoes:'shoe', Ch31_Hair:'hair',
                  Ch31_Eyelashes:'eyes' } },
  /* 2026-08-20:排隊客人/行人只有 3 副骨架湊 10 隻以上角色,kc 玩起來抓到
     「看起來重複」,補兩副(Brian 男/Megan 女),詳見 DESIGN_NOTES「排隊客人
     外觀會重複」那節。Brian 是光頭造型,沒有獨立 Hair mesh(部件裡本來就
     沒有,不是漏接),parts 沒有 hair 這個 key。 */
  m3: { idle:'base-human-m3-idle.glb', walk:'base-human-m3-walk.glb',
        /* sit(2026-08-24,阿仁教室背影用)——Mixamo 選同一個 Brian 角色下載
           「Sitting Idle」轉出來的,骨骼名字前綴(mixamorig12:)跟 idle/walk
           核對過是同一份。 */
        sit:'base-human-m3-sit.glb',
        parts: { Ch01_Body:'skin', Ch01_Shirt:'hood', Ch01_Pants:'pants',
                  Ch01_Sneakers:'shoe', Ch01_Eyelashes:'eyes' } },
  f2: { idle:'base-human-f2-idle.glb', walk:'base-human-f2-walk.glb',
        /* sit(2026-08-21,小美教室剪影用)——Mixamo 選同一個 Megan 角色
           下載「Sitting Idle」轉出來的,骨骼名字前綴(mixamorig2:)跟
           idle/walk 那兩份核對過是同一份,不是跨角色亂借,不會有 f 那次
           「Sophie 借 Remy 的坐姿整個扭曲」的問題。 */
        sit:'base-human-f2-sit.glb',
        parts: { Ch22_Body:'skin', Ch22_Shirt:'hood', Ch22_Pants:'pants',
                  Ch22_Sneakers:'shoe', Ch22_Hair:'hair', Ch22_Eyelashes:'eyes' } },
  /* 2026-08-20 kc 問「有沒有老人跟小孩的」查 Mixamo 的結果:老人不用另外
     找模型,靠灰白髮色/膚色調整就有長輩感,不用加新骨架。小孩找到唯一
     寫實比例(不是 Timmy/Amy 那種大頭 Q 版)的來源「Girlscout T Masuyama」
     (Mixamo 原始貼圖是殭屍化女童軍,已被轉檔流程剝光,不影響),但**這副
     骨架匯出時全身只有一個 mesh 節點「GirlScout」,不像其他骨架 Body/
     Shirt/Pants 分開**——parts 只能對到一個 key,整隻只能單一顏色,沒辦法
     像其他角色皮膚/衣服分開換色。先加進 registry 讓 kc 肉眼看外觀決定要不要
     正式收,不是定案。 */
  kid: { idle:'base-human-kid-idle.glb', walk:'base-human-kid-walk.glb',
         parts: { GirlScout:'skin' } },
  /* 2026-08-24:新角色(校門口改管那群人的頭,還沒命名)專用——kc 要求「去找
     別的骨架」,不要跟現有五副共用。Mixamo 唯一標「Teen」分類的男生角色
     Bryce,頭髮比 Remy/Leonard/Brian 蓬鬆有層次,體型也是青少年比例,不是
     借用成人角色。sit 動畫是 Mixamo「Sitting Idle」(椅子坐姿,手放膝上,
     跟 f2 那顆同名動畫是同一種姿勢,不是地板盤腿那種)。 */
  m4: { idle:'base-human-m4-idle.glb', walk:'base-human-m4-walk.glb',
        sit:'base-human-m4-sit.glb',
        parts: { Ch42_Body1:'skin', Ch42_Shirt:'hood', Ch42_Shorts:'pants',
                  Ch42_Sneakers:'shoe', Ch42_Hair1:'hair', Ch42__Eyelashes:'eyes' } },
  /* 2026-08-31,kc:「這是特殊角色要特殊骨架」+「旺宏也要下載新的」——小美哥
     (警局門口)、旺鴻(機車行)原本都借用 m3(Brian),但 m3 同時也是阿成/
     阿仁/工地老闆共用的那副,具名角色撞臉。Mixamo 抓「casual」分類挑的:
     m5 = Joe(西裝,平頭),m6 = Josh(深色外套+襯衫,蓬髮),兩個都是
     Fuse 角色包(部件名字前綴 Ch33_/Ch23_),跟 Remy/Leonard 同一種
     Body/Tops/Bottoms 分開的拓樸,不是 kid 那種全身一顆 mesh 換不了色。
     ⚠ 這輪先試過「Lewis」(單一 mesh 節點 `Ch12`,套色系統會把全身染
     成同一色,臉跟衣服分不開),不能用,換成 Joe 才成功分件——之後再抓
     新骨架前,先用「怎麼查一副新骨架的部件名字」那節的方法核對 glb 節點
     數量,只有 1 個 mesh 節點就代表分不了色,不要下載完才發現要重來。
     Suit/Shirt/Tie/Belt 這幾件外層衣服統一疊到 hood 色(跟 m2 的
     Sweater+Collar 同招),讀起來像一套制服,不用逐件分開染。 */
  m5: { idle:'base-human-m5-idle.glb', walk:'base-human-m5-walk.glb',
        parts: { Ch33_Body:'skin', Ch33_Shirt:'hood', Ch33_Suit:'hood', Ch33_Tie:'hood',
                  Ch33_Belt:'pants', Ch33_Pants:'pants', Ch33_Shoes:'shoe',
                  Ch33_Hair:'hair', Ch33_Eyelashes:'eyes' } },
  m6: { idle:'base-human-m6-idle.glb', walk:'base-human-m6-walk.glb',
        parts: { Ch23_Body:'skin', Ch23_Shirt:'hood', Ch23_Suit:'hood',
                  Ch23_Belt:'pants', Ch23_Pants:'pants', Ch23_Shoes:'shoe',
                  Ch23_Hair:'hair', Ch23_Eyelashes:'eyes' } },
  /* 小胖(2026-09-02,kc:「現在世界上還沒有小胖人物 你去下載一個年輕胖子」)。
     Mixamo 免費庫裡沒有「年輕+胖+便服」這個組合的角色——查過的胖體型角色
     (Ortiz 摔角選手、Big Vegas 貓王)匯出後都只有一顆合併 mesh(Ch43/
     沒有分件),換色系統靠物件名字分材質,一顆 mesh 分不開,連皮膚色都
     調不了,見 assets/models/README.md「怎麼查一副新骨架的部件名字」那節
     —— Ortiz 技術上直接死掉,不是美術取捨。改用正常體型的 James,靠
     buildNPC() 新增的 opts.widen 在 X/Z 方向加寬(不動身高)撐出「胖」的
     輪廓,不是真的换了胖體型模型。

     ⚠ 第一輪誤判(kc 抓到「完全沒套用到皮膚 超怪」,查證後發現我搞錯了):
     James 匯出後也是只有 1 個 mesh 節點(Ch06),材質切了 3 個 slot,但
     `Ch06_body1` **不是衣服,是鞋子**——`Ch06_body` 才是「皮膚+上衣+褲子
     全部黏在同一塊材質」的完整身體,沒有獨立的「上衣」區域。第一版把
     body1 當「衣服」貼龍虎貼圖,結果貼到鞋子上,身體整個是皮膚色一片,
     這才是「怪」的真正原因,不是燈光(我一開始猜錯方向,浪費了 kc 一輪
     來回,見 docs/DESIGN_NOTES.md 那節記錄)。

     真正做法:用 `tools/dump_uv_regions.py`(這輪新增)把 Ch06_body 的
     UV 攤平圖 + 部位色塊圖(照骨骼分軀幹/手臂/腿/臉/手五類上色)一起
     匯出給 kc,他拿去生圖,龍虎花紋準確畫在軀幹+手臂那兩塊 UV 島,臉/
     手保持皮膚色——這張圖(`char-fat-body-uv.png`)是「已經精準對齊 UV」
     的完整貼圖,不能再套用既有 `opts.tex` 那套鏡射處理(見下面
     `opts.texRaw`),鏡射會把這張圖切兩份疊起來,直接毀掉對齊。
     `Ch06_body1`(鞋子)維持素色,parts 改指到 'shoe' 不是 'hood'。 */
  m7: { idle:'base-human-m7-idle.glb', walk:'base-human-m7-walk.glb',
        parts: { Ch06_body:'skin', Ch06_body1:'shoe', Ch06_eyelashes:'eyes' } },
  /* 2026-09-03,kc:「你能不能找到別的女生模型啊」——越式按摩那位
     (game.html workerIndoor)原本借用 `f`(Sophie),跟「阿姨等背景女性
     NPC」共用同一副,跟小美哥/旺鴻補 m5/m6 專屬骨架同一個理由(具名
     角色不該跟背景路人共用)。Mixamo 搜 casual/girl 篩出三個候選,kc
     說「先換好 然後三個都下載 才可以自由換路人」——三副都轉檔收進
     registry,`workerIndoor` 這輪先接 f3(Jody,理由見下面),f4/f5
     留著給以後路人湊數用,不是白下載。
     三副都是分件乾淨的拓樸(Body/Shirt/Pants/Shoes/Hair/Eyelashes 各自
     獨立 mesh 節點,不是 kid/Ortiz 那種單一合併 mesh),換色不會踩到
     「一顆 mesh 分不開」的坑。 */
  f3: { idle:'base-human-f3-idle.glb', walk:'base-human-f3-walk.glb',
        /* Jody——kc 挑的是頭髮色調最接近既有 worker-portrait.png 大頭貼
           的一個(深色短髮,其餘兩個 Elizabeth 捲髮/Kate 金髮色差更大)。
           臉本身沒辦法照大頭貼客製,Mixamo 角色的臉是固定的。Ch37_Zipper
           是外套拉鍊那塊小裝飾,沒有獨立衣服區域可以對應,疊到 hood 色
           跟著外套一起染,不留白。 */
        parts: { Ch37_Body:'skin', Ch37_Shirt:'hood', Ch37_Zipper:'hood',
                  Ch37_Pants:'pants', Ch37_Sneakers:'shoe',
                  Ch37_Hair:'hair', Ch37_Eyeleashes:'eyes' } },
  f4: { idle:'base-human-f4-idle.glb', walk:'base-human-f4-walk.glb',
        /* Elizabeth——備用,先轉檔收著,還沒接到任何角色身上。 */
        parts: { Ch26_Body:'skin', Ch26_Shirt:'hood', Ch26__Pants:'pants',
                  Ch26_Heels:'shoe', Ch26_Hair:'hair', Ch26_Eyelashes:'eyes' } },
  f5: { idle:'base-human-f5-idle.glb', walk:'base-human-f5-walk.glb',
        /* Kate——備用,先轉檔收著,還沒接到任何角色身上。 */
        parts: { Ch21_Body:'skin', Ch21_Shirt:'hood', Ch21_Pants:'pants',
                  Ch21_Shoes:'shoe', Ch21_Hair:'hair', Ch21_Eyelasshes:'eyes' } }
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

/* 靜態小物 GLTF:跟角色的 riggedCharacter() 同一套「量 bounding box 校正尺寸」
 * 邏輯,但沒有骨架/換裝——縮放、水平置中、底部貼齊 y=0,回傳一個可以直接
 * add(group, x, 0, z, ...) 擺放的 Group。
 * 2026-08-13:kc 說遊樂器材這種小東西手刻箱體撐不住細節(滑梯改了三輪比例
 * kc 還是說「超怪」),放棄箱體改抓 Poly Pizza 的免費低模模型(CC-BY 3.0,
 * 授權見 assets/models/CREDITS.md)。lockAxis 選要撐滿 targetSize 的是哪個
 * bounding box 軸('x'/'y'/'z')——鞦韆/翹翹板用長度撐滿(這座小公園擠不下
 * 這些模型的原始寫實比例,佔地面積比身高更容易撞到隔壁的長椅/圍籬,見下面
 * placeGltfProp() 呼叫處的間距推算),滑梯的「長度」也是撐滿軸,不是身高。 */
function propModel(THREE, gltf, targetSize, lockAxis, ry){
  const model = gltf.scene.clone(true);
  model.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = { x: box.max.x-box.min.x, y: box.max.y-box.min.y, z: box.max.z-box.min.z };
  const scale = targetSize / Math.max(size[lockAxis || 'y'], 1e-4);
  model.position.set(
    -(box.min.x+box.max.x)/2*scale,
    -box.min.y*scale,
    -(box.min.z+box.max.z)/2*scale
  );
  model.scale.setScalar(scale);
  const g = new THREE.Group();
  g.add(model);
  if(ry) g.rotation.y = ry;
  return g;
}

/* 機車車色貼圖(2026-08-17)——moto-vespa.glb 這顆模型完全沒有 UV 座標
   (只有 POSITION/NORMAL,查過 glTF JSON 確認過,不是猜的),原本 5 塊材質
   都是純色 baseColorFactor,沒有貼圖插槽。kc 想要十幾種不同烤漆質感的車色
   (不只是換純色),但沒有 UV 就沒地方貼真的照片材質——換一顆新模型是選項,
   但這批免費低模來源不保證找得到「有 UV 又同風格」的機車,先試相對便宜的
   做法:**現場算 box-projected UV**(對每個頂點看法線主要朝哪一軸,就用另外
   兩軸的座標當 UV),不需要模型本身有 UV,缺點是曲面(車殼圓角)貼圖會有
   輕微拉伸/接縫,但鏡頭在街上離得夠遠(見 CAM 那段註解 dist:22 high:11),
   細節誤差不至於穿幫。只套在車殼主體(Material.001,量出來是 1209 頂點的
   那塊淺灰面板)上——輪胎/把手/車燈那幾塊小材質维持原本純色,不然輪胎會被
   染成車漆色很怪。 */
function boxProjectUV(THREE, geometry, tile){
  const pos = geometry.attributes.position, norm = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for(let i = 0; i < pos.count; i++){
    const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i)), nz = Math.abs(norm.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if(nx >= ny && nx >= nz){ u = z; v = y; }
    else if(ny >= nx && ny >= nz){ u = x; v = z; }
    else { u = x; v = y; }
    uv[i*2] = u / tile; uv[i*2+1] = v / tile;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/* file 抓不到(圖還沒生出來)就完全不動 model,維持原本純色材質——只有
   TextureLoader 真的載到圖才會換材質,不會出現「材質換成空白貼圖」這種半殘
   狀態。model 是 propModel() 回傳的 group。 */
function applyMotoSkin(THREE, model, file){
  if(!file) return;
  new THREE.TextureLoader().load(TEX_DIR + file, tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    model.traverse(o => {
      if(!o.isMesh || o.material.name !== 'Material.001') return;
      /* 2026-09-03 踩到的坑(kc:「白色的車我覺得好醜」那輪加 setSkin() 讓
         同一台車能重複換色才發現)——新 MeshStandardMaterial 沒帶 name,
         下面判斷式 `o.material.name !== 'Material.001'` 第二次呼叫時永遠
         true(已經不是 'Material.001' 了),直接 return,車色再也換不掉。
         第一次呼叫(parkMoto() 停車當下)因為只呼叫一次沒踩到,這裡補上
         name 讓材質判斷式對任意呼叫次數都成立,不是只能用一次。 */
      boxProjectUV(THREE, o.geometry, 3.2);
      o.material = new THREE.MeshStandardMaterial({ name:'Material.001', map:tex, roughness:.55 });
    });
  }, undefined, () => {});
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

/* playOnce() 單次動作的播放速度倍率,見下面 playOnce() 裡的說明——原始
   Mixamo 動作播完整段太拖,不同動作拖的幅度不同,用一個表分開調,不要都套
   同一個倍率。沒列進來的 name 用 1.8 當預設。 */
const ONCE_SPEED = { pickup: 2.8, pet: 1.6, pet_low: 1.6 };

/* 騎機車跨坐姿(2026-08-17)——sitAction 是 Mixamo 抓來的「坐椅子」動作
   (膝蓋併攏、雙腳落地),不是騎車姿勢,kc 玩起來說「沒有騎機車的動作」。
   找過 Mixamo 有沒有專門的機車/腳踏車騎乘動作,沒有貨(motorcycle/motorbike/
   biker/scooter/bike/moped/bicycle/straddle/horse 都搜過)。改成:sit 動畫
   照樣播,騎乘中每幀在 mixer.update() 之後,只在「大腿」骨頭疊加一個張開
   的旋轉——小腿/腳掌不動,維持 sit 動畫原本算出來的角度(kc:「腳根本
   不用動」,反正機車上小腿大半被車身擋住,不用為了看不太到的地方冒風險)。
   骨骼名字抓法跟 addTattoo() 同一套。
   **角度上限踩過的坑**:大腿骨此刻已經被 sit 動畫轉過一次,local 軸不等於
   世界座標的左右/前後,疊加旋轉的效果不是線性的——拿 boneWorldPos() 量過
   一輪,角度加到 .5 兩腳幾乎沒分開,加到 .65 以上兩腳直接在世界座標裡交叉
   打結(踝關節左右順序整個反過來,看起來像側坐/坐反了)。.4 左右是安全
   上限,量出來兩腳間距約 9cm,分得不算開但至少沒有交叉——kc 的重點現在是
   手臂,腿先求穩定不出包。 */
export const RIDE_POSE = {
  thighSplay:.35,
  armX:-.7, armZ:.2, armY:.05    // 肩膀三軸合起來轉,手才會平伸,見下面說明——
                                  // 2026-08-17 kc 拿 #tune 面板現場拖出來的定案值。
};

function applyRidePose(bones){
  if(!bones.LeftUpLeg) return;
  bones.LeftUpLeg.rotateY(-RIDE_POSE.thighSplay);
  bones.RightUpLeg.rotateY(RIDE_POSE.thighSplay);
  /* 手往前平伸(2026-08-17 kc 要求)——sit 動畫是手放大腿上那種坐姿,肩膀
     往前抬。拿 __dbg.boneWorldPos() 量手掌實際世界座標試出來的,不是肉眼
     直接調中的:
     - 只轉 local X 一軸,手掌雖然有往前(+z)也有抬高,但同時整條手臂會
       往外側偏(側向分量跟著變大),畫面上讀成「手舉起來張開」不是「往前伸」。
     - local X + local Z 兩軸一起轉,側向分量互相抵銷、往前的分量還加大,
       手臂才會讀成一直線往前伸。兩軸的角度是各自試出來的固定值,不是同一個
       數字的正負號换算。
     - 兩軸疊加後手肘本身還有點彎,但因為是疊加在 sit 動畫本來的手肘角度上,
       再去動手肘骨頭(local X/Y/Z 都試過)只會讓手掌往後或往側邊偏,沒有一個
       軸能單純把手肘拉直,所以手肘不動,靠肩膀兩軸就夠讀成「伸手」了。
     - **左右鏡射注意**:local X 兩邊同號,local Z 兩邊要反號(跟大腿的
       thighSplay 一樣是鏡射骨骼),同號的話其中一邊的側向分量會加倍不會
       抵銷,手臂讀起來還是歪的——這裡踩過一次。
     - armY:2026-08-17 kc 要求補上第三軸給 #tune 面板拖(當時只有 X/Z 兩個
       slider,kc 說不夠)。單獨測過對手掌位置影響很小(接近骨頭自己的
       length/twist 軸),但留著給面板拖著玩,鏡射方式跟 armZ 一樣兩邊反號。 */
  if(bones.LeftArm){
    bones.LeftArm.rotateX(RIDE_POSE.armX);
    bones.LeftArm.rotateZ(RIDE_POSE.armZ);
    bones.LeftArm.rotateY(RIDE_POSE.armY);
    bones.RightArm.rotateX(RIDE_POSE.armX);
    bones.RightArm.rotateZ(-RIDE_POSE.armZ);
    bones.RightArm.rotateY(-RIDE_POSE.armY);
  }
}

export function buildPlayer(THREE, scene){
  const g = new THREE.Group();
  scene.add(g);

  const M = buildCharacterMaterials(THREE);
  const primitive = buildPrimitiveRig(THREE, g, M);
  let mode = 'primitive';
  let mixer = null, idleAction = null, walkAction = null, runAction = null, sitAction = null, activeAction = null, model = null;
  let runPhase = 0;                                   // 只在「跑步動畫還沒載到」的過渡期用,見下面
  const onceActions = {};                             // name -> clipAction 快取,見 playOnce()
  let playingOnce = false;                            // true 時 animate() 的 idle/walk/run 切換整段跳過
  const RIDE_BONES = {};                              // 騎機車跨坐姿,見 applyRidePose()

  const rig = MODELS.m;                               // 主角固定用 Remy(男性)這副骨架
  loadModel(rig.idle).then(idleGltf => {
    model = riggedCharacter(THREE, idleGltf, M, PLAYER.height, rig.parts);

    /* 朝向:2026-08-12 實測 Remy 這份模型面向剛好跟場景一致,不用轉。
     * 之後換別的來源模型如果肉眼看反了,改這行成 Math.PI。 */
    model.rotation.y = 0;

    g.remove(primitive.rig);
    g.add(model);
    mode = 'gltf';

    /* 騎機車跨坐姿(2026-08-17)——見 applyRidePose() 的說明,骨骼名字抓法
       跟 addTattoo() 同一套(Mixamo 'mixamorig:XXX' 被 GLTFLoader 拿掉冒號)。
       LeftFoot/RightFoot/LeftLeg/RightLeg 沒被 applyRidePose() 用到,留著
       是給 __dbg.boneWorldPos() 除錯用(量骨頭實際世界座標,肉眼在單一鏡頭
       角度容易看錯,見 RIDE_POSE 那段的教訓)。 */
    ['LeftUpLeg','RightUpLeg','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand','LeftFoot','RightFoot','LeftLeg','RightLeg']
      .forEach(n => { RIDE_BONES[n] = model.getObjectByName('mixamorig'+n); });

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
    /* 騎機車坐姿(2026-08-14)——原本試過角色整個藏起來/站著跟車走,kc 玩起來
       都說不像騎車,改成真的坐姿。Mixamo 抓來的是「坐椅子」那種動作(膝蓋
       90 度、雙腳併攏),不是專門的騎車姿勢,兩腿沒有跨開——這個遊戲的視角
       離得夠遠、風格夠簡化,先頂著用,kc 覺得穿模明顯再考慮找專門的騎車
       動畫或抓 IK 分開兩腿。LoopRepeat(預設)撐著,不用 LoopOnce——riding
       可能持續很久,不是放一次就要停的手勢。 */
    if(rig.sit) loadModel(rig.sit).then(sitGltf => {
      if(sitGltf.animations[0]) sitAction = mixer.clipAction(sitGltf.animations[0]);
    }).catch(() => {});
  }).catch(() => {});

  /* 換裝(2026-08-19,打工穿店員制服用)——照 buildNPC() 的 opts.tex 那段
   * 同一套 ImageLoader+prep()+CanvasTexture 邏輯,只是包成可以「臨時換、
   * 之後換回來」的一對方法,而不是建立時就決定死。origMaps 存的是換之前
   * 那個材質的 map/color,resetTex() 直接還原物件參照,不是重新從檔案讀
   * 一次玩家原本的衣服貼圖(省一次網路/decode,也不用另外記玩家原本穿
   * 什麼檔名)。 */
  const origMaps = {};
  function setTex(slot, file){
    if(!M[slot]) return;
    if(!(slot in origMaps)) origMaps[slot] = { map:M[slot].map, color:M[slot].color.getHex() };
    new THREE.ImageLoader().load(TEX_DIR + file, img => {
      const t = new THREE.CanvasTexture(prep(img, { mirror:true, lift:.1 }));
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      M[slot].map = t; M[slot].color.setHex(0xffffff); M[slot].needsUpdate = true;
    }, undefined, () => {});
  }
  function resetTex(slot){
    if(!M[slot] || !(slot in origMaps)) return;
    M[slot].map = origMaps[slot].map; M[slot].color.setHex(origMaps[slot].color); M[slot].needsUpdate = true;
  }

  /* 單次動作(撿垃圾彎腰、摸貓狗蹲下這種,不是循環播放的 idle/walk/run)。
     name 對到 rig.once 的 key,找不到檔案或骨架還沒載好就直接呼叫 onDone,
     跟這個專案「缺檔案不會壞」的慣例一致——呼叫端(game.html)不用另外判斷
     動畫載了沒,永遠會拿到 onDone 被呼叫。播放期間 animate() 的 idle/walk/run
     切換整段跳過(見 playingOnce 那個 flag),放開之後自動 crossfade 回 idle,
     不用呼叫端自己處理「播完要切什麼」。 */
  function playOnce(name, onDone){
    if(mode !== 'gltf' || !mixer || !idleAction || !rig.once || !rig.once[name]){
      onDone && onDone();
      return;
    }
    const useAction = clip => {
      playingOnce = true;
      activeAction.fadeOut(.2);
      clip.reset().fadeIn(.2).play();
      activeAction = clip;
      const onFinished = e => {
        if(e.action !== clip) return;
        mixer.removeEventListener('finished', onFinished);
        playingOnce = false;
        activeAction.fadeOut(.2);
        idleAction.reset().fadeIn(.2).play();
        activeAction = idleAction;
        onDone && onDone();
      };
      mixer.addEventListener('finished', onFinished);
    };
    if(onceActions[name]){ useAction(onceActions[name]); return; }
    loadModel(rig.once[name]).then(gltf => {
      if(!gltf.animations[0]){ onDone && onDone(); return; }
      const clip = mixer.clipAction(gltf.animations[0]);
      clip.setLoop(THREE.LoopOnce);
      clip.clampWhenFinished = true;
      /* Mixamo 原始動作(pickup ~4s)播完整段太拖——kc 反應「撿東西速度太慢
         了,應該是彎腰撿」,一段慢動作看起來不像乾脆的彎腰動作,反而模糊。
         直接加快播放速度(timeScale),不是剪片段——AnimationAction 允許
         >1 的 timeScale,幅度不變、只是播快一點,彎腰撿的動作意圖才讀得出來。
         2026-08-14:pickup 來源後來又換過一次——「Picking Up Object」
         (Object Height=5)腰彎得不夠深,kc 說「根本沒有蹲到地上」,換成
         「Gathering Objects」(180 幀,全蹲式,手真的碰到地面)。
         timeScale 先調到 3.5 抵消新素材變長,kc 看完覺得太快又調慢回 2.8。 */
      clip.timeScale = ONCE_SPEED[name] || 1.8;
      onceActions[name] = clip;
      useAction(clip);
    }).catch(() => { onDone && onDone(); });
  }

  /* riding(第 4 參數,2026-08-14 補):騎機車中——true 就整段蓋掉 idle/
   * walk/run 的判斷,直接撐坐姿(sitAction 還沒載到就先退回原本的 idle/
   * walk/run,不會空白,跟其他動畫「缺檔案不會壞」的慣例一致)。跑步的
   * 前傾/彈跳疊加(runPhase 那段)只在真的用走路動畫頂跑步的過渡期有意義,
   * 騎車時不管有沒有 useRun 都不該疊,所以額外用 !riding 擋掉。 */
  function animate(dt, moving, run, riding){
    if(mode === 'primitive'){ primitive.animate(dt, moving, run); return; }
    if(!mixer) return;
    if(!playingOnce){
      let next = activeAction, useRun = false;
      if(riding && sitAction){
        next = sitAction;
      } else if(walkAction && idleAction){
        useRun = moving && run > 1 && !!runAction;
        if(!useRun) walkAction.timeScale = run;       // 還沒載到跑步動畫時,退回舊做法頂著
        if(runAction) runAction.timeScale = 1;        // 跑步動畫節奏本身就對,不用再乘 run
        next = useRun ? runAction : (moving ? walkAction : idleAction);
      }
      if(next !== activeAction){                      // 狀態切換才 crossfade,不是每幀都呼叫
        activeAction.fadeOut(.15);
        next.reset().fadeIn(.15).play();
        activeAction = next;
      }
      /* model 的前傾/彈跳只在「用跑步動畫」以外的情況疊加——真的跑步動畫
         自己就有正確的前傾跟手臂擺動,再疊會變成兩層前傾一起加乘,反而怪。
         這段只是 runAction 還沒載到那幾秒的過渡效果,見上面 fallback。 */
      if(model){
        if(!riding && !useRun && moving && run > 1){
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
    if(riding) applyRidePose(RIDE_BONES);              // 套跨坐姿,見上面 RIDE_POSE 的說明
  }
  return { group:g, animate, playOnce, setTex, resetTex, eyeY:PLAYER.eyeY, height:PLAYER.height,
            debugBones: () => RIDE_BONES };
}

/* NPC:一顆骨架、換一套材質顏色站著不動(idle 動畫)。
 * 跟 buildPlayer 共用同一份 idle glb(loadModel 快取),不用重新下載一次。
 * 沒有方塊人 fallback——NPC 這批本來就是這次才新增的,沒有「舊畫法」要相容。
 *
 * opts: { x, z, rotationY, rig, height, skin, hair, hood, pants, shoe, tex, tattoo, path, speed }
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
 *
 * path(2026-08-19,行人巡邏,見 DESIGN_NOTES「主街/廟口的行人」):[[x1,z1],
 * [x2,z2]] 兩點,給了就在這兩點之間直線來回走(接 walk 動畫,不是原地
 * idle),沒給就是原本站定不動那套(小步待機+偶爾轉頭看玩家)。speed
 * 不填預設 .0022(單位/毫秒,比玩家走路慢,見 buildPlayer 那邊 .0055 這個
 * 數字是「單位/毫秒」的量級)。**只擋玩家,不擋其他行人**——每隻行人給
 * 各自不重疊的座標區段就好(座標怎麼挑的、怎麼確認沒卡進牆裡/機車,見
 * DESIGN_NOTES 那節),没有做行人互相閃避,範圍先縮到這裡。
 * 回傳 { group, animate }——animate(dt) 要接進呼叫端的 render loop,
 * 不然 idle 動畫的骨架姿勢不會更新,角色會卡在瀏覽器抓到檔案那一刻的預設姿勢。 */
export function buildNPC(THREE, scene, opts){
  console.log('[buildNPC entry]', opts.rig, !!opts.bottle);
  const g = new THREE.Group();
  g.position.set(opts.x || 0, .3, opts.z || 0);
  scene.add(g);

  const rig = MODELS[opts.rig || 'm'];
  const M = {
    skin: new THREE.MeshStandardMaterial({ color:opts.skin,  roughness:.85 }),
    hair: new THREE.MeshStandardMaterial({ color:opts.hair,  roughness:.9 }),
    /* 2026-08-24 kc 抓到坐姿腋下露出一塊背景色——布料網格在那個姿勢角度
       折疊,露出背面,預設 FrontSide 會被剔掉變透空。改 DoubleSide 讓背面
       也畫出來,擋住那個洞;只加在 hood/pants(衣物,才會折疊到露背面),
       skin/hair/shoe 沒遇到這個問題不用跟著改。 */
    hood: new THREE.MeshStandardMaterial({ color:opts.hood,  roughness:.9, side:THREE.DoubleSide }),
    pants:new THREE.MeshStandardMaterial({ color:opts.pants, roughness:.9, side:THREE.DoubleSide }),
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

  /* opts.texRaw(2026-09-02,小胖用)——跟 opts.tex 一樣接 { slot: 檔名 },
     但不經過 prep() 的鏡射。opts.tex 那套鏡射是給「只畫半邊、靠對稱補滿」
     的一般布料花紋用;小胖這張(`char-fat-body-uv.png`)是照 Ch06_body
     真的 UV 攤平圖畫出來的,座標已經精準對應軀幹/手臂/臉/手每一塊,鏡射
     會把整張圖切兩份疊起來,直接把對齊毀掉,所以要走原圖直貼這條路。 */
  if(opts.texRaw){
    Object.entries(opts.texRaw).forEach(([slot, file]) => {
      if(!file || !M[slot]) return;
      new THREE.TextureLoader().load(TEX_DIR + file, t => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        M[slot].map = t; M[slot].color.setHex(0xffffff); M[slot].needsUpdate = true;
      });
    });
  }

  /* 小步待機(2026-08-14):完全站定不動看起來像雕像,加一層極小幅度的
   * 「活著」細節——不接 walk 骨架、不真的移動座標(那是「大步」的範圍,見
   * 對話紀錄,還沒做),只在 idle 姿勢上疊偶爾轉向玩家 + 原地重心晃動。
   * 沒有獨立頭骨,轉向是整顆模型小角度旋轉,幅度鎖在 ±.6 弧度內(約 34°),
   * 不會整個人轉過去、看起來還是「站在原地瞄一眼」。animate() 第二參數
   * playerPos 沒給(例如超商店員 clerkTick())就完全不會觸發,退回純 idle。 */
  let baseRotationY = opts.rotationY || 0;
  let model = null, glancing = false, glanceT = 0, glanceTimer = 1200 + Math.random()*2400;
  let swayPhase = Math.random()*Math.PI*2;
  /* setHelmet(frac, domeScale)——給滑桿現場調用,frac 是安全帽 Y 位置佔身高
     的比例(預設 .88,見下面 opts.helmet 那則筆記),domeScale 是額外再乘一次
     的整體縮放。用 helmetInvScale/helmetHeight 兩個外層變數存,函式定義在
     .then() 裡面(那邊才拿得到 invScale/height),這裡先留 null 版本,
     model 還沒載入完成之前呼叫是安全的空操作。 */
  let setHelmet = () => {};

  /* 巡邏(path,2026-08-19 從純 2 點來回擴充成「多站來回、每站可以停留」):
   * targetIdx 指向 opts.path 裡「正在走去的那一點」,走到底(第一或最後一個
   * 索引)才掉頭,不是只有 2 點——путь數量可以是 2、3、5 點都行,dir 記
   * 目前正往陣列哪個方向走(+1/-1),來回沿同一條路徑走,不是繞圈(這座城
   * 沒有真的路徑規劃,直線走每一段都要 kc/我事先用 __dbg.city.blocked()
   * 逐段驗證過不會穿牆,轉角多插一個中繼點就好,見 game.html PEDESTRIANS
   * 那則長註解)。每個點可以是 [x,z] 或 [x,z,waitMs]——第三個數字是走到
   * 這一點之後要停留幾毫秒才繼續(不給就是 0,直接接著走,舊的純 2 點
   * pedestrian 沒有第三個數字,行為跟改之前一模一樣,不用擔心動到)。
   * walkAction 只有給了 path 才去載,省得每隻站定不動的 NPC 也白白多下載
   * 一次 walk.glb。 */
  const patrolling = Array.isArray(opts.path) && opts.path.length >= 2;
  const patrolSpeed = opts.speed || .0022;
  let targetIdx = 1, dir = 1, waitT = 0, idleAction = null, walkAction = null, activeAction = null;

  /* 機車後座(2026-09-01,阿霞公車站任務——kc:「新增動畫好了」,要真的
     坐在後座,不是文字帶過)。第一版只收大腿骨,手維持 sit 動畫原本放
     腿上的姿勢——kc:「手搭著肩膀要跟主角一樣的動作」,補上 LeftArm/
     RightArm(applyRidePose() 手臂平伸那段本來就靠 bones.LeftArm 是否
     存在來判斷要不要套用,見那個函式開頭的說明),套用同一份共用的
     RIDE_POSE 數值——乘客跟騎士的手臂角度是同一個數字,不是各自獨立
     調(「跟主角一樣的動作」的字面意思),不要另外開一組乘客專屬的角度
     滑桿,不然兩邊調出來會不一致,失去「一樣」的意義。riding 開著時
     animate() 提早 return,座標/朝向完全交給呼叫端的 setRideTransform(),
     跟騎乘中的機車本身「呼叫端算好座標,這裡只負責套用」同一個分工。 */
  const RIDE_BONES = {};
  let riding = false, sitAction = null;

  let mixer = null;
  loadModel(rig.idle).then(idleGltf => {
    model = riggedCharacter(THREE, idleGltf, M, opts.height || PLAYER.height, rig.parts);
    model.rotation.y = baseRotationY;
    /* opts.widen(2026-09-02,小胖用)——只加寬 X/Z,身高(scale.y 那個
       riggedCharacter() 已經校正好的縮放)不動,便宜撐出「胖」的輪廓,
       不用真的找一副胖體型模型(見 MODELS.m7 那則長筆記)。 */
    if(opts.widen){ model.scale.x *= opts.widen; model.scale.z *= opts.widen; }
    g.add(model);

    /* 安全帽(2026-08-28,kc:「工地老闆可以帶個安全帽嗎」)——opts.helmet
       給顏色字串(或 true 用預設黃色)。掛在 model 底下當子物件,不是掛在
       外層 g:model 有自己的縮放(riggedCharacter 內部量 bounding box校正
       身高,縮放值只存在 model.scale,外面拿不到),用 1/model.scale.x
       把安全帽的尺寸/位置反縮放抵銷掉,這樣安全帽本身大小才不會跟著身高
       校正被放大或縮小。掛在 model 底下還有個好處:idle 待機轉頭(下面
       animate() 每幀改的是 model.rotation.y)安全帽會自動跟著轉,不用
       另外同步一份旋轉。 */
    if(opts.helmet){
      const hc = typeof opts.helmet === 'string' ? opts.helmet : '#e8b73a';
      const hMat = new THREE.MeshStandardMaterial({ color:hc, roughness:.5 });
      /* 2026-08-28 第三輪(kc:「工地老闆如果晃來晃去安全帽會破圖」)——
         上一輪為了消除「浮空」把圓頂加深(phiLength .55→.68)、位置壓低,
         結果圓頂跟頭部球體幾何互相穿插,兩片表面靠太近會 z-fighting(視角
         一動,深度排序在畫面上抖動閃爍,看起來像「破圖」)。真正的解法不是
         位置再喬一次(那只是把穿插點搬位置,治標不治本),是把圓頂半徑
         加大(.24→.29)讓整顆頭完全包在帽子裡面、留出間隙,不要讓兩片
         表面貼太近或穿模。 */
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.29, 12, 8, 0, Math.PI*2, 0, Math.PI*.6), hMat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .045, 16), hMat);
      brim.position.y = -.05;
      const helmet = new THREE.Group();
      helmet.add(dome); helmet.add(brim);
      const invScale = 1 / model.scale.x;
      const npcHeight = opts.height || PLAYER.height;
      model.add(helmet);
      /* setHelmet(frac, scaleMult, dx, dz)(2026-08-28,kc:「我要安全帽
         定位」,第二輪加 X/Z——frac 是 Y 位置佔身高的比例(預設 .88),
         scaleMult 是額外倍率(預設 1),dx/dz 是水平方向的世界單位偏移
         (預設 0,正 dx 往角色右手邊、正 dz 往角色面向的方向——因為掛在
         model 底下,dx/dz 是跟著角色朝向轉的「相對」方向,不是場景固定的
         世界 X/Z)。外層 `let setHelmet` 先蓋掉上面那個空函式,讓 __dbg
         那邊接的滑桿可以直接呼叫這個 NPC 的 setHelmet(),不用重開整個
         場景。dx/dz 一樣要乘 invScale 抵銷 model 的縮放,道理跟 Y 一樣;
         scaleMult 只乘進 helmet.scale,不要乘進 position,不然帽子縮放時
         基準位置會跟著飄。 */
      /* 預設值(.925/.9/.025/-.07)是 kc 用 __dbg.tweakForemanHelmet() 滑桿
         現場調出來、截圖確認貼合之後給的最終數字(2026-08-28)。 */
      setHelmet = (frac = .925, scaleMult = .9, dx = .025, dz = -.07) => {
        helmet.scale.setScalar(invScale * scaleMult);
        helmet.position.set(dx * invScale, npcHeight * frac * invScale, dz * invScale);
      };
      setHelmet();
    }

    ['LeftUpLeg','RightUpLeg','LeftArm','RightArm'].forEach(n => { RIDE_BONES[n] = model.getObjectByName('mixamorig'+n); });

    mixer = new THREE.AnimationMixer(model);
    /* opts.pose 借一顆額外動作蓋掉 idle(2026-08-17 起,先是 'sit' 給爸爸
       醉倒那張截圖用,2026-08-18 補 'lie' 給「醉倒攤在地上」用):跟
       walk.glb 同一套「anim-only」——只有骨架+動畫沒有 mesh(見
       assets/models/README.md「轉檔」那節),mesh 還是從 rig.idle 那份來,
       這裡只是另外借一顆動畫接上同一個 mixer,跟 buildPlayer() 的
       sitAction 同一招。查 rig[opts.pose] 而不是寫死比對某個字串,哪個 rig
       有哪些額外姿勢看 MODELS registry,沒有就直接退回 idle,不會壞。 */
    const poseFile = opts.pose && rig[opts.pose];
    if(idleGltf.animations[0]){
      idleAction = mixer.clipAction(idleGltf.animations[0]);
      activeAction = idleAction;
    }
    if(poseFile){
      loadModel(poseFile).then(poseGltf => {
        if(poseGltf.animations[0]) mixer.clipAction(poseGltf.animations[0]).play();
        else if(idleAction) idleAction.play();
      }).catch(() => { if(idleAction) idleAction.play(); });
    } else if(idleAction) idleAction.play();
    /* opts.stillFace 真正要凍住的是這個 mixer 播放的 idle 動作本身(呼吸/
       重心微幅擺動那些烘進動畫檔的細節),不是只有下面 animate() 手動疊加
       的「轉頭看玩家 + sin 波浮動」那層——2026-08-28 第一輪只擋了後面那層,
       kc 說「工地老闆如果晃來晃去」代表其實是 idle 動畫本身在動,沒真的
       靜止。這裡跑一次 mixer.update(0.0001) 把骨架從匯入時的 T-pose 撥到
       idle 播放的第一格站姿,下面 animate() 每幀開頭那行改成 stillFace
       就不再繼續 update mixer,姿勢定格在這一格,不會再跑動畫。 */
    if(opts.stillFace && mixer) mixer.update(0.0001);

    /* opts.frozen(2026-08-20,圓環雕像用):呼叫端不會把這隻角色 push 進
       NPCS,所以永遠不會有人呼叫 animate() 幫 mixer 前進——但骨架不 tick
       過一次的話會卡在匯入時的 T-pose,不是站立的樣子。這裡借跟上面刺青
       同一招(mixer.update(0.0001)),把姿勢定格在 idle 播放的第一格,
       之後永遠不再更新,天然就是「靜止的雕像」,不用另外做凍結動畫系統。
       只處理沒有 poseFile 的情況——目前只有 MODELS.kid(沒有 sit/lie)
       會用到 frozen,不需要處理 poseFile 那個非同步分支。 */
    if(opts.frozen && !poseFile && mixer) mixer.update(0.0001);

    /* 巡邏才載 walk.glb——跟 buildPlayer() 的 walkAction 同一份骨架動畫
       (rig.walk),不重新做一套。載到之前 patrolling 那段會先站著不動,
       不會空白也不會報錯,跟這個檔案「缺檔案不會壞」的慣例一致。 */
    if(patrolling && rig.walk) loadModel(rig.walk).then(walkGltf => {
      if(walkGltf.animations[0]) walkAction = mixer.clipAction(walkGltf.animations[0]);
    }).catch(() => {});

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

  /* mountRide()/dismountRide():借同一副骨架的 rig.sit 動畫(跟 opts.pose
     的 poseFile 同一份檔案,不是另外做一套)當後座坐姿的底,疊上面
     RIDE_BONES 收集的大腿骨 + animate() 裡的 applyRidePose()。這副骨架
     沒有 sit 檔(見 MODELS registry,不是每副都有)就靜靜維持 idle,不會
     報錯或壞掉——跟 opts.pose 原本「沒有就退回 idle」的容錯慣例一致。 */
  function mountRide(){
    riding = true;
    if(!mixer) return;                      // idle 都還沒載完就被叫到,riding 旗標先記著,下面 animate() 會補套
    const poseFile = rig.sit;
    if(!poseFile) return;
    if(sitAction){
      if(activeAction !== sitAction){ activeAction.fadeOut(.2); sitAction.reset().fadeIn(.2).play(); activeAction = sitAction; }
      return;
    }
    loadModel(poseFile).then(sitGltf => {
      if(!sitGltf.animations[0]) return;
      sitAction = mixer.clipAction(sitGltf.animations[0]);
      if(riding){ activeAction.fadeOut(.2); sitAction.reset().fadeIn(.2).play(); activeAction = sitAction; }
    }).catch(() => {});
  }
  function dismountRide(){
    riding = false;
    if(idleAction && activeAction !== idleAction){
      activeAction.fadeOut(.2); idleAction.reset().fadeIn(.2).play(); activeAction = idleAction;
    }
  }
  /* setRideTransform():呼叫端(game.html)每幀直接指定座位座標/朝向,
     這裡只負責套用——跟騎乘中的機車本身「呼叫端算好座標,這裡只套用」
     同一個分工,不在這個檔案裡算後座偏移量。 */
  function setRideTransform(x, y, z, ry){
    g.position.set(x, y, z);
    if(model) model.rotation.y = ry;
  }

  function animate(dt, playerPos){
    if(mixer && !opts.stillFace) mixer.update(dt/1000);
    if(!model) return;
    if(riding){
      if(RIDE_BONES.LeftUpLeg) applyRidePose(RIDE_BONES);
      return;
    }

    /* 巡邏(2026-08-19 擴充成多站來回+停留,見上面 opts.path 那則長註解):
       沿路徑走直線,走到底掉頭,走到「有停留時間」的點先罰站 waitT 毫秒
       再繼續。**只擋玩家**——玩家站在路線上(1.8 單位內)就停下來等,
       不會穿過去,不然「不穿模」這句白做了;沒有做行人互相閃避(每隻給
       的座標區段本來就不重疊)。walkAction 還沒載到之前用站定不動頂著,
       不會瞬移或空白。 */
    if(patrolling){
      if(waitT > 0){
        waitT -= dt;
        if(walkAction && idleAction && activeAction !== idleAction){
          activeAction.fadeOut(.2); idleAction.reset().fadeIn(.2).play(); activeAction = idleAction;
        }
        return;
      }
      const [tx, tz] = opts.path[targetIdx];
      const dx = tx - g.position.x, dz = tz - g.position.z, dist = Math.hypot(dx, dz);
      if(dist <= .15){
        waitT = opts.path[targetIdx][2] || 0;
        if(targetIdx === opts.path.length-1) dir = -1;
        else if(targetIdx === 0) dir = 1;
        targetIdx += dir;
      }
      const blocked = playerPos && Math.hypot(playerPos.x-g.position.x, playerPos.z-g.position.z) < 1.8;
      const moving = dist > .15 && !blocked;
      if(moving){
        const step = Math.min(dist, patrolSpeed*dt);
        g.position.x += dx/dist*step;
        g.position.z += dz/dist*step;
        model.rotation.y = Math.atan2(dx, dz);
      }
      if(walkAction && idleAction){
        const next = moving ? walkAction : idleAction;
        if(next !== activeAction){ activeAction.fadeOut(.2); next.reset().fadeIn(.2).play(); activeAction = next; }
      }
      return;
    }

    /* opts.stillFace(2026-08-28,kc:「人不要亂動」)——工地老闆截圖裡待機
       轉頭+重心晃動看起來像亂動,不是每個站定 NPC 都要這個「有點活著」的
       細節,加這個開關直接跳過下面 glance/sway 那整段,永遠釘死在
       baseRotationY,不用另外挑掉某一段效果。 */
    if(opts.stillFace){ model.rotation.y = baseRotationY; return; }

    glanceTimer -= dt;
    if(glanceTimer <= 0){
      const dist = playerPos ? Math.hypot(playerPos.x-g.position.x, playerPos.z-g.position.z) : Infinity;
      glancing = dist < 9 && Math.random() < .65;
      glanceTimer = glancing ? 1500 + Math.random()*1500 : 2200 + Math.random()*3200;
    }
    const targetT = glancing ? 1 : 0;
    glanceT += (targetT - glanceT) * Math.min(1, dt*.004);

    let targetY = baseRotationY;
    if(glanceT > .01 && playerPos){
      const dx = playerPos.x - g.position.x, dz = playerPos.z - g.position.z;
      const faceAngle = Math.atan2(dx, dz);
      let diff = Math.atan2(Math.sin(faceAngle-baseRotationY), Math.cos(faceAngle-baseRotationY));
      diff = Math.max(-.6, Math.min(.6, diff));
      targetY = baseRotationY + diff*glanceT;
    }
    model.rotation.y = targetY;

    swayPhase += dt*.0009;
    model.position.y = Math.sin(swayPhase)*.012;     // 重心換腳的極小幅度浮動,不是走路
  }
  /* setFacing(2026-08-19,收銀小遊戲排隊客人「輪到就轉向玩家」用)——
   * 呼叫端原本試著直接改 `group.rotation.y`,結果沒有效果:真正決定
   * 朝向的是上面 animate() 每幀重算、寫回 `model.rotation.y` 的
   * baseRotationY(model 是掛在 group 底下的子物件,改 group 的旋轉
   * 跟 model 自己每幀蓋掉的旋轉是兩層獨立的變換,不會互相影響)。改成
   * 把 baseRotationY 從 const 改 let,開一個 setter 讓呼叫端能真的改到
   * animate() 實際在用的那個值。 */
  function setFacing(angle){ baseRotationY = angle; }
  return { group:g, animate, setFacing, getMixer: () => mixer, setHelmet: (frac, scaleMult, dx, dz) => setHelmet(frac, scaleMult, dx, dz),
    mountRide, dismountRide, setRideTransform };
}
