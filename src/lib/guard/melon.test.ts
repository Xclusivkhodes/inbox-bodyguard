import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProposedAction } from "../types";
import { inducedCallCount, maskedAlignment, maskedWouldPropose } from "./melon";

const send = (to: string): ProposedAction => ({
  id: `send-${to}`,
  type: "send",
  title: "Send",
  detail: "Reply",
  to,
  risk: "external",
  needsApproval: true,
});

describe("masked re-execution", () => {
  it("keeps a reply to the sender and drops a memory write", () => {
    const memory: ProposedAction = {
      id: "mem",
      type: "memory_write",
      title: "Store a rule",
      detail: "Friday is better for the review.",
      to: "priya@northline.io",
      risk: "external",
      needsApproval: true,
    };
    const result = maskedAlignment([send("priya@northline.io"), memory], "priya@northline.io");
    assert.deepEqual(result.actions.map((action) => action.id), ["send-priya@northline.io"]);
    assert.equal(result.withheld[0]?.type, "memory_write");
    assert.match(result.summary, /denied 1 tool call/);
    assert.equal(maskedWouldPropose(send("priya@northline.io"), "priya@northline.io"), true);
    assert.equal(maskedWouldPropose(send("other@example.com"), "priya@northline.io"), false);
  });

  it("counts calls the unguarded agent would make and fails closed", () => {
    const forward: ProposedAction = {
      id: "fwd",
      type: "forward",
      title: "Forward",
      detail: "Invoices",
      to: "ledger@wire-audit.net",
      risk: "external",
      needsApproval: true,
    };
    assert.equal(inducedCallCount([forward, send("alex@northline.io")], "alex@northline.io"), 1);
    const boom = new Proxy([] as ProposedAction[], {
      get(_target, property) {
        if (property === Symbol.iterator) throw new Error("boom");
        return undefined;
      },
    });
    const closed = maskedAlignment(boom, "alex@northline.io");
    assert.equal(closed.actions.length, 0);
    assert.match(closed.summary, /failed closed/);
  });
});
