/* THE AUDIT . app
   the attending physician: runs the acts, asks the questions,
   performs the diagnosis, prints the chart. */

(() => {
  "use strict";

  /* error collector for the harness */
  window.__errs = [];
  window.addEventListener("error", e => window.__errs.push(String(e.message)));
  window.addEventListener("unhandledrejection", e => window.__errs.push("promise: " + String(e.reason)));

  const $ = s => document.querySelector(s);
  const SITE_URL = "the-audit-room.vercel.app";

  let reduced = false;
  let currentField = null;      /* harness hook target */
  let currentSubmit = null;

  /* ---------- utilities ---------- */
  const sleep = ms => new Promise(r => setTimeout(r, (window.__fast ? 0 : ms)));

  async function typeText(el, text, speed = 18) {
    if (reduced || window.__fast) { el.textContent = text; return; }
    el.textContent = "";
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      if (i % 2 === 0) await sleep(speed);
    }
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ---------- header: stepper + toggles ---------- */
  function buildStepper() {
    const host = $("#stepper");
    DATA.acts.slice(1).forEach((a, i) => {
      const s = el("span", "step", `0${i + 1} ${a.name}`);
      s.dataset.act = a.id;
      host.appendChild(s);
    });
  }
  function updateStepper(actId) {
    const idx = DATA.acts.findIndex(a => a.id === actId);
    document.querySelectorAll(".step").forEach(s => {
      const i = DATA.acts.findIndex(a => a.id === s.dataset.act);
      s.classList.toggle("now", s.dataset.act === actId);
      s.classList.toggle("done", i < idx);
    });
  }

  function initToggles() {
    const m = $("#t-motion"), s = $("#t-sound");
    /* explicit motion toggle. never trust the OS flag silently. */
    reduced = localStorage.getItem("audit-motion") === "off";
    applyMotion();
    m.addEventListener("click", () => {
      reduced = !reduced;
      localStorage.setItem("audit-motion", reduced ? "off" : "on");
      applyMotion();
    });
    function applyMotion() {
      document.documentElement.classList.toggle("reduced", reduced);
      m.textContent = reduced ? "MOTION OFF" : "MOTION ON";
      m.setAttribute("aria-pressed", String(!reduced));
      FX.setReduced(reduced);
    }
    s.addEventListener("click", () => {
      const on = !Aud.isOn();
      Aud.setEnabled(on);
      s.textContent = on ? "SOUND ON" : "SOUND OFF";
      s.setAttribute("aria-pressed", String(on));
    });
  }

  /* ---------- acts ---------- */
  const ECG_BY_ACT = {
    act0: "idle", act1: "calm", act2: "elevated",
    act3: "irregular", act4: "rapid", act5: "racing", act6: "recovery",
  };

  function setAct(id) {
    document.querySelectorAll(".act").forEach(a => a.classList.toggle("on", a.id === id));
    document.body.dataset.act = id;
    updateStepper(id);
    if (ECG_BY_ACT[id] && id !== "act5") FX.setState(ECG_BY_ACT[id]);
    Aud.page();
    window.scrollTo(0, 0);
  }

  /* ---------- act 0: admission ---------- */
  function initAdmission() {
    const host = $("#consent");
    const boxes = [];
    DATA.consent.forEach(text => {
      const lab = el("label");
      const inp = document.createElement("input");
      inp.type = "checkbox";
      lab.appendChild(inp);
      lab.appendChild(el("span", "box"));
      lab.appendChild(el("span", "ctext", text));
      host.appendChild(lab);
      boxes.push(inp);
      inp.addEventListener("change", () => {
        Aud.tick();
        $("#admit").disabled = !boxes.every(b => b.checked);
      });
    });
    $("#admit").addEventListener("click", async () => {
      Aud.thud();
      setAct("act1");
      runIntake();
    });
  }

  /* ---------- generic question runner ---------- */
  function buildInput(q) {
    const wrap = el("div", "qinput");
    let getter, firstField;

    if (q.kind === "text") {
      const f = document.createElement("input");
      f.type = "text"; f.className = "field-text";
      f.maxLength = q.max || 90;
      f.placeholder = q.placeholder || "";
      f.autocomplete = "off"; f.spellcheck = false;
      wrap.appendChild(f);
      getter = () => f.value.trim();
      firstField = f;
    } else if (q.kind === "number") {
      const f = document.createElement("input");
      f.type = "number"; f.className = "field-num";
      f.min = q.min ?? 0; f.max = q.max ?? 999;
      f.placeholder = "0"; f.inputMode = "numeric";
      wrap.appendChild(f);
      getter = () => f.value === "" ? null : Math.max(q.min ?? 0, Math.min(q.max ?? 999, parseFloat(f.value)));
      firstField = f;
    } else if (q.kind === "duration") {
      const f = document.createElement("input");
      f.type = "number"; f.className = "field-num";
      f.min = 0; f.max = 99; f.placeholder = "0"; f.inputMode = "numeric";
      const sel = document.createElement("select");
      sel.className = "field-num";
      ["months", "years"].forEach(u => {
        const o = document.createElement("option"); o.value = u; o.textContent = u;
        sel.appendChild(o);
      });
      wrap.appendChild(f); wrap.appendChild(sel);
      getter = () => f.value === "" ? null : { value: Math.max(0, parseFloat(f.value)), unit: sel.value };
      firstField = f;
    } else if (q.kind === "monthyear") {
      const sel = document.createElement("select");
      sel.className = "field-num";
      const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
      months.forEach((m2, i) => {
        const o = document.createElement("option"); o.value = i + 1; o.textContent = m2;
        sel.appendChild(o);
      });
      const f = document.createElement("input");
      f.type = "number"; f.className = "field-num";
      f.min = 1950; f.max = new Date().getFullYear(); f.placeholder = "year"; f.inputMode = "numeric";
      wrap.appendChild(sel); wrap.appendChild(f);
      getter = () => f.value === "" ? null : { month: parseInt(sel.value, 10), year: parseInt(f.value, 10) };
      firstField = f;
    }

    const btn = el("button", "qsubmit", "RECORD");
    btn.type = "button";
    wrap.appendChild(btn);
    return { wrap, getter, btn, firstField };
  }

  /* ask one question into host; resolves with the recorded value */
  function ask(host, q, count) {
    return new Promise(async resolve => {
      host.innerHTML = "";
      const block = el("div", "qblock");
      block.appendChild(el("div", "qcount", count));
      const lab = el("h2", "qlabel");
      const sub = el("p", "qsub");
      const { wrap, getter, btn, firstField } = buildInput(q);
      const rej = el("p", "qreject", "");
      const hint = el("p", "qhint", "PRESS ENTER OR RECORD");
      block.appendChild(lab); block.appendChild(sub); block.appendChild(wrap);
      block.appendChild(rej); block.appendChild(hint);
      host.appendChild(block);

      await typeText(lab, q.labelFilled ?? q.label, 14);
      sub.textContent = q.subFilled ?? q.sub ?? "";

      const fields = wrap.querySelectorAll("input, select");
      fields.forEach(f => {
        f.addEventListener("keydown", e => {
          FX.keystroke(); Aud.tick();
          if (e.key === "Enter") { e.preventDefault(); submit(); }
        });
      });
      if (!window.__fast) firstField.focus();

      function submit() {
        const v = getter();
        const empty = v === null || v === "" || (typeof v === "object" && v && v.value === 0 && q.kind === "duration" && fields[0].value === "");
        if ((empty || v === "") && !q.optional) {
          rej.textContent = q.reject || "the chart requires an answer. a number, even an ugly one.";
          Aud.beepHigh();
          return;
        }
        if (q.kind === "monthyear" && v) {
          const now = new Date();
          if (v.year > now.getFullYear() || (v.year === now.getFullYear() && v.month > now.getMonth() + 1)) {
            rej.textContent = "the chart does not accept the future. when did you FIRST know?";
            Aud.beepHigh();
            return;
          }
          if (v.year < 1950) { rej.textContent = "a year. a real one."; Aud.beepHigh(); return; }
        }
        rej.textContent = "";
        Aud.thud();
        resolve(v ?? "");
      }
      btn.addEventListener("click", submit);

      /* harness hooks */
      currentField = firstField;
      currentSubmit = submit;
      window.__current = { id: q.id, fields, submit };
    });
  }

  function recordAnswer(q, v) {
    if (q.kind === "duration" && v) {
      Engine.set("duration_value", v.value); Engine.set("duration_unit", v.unit);
    } else if (q.kind === "monthyear" && v) {
      Engine.set("when_month", v.month); Engine.set("when_year", v.year);
    } else {
      Engine.set(q.id, v);
    }
  }

  /* ---------- act 1 + 2 ---------- */
  async function runIntake() {
    const host = $("#q-intake");
    for (let i = 0; i < DATA.intake.length; i++) {
      const q = DATA.intake[i];
      const v = await ask(host, q, `INTAKE ${i + 1} / ${DATA.intake.length}`);
      recordAnswer(q, v);
    }
    setAct("act2");
    runVitals();
  }

  async function runVitals() {
    const host = $("#q-vitals");
    for (let i = 0; i < DATA.vitals.length; i++) {
      const q = { ...DATA.vitals[i] };
      const r = Engine.derive();
      q.labelFilled = Engine.fill(q.label);
      if (q.id === "direct_define") q.labelFilled = `name the single action that most directly produces "${r.goal_clean}"`;
      const v = await ask(host, q, `VITALS ${i + 1} / ${DATA.vitals.length}`);
      recordAnswer(q, v);
    }
    setAct("act3");
    runExam();
  }

  /* ---------- act 3: cross-examination ---------- */
  async function runExam() {
    const host = $("#q-exam");
    const probes = Engine.selectProbes();
    for (let i = 0; i < probes.length; i++) {
      const q = { ...probes[i] };
      q.labelFilled = Engine.fill(q.label);
      q.subFilled = Engine.fill(q.sub || "");
      const v = await ask(host, q, `CROSS-EXAMINATION ${i + 1} / ${probes.length}`);
      recordAnswer(q, v);

      /* the arithmetic answer to WHEN lands immediately */
      if (q.id === "when_known") {
        const r = Engine.derive();
        if (r.days_known > 0) {
          const noted = el("p", "qnoted",
            `noted. that is <span class="days">${r.days_known.toLocaleString("en-US")} days</span> of knowing.`);
          host.querySelector(".qblock").appendChild(noted);
          Aud.beepHigh();
          await sleep(1600);
        }
      }
    }
    runImaging();
  }

  /* ---------- act 4: imaging ---------- */
  function shortGoal(r, n = 18) {
    let g = r.goal_clean;
    if (g.length > n) g = g.slice(0, n - 1).trimEnd() + "…";
    return g.toUpperCase();
  }

  async function runImaging() {
    const r = Engine.derive();
    setAct("act4");
    $("#img-alias").textContent = r.alias_clean.toUpperCase();
    const avoidLabel = (() => {
      const a = (r.avoid_clean || r.direct_clean).toUpperCase();
      if (a.length <= 24) return a;
      const cut = a.slice(0, 24);
      return cut.slice(0, cut.lastIndexOf(" ") > 10 ? cut.lastIndexOf(" ") : 24) + "…";
    })();
    const stations = [
      `PREPARATION ×${r.prep_count}`,
      "COMFORT",
      `AVOIDS: ${avoidLabel}`,
      `"${shortGoal(r)}" STARVES`,
      "THE CRISIS",
      "THE REBUILD",
    ];
    FX.initLoop(stations, 2);
    const orbits = Math.max(1, Math.round(r.chase_days / 365));
    FX.setLoopMeta(r.chase_label.toUpperCase(), orbits);
    await typeText($("#img-caption"),
      "the scan shows a closed circuit. the crisis at station 05 is not the cause. " +
      "station 03 is the cause. the loop has been running for " + r.chase_label + ".", 12);
  }

  /* ---------- act 5: diagnosis ---------- */
  async function runDiagnosis() {
    setAct("act5");
    const r = Engine.derive();
    FX.setState("racing");
    $("#to-chart").hidden = true;

    await typeText($("#dx-lead"), "compiling findings from the patient's own statements …", 16);
    await sleep(1200);

    /* the flatline */
    FX.setState("flat");
    Aud.flatStart();
    await sleep(reduced || window.__fast ? 100 : 1400);

    /* the sentence, typed against silence */
    const sent = $("#dx-sentence");
    const full = Engine.governingSentence();
    const refuseAt = full.indexOf("You refuse");
    const head = full.slice(0, refuseAt);
    const tail = full.slice(refuseAt);
    sent.innerHTML = "";
    const hs = el("span", "", ""), ts = el("span", "refuses", "");
    sent.appendChild(hs); sent.appendChild(ts);
    await typeText(hs, head, 26);
    await typeText(ts, tail, 30);

    Aud.flatStop();
    Aud.thud();
    await sleep(700);

    /* tail lines */
    const tailHost = $("#dx-tail");
    tailHost.innerHTML = "";
    for (const line of Engine.diagnosisTail()) {
      const p = el("div", "", line);
      tailHost.appendChild(p);
      await sleep(reduced || window.__fast ? 0 : 500);
    }

    /* condition stamps */
    const condHost = $("#dx-conds");
    condHost.innerHTML = "";
    const conds = Engine.diagnoseConditions();
    if (conds.length === 0) {
      const s = el("span", "stamp clear", "NO OBSTRUCTION FOUND");
      condHost.appendChild(s);
      await sleep(150); s.classList.add("show");
    } else {
      for (const c of conds) {
        const s = el("span", "stamp", `<span class="sc">${c.code}</span> ${c.name}`);
        condHost.appendChild(s);
        await sleep(reduced || window.__fast ? 10 : 420);
        s.classList.add("show");
        Aud.thud();
      }
    }
    FX.setState("recovery");
    await sleep(400);
    $("#to-chart").hidden = false;
  }

  /* ---------- act 6: the chart ---------- */
  function buildChart() {
    const r = Engine.derive();
    const host = $("#chart");
    host.innerHTML = "";

    const sec = (title, code) => {
      const s = el("div", "chart-sec");
      s.appendChild(el("div", "chart-h", `<span>${title}</span><span class="fcode">${code}</span>`));
      host.appendChild(s);
      return s;
    };

    /* patient ledger */
    const s1 = sec("PATIENT", "03-F/1");
    const led = el("table", "ledger");
    const rows = [
      ["patient", r.alias_clean],
      ["chasing", `${r.goal_clean} <span class="num">(for ${r.chase_label})</span>`],
      ["producing action", r.direct_clean],
      ["performed, 30 days", `<span class="num">${r.direct_count}</span>`],
      ["prepared, 30 days", `<span class="num">${r.prep_count}</span>`],
      ["consumption", `<span class="num">${r.consume_hours}h</span> / day watching other people live`],
      ["humans who know", `<span class="num">${r.told_count}</span>`],
      ["started / finished, this year", `<span class="num">${r.started_count} / ${r.finished_count}</span>`],
    ];
    rows.forEach(([k, v]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="k">${k}</td><td class="v">${v}</td>`;
      led.appendChild(tr);
    });
    s1.appendChild(led);

    /* diagnosis */
    const s2 = sec("DIAGNOSIS", "03-F/2");
    const full = Engine.governingSentence();
    const refuseAt = full.indexOf("You refuse");
    const dx = el("div", "dx-line",
      full.slice(0, refuseAt) + `<span class="refuses">${full.slice(refuseAt)}</span>`);
    s2.appendChild(dx);
    const tail = el("p", "qsub", Engine.diagnosisTail().join(" "));
    tail.style.marginTop = "14px";
    s2.appendChild(tail);

    /* findings */
    const s3 = sec("FINDINGS", "03-F/3");
    const conds = Engine.diagnoseConditions();
    if (conds.length === 0) {
      s3.appendChild(el("p", "finding-text", DATA.clearFinding));
    } else {
      conds.forEach(c => {
        const row = el("div", "finding-row");
        row.appendChild(el("span", "finding-code", c.code));
        const b = el("div", "finding-body",
          `<span class="finding-name">${c.name}</span><span class="finding-score">severity ${c.score}</span>` +
          `<div class="finding-text">${c.finding}</div>`);
        row.appendChild(b);
        s3.appendChild(row);
      });
    }

    /* contradictions, the patient quoted */
    const contras = Engine.contradictions();
    if (contras.length) {
      const s4 = sec("THE RECORD CONTRADICTS ITSELF", "03-F/4");
      contras.forEach(c => {
        const d = el("div", "contra");
        d.appendChild(el("div", "ca", c.a));
        d.appendChild(el("div", "cb" + (c.quote ? " q" : ""), c.b));
        s4.appendChild(d);
      });
    }

    /* prescription */
    const s5 = sec("PRESCRIPTION", "03-F/5");
    Engine.prescription().forEach(p => {
      const row = el("div", "rx-row");
      row.appendChild(el("span", "rx-n", "Rx" + p.n));
      row.appendChild(el("div", "rx-text", p.text));
      s5.appendChild(row);
    });

    /* closing note */
    host.appendChild(el("p", "closing-note", DATA.closing.join("<br>")));
  }

  /* ---------- chart card (1080 x 1350) ---------- */
  function drawCard() {
    const r = Engine.derive();
    const c = $("#cardcanvas"), g = c.getContext("2d");
    const W = 1080, H = 1350;
    const PAPER = "#F2EDE2", INK = "#161A1D", RED = "#B5121B",
          SOFT = "rgba(22,26,29,0.6)", RULE = "rgba(22,26,29,0.18)";

    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(28, 28, W - 56, H - 56);
    /* punched margin */
    g.strokeStyle = "rgba(181,18,27,0.3)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(96, 28); g.lineTo(96, H - 28); g.stroke();

    g.textAlign = "left"; g.fillStyle = INK;
    g.font = "700 92px Oswald, sans-serif";
    g.fillText("THE AUDIT", 130, 150);
    g.font = "400 22px 'Space Mono', monospace"; g.fillStyle = SOFT;
    g.fillText("EXAMINATION RECORD · RM 03", 132, 192);

    g.textAlign = "right";
    g.fillText("PATIENT: " + r.alias_clean.toUpperCase().slice(0, 18), W - 70, 150);
    g.textAlign = "left";

    /* rule */
    g.strokeStyle = RULE; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(130, 230); g.lineTo(W - 70, 230); g.stroke();

    /* DX box */
    g.font = "400 20px 'Space Mono', monospace"; g.fillStyle = RED;
    g.fillText("DIAGNOSIS", 132, 286);
    const full = Engine.governingSentence();
    const refuseAt = full.indexOf("You refuse");
    const head = full.slice(0, refuseAt).trim();
    const tail = full.slice(refuseAt).trim();
    g.font = "600 58px Oswald, sans-serif";
    let y = 352;
    y = wrapText(g, head, 132, y, W - 210, 66, INK);
    y = wrapText(g, tail, 132, y, W - 210, 66, RED);

    /* days known */
    if (r.days_known >= 30) {
      y += 40;
      g.font = "700 120px 'Space Mono', monospace"; g.fillStyle = INK;
      g.fillText(r.days_known.toLocaleString("en-US"), 132, y + 60);
      const nw = g.measureText(r.days_known.toLocaleString("en-US")).width;
      g.font = "400 24px 'Space Mono', monospace"; g.fillStyle = SOFT;
      g.fillText("DAYS OF KNOWING", 152 + nw, y + 56);
      y += 110;
    } else { y += 50; }

    /* condition stamps */
    const conds = Engine.diagnoseConditions().slice(0, 4);
    g.font = "700 26px 'Space Mono', monospace";
    let sy = y + 30;
    const labels = conds.length ? conds.map(cd => `${cd.code} · ${cd.name}`) : ["NO OBSTRUCTION FOUND"];
    labels.forEach((t2, i) => {
      const tw = g.measureText(t2).width + 44;
      g.save();
      g.translate(132 + 8, sy + i * 78);
      g.rotate((i % 2 === 0 ? -1 : 1) * 0.022);
      g.strokeStyle = RED; g.lineWidth = 3;
      g.strokeRect(0, -40, Math.min(tw, W - 280), 58);
      g.strokeRect(5, -35, Math.min(tw, W - 280) - 10, 48);
      g.fillStyle = RED;
      g.fillText(t2.slice(0, 52), 22, 0, W - 320);
      g.restore();
    });
    sy += labels.length * 78 + 30;

    /* vitals strip */
    g.strokeStyle = RULE; g.beginPath(); g.moveTo(130, sy); g.lineTo(W - 70, sy); g.stroke();
    g.font = "400 22px 'Space Mono', monospace"; g.fillStyle = SOFT;
    g.fillText(`PERFORMED ${r.direct_count} · PREPARED ${r.prep_count} · WITNESSES ${r.told_count} · FINISHED ${r.finished_count}/${r.started_count}`, 132, sy + 44);

    /* footer */
    g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(130, H - 170); g.lineTo(W - 70, H - 170); g.stroke();
    g.font = "italic 400 26px 'Atkinson Hyperlegible', sans-serif"; g.fillStyle = INK;
    g.fillText("this is not who you are forever. this is who you are right now.", 132, H - 122);
    g.font = "400 22px 'Space Mono', monospace"; g.fillStyle = SOFT;
    g.fillText("the examiner is waiting: " + SITE_URL, 132, H - 76);
  }

  function wrapText(g, text, x, y, maxW, lh, color) {
    g.fillStyle = color;
    const words = text.split(" ");
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) {
        g.fillText(line, x, y); y += lh; line = w;
      } else line = t;
    }
    if (line) { g.fillText(line, x, y); y += lh; }
    return y;
  }

  function initChartActions() {
    $("#dl-card").addEventListener("click", () => {
      drawCard();
      const a = document.createElement("a");
      a.download = "the-audit-chart.png";
      a.href = $("#cardcanvas").toDataURL("image/png");
      a.click();
      Aud.thud();
    });
    $("#copy-report").addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(Engine.reportText(SITE_URL));
        flash(this, "COPIED");
      } catch (e) { flash(this, "BLOCKED"); }
    });
    $("#restart").addEventListener("click", () => location.reload());
    function flash(btn, t) {
      const old = btn.textContent;
      btn.textContent = t; btn.classList.add("flash");
      setTimeout(() => { btn.textContent = old; btn.classList.remove("flash"); }, 1200);
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    buildStepper();
    initToggles();
    initAdmission();
    initChartActions();
    FX.start();
    FX.onBeat = pvc => { if (FX.getState() !== "flat") (pvc ? Aud.beepHigh() : Aud.beep()); };
    $("#to-diagnosis").addEventListener("click", runDiagnosis);
    $("#to-chart").addEventListener("click", () => { setAct("act6"); buildChart(); });
    updateStepper("act0");
  });

})();
