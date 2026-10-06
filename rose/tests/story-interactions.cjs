const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const THREE = { ...require(path.join(root, 'vendor/three.min.js')) };
const elements = new Map(), timers = new Map(), storage = new Map();
let timerId = 0, now = 0, renderCalls = 0, sourceCalls = 0;
class Surface {
  constructor() {
    this.events = {}; this.attrs = {}; this.style = {setProperty:(key,value)=>{this.style[key]=value;}}; this.classes = new Set();
    this.classList = {
      add: n => this.classes.add(n), remove: n => this.classes.delete(n),
      contains: n => this.classes.has(n),
      toggle: (n, on) => on ? this.classes.add(n) : this.classes.delete(n)
    };
    this.width = 1280; this.height = 720; this.value = ''; this.hidden = false;
  }
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
  dispatch(name, event = {}) { for (const callback of this.events[name] || []) callback({ ...event, type:name }); }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  getBoundingClientRect() { return { left:0, top:0, right:1280, bottom:720, width:1280, height:720 }; }
  setPointerCapture() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  appendChild() {}
  remove() {}
  click() { this.dispatch('click'); }
  getContext() {
    return new Proxy({}, { get: (o,k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
  }
  toBlob(callback) { callback({ type:'image/png' }); }
}
function element(id) { if (!elements.has(id)) elements.set(id, new Surface()); return elements.get(id); }
class AudioMock extends Surface {
  constructor(src) { super(); this.src = src; this.paused = true; this.currentTime = 0; this.duration = 319.4; this.playCalls = 0; this.requests = []; }
  play() { this.paused = false; this.playCalls++; return new Promise((resolve,reject) => this.requests.push({ resolve,reject })); }
  pause() { this.paused = true; }
  load() { this.error = null; }
}
class AudioContextMock {
  constructor() { this.state = 'running'; this.destination = {}; }
  createAnalyser() { return { frequencyBinCount:128, connect() {}, getByteFrequencyData(a) { a.fill(180); } }; }
  createMediaElementSource() { sourceCalls++; return { connect() {}, disconnect() {} }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
THREE.WebGLRenderer = class {
  setPixelRatio() {} setSize() {} setClearColor() {}
  getDrawingBufferSize(v) { return v.set(1280,720); }
};
THREE.EffectComposer = class { setPixelRatio() {} setSize() {} addPass() {} render() { renderCalls++; } };
THREE.RenderPass = class {};
THREE.UnrealBloomPass = class {};
THREE.ShaderPass = class { constructor(shader) { this.uniforms = THREE.UniformsUtils.clone(shader.uniforms); } };
THREE.Clock = class { getDelta() { return 0.05; } };
const chapterButtons = ['book','box','warmth','rain','memory','ending'].map(name=>{
  const button=element('chapter-'+name); button.setAttribute('data-chapter',name); return button;
});
const diaryPages = [0,1,2].map(index=>element('diary-page-'+index));
const document = {
  body:element('body'), hidden:false, activeElement:null,
  getElementById:element,
  querySelector:element,
  querySelectorAll:selector => selector==='#chapterNav button' ? chapterButtons : selector==='[data-diary-page]' ? diaryPages : Array.from({length:6}, () => new Surface()),
  createElement:() => new Surface()
};
const context = vm.createContext({
  THREE, document, navigator:{userAgent:'test'}, Audio:AudioMock,
  window:{ innerWidth:1280, innerHeight:720, devicePixelRatio:1, AudioContext:AudioContextMock, addEventListener() {}, matchMedia:()=>({matches:false}), RoseStory:require('../v3/story-timeline.js') },
  localStorage:{getItem:k => storage.get(k) ?? null, setItem:(k,v) => storage.set(k,v)},
  URL:{createObjectURL:() => 'blob:test', revokeObjectURL() {}},
  performance:{now:() => now}, requestAnimationFrame() {}, console:{ ...console, warn() {} },
  setTimeout:(callback,delay) => { const id=++timerId; timers.set(id,{callback,delay}); return id; },
  clearTimeout:id => timers.delete(id)
});
vm.runInContext(fs.readFileSync(path.join(root,'v3/story-scene.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'v3/diary.js'),'utf8'),context);
let source = fs.readFileSync(path.join(root, 'v3/app.js'), 'utf8');
source = source.replace(/\}\)\(\);\s*$/, `
  window.test = { tick, A, openExperience, replayExperience, triggerHeart,
    beginLongPress, resetGrowth, updateEdition, updateMusicVisualization,
    isFlowerHit, starTrail, cam, camera, flowerCenter, sharedUniforms,
    get state() { return { editionOpened, openingTime, growthT, morphClock, morphValue, musicEnergy, stemGrow:stemMat.uniforms.uGrow.value, open:openData[0], frame:storyFrame, closed:lidHinge.rotation.x }; }
  };
})();`);
vm.runInContext(source, context);
const app=context.window.test;
function advance(seconds) { for(let i=0;i<seconds/0.05;i++) { now+=50; if(!app.A.music.paused)app.A.music.currentTime+=.05; app.tick(); } }
function seek(seconds) { app.A.music.currentTime=seconds; app.tick(); }
function flowerPoint() {
  const p = app.flowerCenter.clone().project(app.camera);
  return { pointerId:1, pointerType:'mouse', clientX:(p.x+1)*640, clientY:(1-p.y)*360 };
}
function fireLongPress() {
  for(const [id,t] of timers) if(t.delay===720) { timers.delete(id); t.callback(); }
}
(async () => {
  advance(1); assert.equal(app.state.growthT,0); assert.equal(app.A.music.playCalls,0);
  element('openBtn').click(); advance(8);
  assert.equal(app.state.growthT,0); assert.equal(app.A.music.playCalls,1); assert.equal(sourceCalls,1);
  assert(app.state.musicEnergy>0.5);
  assert.equal(app.A.music.loop,false);
  seek(69); const warmFrame=JSON.stringify(app.state.frame); const warmGrow=app.state.growthT;
  assert.equal(app.state.frame.chapterId,'warmth'); assert(app.state.frame.growth>.95);
  seek(103); assert.equal(app.state.frame.chapterId,'rain'); assert(app.state.frame.rain>.85);
  seek(288); assert.equal(app.state.frame.chapterId,'memory'); assert(app.state.frame.dissolve>.45);
  seek(319.4); assert.equal(Math.abs(app.state.closed),0); assert.equal(app.state.frame.close,1); assert.equal(app.state.growthT,0);
  seek(69); assert.equal(JSON.stringify(app.state.frame),warmFrame); assert.equal(app.state.growthT,warmGrow);
  console.log('PASS audio time maps warm, rain, memory, closing and backwards seeks deterministically');
  element('soundBtn').click(); const calls=app.A.music.playCalls;
  element('stage').dispatch('pointerdown',flowerPoint());
  element('stage').dispatch('pointermove',{...flowerPoint(),clientX:700});
  element('stage').dispatch('pointerup',flowerPoint());
  assert.equal(app.A.music.playCalls,calls); assert.equal(app.A.userPaused,true);
  const pausedFrame=JSON.stringify(app.state.frame); advance(12); assert.equal(JSON.stringify(app.state.frame),pausedFrame);
  element('chapter-rain').click(); assert.equal(app.A.music.paused,true); assert.equal(app.state.frame.chapterId,'rain');
  element('chapter-warmth').click(); assert.equal(app.state.frame.chapterId,'warmth');
  assert(Math.abs(Number(element('seek').value)-47.09/319.4*100)<1e-8);
  element('seek').value=Number(element('seek').value)+.1; element('seek').dispatch('input'); app.tick();
  assert.equal(app.state.frame.chapterId,'warmth'); seek(69);
  console.log('PASS pause stops story drift and chapter jumps preserve manual pause');
  const p=flowerPoint(); element('stage').dispatch('pointerdown',p); fireLongPress();
  assert.equal(element('letterDialog').open,true);
  element('stage').dispatch('pointerup',p); assert.equal(app.state.morphClock,-1);
  element('letterText').value='测试情书'; element('saveLetterBtn').click(); element('letterBtn').click();
  assert.equal(element('letterText').value,'测试情书'); element('closeLetterBtn').click();
  assert.equal(element('diaryPageLabel').textContent,'03 / 03');
  console.log('PASS long press opens the stored letter without triggering a heart');
  element('stage').dispatch('pointerdown',p);
  element('stage').dispatch('pointermove',{...p,clientX:p.clientX+30}); fireLongPress();
  assert.equal(element('letterDialog').open,false);
  element('stage').dispatch('pointercancel',p); assert.equal(app.state.morphClock,-1);
  console.log('PASS drag and pointer cancellation prevent unintended gestures');
  element('soundBtn').click(); element('heartBtn').click(); advance(2);
  assert.equal(app.state.morphValue,1); assert.equal(element('heartBtn').disabled,true);
  advance(5); assert.equal(app.state.morphValue,0); assert.equal(element('heartBtn').disabled,false);
  assert(Math.abs(app.sharedUniforms.uHeartRight.value.dot(app.sharedUniforms.uHeartUp.value))<1e-8);
  console.log('PASS heart forms, faces camera and returns to rose');
  const renders=renderCalls; element('saveBtn').click(); assert(renderCalls>renders);
  assert.equal(element('photoDialog').open,true); assert.equal(element('photoPreview').src,'blob:test');
  assert(element('downloadPhotoLink').download.endsWith('.png')); element('closePhotoBtn').click();
  seek(319.4); app.A.music.pause(); app.A.music.dispatch('ended'); assert.equal(app.A.on,false); assert(element('body').classes.has('story-ended'));
  element('replayBtn').click(); assert.equal(app.state.growthT,0); assert.equal(app.state.open,0); assert.equal(app.state.stemGrow,0);
  assert.equal(app.A.music.currentTime,0); assert.equal(app.A.music.paused,true);
  element('openBtn').click(); assert.equal(sourceCalls,1);
  app.A.music.requests.at(-1).reject(new Error('NotAllowedError'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.A.on,false); element('stage').dispatch('pointerdown',flowerPoint()); assert.equal(app.A.on,true);
  console.log('PASS held ending, export, replay reset and rejected playback retry');
})().catch(error => { console.error(error); process.exitCode=1; });
