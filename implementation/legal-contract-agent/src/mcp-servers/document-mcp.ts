// document-mcp: Document parsing tools
// Handles PDF/DOCX extraction for contract analysis

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

const parseDocumentTool = tool(
  "parse_document",
  "Extract clean text from a PDF or DOCX contract file. Returns the full document text, page count, and word count.",
  {
    file_path: z.string().describe("Absolute path to the PDF or DOCX file"),
  },
  async ({ file_path }) => {
    if (!existsSync(file_path)) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: `File not found: ${file_path}` }) },
        ],
      };
    }

    try {
      const ext = file_path.toLowerCase().split(".").pop();

      if (ext === "pdf") {
        const { PDFParse } = await import("pdf-parse");
        const buffer = await readFile(file_path);
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const textResult = await parser.getText();
        const infoResult = await parser.getInfo();

        const result = {
          text: textResult.text,
          page_count: textResult.total,
          word_count: textResult.text.split(/\s+/).filter(Boolean).length,
          language: "en",
          format: "pdf",
          title: infoResult.info?.Title ?? undefined,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      }

      if (ext === "txt" || ext === "md") {
        const text = await readFile(file_path, "utf-8");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                text,
                page_count: 1,
                word_count: text.split(/\s+/).filter(Boolean).length,
                language: "en",
                format: ext,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Unsupported format: ${ext}. Supported: pdf, txt, md`,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `Failed to parse document: ${err instanceof Error ? err.message : String(err)}`,
            }),
          },
        ],
      };
    }
  },
  { annotations: { readOnlyHint: true } }
);

const extractMetadataTool = tool(
  "extract_metadata",
  "Extract basic metadata from document text: parties, dates, document type. Uses pattern matching for quick extraction before full Claude analysis.",
  {
    text: z
      .string()
      .describe("The full document text to extract metadata from"),
  },
  async ({ text }) => {
    // Simple pattern-based extraction for prototype
    const datePattern = /dated\s+(?:as\s+of\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i;
    const dateMatch = text.match(datePattern);

    const partyPatterns = [
      /by and (?:between|among)\s+(.+?)(?:,\s*a\s+|,\s*an?\s+)/i,
      /between\s+(.+?)\s+\("([^"]+)"\)/gi,
    ];

    const parties: string[] = [];
    for (const pattern of partyPatterns) {
      const match = text.match(pattern);
      if (match) parties.push(match[1]);
    }

    // Detect contract type from title/content
    const titleMatch = text.match(
      /^(master\s+)?(\w+\s+)*agreement|contract|deed/im
    );

    const result = {
      date: dateMatch?.[1] ?? "unknown",
      parties,
      detected_title: titleMatch?.[0]?.trim() ?? "Unknown Agreement",
      word_count: text.split(/\s+/).filter(Boolean).length,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

export const documentMcp = createSdkMcpServer({
  name: "document-mcp",
  tools: [parseDocumentTool, extractMetadataTool],
});
