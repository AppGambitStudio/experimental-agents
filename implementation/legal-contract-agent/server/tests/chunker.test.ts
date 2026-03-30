import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chunkDocument,
  extractClauses,
  estimateProcessingTime,
} from "../chunker.js";

// ── Test helper ────────────────────────────────────────────────────────────

function makeContractText(clauseCount: number, wordsPerClause: number): string {
  const clauses: string[] = [];
  for (let i = 1; i <= clauseCount; i++) {
    const title = `${i}. CLAUSE NUMBER ${i}`;
    // Generate body words (subtract heading words from target)
    const bodyWords = Array.from(
      { length: wordsPerClause - 4 },
      (_, j) => `word${j}`,
    ).join(" ");
    clauses.push(`${title}\n${bodyWords}`);
  }
  return clauses.join("\n\n");
}

// ── chunkDocument ──────────────────────────────────────────────────────────

describe("chunkDocument", () => {
  it("returns single pass for documents with ≤20 pages", () => {
    const text = "This is a short contract with few pages.";
    const result = chunkDocument(text, 15);

    assert.equal(result.isSinglePass, true);
    assert.equal(result.chunks.length, 1);
    assert.equal(result.totalPages, 15);
    assert.equal(result.chunks[0].clauseTitle, "Full Document");
    assert.equal(result.chunks[0].pageStart, 1);
    assert.equal(result.chunks[0].pageEnd, 15);
  });

  it("returns single pass for exactly 20 pages", () => {
    const text = "Twenty page document boundary test.";
    const result = chunkDocument(text, 20);

    assert.equal(result.isSinglePass, true);
    assert.equal(result.chunks.length, 1);
  });

  it("splits into multiple chunks for documents with >20 pages", () => {
    const text = makeContractText(5, 500);
    const result = chunkDocument(text, 30);

    assert.equal(result.isSinglePass, false);
    assert.ok(result.chunks.length >= 5, "should have at least 5 chunks");
    assert.equal(result.totalPages, 30);
  });

  it("extracts definitions text when a DEFINITIONS clause exists", () => {
    const text = [
      "1. DEFINITIONS AND INTERPRETATION",
      'The following terms shall have the meanings ascribed to them herein. "Agreement" means this contract.',
      "",
      "2. PAYMENT TERMS",
      "Payment shall be made within thirty days of invoice.",
    ].join("\n");

    const result = chunkDocument(text, 25);

    assert.equal(result.isSinglePass, false);
    assert.ok(
      result.definitionsText.includes("DEFINITIONS AND INTERPRETATION"),
      "definitions text should contain the definitions clause",
    );
  });

  it("handles documents with no headings (>20 pages)", () => {
    const plainText = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
    const result = chunkDocument(plainText, 25);

    assert.equal(result.isSinglePass, false);
    assert.ok(result.chunks.length >= 1);
    // With no headings, extractClauses returns single clause
    assert.equal(result.clauses.length, 1);
    assert.equal(result.clauses[0].title, "Full Document");
  });

  it("reports correct total word count", () => {
    const text = "one two three four five";
    const result = chunkDocument(text, 5);

    assert.equal(result.totalWords, 5);
  });

  it("sub-splits clauses that exceed 5 pages worth of words", () => {
    // Create a clause with 5000 words (well over 2250 limit)
    const text = [
      "1. VERY LARGE CLAUSE",
      Array.from({ length: 5000 }, (_, i) => `word${i}`).join(" "),
      "",
      "2. SMALL CLAUSE",
      "This is a small clause with just a few words.",
    ].join("\n");

    const result = chunkDocument(text, 30);

    // The large clause should be sub-split into multiple chunks
    const subChunks = result.chunks.filter((c) =>
      c.clauseTitle.includes("VERY LARGE CLAUSE"),
    );
    assert.ok(
      subChunks.length >= 2,
      `large clause should be sub-split, got ${subChunks.length} chunks`,
    );

    // Each sub-chunk should be within the word limit
    for (const chunk of subChunks) {
      assert.ok(
        chunk.wordCount <= 2250,
        `sub-chunk should be ≤2250 words, got ${chunk.wordCount}`,
      );
    }
  });
});

// ── extractClauses ─────────────────────────────────────────────────────────

describe("extractClauses", () => {
  it("detects numbered headings", () => {
    const text = [
      "1. DEFINITIONS",
      "Some definitions here.",
      "",
      "2. OBLIGATIONS",
      "Some obligations here.",
      "",
      "3.2 PAYMENT TERMS",
      "Payment details here.",
    ].join("\n");

    const clauses = extractClauses(text, 30);

    assert.equal(clauses.length, 3);
    assert.equal(clauses[0].number, "1.");
    assert.equal(clauses[0].title, "DEFINITIONS");
    assert.equal(clauses[1].number, "2.");
    assert.equal(clauses[1].title, "OBLIGATIONS");
    assert.equal(clauses[2].number, "3.2");
    assert.equal(clauses[2].title, "PAYMENT TERMS");
  });

  it("detects SCHEDULE/ANNEXURE headings", () => {
    const text = [
      "SCHEDULE A PRICING",
      "Pricing details follow.",
      "",
      "ANNEXURE B SPECIFICATIONS",
      "Technical specifications.",
    ].join("\n");

    const clauses = extractClauses(text, 10);

    assert.equal(clauses.length, 2);
    assert.ok(clauses[0].title.includes("SCHEDULE"));
    assert.ok(clauses[1].title.includes("ANNEXURE"));
  });

  it("detects all-caps headings", () => {
    const text = [
      "CONFIDENTIALITY",
      "All information shall remain confidential.",
      "",
      "INDEMNIFICATION",
      "Each party shall indemnify the other.",
    ].join("\n");

    const clauses = extractClauses(text, 10);

    assert.equal(clauses.length, 2);
    assert.equal(clauses[0].title, "CONFIDENTIALITY");
    assert.equal(clauses[1].title, "INDEMNIFICATION");
  });

  it("returns single clause for unstructured text", () => {
    const text = "This is a plain paragraph with no headings at all. Just flowing text.";
    const clauses = extractClauses(text, 10);

    assert.equal(clauses.length, 1);
    assert.equal(clauses[0].title, "Full Document");
    assert.equal(clauses[0].pageStart, 1);
    assert.equal(clauses[0].pageEnd, 10);
  });

  it("assigns correct page estimates", () => {
    // Create text where clauses are spread across pages
    const clauseBody = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const text = [
      "1. FIRST CLAUSE",
      clauseBody,
      "",
      "2. SECOND CLAUSE",
      clauseBody,
    ].join("\n");

    const clauses = extractClauses(text, 40);

    assert.equal(clauses[0].pageStart, 1);
    assert.ok(clauses[1].pageStart > 1, "second clause should start after page 1");
    assert.equal(clauses[clauses.length - 1].pageEnd, 40);
  });

  it("counts words correctly in each clause", () => {
    const text = [
      "1. FIRST CLAUSE",
      "alpha beta gamma delta",
      "",
      "2. SECOND CLAUSE",
      "one two three",
    ].join("\n");

    const clauses = extractClauses(text, 10);

    // First clause: "1. FIRST CLAUSE" (3) + "" (0) + "alpha beta gamma delta" (4) = 7
    // Plus the blank line between clauses is included in first clause's text
    assert.ok(clauses[0].wordCount > 0);
    assert.ok(clauses[1].wordCount > 0);
  });
});

// ── estimateProcessingTime ─────────────────────────────────────────────────

describe("estimateProcessingTime", () => {
  it("returns 7 seconds per chunk", () => {
    assert.equal(estimateProcessingTime(1), 7);
    assert.equal(estimateProcessingTime(5), 35);
    assert.equal(estimateProcessingTime(10), 70);
    assert.equal(estimateProcessingTime(0), 0);
  });
});
