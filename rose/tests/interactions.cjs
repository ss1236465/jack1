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
    this.events = {}; this.attrs = {}; this.style = {}; this.classes = new Set();
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
const document = {
  body:element('body'), hidden:false, activeElement:null,
  getElementById:element,
  querySelector:element,
  querySelectorAll:() => Array.from({length:6}, () => new Surface()),
  createElement:() => new Surface()
};
const context = vm.createContext({
  THREE, document, navigator:{userAgent:'test'}, Audio:AudioMock,
  window:{ innerWidth:1280, innerHeight:720, devicePixelRatio:1, AudioContext:AudioContextMock, addEventListener() {} },
  localStorage:{getItem:k => storage.get(k) ?? null, setItem:(k,v) => storage.set(k,v)},
  URL:{createObjectURL:() => 'blob:test', revokeObjectURL() {}},
  performance:{now:() => now}, requestAnimationFrame() {}, console:{ ...console, warn() {} },
  setTimeout:(callback,delay) => { const id=++timerId; timers.set(id,{callback,delay}); return id; },
  clearTimeout:id => timers.delete(id)
});
let source = fs.readFileSync(path.join(root, 'v2/app.js'), 'utf8');
source = source.replace(/\}\)\(\);\s*$/, `
  window.test = { tick, A, openExperience, replayExperience, triggerHeart,
    beginLongPress, resetGrowth, updateEdition, updateMusicVisualization,
    isFlowerHit, starTrail, cam, camera, flowerCenter, sharedUniforms,
    get state() { return { editionOpened, openingTime, growthT, morphClock, morphValue, musicEnergy, stemGrow:stemMat.uniforms.uGrow.value, open:openData[0] }; }
  };
})();`);
vm.runInContext(source, context);
const app=context.window.test;
function advance(seconds) { for(let i=0;i<seconds/0.05;i++) { now+=50; app.tick(); } }
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
  assert(app.state.growthT>5); assert.equal(app.A.music.playCalls,1); assert.equal(sourceCalls,1);
  assert(app.state.musicEnergy>0.5);
  console.log('PASS opening gates growth and starts a single analyser source');
  element('soundBtn').click(); const calls=app.A.music.playCalls;
  element('stage').dispatch('pointerdown',flowerPoint());
  element('stage').dispatch('pointermove',{...flowerPoint(),clientX:700});
  element('stage').dispatch('pointerup',flowerPoint());
  assert.equal(app.A.music.playCalls,calls); assert.equal(app.A.userPaused,true);
  console.log('PASS drag preserves manual pause');
  const p=flowerPoint(); element('stage').dispatch('pointerdown',p); fireLongPress();
  assert.equal(element('letterDialog').open,true);
  element('stage').dispatch('pointerup',p); assert.equal(app.state.morphClock,-1);
  element('letterText').value='测试情书'; element('saveLetterBtn').click(); element('letterBtn').click();
  assert.equal(element('letterText').value,'测试情书'); element('closeLetterBtn').click();
  console.log('PASS long press opens the stored letter without triggering a heart');
  element('stage').dispatch('pointerdown',p);
  element('stage').dispatch('pointermove',{...p,clientX:p.clientX+30}); fireLongPress();
  assert.equal(element('letterDialog').open,false);
  element('stage').dispatch('pointercancel',p); assert.equal(app.state.morphClock,-1);
  console.log('PASS drag and pointer cancellation prevent unintended gestures');
  element('heartBtn').click(); advance(2);
  assert.equal(app.state.morphValue,1); assert.equal(element('heartBtn').disabled,true);
  advance(5); assert.equal(app.state.morphValue,0); assert.equal(element('heartBtn').disabled,false);
  assert(Math.abs(app.sharedUniforms.uHeartRight.value.dot(app.sharedUniforms.uHeartUp.value))<1e-8);
  console.log('PASS heart forms, faces camera and returns to rose');
  const renders=renderCalls; element('saveBtn').click(); assert(renderCalls>renders);
  element('replayBtn').click(); assert.equal(app.state.growthT,0); assert.equal(app.state.open,0); assert.equal(app.state.stemGrow,0);
  assert.equal(app.A.music.currentTime,0); assert.equal(app.A.music.paused,true);
  element('openBtn').click(); assert.equal(sourceCalls,1);
  app.A.music.requests.at(-1).reject(new Error('NotAllowedError'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.A.on,false); element('stage').dispatch('pointerdown',flowerPoint()); assert.equal(app.A.on,true);
  console.log('PASS export renders, replay resets geometry, rejected audio retries');
})().catch(error => { console.error(error); process.exitCode=1; });
