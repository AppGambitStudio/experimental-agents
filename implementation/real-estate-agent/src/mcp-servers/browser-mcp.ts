// MCP server wrapping portal automation modules
// Exposes Gujarat RERA portal tools, eCourts, AnyRoR, GARVI, SMC Tax, GSTN,
// and a generic screenshot tool

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
import * as ecourts from "../portals/ecourts.js";
import * as anyror from "../portals/anyror.js";
import * as garvi from "../portals/garvi.js";
import * as smcTax from "../portals/smc-tax.js";
import * as gstn from "../portals/gstn.js";

// ---------------------------------------------------------------------------
// Existing RERA Tools
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
// eCourts Tools
// ---------------------------------------------------------------------------

const searchEcourtsTool = tool(
  "search_ecourts",
  "Search eCourts (services.ecourts.gov.in) for court cases by party name. " +
    "Use this to check if the seller, builder, or promoter has any pending litigation. " +
    "If the result includes captcha_required: true, inform the user and suggest Playwright MCP fallback (mcp__playwright__browser_navigate, browser_snapshot, browser_click, browser_fill_form).",
  {
    party_name: z.string().describe("Name of the party to search for (seller, builder, or promoter name)"),
    state: z.string().describe("State name (e.g. 'Gujarat')"),
    district: z.string().describe("District name (e.g. 'Surat')"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ party_name, state, district, purchase_id }) => {
    const result = await ecourts.searchByPartyName(
      party_name,
      state,
      district,
      purchase_id ?? "anonymous"
    );
    // Annotate output if captcha was required
    if (result.data && typeof result.data === "object" && "captcha_required" in (result.data as Record<string, unknown>)) {
      const data = result.data as Record<string, unknown>;
      if (data.captcha_required === true) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              _note: "CAPTCHA detected on eCourts portal. Automated search could not complete. Use Playwright MCP as fallback: call mcp__playwright__browser_navigate with the portal URL, then mcp__playwright__browser_snapshot to read the page, then mcp__playwright__browser_fill_form and mcp__playwright__browser_click to interact.",
            }),
          }],
        };
      }
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

// ---------------------------------------------------------------------------
// AnyRoR Tools
// ---------------------------------------------------------------------------

const searchAnyrorLandRecordTool = tool(
  "search_anyror_land_record",
  "Search AnyRoR (anyror.gujarat.gov.in) for urban land records by survey details. " +
    "Use this to verify land ownership, survey boundaries, and encumbrance status from Gujarat revenue records. " +
    "If portal_unavailable is returned, note it in your report.",
  {
    district: z.string().describe("District name (e.g. 'Surat')"),
    taluka: z.string().describe("Taluka name (e.g. 'Surat City')"),
    village: z.string().describe("Village or ward name"),
    survey_no: z.string().describe("Survey number or TP number"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ district, taluka, village, survey_no, purchase_id }) => {
    const result = await anyror.searchUrbanLandRecord(
      district,
      taluka,
      village,
      survey_no,
      purchase_id ?? "anonymous"
    );
    if (result.data && typeof result.data === "object" && "portal_unavailable" in (result.data as Record<string, unknown>)) {
      const data = result.data as Record<string, unknown>;
      if (data.portal_unavailable === true) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              _note: "AnyRoR portal is currently unavailable. Land record verification could not be completed. Suggest trying again later or using interactive copilot mode.",
            }),
          }],
        };
      }
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const searchAnyrorByOwnerTool = tool(
  "search_anyror_by_owner",
  "Search AnyRoR (anyror.gujarat.gov.in) by owner name to find properties they own. " +
    "Use this to verify the seller's property holdings and cross-check ownership claims.",
  {
    owner_name: z.string().describe("Owner/seller name to search for"),
    district: z.string().describe("District name (e.g. 'Surat')"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ owner_name, district, purchase_id }) => {
    const result = await anyror.searchPropertyByOwner(
      owner_name,
      district,
      purchase_id ?? "anonymous"
    );
    if (result.data && typeof result.data === "object" && "portal_unavailable" in (result.data as Record<string, unknown>)) {
      const data = result.data as Record<string, unknown>;
      if (data.portal_unavailable === true) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              _note: "AnyRoR portal is currently unavailable. Owner search could not be completed.",
            }),
          }],
        };
      }
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

// ---------------------------------------------------------------------------
// GARVI Tools
// ---------------------------------------------------------------------------

const searchGarviDocumentTool = tool(
  "search_garvi_document",
  "Search GARVI (garvi.gujarat.gov.in) for registered documents by document number. " +
    "Use this to verify if a sale deed, agreement, or other document has been registered with the Sub-Registrar Office.",
  {
    document_no: z.string().describe("Registered document number"),
    year: z.string().describe("Year of registration (e.g. '2024')"),
    sro: z.string().describe("Sub-Registrar Office name or code (e.g. 'Surat-1')"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ document_no, year, sro, purchase_id }) => {
    const result = await garvi.searchRegisteredDocument(
      document_no,
      year,
      sro,
      purchase_id ?? "anonymous"
    );
    if (result.data && typeof result.data === "object" && "portal_unavailable" in (result.data as Record<string, unknown>)) {
      const data = result.data as Record<string, unknown>;
      if (data.portal_unavailable === true) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              _note: "GARVI portal is currently unavailable. Document verification could not be completed.",
            }),
          }],
        };
      }
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const lookupGarviJantriTool = tool(
  "lookup_garvi_jantri",
  "Look up jantri (ready reckoner) rates on GARVI (garvi.gujarat.gov.in) for a specific survey. " +
    "Use this to get the government-assessed land value for stamp duty calculation and price comparison.",
  {
    district: z.string().describe("District name (e.g. 'Surat')"),
    taluka: z.string().describe("Taluka name (e.g. 'Surat City')"),
    village: z.string().describe("Village or ward name"),
    survey_no: z.string().describe("Survey number or TP number"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ district, taluka, village, survey_no, purchase_id }) => {
    const result = await garvi.lookupJantriOnline(
      district,
      taluka,
      village,
      survey_no,
      purchase_id ?? "anonymous"
    );
    if (result.data && typeof result.data === "object" && "portal_unavailable" in (result.data as Record<string, unknown>)) {
      const data = result.data as Record<string, unknown>;
      if (data.portal_unavailable === true) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              _note: "GARVI portal is currently unavailable for jantri lookup.",
            }),
          }],
        };
      }
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

// ---------------------------------------------------------------------------
// SMC Property Tax Tool
// ---------------------------------------------------------------------------

const checkSmcPropertyTaxTool = tool(
  "check_smc_property_tax",
  "Check SMC (Surat Municipal Corporation) property tax payment status. " +
    "Use this to verify if property taxes are up to date — unpaid taxes are a red flag and can block registration.",
  {
    property_id: z.string().describe("SMC property tax ID / assessment number"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ property_id, purchase_id }) => {
    const result = await smcTax.checkPropertyTax(
      property_id,
      purchase_id ?? "anonymous"
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

// ---------------------------------------------------------------------------
// GSTN Verification Tool
// ---------------------------------------------------------------------------

const verifyGstinTool = tool(
  "verify_gstin",
  "Verify a builder/promoter's GST registration (GSTIN) on the GST portal. " +
    "Use this to confirm the builder is a legitimate registered business and check their GST compliance status.",
  {
    gstin: z.string().describe("GST Identification Number (15-character alphanumeric, e.g. 24AABCU9603R1ZM)"),
    purchase_id: z
      .string()
      .optional()
      .describe("Purchase/session ID for organizing screenshots (optional)"),
  },
  async ({ gstin, purchase_id }) => {
    const result = await gstn.verifyGstin(
      gstin,
      purchase_id ?? "anonymous"
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export const browserMcp = createSdkMcpServer({
  name: "browser-mcp",
  version: "0.2.0",
  tools: [
    // Existing RERA tools
    searchReraProjectTool,
    getReraProjectDetailsTool,
    takePortalScreenshotTool,
    // New Part 2 portal tools
    searchEcourtsTool,
    searchAnyrorLandRecordTool,
    searchAnyrorByOwnerTool,
    searchGarviDocumentTool,
    lookupGarviJantriTool,
    checkSmcPropertyTaxTool,
    verifyGstinTool,
  ],
});
