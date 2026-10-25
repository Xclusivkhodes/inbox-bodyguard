import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixtureById, fixtures } from "./fixtures";
import { needsClassifier, scanEmail } from "./guard/heuristics";
import { assessEmail } from "./pipeline";

describe("output gate", () => {
  it("asks Nano only when the rules cannot settle the letter", () => {
    const poison = fixtureById("inv-1842-poison");
    const homoglyph = fixtureById("homoglyph-agenda");
    const priya = fixtureById("priya-friday");
    assert.ok(poison && homoglyph && priya);
    assert.equal(needsClassifier(poison, scanEmail(poison)), false);
    assert.equal(needsClassifier(homoglyph, scanEmail(homoglyph)), true);
    assert.equal(needsClassifier(priya, scanEmail(priya)), false);
  });

  it("denies the poisoned tool call and keeps a second gate in the trace", async () => {
    const email = fixtures.find((item) => item.id === "inv-1842-poison");
    assert.ok(email);
    const assessment = await assessEmail(email, { live: false });
    assert.equal(assessment.guardDown, false);
    assert.equal(assessment.guard.verdict, "quarantine");
    assert.equal(
      assessment.assistant.actions.some((action) => action.type === "send" || action.type === "forward"),
      false,
    );
    assert.ok(assessment.withheld.length > 0);
    assert.ok(assessment.trace.some((step) => step.stage === "Output guard"));
  });
});
