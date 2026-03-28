import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getApplicableRegulations,
  REGULATORY_REQUIREMENTS,
} from "../knowledge-base/regulatory-compliance.js";

describe("getApplicableRegulations", () => {
  it("MSA with personal data returns DPDPA", () => {
    const regs = getApplicableRegulations("msa", true, false);
    const shortNames = regs.map((r) => r.shortName);
    assert.ok(
      shortNames.some((n) => n.includes("DPDPA")),
      `expected DPDPA in [${shortNames.join(", ")}]`
    );
  });

  it("employment contract returns Labour Codes", () => {
    const regs = getApplicableRegulations("employment", false, false);
    const shortNames = regs.map((r) => r.shortName);
    assert.ok(
      shortNames.some((n) => n.includes("Labour")),
      `expected Labour Codes in [${shortNames.join(", ")}]`
    );
  });

  it("cross-border contract returns FEMA", () => {
    const regs = getApplicableRegulations("msa", false, true);
    const shortNames = regs.map((r) => r.shortName);
    assert.ok(
      shortNames.some((n) => n.includes("FEMA")),
      `expected FEMA in [${shortNames.join(", ")}]`
    );
  });

  it("any contract returns Arbitration Act (always applicable)", () => {
    const regs = getApplicableRegulations("nda", false, false);
    const shortNames = regs.map((r) => r.shortName);
    assert.ok(
      shortNames.some((n) => n.includes("Arbitration")),
      `expected Arbitration Act in [${shortNames.join(", ")}]`
    );
  });

  it("all regulations have required fields", () => {
    for (const reg of REGULATORY_REQUIREMENTS) {
      assert.ok(reg.id, "missing id");
      assert.ok(reg.regulation, `${reg.id} missing regulation`);
      assert.ok(reg.shortName, `${reg.id} missing shortName`);
      assert.ok(reg.applicableWhen, `${reg.id} missing applicableWhen`);
      assert.ok(
        Array.isArray(reg.requiredClauses) && reg.requiredClauses.length > 0,
        `${reg.id} missing or empty requiredClauses`
      );
      assert.ok(
        reg.penaltyForNonCompliance,
        `${reg.id} missing penaltyForNonCompliance`
      );
      assert.ok(reg.effectiveDate, `${reg.id} missing effectiveDate`);
    }
  });

  it("service agreements include GST Act", () => {
    const regs = getApplicableRegulations("service_agreement", false, false);
    const shortNames = regs.map((r) => r.shortName);
    assert.ok(
      shortNames.some((n) => n.includes("GST")),
      `expected GST Act in [${shortNames.join(", ")}]`
    );
  });
});
