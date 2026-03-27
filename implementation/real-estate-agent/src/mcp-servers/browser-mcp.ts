// MCP server wrapping portal automation modules
// Exposes Gujarat RERA portal tools and a generic screenshot tool

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  searchReraProject,
  getReraProjectDetails,
} from "../portals/gujrera.js";
import {
  runDevBrowserScript,
  buildNavigationScript,
  ensureOutputDir,
} from "../portals/base-portal.js";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const searchReraProjectTool = tool(
  "search_rera_project",
  "Search for a RERA-registered real estate project on the Gujarat RERA portal (gujrera.gujarat.gov.in). " +
    "Returns project search results including RERA IDs, builder names, and registration status. " +
    "Use this to verify whether a project is RERA-registered before recommending it to a buyer.",
  {
    query: z.string().describe("Search term — a RERA registration ID (e.g. PR/GJ/AHMEDABAD/...) or a project name"),
    search_type: z
      .enum(["rera_id", "project_name"])
      .describe("Whether to search by RERA ID or by project name"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ query, search_type, purchase_id }) => {
    const result = await searchReraProject(
      query,
      search_type,
      purchase_id ?? "anonymous"
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const getReraProjectDetailsTool = tool(
  "get_rera_project_details",
  "Get detailed information about a specific RERA-registered project from the Gujarat RERA portal. " +
    "Returns project phases, bank details, approved plans, uploaded documents, complaint count, and more. " +
    "Use this after finding a project via search to perform deep due diligence.",
  {
    rera_id: z.string().describe("The RERA registration ID (e.g. PR/GJ/AHMEDABAD/AHMEDABAD CITY/RAAXXXX/XXXXXXX)"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ rera_id, purchase_id }) => {
    const result = await getReraProjectDetails(
      rera_id,
      purchase_id ?? "anonymous"
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const takePortalScreenshotTool = tool(
  "take_portal_screenshot",
  "Take a screenshot of any URL using headless browser automation. " +
    "Returns the screenshot file path and an AI-optimized page snapshot. " +
    "Useful for capturing evidence from government portals, builder websites, or any web page.",
  {
    url: z.string().url().describe("The URL to navigate to and screenshot"),
    page_name: z
      .string()
      .optional()
      .describe("Name for the browser page/tab (for session reuse). Defaults to 'screenshot'."),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
    portal_name: z
      .string()
      .optional()
      .describe("Portal identifier for screenshot organization (e.g. 'garvi', 'igr'). Defaults to 'generic'."),
  },
  async ({ url, page_name, purchase_id, portal_name }) => {
    const pid = purchase_id ?? "anonymous";
    const portal = portal_name ?? "generic";
    const pageName = page_name ?? "screenshot";
    const screenshotDir = ensureOutputDir(pid, portal);

    const timestamp = Date.now();
    const screenshotPath = `${screenshotDir}/screenshot-${timestamp}.png`;

    const bodyScript = `
let snapshot = null;
let screenshotSaved = false;

try {
  const shot = await page.screenshot();
  saveScreenshot("${screenshotPath}", shot);
  screenshotSaved = true;
} catch (e) {
  console.log("Screenshot failed: " + e.message);
}

try {
  snapshot = await page.snapshotForAI();
} catch (e) {
  console.log("Snapshot failed: " + e.message);
}

const output = {
  url: "${url.replace(/"/g, '\\"')}",
  screenshotPath: screenshotSaved ? "${screenshotPath}" : null,
  snapshot: snapshot,
};

console.log("__RESULT_START__" + JSON.stringify(output) + "__RESULT_END__");
`;

    const fullScript = buildNavigationScript(pageName, url, bodyScript);

    try {
      const raw = runDevBrowserScript(fullScript, 60000);

      // Extract the JSON result
      const startMarker = "__RESULT_START__";
      const endMarker = "__RESULT_END__";
      const startIdx = raw.indexOf(startMarker);
      const endIdx = raw.indexOf(endMarker);

      let result: Record<string, unknown> = { url, screenshotPath: null, snapshot: null };
      if (startIdx !== -1 && endIdx !== -1) {
        try {
          result = JSON.parse(raw.slice(startIdx + startMarker.length, endIdx));
        } catch {
          // Use defaults
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              data: result,
              screenshots: result.screenshotPath ? [result.screenshotPath] : [],
              errors: [],
            }),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              data: { url },
              screenshots: [],
              errors: [message],
            }),
          },
        ],
      };
    }
  },
  { annotations: { readOnlyHint: true } }
);

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export const browserMcp = createSdkMcpServer({
  name: "browser-mcp",
  version: "0.1.0",
  tools: [
    searchReraProjectTool,
    getReraProjectDetailsTool,
    takePortalScreenshotTool,
  ],
});
