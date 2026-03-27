import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateTotalCost, formatCostBreakdown } from "../knowledge-base/total-cost.js";
import type { TotalCostInput } from "../knowledge-base/total-cost.js";

function makeInput(overrides: Partial<TotalCostInput> = {}): TotalCostInput {
  return {
    propertyType: "residential_flat",
    totalPrice: 5000000,
    declaredValue: 5000000,
    carpetAreaSqft: 800,
    buyerGender: "male",
    isFirstProperty: true,
    isUnderConstruction: false,
    ...overrides,
  };
}

describe("calculateTotalCost", () => {
  describe("basic calculation — no cash, ready to move", () => {
    it("correctly calculates government fees", () => {
      const result = calculateTotalCost(makeInput());
      // stamp duty = 5000000 * 0.035 = 175000
      assert.equal(result.stampDuty, 175000);
      // registration = 5000000 * 0.01 = 50000
      assert.equal(result.registrationFee, 50000);
      // no GST for ready-to-move
      assert.equal(result.gst, 0);
      assert.equal(result.gstApplicable, false);
      assert.equal(result.totalGovernmentFees, 175000 + 50000);
    });

    it("has zero cash component", () => {
      const result = calculateTotalCost(makeInput());
      assert.equal(result.cashComponent, 0);
      assert.equal(result.cashPercentage, 0);
    });

    it("grand total is greater than agreed price", () => {
      const result = calculateTotalCost(makeInput());
      assert.ok(result.grandTotal > result.agreedPrice);
    });
  });

  describe("cash component analysis", () => {
    it("correctly splits bank and cash", () => {
      const result = calculateTotalCost(makeInput({
        totalPrice: 5000000,
        declaredValue: 3500000,
      }));
      assert.equal(result.cashComponent, 1500000);
      assert.equal(result.cashPercentage, 30);
    });

    it("stamp duty calculated on DECLARED value only", () => {
      const result = calculateTotalCost(makeInput({
        totalPrice: 5000000,
        declaredValue: 3500000,
      }));
      // stamp duty on declared: 3500000 * 0.035 = 122500
      assert.equal(result.stampDuty, 122500);
    });

    it("generates legal risk for cash > 50%", () => {
      const result = calculateTotalCost(makeInput({
        totalPrice: 5000000,
        declaredValue: 2000000,
      }));
      const criticalRisk = result.legalRisks.find(r => r.severity === "critical");
      assert.ok(criticalRisk, "should have critical risk for 60% cash");
    });

    it("generates critical risk when declared < 70% of actual", () => {
      const result = calculateTotalCost(makeInput({
        totalPrice: 5000000,
        declaredValue: 3000000, // 60% of actual
      }));
      const riskAboutDeclaration = result.legalRisks.find(r =>
        r.description.includes("less than 70%")
      );
      assert.ok(riskAboutDeclaration);
    });

    it("no legal risks when no cash component", () => {
      const result = calculateTotalCost(makeInput());
      assert.equal(result.legalRisks.length, 0);
    });
  });

  describe("GST calculation", () => {
    it("applies 5% GST for under-construction > ₹45L", () => {
      const result = calculateTotalCost(makeInput({
        isUnderConstruction: true,
        declaredValue: 5000000,
        totalPrice: 5000000,
      }));
      assert.equal(result.gstApplicable, true);
      assert.equal(result.gst, 250000); // 5% of 5000000
    });

    it("applies 1% GST for affordable housing (≤ ₹45L)", () => {
      const result = calculateTotalCost(makeInput({
        isUnderConstruction: true,
        totalPrice: 4000000,
        declaredValue: 4000000,
      }));
      assert.equal(result.gstApplicable, true);
      assert.equal(result.gst, 40000); // 1% of 4000000
    });

    it("no GST for ready-to-move", () => {
      const result = calculateTotalCost(makeInput({
        isUnderConstruction: false,
      }));
      assert.equal(result.gst, 0);
      assert.equal(result.gstApplicable, false);
    });
  });

  describe("female buyer discount", () => {
    it("applies ₹10,000 registration discount for female first-time buyer", () => {
      const male = calculateTotalCost(makeInput({ buyerGender: "male" }));
      const female = calculateTotalCost(makeInput({ buyerGender: "female" }));
      assert.equal(male.registrationFee - female.registrationFee, 10000);
    });

    it("no discount if not first property", () => {
      const first = calculateTotalCost(makeInput({ buyerGender: "female", isFirstProperty: true }));
      const notFirst = calculateTotalCost(makeInput({ buyerGender: "female", isFirstProperty: false }));
      assert.equal(first.registrationFee + 10000, notFirst.registrationFee);
    });
  });

  describe("builder charges with defaults", () => {
    it("uses default maintenance deposit when not provided", () => {
      const result = calculateTotalCost(makeInput({ carpetAreaSqft: 1000 }));
      // default = 75 * 1000 = 75000
      assert.equal(result.maintenanceDeposit, 75000);
    });

    it("uses provided maintenance deposit per sqft", () => {
      const result = calculateTotalCost(makeInput({
        carpetAreaSqft: 1000,
        maintenanceDepositPerSqft: 100,
      }));
      assert.equal(result.maintenanceDeposit, 100000);
    });

    it("uses default corpus fund when not provided", () => {
      const result = calculateTotalCost(makeInput({ carpetAreaSqft: 1000 }));
      // default = 50 * 1000 = 50000
      assert.equal(result.corpusFund, 50000);
    });

    it("uses provided corpus fund", () => {
      const result = calculateTotalCost(makeInput({ corpusFund: 75000 }));
      assert.equal(result.corpusFund, 75000);
    });

    it("uses parking defaults by type", () => {
      const covered = calculateTotalCost(makeInput({ parkingType: "covered" }));
      assert.equal(covered.parkingCharges, 300000);

      const open = calculateTotalCost(makeInput({ parkingType: "open" }));
      assert.equal(open.parkingCharges, 100000);

      const stilt = calculateTotalCost(makeInput({ parkingType: "stilt" }));
      assert.equal(stilt.parkingCharges, 200000);
    });

    it("no parking charges for 'none' type", () => {
      const result = calculateTotalCost(makeInput({ parkingType: "none" }));
      assert.equal(result.parkingCharges, 0);
    });
  });

  describe("commercial property rates", () => {
    it("applies 4.9% stamp duty for commercial_office", () => {
      const result = calculateTotalCost(makeInput({
        propertyType: "commercial_office",
        totalPrice: 5000000,
        declaredValue: 5000000,
      }));
      assert.equal(result.stampDuty, 245000); // 4.9%
    });
  });

  describe("future tax impact", () => {
    it("calculates additional tax burden from under-declaration", () => {
      const result = calculateTotalCost(makeInput({
        totalPrice: 5000000,
        declaredValue: 3500000,
      }));
      const impact = result.futureTaxImpact;
      assert.equal(impact.declaredCostBasis, 3500000);
      assert.equal(impact.actualCostBasis, 5000000);
      // assumed sale = 5000000 * 1.5 = 7500000
      assert.equal(impact.ifSoldAt, 7500000);
      // CG on declared = 7500000 - 3500000 = 4000000
      // CG on actual = 7500000 - 5000000 = 2500000
      // additional burden = (4000000 - 2500000) * 0.125 = 187500
      assert.equal(impact.additionalTaxBurden, 187500);
    });

    it("no additional burden when no cash component", () => {
      const result = calculateTotalCost(makeInput());
      assert.equal(result.futureTaxImpact.additionalTaxBurden, 0);
    });
  });

  describe("over listed price calculation", () => {
    it("calculates percentage over listed price", () => {
      const result = calculateTotalCost(makeInput());
      assert.equal(result.overListedPrice, result.grandTotal - result.agreedPrice);
      assert.ok(result.overListedPricePercent > 0);
    });
  });
});

describe("formatCostBreakdown", () => {
  it("returns a non-empty markdown string", () => {
    const breakdown = calculateTotalCost(makeInput());
    const formatted = formatCostBreakdown(breakdown);
    assert.ok(formatted.length > 0);
    assert.ok(formatted.includes("Total Cost Breakdown"));
    assert.ok(formatted.includes("Grand Total"));
  });

  it("includes legal risks section when risks exist", () => {
    const breakdown = calculateTotalCost(makeInput({
      totalPrice: 5000000,
      declaredValue: 2000000,
    }));
    const formatted = formatCostBreakdown(breakdown);
    assert.ok(formatted.includes("Legal Risks"));
  });

  it("includes future tax impact when under-declared", () => {
    const breakdown = calculateTotalCost(makeInput({
      totalPrice: 5000000,
      declaredValue: 3000000,
    }));
    const formatted = formatCostBreakdown(breakdown);
    assert.ok(formatted.includes("Capital Gains Tax Impact"));
  });
});
