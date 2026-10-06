const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const base=process.argv[2] || 'http://localhost:8083';
const root=path.resolve(__dirname,'..');
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
(async()=>{
  const page=await fetch(base+'/rose/v3/'); assert.equal(page.status,200);
  const html=await page.text(); assert(html.includes('第三版 · 半岛铁盒'));
  const resources=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(p=>!p.startsWith('data:'));
  for(const resource of resources) {
    const res=await fetch(new URL(resource,base+'/rose/v3/')); assert.equal(res.status,200,resource);
    await res.arrayBuffer();
  }
  const versionFiles=fs.readdirSync(path.join(root,'v3')).filter(file=>/\.(html|css|js)$/.test(file));
  for(const expected of ['story-timeline.js','story-scene.js','diary.js']) assert(versionFiles.includes(expected),`Missing ${expected}`);
  for(const file of versionFiles) {
    const res=await fetch(base+'/rose/v3/'+file+'?verify=story-edition');
    assert.equal(res.status,200,file+' with a cache query');
    const actual=Buffer.from(await res.arrayBuffer());
    assert.equal(hash(actual),hash(fs.readFileSync(path.join(root,'v3',file))),file+' deployed hash');
  }
  const original=await fetch(base+'/rose/');
  assert.equal(hash(Buffer.from(await original.arrayBuffer())),'fae133952968bb6af64b6b173a515765673ce130da5639b7a8d2f2489f7f8f2f');
  const previousHashes={
    'app.js':'92357a1af3b207925d6b76b0b42dcd2d0decd7b90b862662b5b19f9041cfd9c4',
    'edition.css':'ed7cef5b4830bf1b026d19bc22b832f2d3efa8615ffebcc9c2a7e61e60c17650',
    'index.html':'f51b0fba99bfe987b2b67fd753b32f7521da04787d34a66b8c86b1a346e66a96',
    'style.css':'0a57f436b738489749def738e4d2ed4a810ed110e05bef7b224f7f2b8bc73797'
  };
  for(const [file,expected] of Object.entries(previousHashes)) {
    const previous=await fetch(base+'/rose/v2/'+file); assert.equal(previous.status,200);
    assert.equal(hash(Buffer.from(await previous.arrayBuffer())),expected,'Second edition '+file);
  }
  const music=base+'/rose/media/bandao-tiehe.mp3';
  const chunk=await fetch(music,{headers:{Range:'bytes=0-1023'}});
  assert.equal(chunk.status,206); assert.equal((await chunk.arrayBuffer()).byteLength,1024);
  assert.equal(chunk.headers.get('content-type'),'audio/mpeg');
  assert.equal(chunk.headers.get('content-range'),'bytes 0-1023/7667548');
  const end=await fetch(music,{headers:{Range:'bytes=7666500-'}});
  assert.equal(end.status,206); assert.equal((await end.arrayBuffer()).byteLength,1048);
  const invalid=await fetch(music,{headers:{Range:'bytes=99999999-'}}); assert.equal(invalid.status,416);
  const audio=await fetch(music+'?verify=story-edition'); assert.equal(audio.status,200);
  assert.equal(hash(Buffer.from(await audio.arrayBuffer())),'72e344dc36f329498741f70539a46e63d7b1025696ac7f077dbe33be813a61d0');
  const redirect=await fetch(base+'/rose/v3',{redirect:'manual'}); assert([301,302,307,308].includes(redirect.status)); assert(redirect.headers.get('location').endsWith('/rose/v3/'));
  const main=await fetch(base+'/'); assert.equal(main.status,200);
  console.log(`PASS ${base}: all story resources and query URLs, deployed hashes, preserved original and song, MP3 seek ranges and both entries`);
})().catch(error=>{console.error(error);process.exitCode=1;});
