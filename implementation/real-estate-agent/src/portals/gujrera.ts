// Gujarat RERA portal automation
// Portal: https://gujrera.gujarat.gov.in
//
// VERIFIED WORKING PATTERNS (March 2026):
// 1. Homepage loads with 2 modal overlays that block interaction — must dismiss via JS
// 2. Search input has placeholder "Project, Agent, Promoter, Professional, Location"
// 3. Search works with project codes (e.g., "CAA10499"), not full RERA IDs
// 4. Angular app — need to interact via page.evaluate() to bypass overlay issues
// 5. "View More" link on search results navigates to #/project-preview with full details
// 6. dev-browser needs --timeout 120 for this portal (default 30s is too short)

import type { ReraProject } from "../types/index.js";
import {
  runDevBrowserScript,
  ensureOutputDir,
  errorResult,
  successResult,
  type PortalResult,
} from "./base-portal.js";

/**
 * Search for a RERA-registered project on the Gujarat RERA portal.
 * Uses the homepage search bar (the only reliable search method).
 */
export async function searchReraProject(
  query: string,
  searchType: "rera_id" | "project_name",
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "gujrera");

  // Extract the short project code from a full RERA ID
  // e.g., "PR/GJ/SURAT/SURAT CITY/Surat Municipal Corporation/CAA10499/A1C/311224/311232"
  // → search for "CAA10499"
  let searchTerm = query;
  if (searchType === "rera_id" && query.includes("/")) {
    const parts = query.split("/");
    // The project code is typically the part that starts with letters + numbers (e.g., CAA10499)
    const codePart = parts.find(p => /^[A-Z]{2,4}\d{3,}$/i.test(p));
    if (codePart) {
      searchTerm = codePart;
    }
  }

  const safeQuery = searchTerm.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://gujrera.gujarat.gov.in/", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Force dismiss ALL modal overlays (Gujarat RERA has 2+ modals on load)
await page.evaluate(() => {
  document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
  document.querySelectorAll('.headingPdf, .homePageAnouncement').forEach(el => el.remove());
});
await new Promise(r => setTimeout(r, 1000));

// Step 2: Fill search via evaluate (bypasses any remaining overlay issues)
await page.evaluate((q) => {
  const input = document.querySelector('input[placeholder*="Project"]');
  if (input) {
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, '${safeQuery}');
await new Promise(r => setTimeout(r, 2000));

// Step 3: Click search button via JS
await page.evaluate(() => {
  const btn = document.querySelector('button.searchBtn');
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 8000));

// Step 4: Take screenshot of results
try {
  const buf = await page.screenshot({ fullPage: true });
  await saveScreenshot(buf, "${screenshotDir}/01-search-results.png");
} catch(e) {}

// Step 5: Extract results text
const text = await page.evaluate(() => document.body.innerText);
const url = page.url();

console.log("__RESULT_START__" + JSON.stringify({
  url: url,
  searchTerm: '${safeQuery}',
  pageText: text,
  screenshots: ["${screenshotDir}/01-search-results.png"]
}) + "__RESULT_END__");
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse search results from Gujarat RERA portal");
    }

    const pageText = (parsed.pageText as string) || "";
    const hasResults = pageText.includes("PROJECTS") || pageText.includes("View More");

    // Extract basic project info from page text
    const projects: Partial<ReraProject>[] = [];
    if (hasResults) {
      // Look for project names (they appear before "Project Start Date")
      const projectBlocks = pageText.split("View More");
      for (let i = 0; i < projectBlocks.length - 1; i++) {
        const block = projectBlocks[i] || "";
        const lines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0);

        // Find project name (usually the last meaningful line before dates)
        const startDateIdx = lines.findIndex(l => l.includes("Project Start Date"));
        const projectName = startDateIdx > 0 ? lines[startDateIdx - 1] : undefined;

        const startDate = block.match(/Project Start Date\s*:\s*(\S+)/)?.[1];
        const endDate = block.match(/Project End Date\s*:\s*(\S+)/)?.[1];
        const type = block.match(/Type\s*:\s*(\w+)/)?.[1];

        projects.push({
          projectName: projectName?.replace(/^PROJECTS\s*\(\d+\)\s*/, ""),
          registrationDate: startDate,
          completionDate: endDate,
          projectType: type as ReraProject["projectType"],
        });
      }
    }

    return successResult(
      {
        query,
        searchTerm,
        found: hasResults,
        projectCount: projects.length,
        projects,
        rawText: pageText.substring(0, 2000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `Gujarat RERA portal timed out searching for "${searchTerm}". The portal may be slow — try again.`
      );
    }
    return errorResult(`RERA search failed: ${message}`);
  }
}

/**
 * Get full project details by searching and clicking "View More".
 */
export async function getReraProjectDetails(
  reraId: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "gujrera");

  // Extract short code for search
  let searchTerm = reraId;
  if (reraId.includes("/")) {
    const parts = reraId.split("/");
    const codePart = parts.find(p => /^[A-Z]{2,4}\d{3,}$/i.test(p));
    if (codePart) searchTerm = codePart;
  }

  const safeQuery = searchTerm.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://gujrera.gujarat.gov.in/", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Dismiss all modals
await page.evaluate(() => {
  document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
  document.querySelectorAll('.headingPdf, .homePageAnouncement').forEach(el => el.remove());
});
await new Promise(r => setTimeout(r, 1000));

// Search for the project
await page.evaluate((q) => {
  const input = document.querySelector('input[placeholder*="Project"]');
  if (input) {
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, '${safeQuery}');
await new Promise(r => setTimeout(r, 2000));

await page.evaluate(() => {
  const btn = document.querySelector('button.searchBtn');
  if (btn) btn.click();
});
await new Promise(r => setTimeout(r, 8000));

// Click "View More" to get full details
await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, button, span'));
  const viewMore = links.find(l => l.innerText && l.innerText.includes('View More'));
  if (viewMore) viewMore.click();
});
await new Promise(r => setTimeout(r, 8000));

// Take screenshot of detail page
try {
  const buf = await page.screenshot({ fullPage: true });
  await saveScreenshot(buf, "${screenshotDir}/02-project-details.png");
} catch(e) {}

// Extract full page text
const text = await page.evaluate(() => document.body.innerText);
const url = page.url();

console.log("__RESULT_START__" + JSON.stringify({
  url: url,
  reraId: '${safeQuery}',
  pageText: text,
  screenshots: ["${screenshotDir}/02-project-details.png"]
}) + "__RESULT_END__");
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult(`Could not parse project details for RERA ID: ${reraId}`);
    }

    const pageText = (parsed.pageText as string) || "";
    const isDetailPage = pageText.includes("PROJECT VIEW") || pageText.includes("GUJRERA Reg. No.");

    // Extract structured data from the detail page text
    const details = extractDetailsFromText(pageText, reraId);

    return successResult(
      {
        reraId,
        found: isDetailPage,
        details,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `Gujarat RERA portal timed out fetching details for "${reraId}". Try again.`
      );
    }
    return errorResult(`RERA detail fetch failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

function extractDetailsFromText(text: string, reraId: string): Record<string, unknown> {
  const extract = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  return {
    reraId,
    reraRegNo: extract(/GUJRERA Reg\. No\.\s*:?\s*-?\s*(.+?)(?:\n|View)/),
    projectName: extract(/Project Name\s*:?\s*-?\s*(.+?)(?:\n|GUJRERA)/),
    projectAddress: extract(/Project Address\s*:?\s*-?\s*(.+?)(?:\n|Taluka)/),
    taluka: extract(/Taluka\s*:?\s*-?\s*(.+?)(?:,|\n)/),
    district: extract(/District\s*:?\s*-?\s*(.+?)(?:,|\n)/),
    projectType: extract(/Project Type\s*:?\s*-?\s*(\w+)/),
    aboutProperty: extract(/About Property\s*:?\s*-?\s*(.+?)(?:\n|Project Start)/),
    projectStartDate: extract(/Project Start Date\s*:?\s*-?\s*(\S+)/),
    projectEndDate: extract(/Project End Date\s*:?\s*-?\s*(\S+)/),
    landArea: extract(/Project Land Area\s*:?\s*-?\s*(.+?)(?:\n|Total)/),
    totalOpenArea: extract(/Total Open Area\s*:?\s*-?\s*([\d,.]+\s*Sq\s*\w+)/),
    totalCoveredArea: extract(/Total Covered Area\s*:?\s*-?\s*([\d,.]+\s*Sq\s*\w+)/),
    carpetAreaRange: extract(/Carpet Area.*?Range.*?:?\s*-?\s*([\d.]+\s*Sq\s*\w+\s*-\s*[\d.]+\s*Sq\s*\w+)/),
    planPassingAuthority: extract(/Plan Passing Authority\s*:?\s*-?\s*(.+?)(?:\n|Redevelopment)/),
    redevelopment: extract(/Redevelopment Project\s*:?\s*-?\s*(\w+)/),
    affordableHousing: extract(/Affordable Housing\s*:?\s*-?\s*(\w+)/),
    promoterName: extract(/Promoter Name\s*:?\s*-?\s*(.+?)(?:\n|Promoter Type)/),
    promoterType: extract(/Promoter Type\s*:?\s*-?\s*(.+?)(?:\n|Office)/),
    estimatedCost: extract(/Project Estimated Cost.*?:?\s*-?\s*([\d,]+)/),
    loanPercentage: extract(/Percentage Loan.*?:?\s*-?\s*(.+?)(?:\n|%)/),
    quarterlyCompliance: extract(/Total Quarterly Compliance Required\s*:?\s*-?\s*(\d+)/),
    quarterliesComplied: extract(/Total Complied Quarters\s*:?\s*-?\s*(\d+)/),
    quarterlyDefaulted: extract(/Total Quarterly Compliance Defaulted\s*:?\s*-?\s*(\w+)/),
    annualCompliance: extract(/Total Annual Compliance Required\s*:?\s*-?\s*(\d+)/),
    annualsComplied: extract(/Total Complied Annual Compliance\s*:?\s*-?\s*(\d+)/),
    annualDefaulted: extract(/Total Annual Compliance Defaulted\s*:?\s*-?\s*(\w+)/),
    constructionProgress: extract(/Block Progress.*?:?\s*([\d.]+)\s*%/),
  };
}
