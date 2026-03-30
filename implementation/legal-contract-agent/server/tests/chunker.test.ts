import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkDocument, extractClauses, estimateProcessingTime } from "../chunker.js";

function makeContractText(clauseCount: number, wordsPerClause: number): string {
  const titles = [
    "DEFINITIONS", "SCOPE OF SERVICES", "PAYMENT TERMS", "INTELLECTUAL PROPERTY",
    "CONFIDENTIALITY", "INDEMNIFICATION", "LIMITATION OF LIABILITY", "TERMINATION",
    "GOVERNING LAW", "DISPUTE RESOLUTION", "FORCE MAJEURE", "NOTICES",
    "ASSIGNMENT", "AMENDMENTS", "ENTIRE AGREEMENT",
  ];
  const clauses: string[] = [];
  for (let i = 1; i <= clauseCount; i++) {
    const title = titles[i - 1] ?? `GENERAL CLAUSE ${i}`;
    const body = Array(wordsPerClause).fill("lorem ipsum dolor sit amet").join(" ");
    clauses.push(`${i}. ${title}\n\n${body}`);
  }
  return clauses.join("\n\n");
}

describe("chunkDocument", () => {
  it("returns single pass for small documents (≤ 20 pages)", () => {
    const text = makeContractText(5, 100);
    const result = chunkDocument(text, 10);
    assert.equal(result.isSinglePass, true);
    assert.equal(result.chunks.length, 1);
    assert.equal(result.chunks[0].clauseTitle, "Full Document");
  });

  it("splits large documents into multiple chunks", () => {
    const text = makeContractText(10, 500);
    const result = chunkDocument(text, 30);
    assert.equal(result.isSinglePass, false);
    assert.ok(result.chunks.length > 1, `Expected >1 chunks, got ${result.chunks.length}`);
  });

  it("never produces more than 15 chunks", () => {
    const text = makeContractText(15, 300);
    const result = chunkDocument(text, 40);
    assert.ok(result.chunks.length <= 15, `Expected ≤15 chunks, got ${result.chunks.length}`);
  });

  it("merges small adjacent clauses into fewer chunks", () => {
    const text = makeContractText(10, 100);
    const result = chunkDocument(text, 25);
    assert.equal(result.isSinglePass, false);
    // 10 clauses × 100 words = 1000 words total → should merge into far fewer than 10 chunks
    assert.ok(result.chunks.length < 10, `Expected fewer chunks than clauses, got ${result.chunks.length} from 10 clauses`);
  });

  it("extracts definitions text for context injection", () => {
    const text = "1. DEFINITIONS\n\nConfidential Information means...\n\n2. SCOPE\n\nThe services include...";
    const result = chunkDocument(text, 25);
    assert.ok(result.definitionsText.includes("Confidential Information"));
  });

  it("handles documents with no recognizable headings", () => {
    const text = "This is a plain text contract with no numbered headings. ".repeat(500);
    const result = chunkDocument(text, 25);
    assert.equal(result.isSinglePass, false);
    assert.ok(result.chunks.length >= 1);
  });

  it("does not match sub-section numbers as headings", () => {
    const text = "1. MAIN CLAUSE\nBody text\n\n1.1 Sub-section A\nDetails\n\n1.1.1 Sub-sub-section\nMore details\n\n2. SECOND CLAUSE\nMore body";
    const clauses = extractClauses(text, 25);
    assert.equal(clauses.length, 2, `Expected 2 top-level clauses, got ${clauses.length}`);
  });
});

describe("extractClauses", () => {
  it("detects top-level numbered clause headings", () => {
    const text = "1. DEFINITIONS\nSome text\n\n2. SCOPE OF SERVICES\nMore text\n\n3. PAYMENT\nPayment text";
    const clauses = extractClauses(text, 10);
    assert.equal(clauses.length, 3);
    assert.equal(clauses[0].title, "DEFINITIONS");
    assert.equal(clauses[1].title, "SCOPE OF SERVICES");
  });

  it("detects SCHEDULE/ANNEXURE headings", () => {
    const text = "1. MAIN CLAUSE\nBody\n\nSCHEDULE A\nSchedule content\n\nANNEXURE 1\nAnnexure content";
    const clauses = extractClauses(text, 10);
    assert.ok(clauses.some((c) => c.title.includes("SCHEDULE")));
  });

  it("returns single clause for unstructured text", () => {
    const text = "Just a block of text with no headings at all.";
    const clauses = extractClauses(text, 1);
    assert.equal(clauses.length, 1);
    assert.equal(clauses[0].title, "Full Document");
  });
});

describe("estimateProcessingTime", () => {
  it("estimates ~7 seconds per chunk", () => {
    assert.equal(estimateProcessingTime(1), 7);
    assert.equal(estimateProcessingTime(8), 56);
  });
});
