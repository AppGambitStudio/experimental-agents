// Gujarat RERA portal automation
// Portal: https://gujrera.gujarat.gov.in
//
// Note: Government portal UIs change frequently. Scripts are designed to be
// resilient — they try multiple selector strategies and fall back to
// snapshot-based extraction when specific selectors fail.

import type { ReraProject, ReraProjectDetail } from "../types/index.js";
import {
  runDevBrowserScript,
  ensureOutputDir,
  buildNavigationScript,
  errorResult,
  successResult,
  type PortalResult,
} from "./base-portal.js";

const GUJRERA_BASE = "https://gujrera.gujarat.gov.in";
const GUJRERA_SEARCH = `${GUJRERA_BASE}/project-search`;

/**
 * Search for a RERA-registered project on the Gujarat RERA portal.
 *
 * @param query - The search term (RERA ID or project name)
 * @param searchType - Whether to search by RERA ID or project name
 * @param purchaseId - Optional purchase ID for organizing screenshots
 */
export async function searchReraProject(
  query: string,
  searchType: "rera_id" | "project_name",
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "gujrera");

  // Escape user input for safe embedding in the script
  const safeQuery = query.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
  const searchLabel = searchType === "rera_id" ? "RERA ID" : "Project Name";

  const bodyScript = `
// --- Take initial screenshot of the search page ---
let screenshots = [];
try {
  const initShot = await page.screenshot();
  saveScreenshot("${screenshotDir}/01-search-page.png", initShot);
  screenshots.push("${screenshotDir}/01-search-page.png");
} catch (_) {}

// --- Get initial snapshot to understand the page structure ---
let snapshot;
try {
  snapshot = await page.snapshotForAI();
} catch (_) {
  snapshot = null;
}

// --- Try to fill the search form using multiple strategies ---
let searchSubmitted = false;

// Strategy 1: Look for input fields by common patterns
const inputSelectors = [
  'input[name*="rera"]',
  'input[name*="project"]',
  'input[name*="search"]',
  'input[placeholder*="RERA"]',
  'input[placeholder*="project"]',
  'input[placeholder*="search"]',
  'input[placeholder*="Search"]',
  'input[type="text"]',
  'input[type="search"]',
  '#txtSearchProject',
  '#txtReraNo',
  '#searchInput',
];

for (const selector of inputSelectors) {
  try {
    await page.fill(selector, '${safeQuery}');
    searchSubmitted = true;
    console.log("Filled input with selector: " + selector);
    break;
  } catch (_) {
    // Selector not found, try next
  }
}

// Strategy 2: If search type selection is needed (radio/dropdown)
if (searchSubmitted) {
  const typeSelectors = ${searchType === "rera_id"
    ? `[
    'input[value*="rera"]',
    'input[value*="RERA"]',
    'input[value="1"]',
    'select option[value*="rera"]',
    '#searchByReraId',
  ]`
    : `[
    'input[value*="project"]',
    'input[value*="name"]',
    'input[value="2"]',
    'select option[value*="project"]',
    '#searchByName',
  ]`};
  for (const sel of typeSelectors) {
    try {
      await page.click(sel);
      console.log("Selected search type with: " + sel);
      break;
    } catch (_) {}
  }
}

// Strategy 3: Click the search/submit button
const buttonSelectors = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Search")',
  'button:has-text("search")',
  'a:has-text("Search")',
  '#btnSearch',
  '.btn-search',
  '.search-btn',
];

for (const btnSel of buttonSelectors) {
  try {
    await page.click(btnSel);
    console.log("Clicked search with: " + btnSel);
    break;
  } catch (_) {}
}

// Wait for results to load
await new Promise(r => setTimeout(r, 3000));

// --- Take screenshot of results ---
try {
  const resultShot = await page.screenshot();
  saveScreenshot("${screenshotDir}/02-search-results.png", resultShot);
  screenshots.push("${screenshotDir}/02-search-results.png");
} catch (_) {}

// --- Extract results via snapshot ---
let resultSnapshot;
try {
  resultSnapshot = await page.snapshotForAI();
} catch (_) {
  resultSnapshot = null;
}

// --- Build the output ---
const output = {
  query: '${safeQuery}',
  searchType: '${searchType}',
  searchLabel: '${searchLabel}',
  searchSubmitted: searchSubmitted,
  initialSnapshot: snapshot,
  resultSnapshot: resultSnapshot,
  screenshots: screenshots,
};

console.log("__RESULT_START__" + JSON.stringify(output) + "__RESULT_END__");
`;

  const fullScript = buildNavigationScript("gujrera-search", GUJRERA_SEARCH, bodyScript);

  try {
    const raw = runDevBrowserScript(fullScript);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult(
        "Could not parse search results from portal output",
        [`${screenshotDir}/01-search-page.png`]
      );
    }

    // Attempt to extract structured project data from the snapshot
    const projects = extractProjectsFromSnapshot(parsed.resultSnapshot);

    return successResult(
      {
        query,
        searchType,
        projects,
        rawSnapshot: parsed.resultSnapshot,
        searchSubmitted: parsed.searchSubmitted,
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Check for common failure modes
    if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return errorResult(
        `Gujarat RERA portal timed out. The portal may be temporarily unavailable. Query: "${query}"`,
        [`${screenshotDir}/01-search-page.png`]
      );
    }
    if (message.includes("CAPTCHA") || message.includes("captcha")) {
      return errorResult(
        `Gujarat RERA portal is showing a CAPTCHA. Automated search cannot proceed. Query: "${query}"`,
        [`${screenshotDir}/01-search-page.png`]
      );
    }

    return errorResult(`RERA search failed: ${message}`);
  }
}

/**
 * Get detailed project information from the Gujarat RERA portal.
 *
 * @param reraId - The RERA registration ID
 * @param purchaseId - Optional purchase ID for organizing screenshots
 */
export async function getReraProjectDetails(
  reraId: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "gujrera");
  const safeReraId = reraId.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  // Try the direct project detail URL first, then fall back to search
  const detailUrl = `${GUJRERA_BASE}/project-details/${encodeURIComponent(reraId)}`;

  const bodyScript = `
let screenshots = [];
let detailSnapshot = null;

// --- Screenshot the detail page ---
try {
  const shot = await page.screenshot();
  saveScreenshot("${screenshotDir}/03-detail-page.png", shot);
  screenshots.push("${screenshotDir}/03-detail-page.png");
} catch (_) {}

// --- Get snapshot for structured extraction ---
try {
  detailSnapshot = await page.snapshotForAI();
} catch (_) {}

// --- Check if we landed on a valid detail page ---
let pageContent = "";
try {
  pageContent = await page.evaluate(() => document.body.innerText || "");
} catch (_) {}

const is404 = pageContent.includes("not found") ||
              pageContent.includes("404") ||
              pageContent.includes("No record");

// If direct URL didn't work, try searching
if (is404 || !pageContent || pageContent.length < 200) {
  console.log("Direct URL failed, falling back to search...");

  try {
    await page.goto("${GUJRERA_SEARCH}", { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (_) {
    console.log("Search page navigation slow, continuing...");
  }
  await new Promise(r => setTimeout(r, 2000));

  // Try to search by RERA ID
  const inputSelectors = [
    'input[name*="rera"]',
    'input[name*="search"]',
    'input[placeholder*="RERA"]',
    'input[type="text"]',
    '#txtReraNo',
    '#searchInput',
  ];

  for (const sel of inputSelectors) {
    try {
      await page.fill(sel, '${safeReraId}');
      console.log("Filled RERA ID in: " + sel);
      break;
    } catch (_) {}
  }

  // Submit search
  const btnSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Search")',
    '#btnSearch',
  ];
  for (const btn of btnSelectors) {
    try {
      await page.click(btn);
      break;
    } catch (_) {}
  }

  await new Promise(r => setTimeout(r, 3000));

  // Try to click through to the detail page from results
  const linkSelectors = [
    'a:has-text("View")',
    'a:has-text("Details")',
    'a:has-text("${safeReraId}")',
    'table tbody tr:first-child a',
    '.project-link:first-child',
    'a[href*="project-details"]',
  ];

  for (const link of linkSelectors) {
    try {
      await page.click(link);
      console.log("Clicked detail link: " + link);
      break;
    } catch (_) {}
  }

  await new Promise(r => setTimeout(r, 3000));

  // Re-capture after navigating to detail
  try {
    const shot2 = await page.screenshot();
    saveScreenshot("${screenshotDir}/04-detail-via-search.png", shot2);
    screenshots.push("${screenshotDir}/04-detail-via-search.png");
  } catch (_) {}

  try {
    detailSnapshot = await page.snapshotForAI();
  } catch (_) {}
}

// --- Attempt to extract specific data sections ---
// Try to find and expand all tabs/sections on the detail page
const tabSelectors = [
  '.nav-tabs a',
  '.tab-link',
  'a[data-toggle="tab"]',
  'button[data-toggle="tab"]',
  '.accordion-header',
];

for (const tabSel of tabSelectors) {
  try {
    const tabs = await page.$$eval(tabSel, els => els.length);
    for (let i = 0; i < tabs; i++) {
      try {
        const allTabs = await page.$$(tabSel);
        if (allTabs[i]) {
          await allTabs[i].click();
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (_) {}
    }
  } catch (_) {}
}

// Final comprehensive snapshot after expanding all sections
let fullSnapshot = null;
try {
  fullSnapshot = await page.snapshotForAI();
} catch (_) {}

try {
  const finalShot = await page.screenshot();
  saveScreenshot("${screenshotDir}/05-detail-expanded.png", finalShot);
  screenshots.push("${screenshotDir}/05-detail-expanded.png");
} catch (_) {}

const output = {
  reraId: '${safeReraId}',
  detailSnapshot: detailSnapshot,
  fullSnapshot: fullSnapshot,
  screenshots: screenshots,
};

console.log("__RESULT_START__" + JSON.stringify(output) + "__RESULT_END__");
`;

  const fullScript = buildNavigationScript("gujrera-detail", detailUrl, bodyScript);

  try {
    const raw = runDevBrowserScript(fullScript, 180000);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult(
        `Could not parse detail results for RERA ID: ${reraId}`,
        [`${screenshotDir}/03-detail-page.png`]
      );
    }

    // Extract structured detail from snapshot
    const details = extractDetailFromSnapshot(parsed.fullSnapshot || parsed.detailSnapshot, reraId);

    return successResult(
      {
        reraId,
        details,
        rawSnapshot: parsed.fullSnapshot || parsed.detailSnapshot,
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return errorResult(
        `Gujarat RERA portal timed out while fetching details for ${reraId}. The portal may be temporarily unavailable.`
      );
    }

    return errorResult(`RERA detail fetch failed for ${reraId}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the JSON result object from dev-browser console output.
 * The script wraps its output in __RESULT_START__ ... __RESULT_END__ markers.
 */
function extractJsonResult(raw: string): Record<string, unknown> | null {
  const startMarker = "__RESULT_START__";
  const endMarker = "__RESULT_END__";
  const startIdx = raw.indexOf(startMarker);
  const endIdx = raw.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) return null;

  const jsonStr = raw.slice(startIdx + startMarker.length, endIdx);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Best-effort extraction of project list from a snapshot.
 * The snapshot is AI-optimized structured data; we look for table rows or
 * repeated card-like structures that contain RERA IDs.
 *
 * This returns partial ReraProject objects — Claude will refine them using
 * the raw snapshot when needed.
 */
function extractProjectsFromSnapshot(
  snapshot: unknown
): Partial<ReraProject>[] {
  if (!snapshot) return [];

  const text = typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot);

  // Look for RERA ID patterns (e.g., PR/GJ/AHMEDABAD/AHMEDABAD CITY/RAAXXXX/...)
  const reraPattern = /PR\/GJ\/[A-Z\/]+\/\w+\/\d+/g;
  const matches = text.match(reraPattern) || [];
  const uniqueIds = [...new Set(matches)];

  return uniqueIds.map((id) => ({
    reraId: id,
    projectName: undefined,
    builderName: undefined,
    projectStatus: undefined,
  }));
}

/**
 * Best-effort extraction of detail fields from a snapshot.
 * Returns a partial ReraProjectDetail — Claude interprets the full snapshot
 * for complete data.
 */
function extractDetailFromSnapshot(
  snapshot: unknown,
  reraId: string
): Partial<ReraProjectDetail> {
  if (!snapshot) {
    return { reraId };
  }

  const text = typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot);
  const detail: Partial<ReraProjectDetail> = { reraId };

  // Try to extract common fields via simple pattern matching
  const patterns: Array<[keyof ReraProjectDetail, RegExp]> = [
    ["projectName", /project\s*name[:\s]+([^\n,]+)/i],
    ["builderName", /(?:promoter|builder|developer)\s*name[:\s]+([^\n,]+)/i],
    ["projectStatus", /(?:project\s*)?status[:\s]+([^\n,]+)/i],
    ["registrationDate", /registration\s*date[:\s]+([^\n,]+)/i],
    ["expiryDate", /(?:expiry|validity)\s*date[:\s]+([^\n,]+)/i],
    ["completionDate", /(?:completion|expected\s*completion)\s*date[:\s]+([^\n,]+)/i],
    ["lastUpdated", /(?:last\s*updated|updated\s*on)[:\s]+([^\n,]+)/i],
  ];

  for (const [field, regex] of patterns) {
    const match = text.match(regex);
    if (match?.[1]) {
      (detail as Record<string, unknown>)[field] = match[1].trim();
    }
  }

  // Try to extract total units
  const unitsMatch = text.match(/total\s*(?:units|flats|apartments)[:\s]+(\d+)/i);
  if (unitsMatch?.[1]) {
    detail.totalUnits = parseInt(unitsMatch[1], 10);
  }

  // Try to extract complaints count
  const complaintsMatch = text.match(/complaints?[:\s]+(\d+)/i);
  if (complaintsMatch?.[1]) {
    detail.complaints = parseInt(complaintsMatch[1], 10);
  }

  return detail;
}
