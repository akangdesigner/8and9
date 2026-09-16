import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// Self-contained architectural study. No original game modules, assets or save state.
const scene=new T.Scene();scene.background=new T.Color('#95afb8');scene.fog=new T.FogExp2('#95afb8',.010);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;document.body.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,240);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.19,.5,1.18);composer.addPass(bloom);composer.addPass(new OutputPass());
const hemi=new T.HemisphereLight('#cbe1e6','#727a68',2.2);scene.add(hemi);
const sun=new T.DirectionalLight('#ffd6a3',3.2);sun.position.set(-24,40,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:130});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
const fill=new T.DirectionalLight('#afc9dd',.7);fill.position.set(20,13,-30);scene.add(fill);
let seed=891;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);const pick=a=>a[Math.floor(rand()*a.length)];
const mat=(color,roughness=.85,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
const M={stone:mat('#b6ad91'),edge:mat('#8d967f'),red:mat('#964933'),darkred:mat('#68372d'),roof:mat('#485b58'),roofEdge:mat('#a69665'),wood:mat('#715542'),dark:mat('#263d42'),metal:mat('#526b68',.6),glass:mat('#355860',.3,{metalness:.18}),cream:mat('#e7d9b3'),paving:mat('#a0a596'),asphalt:mat('#596c6d'),green:mat('#526b54'),leaf:mat('#758e65'),glow:mat('#f7da9a',.6,{emissive:'#ffb963',emissiveIntensity:1.6}),orange:mat('#c96c43'),white:mat('#e2dfc9')};
const cube=new T.BoxGeometry(1,1,1),colliders=[],lights=[],lanterns=[];
function box(parent,x,y,z,w,h,d,m,cast=true){const o=new T.Mesh(cube,m);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=cast;o.receiveShadow=true;parent.add(o);return o;}
function cylinder(parent,x,y,z,r,h,m,n=12){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,n),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function sphere(parent,x,y,z,r,m,scale=[1,1,1]){const o=new T.Mesh(new T.SphereGeometry(r,9,7),m);o.position.set(x,y,z);o.scale.set(...scale);o.castShadow=true;parent.add(o);return o;}
function barrier(x,z,w,d){colliders.push({x,z,w:w/2,d:d/2});}
function wire(points,color='#435356',radius=.022){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const o=new T.Mesh(new T.TubeGeometry(curve,24,radius,5,false),mat(color));scene.add(o);return o;}
function lamp(x,y,z,color='#ffc98b',power=8,dist=10){const l=new T.PointLight(color,power,dist,2);l.position.set(x,y,z);scene.add(l);lights.push(l);return l;}
function label(text,w,h,bg='#264f51',fg='#f2e4bf'){const c=document.createElement('canvas');c.width=768;c.height=Math.round(768*h/w);const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.strokeStyle=fg;x.globalAlpha=.55;x.lineWidth=5;x.strokeRect(12,12,c.width-24,c.height-24);x.globalAlpha=1;x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.font=`600 ${Math.min(c.height*.64,c.width/(text.length+1))}px "Songti TC",serif`;x.fillText(text,c.width/2,c.height*.51);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const material=mat('#fff',.8,{map:tex});return new T.Mesh(new T.PlaneGeometry(w,h),material);}
function sign(parent,text,x,y,z,w,h,bg,rot=0){const s=label(text,w,h,bg);s.position.set(x,y,z);s.rotation.y=rot;parent.add(s);return s;}
// Ground is spatially continuous, with separate raised sidewalks and a broad civic square.
box(scene,0,-.42,0,140,.6,140,mat('#6d8276'),false);
box(scene,0,-.08,7,11,.2,54,M.asphalt,false);
box(scene,0,.01,-17,33,.25,24,M.paving,false);
for(const x of [-6.2,6.2])box(scene,x,.09,9,2.1,.38,47,M.stone,false);
box(scene,15,.05,0,7,.3,39,M.stone,false);
box(scene,8,-.04,-12,23,.3,4,M.stone,false);
// Low-cost individual paving blocks with stable variations.
const paver=new T.InstancedMesh(cube,M.paving,1100);paver.receiveShadow=true;scene.add(paver);const dummy=new T.Object3D();let pi=0;
for(let z=-27;z<-6;z+=1.4)for(let x=-15;x<16;x+=1.6){if(pi>=1100)break;dummy.position.set(x,.17,z);dummy.scale.set(1.54,.055,1.34);dummy.updateMatrix();paver.setMatrixAt(pi,dummy.matrix);paver.setColorAt(pi,new T.Color().setHSL(.13,.09,.55+rand()*.13));pi++;}paver.count=pi;
for(let z=-8;z<30;z+=4){box(scene,0,.035,z,.10,.02,1.8,mat('#d5caa1'),false);}
function balcony(g,front,w,y){box(g,0,y,front+.42,w+.2,.16,1.05,M.stone);box(g,0,y+.83,front+.93,w,.065,.065,M.metal);for(let x=-w/2;x<=w/2;x+=.34)box(g,x,y+.43,front+.93,.035,.8,.035,M.metal);}
function window(g,x,y,z,w=1.05,h=1.4,lit=false){box(g,x,y,z,w+.18,h+.18,.14,M.cream);box(g,x,y,z+.085,w,h,.06,lit?M.glow:M.glass,false);box(g,x,y,z+.135,.065,h,.05,M.metal);box(g,x,y,z+.135,w,.055,.05,M.metal);}
function ac(g,x,y,z){box(g,x,y,z,.82,.5,.42,M.cream);const fan=cylinder(g,x,y,z+.24,.17,.025,M.metal,16);fan.rotation.x=Math.PI/2;for(let k=-2;k<=2;k++)box(g,x+k*.1,y,z+.26,.02,.35,.025,M.dark,false);}
function planter(g,x,z,size=.45){cylinder(g,x,.25,z,size*.72,.5,mat('#a06b50'));for(let k=0;k<5;k++)sphere(g,x+(rand()-.5)*size,.55+rand()*.3,z+(rand()-.5)*size,size*.65,pick([M.green,M.leaf]),[1,.65,1]);}
function building(x,z,w,d,floors,rot,name,color){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);const body=mat(color),height=floors*2.9+.35,front=d/2;
  // Shop-floor recess is constructed from rear/side walls, leaving an actual open volume.
  box(g,0,1.45,-d/2+.2,w,2.9,.4,body);box(g,-w/2+.18,1.45,0,.36,2.9,d,body);box(g,w/2-.18,1.45,0,.36,2.9,d,body);
  box(g,0,3+(height-3)/2,0,w,height-3,d,body);box(g,0,.18,0,w,.2,d,M.stone);box(g,0,2.94,0,w+.12,.17,d+.1,M.stone);
  box(g,0,height+.1,0,w+.35,.22,d+.35,M.stone);box(g,0,height+.42,-d/2,w,.55,.18,body);box(g,-w/2,height+.42,0,.18,.55,d,body);box(g,w/2,height+.42,0,.18,.55,d,body);
  const tank=cylinder(g,w*.24,height+.8,-.3,.6,1.4,M.metal);box(g,w*.24,height+.1,-.3,1.4,.18,1.4,M.dark);
  for(let floor=1;floor<floors;floor++){const y=3.95+(floor-1)*2.9;for(let j=-1;j<=1;j++){window(g,j*w*.28,y,front+.05,w*.19,1.45,rand()>.75);}if(floor===1)balcony(g,front,w*.78,y-.9);ac(g,w*.35,y-.7,front+.35);}
  // Masonry seams, downpipe, projecting awning and a legible physical sign.
  for(let y=3.25;y<height;y+=.48)box(g,0,y,front+.015,w,.018,.025,mat('#647e74'),false);
  box(g,-w*.43,height/2,front+.2,.065,height,.075,M.metal);
  box(g,0,2.55,front+.66,w+.45,.13,1.8,pick([M.green,M.darkred,M.roof]));
  for(let j=-4;j<=4;j++)box(g,j*w/9,2.52,front+.7,.035,.07,1.8,M.cream,false);
  sign(g,name,0,3.02,front+1.02,w*.85,.72,pick(['#406964','#9e5940','#254e60']));
  for(const side of [-1,1])box(g,side*(w/2-.2),1.3,front+.95,.22,2.6,.22,M.stone);
  // Real shelves and a counter inside, visible through the opening.
  box(g,0,.87,front-.65,w*.63,.85,.6,M.wood);box(g,0,1.31,front-.65,w*.69,.09,.75,M.cream);
  for(let level=0;level<3;level++){box(g,0,.65+level*.57,-d/2+.6,w*.8,.08,.6,M.wood);for(let j=0;j<6;j++)box(g,-w*.32+j*w*.125,.83+level*.57,-d/2+.65,.30,.29,.25,pick([M.cream,M.orange,M.green,M.white]),false);}
  box(g,0,2.65,0,w*.5,.08,.25,M.glow,false);const p=new T.Vector3(0,2.2,front-.3).applyMatrix4(g.matrixWorld);g.updateMatrixWorld();p.set(0,2.2,front-.3).applyMatrix4(g.matrixWorld);if(['美香麵店','榕下雜貨','福安青草店'].includes(name))lamp(p.x,p.y,p.z,'#ffd09a',6,7);
  planter(g,-w*.38,front+1.1,.34);barrier(x,z,rot?d:w,rot?w:d);return g;}
const tones=['#9bafa6','#b7ae8f','#839e9b','#c0baa6','#ab8e79'];
// The lane opens out towards the temple; east passage loops back into the courtyard.
for(let i=0;i<4;i++){building(-10,21-i*8,6.6,6.4,3+i%2,Math.PI/2,['阿源機車','春日理髮','榕下雜貨','金成五金'][i],tones[i]);building(10,23-i*8,6.4,6.2,2+i%2,-Math.PI/2,['永和豆漿','美香麵店','生活商行','青葉茶行'][i],tones[(i+2)%5]);}
building(-12,-17,7,6,3,Math.PI/2,'福安青草店','#8eaa9d');building(22,-2,7,6,3,-Math.PI/2,'順興洗衣','#b8ae96');building(22,10,7,6,2,-Math.PI/2,'日光照相館','#8fa5a6');
// Temple: stepped foundation, columned forecourt, open hall and curved tiled roof profiles.
box(scene,0,.36,-27,13,.8,9,M.stone);for(let i=0;i<4;i++)box(scene,0,.08+i*.18,-21.9-i*.5,8,.20,.65,M.stone);
box(scene,0,2.65,-30.8,12,4.2,.4,M.darkred);box(scene,-5.9,2.6,-27,.35,4.3,7.5,M.darkred);box(scene,5.9,2.6,-27,.35,4.3,7.5,M.darkred);
barrier(-5.9,-27,.35,7.5);barrier(5.9,-27,.35,7.5);barrier(0,-30.8,12,.4);
for(const x of [-5,-2.6,2.6,5]){cylinder(scene,x,2.6,-23.6,.21,4.2,M.red);cylinder(scene,x,.9,-23.6,.34,.45,M.stone);cylinder(scene,x,4.5,-23.6,.32,.2,M.roofEdge);}
box(scene,0,4.7,-23.6,11,.55,.45,M.red);sign(scene,'福 安 宮',0,4.73,-23.34,3.4,.62,'#354d40');
for(const x of [-4,0,4]){box(scene,x,2.5,-30.5,2.5,3.2,.2,M.red);for(let row=0;row<5;row++)for(let col=0;col<4;col++)sphere(scene,x-.75+col*.5,1.5+row*.45,-30.35,.065,M.roofEdge);}
function roof(cx,cy,cz,w,d){const section=[[-d/2,.32],[-d*.40,0],[-d*.23,.4],[0,1.6],[d*.23,.4],[d*.40,0],[d/2,.32]];const positions=[],indices=[];for(const x of [-w/2,w/2])for(const [z,y]of section)positions.push(x,y,z);for(let i=0;i<section.length-1;i++){indices.push(i,i+1,i+7,i+1,i+8,i+7);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const rm=M.roof.clone();rm.side=T.DoubleSide;const mesh=new T.Mesh(geo,rm);mesh.position.set(cx,cy,cz);mesh.castShadow=true;scene.add(mesh);
 for(let x=-w/2;x<=w/2;x+=.32)wire(section.map(([z,y])=>[cx+x,cy+y+.03,cz+z]),'#647469',.045);
 for(const side of [-1,1])wire(section.map(([z,y])=>[cx+side*w/2,cy+y+.02,cz+z]),'#b3a36b',.13);
 wire([[cx-w/2-.6,cy+2,cz],[cx-w/2,cy+1.65,cz],[cx,cy+1.68,cz],[cx+w/2,cy+1.65,cz],[cx+w/2+.6,cy+2,cz]],'#b7a678',.14);
}
roof(0,5.0,-27,14.1,10);roof(0,7.0,-28.2,9,6.2);sphere(scene,0,9.1,-28.2,.34,M.roofEdge);
// Incense burner and offerings, with a gentle smoke ribbon.
cylinder(scene,0,1.12,-18.4,.76,.86,M.dark);cylinder(scene,0,1.58,-18.4,.86,.12,M.roofEdge);for(const x of [-.45,.45])box(scene,x,.6,-18.4,.17,.4,.22,M.dark);for(let k=0;k<7;k++)box(scene,(rand()-.5)*.8,1.85,-18.4+(rand()-.5)*.4,.025,.6,.025,M.red,false);barrier(0,-18.4,1.7,1.7);
const smoke=[];const smokeCanvas=document.createElement('canvas');smokeCanvas.width=smokeCanvas.height=64;const sx=smokeCanvas.getContext('2d'),sg=sx.createRadialGradient(32,32,0,32,32,32);sg.addColorStop(0,'rgba(221,230,215,.20)');sg.addColorStop(1,'rgba(221,230,215,0)');sx.fillStyle=sg;sx.fillRect(0,0,64,64);const smokeMat=new T.SpriteMaterial({map:new T.CanvasTexture(smokeCanvas),transparent:true,depthWrite:false});for(let k=0;k<8;k++){const s=new T.Sprite(smokeMat);s.position.set(0,2+k*.32,-18.4);s.scale.setScalar(.48+k*.07);scene.add(s);smoke.push(s);}
function lantern(x,y,z,size=.30){const g=new T.Group();g.position.set(x,y,z);scene.add(g);sphere(g,0,0,0,size,M.orange,[1,1.2,1]);cylinder(g,0,size*1.14,0,size*.5,.06,M.roofEdge);cylinder(g,0,-size*1.14,0,size*.5,.06,M.roofEdge);box(g,0,-size*1.65,0,.035,size*.6,.035,M.red,false);for(let k=0;k<6;k++){const a=k*Math.PI/3;box(g,Math.sin(a)*size*.94,0,Math.cos(a)*size*.94,.016,size*1.6,.016,M.roofEdge,false);}lanterns.push(g);return g;}
for(const z of [14,4,-7,-14]){wire([[-6,6,z],[0,4.8,z-.5],[6,6,z]],'#4e5550',.018);for(let i=-2;i<=2;i++)lantern(i*2.0,4.85+Math.abs(i)*.3,z-.4,.26);lamp(0,4.5,z,'#ffb777',6,11);}
for(const x of [-4,-2,2,4])lantern(x,4,-23.7,.32);lamp(0,3.2,-24,'#ffbe78',20,13);
// Banyan tree and circular seat anchor the open square.
function tree(x,z,size=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(size);scene.add(g);cylinder(g,0,1.9,0,.33,3.8,M.wood);for(let k=0;k<7;k++){const a=k*.9;const branch=cylinder(g,Math.sin(a)*.5,3,Math.cos(a)*.5,.13,2.4,M.wood);branch.rotation.z=Math.sin(a)*.6;branch.rotation.x=Math.cos(a)*.6;for(let j=0;j<2;j++)sphere(g,Math.sin(a)*(1+j*.55),3.6+j*.65,Math.cos(a)*(1+j*.55),1.2,pick([M.green,M.leaf,mat('#8e9b65')]),[1,.68,1]);}barrier(x,z,.9,.9);return g;}
tree(-8,-11,1.55);for(let k=0;k<8;k++){const a=k*Math.PI/4;const b=box(scene,-8+Math.sin(a)*2,.5,-11+Math.cos(a)*2,1.5,.20,.65,M.wood);b.rotation.y=a;box(scene,-8+Math.sin(a)*2,.25,-11+Math.cos(a)*2,.35,.5,.35,M.stone);}tree(19,-17,1.1);tree(-18,20,.95);tree(20,22,.9);
// Market stalls are freestanding objects with walkable gaps.
function stall(x,z,col){const g=new T.Group();g.position.set(x,0,z);scene.add(g);for(const dx of [-1.25,1.25])for(const dz of [-.65,.65])box(g,dx,1.2,dz,.06,2.4,.06,M.wood);box(g,0,.95,0,2.5,.12,1.5,M.wood);box(g,0,.58,.64,2.5,.65,.08,mat(col));const canopy=box(g,0,2.4,0,2.9,.12,1.9,mat(col));canopy.rotation.z=.06;for(let i=-4;i<=4;i++)box(g,i*.32,2.4,0,.14,.14,1.92,M.cream,false);for(let i=0;i<6;i++){cylinder(g,-.9+i*.36,1.10,0,.13,.18,M.cream);sphere(g,-.9+i*.36,1.25,0,.10,M.orange);}barrier(x,z,2.6,1.5);lamp(x,2.2,z,'#ffd59b',4,5);}
stall(8,-12,'#897548');stall(12,-18,'#597a72');stall(-12,-23,'#ad6850');
function scooter(x,z,rot,color){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);const paint=mat(color,.45);for(const zz of [-.57,.57]){const wh=cylinder(g,0,.30,zz,.27,.14,M.dark,16);wh.rotation.z=Math.PI/2;}box(g,0,.51,0,.37,.26,1.1,paint);box(g,0,.80,-.24,.43,.17,.60,M.dark);const front=box(g,0,.85,.5,.38,.7,.22,paint);front.rotation.x=-.18;box(g,0,1.23,.55,.67,.05,.08,M.metal);box(g,0,1.10,.66,.27,.13,.04,M.cream);barrier(x,z,.7,1.5);}
for(let i=0;i<5;i++)scooter(-4.8,18-i*2.4,.5,pick(['#b58a63','#5b8584','#b2b5a2','#9d6053']));scooter(16,6,-.7,'#79978d');scooter(12,-8,1,'#b48d54');
// Utility wires and rooftops add a coherent middle distance.
for(const z of [22,7,-8]){cylinder(scene,-5.4,4,z,.13,8,M.stone);box(scene,-5.4,7.2,z,1.5,.12,.15,M.wood);wire([[-5.4,7.3,z],[-5.2,6.3,z-7],[-5.4,7.3,z-15]],'#374949',.021);}
for(let i=0;i<16;i++){const x=-50+i*6.8,h=8+rand()*19;box(scene,x,h/2,-55-rand()*8,4+rand()*3,h,5,mat(pick(['#829b9f','#8ea7a8','#a4b5ad'])),false);}
for(let i=0;i<9;i++){const hill=new T.Mesh(new T.ConeGeometry(16+rand()*13,14+rand()*13,7),mat('#8da6a7'));hill.position.set(-75+i*18,4,-95-rand()*10);scene.add(hill);}
// Stylized human figures with articulated walking limbs, designed for this scene's scale.
function person(x,z,color,isHero=false){const g=new T.Group();g.position.set(x,0,z);scene.add(g);const skin=mat('#c69c77'),clothes=mat(color),pants=mat('#405359');const body=box(g,0,1.10,0,.46,.62,.27,clothes);sphere(g,0,1.60,0,.20,skin,[.84,1,.9]);sphere(g,0,1.70,-.025,.195,M.dark,[.92,.65,.98]);const limbs=[];for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.13,.82,0);g.add(leg);box(leg,0,-.34,0,.16,.68,.18,pants);box(leg,0,-.69,.065,.18,.12,.30,M.cream);limbs.push(leg);const arm=new T.Group();arm.position.set(side*.30,1.35,0);g.add(arm);box(arm,0,-.20,0,.13,.40,.16,clothes);box(arm,0,-.45,0,.105,.22,.13,skin);limbs.push(arm);}if(isHero){box(g,0,1.13,-.20,.34,.42,.18,mat('#cda86e'));box(g,0,1.13,-.30,.24,.22,.025,M.wood);}return {g,limbs};}
const hero=person(0,16,'#e0b273',true);const locals=[person(-6,-10,'#869da8'),person(7,-10,'#a68377'),person(11,-18,'#8c9e74'),person(-3,3,'#768c8a')];locals[0].g.rotation.y=1.3;locals[2].g.rotation.y=-1;
// Character collision and orbit-follow camera.
const keys=new Set(),touchKeys=new Set();let yaw=.12,pitch=.34,distance=14,drag=false,lastX=0,lastY=0,night=false;const look=new T.Vector3(),desired=new T.Vector3(),ray=new T.Raycaster();const cameraWalls=[];
scene.traverse(o=>{if(o.isMesh&&o.geometry===cube&&o.scale.y>2&&o.scale.x>2&&o.scale.z>2)cameraWalls.push(o);});
function blocked(x,z){if(x<-23||x>26||z>31||z<-30)return true;return colliders.some(c=>Math.abs(x-c.x)<c.w+.23&&Math.abs(z-c.z)<c.d+.23);}
function groundY(x,z){if(Math.abs(x)<4.1&&z<-21.6&&z>-24)return Math.min(.76,Math.floor((-z-21.6)/.5)*.18+.12);if(Math.abs(x)<6.6&&z<=-24&&z>-31)return .76;return z<-6?.19:((Math.abs(x)>5.1)?.28:0);}
function jump(place){const presets={lane:[0,16,.12,14],court:[1,-10,0,14],alley:[15,9,-.10,10]};const [x,z,a,d]=presets[place];hero.g.position.set(x,groundY(x,z),z);yaw=a;distance=d;document.querySelectorAll('[data-place]').forEach(b=>b.classList.toggle('active',b.dataset.place===place));}
document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>jump(b.dataset.place));
document.getElementById('time').onclick=()=>{night=!night;hemi.intensity=night?.78:2.2;sun.intensity=night?.28:3.2;fill.intensity=night?.38:.7;scene.background.set(night?'#284553':'#95afb8');scene.fog.color.copy(scene.background);bloom.strength=night?.3:.19;document.getElementById('time').textContent=night?'傍晚':'入夜';};
addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&e.target===document.body)e.preventDefault();keys.add(e.key.toLowerCase());});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();touchKeys.clear();drag=false;});
const canvas=renderer.domElement;canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-lastX)*.005;pitch=T.MathUtils.clamp(pitch+(e.clientY-lastY)*.004,.25,1.1);lastX=e.clientX;lastY=e.clientY;});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);canvas.addEventListener('wheel',e=>{e.preventDefault();distance=T.MathUtils.clamp(distance+e.deltaY*.012,6,25);},{passive:false});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();touchKeys.add(b.dataset.key);b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=()=>touchKeys.delete(b.dataset.key);});
function resize(){renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);
let last=performance.now(),clock=0,ready=false;const pressed=k=>keys.has(k)||touchKeys.has(k);
renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.05);last=now;clock+=dt;if(pressed('q'))yaw+=dt*1.2;if(pressed('e'))yaw-=dt*1.2;let ix=Number(pressed('d')||pressed('arrowright'))-Number(pressed('a')||pressed('arrowleft')),iz=Number(pressed('s')||pressed('arrowdown'))-Number(pressed('w')||pressed('arrowup'));const moving=ix!==0||iz!==0;if(moving){const len=Math.hypot(ix,iz),speed=pressed('shift')?5:2.7;const dx=(ix*Math.cos(yaw)+iz*Math.sin(yaw))/len*speed*dt,dz=(-ix*Math.sin(yaw)+iz*Math.cos(yaw))/len*speed*dt;if(!blocked(hero.g.position.x+dx,hero.g.position.z))hero.g.position.x+=dx;if(!blocked(hero.g.position.x,hero.g.position.z+dz))hero.g.position.z+=dz;hero.g.rotation.y=Math.atan2(dx,dz);hero.g.position.y=groundY(hero.g.position.x,hero.g.position.z);document.querySelectorAll('[data-place]').forEach(b=>b.classList.remove('active'));}
 hero.limbs.forEach((l,i)=>l.rotation.x=moving?Math.sin(clock*(pressed('shift')?13:8)+(i<2?0:Math.PI))*.48*(i%2?-1:1):Math.sin(clock*1.5)*.02);
 lanterns.forEach((g,i)=>g.rotation.z=Math.sin(clock*.8+i)*.035);smoke.forEach((s,i)=>{s.position.x=Math.sin(clock*.45+i*.5)*(.12+i*.045);s.position.y=2+i*.32+Math.sin(clock+i)*.035;});
 look.copy(hero.g.position);look.y+=1.25;look.z-=1.2;desired.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance).add(look);const delta=desired.clone().sub(look);ray.set(look,delta.clone().normalize());ray.far=delta.length();const hit=ray.intersectObjects(cameraWalls,false)[0];if(hit&&hit.distance>2)desired.copy(look).addScaledVector(delta.normalize(),Math.max(2,hit.distance-.35));if(!ready)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*6));camera.lookAt(look);
 const at=hero.g.position;document.getElementById('location').textContent=at.z<-7?'福安宮 · 廟埕':at.x>12?'青石側巷':'榕樹巷';document.getElementById('tip').textContent=at.z<-7?'繞過榕樹，走上廟前的石階。':at.x>12?'往北穿過側巷，可以繞回廟埕。':'沿著燈籠往前走，廟埕就在轉角後。';composer.render();if(!ready){document.getElementById('load').remove();ready=true;}
});
