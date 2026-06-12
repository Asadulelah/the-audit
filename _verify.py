# THE AUDIT . verification harness
# drives three personas through the full examination, asserts the engine's
# diagnoses diverge correctly, screenshots every act, desktop + mobile, 0 errors.
import os, sys, pathlib, json
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).parent
URL = ROOT.joinpath("index.html").as_uri()
SHOTS = ROOT / "shots"
SHOTS.mkdir(exist_ok=True)

PERSONAS = {
    "refuser": {  # the world-class builder who refuses to sell
        "answers": {
            "alias": "the builder", "goal": "people pay me for my work",
            "duration": ("2", "years"), "strength": "building software", "claim_hours": "40",
            "direct_define": "asking someone to pay me", "direct_count": "0", "prep_count": "25",
            "consume_hours": "4", "told_count": "1", "started_count": "9", "finished_count": "1",
            "avoid": "ask a real client for money", "when_known": ("4", "2024"),
            "p_zero": "the version of me that might still succeed",
            "p_secret": "everyone who watched me start before",
            "p_consume": "proof that motion is possible",
            "p_finish": "the newsletter", "p_instead": "rebuild my tools again",
            "p_fear": "nothing special after all",
        },
        "expect_stamps": ["REFUSAL OF THE DIRECT ACT", "PREPARATION DEPENDENCY",
                          "COMPLETION AVERSION", "AUDIENCE DEFICIT",
                          "CONSUMPTION SUBSTITUTION", "CHRONIC KNOWING"],
        "expect_sentence": ["world-class at building software", "You refuse to ask a real client for money"],
        "expect_days_min": 700,
    },
    "secret": {  # healthy numbers, hidden attempt
        "answers": {
            "alias": "ghost", "goal": "the channel reaches 10k subscribers",
            "duration": ("8", "months"), "strength": "explaining hard things", "claim_hours": "6",
            "direct_define": "publishing a video", "direct_count": "12", "prep_count": "8",
            "consume_hours": "1", "told_count": "0", "started_count": "3", "finished_count": "2",
            "avoid": "showing my face on camera", "when_known": ("1", "2026"),
            "p_secret": "my family", "p_instead": "edit the same clip again",
            "p_fear": "embarrassing to the people I love",
        },
        "expect_stamps": ["AUDIENCE DEFICIT"],
        "absent_stamps": ["REFUSAL OF THE DIRECT ACT", "CHRONIC KNOWING"],
        "expect_sentence": ["world-class at explaining hard things", "You refuse showing my face on camera"],
    },
    "clear": {  # the clean bill
        "answers": {
            "alias": "control", "goal": "the essay collection exists",
            "duration": ("6", "months"), "strength": "design", "claim_hours": "8",
            "direct_define": "publishing the work", "direct_count": "20", "prep_count": "5",
            "consume_hours": "1", "told_count": "6", "started_count": "4", "finished_count": "3",
            "avoid": "publishing the longer essays", "when_known": ("5", "2026"),
            "p_instead": "polish what is already done", "p_fear": "ordinary",
        },
        "expect_clear": True,
        "expect_sentence": ["world-class at design"],
    },
}

FILL = """
(arg) => {
  const cur = window.__current;
  const fs = cur.fields;
  if (Array.isArray(arg)) {
    fs[0].value = arg[0];
    fs[1].value = arg[1];
  } else {
    fs[0].value = arg;
  }
  cur.submit();
  return cur.id;
}
"""

def run_persona(page, name, persona, shots_prefix, take_shots):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("window.__fast = true")
    page.evaluate("window.__step && window.__step(180)")
    if take_shots:
        page.screenshot(path=str(SHOTS / f"{shots_prefix}-act0-admission.png"))

    # consent + begin
    for box in page.query_selector_all(".consent label"):
        box.click()
    page.click("#admit")

    answered, guard = set(), 0
    while guard < 60:
        guard += 1
        act = page.evaluate("document.body.dataset.act")
        if act == "act4":
            break
        page.wait_for_function("window.__current && window.__current.id")
        qid = page.evaluate("window.__current.id")
        key = qid if qid in persona["answers"] else None
        if key is None:
            # duration / monthyear store under composite ids
            if qid == "duration": key = "duration"
            elif qid == "when_known": key = "when_known"
        val = persona["answers"].get(key, "an honest answer")
        if isinstance(val, tuple):
            # duration: (number, unit) -> fields [input, select]
            # monthyear: (month, year) -> fields [select, input]
            if qid == "duration":
                page.evaluate(FILL, [val[0], val[1]])
            else:
                page.evaluate(FILL, [val[0], val[1]])
                # monthyear fields order: [select(month), input(year)]
        else:
            page.evaluate(FILL, str(val))
        if (qid, act) in answered:
            pass
        answered.add((qid, act))
        # screenshots at interesting moments
        if take_shots and qid == "goal":
            page.screenshot(path=str(SHOTS / f"{shots_prefix}-act1-intake.png"))
        if take_shots and qid == "avoid":
            page.screenshot(path=str(SHOTS / f"{shots_prefix}-act3-exam.png"))
        page.wait_for_timeout(60)

    assert page.evaluate("document.body.dataset.act") == "act4", f"{name}: never reached imaging"
    page.evaluate("window.__step(240)")
    if take_shots:
        page.wait_for_timeout(900)
        page.screenshot(path=str(SHOTS / f"{shots_prefix}-act4-imaging.png"))

    page.click("#to-diagnosis")
    page.wait_for_selector("#to-chart:not([hidden])", timeout=15000)
    page.evaluate("window.__step(120)")
    if take_shots:
        page.wait_for_timeout(900)   # let act-in fade + stamp animations settle (realtime CSS)
        page.screenshot(path=str(SHOTS / f"{shots_prefix}-act5-diagnosis.png"))

    sentence = page.inner_text("#dx-sentence")
    for frag in persona.get("expect_sentence", []):
        assert frag in sentence, f"{name}: sentence missing '{frag}' . got: {sentence}"

    stamps = page.inner_text("#dx-conds")
    for s in persona.get("expect_stamps", []):
        assert s in stamps, f"{name}: missing stamp {s} . got: {stamps}"
    for s in persona.get("absent_stamps", []):
        assert s not in stamps, f"{name}: stamp {s} should NOT fire . got: {stamps}"
    if persona.get("expect_clear"):
        assert "NO OBSTRUCTION FOUND" in stamps, f"{name}: expected clean bill, got: {stamps}"

    page.click("#to-chart")
    page.wait_for_selector("#chart .chart-sec")
    page.evaluate("window.__step(120)")
    if take_shots:
        page.screenshot(path=str(SHOTS / f"{shots_prefix}-act6-chart.png"), full_page=True)

    chart = page.inner_text("#chart")
    if persona.get("expect_days_min"):
        days = page.evaluate("Engine.derive().days_known")
        assert days >= persona["expect_days_min"], f"{name}: days_known {days} < {persona['expect_days_min']}"
        assert "days" in chart.lower()
    assert "PRESCRIPTION" in chart and "Rx" in chart, f"{name}: prescription missing"
    assert "this is not who you are forever" in chart

    # chart card renders non-trivially
    with page.expect_download() as dl:
        page.click("#dl-card")
    size = len(page.evaluate("document.getElementById('cardcanvas').toDataURL()"))
    assert size > 60000, f"{name}: chart card looks blank ({size} bytes of dataURL)"

    report = page.evaluate("Engine.reportText('test')")
    assert "DIAGNOSIS" in report and "PRESCRIPTION" in report

    js_errs = page.evaluate("window.__errs")
    assert not js_errs and not errors, f"{name}: JS errors: {js_errs + errors}"
    print(f"  [ok] {name}: sentence='{sentence[:90]}' stamps={len(persona.get('expect_stamps', []))} card={size//1000}kB")

def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        print("DESKTOP 1440x900")
        for name, persona in PERSONAS.items():
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            run_persona(ctx.new_page(), name, persona, f"desktop-{name}", take_shots=(name == "refuser"))
            ctx.close()
        print("MOBILE 390x844")
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
        run_persona(ctx.new_page(), "refuser-mobile", PERSONAS["refuser"], "mobile-refuser", take_shots=True)
        # mobile horizontal overflow check
        page = ctx.new_page(); page.goto(URL); page.wait_for_load_state("networkidle")
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 0, f"mobile horizontal overflow: {overflow}px"
        ctx.close()
        browser.close()
    print("ALL CHECKS PASSED")

if __name__ == "__main__":
    main()
