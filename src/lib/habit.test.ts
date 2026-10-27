import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { morningBrief } from "./habit";
import type { EmailView } from "./types";

describe("morning brief links", () => {
  it("opens the first letter that needs a reply", () => {
    const email = {
      id: "po-1842",
      subject: "PO for invoice 1842",
      assessment: {
        guard: { verdict: "clear", sanitizedText: "Thursday 16:00 and £4,280." },
        assistant: { triage: "today" },
      },
    } as EmailView;
    const lines = morningBrief([email]);
    assert.equal(lines[0]?.href, "/inbox?letter=po-1842");
    assert.match(lines[1]?.detail ?? "", /Thursday/);
    assert.match(lines[2]?.detail ?? "", /£4,280/);
  });
});