import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getContractLimitations,
  formatLimitationsDisclaimer,
  CONTRACT_LIMITATIONS,
} from "../knowledge-base/negative-constraints.js";

describe("getContractLimitations", () => {
  it("returns all 10 limitations when no phase is provided", () => {
    const limitations = getContractLimitations();
    assert.equal(limitations.length, 10);
  });

  it("each limitation has required fields: id, limitation, severity, reason, whatUserShouldDo", () => {
    for (const lim of CONTRACT_LIMITATIONS) {
      assert.ok(lim.id, "missing id");
      assert.ok(lim.limitation, `${lim.id} missing limitation`);
      assert.ok(lim.severity, `${lim.id} missing severity`);
      assert.ok(lim.reason, `${lim.id} missing reason`);
      assert.ok(lim.whatUserShouldDo, `${lim.id} missing whatUserShouldDo`);
      assert.ok(lim.applicablePhase, `${lim.id} missing applicablePhase`);
    }
  });

  it("has at least 2 critical limitations", () => {
    const critical = CONTRACT_LIMITATIONS.filter(
      (l) => l.severity === "critical"
    );
    assert.ok(
      critical.length >= 2,
      `expected at least 2 critical, got ${critical.length}`
    );
  });

  it("filters by phase when phase is provided", () => {
    const reviewLimitations = getContractLimitations("review");
    assert.ok(reviewLimitations.length > 0, "should have review-phase limitations");
    for (const lim of reviewLimitations) {
      assert.equal(
        lim.applicablePhase,
        "review",
        `${lim.id} has wrong phase: ${lim.applicablePhase}`
      );
    }
  });

  it("all limitation IDs are unique", () => {
    const ids = CONTRACT_LIMITATIONS.map((l) => l.id);
    assert.equal(ids.length, new Set(ids).size, "duplicate limitation IDs");
  });
});

describe("formatLimitationsDisclaimer", () => {
  it("includes key warning text about not being a substitute for legal advice", () => {
    const disclaimer = formatLimitationsDisclaimer();
    assert.ok(
      disclaimer.includes("NOT a substitute"),
      "should include 'NOT a substitute' warning"
    );
  });

  it("includes Limitations and Disclaimer header", () => {
    const disclaimer = formatLimitationsDisclaimer();
    assert.ok(
      disclaimer.includes("Limitations and Disclaimer"),
      "should include section header"
    );
  });

  it("includes critical limitations section", () => {
    const disclaimer = formatLimitationsDisclaimer();
    assert.ok(
      disclaimer.includes("Critical Limitations"),
      "should include Critical Limitations section"
    );
  });

  it("includes advice to consult an advocate", () => {
    const disclaimer = formatLimitationsDisclaimer();
    assert.ok(
      disclaimer.includes("consult a qualified advocate"),
      "should include advocate consultation advice"
    );
  });
});
