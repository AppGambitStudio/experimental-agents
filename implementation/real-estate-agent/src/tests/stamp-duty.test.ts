import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateStampDuty } from "../knowledge-base/stamp-duty.js";

describe("calculateStampDuty", () => {
  describe("residential properties", () => {
    it("calculates 3.5% stamp duty for residential_flat", () => {
      const result = calculateStampDuty("residential_flat", 5000000, "male");
      assert.equal(result.state, "Gujarat");
      assert.equal(result.contractValue, 5000000);
      // stamp duty = 5000000 * 0.035 = 175000
      // registration = 5000000 * 0.01 = 50000
      assert.equal(result.dutyAmount, 175000 + 50000);
      assert.equal(result.eStampingAvailable, true);
      assert.equal(result.registrationRequired, true);
    });

    it("calculates 3.5% for row_house", () => {
      const result = calculateStampDuty("row_house", 8000000, "male");
      // stamp = 280000, reg = 80000
      assert.equal(result.dutyAmount, 280000 + 80000);
    });

    it("calculates 3.5% for villa", () => {
      const result = calculateStampDuty("villa", 10000000, "male");
      // stamp = 350000, reg = 100000
      assert.equal(result.dutyAmount, 350000 + 100000);
    });
  });

  describe("commercial properties", () => {
    it("calculates 4.9% stamp duty for commercial_office", () => {
      const result = calculateStampDuty("commercial_office", 5000000, "male");
      // stamp = 245000, reg = 50000
      assert.equal(result.dutyAmount, 245000 + 50000);
    });
  });

  describe("plot/land", () => {
    it("calculates 4.9% stamp duty for plot", () => {
      const result = calculateStampDuty("plot", 2000000, "male");
      // stamp = 98000, reg = 20000
      assert.equal(result.dutyAmount, 98000 + 20000);
    });
  });

  describe("female buyer discount", () => {
    it("applies ₹10,000 registration discount for female buyer on residential", () => {
      const male = calculateStampDuty("residential_flat", 5000000, "male");
      const female = calculateStampDuty("residential_flat", 5000000, "female");
      // Female gets 10000 off registration fee
      assert.equal(male.dutyAmount - female.dutyAmount, 10000);
    });

    it("does NOT apply discount for female buyer on commercial", () => {
      const male = calculateStampDuty("commercial_office", 5000000, "male");
      const female = calculateStampDuty("commercial_office", 5000000, "female");
      assert.equal(male.dutyAmount, female.dutyAmount);
    });

    it("does NOT apply discount for female buyer on plot", () => {
      const male = calculateStampDuty("plot", 5000000, "male");
      const female = calculateStampDuty("plot", 5000000, "female");
      assert.equal(male.dutyAmount, female.dutyAmount);
    });

    it("registration fee never goes below ₹100 even with discount", () => {
      // With a very low property value, reg fee could go below 100
      const result = calculateStampDuty("residential_flat", 5000, "female");
      // reg = max(5000*0.01 - 10000, 100) = max(50-10000, 100) = 100
      // stamp = 5000 * 0.035 = 175
      assert.equal(result.dutyAmount, 175 + 100);
    });
  });

  describe("minimum registration fee", () => {
    it("enforces minimum ₹100 registration fee", () => {
      const result = calculateStampDuty("residential_flat", 1000, "male");
      // stamp = 1000 * 0.035 = 35
      // reg = max(1000 * 0.01, 100) = max(10, 100) = 100
      assert.equal(result.dutyAmount, 35 + 100);
    });
  });

  describe("default buyer gender", () => {
    it("defaults to male when gender not specified", () => {
      const withDefault = calculateStampDuty("residential_flat", 5000000);
      const withMale = calculateStampDuty("residential_flat", 5000000, "male");
      assert.equal(withDefault.dutyAmount, withMale.dutyAmount);
    });
  });

  describe("output format", () => {
    it("includes proper document type label", () => {
      const result = calculateStampDuty("commercial_office", 5000000, "male");
      assert.ok(result.documentType.includes("commercial"));
    });

    it("includes penalty info", () => {
      const result = calculateStampDuty("residential_flat", 5000000, "male");
      assert.ok(result.penaltyInfo);
      assert.ok(result.penaltyInfo!.includes("2% per month"));
    });
  });
});
