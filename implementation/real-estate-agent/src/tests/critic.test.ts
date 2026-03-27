// Tests for Critic / Reflection Agent
// Validates coverage review, consistency checks, completeness review,
// hallucination detection, and end-to-end critic review.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  reviewCoverage,
  reviewConsistency,
  reviewCompleteness,
  reviewForHallucinations,
  runCriticReview,
  formatCriticReview,
} from "../knowledge-base/critic.js";
import type { VerificationEntry } from "../types/index.js";

// --- Test Fixtures ---

function makeVerification(
  portal: string,
  status: "verified" | "failed" | "not_checked" | "partial" | "unverified",
  result: string = "Sample result"
): VerificationEntry {
  return {
    id: `v_${portal}_${Date.now()}`,
    purchaseId: "p_test",
    timestamp: new Date().toISOString(),
    portal,
    action: "search",
    query: "test query",
    result,
    status,
  };
}

function makeFullVerifications(): VerificationEntry[] {
  return [
    makeVerification("GujRERA", "verified", "Builder: ABC Developers. RERA ID: P123. Status: Active."),
    makeVerification("eCourts", "verified", "No cases found for ABC Developers."),
    makeVerification("AnyRoR", "verified", "Owner: ABC Developers. Survey No: 100. No encumbrance."),
    makeVerification("GARVI", "verified", "Registration found. Jantri rate: Rs 3,500/sqft."),
    makeVerification("SMC", "verified", "Property tax paid up to date."),
    makeVerification("GSTN", "verified", "GSTIN: 24AAACB1234F1ZQ. Status: Active."),
  ];
}

function makeGoodReport(): string {
  return `
## Property Overview
Address: 401, Amba Tower, Vesu, Surat. Type: Residential Flat. Builder: ABC Developers.

## RERA Verification
Project is registered with GujRERA. RERA ID: P123. Status: Active. Expiry: March 2027. 2 complaints filed.

## Litigation Check
Searched eCourts for ABC Developers and property address. No active cases found.

## Land Record Verification
Checked AnyRoR land records. Owner matches. Survey No: 100. No encumbrance found on property.

## Financial Analysis
Stamp duty calculated: Rs 2,45,000. Total cost breakdown provided. Jantri rate comparison done.

## Risk Rating
Overall risk: REVIEW — based on 2 complaints on RERA portal. No critical issues found.

## Disclaimer
This report is not a substitute for legal advice. The agent cannot verify oral agreements, unregistered transactions, physical property condition, or seller identity. Manual verification recommended for items marked as limitations.
  `;
}

// --- Coverage Tests ---

describe("reviewCoverage", () => {
  it("returns 100% score when all portals are verified", () => {
    const result = reviewCoverage(makeFullVerifications());
    assert.equal(result.score, 100);
    assert.equal(result.checked.length, 6);
    assert.equal(result.notChecked.length, 0);
    assert.equal(result.failed.length, 0);
    assert.equal(result.issues.length, 0);
  });

  it("returns 0% score when no verifications exist", () => {
    const result = reviewCoverage([]);
    assert.equal(result.score, 0);
    assert.equal(result.notChecked.length, 6);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].severity, "critical");
  });

  it("detects failed portal checks", () => {
    const verifications = [
      makeVerification("GujRERA", "verified"),
      makeVerification("eCourts", "failed"),
      makeVerification("AnyRoR", "verified"),
    ];
    const result = reviewCoverage(verifications);
    assert.ok(result.failed.includes("eCourts"));
    assert.ok(result.checked.includes("GujRERA"));
    assert.ok(result.checked.includes("AnyRoR"));
    assert.ok(result.notChecked.includes("GARVI"));
    assert.ok(result.notChecked.includes("SMC"));
    assert.ok(result.notChecked.includes("GSTN"));
  });

  it("treats partial as checked", () => {
    const verifications = [makeVerification("GujRERA", "partial")];
    const result = reviewCoverage(verifications);
    assert.ok(result.checked.includes("GujRERA"));
  });

  it("flags 3+ missing portals as critical", () => {
    const verifications = [
      makeVerification("GujRERA", "verified"),
      makeVerification("eCourts", "verified"),
    ];
    const result = reviewCoverage(verifications);
    const coverageIssue = result.issues.find((i) => i.id === "cov_not_checked");
    assert.ok(coverageIssue);
    assert.equal(coverageIssue!.severity, "critical");
  });

  it("flags 1-2 missing portals as major", () => {
    const verifications = [
      makeVerification("GujRERA", "verified"),
      makeVerification("eCourts", "verified"),
      makeVerification("AnyRoR", "verified"),
      makeVerification("GARVI", "verified"),
      makeVerification("SMC", "verified"),
    ];
    const result = reviewCoverage(verifications);
    const coverageIssue = result.issues.find((i) => i.id === "cov_not_checked");
    assert.ok(coverageIssue);
    assert.equal(coverageIssue!.severity, "major");
  });
});

// --- Consistency Tests ---

describe("reviewConsistency", () => {
  it("returns 100 when no inconsistencies found", () => {
    const verifications = makeFullVerifications();
    const result = reviewConsistency(verifications);
    assert.equal(result.score, 100);
  });

  it("detects name mismatches across portals", () => {
    const verifications = [
      makeVerification("GujRERA", "verified", "Builder: ABC Developers. Project registered."),
      makeVerification("AnyRoR", "verified", "Owner: XYZ Constructions Ltd. Survey No: 100."),
    ];
    const result = reviewConsistency(verifications);
    if (result.issues.length > 0) {
      assert.equal(result.issues[0].category, "cross_portal_inconsistency");
      assert.equal(result.issues[0].severity, "critical");
    }
  });

  it("ignores failed verifications", () => {
    const verifications = [
      makeVerification("GujRERA", "verified", "Builder: ABC Developers"),
      makeVerification("eCourts", "failed", "Could not access portal"),
    ];
    const result = reviewConsistency(verifications);
    assert.ok(result.score >= 80);
  });
});

// --- Completeness Tests ---

describe("reviewCompleteness", () => {
  it("returns 100% for a complete report", () => {
    const report = makeGoodReport();
    const result = reviewCompleteness(report, "due_diligence", makeFullVerifications());
    assert.equal(result.score, 100);
  });

  it("detects missing disclaimer", () => {
    const report = "## Property Overview\nGood property.\n## Risk Rating\nCLEAR.";
    const result = reviewCompleteness(report, "due_diligence", makeFullVerifications());
    const disclaimerIssue = result.issues.find(
      (i) => i.category === "missing_disclaimer" && i.finding.includes("disclaimer")
    );
    assert.ok(disclaimerIssue);
    assert.equal(disclaimerIssue!.severity, "critical");
  });

  it("flags positive risk rating with insufficient verifications", () => {
    const report = "The property looks clear. Low risk. No issues found.";
    const verifications = [makeVerification("GujRERA", "verified")];
    const result = reviewCompleteness(report, "due_diligence", verifications);
    const riskIssue = result.issues.find((i) => i.category === "risk_rating_mismatch");
    assert.ok(riskIssue);
    assert.equal(riskIssue!.severity, "critical");
  });

  it("flags missing financial analysis in financial phase", () => {
    const report = "## Property Overview\nProperty details here.\n## Risk Rating\nREVIEW.\n## Disclaimer\nLimitations apply.";
    const result = reviewCompleteness(report, "financial_analysis", makeFullVerifications());
    const financialIssue = result.issues.find((i) => i.category === "financial_incomplete");
    assert.ok(financialIssue);
  });
});

// --- Hallucination Tests ---

describe("reviewForHallucinations", () => {
  it("detects claims about unchecked portals", () => {
    const report = "No litigation found on eCourts. Property is clear.";
    const verifications = [makeVerification("GujRERA", "verified")];
    const result = reviewForHallucinations(report, verifications);
    assert.ok(result.issues.length > 0);
    const hallIssue = result.issues.find((i) => i.category === "unsupported_claim");
    assert.ok(hallIssue);
    assert.equal(hallIssue!.severity, "critical");
  });

  it("detects 'no encumbrance' claim without AnyRoR check", () => {
    const report = "No encumbrance found. Clear title confirmed.";
    const verifications = [makeVerification("GujRERA", "verified")];
    const result = reviewForHallucinations(report, verifications);
    const hallIssue = result.issues.find((i) => i.finding.includes("AnyRoR"));
    assert.ok(hallIssue);
  });

  it("detects 'tax is up to date' without SMC check", () => {
    const report = "Tax payments are current. No outstanding dues.";
    const verifications = [makeVerification("GujRERA", "verified")];
    const result = reviewForHallucinations(report, verifications);
    const hallIssue = result.issues.find((i) => i.finding.includes("SMC"));
    assert.ok(hallIssue);
  });

  it("does not flag claims for verified portals", () => {
    const report = "No litigation found on eCourts.";
    const verifications = [makeVerification("eCourts", "verified", "No cases found")];
    const result = reviewForHallucinations(report, verifications);
    const ecourtsIssues = result.issues.filter((i) => i.finding.includes("eCourts"));
    assert.equal(ecourtsIssues.length, 0);
  });

  it("does not flag when no specific claims are made", () => {
    const report = "Property verification in progress. Preliminary findings look positive.";
    const verifications = [makeVerification("GujRERA", "verified")];
    const result = reviewForHallucinations(report, verifications);
    assert.equal(result.issues.length, 0);
  });
});

// --- End-to-end Critic Review Tests ---

describe("runCriticReview", () => {
  it("APPROVES a complete, well-formed report", () => {
    const review = runCriticReview(makeGoodReport(), makeFullVerifications(), "due_diligence");
    assert.equal(review.verdict, "APPROVED");
    assert.ok(review.overallQuality >= 60);
    assert.equal(review.criticalIssues, 0);
  });

  it("returns REVISE for a report with hallucinations", () => {
    const report = "No litigation found on eCourts. Clear title on AnyRoR. Tax is up to date on SMC.";
    const verifications = [makeVerification("GujRERA", "verified")];
    const review = runCriticReview(report, verifications, "due_diligence");
    assert.equal(review.verdict, "REVISE");
    assert.ok(review.criticalIssues > 0);
  });

  it("returns REVISE when coverage is too low", () => {
    const review = runCriticReview(makeGoodReport(), [makeVerification("GujRERA", "verified")], "due_diligence");
    assert.equal(review.verdict, "REVISE");
    assert.ok(review.coverageScore < 50);
  });

  it("returns REVISE for missing disclaimer", () => {
    const report = "## Property Overview\nGood property.\n## Risk Rating\nCLEAR — no issues.";
    const review = runCriticReview(report, makeFullVerifications(), "due_diligence");
    assert.equal(review.verdict, "REVISE");
    const disclaimerIssue = review.issues.find((i) => i.finding.includes("disclaimer"));
    assert.ok(disclaimerIssue);
  });

  it("includes all score components in valid range", () => {
    const review = runCriticReview(makeGoodReport(), makeFullVerifications(), "due_diligence");
    assert.ok(review.coverageScore >= 0 && review.coverageScore <= 100);
    assert.ok(review.consistencyScore >= 0 && review.consistencyScore <= 100);
    assert.ok(review.completenessScore >= 0 && review.completenessScore <= 100);
    assert.ok(review.overallQuality >= 0 && review.overallQuality <= 100);
  });

  it("has correct issue counts", () => {
    const review = runCriticReview("No litigation found on eCourts.", [], "due_diligence");
    assert.equal(review.totalIssues, review.criticalIssues + review.majorIssues + review.minorIssues);
  });
});

// --- Format Tests ---

describe("formatCriticReview", () => {
  it("formats APPROVED review", () => {
    const review = runCriticReview(makeGoodReport(), makeFullVerifications(), "due_diligence");
    const formatted = formatCriticReview(review);
    assert.ok(formatted.includes("APPROVED"));
    assert.ok(formatted.includes("Quality Score"));
  });

  it("formats REVISE review with issues", () => {
    const review = runCriticReview("No litigation found on eCourts.", [], "due_diligence");
    const formatted = formatCriticReview(review);
    assert.ok(formatted.includes("REVISE"));
    assert.ok(formatted.includes("CRITICAL"));
    assert.ok(formatted.includes("Issues Found"));
  });

  it("includes all score labels", () => {
    const review = runCriticReview(makeGoodReport(), makeFullVerifications(), "due_diligence");
    const formatted = formatCriticReview(review);
    assert.ok(formatted.includes("Coverage:"));
    assert.ok(formatted.includes("Consistency:"));
    assert.ok(formatted.includes("Completeness:"));
  });
});
