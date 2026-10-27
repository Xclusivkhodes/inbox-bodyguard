import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dir = mkdtempSync(path.join(tmpdir(), "ib-store-"));
process.env.BODYGUARD_DB = path.join(dir, "t.db");
process.env.BODYGUARD_CACHE_PATH = path.join(dir, "cache.json");
process.env.DEMO_MODE = "true";
process.env.LLM_ENABLED = "false";

describe("memory", () => {
  it("seeds contacts and keeps a blocked injection out of applied memory", async () => {
    const { closeDb } = await import("./db");
    closeDb();
    const store = await import("./store");
    const memory = await store.getMemory();
    assert.equal(memory.principal.name, "Alex Rivera");
    assert.ok(memory.contacts.some((contact) => contact.email === "priya@northline.io"));
    assert.ok(memory.preferences.some((item) => item.key === "auto_send" && /never/i.test(item.value)));
    const poison = memory.events.find((event) => event.emailId === "inv-1842-poison");
    assert.equal(poison?.status, "blocked");
    const priya = memory.events.find((event) => event.emailId === "priya-friday");
    assert.equal(priya?.status, "applied");
  });

  it("saves a preference and restores letters on reset", async () => {
    const store = await import("./store");
    await store.setPreference("tone", "Shorter, still British spelling.");
    let memory = await store.getMemory();
    assert.equal(memory.preferences.find((item) => item.key === "tone")?.value, "Shorter, still British spelling.");
    await store.decide("po-1842", "po-1842-send", "approved");
    const email = await store.getEmail("po-1842");
    assert.equal(email?.decisions.at(-1)?.decision, "approved");
    assert.match(email?.decisions.at(-1)?.note ?? "", /No mail was transmitted/);
    assert.equal(Object.getPrototypeOf(email?.decisions.at(-1)), Object.prototype);
    const passed = await store.getInbox();
    assert.equal(Object.getPrototypeOf(passed.emails.find((item) => item.id === "po-1842")?.decisions.at(-1)), Object.prototype);
    await store.resetDemo();
    memory = await store.getMemory();
    const kept = memory.preferences.find((item) => item.key === "tone");
    assert.equal(kept?.value, "Shorter, still British spelling.");
    const again = await store.getEmail("po-1842");
    assert.equal(again?.decisions.length, 0);
    assert.ok((await store.getInbox()).emails.length >= 10);
  });

  it("adds a contact the user wrote and keeps it across reset", async () => {
    const store = await import("./store");
    await store.addContact({ name: "Nia Mensah", email: "Nia@Harborlight.co", organization: "Harborlight" });
    let memory = await store.getMemory();
    const added = memory.contacts.find((contact) => contact.email === "nia@harborlight.co");
    assert.equal(added?.source, "you");
    assert.match(added?.notes ?? "", /You added this/);
    await assert.rejects(() => store.addContact({ name: "Priya Shah", email: "priya@northline.io" }), /directory/);
    const letter = await store.getEmail("po-1842");
    assert.equal(letter?.assessment.cost.usd, 0);
    assert.match(letter?.assessment.cost.note ?? "", /No Token Factory call was made/);
    assert.ok(letter?.assessment.trace.some((step) => step.stage === "Masked re-execution"));
    await store.resetDemo();
    memory = await store.getMemory();
    assert.equal(memory.contacts.find((contact) => contact.email === "nia@harborlight.co")?.source, "you");
    assert.equal(memory.preferences.find((item) => item.key === "tone")?.value, "Shorter, still British spelling.");
  });
});
