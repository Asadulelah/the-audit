# THE AUDIT

**a clinic for the thing you keep not doing.**

A 15-minute examination that interviews you, checks your claims against your own numbers, cross-examines the contradictions, and hands you a chart with your own governing sentence on it.

> You are world-class at ______. You refuse ______.

Live: **[the-audit-room.vercel.app](https://the-audit-room.vercel.app)**

## Where it comes from

In April 2026 I asked for a no-mercy audit of my own life at 3 AM and got back one sentence that reorganized everything: *"You are a world-class builder who refuses to sell."* The sentence worked because every word of the evidence was mine. Nobody invented anything. Someone just refused to look away.

Almost nobody has a friend brutal enough to do that for them. This is the machine version of that friend.

## How the examination works

1. **INTAKE.** What you are chasing, for how long, and what you are undeniably good at.
2. **VITALS.** Last 30 days, numbers only. Times you performed the action that actually produces the result, versus times you prepared to.
3. **CROSS-EXAMINATION.** The form notices the gaps between your claims and your numbers and asks about them. Your answers get quoted back to you later.
4. **IMAGING.** Your loop, rendered: preparation, comfort, avoidance, starvation, crisis, rebuild. The crisis is not the cause. Station 03 is the cause.
5. **DIAGNOSIS.** The monitor flatlines. Your sentence appears. It is built from your own words.
6. **THE CHART.** Findings, contradictions, a prescription with deadlines, and a downloadable record card.

## The honesty line

No AI judged you. The examiner is arithmetic and your own words. There is no server, no account, no analytics, no storage. Nothing you type leaves the page. The machine only refuses to look away.

## Run it

It is a static page. Open `index.html`, or serve the folder with anything.

```
python -m http.server 8000
```

## Verify it

The Playwright harness drives three personas through the full examination (a refuser, a secret chaser, and a clean bill), asserts the diagnoses diverge correctly, and screenshots every act on desktop and mobile.

```
pip install playwright && playwright install chromium
python _verify.py
```

## Anatomy

```
index.html        the six acts
css/base.css      the clinic: chart paper, examiner's ink, x-ray phosphor, one alarm red
css/components.css forms, stamps, the printed record
js/data.js        every question, probe, condition, and prescription rule
js/engine.js      the examiner: probe selection, contradiction arithmetic, diagnosis grammar
js/fx.js          the ECG monitor (it is a character) + the imaging loop
js/audio.js       synthesized clinic: room tone, monitor beep, the flatline
js/app.js         the attending physician
_verify.py        the harness
```

MIT. Take the examination before you fork it.
