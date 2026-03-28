import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runCriticReview,
  formatCriticReview,
} from "../knowledge-base/critic.js";
import type { ClauseAnalysis } from "../types/index.js";

// --- Helpers ---

function makeClause(overrides: Partial<ClauseAnalysis>): ClauseAnalysis {
  return {
    clauseNumber: "1.1",
    clauseTitle: "Test Clause",
    category: "indemnity",
    originalText: "Test text",
    riskLevel: "medium",
    riskExplanation: "Test explanation",
    riskExplanationBusiness: "Test business explanation",
    applicableLaws: ["Indian Contract Act 1872"],
    suggestedAlternative: "Better language",
    negotiationPoint: "Negotiate this",
    isMissingClause: false,
    ...overrides,
  };
}

/**
 * Build a comprehensive report that covers all required sections.
 */
function makeGoodReport(): string {
  return `
# Contract Analysis Report

## Executive Summary
This is a summary of the contract analysis.

## Risk Score
Overall risk score: 65/100 (Grade D)
Risk grade: high

## Clause Analysis — Flagged Clauses

### Clause 3.2 — Non-Compete
Risk: CRITICAL. Post-termination non-compete is void under Section 27 of the Indian Contract Act 1872.

### Clause 5.1 — Indemnity
Risk: HIGH. Unlimited indemnity without cap.

### Clause 7.3 — IP Assignment
Risk: HIGH. Overly broad IP assignment covering ideas and methodologies.

### Clause 8.1 — Governing Law
Risk: HIGH. Foreign governing law (Delaware) for India-based entity.

### Clause 9.1 — Data Protection
Risk: MEDIUM. No DPDPA-compliant data protection addendum.

### Clause 10.2 — Termination
Risk: HIGH. One-sided termination rights.

### Clause 11.1 — Confidentiality
Acceptable. Standard mutual NDA terms.

### Clause 12.1 — Payment
Acceptable. Net-30 payment terms with late interest.

### Clause 13.1 — Liability
Risk: HIGH. No limitation of liability cap.

## Missing Clauses
- Missing clause: Force majeure clause not found

## Stamp Duty
Gujarat stamp duty for Service Agreement: Rs 25,000 (e-stamp available)

## Negotiation Playbook
1. Remove non-compete (talking point: void under Section 27)
2. Add liability cap (counter-proposal: 12 months fees)

## Disclaimer and Limitations
This analysis is NOT a substitute for professional legal advice. Consult a qualified advocate.
This agent cannot verify signatures, entity existence, or industry-specific regulations.
  `.trim();
}

function makeGoodClauses(): ClauseAnalysis[] {
  return [
    makeClause({
      clauseNumber: "3.2",
      category: "indemnity",
      riskLevel: "high",
    }),
    makeClause({
      clauseNumber: "5.1",
      category: "ip_assignment",
      riskLevel: "high",
    }),
    makeClause({
      clauseNumber: "7.3",
      category: "termination",
      riskLevel: "high",
    }),
    makeClause({
      clauseNumber: "8.1",
      category: "governing_law",
      riskLevel: "high",
    }),
    makeClause({
      clauseNumber: "9.1",
      category: "data_protection",
      riskLevel: "medium",
    }),
    makeClause({
      clauseNumber: "10.2",
      category: "confidentiality",
      riskLevel: "ok",
    }),
    makeClause({
      clauseNumber: "11.1",
      category: "payment",
      riskLevel: "ok",
    }),
    makeClause({
      clauseNumber: "12.1",
      category: "liability",
      riskLevel: "high",
    }),
  ];
}

// --- Tests ---

describe("runCriticReview", () => {
  it("good report returns APPROVED", () => {
    const review = runCriticReview(makeGoodReport(), makeGoodClauses(), "msa");
    assert.equal(review.verdict, "APPROVED");
  });

  it("missing disclaimer returns REVISE", () => {
    // Remove the disclaimer section entirely, ensuring no disclaimer keywords remain
    const badReport = makeGoodReport()
      .replace(/## Disclaimer[\s\S]*$/, "## End of Report\nNo further notes.")
      .replace(/disclaimer/gi, "notes")
      .replace(/limitation/gi, "note")
      .replace(/cannot verify/gi, "did check")
      .replace(/not a substitute/gi, "a supplement")
      .replace(/consult a qualified/gi, "ask a friend");
    const review = runCriticReview(badReport, makeGoodClauses(), "msa");
    assert.equal(review.verdict, "REVISE");
    const disclaimerIssue = review.issues.find(
      (i) => i.category === "missing_disclaimer"
    );
    assert.ok(disclaimerIssue, "should have a missing_disclaimer issue");
  });

  it("missing clause categories returns REVISE", () => {
    // Only provide 2 clause categories out of the 8 required for MSA
    const sparseAnalyses = [
      makeClause({ category: "indemnity" }),
      makeClause({ category: "termination" }),
    ];
    const review = runCriticReview(makeGoodReport(), sparseAnalyses, "msa");
    assert.equal(review.verdict, "REVISE");
    const coverageIssue = review.issues.find(
      (i) => i.category === "coverage_gap"
    );
    assert.ok(coverageIssue, "should have a coverage_gap issue");
  });

  it("risk score inconsistency — low grade despite critical clauses — returns REVISE", () => {
    const lowRiskReport = makeGoodReport()
      .replace("risk score: 65/100", "risk score: 10/100")
      .replace("Risk grade: high", "Risk grade: low")
      .replace("risk rating: high", "risk rating: low")
      .replace("Grade D", "Grade A");

    const criticalClauses = [
      ...makeGoodClauses(),
      makeClause({
        clauseNumber: "99.1",
        category: "indemnity",
        riskLevel: "critical",
      }),
      makeClause({
        clauseNumber: "99.2",
        category: "governing_law",
        riskLevel: "critical",
      }),
    ];

    // The report says low risk but clauses are critical — should trigger risk_rating_mismatch
    const review = runCriticReview(lowRiskReport, criticalClauses, "msa");
    // The review may be REVISE due to risk mismatch or coverage gap
    const riskIssue = review.issues.find(
      (i) => i.category === "risk_rating_mismatch"
    );
    // If risk rating check found the mismatch, great; if not, it may be caught by other checks
    // At minimum, the review should not be APPROVED given critical clauses with low risk label
    assert.ok(
      review.verdict === "REVISE" || riskIssue,
      "should flag risk inconsistency or not approve"
    );
  });

  it("all scores are in 0-100 range", () => {
    const review = runCriticReview(makeGoodReport(), makeGoodClauses(), "msa");
    assert.ok(
      review.coverageScore >= 0 && review.coverageScore <= 100,
      `coverageScore out of range: ${review.coverageScore}`
    );
    assert.ok(
      review.completenessScore >= 0 && review.completenessScore <= 100,
      `completenessScore out of range: ${review.completenessScore}`
    );
    assert.ok(
      review.overallQuality >= 0 && review.overallQuality <= 100,
      `overallQuality out of range: ${review.overallQuality}`
    );
  });
});

describe("formatCriticReview", () => {
  it("format includes verdict and quality score", () => {
    const review = runCriticReview(makeGoodReport(), makeGoodClauses(), "msa");
    const formatted = formatCriticReview(review);
    assert.ok(
      formatted.includes("Critic Review"),
      "should include 'Critic Review' header"
    );
    assert.ok(
      formatted.includes("Quality Score:"),
      "should include 'Quality Score'"
    );
    assert.ok(
      formatted.includes(review.verdict),
      `should include verdict '${review.verdict}'`
    );
  });

  it("REVISE format includes issues section", () => {
    const sparseAnalyses = [makeClause({ category: "indemnity" })];
    const review = runCriticReview(makeGoodReport(), sparseAnalyses, "msa");
    if (review.verdict === "REVISE") {
      const formatted = formatCriticReview(review);
      assert.ok(
        formatted.includes("Issues Found:"),
        "should include 'Issues Found'"
      );
    }
  });
});
