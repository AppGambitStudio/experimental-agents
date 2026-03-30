// Upload route — accepts PDF/TXT contract files, parses them, and stores for analysis.

import { Hono } from "hono";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { storeFile } from "../session-store.js";
import { chunkDocument, extractClauses, estimateProcessingTime } from "../chunker.js";

const uploadRoutes = new Hono();

uploadRoutes.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided. Send a multipart form with a 'file' field." }, 400);
  }

  // Validate extension
  const fileName = file.name;
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext !== "pdf" && ext !== "txt") {
    return c.json({ error: "Only PDF and TXT files are supported." }, 400);
  }

  try {
    // Save to temp directory
    const uploadDir = join(tmpdir(), "legal-contract-agent-uploads");
    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, `${Date.now()}-${fileName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Parse file to extract text
    let text: string;
    let pageCount: number;

    if (ext === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      text = textResult.text;
      pageCount = textResult.total;
    } else {
      // TXT
      text = buffer.toString("utf-8");
      pageCount = Math.max(1, Math.ceil(text.split(/\s+/).length / 450));
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Run chunker to get document structure
    const chunkResult = chunkDocument(text, pageCount);
    const clauses = extractClauses(text, pageCount);
    const estimatedTimeSeconds = estimateProcessingTime(chunkResult.chunks.length);

    // Store the file
    const stored = storeFile({ fileName, filePath, text, pageCount, wordCount });

    return c.json({
      fileId: stored.id,
      fileName,
      pageCount,
      wordCount,
      clauses: clauses.map((cl) => ({
        number: cl.number,
        title: cl.title,
        pageStart: cl.pageStart,
        pageEnd: cl.pageEnd,
        wordCount: cl.wordCount,
      })),
      chunkCount: chunkResult.chunks.length,
      isSinglePass: chunkResult.isSinglePass,
      estimatedTimeSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during file processing";
    return c.json({ error: message }, 500);
  }
});

export { uploadRoutes };
