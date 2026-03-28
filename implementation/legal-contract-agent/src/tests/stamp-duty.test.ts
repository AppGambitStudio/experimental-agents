import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookupStampDuty } from "../knowledge-base/stamp-duty.js";

describe("lookupStampDuty", () => {
  it("Gujarat Service Agreement at Rs 50L returns percentage-based duty capped at Rs 25,000", () => {
    const result = lookupStampDuty("Gujarat", "Service Agreement", 5000000);
    assert.ok(result.entry, "entry should not be null");
    assert.equal(result.entry.dutyType, "percentage");
    assert.equal(result.entry.maxCap, 25000);
    // 0.5% of 50L = 25,000 — exactly at the cap
    assert.equal(result.dutyAmount, 25000);
  });

  it("Gujarat NDA returns fixed Rs 100", () => {
    const result = lookupStampDuty("Gujarat", "NDA");
    assert.ok(result.entry, "entry should not be null");
    assert.equal(result.entry.dutyType, "fixed");
    assert.equal(result.dutyAmount, 100);
  });

  it("Gujarat Employment Agreement returns fixed Rs 300", () => {
    const result = lookupStampDuty("Gujarat", "Employment Agreement");
    assert.ok(result.entry, "entry should not be null");
    assert.equal(result.entry.dutyType, "fixed");
    assert.equal(result.dutyAmount, 300);
  });

  it("Maharashtra NDA returns fixed Rs 500", () => {
    const result = lookupStampDuty("Maharashtra", "NDA");
    assert.ok(result.entry, "entry should not be null");
    assert.equal(result.entry.dutyType, "fixed");
    assert.equal(result.dutyAmount, 500);
  });

  it("unknown state returns null entry and 0 duty", () => {
    const result = lookupStampDuty("UnknownState", "NDA");
    assert.equal(result.entry, null);
    assert.equal(result.dutyAmount, 0);
  });

  it("percentage duty caps are applied correctly when raw calculation exceeds cap", () => {
    // Gujarat Service Agreement: 0.5% of Rs 1 crore = Rs 50,000 but cap is 25,000
    const result = lookupStampDuty("Gujarat", "Service Agreement", 10000000);
    assert.ok(result.entry, "entry should not be null");
    assert.equal(result.dutyAmount, 25000, "duty should be capped at 25,000");
  });

  it("percentage duty returns raw calculation when below cap", () => {
    // Gujarat Service Agreement: 0.5% of Rs 10L = Rs 5,000 (below 25,000 cap)
    const result = lookupStampDuty("Gujarat", "Service Agreement", 1000000);
    assert.ok(result.entry, "entry should not be null");
    assert.equal(result.dutyAmount, 5000);
  });

  it("case-insensitive state and document type lookup", () => {
    const result = lookupStampDuty("gujarat", "nda");
    assert.ok(result.entry, "should find entry with lowercase input");
    assert.equal(result.dutyAmount, 100);
  });
});
