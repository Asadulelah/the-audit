/* THE AUDIT . fx
   the monitor: a persistent ECG strip that is a character in the story.
   calm at intake, elevated at vitals, irregular under cross-examination,
   rapid in imaging, FLAT at the diagnosis, steady and strong at the chart.
   plus the imaging-suite loop diagram.
   deterministic: window.__step(frames) drives everything for the harness. */

const FX = (() => {

  /* ---------- ECG state machine ---------- */
  const STATES = {
    idle:      { bpm: 0,   amp: 0.10, noise: 0.004, pvc: 0 },
    calm:      { bpm: 62,  amp: 0.55, noise: 0.006, pvc: 0 },
    elevated:  { bpm: 74,  amp: 0.62, noise: 0.008, pvc: 0 },
    irregular: { bpm: 86,  amp: 0.70, noise: 0.012, pvc: 0.22 },
    rapid:     { bpm: 106, amp: 0.75, noise: 0.014, pvc: 0.10 },
    racing:    { bpm: 132, amp: 0.80, noise: 0.018, pvc: 0.16 },
    flat:      { bpm: 0,   amp: 0.0,  noise: 0.002, pvc: 0 },
    recovery:  { bpm: 66,  amp: 0.85, noise: 0.005, pvc: 0 },
  };

  let cv, cx, W = 0, H = 0, dpr = 1;
  let state = STATES.idle, stateName = "idle";
  let head = 0;                 /* write head x position, px */
  let phase = 0;                /* beat phase 0..1 */
  let lastY = null;
  let jolt = 0;                 /* keystroke jitter energy */
  let pvcArm = false;
  let bpmEl = null;
  let onBeat = null;            /* callback for beep */
  let running = true;
  let reduced = false;

  /* canonical PQRST-ish waveform over phase 0..1 */
  function wave(p) {
    function bump(c, w, h) { const d = (p - c) / w; return h * Math.exp(-d * d * 4); }
    let v = 0;
    v += bump(0.16, 0.05, 0.12);              /* P */
    v += bump(0.30, 0.016, -0.16);            /* Q */
    v += bump(0.335, 0.02, 1.0);              /* R */
    v += bump(0.375, 0.018, -0.28);           /* S */
    v += bump(0.58, 0.07, 0.22);              /* T */
    return v;
  }

  function initECG() {
    cv = document.getElementById("ecg");
    bpmEl = document.getElementById("bpm");
    cx = cv.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    dpr = Math.min(1.6, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width * dpr));
    H = Math.max(1, Math.floor(r.height * dpr));
    cv.width = W; cv.height = H;
    cx.fillStyle = "#0B0F12"; cx.fillRect(0, 0, W, H);
    lastY = null;
  }

  function setState(name) {
    if (!STATES[name]) return;
    state = STATES[name]; stateName = name;
    if (bpmEl) {
      bpmEl.textContent = state.bpm === 0 ? (name === "flat" ? "ASYSTOLE" : "-- BPM") : state.bpm + " BPM";
      bpmEl.classList.toggle("alarm", name === "flat" || name === "racing");
    }
  }
  function getState() { return stateName; }

  function keystroke() { jolt = Math.min(1, jolt + 0.35); }

  /* one simulation step at dt seconds */
  function step(dt) {
    if (!cx) return;
    const speed = W * 0.085;               /* head speed px/s */
    const adv = speed * dt;

    /* beat phase advance */
    if (state.bpm > 0) {
      const beatLen = 60 / state.bpm;
      const prev = phase;
      phase += dt / beatLen;
      if (phase >= 1) {
        phase = phase % 1;
        pvcArm = Math.random() < state.pvc;
        if (onBeat) onBeat(pvcArm);
      }
      if (prev < 0.335 && phase >= 0.335 && reduced === false) { /* R spike moment */ }
    }

    /* sample value */
    let v = state.bpm > 0 ? wave(phase) * state.amp : 0;
    if (pvcArm && phase > 0.3 && phase < 0.45) v *= 1.7;          /* ectopic exaggeration */
    v += (Math.random() * 2 - 1) * (state.noise + jolt * 0.05);
    jolt *= Math.pow(0.001, dt);                                   /* fast decay */

    const mid = H * 0.56;
    const y = mid - v * H * 0.42;
    const x0 = head, x1 = head + adv;

    /* erase ahead (sweep gap) */
    cx.fillStyle = "#0B0F12";
    cx.fillRect(x0, 0, adv + W * 0.06, H);

    /* grid tick */
    cx.fillStyle = "rgba(169,215,232,0.05)";
    for (let gx = Math.floor(x0 / (W / 40)) * (W / 40); gx < x1; gx += W / 40) cx.fillRect(gx, 0, 1, H);

    /* trace segment */
    cx.strokeStyle = stateName === "flat" ? "#B5121B" : "#A9D7E8";
    cx.lineWidth = Math.max(1.5, 1.8 * dpr);
    cx.beginPath();
    cx.moveTo(x0, lastY === null ? y : lastY);
    cx.lineTo(x1, y);
    cx.stroke();

    lastY = y;
    head = x1;
    if (head >= W) { head = 0; lastY = null; }
  }

  /* ---------- imaging loop diagram ---------- */
  let loop = null;
  function initLoop(stations, causeIndex) {
    const c = document.getElementById("loopcanvas");
    loop = { c, g: c.getContext("2d"), stations, causeIndex, t: 0 };
    drawLoop(0);
  }
  function loopStep(dt) {
    if (!loop) return;
    loop.t += dt;
    drawLoop(loop.t);
  }
  function drawLoop(t) {
    const { c, g, stations, causeIndex } = loop;
    const w = c.width, h = c.height;
    g.fillStyle = "#0B0F12"; g.fillRect(0, 0, w, h);
    const cxp = w / 2, cyp = h / 2, rx = w * 0.36, ry = h * 0.33;
    const n = stations.length;
    const pos = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      pos.push([cxp + Math.cos(a) * rx, cyp + Math.sin(a) * ry]);
    }
    /* edges with arrowheads */
    g.strokeStyle = "rgba(169,215,232,0.35)"; g.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pos[i], [x2, y2] = pos[(i + 1) % n];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      const ax = x1 + ux * (L * 0.30), ay = y1 + uy * (L * 0.30);
      const bx = x2 - ux * (L * 0.30), by = y2 - uy * (L * 0.30);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx - ux * 9 - uy * 5, by - uy * 9 + ux * 5);
      g.lineTo(bx - ux * 9 + uy * 5, by - uy * 9 - ux * 5);
      g.closePath(); g.fillStyle = "rgba(169,215,232,0.35)"; g.fill();
    }
    /* tracer dot running the loop */
    const cycle = 9;
    const tp = (t % cycle) / cycle;
    const seg = Math.floor(tp * n), st = (tp * n) % 1;
    const [sx, sy] = pos[seg], [ex, ey] = pos[(seg + 1) % n];
    const tx = sx + (ex - sx) * st, ty = sy + (ey - sy) * st;
    g.beginPath(); g.arc(tx, ty, 5, 0, Math.PI * 2);
    g.fillStyle = "#A9D7E8"; g.fill();

    /* stations */
    g.textAlign = "center";
    for (let i = 0; i < n; i++) {
      const [x, y] = pos[i];
      const isCause = i === causeIndex;
      const label = stations[i];
      g.font = (isCause ? "700 " : "400 ") + Math.round(w * 0.0155) + "px 'Space Mono', monospace";
      const tw = Math.min(w * 0.24, g.measureText(label).width + 26);
      const th = w * 0.035;
      const pulse = isCause ? (Math.sin(t * 3) * 0.5 + 0.5) : 0;
      g.fillStyle = "#0B0F12";
      g.strokeStyle = isCause ? `rgba(181,18,27,${0.65 + pulse * 0.35})` : "rgba(169,215,232,0.6)";
      g.lineWidth = isCause ? 2.5 : 1.5;
      g.fillRect(x - tw / 2, y - th / 2, tw, th);
      g.strokeRect(x - tw / 2, y - th / 2, tw, th);
      g.fillStyle = isCause ? "#E04A3A" : "#A9D7E8";
      g.fillText(label, x, y + w * 0.0055, w * 0.22);
      g.font = "400 " + Math.round(w * 0.011) + "px 'Space Mono', monospace";
      g.fillStyle = "rgba(169,215,232,0.45)";
      g.fillText("0" + (i + 1), x, y - th / 2 - 7);
      if (isCause) {
        g.fillStyle = "#E04A3A";
        g.fillText("THE CAUSE", x, y + th / 2 + 16);
      }
    }
    /* center label */
    g.font = "400 " + Math.round(w * 0.013) + "px 'Space Mono', monospace";
    g.fillStyle = "rgba(169,215,232,0.5)";
    g.fillText("PATIENT LOOP . PERIOD: " + loop.period, cxp, cyp - 8);
    g.fillStyle = "rgba(169,215,232,0.3)";
    g.fillText("orbits completed: " + Math.floor(t / cycle + loop.orbits), cxp, cyp + 14);
  }

  /* ---------- main loop + deterministic driver ---------- */
  let last = 0;
  function raf(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    if (!document.hidden && !reduced) {
      step(dt);
      if (document.body.dataset.act === "act4") loopStep(dt);
    }
    requestAnimationFrame(raf);
  }

  function start() {
    initECG();
    setState("idle");
    requestAnimationFrame(t => { last = t; raf(t); });
  }

  function setReduced(r) {
    reduced = r;
    if (r) { /* draw one representative static frame */
      if (cx) { step(0.016); }
      if (loop) drawLoop(2.2);
    }
  }

  /* harness driver: advance n frames at 60fps regardless of visibility */
  window.__step = function (frames) {
    for (let i = 0; i < frames; i++) {
      step(1 / 60);
      if (document.body.dataset.act === "act4" && loop) loopStep(1 / 60);
    }
    return stateName;
  };

  return { start, setState, getState, keystroke, initLoop, setReduced,
           set onBeat(fn) { onBeat = fn; },
           setLoopMeta(period, orbits) { if (loop) { loop.period = period; loop.orbits = orbits; } } };
})();
