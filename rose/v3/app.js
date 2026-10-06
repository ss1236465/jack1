(function () {
    "use strict";

    var TAU = Math.PI * 2;
    var GOLDEN = 2.399963229728653;
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function clamp01(v) { return clamp(v, 0, 1); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function smoothstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

    var canvas = document.getElementById("stage");
    var tipEl = document.getElementById("tip");
    var subEl = document.getElementById("sub");
    var hintEl = document.getElementById("hint");
    var soundBtn = document.getElementById("soundBtn");
    var replayBtn = document.getElementById("replayBtn");
    var flashEl = document.getElementById("flash");

    var isMobile = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent) ||
      Math.min(window.innerWidth, window.innerHeight) < 560;
    var DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    } catch (err) {
      tipEl.textContent = "当前环境不支持 WebGL，换个浏览器试试";
      document.querySelector('.intro-description').textContent = tipEl.textContent;
      document.getElementById('openBtn').disabled = true;
      return;
    }
    renderer.setPixelRatio(DPR);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 1);

    var FOG = 0.0072;
    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
    var cam = { yaw: 0.42, pitch: 0.34, dist: 17.5 };
    var autoYaw = 0;
    var LOOK = new THREE.Vector3(0, 0.3, 0);

    function updateCamera() {
      var cp = Math.sin(cam.pitch), cc = Math.cos(cam.pitch);
      camera.position.set(
        Math.sin(cam.yaw + autoYaw) * cc,
        cp,
        Math.cos(cam.yaw + autoYaw) * cc
      ).multiplyScalar(cam.dist).add(LOOK);
      camera.lookAt(LOOK.x, LOOK.y, LOOK.z);
    }
    updateCamera();

    function glowTexture() {
      var s = 128, c = document.createElement("canvas");
      c.width = c.height = s;
      var g = c.getContext("2d");
      var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0.0, "rgba(255,255,255,1)");
      grd.addColorStop(0.16, "rgba(255,255,255,0.60)");
      grd.addColorStop(0.40, "rgba(210,250,255,0.18)");
      grd.addColorStop(0.70, "rgba(140,210,255,0.045)");
      grd.addColorStop(1.0, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
      var t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      return t;
    }
    var TEX_GLOW = glowTexture();

    /* ============================================================
       1 · faint code rain behind everything
       ============================================================ */
    function rainTexture() {
      var W = 256, H = 512;
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      var g = c.getContext("2d");
      g.clearRect(0, 0, W, H);
      var FONT = '"MS Gothic","Hiragino Kaku Gothic ProN","Microsoft YaHei",monospace';
      var COLS = 16, CELL = H / 32;
      for (var col = 0; col < COLS; col++) {
        var x = (col + 0.5) * (W / COLS);
        var run = 8 + ((Math.random() * 18) | 0);
        var y0 = Math.random() * H;
        for (var k = 0; k < run; k++) {
          var ch = String.fromCharCode(0x30A1 + ((Math.random() * 86) | 0));
          var a = Math.pow(1 - k / run, 1.6);
          g.font = (k === 0 ? "600 " : "400 ") + Math.round(CELL * 0.85) + "px " + FONT;
          g.fillStyle = k === 0
            ? "rgba(225,255,245,0.95)"
            : "rgba(90,255,190," + (0.10 + a * 0.75).toFixed(3) + ")";
          g.fillText(ch, x, (y0 + k * CELL) % (H + CELL));
        }
      }
      var t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    }
    var TEX_RAIN = rainTexture();

    var rainGroup = new THREE.Group();
    scene.add(rainGroup);
    var rainPlanes = [];
    (function () {
      var layers = [
        { z: -66, op: 0.20, sp: 0.045, rep: 5, col: 0x2bffa8 },
        { z: -122, op: 0.13, sp: 0.075, rep: 4, col: 0x2fe7c8 },
        { z: -200, op: 0.08, sp: 0.110, rep: 3, col: 0x37d8ff }
      ];
      layers.forEach(function (L) {
        var tex = TEX_RAIN.clone();
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(L.rep, 2);
        tex.offset.x = Math.random();
        var mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: L.op, color: L.col,
          blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
        });
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        mesh.position.z = L.z;
        mesh.frustumCulled = false;
        rainGroup.add(mesh);
        rainPlanes.push({ mesh: mesh, tex: tex, speed: L.sp, base: L.op });
      });
    })();

    function sizeRain() {
      rainPlanes.forEach(function (p) {
        var z = Math.abs(p.mesh.position.z);
        var hh = 2 * z * Math.tan((camera.fov * Math.PI / 180) / 2);
        p.mesh.scale.set(hh * camera.aspect * 1.3, hh * 1.3, 1);
      });
    }

    /* ============================================================
       2 · the rose — parametric petals
       ============================================================ */
    var PETALS = isMobile ? 15 : 20;
    var GRID_U = 6, GRID_V = 9;
    var PTS_PER = isMobile ? 55 : 95;
    var ROSE_SCALE = 1.75;
    var FLOWER_Y = 1.7;

    var PETAL_FN = [
      "vec3 petalLocal(vec2 uv, float scale, float seed){",
      "  float t = uv.y;",
      "  float uu = uv.x * 2.0 - 1.0;",
      "  float w = 0.50 * (0.18 + 0.82 * pow(sin(3.14159265 * min(1.0, t * 0.78 + 0.11)), 0.7));",
      "  float x = uu * w * scale;",
      "  float y = t * 0.95 * scale;",
      "  float cup = -uu * uu * 0.16 * scale;",
      "  float bend = -pow(t, 2.1) * 0.44 * scale;",
      "  float ruf = 1.0 + 0.06 * sin(t * 14.0 + seed * 6.0);",
      "  return vec3(x, y, (cup + bend) * ruf);",
      "}",
      "vec3 placePetal(vec3 L, float tilt, float theta, float radial, float yoff){",
      "  float ca = cos(tilt), sa = sin(tilt);",
      "  vec3 q = vec3(L.x, L.y * ca - L.z * sa, L.y * sa + L.z * ca);",
      "  float ct = cos(theta), st = sin(theta);",
      "  vec3 p = vec3(q.x * ct + q.z * st, q.y, -q.x * st + q.z * ct);",
      "  p.x += st * radial;",
      "  p.z += ct * radial;",
      "  p.y += yoff;",
      "  return p;",
      "}"
    ].join("\n");

    var petalDefs = [];
    var lineUV = [], linePetal = [], lineTheta = [], lineTiltA = [], lineTiltB = [],
        lineScale = [], lineRadial = [], lineYOff = [], lineSeed = [], lineRoll = [], lineIdx = [], linePos = [];
    var ptUV = [], ptPetal = [], ptTheta = [], ptTiltA = [], ptTiltB = [],
        ptScale = [], ptRadial = [], ptYOff = [], ptSeed = [], ptRoll = [], ptSize = [];

    (function buildRose() {
      var vIndex = 0;
      for (var i = 0; i < PETALS; i++) {
        var frac = i / (PETALS - 1);
        var def = {
          frac: frac,
          theta: i * GOLDEN + (Math.random() - 0.5) * 0.10,
          tiltA: 0.05 + 0.30 * frac,
          tiltB: 0.20 + 1.02 * Math.pow(frac, 0.85),
          scale: 0.55 + 0.78 * frac,
          radial: 0.10 + 0.92 * Math.pow(frac, 0.70),
          yoff: -0.34 * Math.pow(frac, 1.15),
          seed: Math.random(),
          roll: (Math.random() - 0.5) * 0.62,
          start: 0,
          open: 0
        };
        petalDefs.push(def);

        function vtx(u, v) {
          lineUV.push(u, v);
          linePetal.push(i);
          lineTheta.push(def.theta);
          lineTiltA.push(def.tiltA);
          lineTiltB.push(def.tiltB);
          lineScale.push(def.scale);
          lineRadial.push(def.radial);
          lineYOff.push(def.yoff);
          lineSeed.push(def.seed);
          lineRoll.push(def.roll);
          linePos.push(0, 0, 0);
          return vIndex++;
        }
        var grid = [];
        for (var gu = 0; gu <= GRID_U; gu++) {
          grid[gu] = [];
          for (var gv = 0; gv <= GRID_V; gv++) grid[gu][gv] = vtx(gu / GRID_U, gv / GRID_V);
        }
        for (var a = 0; a <= GRID_U; a++) {
          for (var b = 0; b < GRID_V; b++) lineIdx.push(grid[a][b], grid[a][b + 1]);
        }
        for (var b2 = 0; b2 <= GRID_V; b2++) {
          for (var a2 = 0; a2 < GRID_U; a2++) lineIdx.push(grid[a2][b2], grid[a2 + 1][b2]);
        }

        for (var p = 0; p < PTS_PER; p++) {
          ptUV.push(Math.random(), Math.pow(Math.random(), 0.85));
          ptPetal.push(i);
          ptTheta.push(def.theta);
          ptTiltA.push(def.tiltA);
          ptTiltB.push(def.tiltB);
          ptScale.push(def.scale);
          ptRadial.push(def.radial);
          ptYOff.push(def.yoff);
          ptSeed.push(def.seed);
          ptRoll.push(def.roll);
          ptSize.push(0.020 + Math.random() * 0.045);
        }
      }
    })();

    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    lineGeo.setAttribute("aUV", new THREE.Float32BufferAttribute(lineUV, 2));
    lineGeo.setAttribute("aPetal", new THREE.Float32BufferAttribute(linePetal, 1));
    lineGeo.setAttribute("aTheta", new THREE.Float32BufferAttribute(lineTheta, 1));
    lineGeo.setAttribute("aTiltA", new THREE.Float32BufferAttribute(lineTiltA, 1));
    lineGeo.setAttribute("aTiltB", new THREE.Float32BufferAttribute(lineTiltB, 1));
    lineGeo.setAttribute("aScale", new THREE.Float32BufferAttribute(lineScale, 1));
    lineGeo.setAttribute("aRadial", new THREE.Float32BufferAttribute(lineRadial, 1));
    lineGeo.setAttribute("aYOff", new THREE.Float32BufferAttribute(lineYOff, 1));
    lineGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(lineSeed, 1));
    lineGeo.setAttribute("aRoll", new THREE.Float32BufferAttribute(lineRoll, 1));
    lineGeo.setIndex(lineIdx);

    var ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(ptUV.length / 2 * 3), 3));
    ptGeo.setAttribute("aUV", new THREE.Float32BufferAttribute(ptUV, 2));
    ptGeo.setAttribute("aPetal", new THREE.Float32BufferAttribute(ptPetal, 1));
    ptGeo.setAttribute("aTheta", new THREE.Float32BufferAttribute(ptTheta, 1));
    ptGeo.setAttribute("aTiltA", new THREE.Float32BufferAttribute(ptTiltA, 1));
    ptGeo.setAttribute("aTiltB", new THREE.Float32BufferAttribute(ptTiltB, 1));
    ptGeo.setAttribute("aScale", new THREE.Float32BufferAttribute(ptScale, 1));
    ptGeo.setAttribute("aRadial", new THREE.Float32BufferAttribute(ptRadial, 1));
    ptGeo.setAttribute("aYOff", new THREE.Float32BufferAttribute(ptYOff, 1));
    ptGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(ptSeed, 1));
    ptGeo.setAttribute("aRoll", new THREE.Float32BufferAttribute(ptRoll, 1));
    ptGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(ptSize, 1));

    var OPEN_TEX_W = 64;
    var openData = new Uint8Array(OPEN_TEX_W * 4);
    var openTex = new THREE.DataTexture(openData, OPEN_TEX_W, 1, THREE.RGBAFormat);
    openTex.needsUpdate = true;

    function addHeartTarget(geometry, uvs, seeds) {
      var data = new Float32Array(uvs.length / 2 * 3);
      for (var j = 0; j < uvs.length / 2; j++) {
        var angle = uvs[j * 2] * TAU, radius = Math.sqrt(0.14 + uvs[j * 2 + 1] * 0.86);
        data[j * 3] = 16 * Math.pow(Math.sin(angle), 3) * 0.15 * radius;
        data[j * 3 + 1] = (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) * 0.15 * radius + FLOWER_Y;
        data[j * 3 + 2] = (seeds[j] - 0.5) * 0.85 * (1.1 - radius);
      }
      geometry.setAttribute('aHeart', new THREE.BufferAttribute(data, 3));
    }
    addHeartTarget(lineGeo, lineUV, lineSeed);
    addHeartTarget(ptGeo, ptUV, ptSeed);

    var PETAL_HEAD = [
      "uniform sampler2D uOpen;",
      "uniform float uTime, uOpenSlots, uRoseScale, uFlowerY, uFogDensity, uBright, uMorph, uDissolve, uReturn, uRain, uPetalAlpha;",
      "uniform vec3 uMag, uCyan, uHeartRight, uHeartUp, uHeartForward, uBoxTarget;",
      PETAL_FN,
      "attribute vec2 aUV;",
      "attribute vec3 aHeart;",
      "attribute float aPetal, aTheta, aTiltA, aTiltB, aScale, aRadial, aYOff, aSeed, aRoll;",
      "float openOf(float idx){ return texture2D(uOpen, vec2((idx + 0.5) * uOpenSlots, 0.5)).r; }",
      "vec4 placePetalWorld(){",
      "  float open = openOf(aPetal);",
      "  float tilt = mix(aTiltA, aTiltB, open);",
      "  float sc = aScale * (0.32 + 0.68 * open);",
      "  vec3 L = petalLocal(aUV, sc, aSeed);",
      "  float cr = cos(aRoll), sr = sin(aRoll);",
      "  L = vec3(L.x * cr + L.z * sr, L.y, -L.x * sr + L.z * cr);",
      "  vec3 p = placePetal(L, tilt, aTheta, aRadial, aYOff);",
      "  p *= uRoseScale;",
      "  p.y += uFlowerY;",
      "  vec3 drift = vec3(sin(aSeed*41.0), cos(aSeed*29.0), sin(aSeed*67.0)) * sin(uMorph*3.14159265) * 1.8;",
      "  vec3 heartTarget = vec3(0.0, uFlowerY, 0.0) + uHeartRight * aHeart.x + uHeartUp * (aHeart.y - uFlowerY) + uHeartForward * aHeart.z;",
      "  p = mix(p, heartTarget, uMorph) + drift;",
      "  float loose = smoothstep(aSeed * 0.65, aSeed * 0.65 + 0.32, uDissolve);",
      "  vec3 wind = vec3(sin(uTime * 0.13 + aSeed * 21.0) * 3.2, cos(uTime * 0.19 + aSeed * 14.0) * 1.0, sin(aSeed * 31.0) * 1.4);",
      "  p += wind * loose * (1.0 - uReturn) * (0.35 + uRain * 0.4);",
      "  vec3 kept = uBoxTarget + vec3(sin(aSeed * 73.0), sin(aSeed * 51.0) * 0.15, cos(aSeed * 73.0)) * (1.0-uReturn) * 0.65;",
      "  p = mix(p, kept, uReturn);",
      "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
      "  return vec4(mv.xyz, open);",
      "}"
    ].join("\n");

    var sharedUniforms = {
      uOpen: { value: openTex },
      uTime: { value: 0 },
      uOpenSlots: { value: 1 / OPEN_TEX_W },
      uRoseScale: { value: ROSE_SCALE },
      uFlowerY: { value: FLOWER_Y },
      uFogDensity: { value: FOG },
      uBright: { value: 1 },
      uMorph: { value: 0 },
      uDissolve: { value: 0 }, uReturn: { value: 0 }, uRain: { value: 0 }, uPetalAlpha: { value: 1 },
      uBoxTarget: { value: new THREE.Vector3(0, -5.0, 0) },
      uHeartRight: { value: new THREE.Vector3(1, 0, 0) },
      uHeartUp: { value: new THREE.Vector3(0, 1, 0) },
      uHeartForward: { value: new THREE.Vector3(0, 0, 1) },
      uMag: { value: new THREE.Color(0xFF2FD6) },
      uCyan: { value: new THREE.Color(0x00F0FF) }
    };

    var lineMat = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      vertexShader: [
        PETAL_HEAD,
        "varying vec3 vColor;",
        "varying float vFade;",
        "varying float vOpen;",
        "void main(){",
        "  vec4 mv = placePetalWorld();",
        "  gl_Position = projectionMatrix * mv;",
        "  float edge = clamp(0.02 + 0.88 * (abs(aUV.x * 2.0 - 1.0) * 0.72 + pow(aUV.y, 1.6) * 0.58), 0.0, 1.0);",
        "  vColor = mix(uMag * 1.85, uCyan * 0.90, edge);",
        "  float d = -mv.z;",
        "  float border = smoothstep(0.62, 1.0, max(abs(aUV.x * 2.0 - 1.0), aUV.y));",
        "  vFade = exp(-pow(uFogDensity * d, 2.0)) * smoothstep(0.0, 0.20, mv.w) * (0.60 + 0.34 * border);",
        "  vOpen = mv.w;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uBright, uMorph, uPetalAlpha, uDissolve;",
        "varying vec3 vColor;",
        "varying float vFade;",
        "varying float vOpen;",
        "void main(){",
        "  gl_FragColor = vec4(vColor * ((0.22 + 0.78 * vOpen) * vFade * uBright * (1.0 - uMorph) * uPetalAlpha * (1.0-uDissolve*.8)), 1.0);",
        "}"
      ].join("\n"),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });
    lineMat.fog = false;
    var lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    lineMesh.frustumCulled = false;
    scene.add(lineMesh);

    var pointMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, sharedUniforms, {
        uMap: { value: TEX_GLOW },
        uPointScale: { value: 900 }
      }),
      vertexShader: [
        PETAL_HEAD,
        "attribute float aSize;",
        "uniform float uPointScale;",
        "varying vec3 vColor;",
        "varying float vAlpha;",
        "void main(){",
        "  vec4 mv = placePetalWorld();",
        "  gl_Position = projectionMatrix * mv;",
        "  float d = max(0.001, -mv.z);",
        "  gl_PointSize = clamp(aSize * uRoseScale * uPointScale * (1.0 + uMorph*1.5) / d, 1.0, 24.0);",
        "  float edge = clamp(0.02 + 0.88 * (abs(aUV.x * 2.0 - 1.0) * 0.72 + pow(aUV.y, 1.6) * 0.58), 0.0, 1.0);",
        "  vec3 c = mix(uMag * 1.85, uCyan * 0.90, edge);",
        "  c = mix(c, vec3(1.0), step(0.94, fract(aSeed * 7.3)) * 0.8);",
        "  vColor = c;",
        "  float tw = 0.7 + 0.3 * sin(uTime * 2.1 + aSeed * 40.0);",
        "  float border2 = smoothstep(0.55, 1.0, max(abs(aUV.x * 2.0 - 1.0), aUV.y));",
        "  vAlpha = smoothstep(0.0, 0.32, mv.w) * exp(-pow(uFogDensity * d, 2.0)) * tw * (0.58 + 0.38 * border2);",
        "  float gap = smoothstep(0.18,0.65,uRain) * smoothstep(0.10,0.22,aHeart.x) * smoothstep(uFlowerY-0.2,uFlowerY+0.35,aHeart.y);",
        "  vAlpha *= 1.0-gap*uMorph;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D uMap;",
        "uniform float uBright, uMorph, uPetalAlpha, uDissolve;",
        "varying vec3 vColor;",
        "varying float vAlpha;",
        "void main(){",
        "  float a = texture2D(uMap, gl_PointCoord).a;",
        "  gl_FragColor = vec4(vColor * a * vAlpha * uBright * mix(0.24, 1.6, max(uMorph,uDissolve*.65)) * uPetalAlpha, 1.0);",
        "}"
      ].join("\n"),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });
    pointMat.fog = false;
    var ptMesh = new THREE.Points(ptGeo, pointMat);
    ptMesh.frustumCulled = false;
    scene.add(ptMesh);

    /* ============================================================
       3 · stem, leaves
       ============================================================ */
    var stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.00, -5.4, 0.0),
      new THREE.Vector3(0.26, -3.9, 0.10),
      new THREE.Vector3(-0.22, -2.4, -0.06),
      new THREE.Vector3(0.16, -1.0, 0.05),
      new THREE.Vector3(0.00, 1.20, 0.0)
    ]);

    var stemMat = new THREE.ShaderMaterial({
      uniforms: {
        uGrow: { value: 0 }, uTime: { value: 0 }, uBright: { value: 1 },
        uCol: { value: new THREE.Color(0x35f4c8) }
      },
      vertexShader: [
        "varying vec2 vUv2;",
        "varying float vD;",
        "void main(){",
        "  vUv2 = uv;",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  vD = -mv.z;",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uGrow, uBright;",
        "uniform vec3 uCol;",
        "varying vec2 vUv2;",
        "varying float vD;",
        "void main(){",
        "  float on = step(vUv2.y, uGrow + 0.02);",
        "  float tip = smoothstep(uGrow - 0.06, uGrow, vUv2.y) * 1.7;",
        "  float a = (0.32 + tip) * on * exp(-pow(0.0072 * vD, 2.0)) * uBright;",
        "  gl_FragColor = vec4(uCol * a, 1.0);",
        "}"
      ].join("\n"),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });
    var stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 48, 0.026, 6, false), stemMat);
    stem.frustumCulled = false;
    scene.add(stem);

    var leafMat = new THREE.ShaderMaterial({
      uniforms: { uGrow: { value: 0 }, uBright: { value: 1 }, uCol: { value: new THREE.Color(0x2fe0b4) } },
      vertexShader: [
        "attribute float aT;",
        "varying float vT;",
        "void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
      ].join("\n"),
      fragmentShader: [
        "uniform float uGrow, uBright;",
        "uniform vec3 uCol;",
        "varying float vT;",
        "void main(){ gl_FragColor = vec4(uCol * (step(vT, uGrow) * 0.5 * uBright), 1.0); }"
      ].join("\n"),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });

    function leafGeo(scale) {
      var pts = [], ts = [], N = 30;
      for (var i = 0; i <= N; i++) {
        var t = i / N * TAU;
        pts.push(0.5 * Math.sin(t) * scale, (0.5 - 0.5 * Math.cos(t)) * 0.55 * scale, 0);
        ts.push(i / N);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      g.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
      return g;
    }

    var leafMeshes = [];
    [[-1.35, 0.10, 0.75, 0.5, 0.9], [-2.75, 0.30, -0.75, -2.6, 1.15]].forEach(function (L) {
      var m = new THREE.Line(leafGeo(L[4]), leafMat);
      var p = stemCurve.getPointAt(clamp01((L[0] + 5.4) / 5.55));
      m.position.set(p.x + L[1], L[0], p.z);
      m.rotation.z = L[2];
      m.rotation.y = L[3];
      m.frustumCulled = false;
      scene.add(m);
      leafMeshes.push(m);
    });

    /* ============================================================
       4 · stamen + pollen
       ============================================================ */
    var stamenGroup = new THREE.Group();
    stamenGroup.position.y = FLOWER_Y + ROSE_SCALE * 0.28;
    scene.add(stamenGroup);

    var stamenHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: 0x9fe8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    stamenHalo.scale.set(2.6, 2.6, 1);
    stamenGroup.add(stamenHalo);

    var stamenCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    stamenCore.scale.set(0.75, 0.75, 1);
    stamenGroup.add(stamenCore);

    var POLLEN = isMobile ? 90 : 170;
    var pollenPos = new Float32Array(POLLEN * 3);
    var pollenSeed = new Float32Array(POLLEN);
    var pollenSize = new Float32Array(POLLEN);
    for (var pi = 0; pi < POLLEN; pi++) {
      var r = 0.12 + Math.pow(Math.random(), 0.6) * 0.80;
      var th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1);
      pollenPos[pi * 3] = r * Math.sin(ph) * Math.cos(th) * 1.15;
      pollenPos[pi * 3 + 1] = r * Math.cos(ph) * 0.85;
      pollenPos[pi * 3 + 2] = r * Math.sin(ph) * Math.sin(th) * 1.15;
      pollenSeed[pi] = Math.random();
      pollenSize[pi] = 0.022 + Math.random() * 0.05;
    }
    var pollenGeo = new THREE.BufferGeometry();
    pollenGeo.setAttribute("position", new THREE.BufferAttribute(pollenPos, 3));
    pollenGeo.setAttribute("aSeed", new THREE.BufferAttribute(pollenSeed, 1));
    pollenGeo.setAttribute("aSize", new THREE.BufferAttribute(pollenSize, 1));

    var pollenMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: TEX_GLOW }, uTime: { value: 0 },
        uOpacity: { value: 0 }, uPointScale: { value: 900 }, uBeat: { value: 0 }
      },
      vertexShader: [
        "attribute float aSeed, aSize;",
        "uniform float uTime, uOpacity, uPointScale, uBeat;",
        "varying vec3 vColor;",
        "varying float vAlpha;",
        "void main(){",
        "  vec3 p = position * (1.0 + 0.10 * uBeat) * (1.0 + 0.32 * sin(uTime * 0.7 + aSeed * 9.0));",
        "  p += vec3(sin(uTime * 1.3 + aSeed * 21.0), cos(uTime * 1.1 + aSeed * 15.0), sin(uTime * 0.9 + aSeed * 31.0)) * 0.03;",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  float d = max(0.001, -mv.z);",
        "  gl_PointSize = clamp(aSize * uPointScale / d, 1.0, 20.0);",
        "  vColor = mix(vec3(1.0, 0.92, 0.72), vec3(0.80, 0.97, 1.0), aSeed);",
        "  vAlpha = uOpacity * (0.45 + 0.35 * sin(uTime * 2.6 + aSeed * 40.0) + 0.45 * uBeat);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D uMap;",
        "varying vec3 vColor;",
        "varying float vAlpha;",
        "void main(){",
        "  float a = texture2D(uMap, gl_PointCoord).a;",
        "  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);",
        "}"
      ].join("\n"),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    });
    var pollen = new THREE.Points(pollenGeo, pollenMat);
    pollen.frustumCulled = false;
    stamenGroup.add(pollen);

    /* ============================================================
       5 · sparks
       ============================================================ */
    var BMAX = isMobile ? 700 : 1200;
    var bPos = new Float32Array(BMAX * 3);
    var bCol = new Float32Array(BMAX * 3);
    var bBase = new Float32Array(BMAX * 3);
    var bVel = new Float32Array(BMAX * 3);
    var bLife = new Float32Array(BMAX);
    var bMax = new Float32Array(BMAX);
    var bHead = 0;
    for (var bi = 0; bi < BMAX; bi++) bPos[bi * 3 + 1] = 99999;

    var bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute("color", new THREE.BufferAttribute(bCol, 3));
    var bMesh = new THREE.Points(bGeo, new THREE.PointsMaterial({
      size: 0.055, map: TEX_GLOW, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true
    }));
    bMesh.frustumCulled = false;
    scene.add(bMesh);

    var B_RGB = [[1.0, 0.65, 0.35], [1.0, 0.8, 0.58], [0.72, 0.8, 0.86], [0.84, 0.55, 0.49]];

    function spawnSparks(center, count, speed, lifeMin, lifeMax, dir) {
      for (var n = 0; n < count; n++) {
        var idx = bHead;
        bHead = (bHead + 1) % BMAX;
        var u = Math.random() * 2 - 1, th = Math.random() * TAU;
        var rr = Math.sqrt(Math.max(0, 1 - u * u));
        var dx = rr * Math.cos(th), dy = u, dz = rr * Math.sin(th);
        if (dir) {
          dx = dx * 0.40 + dir.x * 0.80;
          dy = dy * 0.40 + dir.y * 0.80;
          dz = dz * 0.40 + dir.z * 0.80;
        }
        var sp = speed * (0.35 + Math.random() * 0.95);
        var i3 = idx * 3;
        bPos[i3] = center.x; bPos[i3 + 1] = center.y; bPos[i3 + 2] = center.z;
        bVel[i3] = dx * sp; bVel[i3 + 1] = dy * sp; bVel[i3 + 2] = dz * sp;
        var c = B_RGB[(Math.random() * B_RGB.length) | 0];
        var bb = 0.5 + Math.random() * 0.5;
        bBase[i3] = c[0] * bb; bBase[i3 + 1] = c[1] * bb; bBase[i3 + 2] = c[2] * bb;
        bLife[idx] = lerp(lifeMin, lifeMax, Math.random());
        bMax[idx] = bLife[idx];
      }
      bGeo.attributes.position.needsUpdate = true;
    }

    function updateSparks(dt) {
      var pos = bGeo.attributes.position.array, col = bGeo.attributes.color.array;
      var any = false;
      for (var n = 0; n < BMAX; n++) {
        if (bLife[n] <= 0) continue;
        any = true;
        bLife[n] -= dt;
        var i3 = n * 3;
        if (bLife[n] <= 0) {
          col[i3] = col[i3 + 1] = col[i3 + 2] = 0;
          pos[i3 + 1] = 99999;
          continue;
        }
        var damp = Math.pow(0.975, dt * 60);
        bVel[i3] *= damp; bVel[i3 + 1] *= damp; bVel[i3 + 2] *= damp;
        pos[i3] += bVel[i3] * dt;
        pos[i3 + 1] += bVel[i3 + 1] * dt;
        pos[i3 + 2] += bVel[i3 + 2] * dt;
        var kk = bLife[n] / bMax[n], ff = kk * kk;
        col[i3] = bBase[i3] * ff;
        col[i3 + 1] = bBase[i3 + 1] * ff;
        col[i3 + 2] = bBase[i3 + 2] * ff;
      }
      if (any) {
        bGeo.attributes.position.needsUpdate = true;
        bGeo.attributes.color.needsUpdate = true;
      }
    }

    (function () {
      var tints = [0x362013, 0x17252f, 0x352e21];
      for (var n = 0; n < 5; n++) {
        var m = new THREE.SpriteMaterial({
          map: TEX_GLOW, color: tints[n % tints.length], transparent: true,
          opacity: 0.018 + Math.random() * 0.025,
          blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
        });
        var sp = new THREE.Sprite(m);
        sp.position.set((Math.random() - 0.5) * 16, 0.4 + (Math.random() - 0.5) * 12, -8 - Math.random() * 16);
        var sc = 16 + Math.random() * 20;
        sp.scale.set(sc, sc * (0.8 + Math.random() * 0.5), 1);
        scene.add(sp);
      }
    })();

    /* ============================================================
       6 · post processing
       ============================================================ */
    var composer = new THREE.EffectComposer(renderer);
    composer.setPixelRatio(DPR);
    composer.addPass(new THREE.RenderPass(scene, camera));
    var bloom = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 1.22, 0.52, 0.18
    );
    composer.addPass(bloom);

    var FinalShader = {
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uBeat: { value: 0 }, uAspect: { value: 1 } },
      vertexShader: [
        "varying vec2 vUv;",
        "void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D tDiffuse;",
        "uniform float uTime, uBeat, uAspect;",
        "varying vec2 vUv;",
        "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
        "void main(){",
        "  vec2 uv = vUv;",
        "  vec2 dir = uv - 0.5;",
        "  float ca = (0.0010 + uBeat * 0.0030) * (1.0 + length(dir) * 1.6);",
        "  vec3 col = vec3(0.0);",
        "  col.r = texture2D(tDiffuse, uv + dir * ca).r;",
        "  col.g = texture2D(tDiffuse, uv).g;",
        "  col.b = texture2D(tDiffuse, uv - dir * ca).b;",
        "  float vig = smoothstep(1.05, 0.24, length(dir * vec2(uAspect, 1.0)) * 1.14);",
        "  col *= mix(0.44, 1.0, vig);",
        "  float n = hash(uv * vec2(1280.0, 860.0) + fract(uTime) * 91.7);",
        "  col += (n - 0.5) * 0.026;",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    };
    var finalPass = new THREE.ShaderPass(FinalShader);
    finalPass.renderToScreen = true;
    composer.addPass(finalPass);

    /* ============================================================
       7 · audio
       ============================================================ */
    var A = { on: false, userPaused: false, music: new Audio("../media/bandao-tiehe.mp3"), attempt: 0 };
    A.music.loop = false;
    A.music.preload = "metadata";
    A.music.volume = 0.7;

    function updateMusicButton() {
      soundBtn.classList.toggle("off", !A.on);
      soundBtn.textContent = A.on ? "Ⅱ" : "▷";
      soundBtn.title = (A.on ? "暂停" : "播放") + "《半岛铁盒》";
      soundBtn.setAttribute("aria-label", soundBtn.title);
      soundBtn.setAttribute("aria-pressed", String(A.on));
    }

    function playMusic() {
      initMusicAnalysis();
      if (A.music.error) A.music.load();
      var attempt = ++A.attempt;
      A.on = true;
      updateMusicButton();
      var result = A.music.play();
      if (result && result.then) result.then(function () {
        if (attempt === A.attempt && !A.on) A.music.pause();
      }).catch(function (err) {
        if (attempt !== A.attempt) return;
        A.on = false;
        updateMusicButton();
        soundBtn.title = "点击播放《半岛铁盒》";
        console.warn("Background music could not start", err);
      });
    }

    A.music.addEventListener("error", function () {
      ++A.attempt;
      A.on = false;
      updateMusicButton();
      soundBtn.title = "《半岛铁盒》暂时无法播放，点击重试";
    });
    updateMusicButton();

    /* ============================================================
       8 · input
       ============================================================ */
    var pointers = {};
    var lastPinch = 0;
    var dragAccum = 0;
    var interacted = false;
    var hoverScale = 1, hoverTarget = 1, mouseInside = false;
    var novaT = 99;

    function firstTouch() {
      interacted = true;
      if (!A.on && !A.userPaused) playMusic();
    }

    canvas.addEventListener("pointerdown", function (e) {
      if (!editionOpened) { openExperience(); return; }
      firstTouch();
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
      dragAccum = 0;
      beginLongPress(e);
    });

    canvas.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") mouseInside = true;
      var p = pointers[e.pointerId];
      if (!p) return;
      starTrail(e);
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      var ids = Object.keys(pointers);
      if (ids.length === 1) {
        cam.yaw -= dx * 0.0042;
        cam.pitch = clamp(cam.pitch + dy * 0.0034, -0.55, 0.78);
        dragAccum += Math.abs(dx) + Math.abs(dy);
        if (dragAccum > 8) clearTimeout(longPressTimer);
      } else if (ids.length >= 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
        if (lastPinch > 0) { cam.dist=clamp(cam.dist*(lastPinch/Math.max(1,d)),8,40); storyCameraOffset=cam.dist-desiredCameraDistance; }
        lastPinch = d;
        dragAccum += 12;
        clearTimeout(longPressTimer);
      }
    });
    canvas.addEventListener("pointerenter", function () { mouseInside = true; });
    canvas.addEventListener("pointerleave", function () { mouseInside = false; });

    function supernova() {
      var c = new THREE.Vector3(0, FLOWER_Y + ROSE_SCALE * 0.35, 0);
      spawnSparks(c, isMobile ? 190 : 340, 8.5, 0.7, 2.2);
      flashEl.style.transition = "none";
      flashEl.style.opacity = "0.28";
      void flashEl.offsetWidth;
      flashEl.style.transition = "opacity 0.9s cubic-bezier(.2,.7,.2,1)";
      flashEl.style.opacity = "0";
      novaT = 0;
    }

    function releasePointer(e) {
      clearTimeout(longPressTimer);
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) lastPinch = 0;
      if (e.type === "pointerup" && !longPressFired && dragAccum < 8 && growthT > 1.2 && isFlowerHit(e)) triggerHeart();
    }
    canvas.addEventListener("pointerup", releasePointer);
    canvas.addEventListener("pointercancel", releasePointer);

    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      cam.dist = clamp(cam.dist + e.deltaY * .018, 8, 40); storyCameraOffset=cam.dist-desiredCameraDistance;
    }, { passive: false });

    soundBtn.addEventListener("click", function () {
      interacted = true;
      if (A.on) {
        ++A.attempt;
        A.on = false;
        A.userPaused = true;
        A.music.pause();
        updateMusicButton();
      } else {
        A.userPaused = false;
        playMusic();
      }
    });

    /* ============================================================
       9 · growth timeline
       ============================================================ */
    var STEM_DUR = 1.7;
    var STAGGER = 0.075;
    var OPEN_DUR = 0.95;
    var growthT = 0;
    var fired = new Array(PETALS);
    var petalCounter = 0;
    var petalOrder = petalDefs.slice().sort(function (a, b) { return b.frac - a.frac; });
    petalOrder.forEach(function (d, k) { d.start = STEM_DUR * 0.72 + k * STAGGER; });
    var bloomEnd = STEM_DUR * 0.72 + (PETALS - 1) * STAGGER + OPEN_DUR;

    var beatT = 0, lastCycle = -1, dubFired = false, BEAT = 1.18;
    var stamenT = 0;

    function envAt(x) {
      var lub = Math.exp(-Math.pow((x - 0.055) / 0.05, 2));
      var dub = 0.55 * Math.exp(-Math.pow((x - 0.26) / 0.062, 2));
      return lub + dub;
    }

    function resetGrowth() {
      growthT = 0;
      stamenT = 0;
      petalCounter = 0;
      for (var i = 0; i < PETALS; i++) {
        fired[i] = false;
        petalDefs[i].open = 0;
        openData[i * 4] = 0;
      }
      openTex.needsUpdate = true;
      stemMat.uniforms.uGrow.value = leafMat.uniforms.uGrow.value = 0;
      subEl.classList.remove("on");
      tipEl.textContent = "一段代码 · 正在长成一朵玫瑰";
    }

    replayBtn.addEventListener("click", replayExperience);

    var edgeVec = new THREE.Vector3(), dirVec = new THREE.Vector3(), centerVec = new THREE.Vector3();

    function petalEdgeWorld(def, open, out, k) {
      var tilt = lerp(def.tiltA, def.tiltB, open);
      var sc = def.scale * (0.32 + 0.68 * open);
      var u = (k / 7) * 2 - 1;
      var t = 1;
      var w = 0.50 * (0.18 + 0.82 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.78 + 0.11)), 0.7));
      var x = u * w * sc;
      var y = t * 0.95 * sc;
      var z = -u * u * 0.16 * sc - Math.pow(t, 2.1) * 0.44 * sc;
      var ca = Math.cos(tilt), sa = Math.sin(tilt);
      var qx = x, qy = y * ca - z * sa, qz = y * sa + z * ca;
      var ct = Math.cos(def.theta), st = Math.sin(def.theta);
      var px = qx * ct + qz * st + st * def.radial;
      var py = qy + def.yoff;
      var pz = -qx * st + qz * ct + ct * def.radial;
      out.set(px * ROSE_SCALE, py * ROSE_SCALE + FLOWER_Y, pz * ROSE_SCALE);
      return out;
    }

    function grow(dt) {
      growthT += dt;
      var stemGrow = clamp01(growthT / STEM_DUR);
      stemMat.uniforms.uGrow.value = stemGrow;
      leafMat.uniforms.uGrow.value = stemGrow;

      for (var i = 0; i < PETALS; i++) {
        var d = petalDefs[i];
        var o = smoothstep(d.start, d.start + OPEN_DUR, growthT);
        d.open = o;
        openData[i * 4] = Math.round(o * 255);
        openData[i * 4 + 3] = 255;
        if (!fired[i] && o > 0.04) {
          fired[i] = true;
          petalCounter++;
          centerVec.set(0, FLOWER_Y, 0);
          for (var k = 0; k <= 7; k++) {
            petalEdgeWorld(d, o, edgeVec, k);
            dirVec.copy(edgeVec).sub(centerVec).normalize();
            spawnSparks(edgeVec, isMobile ? 3 : 5, 1.4, 0.7, 1.6, dirVec);
          }
        }
      }
      openTex.needsUpdate = true;

      var stamenTarget = growthT > bloomEnd * 0.60 ? 1 : 0;
      stamenT += (stamenTarget - stamenT) * Math.min(1, dt * 1.1);

      if (growthT > bloomEnd && !subEl.classList.contains("on")) {
        subEl.classList.add("on");
        tipEl.textContent = "花开在代码里";
      }
    }

    /* ============================================================
       10 · resize + loop
       ============================================================ */
    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(DPR);
      renderer.setSize(w, h, false);
      composer.setPixelRatio(DPR);
      composer.setSize(w, h);
      finalPass.uniforms.uAspect.value = w / h;
      sizeRain();
    }
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", function () { setTimeout(resize, 220); });
    resize();

    /* ============================================================
       11 · second edition: the box, music, memories
       ============================================================ */
    var editionOpened = false, openingTime = -1, morphClock = -1, morphValue = 0;
    var storyFrame = window.RoseStory.getFrame(0, 319.4), lastStoryTime = 0, lastCueId = '';
    var storyWorld = window.RoseStoryScene.create(THREE, scene, TEX_GLOW, isMobile);
    var warmMag = new THREE.Color(0xe39289), warmCyan = new THREE.Color(0xffd39a);
    var coldMag = new THREE.Color(0x5b748f), coldCyan = new THREE.Color(0x99b7c3);
    var warmStem = new THREE.Color(0xb89a64), coldStem = new THREE.Color(0x688292);
    var warmRoom = new THREE.Color(0xb5a18a), coldRoom = new THREE.Color(0x8494a8);
    var desiredCameraDistance = 0, storyCameraOffset = 0, returnPhase = 0;
    var manualMorphTime = -1, reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var chapterButtons = document.querySelectorAll('#chapterNav button');
    var chapterTitle = document.getElementById('chapterTitle'), chapterCaption = document.getElementById('chapterCaption');
    var chapterCounter = document.getElementById('chapterCounter');
    var musicEnergy = 0, musicBass = 0, lastMusicSpark = 0;
    var analysisContext = null, musicSource = null, musicAnalyser = null, spectrum = null;
    var introEl = document.getElementById('intro');
    var openBtn = document.getElementById('openBtn');
    var heartBtn = document.getElementById('heartBtn');
    var letterDialog = document.getElementById('letterDialog');
    var letterText = document.getElementById('letterText');
    var seekEl = document.getElementById('seek');
    var audioLabel = document.getElementById('audioLabel');
    var equalizerBars = document.querySelectorAll('#equalizer i');
    var toastEl = document.getElementById('toast');
    var toastTimer = null, longPressTimer = null, longPressFired = false;
    var lastTrailTime = 0, lastUiTime = 0;
    var pointerRay = new THREE.Raycaster(), pointerNdc = new THREE.Vector2();
    var pointerPlane = new THREE.Plane(), pointerNormal = new THREE.Vector3();
    var pointerWorld = new THREE.Vector3(), flowerCenter = new THREE.Vector3(0, FLOWER_Y + 0.4, 0);

    function boxCameraDistance() { return 9.0 * Math.max(1, 0.95 / camera.aspect); }

    function notify(message) {
      toastEl.textContent = message;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2400);
    }

    function initMusicAnalysis() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        if (!analysisContext) {
          analysisContext = new AC();
          musicAnalyser = analysisContext.createAnalyser();
          musicAnalyser.fftSize = 256;
          musicAnalyser.smoothingTimeConstant = 0.76;
          spectrum = new Uint8Array(musicAnalyser.frequencyBinCount);
          musicSource = analysisContext.createMediaElementSource(A.music);
          musicSource.connect(musicAnalyser);
          musicAnalyser.connect(analysisContext.destination);
        }
        if (analysisContext.state === 'suspended') {
          var resumed = analysisContext.resume();
          if (resumed && resumed.catch) resumed.catch(function () {});
        }
      } catch (err) {
        if (musicSource && analysisContext) {
          try { musicSource.disconnect(); musicSource.connect(analysisContext.destination); } catch (ignored) {}
        }
        musicAnalyser = null;
        console.warn('Audio visualization is unavailable', err);
      }
    }

    function musicTime(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
      return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
    }

    function updateMusicVisualization(dt) {
      var level = 0, bass = 0;
      if (musicAnalyser && A.on && !A.music.paused && analysisContext.state === 'running') {
        musicAnalyser.getByteFrequencyData(spectrum);
        for (var k = 2; k < 55; k++) level += spectrum[k] / 255;
        for (var low = 2; low < 12; low++) bass += spectrum[low] / 255;
        level = Math.min(1, level / 53 * 1.3);
        bass = Math.min(1, bass / 10);
      }
      musicEnergy += (level - musicEnergy) * Math.min(1, dt * (level > musicEnergy ? 10 : 4));
      musicBass += (bass - musicBass) * Math.min(1, dt * 9);
      if (editionOpened && growthT > bloomEnd && bass - musicBass > 0.12 && time - lastMusicSpark > 0.45) {
        spawnSparks(flowerCenter, isMobile ? 5 : 9, 0.9, 0.5, 1.1);
        lastMusicSpark = time;
      }
      if (time - lastUiTime > 0.1) {
        lastUiTime = time;
        for (var bar = 0; bar < equalizerBars.length; bar++) {
          var bin = spectrum && !A.music.paused ? spectrum[3 + bar * 7] / 255 : 0;
          equalizerBars[bar].style.height = (4 + bin * 24) + 'px';
        }
        document.getElementById('currentTime').textContent = musicTime(A.music.currentTime);
        if (Number.isFinite(A.music.duration)) {
          document.getElementById('duration').textContent = musicTime(A.music.duration);
          if (document.activeElement !== seekEl) seekEl.value = A.music.currentTime / A.music.duration * 100;
        }
        audioLabel.textContent = A.music.paused ? (A.userPaused ? '已暂停' : '点击播放') : '随音乐呼吸';
      }
    }

    function boxLabelTexture() {
      var label = document.createElement('canvas');
      label.width = 1024; label.height = 512;
      var g = label.getContext('2d');
      g.fillStyle = '#3e3529'; g.fillRect(0, 0, 1024, 512);
      g.strokeStyle = 'rgba(183,154,109,.45)'; g.lineWidth = 3;
      g.strokeRect(28, 28, 968, 456);
      g.strokeRect(43, 43, 938, 426);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#c9af84'; g.font = '300 63px Georgia,serif';
      g.fillText('THE THINGS WE KEEP', 512, 227);
      g.fillStyle = '#927b58'; g.font = '24px monospace';
      g.fillText('CODE ROSE  /  03', 512, 308);
      for (var s = 0; s < 45; s++) {
        var x = 70 + Math.random() * 884, y = 70 + Math.random() * 372;
        g.fillStyle = 'rgba(194,168,116,' + (0.08 + Math.random() * 0.14) + ')';
        g.fillRect(x, y, 2, 2);
      }
      var texture = new THREE.CanvasTexture(label);
      texture.needsUpdate = true;
      return texture;
    }

    var ironBox = new THREE.Group();
    var ironMat = new THREE.MeshStandardMaterial({ color: 0xa19077, map:storyWorld.rustTexture, metalness: 0.32, roughness: 0.9, emissive: 0x120b05, emissiveIntensity: 0.08 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x14100b, metalness: 0.15, roughness: 1.0 });
    var rimMat = new THREE.LineBasicMaterial({ color: 0xb69b72, transparent: true, opacity: 0.25 });
    var bodyGeo = new THREE.BoxGeometry(3.9, 0.12, 2.6);
    var boxBody = new THREE.Mesh(bodyGeo, ironMat);
    boxBody.position.y = -0.68; ironBox.add(boxBody);
    [[3.9,.88,.12,0,-.28,-1.24],[3.9,.88,.12,0,-.28,1.24],[.12,.88,2.36,-1.89,-.28,0],[.12,.88,2.36,1.89,-.28,0]].forEach(function (d) {
      var wall = new THREE.Mesh(new THREE.BoxGeometry(d[0],d[1],d[2]),ironMat);
      wall.position.set(d[3],d[4],d[5]); ironBox.add(wall);
    });
    var bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), rimMat);
    bodyEdges.position.copy(boxBody.position); ironBox.add(bodyEdges);
    var inner = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.06, 2.35), darkMat);
    inner.position.y = -0.60; ironBox.add(inner);
    var lidHinge = new THREE.Group();
    lidHinge.position.set(0, 0.24, -1.3); ironBox.add(lidHinge);
    var lidGeo = new THREE.BoxGeometry(4.0, 0.20, 2.7);
    var lid = new THREE.Mesh(lidGeo, ironMat);
    lid.position.set(0, 0.10, 1.3); lidHinge.add(lid);
    var lidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(lidGeo), rimMat);
    lidEdges.position.copy(lid.position); lidHinge.add(lidEdges);
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.28), new THREE.MeshBasicMaterial({ map: boxLabelTexture() }));
    plaque.rotation.x = -Math.PI / 2; plaque.position.set(0, 0.204, 1.3); lidHinge.add(plaque);
    var clasp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.07), ironMat);
    clasp.position.set(0, 0.22, 1.36); ironBox.add(clasp);
    var boxGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_GLOW, color: 0xffc68a, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false }));
    boxGlow.position.y = 0.4; boxGlow.scale.set(5.2, 3.6, 1); ironBox.add(boxGlow);
    var lockHole = new THREE.Mesh(new THREE.CircleGeometry(.064, 18), new THREE.MeshBasicMaterial({ color:0x0a0806 }));
    lockHole.position.set(0,.24,1.402); ironBox.add(lockHole);
    var lockStem = new THREE.Mesh(new THREE.PlaneGeometry(.045,.08), lockHole.material);
    lockStem.position.set(0,.19,1.402); ironBox.add(lockStem);
    var holeLight = new THREE.Sprite(new THREE.SpriteMaterial({map:TEX_GLOW,color:0xffcc84,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    holeLight.position.set(0,.23,1.45); holeLight.scale.set(.45,.8,1); ironBox.add(holeLight);
    scene.add(ironBox);
    var roomLight = new THREE.AmbientLight(0xb5a18a, 0.45); scene.add(roomLight);
    var keyLight = new THREE.DirectionalLight(0xffd7a5, 0.8);
    keyLight.position.set(5, 8, 7); scene.add(keyLight);
    var pinkLight = new THREE.PointLight(0xddb790, 0.4, 45);
    pinkLight.position.set(-5, 3, 4); scene.add(pinkLight);
    var orbitGeo = new THREE.BufferGeometry(), orbitPositions = new Float32Array((isMobile ? 75 : 140) * 3);
    for (var op = 0; op < orbitPositions.length / 3; op++) {
      var oa = Math.random() * TAU, radius = 2.9 + Math.random() * 1.9;
      orbitPositions[op * 3] = Math.cos(oa) * radius;
      orbitPositions[op * 3 + 1] = (Math.random() - 0.5) * 2.0;
      orbitPositions[op * 3 + 2] = Math.sin(oa) * radius;
    }
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    var boxOrbit = new THREE.Points(orbitGeo, new THREE.PointsMaterial({ map: TEX_GLOW, color: 0xbdad92, size: 0.028, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(boxOrbit);

    function openExperience() {
      if (editionOpened) return;
      editionOpened = true;
      openingTime = 0;
      morphClock = -1;
      morphValue = 0;
      manualMorphTime = -1;
      storyCameraOffset = 0;
      resetGrowth();
      document.body.classList.add('opened');
      document.querySelector('.ui').removeAttribute('inert');
      document.querySelector('.music-panel').removeAttribute('inert');
      introEl.classList.add('leaving');
      setTimeout(function () { if (editionOpened) introEl.hidden = true; }, 1100);
      firstTouch();
    }

    function replayExperience() {
      clearTimeout(longPressTimer);
      ++A.attempt;
      A.on = false; A.userPaused = false;
      A.music.pause(); A.music.currentTime = 0;
      updateMusicButton();
      editionOpened = false; openingTime = -1; morphClock = -1; morphValue = 0;
      heartBtn.disabled = false;
      introEl.hidden = false; introEl.classList.remove('leaving');
      document.body.classList.remove('opened', 'story-ended');
      lastCueId = ''; lastStoryTime = 0; manualMorphTime = -1; storyCameraOffset = 0; storyWorld.reset();
      storyFrame = window.RoseStory.getFrame(0, A.music.duration);
      updateChapterCopy();
      document.querySelector('.ui').setAttribute('inert', '');
      document.querySelector('.music-panel').setAttribute('inert', '');
      resetGrowth();
      LOOK.y = -0.5; cam.dist = boxCameraDistance(); cam.pitch = 0.26; cam.yaw = 0.50; autoYaw = 0;
      updateCamera();
    }

    function triggerHeart() {
      if (!editionOpened || storyFrame.growth < 0.85 || storyFrame.dissolve > 0.55) {
        notify('在温暖的回忆里，玫瑰才会化成心。');
        return;
      }
      if (morphClock >= 0) return;
      morphClock = 0; manualMorphTime = A.music.currentTime;
      heartBtn.disabled = true;
      spawnSparks(flowerCenter, isMobile ? 24 : 40, 1.5, 0.7, 1.7);
      notify('那一点温暖，曾经很完整。');
    }

    function openLetter() {
      if (!editionOpened) return;
      if (letterDialog.open) return;
      var content = null;
      try { content = localStorage.getItem('code-rose-letter-v2'); } catch (ignored) {}
      letterText.value = content === null ? '' : content;
      if (window.RoseDiary) window.RoseDiary.open();
      if (letterDialog.showModal) letterDialog.showModal();
      else letterDialog.setAttribute('open', '');
    }

    function closeLetter() {
      if (letterDialog.close) letterDialog.close();
      else letterDialog.removeAttribute('open');
    }

    function worldAtPointer(e, center) {
      var bounds = canvas.getBoundingClientRect();
      pointerNdc.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -(e.clientY - bounds.top) / bounds.height * 2 + 1);
      camera.getWorldDirection(pointerNormal);
      pointerPlane.setFromNormalAndCoplanarPoint(pointerNormal, center || LOOK);
      pointerRay.setFromCamera(pointerNdc, camera);
      return pointerRay.ray.intersectPlane(pointerPlane, pointerWorld);
    }

    function isFlowerHit(e) {
      var point = worldAtPointer(e, flowerCenter);
      return point && point.distanceTo(flowerCenter) < 3.0;
    }

    function starTrail(e) {
      if (!editionOpened || morphClock >= 0 || performance.now() - lastTrailTime < 24) return;
      var point = worldAtPointer(e);
      if (!point) return;
      lastTrailTime = performance.now();
      storyWorld.wipe(point);
      if (storyFrame.warmth > 0.5) spawnSparks(point, isMobile ? 2 : 4, 0.2, 0.7, 1.35);
    }

    function beginLongPress(e) {
      clearTimeout(longPressTimer);
      longPressFired = false;
      if (!editionOpened || !isFlowerHit(e)) return;
      longPressTimer = setTimeout(function () {
        if (dragAccum < 8 && Object.keys(pointers).length === 1) {
          longPressFired = true;
          openLetter();
        }
      }, 720);
    }

    function saveMoment() {
      if (!editionOpened) return;
      composer.render();
      var photo = document.createElement('canvas');
      photo.width = canvas.width; photo.height = canvas.height;
      var g = photo.getContext('2d');
      g.drawImage(canvas, 0, 0);
      var px = photo.width / window.innerWidth;
      g.fillStyle = 'rgba(194,228,225,.7)';
      g.font = Math.round(11 * px) + 'px sans-serif';
      g.fillText('CODE ROSE  /  03', 30 * px, 38 * px);
      g.fillStyle = 'rgba(180,223,214,.68)';
      g.font = Math.round(12 * px) + 'px sans-serif';
      g.textAlign = 'center';
      g.fillText('半岛铁盒 · ' + storyFrame.title, photo.width / 2, photo.height - 34 * px);
      photo.toBlob(function (blob) {
        if (!blob) { notify('这次保存未成功，请再试一次。'); return; }
        var url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = 'code-rose-third-edition-' + Date.now() + '.png';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        notify('这一刻，已保存成图片。');
      }, 'image/png');
    }

    openBtn.addEventListener('click', openExperience);
    heartBtn.addEventListener('click', triggerHeart);
    document.getElementById('letterBtn').addEventListener('click', openLetter);
    document.getElementById('closeLetterBtn').addEventListener('click', closeLetter);
    document.getElementById('saveLetterBtn').addEventListener('click', function () {
      try { localStorage.setItem('code-rose-letter-v2', letterText.value); }
      catch (err) { notify('当前浏览器无法保存；这封信仍留在页面里。'); return; }
      closeLetter(); notify('这封信，已经藏好了。');
    });
    letterDialog.addEventListener('click', function (e) {
      if (e.target !== letterDialog) return;
      var rect = letterDialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeLetter();
    });
    document.getElementById('saveBtn').addEventListener('click', saveMoment);
    seekEl.addEventListener('input', function () {
      if (Number.isFinite(A.music.duration)) A.music.currentTime = A.music.duration * Number(seekEl.value) / 100;
    });
    A.music.addEventListener('loadedmetadata', function () { document.getElementById('duration').textContent = musicTime(A.music.duration); });
    A.music.addEventListener('ended', function () {
      A.on = false; A.userPaused = true; updateMusicButton();
      document.body.classList.add('story-ended');
    });
    chapterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var chapter = window.RoseStory.chapters.filter(function (item) { return item.id === button.getAttribute('data-chapter'); })[0];
        if (!chapter) return;
        var length = Number.isFinite(A.music.duration) ? A.music.duration : window.RoseStory.duration;
        A.music.currentTime = chapter.at / window.RoseStory.duration * length;
        manualMorphTime = -1; morphClock = -1; morphValue = 0;
        updateEdition(0); applyStoryGrowth();
      });
    });
    document.getElementById('endingSaveBtn').addEventListener('click', saveMoment);
    document.getElementById('endingReplayBtn').addEventListener('click', function () { replayExperience(); openExperience(); });

    function updateChapterCopy() {
      document.body.setAttribute('data-chapter', storyFrame.chapterId);
      chapterTitle.textContent = storyFrame.title; chapterCaption.textContent = storyFrame.caption;
      chapterCounter.textContent = String(storyFrame.chapterIndex + 1).padStart(2,'0') + ' / 06';
      chapterButtons.forEach(function (button) {
        if (button.getAttribute('data-chapter') === storyFrame.chapterId) button.setAttribute('aria-current','step');
        else button.removeAttribute('aria-current');
      });
      document.body.classList.toggle('story-ended', editionOpened && storyFrame.close > .96);
    }

    function applyStoryGrowth() {
      growthT = storyFrame.growth * bloomEnd;
      var stemGrow = smoothstep(0, .23, storyFrame.growth) * (1-returnPhase);
      stemMat.uniforms.uGrow.value = leafMat.uniforms.uGrow.value = stemGrow;
      for (var i = 0; i < PETALS; i++) {
        var def = petalDefs[i];
        def.open = smoothstep(def.start, def.start + OPEN_DUR, growthT);
        openData[i*4] = Math.round(def.open*255); openData[i*4+3] = 255;
      }
      openTex.needsUpdate = true;
      stamenT = smoothstep(.55, .9, storyFrame.growth) * (1-storyFrame.dissolve);
    }

    function updateEdition(dt) {
      updateMusicVisualization(dt);
      var songTime = editionOpened ? A.music.currentTime : 0;
      storyFrame = window.RoseStory.getFrame(songTime, A.music.duration);
      if (Math.abs(songTime-lastStoryTime)>1.2) {
        manualMorphTime = -1; morphClock = -1; morphValue = 0;
        for (var spark=0;spark<BMAX;spark++) { bLife[spark]=0; bCol[spark*3]=bCol[spark*3+1]=bCol[spark*3+2]=0; bPos[spark*3+1]=99999; }
        bGeo.attributes.color.needsUpdate = bGeo.attributes.position.needsUpdate = true;
      }
      lastStoryTime = songTime;
      if (editionOpened) openingTime += dt;
      var canonical = storyFrame.time / storyFrame.duration * window.RoseStory.duration;
      var reveal = editionOpened ? smoothstep(42,53,canonical) * (1-storyFrame.close) : 0;
      returnPhase = storyFrame.chapterId === 'ending' ? smoothstep(0,.64,storyFrame.phase) : 0;
      var opened = editionOpened ? smoothstep(38,49,canonical) * (1-storyFrame.close) : 0;
      lidHinge.rotation.x = -1.88 * opened;
      ironBox.position.set(.55*(1-reveal),lerp(-.75,-5.35,reveal),0);
      ironBox.scale.setScalar(lerp(.92,.78,reveal));
      ironBox.rotation.y = 0;
      boxGlow.material.opacity = .025 + opened*.075*(1-storyFrame.close);
      holeLight.material.opacity = editionOpened ? smoothstep(31,37,canonical)*(1-smoothstep(44,50,canonical))*.55 : .02;
      boxOrbit.position.copy(ironBox.position);
      boxOrbit.material.opacity = .04 + storyFrame.dust*.08;
      desiredCameraDistance = lerp(boxCameraDistance(),17.5,reveal);
      cam.dist = clamp(desiredCameraDistance + storyCameraOffset,8,40);
      LOOK.y = lerp(-.4,.3,reveal);
      if (manualMorphTime >= 0) {
        morphClock = Math.max(0,songTime-manualMorphTime);
        if (morphClock < 1.6) morphValue = smoothstep(0,1.6,morphClock);
        else if (morphClock < 3.7) morphValue = 1;
        else morphValue = 1-smoothstep(3.7,6.3,morphClock);
        if (morphClock >= 6.3) { manualMorphTime = -1; morphClock = -1; morphValue = 0; }
      }
      morphValue = Math.max(manualMorphTime >= 0 ? morphValue : 0,storyFrame.heart);
      heartBtn.disabled = manualMorphTime >= 0;
      sharedUniforms.uMorph.value = morphValue;
      sharedUniforms.uDissolve.value = storyFrame.dissolve;
      sharedUniforms.uReturn.value = returnPhase;
      sharedUniforms.uRain.value = storyFrame.rain;
      sharedUniforms.uPetalAlpha.value = 1-smoothstep(.86,.995,returnPhase);
      sharedUniforms.uBoxTarget.value.copy(ironBox.position); sharedUniforms.uBoxTarget.value.y += .1;
      sharedUniforms.uMag.value.copy(coldMag).lerp(warmMag,storyFrame.warmth);
      sharedUniforms.uCyan.value.copy(coldCyan).lerp(warmCyan,storyFrame.warmth);
      lineMesh.visible = ptMesh.visible = editionOpened && storyFrame.growth>.001 && returnPhase<.995;
      stem.visible = editionOpened && morphValue<.55 && returnPhase<.65 && storyFrame.growth>.01;
      leafMeshes.forEach(function (leaf) { leaf.visible = stem.visible; });
      leafMat.uniforms.uBright.value = (.55 + musicEnergy*.3)*(1-storyFrame.dissolve);
      stemMat.uniforms.uCol.value.copy(coldStem).lerp(warmStem,storyFrame.warmth);
      leafMat.uniforms.uCol.value.copy(stemMat.uniforms.uCol.value);
      roomLight.color.copy(coldRoom).lerp(warmRoom,storyFrame.warmth);
      keyLight.color.copy(coldCyan).lerp(warmCyan,storyFrame.warmth);
      keyLight.intensity = .55 + storyFrame.warmth*.3;
      pinkLight.intensity = .15 + storyFrame.warmth*.3;
      storyWorld.update(storyFrame,canonical,dt,ironBox.position,!editionOpened);
      if (lastCueId !== storyFrame.cueId) { lastCueId=storyFrame.cueId; updateChapterCopy(); }
      document.body.classList.toggle('story-ended',editionOpened && storyFrame.close>.96);
      if (time-lastUiTime < .12) {
        document.body.style.setProperty('--story-warmth',storyFrame.warmth.toFixed(3));
        document.body.style.setProperty('--story-rain',storyFrame.rain.toFixed(3));
        document.body.style.setProperty('--story-dust',storyFrame.dust.toFixed(3));
      }
    }

    LOOK.y = -0.5; cam.dist = boxCameraDistance(); cam.pitch = 0.26; cam.yaw = 0.50;
    updateCamera();


    var clock = new THREE.Clock();
    var time = 0;

    function tick() {
      requestAnimationFrame(tick);
      var dt = Math.min(clock.getDelta(), 0.05);
      if (document.hidden) return;
      time += dt;

      updateEdition(dt);
      applyStoryGrowth();

      /* heartbeat */
      beatT += dt;
      var bx = (beatT % BEAT) / BEAT;
      var cyc = Math.floor(beatT / BEAT);
      var beat = envAt(bx);
      if (stamenT > 0.35) {
        if (cyc !== lastCycle) { lastCycle = cyc; dubFired = false; }
        if (!dubFired && bx > 0.26) { dubFired = true; }
      }
      var heart = musicEnergy * stamenT;

      novaT += dt;
      var nova = Math.exp(-Math.pow(novaT / 0.30, 2));

      hoverTarget = (mouseInside && !Object.keys(pointers).length) ? 1.05 : 1;
      hoverScale += (hoverTarget - hoverScale) * Math.min(1, dt * 2.2);

      var breathe = 1 + Math.sin(A.music.currentTime * 0.85) * 0.008 + musicBass * 0.025;
      var roseS = hoverScale * breathe * (1 + nova * 0.05);
      lineMat.uniforms.uRoseScale.value = ROSE_SCALE * roseS;
      pointMat.uniforms.uRoseScale.value = ROSE_SCALE * roseS;

      var bright = .45 + storyFrame.warmth*.3 + heart*.4 + nova*.2;
      lineMat.uniforms.uBright.value = bright;
      pointMat.uniforms.uBright.value = bright;
      lineMat.uniforms.uTime.value = A.music.currentTime;
      pointMat.uniforms.uTime.value = A.music.currentTime;
      stemMat.uniforms.uBright.value = (.5 + heart*.4)*(1-storyFrame.dissolve);

      stamenGroup.visible = editionOpened && morphValue < 0.45 && stamenT > 0.01 && returnPhase < .25;
      if (stamenGroup.visible) {
        stamenGroup.scale.setScalar(hoverScale * (1 + heart * 0.06 + nova * 0.2));
        stamenCore.material.opacity = (.14 + heart*.10)*stamenT;
        stamenCore.scale.set(0.75 + heart * 0.34 + nova * 0.5, 0.75 + heart * 0.34 + nova * 0.5, 1);
        stamenHalo.material.opacity = (.08 + heart*.16)*stamenT;
        stamenHalo.material.color.copy(sharedUniforms.uCyan.value);
        stamenHalo.scale.set(2.6 + heart * 1.1 + nova * 2.4, 2.6 + heart * 1.1 + nova * 2.4, 1);
        pollenMat.uniforms.uTime.value = A.music.currentTime;
        pollenMat.uniforms.uOpacity.value = stamenT * (0.5 + heart * 0.5);
        pollenMat.uniforms.uBeat.value = heart;
      }

      rainGroup.position.copy(camera.position);
      rainGroup.quaternion.copy(camera.quaternion);
      for (var r = 0; r < rainPlanes.length; r++) {
        rainPlanes[r].tex.offset.y = -(A.music.currentTime * rainPlanes[r].speed) % 1;
        if (rainPlanes[r].tex.offset.y < -1) rainPlanes[r].tex.offset.y += 1;
        rainPlanes[r].mesh.material.opacity = rainPlanes[r].base * .10 * (.25 + storyFrame.warmth*.3);
      }

      updateSparks(dt);

      autoYaw = reducedMotion ? 0 : Math.sin(A.music.currentTime*.016)*.065;
      updateCamera();
      camera.updateMatrixWorld();
      sharedUniforms.uHeartRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
      sharedUniforms.uHeartUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
      sharedUniforms.uHeartForward.value.setFromMatrixColumn(camera.matrixWorld, 2);

      var db = renderer.getDrawingBufferSize(new THREE.Vector2());
      var ps = db.y / (2 * Math.tan((camera.fov * Math.PI / 180) / 2));
      pointMat.uniforms.uPointScale.value = ps;
      pollenMat.uniforms.uPointScale.value = ps;

      bloom.strength = .30 + storyFrame.warmth*.22 + heart*.12 + nova*.15;
      finalPass.uniforms.uTime.value = A.music.currentTime;
      finalPass.uniforms.uBeat.value = heart * 0.6 + nova * 0.4;

      composer.render();
    }

    tick();

    setTimeout(function () {
      if (editionOpened && growthT < bloomEnd) tipEl.textContent = "花瓣正在一层层展开";
    }, 3000);
  })();
