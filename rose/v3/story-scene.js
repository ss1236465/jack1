(function (root) {
  'use strict';
  root.RoseStoryScene = {
    create: function (THREE, scene, glow, mobile) {
      function texture(width, height, paint) {
        var c = document.createElement('canvas'); c.width = width; c.height = height;
        paint(c.getContext('2d'), width, height);
        return new THREE.CanvasTexture(c);
      }
      var rust = texture(512, 512, function (g, w, h) {
        g.fillStyle = '#665344'; g.fillRect(0, 0, w, h);
        for (var i = 0; i < 3200; i++) {
          var r = 1 + Math.random() * 13;
          g.fillStyle = ['rgba(57,38,25,.16)', 'rgba(163,102,49,.10)', 'rgba(179,159,120,.10)'][i % 3];
          g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = 'rgba(211,188,140,.15)'; g.lineWidth = 1;
        for (var j = 0; j < 50; j++) { var x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 35, y + 1); g.stroke(); }
      });
      var wood = texture(1024, 512, function (g, w, h) {
        g.fillStyle = '#20150f'; g.fillRect(0, 0, w, h);
        for (var i = 0; i < 600; i++) {
          g.strokeStyle = i % 3 ? 'rgba(103,71,40,.15)' : 'rgba(10,7,5,.35)';
          g.lineWidth = 0.5 + Math.random() * 2;
          var y = Math.random() * h;
          g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 8, w * .6, y - 6, w, y + 2); g.stroke();
        }
      });
      var paper = texture(512, 768, function (g, w, h) {
        g.fillStyle = '#b4a184'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#c6b699'; g.fillRect(24, 24, w - 48, h - 48);
        g.fillStyle = '#70604b'; g.font = '22px Georgia,serif'; g.textAlign = 'center';
        g.fillText('A PAGE TO REMEMBER', w / 2, 112);
        g.font = '16px serif'; g.fillText('留给时间的一页', w / 2, 157);
        g.strokeStyle = 'rgba(94,76,53,.19)';
        for (var y = 220; y < 650; y += 41) { g.beginPath(); g.moveTo(70, y); g.lineTo(w - 65, y); g.stroke(); }
        g.fillStyle = '#8d7759'; g.font = '15px serif'; g.fillText('03', w / 2, 703);
      });
      var cover = texture(512, 768, function (g, w, h) {
        g.fillStyle = '#342f26'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#8b7250'; g.lineWidth = 3; g.strokeRect(30, 35, w - 60, h - 70);
        g.strokeStyle = 'rgba(164,137,92,.3)'; g.strokeRect(42, 47, w - 84, h - 94);
        g.fillStyle = '#bda47d'; g.textAlign = 'center'; g.font = '36px serif'; g.fillText('旧 日 记', w / 2, 293);
        g.font = '16px Georgia,serif'; g.fillText('THE THINGS WE KEEP', w / 2, 350);
        g.font = '18px Georgia,serif'; g.fillText('III', w / 2, 595);
      });
      var desk = new THREE.Group(); scene.add(desk);
      var tableMat = new THREE.MeshStandardMaterial({ color:0x8f7961, map:wood, roughness:1, metalness:0 });
      var table = new THREE.Mesh(new THREE.BoxGeometry(8.7, .2, 4.7), tableMat);
      table.position.set(0, -1.65, -.05); desk.add(table);
      var book = new THREE.Group(); book.position.set(-2.65, -1.5, .12); book.rotation.y = -.18; book.scale.setScalar(.85); desk.add(book);
      var bindingMat = new THREE.MeshStandardMaterial({ color:0x373126, roughness:1 });
      var pagesMat = new THREE.MeshStandardMaterial({ color:0xd6c5a2, roughness:1 });
      var back = new THREE.Mesh(new THREE.BoxGeometry(1.7, .07, 2.35), bindingMat); book.add(back);
      var block = new THREE.Mesh(new THREE.BoxGeometry(1.55, .2, 2.19), pagesMat); block.position.y = .13; book.add(block);
      var pageMat = new THREE.MeshStandardMaterial({ map:paper, side:THREE.DoubleSide, roughness:1,transparent:true });
      var flatPage = new THREE.Mesh(new THREE.PlaneGeometry(1.54, 2.18), pageMat); flatPage.rotation.x = -Math.PI / 2; flatPage.position.y = .237; book.add(flatPage);
      var spine = new THREE.Group(); spine.position.set(-.85, .27, 0); book.add(spine);
      var front = new THREE.Mesh(new THREE.BoxGeometry(1.7, .065, 2.35), bindingMat); front.position.x = .85; spine.add(front);
      var coverLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 2.33), new THREE.MeshStandardMaterial({ map:cover, roughness:1 }));
      coverLabel.rotation.x = -Math.PI / 2; coverLabel.position.set(.85, .035, 0); spine.add(coverLabel);
      var turningPages = [];
      for (var pg = 0; pg < 3; pg++) {
        var hinge = new THREE.Group(); hinge.position.set(-.77, .25 + pg * .007, 0);
        var sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.54, 2.18), pageMat);
        sheet.rotation.x = -Math.PI / 2; sheet.position.x = .77; hinge.add(sheet); book.add(hinge); turningPages.push(hinge);
      }
      var lamp = new THREE.Group(); lamp.position.set(3.2, -1.52, -1.1); desk.add(lamp);
      var brass = new THREE.MeshStandardMaterial({ color:0x725c3f, roughness:.6, metalness:.5 });
      var base = new THREE.Mesh(new THREE.CylinderGeometry(.5, .6, .12, 24), brass); lamp.add(base);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(.055, .07, 2.7, 12), brass); pole.position.y = 1.4; lamp.add(pole);
      var shade = new THREE.Mesh(new THREE.ConeGeometry(.72, .74, 32, 1, true), new THREE.MeshStandardMaterial({ color:0x958063, side:THREE.DoubleSide, roughness:.9 }));
      shade.position.y = 2.75; lamp.add(shade);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), new THREE.MeshBasicMaterial({ color:0xffd394 })); bulb.position.y = 2.5; lamp.add(bulb);
      var lamplight = new THREE.PointLight(0xffcd86, 2.1, 14, 1.2); lamplight.position.set(0, 2.45, 0); lamp.add(lamplight);
      var lampHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:0xe9a65d, opacity:.2, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
      lampHalo.scale.set(2.8, 2.8, 1); lampHalo.position.y = 2.4; lamp.add(lampHalo);

      var windowGroup = new THREE.Group(); windowGroup.position.set(0, 1, -6.8); scene.add(windowGroup);
      var frameMat = new THREE.MeshBasicMaterial({ color:0x41505b, transparent:true, opacity:.2 });
      [[0,5,9.5,.055], [0,-5,9.5,.055], [-4.75,0,.055,10], [4.75,0,.055,10], [0,0,.035,10], [0,.7,9.5,.035]].forEach(function (d) {
        var edge = new THREE.Mesh(new THREE.BoxGeometry(d[2], d[3], .08), frameMat); edge.position.set(d[0], d[1], 0); windowGroup.add(edge);
      });
      var drops = mobile ? 110 : 220, rainPos = new Float32Array(drops * 6), rainSeeds = [];
      for (var dr = 0; dr < drops; dr++) rainSeeds.push([Math.random() * 9.2 - 4.6, Math.random() * 10, .3 + Math.random() * .7]);
      var rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
      var rainMat = new THREE.LineBasicMaterial({ color:0x849eac, transparent:true, opacity:0, depthWrite:false });
      var rainLines = new THREE.LineSegments(rainGeo, rainMat); windowGroup.add(rainLines);
      var mist = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:0x344d64, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
      mist.position.set(-2, 1, -6.4); mist.scale.set(25, 24, 1); scene.add(mist);

      var dustCount = mobile ? 110 : 220, dustPos = new Float32Array(dustCount * 3), dustSeeds = [];
      for (var p = 0; p < dustCount; p++) dustSeeds.push([Math.random() * 10 - 5, Math.random() * 7 - 3, Math.random() * 6 - 3, Math.random() * Math.PI * 2]);
      var dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      var dustMat = new THREE.PointsMaterial({ map:glow, color:0xc5ae85, transparent:true, opacity:.45, size:.045, depthWrite:false, blending:THREE.AdditiveBlending });
      var dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
      var wipePoint = new THREE.Vector3(999, 999, 999), wipeStrength = 0;
      var lastPetal = new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 12), new THREE.MeshBasicMaterial({ color:0xe2ad77, transparent:true, opacity:0 }));
      lastPetal.scale.set(.65, .18, 1.4); scene.add(lastPetal);
      var savedGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:0xffbd6d, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false,depthTest:false }));
      savedGlow.scale.set(1.1, .4, 1); scene.add(savedGlow);
      var pageLightPos = new Float32Array(90*3), pageLightSeeds = [];
      for (var pl=0;pl<90;pl++) pageLightSeeds.push([Math.random(),Math.random(),Math.random()]);
      var pageLightGeo = new THREE.BufferGeometry(); pageLightGeo.setAttribute('position',new THREE.BufferAttribute(pageLightPos,3));
      var pageLightMat = new THREE.PointsMaterial({map:glow,color:0xd9c5a0,size:.025,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
      var pageLight = new THREE.Points(pageLightGeo,pageLightMat); pageLight.frustumCulled=false; book.add(pageLight);
      return {
        rustTexture:rust,
        wipe:function (point) { wipePoint.copy(point); wipeStrength = 1; },
        reset:function () { wipeStrength = 0; },
        update:function (frame, seconds, dt, boxPosition, intro) {
          var boxOffset = boxPosition.y + .75;
          desk.position.y = boxOffset;
          // The room stays spatially stable; the book only moves with its tabletop.
          spine.rotation.z = frame.bookOpen * 2.75;
          turningPages.forEach(function (hinge, index) {
            var cycle = Math.max(0, seconds - 17 - index * 1.9);
            var turn = .5 - .5 * Math.cos(Math.min(1, cycle / 8) * Math.PI);
            hinge.rotation.z = frame.bookOpen * turn * (2.6 - index * .045);
          });
          var memoryFade = frame.chapterId==='memory' ? frame.phase : 0;
          pageMat.opacity = 1-memoryFade*.7;
          pageLightMat.opacity = memoryFade*.65;
          for (var gl=0;gl<90;gl++) {
            var gs=pageLightSeeds[gl], travel=(gs[1]+seconds*.09)%1;
            pageLightPos[gl*3]=(gs[0]-.5)*1.5+Math.sin(gs[2]*12+seconds*.12)*memoryFade*.7;
            pageLightPos[gl*3+1]=.28+travel*memoryFade*2;
            pageLightPos[gl*3+2]=(gs[2]-.5)*2.1;
          }
          pageLightGeo.attributes.position.needsUpdate=true;
          lamplight.intensity = .55 + frame.warmth * 1.8;
          lampHalo.material.opacity = .04 + frame.warmth * .15;
          frameMat.opacity = .07 + frame.rain * .26;
          rainMat.opacity = frame.rain * .33;
          mist.material.opacity = frame.rain * .2;
          for (var r = 0; r < drops; r++) {
            var seed = rainSeeds[r], y = 5 - ((seed[1] + seconds * seed[2] * 1.8) % 10);
            var at = r * 6;
            rainPos[at] = seed[0]; rainPos[at+1] = y; rainPos[at+2] = .09;
            rainPos[at+3] = seed[0] - .04 * frame.rain; rainPos[at+4] = y - .12 - seed[2] * .18; rainPos[at+5] = .09;
          }
          rainGeo.attributes.position.needsUpdate = true;
          wipeStrength = Math.max(0, wipeStrength - dt * .65);
          dustMat.opacity = .1 + frame.dust * .42;
          dustMat.color.setHex(frame.warmth > .5 ? 0xc5ae85 : 0x8b9ba3);
          for (var d = 0; d < dustCount; d++) {
            var a = dustSeeds[d], x = a[0] + Math.sin(seconds * .075 + a[3]) * .25;
            var yy = a[1] + Math.cos(seconds * .09 + a[3]) * .3 + boxOffset * .35;
            var z = a[2], dx = x-wipePoint.x, dy = yy-wipePoint.y, dz = z-wipePoint.z;
            var distance = Math.sqrt(dx*dx+dy*dy+dz*dz), repulse = Math.max(0, 1 - distance/2.2) * wipeStrength * 1.7;
            var divisor = Math.max(.01, distance);
            dustPos[d*3] = x + dx/divisor*repulse; dustPos[d*3+1] = yy + dy/divisor*repulse; dustPos[d*3+2] = z + dz/divisor*repulse;
          }
          dustGeo.attributes.position.needsUpdate = true;
          lastPetal.position.copy(boxPosition); lastPetal.position.y += .12;
          lastPetal.material.opacity = frame.close * .8;
          savedGlow.position.copy(boxPosition); savedGlow.position.set(boxPosition.x, boxPosition.y + .30, boxPosition.z + 1.3);
          savedGlow.material.opacity = frame.close * .32;
        }
      };
    }
  };
})(window);
