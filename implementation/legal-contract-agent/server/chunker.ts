// Document chunker — splits large contracts into logical clause-based chunks
// for cost-efficient per-chunk analysis.
//
// Design: Only split at TOP-LEVEL clause boundaries (1., 2., 3.) not sub-sections.
// Merge small adjacent clauses to hit target chunk size (~2000-2500 words).
// Target: 5-15 chunks max for a 60-100 page contract.

// ── Types ──────────────────────────────────────────────────────────────────

export interface DocumentChunk {
  id: string;
  clauseNumber: string;
  clauseTitle: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  wordCount: number;
}

export interface ClauseInfo {
  number: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  wordCount: number;
}

export interface ChunkResult {
  totalPages: number;
  totalWords: number;
  clauses: ClauseInfo[];
  definitionsText: string;
  chunks: DocumentChunk[];
  isSinglePass: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const WORDS_PER_PAGE = 450;
const TARGET_CHUNK_WORDS = WORDS_PER_PAGE * 4; // ~1800 words = ~4 pages
const MAX_CHUNK_WORDS = WORDS_PER_PAGE * 6; // ~2700 words = ~6 pages (hard limit for sub-split)
const MAX_CHUNKS = 15; // never produce more than 15 chunks

// ── Heading patterns ───────────────────────────────────────────────────────

// Only match TOP-LEVEL headings: "1.", "2.", "3." — NOT "3.2", "3.2.1"
const TOP_LEVEL_NUMBERED = /^(\d+)\.\s+[A-Z]/;
const NAMED_HEADING = /^(SCHEDULE|ANNEXURE|EXHIBIT|APPENDIX)\s+[A-Z]/i;
const ALLCAPS_HEADING = /^[A-Z][A-Z\s]{5,}$/;

function isTopLevelHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  return (
    TOP_LEVEL_NUMBERED.test(trimmed) ||
    NAMED_HEADING.test(trimmed) ||
    ALLCAPS_HEADING.test(trimmed)
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function estimatePageForPosition(
  position: number,
  totalLength: number,
  pageCount: number,
): number {
  if (totalLength === 0) return 1;
  const ratio = position / totalLength;
  return Math.max(1, Math.min(pageCount, Math.ceil(ratio * pageCount)));
}

function extractHeadingTitle(line: string): { number: string; title: string } {
  const trimmed = line.trim();

  const numbered = trimmed.match(TOP_LEVEL_NUMBERED);
  if (numbered) {
    return {
      number: numbered[1],
      title: trimmed.slice(numbered[1].length + 1).trim(),
    };
  }

  const named = trimmed.match(NAMED_HEADING);
  if (named) {
    return { number: "", title: trimmed };
  }

  return { number: "", title: trimmed };
}

// ── Core: extractClauses ───────────────────────────────────────────────────

export function extractClauses(
  fullText: string,
  pageCount: number,
): ClauseInfo[] {
  const lines = fullText.split("\n");
  const headingIndices: { lineIndex: number; charOffset: number; number: string; title: string }[] = [];

  let charOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isTopLevelHeading(lines[i])) {
      const { number, title } = extractHeadingTitle(lines[i]);
      headingIndices.push({ lineIndex: i, charOffset, number, title });
    }
    charOffset += lines[i].length + 1;
  }

  if (headingIndices.length === 0) {
    const wc = countWords(fullText);
    return [
      {
        number: "1",
        title: "Full Document",
        pageStart: 1,
        pageEnd: pageCount,
        text: fullText,
        wordCount: wc,
      },
    ];
  }

  const totalLength = fullText.length;
  const clauses: ClauseInfo[] = [];

  for (let i = 0; i < headingIndices.length; i++) {
    const heading = headingIndices[i];
    const startLine = heading.lineIndex;
    const endLine =
      i + 1 < headingIndices.length
        ? headingIndices[i + 1].lineIndex
        : lines.length;

    const clauseLines = lines.slice(startLine, endLine);
    const text = clauseLines.join("\n");
    const wc = countWords(text);

    const startCharOffset = heading.charOffset;
    const endCharOffset =
      i + 1 < headingIndices.length
        ? headingIndices[i + 1].charOffset
        : totalLength;

    clauses.push({
      number: heading.number || String(i + 1),
      title: heading.title,
      pageStart: estimatePageForPosition(startCharOffset, totalLength, pageCount),
      pageEnd: estimatePageForPosition(endCharOffset, totalLength, pageCount),
      text,
      wordCount: wc,
    });
  }

  return clauses;
}

// ── Core: chunkDocument ────────────────────────────────────────────────────

export function chunkDocument(
  fullText: string,
  pageCount: number,
): ChunkResult {
  const totalWords = countWords(fullText);

  // Single-pass for short documents
  if (pageCount <= 20) {
    return {
      totalPages: pageCount,
      totalWords,
      clauses: [],
      definitionsText: "",
      chunks: [
        {
          id: "chunk-1",
          clauseNumber: "1",
          clauseTitle: "Full Document",
          text: fullText,
          pageStart: 1,
          pageEnd: pageCount,
          wordCount: totalWords,
        },
      ],
      isSinglePass: true,
    };
  }

  const clauses = extractClauses(fullText, pageCount);

  // Extract definitions
  const defClause = clauses.find((c) => {
    const lower = c.title.toLowerCase();
    return lower.includes("definition") || lower.includes("interpretation");
  });
  const definitionsText = defClause?.text ?? "";

  // Merge small adjacent clauses into target-sized chunks
  const mergedChunks = mergeClauses(clauses);

  // Sub-split any chunk that's still too large
  const finalChunks: DocumentChunk[] = [];
  let chunkIndex = 1;

  for (const merged of mergedChunks) {
    if (merged.wordCount <= MAX_CHUNK_WORDS) {
      finalChunks.push({
        id: `chunk-${chunkIndex++}`,
        clauseNumber: merged.clauseNumber,
        clauseTitle: merged.clauseTitle,
        text: merged.text,
        pageStart: merged.pageStart,
        pageEnd: merged.pageEnd,
        wordCount: merged.wordCount,
      });
    } else {
      // Sub-split by word count
      const words = merged.text.split(/\s+/);
      let subPart = 1;
      for (let start = 0; start < words.length; start += TARGET_CHUNK_WORDS) {
        const slice = words.slice(start, start + TARGET_CHUNK_WORDS);
        const subText = slice.join(" ");
        const ratio = start / words.length;
        const endRatio = Math.min(1, (start + TARGET_CHUNK_WORDS) / words.length);
        const pageSpan = merged.pageEnd - merged.pageStart;

        finalChunks.push({
          id: `chunk-${chunkIndex++}`,
          clauseNumber: merged.clauseNumber,
          clauseTitle: `${merged.clauseTitle} (Part ${subPart})`,
          text: subText,
          pageStart: Math.max(1, Math.round(merged.pageStart + ratio * pageSpan)),
          pageEnd: Math.max(1, Math.round(merged.pageStart + endRatio * pageSpan)),
          wordCount: slice.length,
        });
        subPart++;
      }
    }
  }

  return {
    totalPages: pageCount,
    totalWords,
    clauses,
    definitionsText,
    chunks: finalChunks,
    isSinglePass: false,
  };
}

// ── Merge small adjacent clauses ───────────────────────────────────────────

interface MergedChunk {
  clauseNumber: string;
  clauseTitle: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  wordCount: number;
}

function mergeClauses(clauses: ClauseInfo[]): MergedChunk[] {
  if (clauses.length === 0) return [];

  const merged: MergedChunk[] = [];
  let current: MergedChunk = {
    clauseNumber: clauses[0].number,
    clauseTitle: clauses[0].title,
    text: clauses[0].text,
    pageStart: clauses[0].pageStart,
    pageEnd: clauses[0].pageEnd,
    wordCount: clauses[0].wordCount,
  };

  for (let i = 1; i < clauses.length; i++) {
    const clause = clauses[i];
    const combinedWords = current.wordCount + clause.wordCount;

    // Merge if combined size is under target, or if current chunk is tiny
    if (combinedWords <= TARGET_CHUNK_WORDS || current.wordCount < 200) {
      current.text += "\n\n" + clause.text;
      current.wordCount = combinedWords;
      current.pageEnd = clause.pageEnd;
      current.clauseTitle = `${current.clauseTitle} + ${clause.title}`;
      // Keep the first clause number as the chunk number
    } else {
      // Current chunk is big enough — push it and start new
      merged.push(current);
      current = {
        clauseNumber: clause.number,
        clauseTitle: clause.title,
        text: clause.text,
        pageStart: clause.pageStart,
        pageEnd: clause.pageEnd,
        wordCount: clause.wordCount,
      };
    }
  }

  // Push the last chunk
  merged.push(current);

  // If we still have too many chunks, do a second merge pass
  if (merged.length > MAX_CHUNKS) {
    return forceReduceChunks(merged);
  }

  return merged;
}

/**
 * If we have more than MAX_CHUNKS, force-merge adjacent chunks
 * until we're at the limit.
 */
function forceReduceChunks(chunks: MergedChunk[]): MergedChunk[] {
  while (chunks.length > MAX_CHUNKS) {
    // Find the smallest adjacent pair to merge
    let minCombined = Infinity;
    let mergeAt = 0;
    for (let i = 0; i < chunks.length - 1; i++) {
      const combined = chunks[i].wordCount + chunks[i + 1].wordCount;
      if (combined < minCombined) {
        minCombined = combined;
        mergeAt = i;
      }
    }

    const a = chunks[mergeAt];
    const b = chunks[mergeAt + 1];
    const merged: MergedChunk = {
      clauseNumber: a.clauseNumber,
      clauseTitle: `${a.clauseTitle} + ${b.clauseTitle}`,
      text: a.text + "\n\n" + b.text,
      pageStart: a.pageStart,
      pageEnd: b.pageEnd,
      wordCount: a.wordCount + b.wordCount,
    };

    chunks.splice(mergeAt, 2, merged);
  }

  return chunks;
}

// ── Utility ────────────────────────────────────────────────────────────────

export function estimateProcessingTime(chunkCount: number): number {
  return chunkCount * 7;
}
