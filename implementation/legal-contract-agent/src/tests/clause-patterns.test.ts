import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CLAUSE_PATTERNS } from "../knowledge-base/clause-patterns.js";

describe("CLAUSE_PATTERNS", () => {
  it("should have exactly 10 patterns", () => {
    assert.equal(CLAUSE_PATTERNS.length, 10);
  });

  it("every pattern has all required fields", () => {
    for (const p of CLAUSE_PATTERNS) {
      assert.ok(p.id, `pattern missing id`);
      assert.ok(p.patternName, `${p.id} missing patternName`);
      assert.ok(p.category, `${p.id} missing category`);
      assert.ok(p.riskLevel, `${p.id} missing riskLevel`);
      assert.ok(p.riskDescription, `${p.id} missing riskDescription`);
      assert.ok(p.riskDescriptionBusiness, `${p.id} missing riskDescriptionBusiness`);
      assert.ok(
        Array.isArray(p.applicableLaws) && p.applicableLaws.length > 0,
        `${p.id} missing or empty applicableLaws`
      );
      // exampleRiskyText can be empty for PAT-007 (missing clause pattern)
      assert.ok(
        typeof p.exampleRiskyText === "string",
        `${p.id} missing exampleRiskyText`
      );
      assert.ok(p.suggestedAlternative, `${p.id} missing suggestedAlternative`);
      assert.ok(
        p.negotiationTalkingPoint,
        `${p.id} missing negotiationTalkingPoint`
      );
    }
  });

  it("has at least one pattern per risk level: critical, high, medium", () => {
    const levels = new Set(CLAUSE_PATTERNS.map((p) => p.riskLevel));
    assert.ok(levels.has("critical"), "no critical-level pattern");
    assert.ok(levels.has("high"), "no high-level pattern");
    assert.ok(levels.has("medium"), "no medium-level pattern");
  });

  it("covers key categories: non_compete, indemnity, governing_law, ip_assignment, data_protection", () => {
    const categories = new Set(CLAUSE_PATTERNS.map((p) => p.category));
    for (const required of [
      "non_compete",
      "indemnity",
      "governing_law",
      "ip_assignment",
      "data_protection",
    ] as const) {
      assert.ok(categories.has(required), `missing category: ${required}`);
    }
  });

  it("each pattern has non-empty suggestedAlternative and negotiationTalkingPoint", () => {
    for (const p of CLAUSE_PATTERNS) {
      assert.ok(
        p.suggestedAlternative.length > 10,
        `${p.id} suggestedAlternative too short`
      );
      assert.ok(
        p.negotiationTalkingPoint.length > 10,
        `${p.id} negotiationTalkingPoint too short`
      );
    }
  });

  it("all pattern IDs are unique", () => {
    const ids = CLAUSE_PATTERNS.map((p) => p.id);
    assert.equal(ids.length, new Set(ids).size, "duplicate pattern IDs");
  });
});
