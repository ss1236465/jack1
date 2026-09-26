import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { recognizeDigit, createGestureSequence } from './gestures.js?v=midautumn20260926';
import { createHandTracker } from './hand-tracker.js?v=handfix20260926';

const $ = s => document.querySelector(s);
const clamp = THREE.MathUtils.clamp;
const damp = (a,b,rate,dt) => THREE.MathUtils.lerp(a,b,1-Math.exp(-rate*dt));
const mobile = matchMedia('(max-width:700px)').matches;
const N = mobile ? 18000 : 30000;
let seed = 23459;
const rand = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#030811');
const camera = new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,80);
camera.position.set(0,.15,10.6);
const renderer = new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.3:1.65));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#scene').appendChild(renderer.domElement);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.8,.65,.25);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const field = new THREE.Group();
scene.add(field);

const sphere = new Float32Array(N*3), heart = new Float32Array(N*3);
const dust = new Float32Array(N*3), cloud = new Float32Array(N*3), meta = new Float32Array(N*4);
for(let i=0;i<N;i++){
  const j=i*3, k=i*4, z=rand()*2-1, a=rand()*Math.PI*2, ring=Math.sqrt(1-z*z);
  const r=1.42*(rand()<.68 ? .9+.1*rand() : Math.cbrt(rand()));
  sphere.set([Math.cos(a)*ring*r,z*r,Math.sin(a)*ring*r],j);
  // An implicit 3D heart: sample its volume rather than extruding a flat outline.
  let x,y,hz,q;
  do {
    x=rand()*2.6-1.3; y=rand()*2.6-1.3; hz=rand()*1.5-.75;
    q=x*x+2.25*hz*hz+y*y-1;
  } while(q*q*q-x*x*y*y*y-.1125*hz*hz*y*y*y>0);
  heart.set([x*1.37,y*1.37-.1,hz*1.37],j);
  const arm=i%3, dr=.5+Math.pow(rand(),.6)*4.6, da=arm*2.094+dr*.9+(rand()-.5)*.65;
  dust.set([Math.cos(da)*dr,(rand()-.5)*(.2+dr*.22),Math.sin(da)*dr],j);
  meta.set([rand(),rand(),rand(),rand()],k);
}
// A spherical volume stays three-dimensional as the hands rotate it. Its
// projection fills both landscape and portrait screens when the hands open.
for(let i=0;i<N;i++){
  const z=rand()*2-1,a=rand()*Math.PI*2,r=1.6*Math.cbrt(rand()),ring=Math.sqrt(1-z*z);
  cloud.set([Math.cos(a)*ring*r,z*r,Math.sin(a)*ring*r],i*3);
}
const uniforms = {
  uText:{value:0},uImmersive:{value:0},
  uTime:{value:0},uMorph:{value:0},uSpread:{value:.08},
  uColor:{value:new THREE.Color('#42dcff')},uPixel:{value:renderer.getPixelRatio()},
  uFlow:{value:new THREE.Vector2()},uSize:{value:mobile?1.9:2.05}
};
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.BufferAttribute(sphere,3));
geometry.setAttribute('aHeart',new THREE.BufferAttribute(heart,3));
geometry.setAttribute('aDust',new THREE.BufferAttribute(dust,3));
geometry.setAttribute('aCloud',new THREE.BufferAttribute(cloud,3));
geometry.setAttribute('aMeta',new THREE.BufferAttribute(meta,4));
geometry.setAttribute('aText',new THREE.BufferAttribute(sphere.slice(),3));
const gestureSequence=createGestureSequence(),textShapes=new Map();
let currentText='',targetText=0;
function textPositions(label){
 if(textShapes.has(label))return textShapes.get(label);
 const c=document.createElement('canvas');c.width=1200;c.height=420;
 const context=c.getContext('2d',{willReadFrequently:true});
 context.fillStyle='#fff';context.textAlign='center';context.textBaseline='middle';
 context.font=`bold ${label.length===1?320:240}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
 context.fillText(label,600,210);
 const pixels=context.getImageData(0,0,c.width,c.height).data,points=[];
 let minX=1200,maxX=0,minY=420,maxY=0;
 for(let y=0;y<420;y+=2)for(let x=0;x<1200;x+=2){
  if(pixels[(y*1200+x)*4+3]>100){points.push([x,y]);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 }
 const positions=new Float32Array(N*3),unit=Math.min(6.8/Math.max(1,maxX-minX),3.8/Math.max(1,maxY-minY));
 for(let i=0;i<N;i++){
  const p=points[Math.floor(rand()*points.length)]||[600,210];
  positions.set([(p[0]-(minX+maxX)/2+(rand()-.5)*2)*unit,((minY+maxY)/2-p[1]+(rand()-.5)*2)*unit,(rand()-.5)*.22],i*3);
 }
 textShapes.set(label,positions);return positions;
}
function showGestureText(label){
 if(label===currentText)return;
 currentText=label;targetText=label?1:0;
 if(label){
  // Blend targets on the CPU so switching characters never snaps existing points.
  nextTextPositions=textPositions(label);
 }
}
let nextTextPositions=geometry.attributes.aText.array;
const material = new THREE.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`
    uniform float uTime,uMorph,uSpread,uPixel,uSize,uText,uImmersive;
    uniform vec2 uFlow;
    attribute vec3 aHeart,aDust,aCloud,aText;
    attribute vec4 aMeta;
    varying float vAlpha,vTone,vBlur;
    mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
    void main(){
      vec3 p=mix(position,aHeart,uMorph);
      float t=uTime;
      float breath=1.+sin(t*1.2)*.018;
      p*=breath;
      p.xz=rot(t*.12*(1.-uMorph))*p.xz;
      vec3 d=aDust;
      d.xz=rot(t*(.075+.07*aMeta.x))*d.xz;
      d.y+=sin(t*.6+aMeta.x*18.)*.18;
      d.yz=rot(.40)*d.yz;
      p=mix(p,d,uSpread);
      p+=vec3(sin(t*.65+aMeta.x*32.),cos(t*.55+aMeta.y*24.),sin(t*.7+aMeta.z*25.))*(.018+uSpread*.08);
      p.xy+=uFlow*(.05+uSpread*.22)*aMeta.x;
      p=mix(p,aText+vec3(0.,0.,sin(t+aMeta.x*30.)*.025),uText);
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vec3 volume=aCloud;
      volume.xz=rot(t*(.045+.035*aMeta.x))*volume.xz;
      volume+=vec3(sin(t*.65+aMeta.x*32.),cos(t*.55+aMeta.y*24.),sin(t*.7+aMeta.z*25.))*.035;
      volume=mat3(modelViewMatrix)*volume;
      float depth=max(2.5,10.6+volume.z*3.);
      vec2 extent=depth/vec2(projectionMatrix[0][0],projectionMatrix[1][1]);
      vec4 surrounding=vec4((volume.xy+uFlow*.08*aMeta.x)*extent,-depth,1.);
      mv=mix(mv,surrounding,uImmersive*smoothstep(0.,1.,uSpread)*(1.-uText));
      vBlur=smoothstep(1.5,4.5,abs(-mv.z-10.6));
      float sparkle=.78+.22*sin(t*(1.+aMeta.y)+aMeta.x*70.);
      vAlpha=(.36+aMeta.z*.48)*sparkle*(1.-vBlur*.45);
      vTone=aMeta.y;
      gl_PointSize=clamp(uSize*uPixel*(9./-mv.z)*( .65+aMeta.w*.85+vBlur*1.6),1.,12.);
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader:`
    uniform vec3 uColor;
    varying float vAlpha,vTone,vBlur;
    void main(){
      float d=length(gl_PointCoord-.5)*2.;
      if(d>1.)discard;
      float core=exp(-d*d*7.);
      float halo=exp(-d*d*2.)*.18;
      vec3 c=mix(uColor,uColor*.65+vec3(.35),pow(vTone,7.)*.65);
      gl_FragColor=vec4(c*(1.1+pow(vTone,9.)*.9),(core+halo)*vAlpha);
    }`
});
const particles = new THREE.Points(geometry,material);
particles.frustumCulled=false;field.add(particles);

// Sparse orbital dust gives depth without concealing the central silhouette.
const orbitGeo = new THREE.BufferGeometry(), orbitCount=mobile?2400:5000;
const orbitPos=new Float32Array(orbitCount*3), orbitMeta=new Float32Array(orbitCount*4);
for(let i=0;i<orbitCount;i++){
  const a=rand()*Math.PI*2,r=2.1+rand()*3.6;
  orbitPos.set([Math.cos(a)*r,(rand()-.5)*.2,Math.sin(a)*r],i*3);
  orbitMeta.set([rand(),rand(),rand(),rand()],i*4);
}
orbitGeo.setAttribute('position',new THREE.BufferAttribute(orbitPos,3));
orbitGeo.setAttribute('aMeta',new THREE.BufferAttribute(orbitMeta,4));
const orbitMat=new THREE.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`
    uniform float uTime,uPixel;attribute vec4 aMeta;varying float vA;
    void main(){
      float a=uTime*(.035+aMeta.x*.06);
      vec3 p=position;
      p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
      p.y+=sin(uTime*.3+aMeta.y*20.)*.09;
      p.yz=mat2(.86,-.51,.51,.86)*p.yz;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_PointSize=clamp((.8+aMeta.z*1.5)*uPixel*9./-mv.z,1.,5.);
      gl_Position=projectionMatrix*mv;vA=.11+aMeta.w*.34;
    }`,
  fragmentShader:`uniform vec3 uColor;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(uColor,exp(-d*d*5.)*vA);}`
});
field.add(new THREE.Points(orbitGeo,orbitMat));

// Curved trails are line segments with a fading tail; only their head phase changes on the GPU.
const trailPos=[],trailData=[];
for(let strand=0;strand<36;strand++){
  const strandRadius=2.1+rand()*.12+(strand%6)*.48;
  for(let segment=0;segment<44;segment++)for(let end=0;end<2;end++){
    trailPos.push(0,0,0);
    trailData.push(strand/36, (segment+end)/44,strandRadius);
  }
}
const trailGeo=new THREE.BufferGeometry();
trailGeo.setAttribute('position',new THREE.Float32BufferAttribute(trailPos,3));
trailGeo.setAttribute('aTrail',new THREE.Float32BufferAttribute(trailData,3));
const trailMat=new THREE.ShaderMaterial({
 uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:`attribute vec3 aTrail;uniform float uTime,uSpread;varying float vA;
 void main(){float a=aTrail.x*6.283+uTime*(.08+fract(aTrail.x*9.)*.1)-aTrail.y*.30;
 float r=aTrail.z;vec3 p=vec3(cos(a)*r,sin(a*3.+uTime*.2)*.06,sin(a)*r);
 p.yz=mat2(.86,-.51,.51,.86)*p.yz;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);vA=pow(1.-aTrail.y,2.)*.24;}`,
 fragmentShader:`uniform vec3 uColor;varying float vA;void main(){gl_FragColor=vec4(uColor,vA);}`
});
field.add(new THREE.LineSegments(trailGeo,trailMat));
const starsGeo=new THREE.BufferGeometry(), stars=[];
for(let i=0;i<750;i++)stars.push((rand()-.5)*32,(rand()-.5)*22,-8-rand()*18);
starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:'#42748a',size:.022,transparent:true,opacity:.5,depthWrite:false})));

let targetSpread=.08,targetScale=1,targetMorph=0,scale=1,px=0,py=0;
const gestureRotation=new THREE.Euler(0,0,0,'YXZ');
const targetOrientation=new THREE.Quaternion();
let handRoll=0;
const rotationInput=v=>Math.abs(v)<.035?0:Math.sign(v)*(Math.abs(v)-.035)/.965;
let pointerDown=false,cameraOn=false,starting=false,stream=null,hands=null,handTimer=0,lastHand=0;
let frames=0,lastFPS=performance.now(),last=performance.now(),elapsed=0;
$('#count').textContent=(N+orbitCount+750).toLocaleString()+' PARTICLES';
document.querySelectorAll('.shape').forEach(btn=>btn.addEventListener('click',()=>{
 gestureSequence.reset();showGestureText('');
 targetMorph=btn.dataset.shape==='heart'?1:0;
 document.querySelectorAll('.shape').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn));});
}));
$('#color').addEventListener('input',e=>{
 uniforms.uColor.value.set(e.target.value);
 document.documentElement.style.setProperty('--accent',e.target.value);
});
$('#spread').addEventListener('input',e=>targetSpread=Number(e.target.value));
const canvas=renderer.domElement;
canvas.addEventListener('pointermove',e=>{if(!cameraOn||performance.now()-lastHand>800){px=(e.clientX/innerWidth-.5)*2;py=(e.clientY/innerHeight-.5)*2;}});
canvas.addEventListener('pointerdown',e=>{pointerDown=true;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',()=>pointerDown=false);
canvas.addEventListener('pointercancel',()=>pointerDown=false);
canvas.addEventListener('lostpointercapture',()=>pointerDown=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!cameraOn||performance.now()-lastHand>800)targetScale=clamp(targetScale-e.deltaY*.001,.55,1.65);},{passive:false});
$('#helpButton').addEventListener('click',()=>{const help=$('#help');help.hidden=!help.hidden;$('#helpButton').setAttribute('aria-expanded',String(!help.hidden));});
$('#fullscreen').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
 catch{$('#status').textContent='当前浏览器不支持全屏，可放大窗口体验';}
});
document.addEventListener('fullscreenchange',()=>$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'切换全屏'));
function resize(){
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);
}
addEventListener('resize',resize);

function withTimeout(promise,ms,message){
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]).finally(()=>clearTimeout(timer));
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function openness(lm){
 const palm=Math.max(dist(lm[0],lm[9]),.025);
 let sum=0;
 for(const [tip,base] of [[8,5],[12,9],[16,13],[20,17]]){
   sum+=clamp((dist(lm[tip],lm[0])-dist(lm[base],lm[0]))/palm/.85,0,1);
 }
 return sum/4;
}
const edges=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const handCanvas=$('#landmarks'),ctx=handCanvas.getContext('2d');
let firstHandResult=false;
function onResults(results){
 if(!cameraOn)return;
 firstHandResult=true;
 ctx.clearRect(0,0,480,360);
 const landmarks=results.multiHandLandmarks||[];
 if(!landmarks.length){showGestureText(gestureSequence.update(null,performance.now()));$('#handState').textContent='把手放入画面';return;}
 const digits=landmarks.map(recognizeDigit).filter(Boolean);
 const digit=digits.length&&digits.every(d=>d===digits[0])?digits[0]:0;
 showGestureText(gestureSequence.update(digit,performance.now()));
 lastHand=performance.now();
 targetSpread=clamp((landmarks.reduce((s,l)=>s+openness(l),0)/landmarks.length-.12)/.78,0,1);
 const centers=landmarks.map(l=>({x:(l[0].x+l[9].x)/2,y:(l[0].y+l[9].y)/2}));
 px=(.5-centers.reduce((s,l)=>s+l.x,0)/centers.length)*2;
 py=(centers.reduce((s,l)=>s+l.y,0)/centers.length-.5)*2;
 // Follow the axis between hands; sort by screen position so detection order cannot flip rotation.
 let roll;
 if(centers.length===2){
  const ordered=[...centers].sort((a,b)=>a.x-b.x);
  const dx=ordered[1].x-ordered[0].x,dy=ordered[1].y-ordered[0].y;
  if(Math.hypot(dx,dy)>.08)roll=Math.atan2(dy,dx);
 }else{
  const palm=landmarks[0],dx=palm[9].x-palm[0].x,dy=palm[9].y-palm[0].y;
  if(Math.hypot(dx,dy)>.035)roll=Math.atan2(dx,-dy);
 }
 if(roll!==undefined){
  // Equivalent two-hand axes are pi apart; use the nearest angle when hands cross.
  const period=centers.length===2?Math.PI:Math.PI*2;
  handRoll+=((roll-handRoll+period/2)%period+period)%period-period/2;
 }
 if(centers.length===2)targetScale=clamp(.55+Math.hypot(centers[0].x-centers[1].x,centers[0].y-centers[1].y)*1.7,.55,1.65);
 $('#handState').textContent=landmarks.length+' 只手 · '+(targetSpread>.55?'释放星云':'汇聚能量');
 $('#mode').textContent='手势追踪中';
 $('#status').textContent='已识别 '+landmarks.length+' 只手 · 画面仅在本机处理';
 for(const lm of landmarks){
  ctx.strokeStyle='#42dcff99';ctx.lineWidth=1.4;ctx.beginPath();
  for(const [a,b]of edges){ctx.moveTo(lm[a].x*480,lm[a].y*360);ctx.lineTo(lm[b].x*480,lm[b].y*360);}ctx.stroke();
  ctx.fillStyle='#aaf3ff';for(const p of lm){ctx.beginPath();ctx.arc(p.x*480,p.y*360,2.5,0,Math.PI*2);ctx.fill();}
 }
}
let immersive=false;
const interfaceElements=[...document.body.children].filter(element=>element.id!=='scene'&&element.tagName!=='SCRIPT');
function setImmersive(active){
 immersive=active;
 document.body.classList.toggle('immersive',active);
 for(const element of interfaceElements)element.inert=active;
 if(active){
  $('#help').hidden=true;
  $('#helpButton').setAttribute('aria-expanded','false');
  document.activeElement?.blur();
 }
}
// Restore the controls without interrupting tracking; no exit button covers the particles.
addEventListener('keydown',event=>{if(event.key==='Escape'&&immersive)setImmersive(false);});
let lastTouchTap=0,lastPresentationToggle=-1000;
function togglePresentation(){
 const now=performance.now();
 if(now-lastPresentationToggle<450)return;
 lastPresentationToggle=now;setImmersive(!immersive);
}
canvas.addEventListener('dblclick',togglePresentation);
canvas.addEventListener('pointerup',event=>{
 if(event.pointerType!=='touch')return;
 const now=performance.now();
 if(lastTouchTap&&now-lastTouchTap<350){togglePresentation();lastTouchTap=0;}
 else lastTouchTap=now;
});
function stopCamera(){
 gestureSequence.reset();showGestureText('');
 setImmersive(false);
 cameraOn=false;firstHandResult=false;clearTimeout(handTimer);
 if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;
 $('#video').srcObject=null;$('#cameraPanel').hidden=true;$('#cameraLabel').textContent='开启手势';
 $('#mode').textContent='鼠标交互';$('#hint').textContent='移动鼠标旋转 · 按住画布扩散 · 滚轮缩放';
 $('#status').textContent='摄像头已关闭 · 鼠标模式';lastHand=0;
}
async function detect(){
 if(!cameraOn)return;
 try{
  if(!document.hidden&&$('#video').readyState>=2)await withTimeout(hands.send({image:$('#video')}),15000,'手势模型没有返回结果，请重新开启摄像头');
 }catch(e){stopCamera();hands?.close().catch(()=>{});hands=null;$('#status').textContent='手势识别中断：'+e.message;return;}
 if(cameraOn)handTimer=setTimeout(detect,40);
}
$('#camera').addEventListener('click',async()=>{
 if(starting)return;if(cameraOn){stopCamera();return;}
 starting=true;$('#camera').disabled=true;$('#cameraLabel').textContent='连接中…';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('请在 localhost 或 HTTPS 下使用摄像头');
  $('#status').textContent='请允许摄像头访问';
  stream=await navigator.mediaDevices.getUserMedia({video:{width:480,height:360,facingMode:'user'},audio:false});
  $('#video').srcObject=stream;await $('#video').play();
  $('#cameraPanel').hidden=false;
  $('#cameraLabel').textContent='加载模型…';
  $('#handState').textContent='模型加载中…';
  $('#status').textContent='正在下载手势模型，首次打开需要稍候…';
  if(!hands){
   let lastProgress=-1;
   hands=await createHandTracker({onResults,onProgress:({stage,percent})=>{
    if(stage==='download'){
     if(percent===lastProgress)return;lastProgress=percent;
     $('#cameraLabel').textContent='模型 '+percent+'%';
     $('#handState').textContent='下载模型 '+percent+'%';
     $('#status').textContent='正在下载手势模型 '+percent+'% · 首次加载需要稍候';
    }else{
     $('#cameraLabel').textContent='初始化…';$('#handState').textContent='模型初始化中…';
     $('#status').textContent='模型下载完成，正在准备手势识别…';
    }
   }});
  }
  cameraOn=true;$('#cameraPanel').hidden=false;$('#cameraLabel').textContent='关闭手势';
  $('#hint').textContent='张手扩散 · 握拢汇聚 · 双手距离缩放 · 移动手掌旋转 · 双手倾斜翻转';
  $('#status').textContent='模型已就绪，把手放入摄像头画面';$('#mode').textContent='等待双手';
  $('#handState').textContent='把手放入画面';
  await withTimeout(hands.send({image:$('#video')}),30000,'手势识别启动超时，请重新开启手势');
  setImmersive(true);
  detect();
 }catch(e){
  stopCamera();
  hands?.close().catch(()=>{});hands=null;
  console.error('手势启动失败',e);
  $('#status').textContent=e.name==='NotAllowedError'?'摄像头未授权 · 可继续使用鼠标':e.name==='NotFoundError'?'未找到摄像头 · 可继续使用鼠标':'摄像头启动失败：'+e.message;
 }finally{starting=false;$('#camera').disabled=false; if(!cameraOn)$('#cameraLabel').textContent='开启手势';}
});
addEventListener('pagehide',stopCamera);
document.addEventListener('visibilitychange',()=>{last=performance.now();pointerDown=false;});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setImmersive(false);$('#status').textContent='显卡上下文已暂停，请刷新页面恢复';});
function animate(now){
 requestAnimationFrame(animate);
 const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
 elapsed+=dt;uniforms.uTime.value=elapsed;
 if(cameraOn&&now-lastHand>800)showGestureText(gestureSequence.update(null,now));
 uniforms.uText.value=damp(uniforms.uText.value,targetText,5,dt);
 uniforms.uImmersive.value=damp(uniforms.uImmersive.value,immersive?1:0,4,dt);
 if(targetText){
  const a=geometry.attributes.aText,blend=1-Math.exp(-7*dt);
  for(let i=0;i<a.array.length;i++)a.array[i]+=(nextTextPositions[i]-a.array[i])*blend;
  a.needsUpdate=true;
 }
 const hasHands=cameraOn&&now-lastHand<800;
 if(cameraOn&&!hasHands&&firstHandResult){$('#mode').textContent='等待手势';$('#status').textContent='手势模型已就绪 · 把手放入摄像头画面';}
 const spread=hasHands?targetSpread:pointerDown?1:targetSpread;
 uniforms.uSpread.value=damp(uniforms.uSpread.value,spread,6.5,dt);
 uniforms.uMorph.value=damp(uniforms.uMorph.value,targetMorph,3.3,dt);
 const textMix=uniforms.uText.value;
 const textScale=Math.min(1,camera.aspect*.85);
 scale=damp(scale,THREE.MathUtils.lerp(targetScale,textScale,textMix),5,dt);field.scale.setScalar(scale);
 gestureRotation.set(
  hasHands?rotationInput(py)*1.2:py*.2,
  hasHands?rotationInput(px)*Math.PI:px*.4,
  hasHands?handRoll:0,'YXZ');
 targetOrientation.setFromEuler(gestureRotation);
 targetOrientation.slerp(new THREE.Quaternion(),textMix);
 field.quaternion.slerp(targetOrientation,1-Math.exp(-5*dt));
 uniforms.uFlow.value.x=damp(uniforms.uFlow.value.x,px,5,dt);
 uniforms.uFlow.value.y=damp(uniforms.uFlow.value.y,-py,5,dt);
 camera.position.x=damp(camera.position.x,px*.24,2,dt);camera.position.y=damp(camera.position.y,.15-py*.15,2,dt);camera.lookAt(0,0,0);
 composer.render();
 if(++frames&&now-lastFPS>1000){
   const fps=Math.round(frames*1000/(now-lastFPS));
   $('#fps').textContent=fps+' FPS';frames=0;lastFPS=now;
   $('#spreadValue').textContent=Math.round(uniforms.uSpread.value*100)+'%';
   if(hasHands)$('#spread').value=targetSpread;
 }
}
$('#loading').hidden=true;
requestAnimationFrame(animate);
