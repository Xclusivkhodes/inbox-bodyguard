import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixtureById, fixtures } from "./fixtures";
import { needsClassifier, scanEmail } from "./guard/heuristics";
import { assessEmail } from "./pipeline";
import type { Fixture } from "./types";

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
    assert.ok(assessment.trace.some((step) => step.stage === "Masked re-execution"));
    assert.equal(assessment.cost.usd, 0);
    assert.match(assessment.cost.note, /No Token Factory call was made/);
  });

  it("withholds a memory write and still offers a reply to the sender", async () => {
    const email: Fixture = {
      id: "melon-memory",
      kind: "benign",
      channel: "text",
      inInbox: false,
      threadId: "thread-melon",
      fromName: "Priya Shah",
      fromEmail: "priya@northline.io",
      toEmail: "alex@northline.io",
      subject: "Friday",
      text: "Friday is better for the design review.",
      receivedAt: "2026-10-22T12:00:00.000Z",
      demoAssistant: {
        summary: "Priya prefers Friday.",
        triage: "today",
        draft: "Friday works.",
        actions: [
          {
            id: "melon-send",
            type: "send",
            title: "Send reply to Priya",
            detail: "Confirms Friday.",
            to: "priya@northline.io",
            risk: "external",
            needsApproval: true,
          },
          {
            id: "melon-memory",
            type: "memory_write",
            title: "Store a scheduling note",
            detail: "Friday is better for the design review.",
            to: "priya@northline.io",
            risk: "external",
            needsApproval: true,
          },
        ],
      },
    };
    const assessment = await assessEmail(email);
    assert.equal(assessment.guard.verdict, "clear");
    assert.equal(assessment.assistant.actions.some((action) => action.id === "melon-send"), true);
    assert.equal(assessment.assistant.actions.some((action) => action.type === "memory_write"), false);
    assert.equal(assessment.withheld.some((action) => action.type === "memory_write"), true);
  });

  it("lets a person the user added receive a reply", async () => {
    const email: Fixture = {
      id: "melon-contact",
      kind: "benign",
      channel: "text",
      inInbox: false,
      threadId: "thread-contact",
      fromName: "Priya Shah",
      fromEmail: "priya@northline.io",
      toEmail: "alex@northline.io",
      subject: "Introduction",
      text: "Please reply to Nia about the workshop notes.",
      receivedAt: "2026-10-22T12:30:00.000Z",
      demoAssistant: {
        summary: "Priya mentions Nia.",
        triage: "today",
        draft: "Thanks, I will write to Nia.",
        actions: [
          {
            id: "nia-send",
            type: "send",
            title: "Send a note to Nia",
            detail: "Workshop notes.",
            to: "nia@harborlight.co",
            risk: "external",
            needsApproval: true,
          },
        ],
      },
    };
    const blocked = await assessEmail(email);
    assert.equal(blocked.assistant.actions.some((action) => action.to === "nia@harborlight.co"), false);
    const allowed = await assessEmail(email, { extraRecipients: ["Nia@Harborlight.co"] });
    assert.equal(allowed.assistant.actions.some((action) => action.to === "nia@harborlight.co"), true);
  });
});
