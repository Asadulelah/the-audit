/* THE AUDIT . data layer
   question banks, cross-examination probes, condition taxonomy, diagnosis grammar.
   every string speaks the clinic. no em dashes. */

const DATA = {

  meta: {
    title: "THE AUDIT",
    room: "EXAMINATION ROOM 03",
    tagline: "a clinic for the thing you keep not doing.",
    hours: "open from 3 AM. walk-ins only.",
  },

  consent: [
    "I understand the examiner cannot flatter me.",
    "I understand my own answers are the only instruments used.",
    "I want the real result.",
  ],

  /* ---------- ACT 1 . INTAKE ---------- */
  intake: [
    {
      id: "alias", kind: "text", optional: true, max: 24,
      label: "name for the chart",
      sub: "an alias is acceptable. the examiner does not care who you are. only what you do.",
      placeholder: "PATIENT", fallback: "PATIENT",
    },
    {
      id: "goal", kind: "text", max: 90,
      label: "state the result you are chasing",
      sub: "one sentence. a result, not an activity. something that either exists or does not.",
      placeholder: "people pay me for my work / the book exists / I can run 10k",
      reject: "the form rejects silence. write it.",
    },
    {
      id: "duration", kind: "duration",
      label: "how long have you been chasing it",
      sub: "honest figure. the chart will check it against everything you say next.",
    },
    {
      id: "strength", kind: "text", max: 70,
      label: "what are you undeniably good at",
      sub: "the thing a witness would confirm under oath. not modesty. capability.",
      placeholder: "building things / explaining things / endurance / design",
      reject: "everyone is undeniably good at something. the form waits.",
    },
    {
      id: "claim_hours", kind: "number", min: 0, max: 120,
      label: "hours in an average week you say you give it",
      sub: "your claim. a number.",
    },
  ],

  /* ---------- ACT 2 . VITALS ---------- */
  vitals: [
    {
      id: "direct_define", kind: "text", max: 80,
      label: "name the single action that most directly produces it",
      sub: "not preparation for the action. the action. the one with a witness or a receipt.",
      placeholder: "asking someone to pay / publishing the chapter / the run itself",
      reject: "there is always one. it is usually the one you flinched at just now.",
    },
    {
      id: "direct_count", kind: "number", min: 0, max: 999,
      label: "times you performed that action in the last 30 days",
      sub: "performed. not planned, not almost. a number.",
    },
    {
      id: "prep_count", kind: "number", min: 0, max: 999,
      label: "times you prepared instead",
      sub: "planned, researched, organized, rebuilt the system around it. last 30 days.",
    },
    {
      id: "consume_hours", kind: "number", min: 0, max: 24,
      label: "hours in an average day spent watching other people live",
      sub: "feeds, videos, streams, timelines. the honest daily figure.",
    },
    {
      id: "told_count", kind: "number", min: 0, max: 999,
      label: "how many living humans know you are chasing this",
      sub: "know specifically. not could guess.",
    },
    {
      id: "started_count", kind: "number", min: 0, max: 99,
      label: "things you started in the last year",
      sub: "projects, attempts, regimens. a number.",
    },
    {
      id: "finished_count", kind: "number", min: 0, max: 99,
      label: "things you finished in the last year",
      sub: "finished means a stranger could see the result.",
    },
  ],

  /* ---------- ACT 3 . CROSS-EXAMINATION ----------
     probes are selected by the engine from the evidence.
     {x} tokens are filled from the patient record. */
  probes: {
    AVOID: {
      id: "avoid", kind: "text", max: 90, always: true, order: 1,
      label: "name the one action you know you should take and have not taken.",
      sub: "you knew it before you finished reading the question.",
      placeholder: "write it plainly",
      reject: "you already thought it. the chart needs it in writing.",
    },
    WHEN: {
      id: "when_known", kind: "monthyear", always: true, order: 2,
      label: "when did you first know?",
      sub: "a month and a year. the chart will do the arithmetic.",
    },
    ZERO: {
      id: "p_zero", kind: "text", max: 140, order: 3,
      cond: r => r.direct_count === 0,
      severity: r => 100,
      label: "thirty days. zero performances of the action you yourself named.",
      sub: "the chart does not record a setback. it records a refusal. what were you protecting?",
      placeholder: "answer honestly. it is quoted back to you later.",
    },
    RATIO: {
      id: "p_ratio", kind: "text", max: 140, order: 3,
      cond: r => r.direct_count > 0 && r.prep_count >= r.direct_count * 2,
      severity: r => 40 + Math.min(40, (r.prep_count / Math.max(1, r.direct_count)) * 4),
      label: "you prepared {prep_count} times and performed {direct_count} times.",
      sub: "preparation outnumbers action {ratio} to one. what does preparing protect you from?",
      placeholder: "what does the ritual buy you?",
    },
    HOURS: {
      id: "p_hours", kind: "text", max: 140, order: 4,
      cond: r => r.claim_hours >= 10 && r.direct_count <= 4,
      severity: r => 30 + Math.min(40, r.claim_hours),
      label: "you report {claim_hours} hours a week given to this.",
      sub: "the action that produces it happened {direct_count} times in thirty days. where do the hours actually go?",
      placeholder: "account for them",
    },
    SECRET: {
      id: "p_secret", kind: "text", max: 140, order: 5,
      cond: r => r.told_count <= 1,
      severity: r => 55,
      label: "you are chasing this in near total secrecy.",
      sub: "a hidden attempt cannot fail in public, so it never has to end. who must not see you try?",
      placeholder: "name them, or name the fear",
    },
    CONSUME: {
      id: "p_consume", kind: "text", max: 140, order: 6,
      cond: r => r.consume_hours >= 3,
      severity: r => 20 + r.consume_hours * 6,
      label: "{consume_hours} hours a day watching other people live.",
      sub: "that is {consume_month} hours a month. what are their lives giving you that yours is not?",
      placeholder: "what is the feed a substitute for?",
    },
    FINISH: {
      id: "p_finish", kind: "text", max: 140, order: 7,
      cond: r => r.started_count > 0 && (r.finished_count === 0 || r.started_count - r.finished_count >= 3),
      severity: r => 35 + (r.started_count - r.finished_count) * 8,
      label: "{started_count} started. {finished_count} finished.",
      sub: "where do they go, the ones you abandon? name the last one you left.",
      placeholder: "name it",
    },
    INSTEAD: {
      id: "p_instead", kind: "text", max: 140, order: 8,
      cond: r => true,
      severity: r => 10,
      label: "when the action is available and you do not take it,",
      sub: "what do you do instead? be specific. the substitute matters.",
      placeholder: "the honest substitute",
    },
    FEAR: {
      id: "p_fear", kind: "text", max: 120, always: true, order: 99,
      label: "finish the sentence.",
      sub: "if I finally do it and it fails, then I am ______",
      placeholder: "finish it",
      reject: "the blank is the diagnosis. fill it.",
    },
  },

  maxOptionalProbes: 3,

  /* ---------- conditions taxonomy ---------- */
  conditions: [
    {
      code: "C1", name: "PREPARATION DEPENDENCY",
      test: r => r.direct_count === 0 ? r.prep_count > 0 : r.prep_count >= r.direct_count * 2,
      score: r => Math.min(99, Math.round((r.prep_count / Math.max(1, r.direct_count)) * 10) + 40),
      finding: "fear is being converted into systems. preparation has become the performance itself.",
    },
    {
      code: "C2", name: "REFUSAL OF THE DIRECT ACT",
      test: r => r.direct_count === 0,
      score: r => 99,
      finding: "the producing action is known, named on this chart, and untouched for thirty days.",
    },
    {
      code: "C3", name: "COMPLETION AVERSION",
      test: r => r.started_count > 0 && (r.finished_count === 0 || r.started_count - r.finished_count >= 3),
      score: r => Math.min(95, 40 + (r.started_count - r.finished_count) * 10),
      finding: "work is abandoned at the point where it could be judged. the last 20 percent is where the witness appears.",
    },
    {
      code: "C4", name: "AUDIENCE DEFICIT",
      test: r => r.told_count <= 1,
      score: r => 70,
      finding: "the attempt is hidden, so the failure can stay private, so the attempt can stay infinite.",
    },
    {
      code: "C5", name: "CONSUMPTION SUBSTITUTION",
      test: r => r.consume_hours >= 3,
      score: r => Math.min(90, 20 + r.consume_hours * 8),
      finding: "other people's motion is being consumed as a substitute for the patient's own.",
    },
    {
      code: "C6", name: "CHRONIC KNOWING",
      test: r => r.days_known >= 180,
      score: r => Math.min(99, Math.round(r.days_known / 10)),
      finding: "the required action has been known for {days_known} days. knowledge is not the deficiency.",
    },
  ],

  /* clean bill copy, if the patient is actually healthy */
  clearFinding: "the numbers hold. action outweighs preparation, work gets finished, the attempt is public. the examiner finds no obstruction. the chart suspects you came here to hear it.",

  /* ---------- prescription rules ---------- */
  prescriptions: [
    { cond: r => true, rank: 1,
      text: r => `${r.avoid_clean || r.direct_clean}: performed once within 24 hours of reading this chart. not prepared for. performed.` },
    { cond: r => r.told_count <= 1, rank: 2,
      text: r => "the attempt goes public. one named human is told what you are chasing, within 48 hours." },
    { cond: r => r.started_count - r.finished_count >= 3 || (r.started_count > 0 && r.finished_count === 0), rank: 3,
      text: r => "nothing new is started until one abandoned thing is finished. finished means a stranger can see it." },
    { cond: r => r.consume_hours >= 3, rank: 4,
      text: r => `consumption is capped at ${Math.max(1, r.consume_hours - 1)} hour${r.consume_hours - 1 === 1 ? "" : "s"} a day. the reclaimed hour belongs to the named action.` },
    { cond: r => true, rank: 9,
      text: r => "return in 30 days with new numbers. the chart keeps a copy of today." },
  ],

  closing: [
    "this is not who you are forever.",
    "this is who you are right now.",
    "the gap between those two sentences is the entire treatment.",
  ],

  acts: [
    { id: "act0", name: "ADMISSION" },
    { id: "act1", name: "INTAKE" },
    { id: "act2", name: "VITALS" },
    { id: "act3", name: "CROSS-EXAMINATION" },
    { id: "act4", name: "IMAGING" },
    { id: "act5", name: "DIAGNOSIS" },
    { id: "act6", name: "THE CHART" },
  ],
};
