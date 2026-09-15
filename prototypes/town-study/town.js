import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roads,destinations} from './layout.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {buildPlayer} from '../lib/scene-city3d.js';

// A new, small architectural scene. Only textures, prop models and the human rig are reused.
const scene=new T.Scene();scene.background=new T.Color('#96a4a5');scene.fog=new T.FogExp2('#96a4a5',.008);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.prepend(renderer.domElement);
const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment(renderer);scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
const camera=new T.PerspectiveCamera(47,innerWidth/innerHeight,.1,240),composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.10,.4,1.35);composer.addPass(bloom);composer.addPass(new OutputPass());
const hemi=new T.HemisphereLight('#cbd9dc','#4b534f',1.85);scene.add(hemi);const sun=new T.DirectionalLight('#ffe2bc',2.4);sun.position.set(-15,24,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-27,right:27,top:26,bottom:-26,near:.5,far:80});sun.shadow.normalBias=.025;sun.shadow.bias=-.00008;scene.add(sun);const rim=new T.DirectionalLight('#c6d9e6',.65);rim.position.set(8,12,-20);scene.add(rim);
const TEX='../../assets/tex/',MODEL='../../assets/models/';const loading=document.getElementById('load');const manager=new T.LoadingManager();let scheduled=false;manager.onProgress=(url,done,total)=>{loading.querySelector('small').textContent=`材質與模型 ${done} / ${total}`;};manager.onError=url=>console.warn('素材未載入',url);manager.onLoad=()=>{scheduled=true;};const tl=new T.TextureLoader(manager),gl=new GLTFLoader(manager),textures=new Map(),colliders=[],pickups=[],nightLights=[];
function texture(file,repeat=true){const key=file+'|'+repeat;if(textures.has(key))return textures.get(key);const map=tl.load(TEX+file);map.colorSpace=T.SRGBColorSpace;map.anisotropy=renderer.capabilities.getMaxAnisotropy();if(repeat)map.wrapS=map.wrapT=T.MirroredRepeatWrapping;textures.set(key,map);return map;}
function material(color,file,meters=2,roughness=.85,bump=.015,metalness=0){const m=new T.MeshStandardMaterial({color,roughness,metalness,envMapIntensity:.25});m.userData.meters=meters;if(file){m.map=texture(file);m.bumpMap=m.map;m.bumpScale=bump;}return m;}
const M={tile:material('#efeadb','wall.png',6.4,.88,.013),tileGreen:material('#becfc6','wall.png',6.4,.90,.010),brick:material('#eee4d4','brick-red.png',1.8,.97,.035),concrete:material('#d8d7c7','stone.png',3,.95,.023),floor:material('#cdd0c6','walk.png',2.0,.8,.025),road:material('#89928e','road.png',3.5,.8,.013),metal:material('#d1d3c9','metal-frame.png',1.6,.5,.008,.3),paint:material('#79928d','metal-frame.png',2.1,.7,.009,.2),wood:material('#c6b297','altar-table.png',2,.85,.012),shutter:material('#b2b9b2','shutter.png',3,.64,.019,.3),cream:material('#d7d4bd',null,2,.75),dark:material('#233b3b',null,2,.75),rubber:material('#182322',null,2,.96),white:material('#e5e4db',null,2,.56),glass:new T.MeshPhysicalMaterial({color:'#718b87',metalness:.05,roughness:.15,transparent:true,opacity:.16,depthWrite:false,envMapIntensity:.7}),light:new T.MeshStandardMaterial({color:'#fff3d2',emissive:'#ffe0a3',emissiveIntensity:1.2}),red:material('#934c3b','metal-frame.png',2,.7,.01)};
let seed=7341;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);const choose=a=>a[Math.floor(rnd()*a.length)];
function projectUV(geo,w,h,d,m,x=0,y=0,z=0){if(!m.userData?.meters)return;const meters=m.userData.meters,p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));const px=p.getX(i)+x,py=p.getY(i)+y,pz=p.getZ(i)+z;const a=ny>nx&&ny>nz?[px,pz]:nx>nz?[pz,py]:[px,py];uv.setXY(i,a[0]/meters,a[1]/meters);}uv.needsUpdate=true;}
function box(g,x,y,z,w,h,d,m,rounded=false){const geo=rounded?new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d,.12)*.18):new T.BoxGeometry(w,h,d);projectUV(geo,w,h,d,m,x,y,z);const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function cyl(g,x,y,z,r,h,m,segments=16){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
function barrier(x,z,w,d){colliders.push({x,z,w:w/2,d:d/2});}
function line(g,points,r=.025,m=M.metal){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const o=new T.Mesh(new T.TubeGeometry(path,24,r,6,false),m);o.castShadow=true;g.add(o);return o;}
function light(g,x,y,z,power=12,color='#ffe0ac',range=9){const l=new T.PointLight(color,power,range,2);l.position.set(x,y,z);g.add(l);nightLights.push(l);return l;}
function imagePanel(g,file,x,y,z,w,h){const m=new T.MeshStandardMaterial({map:texture(file,false),roughness:.92,side:T.DoubleSide});const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(x,y,z);g.add(o);return o;}
function textSign(text,w,h,{bg='#1f5145',ink='#ebe7cd',sub='',glow=false}={}){const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=ink;ctx.globalAlpha=.13;for(let i=0;i<450;i++)ctx.fillRect(rnd()*c.width,rnd()*c.height,rnd()*4,.5+rnd());ctx.globalAlpha=1;ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.strokeRect(9,9,c.width-18,c.height-18);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${Math.min(c.height*.56,c.width/(text.length+1))}px "Songti TC",serif`;ctx.fillText(text,c.width/2,c.height*(sub?.40:.5));if(sub){ctx.font=`${c.height*.14}px system-ui`;ctx.fillText(sub,c.width/2,c.height*.81);}const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const m=new T.MeshStandardMaterial({map,roughness:.7,emissive:glow?'#ffffff':'#000000',emissiveMap:glow?map:null,emissiveIntensity:.32});return new T.Mesh(new T.PlaneGeometry(w,h),m);}
function sign(g,text,x,y,z,w,h,opt={}){box(g,x,y,z-.07,w+.07,h+.07,.14,M.metal,true);const s=textSign(text,w,h,opt);s.position.set(x,y,z+.005);g.add(s);return s;}
// The road meets a continuous raised pavement, recessed shop floor and narrow return alley.
box(scene,0,-.3,0,90,.4,90,M.road);box(scene,0,.05,-1.8,34,.3,6.4,M.floor);box(scene,5.0,.06,-13.5,3.4,.3,19,M.floor);box(scene,0,.10,1.44,34,.32,.20,M.concrete,true);
for(let x=-16;x<16;x+=1.2){box(scene,x,.268,1.41,.035,.02,.23,M.dark);}
// Drainage channels, narrow asphalt repairs and a cast-iron cover, aligned with the road.
for(let x=-15;x<16;x+=3.2){box(scene,x,.221,1.7,.75,.035,.21,M.metal);for(let i=0;i<8;i++)box(scene,x-.32+i*.09,.243,1.7,.032,.008,.17,M.dark);}
const cover=cyl(scene,-3,-.08,5,.48,.065,M.metal,40);for(let i=-3;i<=3;i++)box(scene,-3+i*.10,-.042,5,.024,.02,.67,M.dark);
for(let k=0;k<4;k++)box(scene,-9+k*2.1,-.073,9.0,1.05,.016,1.3,M.white);
// Contact shadows are localized to foundations, wheels and props instead of darkening the whole image.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d'),grad=sc.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'rgba(12,20,17,.52)');grad.addColorStop(1,'rgba(12,20,17,0)');sc.fillStyle=grad;sc.fillRect(0,0,128,128);const shadowMap=new T.CanvasTexture(shadowCanvas);
function contact(g,x,z,w,d,y=.215){const p=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));p.rotation.x=-Math.PI/2;p.position.set(x,y,z);g.add(p);}
function window(g,x,y,z,w,h,{bars=true,balcony=false}={}){box(g,x,y,z-.13,w+.2,h+.20,.32,M.concrete,true);box(g,x,y,z+.038,w,h,.015,M.dark);const pane=box(g,x,y,z+.055,w-.12,h-.12,.025,M.glass);pane.castShadow=false;for(const a of [-1,1]){box(g,x+a*w/2,y,z+.11,.048,h,.065,M.metal,true);box(g,x,y+a*h/2,z+.11,w,.048,.065,M.metal,true);}box(g,x,y,z+.13,.046,h,.05,M.metal);box(g,x,y,z+.14,w,.044,.045,M.metal);if(bars){for(let a=-w/2+.1;a<w/2;a+=.16)box(g,x+a,y,z+.30,.019,h+.04,.025,M.metal);box(g,x,y-h*.34,z+.31,w,.025,.025,M.metal);box(g,x,y+h*.34,z+.31,w,.025,.025,M.metal);}box(g,x,y-h/2-.08,z+.2,w+.35,.09,.55,M.concrete,true);if(balcony){box(g,x,y-h/2-.18,z+.42,w+.8,.16,1.2,M.concrete,true);for(let a=-w/2-.25;a<w/2+.3;a+=.14)box(g,x+a,y-h/2+.28,z+1,.022,.80,.022,M.paint);box(g,x,y-h/2+.68,z+1,w+.66,.045,.04,M.paint,true);}}
function aircon(g,x,y,z){box(g,x,y,z,.85,.53,.42,M.white,true);imagePanel(g,'ac-unit.png',x,y,z+.216,.81,.49);box(g,x-.32,y-.34,z,.05,.15,.54,M.metal);box(g,x+.32,y-.34,z,.05,.15,.54,M.metal);line(g,[[x+.43,y,z],[x+.61,y-.15,z],[x+.61,y-1.1,z-.08]],.025,M.cream);}
function balconyClothes(g,x,y,z){line(g,[[x-1,y+.7,z],[x,y+.6,z],[x+1,y+.7,z]],.008,M.metal);for(let i=0;i<3;i++){const color=choose(['#a1b1b5','#c1b89e','#666c69']);const fabric=material(color,'tarp-blue.png',1.8,.97,.009);const shirt=box(g,x-.68+i*.64,y+.3,z,.4,.53,.025,fabric);shirt.rotation.z=(rnd()-.5)*.1;box(g,x-.68+i*.64,y+.51,z,.61,.13,.025,fabric);}}
function upper(g,w,d,height,wallMat){const front=d/2;
 // Separate wall piers and lintels leave inset windows, no entire-front photograph.
 box(g,0,(height+3.3)/2,-d/2+.13,w,height-3.3,.26,wallMat);box(g,-w/2+.13,(height+3.3)/2,0,.26,height-3.3,d,wallMat);box(g,w/2-.13,(height+3.3)/2,0,.26,height-3.3,d,wallMat);
 for(let y=3.3;y<height-.3;y+=2.8){box(g,0,y+.35,front,w,.7,.22,wallMat);box(g,0,y+2.61,front,w,.40,.22,wallMat);for(let j=-1;j<=1;j++){const wx=j*w*.30,ww=w*.23;window(g,wx,y+1.57,front+.01,ww,1.7,{bars:j!==0,balcony:j===0});}for(const j of [-.48,-.155,.155,.48])box(g,j*w,y+1.6,front,w*.07,2.0,.25,wallMat);box(g,0,y+2.83,0,w+.10,.16,d+.10,M.concrete,true);aircon(g,w*.31,y+.13,front+.3);}
 box(g,0,height,0,w+.25,.22,d+.25,M.concrete,true);for(const side of [-1,1])box(g,side*w/2,height+.38,0,.17,.62,d,M.concrete);box(g,0,height+.38,-d/2,w,.62,.17,M.concrete);const tank=cyl(g,-w*.28,height+.8,-.8,.5,1.30,M.metal,24);cyl(g,-w*.28,height+1.46,-.8,.54,.05,M.metal,24);line(g,[[w*.43,height,front+.25],[w*.43,1,front+.25],[w*.35,.2,front+.25]],.038,M.paint);
}
function openShell(x,z,w,d,h,wm=M.tile){const g=new T.Group();g.position.set(x,.2,z);scene.add(g);box(g,0,.075,0,w,.15,d,M.floor);box(g,0,1.65,-d/2,w,3.3,.26,wm);box(g,-w/2,1.65,0,.25,3.3,d,wm);box(g,w/2,1.65,0,.25,3.3,d,wm);box(g,0,3.3,0,w+.05,.17,d+.05,M.concrete,true);upper(g,w,d,h,wm);barrier(x-w/2,z,.28,d);barrier(x+w/2,z,.28,d);barrier(x,z-d/2,w,.3);barrier(x,z,w,d*.30);return g;}
// Main convenience shop: transparent entrance, real shelves, tiles and diffused fluorescent light.
const store=openShell(-1,-6,7.8,6,9.05,M.tileGreen);const f=3;
box(store,0,3.27,4.0,8.15,.27,2.6,M.concrete,true);for(const x of [-3.65,3.65]){box(store,x,1.65,4.55,.31,3.3,.31,M.tileGreen,true);barrier(x-1,-1.45,.36,.36);contact(scene,x-1,-1.45,1.2,1.2);}
for(let j=0;j<12;j++)box(store,-3.83+j*.7,3.14,4.1,.042,.035,2.40,M.metal);
sign(store,'裕成便利商店',0,3.76,4.56,7.65,.79,{bg:'#2d554b',ink:'#eee5c9',sub:'Y U  C H E N G  ·  2 4 H',glow:true});box(store,0,3.20,4.7,7.95,.1,.08,M.red);
for(const x of [-3.7,-1.9,1.25,3.7])box(store,x,1.47,f+.05,.055,2.84,.11,M.metal,true);for(const y of [.17,2.89])box(store,0,y,f+.05,7.45,.055,.11,M.metal,true);
for(const x of [-2.85,2.48]){box(store,x,1.47,f+.06,1.74,2.67,.025,M.glass).castShadow=false;box(store,x,1.08,f+.08,1.72,.08,.045,M.paint);}
// Sliding door parked to the side: the opening stays traversable.
box(store,1.08,1.47,2.94,1.36,2.69,.024,M.glass).castShadow=false;box(store,1.71,1.47,2.98,.048,2.76,.08,M.metal,true);box(store,1.53,1.36,3.06,.024,.47,.044,M.metal,true);
box(store,-.33,.175,3.1,2.25,.035,.55,M.metal);box(store,-.33,.20,3.75,1.9,.028,.85,M.rubber);
// Pack fronts use crisp labels and varied wrapping, not a store photograph.
const packs=[];for(const [name,color]of [['茶','#8d9c55'],['米果','#bf9a5d'],['鮮乳','#d4d8ca'],['咖啡','#826253'],['洋芋片','#c47749'],['汽水','#688e83']]){const front=textSign(name,.18,.26,{bg:color,ink:'#f3eee2'}).material;packs.push(front);}
function shelf(g,x,z,w){for(const y of [.25,.73,1.21,1.69]){box(g,x,y,z,w,.065,.55,M.white);box(g,x,y+.06,z+.30,w,.07,.035,M.red);for(let j=0;j<Math.floor(w/.24);j++){const pk=new T.Mesh(new T.BoxGeometry(.18,.30,.22),[M.white,M.white,M.white,M.white,packs[j%packs.length],M.white]);pk.position.set(x-w/2+.16+j*.24,y+.19,z);pk.castShadow=true;g.add(pk);}}for(const side of [-1,1])box(g,x+side*w/2,1,z,.045,1.85,.52,M.metal);}
shelf(store,-1.2,-2.45,4.8);shelf(store,-1.75,.15,2.7);box(store,2.9,1.2,-1.9,1.17,2.35,.72,M.white,true);box(store,2.9,1.26,-1.50,1.02,1.91,.025,M.glass);shelf(store,2.9,-1.82,.9);box(store,2.1,.67,1.07,2.3,1.25,.65,M.paint,true);box(store,2.1,1.33,1.07,2.45,.06,.75,M.concrete,true);const pos=box(store,2.25,1.56,1.05,.36,.27,.06,M.dark,true);pos.rotation.x=-.2;barrier(1.1,-4.93,2.3,.7);
for(const z of [-1.8,.9,3.8]){box(store,0,3.08,z,2.7,.06,.18,M.light,true);light(store,0,2.85,z,8,'#ffedd1',6.5);}
imagePanel(store,'prop-poster-note.png',-2.7,1.9,3.09,.48,.67);imagePanel(store,'prop-poster-pet.png',-3.19,1.65,3.095,.35,.48);balconyClothes(store,-.1,5.03,4.0);
// Left shop: lower, older brick side wall, partly lowered rolling shutter and projecting tin awning.
const left=openShell(-9.8,-6.3,7.0,6.5,6.25,M.tile);box(left,0,1.55,3.23,6.5,3.0,.13,M.shutter);for(let y=.2;y<3;y+=.13)box(left,0,y,3.32,6.48,.026,.038,M.metal);sign(left,'三和機車行',0,3.77,3.51,6.7,.70,{bg:'#354e54',ink:'#e4dbc0'});
for(const side of [-1,1])line(left,[[side*3.1,3.05,3.2],[side*3.1,3.0,4.6],[side*3.1,3.58,3.21]],.024,M.metal);
const awning=box(left,0,3.07,4.0,7.25,.055,1.75,material('#b4b8a4','tarp-red.png',2,.9,.009));awning.rotation.x=.08;for(let x=-3.5;x<3.6;x+=.24)box(left,x,3.07,4.0,.025,.075,1.73,M.metal);imagePanel(left,'prop-poster-torn.png',-2.8,1.5,3.33,.55,.80);
// Narrow side alley between independent volumes, with a return passage behind the shop.
const right=openShell(9.1,-8.0,6.6,8.6,11.85,M.tile);right.rotation.y=-.06;box(right,0,1.60,4.23,6.2,2.9,.13,M.shutter);sign(right,'美香麵店',0,3.64,4.57,6.15,.72,{bg:'#a38e6b',ink:'#403e32'});box(right,-3.38,1.6,-.5,.10,3.0,6.2,M.brick);
const perpendicular=sign(scene,'乾麵・餛飩',6.08,4.8,-4.0,.64,2.1,{bg:'#365a51',ink:'#e6dabc'});perpendicular.rotation.y=-.10;line(scene,[[5.88,5.9,-4.4],[6.45,5.9,-4.4],[6.45,4,-4.4]],.03,M.metal);
const rear=openShell(-.7,-20.2,8.5,5.8,8.6,M.tile);rear.rotation.y=.035;sign(rear,'永安里  六巷',1,2.2,3.02,1.6,.48,{bg:'#27564e',ink:'#e5e7d5'});box(rear,0,1.4,3,2.2,2.5,.12,M.paint);barrier(-.7,-17.2,8.5,.3);
for(const [x,z]of [[4,-4],[4,-10],[4,-16]]){contact(scene,x,z,2.1,3);}
// Textured utility hardware, drain pipes and conduit follow the wall rather than floating.
for(const [x,z]of [[3.04,-6.8],[3.04,-13],[5.82,-7]]){const unit=box(scene,x,1.57,z,.20,.66,.47,M.metal,true);const p=imagePanel(scene,'meterbox-unit.png',x+.112,1.57,z,.43,.60);p.rotation.y=Math.PI/2;line(scene,[[x+.12,.22,z],[x+.12,1.2,z],[x+.12,1.2,z+.3],[x+.12,2.4,z+.3]],.017,M.metal);}
for(const z of [-6,-13]){box(scene,4.0,.23,z,1.9,.055,.28,M.dark);for(let i=0;i<14;i++)box(scene,3.12+i*.14,.27,z,.035,.02,.28,M.metal);}
line(scene,[[-13,7.1,-2],[-5,6.3,-1],[3,7.0,-2],[12,6.8,-3]],.012,M.dark);line(scene,[[-13,7.3,-2],[-5,6.5,-1],[3,7.2,-2],[12,7,-3]],.01,M.dark);
light(scene,4.4,2.8,-12,5,'#f2dca9',8);box(scene,4.4,3.1,-12,.48,.11,.22,M.light,true);

// Leaf cutouts use the source image's luminance as opacity; no flat lime-green proxy bushes.
const foliageTex=texture('tree-crown-1.png',false);const foliageMat=new T.MeshStandardMaterial({map:foliageTex,alphaMap:foliageTex,alphaTest:.16,side:T.DoubleSide,roughness:1,color:'#c1cdb4',envMapIntensity:.12});
function crown(g,x,y,z,size,rot=0){for(let i=0;i<3;i++){const o=new T.Mesh(new T.PlaneGeometry(size,size),foliageMat);o.position.set(x+(i-1)*size*.06,y,z);o.rotation.y=rot+i*Math.PI/3;o.castShadow=true;g.add(o);}}
function planter(x,z){const g=new T.Group();g.position.set(x,.21,z);scene.add(g);cyl(g,0,.24,0,.27,.48,M.concrete,16);cyl(g,0,.49,0,.24,.035,M.wood);for(let i=0;i<3;i++)crown(g,(rnd()-.5)*.3,.72+rnd()*.18,(rnd()-.5)*.3,.75,i);}
function foliageTree(x,z,height){const g=new T.Group();g.position.set(x,.21,z);scene.add(g);cyl(g,0,height*.26,0,.20,height*.52,M.wood,12);for(let i=0;i<6;i++){const a=i*Math.PI/3;line(g,[[0,height*.25,0],[Math.sin(a)*.8,height*.55,Math.cos(a)*.8],[Math.sin(a)*1.5,height*.67,Math.cos(a)*1.5]],.08,M.wood);crown(g,Math.sin(a)*1.3,height*.67+(i%2)*.5,Math.cos(a)*1.3,3.5,a);}contact(scene,x,z,5,5);}
// Existing detailed meshes are normalized to metres and planted on the pavement.
const propCache=new Map();async function prop(file,x,z,size,axis='y',rot=0){if(!propCache.has(file))propCache.set(file,gl.loadAsync(MODEL+file));const gltf=await propCache.get(file);const model=cloneSkeleton(gltf.scene);const wrap=new T.Group();wrap.add(model);scene.add(wrap);const bounds=new T.Box3().setFromObject(model),s=new T.Vector3();bounds.getSize(s);const factor=size/s[axis];model.scale.setScalar(factor);bounds.setFromObject(model);const center=bounds.getCenter(new T.Vector3());model.position.set(-center.x,-bounds.min.y,-center.z);wrap.position.set(x,ground(x,z),z);wrap.rotation.y=rot;wrap.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const ms=Array.isArray(o.material)?o.material:[o.material];const cloned=ms.map(original=>{const m=original.clone();m.envMapIntensity=.35;if(!m.map){m.roughness=.72;if(file==='incense-bowl.glb'){m.color.set('#6b7668');m.map=texture('incense-stone.png');}if(file==='moto-vespa.glb'&&m.name==='Material.001'){o.geometry=o.geometry.clone();o.geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(o.geometry.attributes.position.count*2),2));m.userData={meters:3.2};projectUV(o.geometry,1,1,1,m);m.map=texture(['moto-skin-navy.png','moto-skin-cream.png','moto-skin-silver.png'][Math.abs(Math.round(x))%3]);m.color.set(0xffffff);m.roughness=.48;m.metalness=.22;}if(o.geometry.attributes.uv){m.bumpMap=texture('metal-frame.png');m.bumpScale=.008;}}return m;});o.material=Array.isArray(o.material)?cloned:cloned[0];});return wrap;}
for(const [x,z,r]of [[-7.2,.25,.2],[-9,.5,.28],[-11,.3,.16]]){prop('moto-vespa.glb',x,z,1.86,'z',r).catch(console.warn);contact(scene,x,z,1.3,2.4);barrier(x,z,.74,1.9);}
prop('trash-bin.glb',2.95,-1.1,.80).catch(console.warn);prop('recycle-bin.glb',3.65,-2.0,.84).catch(console.warn);prop('bench.glb',-13.3,-.3,1.5,'x',0).catch(console.warn);
foliageTree(-15.0,-1.0,6.5);foliageTree(12,-19,7);barrier(-15,-1,1,1);
for(const [x,z]of [[-5.1,-1.1],[2.65,-2.4],[6,-3.1],[3.3,-16]]){planter(x,z);contact(scene,x,z,1.2,1.3);}
// A handful of physical paper notices and worn pavement edges make the entrance lived-in.
for(let i=0;i<3;i++)box(scene,2.2+i*.3,.22,-1.1,.20,.17,.33,M.wood,true);
// Continuous streets retain the established three horizontal / two vertical topology.
box(scene,0,-.34,0,118,.4,136,M.concrete);
for(const z of roads.horizontal){
 box(scene,0,-.12,z,110,.08,7,M.road);
 for(const side of [-1,1]){box(scene,0,.04,z+side*4.65,109,.34,2.3,M.floor);box(scene,0,.12,z+side*3.56,109,.28,.16,M.concrete);}
 for(let x=-50;x<51;x+=4)if(Math.abs(Math.abs(x)-34)>5)box(scene,x,-.072,z,1.6,.014,.09,M.cream);
}
for(const x of roads.vertical){box(scene,x,-.11,0,7,.08,118,M.road);for(const side of [-1,1])box(scene,x+side*4.65,.04,0,2.3,.34,118,M.floor);}
// Repaint crossings after the longitudinal pavement so routes stay level.
for(const x of roads.vertical)for(const z of roads.horizontal){box(scene,x,-.075,z,11.7,.016,11.7,M.road);for(let i=-2;i<=2;i++){box(scene,x+i*.8,-.057,z+4.5,.45,.016,1.5,M.white);box(scene,x+i*.8,-.057,z-4.5,.45,.016,1.5,M.white);}}
function blockPaving(x,z,w,d){box(scene,x,.025,z,w,.34,d,M.floor);}
blockPaving(-15,-20,25,23);blockPaving(19,-20,17,23);blockPaving(-17,23,25,23);blockPaving(18,23,24,23);
function shop(x,z,name,{w=7,d=6,h=9.05,rotation=0,color='#36584e',home=false}={}){
 const start=colliders.length,g=openShell(x,z,w,d,h,(Math.round(x)%2)?M.tileGreen:M.tile);g.rotation.y=rotation;
 const back=new T.Group();back.rotation.y=Math.PI;g.add(back);for(let y=4.85;y<h-1;y+=2.8)for(const x of [-w*.28,w*.28])window(back,x,y,d/2+.03,1.1,1.35);aircon(back,w*.28,3.8,d/2+.25);
 const front=d/2;sign(g,name,0,3.76,front+.65,w-.25,.72,{bg:color,ink:'#ebe3ce'});
 box(g,0,3.22,front+.6,w+.2,.15,1.8,M.concrete,true);
 for(const side of [-1,1])box(g,side*(w/2-.15),1.6,front+1.35,.22,3.2,.22,M.tile);
 if(home){box(g,0,1.4,front+.06,1.5,2.6,.15,M.paint);window(g,-w*.3,1.8,front,.95,1.4);window(g,w*.3,1.8,front,.95,1.4);}
 else {box(g,-w*.27,1.5,front+.05,w*.43,2.8,.10,M.shutter);box(g,w*.20,1.5,front+.05,w*.45,2.8,.025,M.glass);box(g,w*.42,1.5,front+.10,.07,2.9,.09,M.metal);box(g,w*.22,.70,front-1.1,w*.4,1.2,.65,M.wood);imagePanel(g,'prop-poster-note.png',-w*.30,1.6,front+.12,.4,.58);}
 barrier(x,z+front,w,.25);
 for(const b of colliders.slice(start)){const dx=b.x-x,dz=b.z-z,c=Math.cos(rotation),s=Math.sin(rotation);b.x=x+c*dx+s*dz;b.z=z-s*dx+c*dz;const bw=b.w,bd=b.d;b.w=Math.abs(c)*bw+Math.abs(s)*bd;b.d=Math.abs(s)*bw+Math.abs(c)*bd;}
 return g;
}
// Lower residential lane behind the commercial row; the passage joins both side streets.
shop(-19,-21,'永安里 六巷 12 號',{h:6.25,home:true});shop(-27,-21,'永安里 六巷 16 號',{w:6,h:9.05,home:true});
shop(24,-24,'春芳養生館',{h:9.05,color:'#775d67'});
for(const [x,n]of [[-25,'永安藥局'],[-17,'阿春飯堂'],[-9,'刺青'],[1,'金星遊藝場'],[11,'青禾茶行'],[22,'阿明檳榔']])shop(x,16,n,{w:x===1?8:7,rotation:Math.PI,h:x===11?6.25:9.05,color:x===1?'#534e67':'#4b655e'});
for(const [x,n]of [[-23,'永安洗衣'],[-14,'瑞發五金'],[15,'福成香舖'],[24,'老陳雜貨']])shop(x,-44,n,{h:6.25});
for(const x of [-24,-15,15,24]){planter(x,-39.2);prop('moto-vespa.glb',x+1,-39,1.86,'z',.25).catch(console.warn);}
// Temple: physical tiled roof courses, recessed hall, stone forecourt and actual incense vessel.
const templeWall=material('#dfc7a8','temple-wall.png',5,.92,.025),templeRoof=material('#75897d','temple-roof.png',2,.88,.03),gold=material('#b9a16a','temple-gold.png',2,.57,.015,.3);
blockPaving(0,-46,20,24);
const tg=new T.Group();tg.position.set(0,.21,-54);scene.add(tg);
box(tg,0,.20,0,13,.40,9,M.concrete);box(tg,0,2.5,-4,12,4.6,.4,templeWall);for(const s of [-1,1])box(tg,s*6,2.5,0,.4,4.6,8,templeWall);
for(const x of [-5,-2.5,2.5,5]){cyl(tg,x,2.35,3.4,.20,4.4,M.red);cyl(tg,x,.55,3.4,.32,.35,M.concrete);}
for(const [x,file]of [[-3,'temple-door-left.png'],[0,'temple-door-center.png'],[3,'temple-door-right.png']])imagePanel(tg,file,x,2.1,-3.76,2.45,3.55);
sign(tg,'福安宮',0,4.23,3.7,3.3,.82,{bg:'#633e31',ink:'#e2c78e'});
function roof(g,cy,w,d){const section=[[-d/2,.32],[-d*.4,0],[-d*.23,.4],[0,1.6],[d*.23,.4],[d*.4,0],[d/2,.32]],v=[],uv=[],idx=[];for(const x of [-w/2,w/2])for(const [z,y]of section){v.push(x,cy+y,z);uv.push(x/2,z/2);}for(let i=0;i<6;i++)idx.push(i,i+1,i+7,i+1,i+8,i+7);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const mat=templeRoof.clone();mat.side=T.DoubleSide;const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);for(let x=-w/2;x<w/2;x+=.25)line(g,section.map(([z,y])=>[x,cy+y+.04,z]),.04,templeRoof);for(const x of [-w/2,w/2])line(g,section.map(([z,y])=>[x,cy+y+.06,z]),.11,gold);line(g,[[-w/2-.4,cy+2,0],[-w/2,cy+1.65,0],[0,cy+1.7,0],[w/2,cy+1.65,0],[w/2+.4,cy+2,0]],.12,gold);}
roof(tg,4.65,14.3,10);roof(tg,6.65,9,6);
barrier(0,-54,12,8);cyl(scene,0,.70,-46,.52,.78,M.concrete,32);cyl(scene,0,1.11,-46,.61,.12,gold,32);cyl(scene,0,1.18,-46,.49,.035,M.wood,32);for(const x of [-.36,.36])box(scene,x,.32,-46,.15,.30,.30,gold,true);for(let i=0;i<9;i++)cyl(scene,(rnd()-.5)*.60,1.44,-46+(rnd()-.5)*.5,.011,.55,M.red,6);for(const x of [-3,3])light(tg,x,3.8,2,18,'#ffce8f',9);barrier(0,-46,1.8,1.8);
for(const x of [-4,-2,2,4])prop('lantern.glb',x,-49.8,.65).then(o=>o.position.y=3.6).catch(console.warn);
foliageTree(-9,-43,7);foliageTree(9,-43,7);barrier(-9,-43,.7,.7);barrier(9,-43,.7,.7);
// Independent school architecture: broad corridor, courtyard and a clear south-facing gate.
const schoolMat=material('#d9d3b8','school-wall-side.png',7,.92,.015);
const sg=new T.Group();sg.position.set(-18,.21,27);scene.add(sg);
box(sg,0,3.7,0,19,7.4,6,schoolMat);for(let y=1.7;y<7;y+=3)for(let x=-8;x<9;x+=2.65)window(sg,x,y,3.04,1.8,1.6,{bars:false});
box(sg,0,7.5,0,19.4,.22,6.4,M.concrete);sign(sg,'永安國民中學',0,7.1,3.1,6,.75,{bg:'#667d72'});barrier(-18,27,19,6);
for(const x of [-30,-6]){box(scene,x,1.5,32,.6,3,.6,schoolMat);for(let z=21;z<33;z+=.45)box(scene,x,1.1,z,.04,1.8,.04,M.paint);}
box(sg,0,1.5,3.10,2.4,2.8,.12,M.dark);box(sg,0,1.5,3.18,.065,2.8,.09,M.metal);for(const x of [-1,1])box(sg,x,1.3,3.2,.04,.5,.06,M.metal);box(sg,0,3.1,3.6,3.5,.18,1.4,M.concrete);
sign(scene,'永安國民中學',-24,1.2,33.6,4,.62,{bg:'#36594e'});
// Park: branching walks, planted shade and actual playground meshes.
const soil=material('#778572','stone.png',2,.99,.01);box(scene,18,.20,27,22,.05,15,soil);box(scene,18,.235,27,3,.03,16,M.floor);box(scene,18,.235,27,22,.03,2.4,M.floor);
for(const [x,z]of [[9,22],[27,22],[9,33],[27,33]]){foliageTree(x,z,6.5);barrier(x,z,.65,.65);}
for(const [x,z]of [[12,25],[24,30]])prop('bench.glb',x,z,1.7,'x',0).catch(console.warn);
prop('slide.glb',24,24,2.8).catch(console.warn);barrier(24,24,2,3);prop('seesaw.glb',12,31,2.6,'x').catch(console.warn);barrier(12,31,2.8,1.1);
sign(scene,'永安里公園',18,1.2,34,3.2,.55,{bg:'#3d6251'});
// West-side hospital faces the street; the police station anchors the east side.
shop(-46,10,'永安醫院',{w:12,d:8,h:11.85,rotation:Math.PI/2,color:'#567c7d'});
shop(46,14,'永安派出所',{w:10,d:8,h:6.25,rotation:-Math.PI/2,color:'#3c5473'});
// Bus shelter and construction remain south of 永安街, not a railway station.
box(scene,12,2.7,46,6,.18,2.2,M.paint);for(const x of [9.2,14.8])box(scene,x,1.45,46.8,.09,2.7,.09,M.metal);box(scene,12,1.5,46.8,5.4,2.3,.04,M.glass);sign(scene,'永安公車站',12,2.4,45.1,4,.55);prop('bench.glb',12,46,2,'x').catch(console.warn);
box(scene,-17,.1,51,22,.15,10,M.wood);for(let x=-28;x<-5;x+=2){box(scene,x,1.15,55,1.98,2.1,.12,M.paint);box(scene,x,1.15,47,1.98,2.1,.12,M.paint);}barrier(-17,51,22,8);prop('bulldozer.glb',-17,51,3).catch(console.warn);sign(scene,'工區出入口',-16,1.6,46.9,4,.65,{bg:'#9c794f'});
// Street furniture follows the routes instead of filling the walkable corridors.
for(const x of [-29,29])for(const z of [-30,-9,20,45]){cyl(scene,x,2.9,z,.065,5.4,M.metal);line(scene,[[x,5.6,z],[x+.6,5.9,z],[x+1.2,5.7,z]],.06,M.metal);box(scene,x+1.2,5.66,z,.6,.09,.23,M.light);barrier(x,z,.25,.25);}
for(const [z,name]of [[-36,'廟口路'],[4,'中華路'],[40,'永安街']])sign(scene,name,29,3,z-5,2,.48);
for(const x of [-34,34])for(let z=-25;z<35;z+=20)line(scene,[[x-5,6,z],[x,5.6,z+9],[x-5,6,z+20]],.012,M.dark);
for(const x of [-49,49])for(const z of [-42,-24,32,50])foliageTree(x,z,7);
// Merge opaque static meshes by material; camera clearance uses the building footprints.
function mergeStatic(){scene.updateMatrixWorld(true);const buckets=new Map(),meshes=[];scene.traverse(o=>{if(o===hero.group||hero.group.getObjectById(o.id)||!o.isMesh||Array.isArray(o.material)||o.material.transparent||o.isSkinnedMesh)return;let a=buckets.get(o.material);if(!a)buckets.set(o.material,a=[]);const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.deleteAttribute('uv1');g.deleteAttribute('uv2');if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));a.push(g);meshes.push(o);});for(const [mat,gs]of buckets){const geo=mergeGeometries(gs);if(!geo)continue;const m=new T.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;scene.add(m);for(const g of gs)g.dispose();}for(const m of meshes)m.removeFromParent();}
const svg=document.getElementById('minimap'),ns='http://www.w3.org/2000/svg';function shape(tag,attrs){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);svg.append(el);return el;}
shape('rect',{x:-59,y:-66,width:118,height:128,fill:'#dedacb'});for(const z of roads.horizontal)shape('path',{d:`M-55 ${z}H55`,stroke:'#faf7ed','stroke-width':7});for(const x of roads.vertical)shape('path',{d:`M${x} -60V58`,stroke:'#faf7ed','stroke-width':7});shape('rect',{x:7,y:19,width:22,height:15,fill:'#a4b99a'});
for(const p of destinations){const dot=shape('circle',{cx:p.x,cy:p.z,r:2.1,fill:'#48675f',tabindex:0,role:'button','aria-label':p.label});dot.style.cursor='pointer';dot.onclick=()=>view(p.id);dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')view(p.id);};const b=document.createElement('button');b.textContent=p.label;b.onclick=()=>view(p.id);document.getElementById('map-list').append(b);}
const marker=shape('circle',{cx:0,cy:4,r:2.5,fill:'#a34d36',stroke:'#fff9e5','stroke-width':1});function updateMap(p){marker.setAttribute('cx',p.x);marker.setAttribute('cy',p.z);}
document.getElementById('map-toggle').onclick=()=>document.getElementById('map-panel').classList.toggle('closed');if(innerWidth<700)document.getElementById('map-panel').classList.add('closed');

// The actor is the project's full human rig, at a 1.76m scale, not the block placeholder.
const hero=buildPlayer(T,scene);hero.group.scale.setScalar(1.76/hero.height);hero.group.position.set(-.5,-.075,5.4);hero.group.rotation.y=Math.PI;
let yaw=.48,pitch=.24,distance=10.2,night=false,drag=false,mx=0,my=0;const keys=new Set(),touch=new Set();const look=new T.Vector3(),desired=new T.Vector3();
mergeStatic();
function ground(x,z){return roads.horizontal.some(r=>Math.abs(z-r)<3.5)||roads.vertical.some(r=>Math.abs(x-r)<3.5)?-.075:.21;}
function blocked(x,z){return x<-54||x>54||z>57||z<-62||colliders.some(b=>Math.abs(x-b.x)<b.w+.21&&Math.abs(z-b.z)<b.d+.21);}
function view(where){const places=Object.fromEntries(destinations.map(p=>[p.id,[p.x,p.z,.25,.3,11]]));places.front=[-.5,5.4,.48,.24,10.2];places.alley=[4.45,-5,.15,.23,6.4];places.temple=[0,-40,.18,.28,13];places.school=[-18,36,.25,.27,13];const [x,z,y,p,d]=places[where];hero.group.position.set(x,ground(x,z),z);hero.group.rotation.y=Math.PI;yaw=y;pitch=p;distance=d;document.querySelectorAll('[data-place]').forEach(b=>b.classList.toggle('active',b.dataset.place===where));}
document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>view(b.dataset.place));document.getElementById('time').onclick=()=>{night=!night;sun.intensity=night?.20:2.4;hemi.intensity=night?.80:1.85;rim.intensity=night?.40:.65;scene.background.set(night?'#334b59':'#96a4a5');scene.fog.color.copy(scene.background);bloom.strength=night?.20:.1;document.getElementById('time').textContent=night?'傍晚':'入夜';};
addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&e.target===document.body)e.preventDefault();keys.add(e.key.toLowerCase());});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();touch.clear();drag=false;});const c=renderer.domElement;c.addEventListener('pointerdown',e=>{drag=true;mx=e.clientX;my=e.clientY;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-mx)*.005;pitch=T.MathUtils.clamp(pitch+(e.clientY-my)*.004,.09,.8);mx=e.clientX;my=e.clientY;});c.addEventListener('pointerup',()=>drag=false);c.addEventListener('pointercancel',()=>drag=false);c.addEventListener('wheel',e=>{e.preventDefault();distance=T.MathUtils.clamp(distance+e.deltaY*.01,3.4,15);},{passive:false});document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();touch.add(b.dataset.key);b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=()=>touch.delete(b.dataset.key);});addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
let previous=performance.now(),ready=false;const pressed=k=>keys.has(k)||touch.has(k);
renderer.setAnimationLoop(now=>{const dt=Math.min(now-previous,50);previous=now;if(pressed('q'))yaw+=dt*.0012;if(pressed('e'))yaw-=dt*.0012;const ix=Number(pressed('d')||pressed('arrowright'))-Number(pressed('a')||pressed('arrowleft')),iz=Number(pressed('s')||pressed('arrowdown'))-Number(pressed('w')||pressed('arrowup'));const moving=!!(ix||iz);if(moving){const len=Math.hypot(ix,iz),speed=pressed('shift')?.0045:.0025,dx=(ix*Math.cos(yaw)+iz*Math.sin(yaw))/len*speed*dt,dz=(-ix*Math.sin(yaw)+iz*Math.cos(yaw))/len*speed*dt;if(!blocked(hero.group.position.x+dx,hero.group.position.z))hero.group.position.x+=dx;if(!blocked(hero.group.position.x,hero.group.position.z+dz))hero.group.position.z+=dz;hero.group.position.y=ground(hero.group.position.x,hero.group.position.z);hero.group.rotation.y=Math.atan2(dx,dz);document.querySelectorAll('[data-place]').forEach(b=>b.classList.remove('active'));}hero.animate(dt,moving,pressed('shift'));
 look.copy(hero.group.position);look.y+=1.50;look.z-=1.0;desired.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance).add(look);const delta=desired.clone().sub(look);const length=delta.length(),direction=delta.clone().normalize(),cameraBlocks=colliders.filter(b=>!(Math.abs(look.x-b.x)<b.w+1.8&&Math.abs(look.z-b.z)<b.d+1.8));for(let t=.35;t<length;t+=.15){const q=look.clone().addScaledVector(direction,t);if(cameraBlocks.some(b=>Math.abs(q.x-b.x)<b.w+1.8&&Math.abs(q.z-b.z)<b.d+1.8)){desired.copy(look).addScaledVector(direction,Math.max(.35,t-.3));break;}}if(!ready)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*.007));camera.lookAt(look);const p=hero.group.position;updateMap(p);const near=destinations.reduce((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)<Math.hypot(b.x-p.x,b.z-p.z)?a:b);document.getElementById('location').textContent=near.district;document.getElementById('tip').textContent=near.label+' · '+Math.round(Math.hypot(near.x-p.x,near.z-p.z))+' 公尺';sun.position.set(p.x-15,24,p.z+14);sun.target.position.set(p.x,0,p.z);sun.target.updateMatrixWorld();composer.render();if(!ready&&scheduled&&hero.debugBones().LeftUpLeg){loading.remove();ready=true;}
});
setTimeout(()=>{if(!ready){scheduled=true;loading.querySelector('small').textContent='部分素材仍在載入，可稍候或重新整理。';}},20000);

// Developer path validation uses the same collision function as walking.
function auditRoutes(){const step=.5,NX=217,NZ=241,seen=new Uint8Array(NX*NZ),queue=[],ix=x=>Math.round((x+54)/step),iz=z=>Math.round((z+62)/step);const start=iz(4)*NX+ix(0);seen[start]=1;queue.push(start);for(let head=0;head<queue.length;head++){const n=queue[head],cx=n%NX,cz=Math.floor(n/NX);for(const [a,b]of [[cx-1,cz],[cx+1,cz],[cx,cz-1],[cx,cz+1]]){if(a<0||a>=NX||b<0||b>=NZ)continue;const j=b*NX+a;if(seen[j]||blocked(a*step-54,b*step-62))continue;seen[j]=1;queue.push(j);}}const result=destinations.map(p=>({id:p.id,reachable:!!seen[iz(p.z)*NX+ix(p.x)],blocked:blocked(p.x,p.z)}));console.info('Route audit '+JSON.stringify(result));}auditRoutes();
