(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RoseStory = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TRACK_DURATION = 319.4;
  var chapters = [
    { id: 'book', index: 0, at: 0, title: '翻开旧书', caption: '灯还亮着，故事从这里开始。' },
    { id: 'box', index: 1, at: 35.55, title: '发现旧铁盒', caption: '拂去浮尘，留一点光给从前。' },
    { id: 'warmth', index: 2, at: 47.09, title: '温暖的回忆', caption: '有些日子，想起来还是暖的。' },
    { id: 'rain', index: 3, at: 75.05, title: '雨中的离别', caption: '雨落在窗上，思念留在这边。' },
    { id: 'memory', index: 4, at: 119.93, title: '记忆逐渐模糊', caption: '纸页渐轻，没说完的话化作微光。' },
    { id: 'ending', index: 5, at: 299.4, title: '收起这一刻', caption: '把温柔收好，让故事停在微光里。' }
  ];

  // Studio recording from the album, not a live performance or music-video edit.
  // Section anchors reference the album LRC at https://www.mulanci.org/lyric/tl114757/.
  // Approximate section synchronization only: no lyric text is stored or displayed.
  // 0: spoken opening; 17.10: verse begins; 35.55: first box passage.
  // 47.09: first warm passage; 75.05: chorus; 119.93: diary/memory passage.
  // 150.17: verse returns; 168.37: box; 179.88: warmth; 207.96: chorus returns.
  // 237.37: chorus reprise; 266.85: final chorus turn; 281.96: last memory passage.
  // 299.40 onward: designed outro (last 20 seconds), petals return before lid closes.
  var cues = [
    { at: 0, chapter: 0, repeat: 0, id: 'spoken-opening' },
    { at: 17.10, chapter: 0, repeat: 0, id: 'verse-one' },
    { at: 35.55, chapter: 1, repeat: 0, id: 'box-one' },
    { at: 47.09, chapter: 2, repeat: 0, id: 'warmth-one' },
    { at: 75.05, chapter: 3, repeat: 0, id: 'rain-one' },
    { at: 119.93, chapter: 4, repeat: 0, id: 'memory-one' },
    { at: 150.17, chapter: 0, repeat: 1, id: 'verse-two', caption: '再翻一页，熟悉的灯光又亮起来。' },
    { at: 168.37, chapter: 1, repeat: 1, id: 'box-two', caption: '同一只铁盒，藏着更远的时光。' },
    { at: 179.88, chapter: 2, repeat: 1, id: 'warmth-two', caption: '那一点温暖，还在记忆深处。' },
    { at: 207.96, chapter: 3, repeat: 1, id: 'rain-two', caption: '熟悉的雨声里，还留着一点等待。' },
    { at: 237.37, chapter: 3, repeat: 2, id: 'rain-reprise', caption: '窗外渐远，留下的光也渐轻。' },
    { at: 266.85, chapter: 3, repeat: 3, id: 'rain-final', caption: '这一次，让风带走没说完的话。' },
    { at: 281.96, chapter: 4, repeat: 3, id: 'memory-final', caption: '让纸页散成光，把温柔留在心里。' },
    { at: 299.4, chapter: 5, repeat: 3, id: 'outro' }
  ];

  // [canonical audio seconds, target intensity]. Smoothstep interpolation gives
  // a continuous pose and zero velocity at each anchor, even when seeking.
  var tracks = {
    growth: [
      [0, 0], [35.55, 0], [40.5, 0.04], [47.09, 0.22], [57.8, 1],
      [119.93, 1], [143, 0.85], [150.17, 0.76], [168.37, 0.66],
      [179.88, 0.75], [190, 1], [281.96, 1], [299.4, 1],
      [306, 0.84], [312.2, 0.2], [314.4, 0], [319.4, 0]
    ],
    warmth: [
      [0, 0.52], [17.10, 0.64], [35.55, 0.43], [47.09, 0.58],
      [54, 1], [68, 1], [75.05, 0.70], [85.95, 0.24],
      [104.53, 0.13], [119.93, 0.10], [139, 0.17],
      [150.17, 0.48], [168.37, 0.40], [179.88, 0.52],
      [189, 0.85], [200.81, 0.80], [207.96, 0.58], [218.46, 0.20],
      [237.37, 0.14], [248.46, 0.10], [266.85, 0.06],
      [281.96, 0.04], [299.4, 0.13], [314.4, 0.26], [319.4, 0.26]
    ],
    rain: [
      [0, 0], [75.05, 0], [85.95, 0.72], [104.53, 0.88],
      [119.93, 0.90], [134, 0.38], [148, 0],
      [207.96, 0], [218.46, 0.78], [237.37, 0.87],
      [248.46, 0.97], [266.85, 1], [281.96, 0.75],
      [299.4, 0.35], [309.4, 0], [319.4, 0]
    ],
    dust: [
      [0, 0.30], [17.10, 0.48], [35.55, 0.88], [43.8, 1],
      [55, 0.20], [75.05, 0.12], [119.93, 0.54], [136, 0.88],
      [150.17, 0.60], [168.37, 0.95], [176, 1], [189, 0.27],
      [207.96, 0.20], [237.37, 0.42], [266.85, 0.60],
      [281.96, 0.94], [299.4, 0.86], [314.4, 0.10], [319.4, 0.06]
    ],
    dissolve: [
      [0, 0], [85.95, 0], [119.93, 0.16], [136, 0.40],
      [150.17, 0.28], [168.37, 0.15], [179.88, 0.07], [189, 0],
      [207.96, 0], [237.37, 0.19], [266.85, 0.35],
      [281.96, 0.48], [299.4, 0.60], [311.8, 1], [319.4, 1]
    ],
    // close is outro closure only: 0 means no outro closure, 1 means shut.
    // The renderer should derive the initial opening from the box cue/growth.
    close: [[0, 0], [311.8, 0], [317.4, 1], [319.4, 1]],
    heart: [
      [0, 0], [60, 0], [62.4, 1], [64.2, 1], [68.4, 0],
      [80.6, 0], [82.2, 1], [84.0, 1], [87.4, 0],
      [192.5, 0], [195.0, 0.85], [196.5, 0.85], [200.5, 0],
      [215.5, 0], [217.5, .85], [220.0, .85], [224.0, 0],
      [270.0, 0], [272.0, .7], [274.0, .7], [278.0, 0], [319.4, 0]
    ],
    bookOpen: [
      [0, 0], [7, 0.22], [17.10, 1], [28.35, 1], [41, 0.15],
      [47.09, 0], [119.93, 0], [124.2, 0.82], [143, 0.82],
      [150.17, 1], [161.2, 1], [176, 0.12], [179.88, 0],
      [281.96, 0], [288, 0.80], [299.4, 0.38], [309.4, 0], [319.4, 0]
    ]
  };
  var channels = Object.keys(tracks);

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function smooth(value) { var x = clamp(value); return x * x * (3 - 2 * x); }
  function sample(points, time) {
    for (var i = 1; i < points.length; i++) {
      if (time <= points[i][0]) {
        var a = points[i - 1];
        var b = points[i];
        var mix = smooth((time - a[0]) / (b[0] - a[0]));
        return clamp(a[1] + (b[1] - a[1]) * mix);
      }
    }
    return points[points.length - 1][1];
  }

  /**
   * Pure audio-time-to-pose mapping. No wall clock, accumulated dt, or mutable state.
   * Unknown/invalid duration uses the measured 319.4 s recording. Known duration
   * scales the canonical score proportionally (including small encoder padding).
   * Calling with duration, duration returns the completed still pose. Call with
   * currentTime on pause/seek as normal; no reset or replay event is required.
   */
  function getFrame(seconds, duration) {
    var length = typeof duration === 'number' && isFinite(duration) && duration > 0 ? duration : TRACK_DURATION;
    var time = seconds === Infinity ? length : typeof seconds === 'number' && isFinite(seconds) ? seconds : 0;
    time = Math.max(0, Math.min(length, time));
    var referenceTime = length === TRACK_DURATION ? time : (time / length) * TRACK_DURATION;
    var cueIndex = 0;
    for (var i = 1; i < cues.length; i++) {
      if (referenceTime + 1e-9 >= cues[i].at) cueIndex = i;
      else break;
    }
    var cue = cues[cueIndex];
    var chapter = chapters[cue.chapter];
    var end = cueIndex + 1 < cues.length ? cues[cueIndex + 1].at : TRACK_DURATION;
    var frame = {
      time: time,
      duration: length,
      chapterId: chapter.id,
      chapterIndex: chapter.index,
      cueId: cue.id,
      title: chapter.title,
      caption: cue.caption || chapter.caption,
      phase: clamp((referenceTime - cue.at) / (end - cue.at)),
      repeatIndex: cue.repeat
    };
    for (i = 0; i < channels.length; i++) frame[channels[i]] = sample(tracks[channels[i]], referenceTime);
    return frame;
  }

  // Prevent UI code from changing the shared score through chapter metadata.
  chapters.forEach(Object.freeze);
  Object.freeze(chapters);
  return Object.freeze({ duration: TRACK_DURATION, chapters: chapters, getFrame: getFrame });
}));
