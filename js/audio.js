/* THE AUDIT . audio
   synthesized clinic: room hum, monitor beep, form ticks, paper turns,
   the flatline tone. zero assets. OFF by default; the consent click arms it. */

const Aud = (() => {
  let ctx = null, master = null, humNodes = null, flatNodes = null;
  let enabled = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function setEnabled(on) {
    enabled = on;
    if (!ensure()) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(on ? 1 : 0, ctx.currentTime + 0.4);
    if (on) hum(); else stopHum();
  }
  function isOn() { return enabled; }

  /* low room tone: mains hum + fluorescent hiss */
  function hum() {
    if (!ctx || humNodes) return;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 50;
    const og = ctx.createGain(); og.gain.value = 0.012;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 6200; nf.Q.value = 8;
    const ng = ctx.createGain(); ng.gain.value = 0.006;
    o.connect(og).connect(master); n.connect(nf).connect(ng).connect(master);
    o.start(); n.start();
    humNodes = { o, n };
  }
  function stopHum() {
    if (!humNodes) return;
    try { humNodes.o.stop(); humNodes.n.stop(); } catch (e) {}
    humNodes = null;
  }

  function blip(freq, dur, vol, type) {
    if (!enabled || !ensure()) return;
    const o = ctx.createOscillator(); o.type = type || "sine"; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  /* monitor beep on the R spike */
  function beep() { blip(880, 0.07, 0.05); }
  /* alarm-pitch beep for irregular beats */
  function beepHigh() { blip(1040, 0.07, 0.06); }
  /* keystroke tick */
  function tick() { blip(2400, 0.015, 0.02, "square"); }
  /* stamp / impact thud */
  function thud() {
    if (!enabled || !ensure()) return;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(120, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.connect(g).connect(master); o.start(); o.stop(ctx.currentTime + 0.25);
  }
  /* paper turn between acts */
  function page() {
    if (!enabled || !ensure()) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1200;
    const g = ctx.createGain(); g.gain.value = 0.05;
    s.connect(f).connect(g).connect(master); s.start();
  }
  /* the flatline: continuous tone */
  function flatStart() {
    if (!enabled || !ensure() || flatNodes) return;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.1);
    o.connect(g).connect(master); o.start();
    flatNodes = { o, g };
  }
  function flatStop() {
    if (!flatNodes) return;
    flatNodes.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    const o = flatNodes.o;
    setTimeout(() => { try { o.stop(); } catch (e) {} }, 600);
    flatNodes = null;
  }

  return { setEnabled, isOn, beep, beepHigh, tick, thud, page, flatStart, flatStop };
})();
