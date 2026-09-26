import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./gestures.js',import.meta.url),'utf8');
const {createGestureSequence}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const hold=(s,d,t)=>{s.update(d,t);return s.update(d,t+310);};
let s=createGestureSequence();
assert.equal(hold(s,5,0),'','Standalone five must not trigger love');
s=createGestureSequence();
assert.equal(hold(s,1,0),'1');
assert.equal(hold(s,2,700),'2');
assert.equal(hold(s,5,1400),'中秋快乐');
assert.equal(s.update(5,2000),'中秋快乐');
assert.equal(s.update(5,7800),'','Love expires even when five remains held');
for(const sequence of [[2,5],[1,5],[1,2,0,5],[2,1,5]]){
 s=createGestureSequence();let result;
 sequence.forEach((d,i)=>{result=hold(s,d,i*700);});
 assert.notEqual(result,'中秋快乐',sequence.join(','));
}
s=createGestureSequence();hold(s,1,0);hold(s,2,700);
assert.equal(hold(s,5,7000),'','Expired sequence');
s=createGestureSequence();hold(s,1,0);hold(s,2,700);s.update(null,2000);
assert.equal(hold(s,5,2500),'','Lost hand resets sequence');
s=createGestureSequence();s.update(1,0);s.update(2,100);
assert.equal(hold(s,5,200),'','Flicker does not advance sequence');
s=createGestureSequence();hold(s,1,0);s.reset();hold(s,2,700);
assert.equal(hold(s,5,1400),'','Camera reset clears history');
console.log('Gesture sequence tests passed');
