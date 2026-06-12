/* THE AUDIT . engine
   the examiner's brain: evidence record, probe selection, contradiction arithmetic,
   condition scoring, diagnosis grammar, prescription, full report compiler.
   deterministic. no network. every finding is built from the patient's own input. */

const Engine = (() => {

  const record = {};

  /* ---------- text hygiene ---------- */
  function clean(s, max = 80) {
    if (!s) return "";
    let t = String(s).trim().replace(/\s+/g, " ");
    t = t.replace(/[<>&]/g, "");   /* user text is rendered into markup; strip HTML metachars at the source */
    t = t.replace(/^["'“‘]+|["'’”.!?]+$/g, "").trim();
    if (t.length > max) t = t.slice(0, max - 1).trimEnd() + "…";
    return t;
  }

  /* lowercase the first letter unless it looks like a proper noun / acronym */
  function lcFirst(s) {
    if (!s) return s;
    if (/^[A-Z]{2,}/.test(s)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  /* strip leading scaffolding the patient may type ("I am good at", "to ", "I should") */
  function stripLead(s, kind) {
    let t = s;
    if (kind === "strength") {
      t = t.replace(/^(i\s*am\s*(undeniably\s*|really\s*|very\s*)?good\s*at\s*|i\s*am\s*a\s*|i\s*am\s*an\s*|being\s*|at\s*)/i, "");
    }
    if (kind === "action") {
      t = t.replace(/^(i\s*(should|need\s*to|have\s*to|must|want\s*to)\s*|to\s+|start\s+to\s+)/i, "");
    }
    return t.trim();
  }

  function set(id, value) { record[id] = value; }
  function get(id) { return record[id]; }
  function all() { return record; }

  /* ---------- derived arithmetic ---------- */
  function derive() {
    const r = record;
    r.alias_clean = clean(r.alias, 24) || "PATIENT";
    r.goal_clean = lcFirst(clean(r.goal, 90)) || "the result you named";
    r.strength_clean = lcFirst(stripLead(clean(r.strength, 70), "strength")) || "what you do";
    r.direct_clean = lcFirst(stripLead(clean(r.direct_define, 80), "action")) || "the direct action";
    r.avoid_clean = lcFirst(stripLead(clean(r.avoid, 90), "action")) || r.direct_clean;
    r.fear_clean = lcFirst(clean(r.p_fear, 120)) || "";

    r.direct_count = num(r.direct_count);
    r.prep_count = num(r.prep_count);
    r.consume_hours = num(r.consume_hours);
    r.told_count = num(r.told_count);
    r.started_count = num(r.started_count);
    r.finished_count = num(r.finished_count);
    r.claim_hours = num(r.claim_hours);

    r.ratio = r.direct_count > 0 ? Math.round(r.prep_count / r.direct_count) : r.prep_count;
    r.consume_month = Math.round(r.consume_hours * 30);

    /* duration of the chase, in days */
    r.chase_days = 0;
    if (r.duration_value > 0) {
      r.chase_days = Math.round(r.duration_value * (r.duration_unit === "years" ? 365 : 30));
    }
    r.chase_label = r.duration_value > 0
      ? `${r.duration_value} ${r.duration_unit === "years" ? (r.duration_value === 1 ? "year" : "years") : (r.duration_value === 1 ? "month" : "months")}`
      : "an unrecorded time";

    /* days since the patient first knew (month/year input) */
    r.days_known = 0;
    if (r.when_month >= 1 && r.when_year > 1900) {
      const then = new Date(r.when_year, r.when_month - 1, 15);
      const ms = Date.now() - then.getTime();
      r.days_known = Math.max(0, Math.round(ms / 86400000));
    }
    return r;
  }

  function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

  /* ---------- token filling ---------- */
  function fill(template) {
    const r = record;
    return String(template).replace(/\{(\w+)\}/g, (_, k) => {
      const v = r[k];
      return (v === undefined || v === null || v === "") ? "" : v;
    });
  }

  /* ---------- probe selection (cross-examination) ---------- */
  function selectProbes() {
    derive();
    const P = DATA.probes;
    const fixedFirst = [P.AVOID, P.WHEN];
    const fixedLast = [P.FEAR];
    const optional = Object.values(P)
      .filter(p => !p.always && p.cond && p.cond(record))
      .map(p => ({ p, sev: p.severity ? p.severity(record) : 0 }))
      .sort((a, b) => b.sev - a.sev)
      .slice(0, DATA.maxOptionalProbes)
      .sort((a, b) => a.p.order - b.p.order)
      .map(x => x.p);
    return [...fixedFirst, ...optional, ...fixedLast];
  }

  /* ---------- conditions ---------- */
  function diagnoseConditions() {
    derive();
    const hits = DATA.conditions
      .filter(c => c.test(record))
      .map(c => ({
        code: c.code, name: c.name,
        score: Math.round(c.score(record)),
        finding: fill(c.finding),
      }))
      .sort((a, b) => b.score - a.score);
    return hits;
  }

  /* ---------- the governing sentence ---------- */
  /* the refusal must read grammatically after "You refuse":
     gerunds and article-led noun phrases stand alone; bare verbs get "to". */
  function refusalPhrase() {
    const r = record;
    const a = r.avoid_clean || r.direct_clean;
    const w1 = a.split(" ")[0].toLowerCase();
    const noTo = /ing$/.test(w1) || ["the", "a", "an", "my", "our", "your", "that", "this", "to"].includes(w1);
    return noTo ? a : "to " + a;
  }

  function governingSentence() {
    derive();
    const r = record;
    return `You are world-class at ${r.strength_clean}. You refuse ${refusalPhrase()}.`;
  }

  function diagnosisTail() {
    const r = record;
    const lines = [];
    if (r.days_known >= 30) {
      lines.push(`You have known this for ${r.days_known.toLocaleString("en-US")} days.`);
    }
    if (r.chase_days >= 60) {
      lines.push(`You have been chasing it for ${r.chase_label}. Until the refusal breaks, the next ${r.chase_label} is already written.`);
    } else {
      lines.push(`Until the refusal breaks, the chart already knows how this ends.`);
    }
    return lines;
  }

  /* ---------- contradictions (quoted evidence) ---------- */
  function contradictions() {
    derive();
    const r = record;
    const list = [];
    if (r.claim_hours >= 10 && r.direct_count <= 4) {
      list.push({
        a: `claims ${r.claim_hours} hours a week given to "${r.goal_clean}"`,
        b: `performed the producing action ${r.direct_count} time${r.direct_count === 1 ? "" : "s"} in 30 days`,
      });
    }
    if (r.prep_count >= r.direct_count * 2 && r.prep_count > 0) {
      list.push({
        a: `prepared ${r.prep_count} times`,
        b: `acted ${r.direct_count} time${r.direct_count === 1 ? "" : "s"}. preparation is winning ${r.ratio} to one`,
      });
    }
    if (r.told_count <= 1 && r.chase_days >= 90) {
      list.push({
        a: `has chased this for ${r.chase_label}`,
        b: `${r.told_count === 0 ? "zero humans know" : "one human knows"}. the attempt is being kept deniable`,
      });
    }
    if (r.p_zero) {
      list.push({ a: `asked what zero attempts was protecting, the patient answered`, b: `"${clean(r.p_zero, 120)}"`, quote: true });
    }
    if (r.fear_clean) {
      list.push({ a: `if it fails, the patient believes they are`, b: `"${r.fear_clean}"`, quote: true });
    }
    return list;
  }

  /* ---------- prescription ---------- */
  function prescription() {
    derive();
    return DATA.prescriptions
      .filter(p => p.cond(record))
      .sort((a, b) => a.rank - b.rank)
      .map((p, i) => ({ n: i + 1, text: p.text(record) }));
  }

  /* is the patient actually clear? */
  function isClear() {
    return diagnoseConditions().length === 0;
  }

  /* ---------- full report (plain text, copyable) ---------- */
  function reportText(url) {
    derive();
    const r = record;
    const conds = diagnoseConditions();
    const rx = prescription();
    const L = [];
    L.push("THE AUDIT . EXAMINATION RECORD");
    L.push(`patient: ${r.alias_clean}`);
    L.push("");
    L.push("CHASING: " + r.goal_clean + ` (for ${r.chase_label})`);
    L.push("PRODUCING ACTION: " + r.direct_clean);
    L.push("");
    L.push("VITALS, LAST 30 DAYS");
    L.push(`  performed: ${r.direct_count} . prepared: ${r.prep_count} . consumption: ${r.consume_hours}h/day`);
    L.push(`  humans who know: ${r.told_count} . started/finished this year: ${r.started_count}/${r.finished_count}`);
    L.push("");
    if (conds.length) {
      L.push("FINDINGS");
      conds.forEach(c => L.push(`  [${c.code}] ${c.name} (${c.score}) . ${c.finding}`));
    } else {
      L.push("FINDINGS");
      L.push("  none. " + DATA.clearFinding);
    }
    L.push("");
    L.push("DIAGNOSIS");
    L.push("  " + governingSentence());
    diagnosisTail().forEach(t => L.push("  " + t));
    L.push("");
    L.push("PRESCRIPTION");
    rx.forEach(p => L.push(`  ${p.n}. ${p.text}`));
    L.push("");
    DATA.closing.forEach(c => L.push(c));
    if (url) { L.push(""); L.push("the examiner is waiting: " + url); }
    return L.join("\n");
  }

  return {
    set, get, all, derive, fill, clean,
    selectProbes, diagnoseConditions, governingSentence, diagnosisTail,
    contradictions, prescription, isClear, reportText,
  };
})();
