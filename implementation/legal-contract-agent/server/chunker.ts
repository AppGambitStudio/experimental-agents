// Document chunker — splits large contracts into logical clause-based chunks
// for cost-efficient per-chunk analysis.

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
const MAX_CHUNK_WORDS = WORDS_PER_PAGE * 5; // 2250 words ≈ 5 pages

// ── Heading patterns ───────────────────────────────────────────────────────

const NUMBERED_HEADING = /^(\d+\.?\d*\.?\d*)\s+[A-Z]/;
const NAMED_HEADING = /^(SCHEDULE|ANNEXURE|EXHIBIT|APPENDIX)\s+[A-Z]/i;
const ALLCAPS_HEADING = /^[A-Z][A-Z\s]{5,}$/;

function isHeading(line: string): RegExpMatchArray | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return (
    trimmed.match(NUMBERED_HEADING) ??
    trimmed.match(NAMED_HEADING) ??
    trimmed.match(ALLCAPS_HEADING)
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

  const numbered = trimmed.match(NUMBERED_HEADING);
  if (numbered) {
    return {
      number: numbered[1],
      title: trimmed.slice(numbered[1].length).trim(),
    };
  }

  const named = trimmed.match(NAMED_HEADING);
  if (named) {
    return { number: "", title: trimmed };
  }

  // all-caps heading
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
    const match = isHeading(lines[i]);
    if (match) {
      const { number, title } = extractHeadingTitle(lines[i]);
      headingIndices.push({ lineIndex: i, charOffset, number, title });
    }
    charOffset += lines[i].length + 1; // +1 for newline
  }

  // No headings found — return entire document as single clause
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

  // Build chunks, sub-splitting large clauses
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 1;

  for (const clause of clauses) {
    if (clause.wordCount <= MAX_CHUNK_WORDS) {
      chunks.push({
        id: `chunk-${chunkIndex++}`,
        clauseNumber: clause.number,
        clauseTitle: clause.title,
        text: clause.text,
        pageStart: clause.pageStart,
        pageEnd: clause.pageEnd,
        wordCount: clause.wordCount,
      });
    } else {
      // Sub-split large clause by word count
      const words = clause.text.split(/\s+/);
      let subPartIndex = 1;
      for (let start = 0; start < words.length; start += MAX_CHUNK_WORDS) {
        const slice = words.slice(start, start + MAX_CHUNK_WORDS);
        const subText = slice.join(" ");
        const subWordCount = slice.length;

        const ratio = start / words.length;
        const endRatio = Math.min(1, (start + MAX_CHUNK_WORDS) / words.length);
        const pageSpan = clause.pageEnd - clause.pageStart;

        chunks.push({
          id: `chunk-${chunkIndex++}`,
          clauseNumber: `${clause.number}.${subPartIndex}`,
          clauseTitle: `${clause.title} (Part ${subPartIndex})`,
          text: subText,
          pageStart: Math.max(1, Math.round(clause.pageStart + ratio * pageSpan)),
          pageEnd: Math.max(1, Math.round(clause.pageStart + endRatio * pageSpan)),
          wordCount: subWordCount,
        });
        subPartIndex++;
      }
    }
  }

  return {
    totalPages: pageCount,
    totalWords,
    clauses,
    definitionsText,
    chunks,
    isSinglePass: false,
  };
}

// ── Utility ────────────────────────────────────────────────────────────────

export function estimateProcessingTime(chunkCount: number): number {
  return chunkCount * 7;
}
