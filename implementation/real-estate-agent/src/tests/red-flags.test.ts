import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RED_FLAGS } from "../knowledge-base/red-flags.js";

describe("RED_FLAGS", () => {
  it("has at least 15 red flag patterns", () => {
    assert.ok(RED_FLAGS.length >= 15, `Expected >= 15 flags, got ${RED_FLAGS.length}`);
  });

  it("all flags have required fields", () => {
    for (const flag of RED_FLAGS) {
      assert.ok(flag.id, "id is required");
      assert.ok(flag.category, "category is required");
      assert.ok(flag.pattern, "pattern is required");
      assert.ok(["critical", "high", "medium", "low", "ok"].includes(flag.severity), `invalid severity: ${flag.severity}`);
      assert.ok(flag.description.length > 0, "description is required");
      assert.ok(flag.action.length > 0, "action is required");
    }
  });

  it("all IDs are unique", () => {
    const ids = RED_FLAGS.map(f => f.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, "duplicate IDs found");
  });

  it("covers all expected categories", () => {
    const categories = new Set(RED_FLAGS.map(f => f.category));
    assert.ok(categories.has("rera"), "should have rera category");
    assert.ok(categories.has("land_records"), "should have land_records category");
    assert.ok(categories.has("legal"), "should have legal category");
    assert.ok(categories.has("financial"), "should have financial category");
    assert.ok(categories.has("builder"), "should have builder category");
  });

  it("has critical flags for the most dangerous issues", () => {
    const criticalPatterns = RED_FLAGS.filter(f => f.severity === "critical").map(f => f.pattern);
    assert.ok(criticalPatterns.includes("project_not_registered"));
    assert.ok(criticalPatterns.includes("registration_expired"));
    assert.ok(criticalPatterns.includes("seller_name_mismatch_7_12"));
    assert.ok(criticalPatterns.includes("agricultural_land_no_na"));
    assert.ok(criticalPatterns.includes("active_litigation"));
    assert.ok(criticalPatterns.includes("poa_sale_no_original_owner"));
  });

  it("RERA flags include project_not_registered and registration_expired", () => {
    const reraFlags = RED_FLAGS.filter(f => f.category === "rera");
    assert.ok(reraFlags.length >= 5);
    const patterns = reraFlags.map(f => f.pattern);
    assert.ok(patterns.includes("project_not_registered"));
    assert.ok(patterns.includes("registration_expired"));
    assert.ok(patterns.includes("carpet_area_mismatch"));
  });
});
