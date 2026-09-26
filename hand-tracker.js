const version='0.4.1675469240';
const root=new URL('./vendor/hands/',import.meta.url);
const manifest={
 'hands.js':[45581,'a68b21c9553d614384f7f459622e46e02e3c9cfdf7392915a2fa1d615e338473'],
 'hands.binarypb':[550,'ab76c4215fca99cc2db1b5885cb8398d210e59ebe685245f72e692b4b58421e4'],
 'hands_solution_packed_assets_loader.js':[8327,'d05c073a62a0c8d2d21c18bc8f158424ece0078ea00a636e9527083b10ca1e17'],
 'hands_solution_simd_wasm_bin.js':[276479,'7720172e0775636e64955fb1091958c8294e01aa100c3272b59b2a543c028cb5'],
 'hands_solution_wasm_bin.js':[276474,'2e1faa9965a87f496316e85731c41bde1d9b07dd448f6cd30f5c2262bcd35e29'],
 'hands_solution_simd_wasm_bin.wasm':[6026259,'78ef7eb86ebc6424ac06b13f89b9a1fc01ff35e07520e37de98887cf88c06653',1809711],
 'hands_solution_wasm_bin.wasm':[5917209,'4e70eaf8063e0e9ac10e682d9d6b55c08d0788f0a8d49925e2e484636526e157',1807912],
 'hands_solution_packed_assets.data':[4326731,'bdce7b66bfc5b39ba86a47775c98e0b186fe73f8308c2279f852af4c89ffdf42',3957080],
 'hand_landmark_lite.tflite':[2071408,'d7fde8ac11f8ce03f8663775bfc323f4fc9f2a38062b4f4efa142874ef5b2a48',1759315]
};
let prepared=null;
const mimeFor=name=>name.endsWith('.js')?'text/javascript':name.endsWith('.wasm')?'application/wasm':'application/octet-stream';

async function verify(name,bytes){
 if(bytes.byteLength!==manifest[name][0])throw new Error('模型文件下载不完整');
 if(globalThis.crypto?.subtle){
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  const hex=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
  if(hex!==manifest[name][1])throw new Error('模型文件校验失败');
 }
 return bytes;
}

async function download(name,source,controller,progress){
 let idleTimer;
 const resetIdle=()=>{clearTimeout(idleTimer);idleTimer=setTimeout(()=>controller.abort(),45000);};
 // Allow slow, active transfers to finish. Stop stalled requests separately.
 const deadline=setTimeout(()=>controller.abort(),240000);
 try{
  resetIdle();
  const response=await fetch(source.url,{signal:controller.signal});
  if(!response.ok)throw new Error('模型下载返回 '+response.status);
  const expected=source.compressed?manifest[name][2]:manifest[name][0];
  const chunks=[];
  let received=0,bytes;
  if(response.body?.getReader){
   const reader=response.body.getReader();
   while(true){
    const {done,value}=await reader.read();if(done)break;
    resetIdle();chunks.push(value);received+=value.byteLength;
    if(received>manifest[name][0]+1024)throw new Error('模型文件大小异常');
    progress(Math.min(.98,received/expected));
   }
   bytes=new Uint8Array(received);
   let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  }else{bytes=new Uint8Array(await response.arrayBuffer());}
  if(source.compressed&&bytes[0]===0x1f&&bytes[1]===0x8b){
   bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  await verify(name,bytes);progress(1);return bytes;
 }finally{clearTimeout(idleTimer);clearTimeout(deadline);}
}

async function getAsset(name,cache,progress){
 const key=new URL(name,root).href;
 if(cache){
  try{
   const stored=await cache.match(key);
   if(stored){const bytes=await verify(name,new Uint8Array(await stored.arrayBuffer()));progress(1);return bytes;}
  }catch{/* A failed cache entry is replaced by a verified download. */}
 }
 const compressed=!!manifest[name][2]&&typeof DecompressionStream==='function';
 const sources=[
  {url:new URL(name+(compressed?'.gz':''),root).href,compressed},
  {url:`https://cdn.jsdelivr.net/npm/@mediapipe/hands@${version}/${name}`},
  {url:`https://unpkg.com/@mediapipe/hands@${version}/${name}`}
 ];
 if(compressed)sources.push({url:key});
 // A slow temporary tunnel should not hold up a faster mirror. All sources
 // must pass the same size and SHA-256 checks before they can be used.
 const bytes=await new Promise((resolve,reject)=>{
  const controllers=[],timers=[],started=new Set();
  let settled=false,failures=0,best=0;
  function start(index){
   if(settled||index>=sources.length||started.has(index))return;
   started.add(index);
   const controller=new AbortController();controllers.push(controller);
   download(name,sources[index],controller,value=>{
    if(!settled&&value>best){best=value;progress(value);}
   }).then(value=>{
    if(settled)return;settled=true;
    timers.forEach(clearTimeout);controllers.forEach(c=>c.abort());resolve(value);
   }).catch(error=>{
    if(settled)return;
    failures++;start(index+1);
    if(index===0&&compressed)start(3);
    if(failures===sources.length){settled=true;timers.forEach(clearTimeout);reject(new Error('模型下载失败，请点击开启手势重试。'+error.message));}
   });
  }
  start(0);
  for(let index=1;index<3;index++)timers.push(setTimeout(()=>start(index),index*5000));
 });
 if(cache){try{await cache.put(key,new Response(bytes,{headers:{'Content-Type':mimeFor(name)}}));}catch{/* Storage is optional. */}}
 return bytes;
}

async function prepare(onProgress){
 if(prepared)return prepared;
 prepared=(async()=>{
  if(typeof WebAssembly!=='object')throw new Error('当前浏览器不支持手势模型，请使用新版浏览器');
  const simd=WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,9,1,7,0,65,0,253,15,26,11]));
  const engine=simd?'hands_solution_simd_wasm_bin':'hands_solution_wasm_bin';
  const names=['hands.js','hands.binarypb','hands_solution_packed_assets_loader.js',engine+'.js',engine+'.wasm','hands_solution_packed_assets.data','hand_landmark_lite.tflite'];
  const fractions=new Map(names.map(name=>[name,0]));
  const total=names.reduce((sum,name)=>sum+manifest[name][0],0);
  const report=(name,value)=>{
   fractions.set(name,value);
   const loaded=names.reduce((sum,file)=>sum+manifest[file][0]*fractions.get(file),0);
   onProgress?.({stage:'download',percent:Math.floor(loaded/total*100)});
  };
  let cache=null;
  try{cache=await globalThis.caches?.open('aether-hands-'+version+'-v1');}catch{/* Private browsing can disable storage. */}
  const urls=new Map();
  let cursor=0;
  const worker=async()=>{
   while(cursor<names.length){
    const name=names[cursor++];
    const bytes=await getAsset(name,cache,value=>report(name,value));
    urls.set(name,URL.createObjectURL(new Blob([bytes],{type:mimeFor(name)})));
   }
  };
  try{await Promise.all([worker(),worker(),worker()]);}
  catch(error){urls.forEach(url=>URL.revokeObjectURL(url));throw error;}
  return urls;
 })();
 try{return await prepared;}catch(error){prepared=null;throw error;}
}

export async function createHandTracker({onResults,onProgress}={}){
 const urls=await prepare(onProgress);
 onProgress?.({stage:'initialize',percent:100});
 if(!window.Hands){
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=urls.get('hands.js');
   script.onload=()=>window.Hands?resolve():reject(new Error('手势库初始化失败'));
   script.onerror=()=>reject(new Error('手势库执行失败'));
   document.head.append(script);
  });
 }
 const hands=new window.Hands({locateFile:file=>urls.get(file)||new URL(file,root).href});
 hands.setOptions({maxNumHands:2,modelComplexity:0,minDetectionConfidence:.55,minTrackingConfidence:.55,selfieMode:false});
 hands.onResults(onResults||(()=>{}));
 let timer;
 try{
  await Promise.race([hands.initialize(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('模型初始化超时，请重试或更换浏览器')),45000);})]);
  return hands;
 }catch(error){await hands.close().catch(()=>{});throw error;}
 finally{clearTimeout(timer);}
}
