import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRegistrationGuide } from "../knowledge-base/registration-guide.js";

describe("getRegistrationGuide", () => {
  describe("returns guide for all property types", () => {
    const types = ["residential_flat", "commercial_office", "plot", "row_house", "villa"] as const;

    for (const type of types) {
      it(`returns guide for ${type}`, () => {
        const guide = getRegistrationGuide(type, "Surat");
        assert.ok(guide);
        assert.equal(guide.propertyType, type);
        assert.equal(guide.state, "Gujarat");
        assert.equal(guide.city, "Surat");
        assert.ok(guide.totalSteps >= 8, `expected >= 8 steps, got ${guide.totalSteps}`);
        assert.equal(guide.steps.length, guide.totalSteps);
      });
    }
  });

  describe("step completeness", () => {
    it("all steps have required fields", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      for (const step of guide.steps) {
        assert.ok(step.step > 0, "step number required");
        assert.ok(step.title.length > 0, "title required");
        assert.ok(step.description.length > 0, "description required");
        assert.ok(step.location.length > 0, "location required");
        assert.ok(Array.isArray(step.documentsNeeded), "documentsNeeded must be array");
        assert.ok(step.estimatedTime.length > 0, "estimatedTime required");
        assert.ok(Array.isArray(step.tips), "tips must be array");
      }
    });
  });

  describe("key steps are present", () => {
    it("includes e-stamping step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasEStamping = guide.steps.some(s =>
        s.title.toLowerCase().includes("stamp") || s.title.toLowerCase().includes("e-stamp")
      );
      assert.ok(hasEStamping, "should include e-stamping step");
    });

    it("includes biometric verification step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasBiometric = guide.steps.some(s =>
        s.title.toLowerCase().includes("biometric") || s.description.toLowerCase().includes("biometric")
      );
      assert.ok(hasBiometric, "should include biometric verification");
    });

    it("includes document preparation step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasDocPrep = guide.steps.some(s =>
        s.title.toLowerCase().includes("document") || s.title.toLowerCase().includes("prepare")
      );
      assert.ok(hasDocPrep, "should include document preparation step");
    });

    it("includes Sub-Registrar appointment step", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      const hasAppointment = guide.steps.some(s =>
        s.title.toLowerCase().includes("registrar") || s.title.toLowerCase().includes("appointment")
      );
      assert.ok(hasAppointment, "should include Sub-Registrar appointment step");
    });
  });

  describe("witness and biometric requirements", () => {
    it("requires 2 witnesses", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      assert.equal(guide.witnessRequirements.count, 2);
      assert.equal(guide.witnessRequirements.idRequired, true);
    });

    it("biometric required for buyer and seller", () => {
      const guide = getRegistrationGuide("residential_flat", "Surat");
      assert.equal(guide.biometricRequirements.required, true);
      assert.ok(guide.biometricRequirements.who.length >= 2);
    });
  });

  describe("defaults to Surat", () => {
    it("returns Surat guide when no city specified", () => {
      const guide = getRegistrationGuide("residential_flat");
      assert.equal(guide.city, "Surat");
    });
  });
});
