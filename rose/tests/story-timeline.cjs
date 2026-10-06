'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const story = require('../v3/story-timeline.js');
const DURATION = 319.4;
const CHANNELS = ['phase', 'growth', 'warmth', 'rain', 'dust', 'dissolve', 'close', 'heart', 'bookOpen'];

assert.deepEqual(story.chapters.map(c => c.id), ['book', 'box', 'warmth', 'rain', 'memory', 'ending']);
assert.equal(new Set(story.chapters.map(c => c.title)).size, 6);
for (const [time, id] of [[35.55, 'box'], [47.09, 'warmth'], [75.05, 'rain'], [119.93, 'memory'], [150.17, 'book'], [179.88, 'warmth'], [299.4, 'ending']]) {
  assert.equal(story.getFrame(time).chapterId, id, `exact boundary at ${time}`);
  assert.equal(story.getFrame(time).phase, 0);
}

// Semantic passages must recur; the second verse cannot remain stuck in rain.
for (const [time, chapter, repeat] of [
  [0, 'book', 0], [25, 'book', 0], [40, 'box', 0], [60, 'warmth', 0],
  [90, 'rain', 0], [135, 'memory', 0], [155, 'book', 1],
  [172, 'box', 1], [193, 'warmth', 1], [220, 'rain', 1],
  [250, 'rain', 2], [274, 'rain', 3], [289, 'memory', 3], [305, 'ending', 3]
]) {
  const frame = story.getFrame(time, DURATION);
  assert.equal(frame.chapterId, chapter, `chapter at ${time}`);
  assert.equal(frame.repeatIndex, repeat, `repeat at ${time}`);
}

// The later chorus should look more distant and fragmented than the first.
assert.ok(story.getFrame(274).warmth < story.getFrame(92).warmth);
assert.ok(story.getFrame(274).dissolve > story.getFrame(92).dissolve);
assert.ok(story.getFrame(60).warmth > 0.9);
assert.equal(story.getFrame(60).growth, 1);
assert.equal(story.getFrame(63).heart, 1);
assert.ok(story.getFrame(196).heart > 0.8);
assert.equal(story.getFrame(92).heart, 0);

// End choreography: petals finish returning before the lid starts closing.
assert.equal(story.getFrame(311.8).dissolve, 1);
assert.equal(story.getFrame(311.8).close, 0);
assert.ok(story.getFrame(315).close > 0);
const end = story.getFrame(DURATION, DURATION);
assert.equal(end.chapterId, 'ending');
assert.equal(end.phase, 1);
assert.equal(end.growth, 0);
assert.equal(end.dissolve, 1);
assert.equal(end.close, 1);
assert.equal(end.bookOpen, 0);
assert.equal(end.rain, 0);
assert.equal(end.heart, 0);
assert.deepEqual(story.getFrame(DURATION + 1000, DURATION), end);

// No history dependence: pause does not advance and seeking backwards restores
// the same flower, weather, text, and book pose on the very next frame.
const warm = story.getFrame(63, DURATION);
for (let i = 0; i < 100; i++) {
  story.getFrame(300 + i, DURATION);
  assert.deepEqual(story.getFrame(63, DURATION), warm);
}
const frozen = story.getFrame(218.46, DURATION);
const originalNow = Date.now;
try {
  Date.now = () => originalNow() + 864000000;
  assert.deepEqual(story.getFrame(218.46, DURATION), frozen);
} finally { Date.now = originalNow; }
const mutableFrame = story.getFrame(63);
mutableFrame.growth = -100;
assert.deepEqual(story.getFrame(63), warm);

// Unknown metadata, malformed inputs, edge cases, and all sampled poses stay finite.
for (const duration of [undefined, NaN, 0, -1, Infinity, 1, 319.4, 320, 10000]) {
  for (const seconds of [undefined, NaN, -Infinity, -100, 0, 0.01, 47, 170, 319.4, 100000, Infinity]) {
    const frame = story.getFrame(seconds, duration);
    for (const key of CHANNELS) {
      assert.ok(Number.isFinite(frame[key]) && frame[key] >= 0 && frame[key] <= 1, `${key} must be normalized`);
    }
    assert.ok(frame.chapterIndex >= 0 && frame.chapterIndex <= 5);
  }
}
assert.deepEqual(story.getFrame(80, NaN), story.getFrame(80, DURATION));
assert.deepEqual(story.getFrame(-1), story.getFrame(0));
assert.equal(story.getFrame(10, 10).close, 1);
assert.equal(story.getFrame(10, 10).growth, 0);
assert.equal(story.getFrame(160, 640).chapterId, story.getFrame(79.85).chapterId);

// All visual intensities are continuous across cue and keyframe boundaries.
// phase and chapter text intentionally reset at a new cue.
let previous = story.getFrame(0);
for (let tick = 1; tick <= 319400; tick++) {
  const current = story.getFrame(tick / 1000);
  for (const channel of CHANNELS.slice(1)) {
    assert.ok(Math.abs(current[channel] - previous[channel]) < 0.002, `jump in ${channel} near ${tick / 1000}`);
  }
  previous = current;
}

// The same source loads directly in browsers without CommonJS or any DOM.
const browser = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../v3/story-timeline.js'), 'utf8'), browser);
assert.equal(browser.RoseStory.getFrame(63).chapterId, 'warmth');
assert.equal(browser.RoseStory.getFrame(DURATION).close, 1);
console.log('Story timeline passed: sections, returns, seeking, pauses, closure, continuity, malformed metadata, and browser export.');
