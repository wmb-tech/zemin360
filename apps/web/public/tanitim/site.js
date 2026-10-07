// Tanıtım sayfasının davranışı (film, marka animasyonu, kaydırma). Ayrı dosya: CSP satır içi
// script'e izin vermiyor (script-src 'self').
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Closed-form spring step response, as in the film.
  function springStep(t, k = 420, c = 32) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k), z = c / (2 * w0);
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  // A value that springs to new targets from wherever it is (stateful, for interactive UI).
  class Spring {
    constructor(v, k = 260, c = 26) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.c = c; }
    step(dt) { const f = -this.k * (this.v - this.t) - this.c * this.vel; this.vel += f * dt; this.v += this.vel * dt; return this.v; }
    get done() { return Math.abs(this.v - this.t) < 0.05 && Math.abs(this.vel) < 0.05; }
    snap(v) { this.v = this.t = v; this.vel = 0; }
  }

  /* ---------------- top bar border on scroll ---------------- */
  const bar = document.getElementById('bar');
  const onScrollBar = () => bar.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScrollBar, { passive: true }); onScrollBar();

  /* ---------------- wordmark: letters squeeze into the period, the dot becomes a pill ---------------- */
  function Wordmark(root) {
    const chars = ['E', 'v', 'i', 'd', 'e', 'x'];
    root.innerHTML = chars.map((c) => `<span class="l"><span>${c}</span></span>`).join('') + '<span class="p">.<i style="display:inline-block;width:0;height:0"></i></span><button class="dot" type="button" aria-label="Sloganı göster"><span class="pl"></span></button>';
    const L = [...root.querySelectorAll('.l')], G = L.map((l) => l.firstChild);
    const P = root.querySelector('.p'), dot = root.querySelector('.dot'), pl = dot.querySelector('.pl');
    pl.textContent = root.dataset.label;
    let m = null;
    const WD = [62, 70, 80, 90, 100, 110, 125];
    function measure() {
      const px = parseFloat(getComputedStyle(root).fontSize);
      const rr = root.getBoundingClientRect();
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      root.appendChild(probe);
      const table = chars.map((c) => WD.map((wd) => { probe.style.fontVariationSettings = `'wdth' ${wd}`; probe.textContent = c; return [wd, probe.getBoundingClientRect().width]; }));
      probe.remove();
      L.forEach((l, i) => { l.style.width = `${table[i][WD.length - 1][1]}px`; });
      const xs = L.map((l) => l.getBoundingClientRect().left - rr.left);
      const pr = P.getBoundingClientRect();
      const base = P.lastChild.getBoundingClientRect().top - rr.top;
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `800 ${px}px Archivo`; ctx.fontStretch = 'expanded';
      const mm = ctx.measureText('.');
      const d = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
      const dotX = pr.left - rr.left;
      const cx = dotX - mm.actualBoundingBoxLeft + d / 2, cy = base - mm.actualBoundingBoxAscent + d / 2;
      const capMid = base - px * 0.36;
      m = { px, table, xs, dotX, d, cx, cy, capMid, w: rr.width };
    }
    function widthAt(i, target) {
      const tb = m.table[i];
      if (target >= tb[tb.length - 1][1]) return [125, target / tb[tb.length - 1][1]];
      if (target <= tb[0][1]) return [62, target / tb[0][1]];
      for (let j = 0; j < tb.length - 1; j++) if (target <= tb[j + 1][1]) return [lerp(tb[j][0], tb[j + 1][0], (target - tb[j][1]) / (tb[j + 1][1] - tb[j][1])), 1];
      return [125, 1];
    }
    function draw(f, shape, label) {
      L.forEach((l, i) => {
        const w0 = m.table[i][WD.length - 1][1];
        const [wd, sx] = widthAt(i, w0 * f);
        const tx = (m.dotX - m.xs[i]) * (1 - f);
        G[i].style.transform = `translateX(${tx}px) scaleX(${sx})`;
        G[i].style.fontVariationSettings = `'wdth' ${wd.toFixed(2)}`;
        G[i].style.visibility = f > 0.012 ? 'visible' : 'hidden';
      });
      Object.assign(dot.style, { left: `${shape.cx - shape.w / 2}px`, top: `${shape.cy - shape.h / 2}px`, width: `${shape.w}px`, height: `${shape.h}px` });
      pl.style.transform = `translate(-50%, ${-50 + label * 0}%) translateY(${(1 - label) * m.px * 0.4}px)`;
      pl.style.opacity = label > 0.01 ? 1 : 0;
    }
    const rest = () => draw(1, { cx: m.cx, cy: m.cy, w: m.d, h: m.d }, 0);
    let t0 = null, running = false;
    function frame(now) {
      const t = (now - t0) / 1000;
      const sq = easeInOut(clamp((t - 0.05) / 0.5));
      const back = t > 2.55 ? springStep(t - 2.55, 520, 30) : 0;
      const f = t < 2.55 ? 1 - sq : back;
      const d0 = m.d * (1 + 0.7 * sq);
      const pw = Math.min(m.w * 0.84, m.px * 3.6), ph = m.px * 0.56;
      const grow = springStep(t - 0.55), growW = springStep(t - 0.62);
      const shrink = springStep(t - 2.25);
      const cx = lerp(lerp(m.cx, m.w / 2, springStep(t - 0.55, 190, 27)), m.cx, springStep(t - 2.25, 190, 27));
      const cy = lerp(lerp(m.cy, m.capMid, springStep(t - 0.55, 190, 27)), m.cy, springStep(t - 2.25, 190, 27));
      const w = lerp(lerp(d0, pw, growW), m.d, shrink), h = lerp(lerp(d0, ph, grow), m.d, shrink);
      const lab = springStep(t - 0.95) * (1 - springStep(t - 2.0, 520, 34));
      draw(f, { cx, cy, w: Math.max(0, w), h: Math.max(0, h) }, lab);
      if (t < 3.4) requestAnimationFrame(frame); else { running = false; rest(); }
    }
    function play() { if (running || reduce) return; running = true; t0 = performance.now(); requestAnimationFrame(frame); }
    dot.addEventListener('click', play);
    const ready = () => { measure(); rest(); };
    document.fonts.ready.then(() => { ready(); addEventListener('resize', () => { if (!running) ready(); }); });
    return { play, ready };
  }
  const heroWM = Wordmark(document.getElementById('wm-hero'));
  const footWM = Wordmark(document.getElementById('wm-foot'));
  document.fonts.ready.then(() => setTimeout(() => heroWM.play(), 350));
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { footWM.play(); o.disconnect(); } }, { threshold: 0.8 }).observe(document.getElementById('wm-foot'));

  /* ---------------- film reel ---------------- */
  const reel = document.getElementById('reel'), rv = document.getElementById('reel-video');
  const playBtn = document.getElementById('reel-play'), soundBtn = document.getElementById('reel-sound');
  if (matchMedia('(max-width: 860px)').matches) {
    reel.classList.add('vertical');
    rv.poster = '/tanitim/media/film-vertical-poster.jpg';
    rv.querySelector('source').src = '/tanitim/media/film-vertical.mp4';
    rv.load();
  }
  let userPaused = false;
  const syncPlay = () => { playBtn.textContent = rv.paused ? 'Oynat' : 'Durdur'; };
  playBtn.addEventListener('click', () => { if (rv.paused) { rv.play(); userPaused = false; } else { rv.pause(); userPaused = true; } });
  soundBtn.addEventListener('click', () => { rv.muted = !rv.muted; soundBtn.textContent = rv.muted ? 'Sesi aç' : 'Sesi kapat'; if (rv.paused) rv.play(); });
  rv.addEventListener('play', syncPlay); rv.addEventListener('pause', syncPlay);
  if (reduce) { playBtn.textContent = 'Oynat'; }
  new IntersectionObserver((es) => {
    const vis = es[0].isIntersecting;
    if (vis && !userPaused && !reduce) rv.play().catch(() => {}); else if (!vis) rv.pause();
  }, { threshold: 0.35 }).observe(reel);

  /* ---------------- loop: sticky morph ---------------- */
  const morph = document.getElementById('loop-morph'), stage = document.getElementById('loop-stage');
  const code = document.getElementById('loop-code'), rail = [...document.querySelectorAll('#loop-rail b')];
  const steps = [...document.querySelectorAll('#loop-steps .step')];
  const FACES = [
    { k: 'circle', html: '<div class="face-inner"><div class="t">Keşif</div><div class="s">Meydan okuma ve açık GitHub</div></div>' },
    { k: 'card', html: '<div class="face-inner"><div class="t">Yetkinlik kartı</div><div class="chips"><span class="chip c-verified">Doğrulanmış</span><span class="chip c-documented">Belgeli</span><span class="chip c-referenced">Referanslı</span><span class="chip c-declared">Beyan</span></div></div>' },
    { k: 'pill', html: '<div class="face-inner"><div class="t">En fazla 7 soru</div></div>' },
    { k: 'wide', html: '<div class="face-inner" style="justify-items:start;text-align:left"><div class="s" style="color:#8fe0bf;font-weight:800;letter-spacing:.05em;font-size:12px">UYUYOR, ÇÜNKÜ</div><div class="t" style="font-size:clamp(18px,2vw,24px)">Sürdürülmüş, canlıda bir iş var</div><div class="s" style="max-width:none">Eksik olan: mağaza yayını</div></div>' },
    { k: 'route', html: '<div class="face-inner" style="width:100%"><div class="t">Takipte</div><div class="s">3. gün, iki tarafa tek soru</div><svg viewBox="0 0 300 60" width="80%" style="max-width:340px;overflow:visible" aria-hidden="true"><path d="M8 44 C 70 10, 120 58, 170 32 S 250 18, 292 36" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1.5 9"/><circle cx="8" cy="44" r="5" fill="#fff"/><circle cx="292" cy="36" r="8" fill="none" stroke="#fff" stroke-width="3"/></svg></div>' },
    { k: 'circle', html: '<div class="face-inner"><svg width="54" height="54" viewBox="-27 -27 54 54" aria-hidden="true"><circle r="23" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M-10 0.5 L-2.5 8 L11 -7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="t">Referanslı</div></div>' },
  ];
  const geo = (k, W, H) => {
    const s = Math.min(W, H);
    return ({
      circle: { w: s * 0.6, h: s * 0.6, r: s * 0.3 },
      card: { w: Math.min(W * 0.78, 460), h: s * 0.52, r: 28 },
      pill: { w: Math.min(W * 0.72, 420), h: s * 0.24, r: s * 0.12 },
      wide: { w: Math.min(W * 0.84, 520), h: s * 0.42, r: 28 },
      route: { w: Math.min(W * 0.86, 540), h: s * 0.5, r: 40 },
    })[k];
  };
  const faces = FACES.map((f, i) => { const d = document.createElement('div'); d.className = 'face'; d.innerHTML = f.html; morph.appendChild(d); return d; });
  const mw = new Spring(0), mh = new Spring(0), mr = new Spring(0);
  const faceY = FACES.map((_, i) => new Spring(i === 0 ? 0 : 100, 300, 30));
  let active = -1, loopRaf = null;
  function setStep(i) {
    if (i === active) return;
    const dir = i > active ? 1 : -1;
    faceY.forEach((s, j) => { if (j === i) { if (active >= 0) s.snap(100 * dir); s.t = 0; } else if (j === active) s.t = -100 * dir; else s.snap(100); });
    active = i;
    const r = stage.getBoundingClientRect(), g = geo(FACES[i].k, r.width, r.height);
    mw.t = g.w; mh.t = g.h; mr.t = g.r;
    code.textContent = steps[i].querySelector('.area').textContent;
    if (reduce) { mw.snap(g.w); mh.snap(g.h); mr.snap(g.r); faceY.forEach((s, j) => s.snap(j === i ? 0 : 100)); }
    kick();
  }
  let last = 0;
  function loopFrame(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
    [mw, mh, mr, ...faceY].forEach((s) => s.step(dt));
    morph.style.width = `${mw.v}px`; morph.style.height = `${mh.v}px`;
    morph.style.borderRadius = `${Math.max(0, Math.min(mr.v, mw.v / 2, mh.v / 2))}px`;
    morph.style.transform = 'translate(-50%, -50%)';
    faces.forEach((f, j) => { f.style.transform = `translateY(${faceY[j].v}%)`; f.style.visibility = Math.abs(faceY[j].v) < 99.5 ? 'visible' : 'hidden'; });
    if ([mw, mh, mr, ...faceY].every((s) => s.done)) { loopRaf = null; return; }
    loopRaf = requestAnimationFrame(loopFrame);
  }
  function kick() { if (!loopRaf) { last = performance.now(); loopRaf = requestAnimationFrame(loopFrame); } }
  function loopScroll() {
    const mid = innerHeight * 0.55;
    let idx = 0;
    steps.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) idx = i; });
    setStep(idx);
    steps.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const p = i < idx ? 1 : i > idx ? 0 : clamp((mid - r.top) / Math.max(1, r.height));
      rail[i].style.width = `${p * 100}%`;
    });
  }
  { const r = stage.getBoundingClientRect(), g = geo(FACES[0].k, r.width, r.height); mw.snap(g.w); mh.snap(g.h); mr.snap(g.r); setStep(0); }
  addEventListener('scroll', loopScroll, { passive: true });
  addEventListener('resize', () => { const i = active; active = -1; setStep(i); });
  loopScroll();

  /* ---------------- evidence level slider ---------------- */
  const LV = [
    { n: 'Beyan', c: '#626979', cls: 'c-declared', src: 'kaynak yok' },
    { n: 'Belgeli', c: '#22669f', cls: 'c-documented', src: 'belge: siparis-uygulamasi-sunum.pdf' },
    { n: 'Referanslı', c: '#a55c17', cls: 'c-referenced', src: 'Demo Mağaza A.Ş. referansı, iş birliği kaydı' },
    { n: 'Doğrulanmış', c: '#127a56', cls: 'c-verified', src: 'GitHub App: ayse-dev/siparis, canlı alan adı' },
  ];
  const track = document.getElementById('track'), knob = document.getElementById('knob'), fill = document.getElementById('fill');
  const after = document.getElementById('demo-after'), col = document.getElementById('readout-col');
  const readout = document.getElementById('readout');
  const chip = document.getElementById('claim-chip'), src = document.getElementById('claim-src');
  const legend = [...document.querySelectorAll('#legend button')];
  col.innerHTML = LV.map((l) => `<div class="row"><i style="background:${l.c}"></i>${l.n}</div>`).join('');
  const pos = new Spring(0, 300, 30);
  let dragging = false, level = 0, sliderRaf = null;
  function renderSlider() {
    const p = clamp(pos.v, 0, 1);
    knob.style.left = `${p * 100}%`; fill.style.width = `${p * 100}%`;
    readout.style.transform = `translateX(${-p * 100}%)`;
    const e = lerp(-30, 130, p);
    after.style.webkitMaskImage = after.style.maskImage = `linear-gradient(100deg, #000 ${e - 16}%, transparent ${e + 16}%)`;
    let kc = 0;
    for (const edge of [1 / 6, 1 / 2, 5 / 6]) { const u = clamp((p - edge) / 0.08 + 0.5); kc += u * u * (3 - 2 * u); }
    col.style.transform = `translateY(${-44 * kc}px)`;
    const l = Math.round(p * 3);
    if (l !== level) setLevel(l, false);
  }
  function setLevel(l, move = true) {
    level = l;
    chip.className = `chip ${LV[l].cls}`; chip.textContent = LV[l].n; src.textContent = LV[l].src;
    legend.forEach((b, i) => b.setAttribute('aria-pressed', String(i === l)));
    knob.setAttribute('aria-valuenow', String(l)); knob.setAttribute('aria-valuetext', LV[l].n);
    if (move) { pos.t = l / 3; if (reduce) pos.snap(l / 3); kickSlider(); }
  }
  function sliderFrame(now) {
    if (!dragging) pos.step(1 / 60);
    renderSlider();
    if (dragging || !pos.done) sliderRaf = requestAnimationFrame(sliderFrame); else { pos.snap(pos.t); renderSlider(); sliderRaf = null; }
  }
  function kickSlider() { if (!sliderRaf) sliderRaf = requestAnimationFrame(sliderFrame); }
  const toP = (x) => { const r = track.getBoundingClientRect(); return clamp((x - r.left) / r.width); };
  track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); pos.v = toP(e.clientX); pos.vel = 0; kickSlider(); });
  track.addEventListener('pointermove', (e) => { if (dragging) pos.v = toP(e.clientX); });
  const endDrag = () => { if (!dragging) return; dragging = false; pos.t = Math.round(pos.v * 3) / 3; kickSlider(); };
  track.addEventListener('pointerup', endDrag); track.addEventListener('pointercancel', endDrag);
  knob.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (k) { e.preventDefault(); setLevel(clamp(level + k, 0, 3)); }
    if (e.key === 'Home') { e.preventDefault(); setLevel(0); }
    if (e.key === 'End') { e.preventDefault(); setLevel(3); }
  });
  legend.forEach((b) => b.addEventListener('click', () => setLevel(Number(b.dataset.l))));
  renderSlider(); setLevel(0, false);

  /* ---------------- introduction request: the button becomes the queue entry ---------------- */
  const ib = document.getElementById('intro-btn'), ia = document.getElementById('intro-a'), ibb = document.getElementById('intro-b'), note = document.getElementById('intro-note');
  ia.style.top = '0'; ibb.style.top = '46px';
  ib.addEventListener('click', () => {
    if (ib.dataset.sent === 'true') return;
    ib.dataset.sent = 'true'; ia.setAttribute('aria-hidden', 'true'); ibb.removeAttribute('aria-hidden');
    note.textContent = 'İstek GİRVAK onay kuyruğuna düştü; onaylanınca e-posta iki tarafa gider.';
    const w = new Spring(230, 380, 30); w.t = 196; const y = new Spring(0, 420, 32); y.t = -46;
    let lastT = performance.now();
    const f = (now) => { const dt = Math.min(0.033, (now - lastT) / 1000); lastT = now; w.step(dt); y.step(dt); ib.style.width = `${w.v}px`; ia.style.top = `${y.v}px`; ibb.style.top = `${46 + y.v}px`; if (!(w.done && y.done)) requestAnimationFrame(f); };
    if (reduce) { ib.style.width = '196px'; ia.style.top = '-46px'; ibb.style.top = '0'; } else requestAnimationFrame(f);
  });

  /* ---------------- approval: one shape, four states ---------------- */
  const qstage = document.getElementById('qstage'), qshape = document.getElementById('qshape');
  const qtabs = [...document.querySelectorAll('#qtabs button')];
  const CHECK = (r, s) => `<svg width="${2 * r + 8}" height="${2 * r + 8}" viewBox="${-r - 4} ${-r - 4} ${2 * r + 8} ${2 * r + 8}" aria-hidden="true"><circle r="${r}" fill="none" stroke="currentColor" stroke-width="${s}"/><path d="M${-r * 0.42} ${r * 0.02} L${-r * 0.1} ${r * 0.32} L${r * 0.45} ${-r * 0.3}" fill="none" stroke="currentColor" stroke-width="${s * 1.2}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const Q = [
    { k: 'pill', html: `<div style="display:flex;gap:14px;align-items:center;font:800 clamp(24px,3vw,40px)/1 var(--sans);letter-spacing:-.03em">${CHECK(18, 3.4)}Onaylandı</div>` },
    { k: 'pill', html: '<div style="display:flex;gap:14px;align-items:center;font:800 clamp(24px,3vw,40px)/1 var(--sans);letter-spacing:-.03em">Tanıştırma<span class="pct" style="color:var(--ink-soft);min-width:3.2ch;font-variant-numeric:tabular-nums">0%</span></div><div class="qbar" style="position:absolute;left:0;top:0;bottom:0;width:0;background:#e6e8f6;z-index:-1"></div>' },
    { k: 'card', html: '<div style="position:absolute;left:8%;top:14%;text-align:left"><div style="font:800 clamp(22px,2.6vw,34px)/1 var(--sans);letter-spacing:-.03em">Takipte</div><div style="color:var(--ink-soft);font-size:15px;margin-top:6px">3. gün, iki tarafa tek soru</div></div><svg viewBox="0 0 400 120" style="position:absolute;left:6%;right:6%;bottom:10%;width:88%;overflow:visible" aria-hidden="true"><path d="M10 96 C 90 40, 150 110, 220 70 S 330 40, 390 78" fill="none" stroke="#20253d" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1.5 11"/><circle cx="10" cy="96" r="6" fill="#20253d"/><circle cx="390" cy="78" r="10" fill="none" stroke="#20253d" stroke-width="3.5"/></svg>' },
    { k: 'circle', html: `<div style="display:grid;gap:10px;justify-items:center;font:800 clamp(18px,2vw,26px)/1 var(--sans);letter-spacing:-.02em;color:var(--referenced)">${CHECK(26, 4)}Referanslı</div>` },
  ];
  const qgeo = (k, W, H) => ({ pill: { w: Math.min(W * 0.78, 460), h: H * 0.26, r: H * 0.13 }, card: { w: W * 0.84, h: H * 0.62, r: 32 }, circle: { w: H * 0.52, h: H * 0.52, r: H * 0.26 } })[k];
  const qfaces = Q.map((q) => { const d = document.createElement('div'); d.className = 'face'; d.innerHTML = q.html; d.style.isolation = 'isolate'; qshape.appendChild(d); return d; });
  const qw = new Spring(0), qh = new Spring(0), qr = new Spring(0);
  const qy = Q.map((_, i) => new Spring(i ? 100 : 0, 300, 30));
  let qi = -1, qRaf = null, qStart = 0, qAuto = true, qTimer = null;
  function setQ(i, fromUser) {
    if (fromUser) qAuto = false;
    if (i !== qi) {
      qy.forEach((s, j) => { if (j === i) { if (qi >= 0) s.snap(100); s.t = 0; } else if (j === qi) s.t = -100; else s.snap(100); });
      qi = i; qStart = performance.now();
      const r = qstage.getBoundingClientRect(), g = qgeo(Q[i].k, r.width, r.height);
      qw.t = g.w; qh.t = g.h; qr.t = g.r;
      if (reduce) { qw.snap(g.w); qh.snap(g.h); qr.snap(g.r); qy.forEach((s, j) => s.snap(j === i ? 0 : 100)); }
    }
    qtabs.forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
    if (!qRaf) { qLast = performance.now(); qRaf = requestAnimationFrame(qFrame); }
  }
  let qLast = 0;
  function qFrame(now) {
    const dt = Math.min(0.033, (now - qLast) / 1000); qLast = now;
    [qw, qh, qr, ...qy].forEach((s) => s.step(dt));
    Object.assign(qshape.style, { width: `${qw.v}px`, height: `${qh.v}px`, borderRadius: `${Math.max(0, Math.min(qr.v, qw.v / 2, qh.v / 2))}px`, transform: 'translate(-50%, -50%)' });
    qfaces.forEach((f, j) => { f.style.transform = `translateY(${qy[j].v}%)`; f.style.visibility = Math.abs(qy[j].v) < 99.5 ? 'visible' : 'hidden'; });
    if (qi === 1) {
      const p = reduce ? 1 : easeInOut(clamp((now - qStart - 250) / 1300));
      qfaces[1].querySelector('.pct').textContent = `${Math.round(p * 100)}%`;
      qfaces[1].querySelector('.qbar').style.width = `${p * 100}%`;
    }
    const busy = ![qw, qh, qr, ...qy].every((s) => s.done) || (qi === 1 && now - qStart < 1700);
    if (busy) qRaf = requestAnimationFrame(qFrame); else qRaf = null;
  }
  qtabs.forEach((b) => b.addEventListener('click', () => setQ(Number(b.dataset.q), true)));
  qtabs.forEach((b, i) => b.addEventListener('keydown', (e) => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); const n = (i + k + 4) % 4; qtabs[n].focus(); setQ(n, true); } }));
  { const r = qstage.getBoundingClientRect(), g = qgeo('pill', r.width, r.height); qw.snap(g.w); qh.snap(g.h); qr.snap(g.r); setQ(0); }
  new IntersectionObserver((es) => {
    clearInterval(qTimer);
    if (es[0].isIntersecting && !reduce) qTimer = setInterval(() => { if (qAuto) setQ((qi + 1) % 4); }, 2200);
  }, { threshold: 0.5 }).observe(qstage);
  addEventListener('resize', () => { const i = qi; qi = -1; setQ(i); });

  /* ---------------- wall: leaf shadows fall across the framed card ---------------- */
  const wv = document.getElementById('wall-video'), frame = document.getElementById('frame'), fc = document.getElementById('frame-shadow');
  const fctx = fc.getContext('2d');
  let wallOn = false;
  function drawShadow() {
    if (!wallOn) return;
    if (wv.readyState >= 2 && wv.videoWidth) {
      const vr = wv.getBoundingClientRect(), fr = frame.getBoundingClientRect();
      const scale = Math.max(vr.width / wv.videoWidth, vr.height / wv.videoHeight);
      const ox = (vr.width - wv.videoWidth * scale) / 2, oy = (vr.height - wv.videoHeight * scale) / 2;
      const sx = (fr.left - 14 - vr.left - ox) / scale, sy = (fr.top - 10 - vr.top - oy) / scale;
      const W = Math.round(fr.width), H = Math.round(fr.height);
      if (fc.width !== W || fc.height !== H) { fc.width = W; fc.height = H; }
      fctx.drawImage(wv, sx, sy, fr.width / scale, fr.height / scale, 0, 0, W, H);
    }
    requestAnimationFrame(drawShadow);
  }
  new IntersectionObserver((es) => {
    wallOn = es[0].isIntersecting;
    if (wallOn) { if (!reduce) wv.play().catch(() => {}); requestAnimationFrame(drawShadow); } else wv.pause();
  }, { threshold: 0.1 }).observe(wv);
  wv.addEventListener('loadeddata', () => { if (reduce) { wallOn = true; drawShadow(); wallOn = false; } });
})();
