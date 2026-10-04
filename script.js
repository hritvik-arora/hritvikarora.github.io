/* =========================================================
   script.js — background, parallax and small interactions
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 800px)').matches;

  /* ---------- 1. CONTOUR LINES ----------
     Builds nested wobbly closed curves, like elevation lines on a topographic map.
     Each ring is a circle whose radius is nudged by a few sine waves. */
  var svgNS = 'http://www.w3.org/2000/svg';
  function ring(cx, cy, r, seed) {
    var d = '';
    for (var i = 0; i <= 72; i++) {
      var a = (i / 72) * Math.PI * 2;
      var w = 1 + 0.12 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a + seed * 2) + 0.04 * Math.sin(9 * a + seed * 3);
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r * w * 1.25).toFixed(1) + ' ' + (cy + Math.sin(a) * r * w).toFixed(1);
    }
    return d + 'Z';
  }
  var contours = document.getElementById('contours');
  var hills = [[300, 280, 1.2], [900, 620, 2.4]];            // [x, y, seed]: two "hills"
  var steps = isMobile ? 7 : 12;                              // fewer lines on mobile
  hills.forEach(function (h) {
    for (var k = 1; k <= steps; k++) {
      var p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', ring(h[0], h[1], k * 26, h[2] + k * 0.08));
      contours.appendChild(p);
    }
  });

  /* ---------- 2. PARTICLES + SEISMIC WAVES (canvas) ---------- */
  var canvas = document.getElementById('field');
  var ctx = canvas.getContext('2d');
  var W, H, dots = [], t = 0, scrollY = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = isMobile ? 35 : 100;                              // particle count
    dots = [];
    for (var i = 0; i < n; i++) {
      dots.push({ x: Math.random() * W, y: Math.random() * H,
        z: 0.2 + Math.random() * 0.8,                         // z = depth: bigger = closer = moves more
        vx: (Math.random() - .5) * 0.12 });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Particles: slow drift, plus parallax from scroll (closer grains shift more)
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.x += d.vx * d.z;
      if (d.x < 0) d.x = W; if (d.x > W) d.x = 0;
      var y = (((d.y - scrollY * 0.25 * d.z) % H) + H) % H;  // wrap around the screen
      ctx.fillStyle = 'rgba(201,151,46,' + (0.15 + d.z * 0.3) + ')';
      ctx.fillRect(d.x, y, d.z * 2, d.z * 2);
    }
    // Seismic waves: three faint sine lines near the bottom, scrolling slowly
    ctx.lineWidth = 1;
    for (var s = 0; s < 3; s++) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(141,149,143,' + (0.08 + s * 0.03) + ')';
      var base = H * (0.72 + s * 0.08);
      for (var x = 0; x <= W; x += 8) {
        // amplitude is modulated so the line has bursts, like a real seismogram
        var amp = 10 * Math.sin(x * 0.004 + s) * Math.sin(x * 0.0013 + t * 0.3);
        var yy = base + amp * Math.sin(x * 0.03 + t * (0.6 + s * 0.2));
        x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
    t += 0.016;
  }

  function loop() { draw(); requestAnimationFrame(loop); }
  resize();
  window.addEventListener('resize', resize);
  if (reduceMotion) draw(); else loop();                      // reduced motion: one still frame

  /* ---------- 3. SCROLL PARALLAX ----------
     Each .bg-layer has data-depth (fraction of screen height). At the top of the page the layer
     sits at 0; at the bottom it has moved up by depth * screen height. Different depths = different speeds. */
  var layers = document.querySelectorAll('.bg-layer');
  var ticking = false;
  function parallax() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var progress = max > 0 ? scrollY / max : 0;                // 0 (top) to 1 (bottom)
    layers.forEach(function (el) {
      var shift = progress * parseFloat(el.dataset.depth) * window.innerHeight * (isMobile ? 0.6 : 1);
      el.style.transform = 'translate3d(0,' + (-shift).toFixed(1) + 'px,0)';
    });
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    scrollY = window.pageYOffset;
    if (!reduceMotion && !ticking) { ticking = true; requestAnimationFrame(parallax); }  // one update per frame
  }, { passive: true });

  /* ---------- 4. SECTION REVEAL + NAV HIGHLIGHT ---------- */
  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(function (el) { revealer.observe(el); });

  var links = document.querySelectorAll('#menu a');
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });                    // "current" = section crossing mid-screen
  document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });

  /* ---------- 5. MOBILE MENU ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('menu');
  toggle.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  menu.addEventListener('click', function () { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', false); });

  /* ---------- 6. EXPANDABLE PROJECTS ---------- */
  document.querySelectorAll('.project-head').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.parentElement;
      var open = card.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
  });

  /* ---------- 7. CARD GLOW follows the pointer (CSS reads --mx / --my) ---------- */
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
})();
