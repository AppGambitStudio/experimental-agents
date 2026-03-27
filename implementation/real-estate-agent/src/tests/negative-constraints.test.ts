import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NEGATIVE_CONSTRAINTS, getConstraintsForPhase, formatConstraintsDisclaimer } from "../knowledge-base/negative-constraints.js";

describe("NEGATIVE_CONSTRAINTS", () => {
  it("has at least 10 constraints", () => {
    assert.ok(NEGATIVE_CONSTRAINTS.length >= 10, `expected >= 10, got ${NEGATIVE_CONSTRAINTS.length}`);
  });

  it("all constraints have required fields", () => {
    for (const c of NEGATIVE_CONSTRAINTS) {
      assert.ok(c.id, "id required");
      assert.ok(c.limitation, "limitation required");
      assert.ok(c.reason.length > 0, `reason required for ${c.id}`);
      assert.ok(c.whatBuyerShouldDo.length > 0, `whatBuyerShouldDo required for ${c.id}`);
      assert.ok(c.phase.length > 0, `phase required for ${c.id}`);
      assert.ok(["critical", "important", "informational"].includes(c.severity), `invalid severity for ${c.id}`);
    }
  });

  it("all IDs are unique", () => {
    const ids = NEGATIVE_CONSTRAINTS.map(c => c.id);
    assert.equal(ids.length, new Set(ids).size, "duplicate IDs");
  });

  it("covers key blind spots", () => {
    const limitations = NEGATIVE_CONSTRAINTS.map(c => c.limitation.toLowerCase());
    assert.ok(limitations.some(l => l.includes("oral") || l.includes("unregistered")), "should mention oral/unregistered agreements");
    assert.ok(limitations.some(l => l.includes("physical") || l.includes("site")), "should mention physical inspection");
    assert.ok(limitations.some(l => l.includes("encumbrance") || l.includes("bank")), "should mention hidden encumbrances");
  });
});

describe("getConstraintsForPhase", () => {
  it("returns constraints for due_diligence phase", () => {
    const constraints = getConstraintsForPhase("due_diligence");
    assert.ok(constraints.length > 0);
  });

  it("returns constraints for registration phase", () => {
    const constraints = getConstraintsForPhase("registration");
    assert.ok(constraints.length > 0);
  });

  it("returns all constraints when no phase specified", () => {
    const all = getConstraintsForPhase();
    assert.equal(all.length, NEGATIVE_CONSTRAINTS.length);
  });
});

describe("formatConstraintsDisclaimer", () => {
  it("returns non-empty string", () => {
    const disclaimer = formatConstraintsDisclaimer("due_diligence");
    assert.ok(disclaimer.length > 0);
    assert.ok(disclaimer.includes("CANNOT"));
  });

  it("includes buyer action items", () => {
    const disclaimer = formatConstraintsDisclaimer("due_diligence");
    assert.ok(disclaimer.includes("should") || disclaimer.includes("recommend") || disclaimer.includes("must"));
  });
});
