const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const base=process.argv[2] || 'http://localhost:8083';
const root=path.resolve(__dirname,'..');
(async()=>{
  const page=await fetch(base+'/rose/v2/'); assert.equal(page.status,200);
  const html=await page.text(); assert(html.includes('第二版 · 半岛铁盒'));
  const resources=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(p=>!p.startsWith('data:'));
  for(const resource of resources) {
    const res=await fetch(new URL(resource,base+'/rose/v2/')); assert.equal(res.status,200,resource);
    await res.arrayBuffer();
  }
  for(const file of ['index.html','app.js','style.css','edition.css']) {
    const res=await fetch(base+'/rose/v2/'+file), actual=Buffer.from(await res.arrayBuffer());
    assert.equal(createHash('sha256').update(actual).digest('hex'), createHash('sha256').update(fs.readFileSync(path.join(root,'v2',file))).digest('hex'));
  }
  const original=await fetch(base+'/rose/');
  assert.equal(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'),'fae133952968bb6af64b6b173a515765673ce130da5639b7a8d2f2489f7f8f2f');
  const music=base+'/rose/media/bandao-tiehe.mp3';
  const chunk=await fetch(music,{headers:{Range:'bytes=0-1023'}});
  assert.equal(chunk.status,206); assert.equal((await chunk.arrayBuffer()).byteLength,1024);
  assert.equal(chunk.headers.get('content-type'),'audio/mpeg');
  assert.equal(chunk.headers.get('content-range'),'bytes 0-1023/7667548');
  const invalid=await fetch(music,{headers:{Range:'bytes=99999999-'}}); assert.equal(invalid.status,416);
  const redirect=await fetch(base+'/rose/v2',{redirect:'manual'}); assert([301,302,307,308].includes(redirect.status)); assert(redirect.headers.get('location').endsWith('/rose/v2/'));
  const main=await fetch(base+'/'); assert.equal(main.status,200);
  console.log(`PASS ${base}: all page resources, deployed hashes, preserved original, MP3 ranges and both entries`);
})().catch(error=>{console.error(error);process.exitCode=1;});
