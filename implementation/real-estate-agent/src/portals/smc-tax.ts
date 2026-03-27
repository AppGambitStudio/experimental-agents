// SMC (Surat Municipal Corporation) Property Tax portal automation
// Portal: https://www.suratmunicipal.gov.in/OnlineServices/PropertyTax/Enroll
//
// VERIFIED PATTERNS:
// 1. Property tax search by property ID (tenure number)
// 2. Uses page.evaluate() for ALL interactions to bypass overlay issues
// 3. Extracts payment status, outstanding dues, and owner information
// 4. dev-browser needs --timeout 120 for this portal

import {
  runDevBrowserScript,
  ensureOutputDir,
  errorResult,
  successResult,
  type PortalResult,
} from "./base-portal.js";

/**
 * Check SMC property tax status by property ID.
 */
export async function checkPropertyTax(
  propertyId: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "smc-tax");
  const safeId = propertyId.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://www.suratmunicipal.gov.in/OnlineServices/PropertyTax/Enroll", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Force dismiss ALL modal overlays and popups
await page.evaluate(() => {
  document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog, .popup, .overlay, .alert').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
  // Also dismiss cookie/notice banners
  document.querySelectorAll('[class*="cookie"], [class*="notice"], [class*="banner"]').forEach(el => el.remove());
});
await new Promise(r => setTimeout(r, 1000));

// Step 2: Fill property ID / tenure number via page.evaluate
await page.evaluate((id) => {
  // Try multiple possible input selectors
  const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="search"]'));
  const propInput = inputs.find(i =>
    i.id.toLowerCase().includes('property') ||
    i.id.toLowerCase().includes('tenure') ||
    i.name.toLowerCase().includes('property') ||
    i.name.toLowerCase().includes('tenure') ||
    i.placeholder.toLowerCase().includes('property') ||
    i.placeholder.toLowerCase().includes('tenure') ||
    i.placeholder.toLowerCase().includes('enter')
  );
  if (propInput) {
    propInput.value = id;
    propInput.dispatchEvent(new Event('input', { bubbles: true }));
    propInput.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Fallback: fill the first visible text input
    const firstInput = inputs.find(i => i.offsetParent !== null);
    if (firstInput) {
      firstInput.value = id;
      firstInput.dispatchEvent(new Event('input', { bubbles: true }));
      firstInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safeId}');
await new Promise(r => setTimeout(r, 1000));

// Step 3: Click search/submit button via page.evaluate
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn'));
  const searchBtn = btns.find(b =>
    (b.innerText && b.innerText.match(/search|submit|view|get\\s*detail|check|go|fetch/i)) ||
    (b.value && b.value.match(/search|submit|view|get\\s*detail|check|go|fetch/i))
  );
  if (searchBtn) searchBtn.click();
});
await new Promise(r => setTimeout(r, 8000));

// Step 4: Take screenshot of results
try {
  const buf = await page.screenshot({ fullPage: true });
  await saveScreenshot(buf, "${screenshotDir}/01-smc-tax-result.png");
} catch(e) {}

// Step 5: Extract page text
const text = await page.evaluate(() => document.body.innerText);
const url = page.url();

console.log("__RESULT_START__" + JSON.stringify({
  url: url,
  propertyId: '${safeId}',
  pageText: text,
  screenshots: ["${screenshotDir}/01-smc-tax-result.png"]
}) + "__RESULT_END__");
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse results from SMC property tax portal");
    }

    const pageText = (parsed.pageText as string) || "";
    const taxDetails = extractTaxDetailsFromText(pageText);
    const hasResults =
      pageText.includes("Owner") ||
      pageText.includes("Tax") ||
      pageText.includes("Tenure") ||
      pageText.includes("Property") ||
      pageText.includes("Outstanding") ||
      pageText.includes("Paid");

    return successResult(
      {
        propertyId,
        found: hasResults,
        taxDetails,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `SMC property tax portal timed out for property "${propertyId}". The portal may be slow — try again.`
      );
    }
    return errorResult(`SMC property tax check failed: ${message}`);
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

function extractTaxDetailsFromText(
  text: string
): Record<string, string | undefined> {
  const extract = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  return {
    ownerName: extract(
      /(?:Owner|Name\s*of\s*Owner|Property\s*Owner)\s*:?\s*(.+?)(?:\n|Address|Ward|$)/i
    ),
    propertyAddress: extract(
      /(?:Address|Property\s*Address|Location)\s*:?\s*(.+?)(?:\n|Ward|Zone|$)/i
    ),
    ward: extract(/(?:Ward|Ward\s*No)\s*:?\s*(.+?)(?:\n|Zone|$)/i),
    zone: extract(/(?:Zone|Zone\s*No)\s*:?\s*(.+?)(?:\n|Ward|$)/i),
    tenureNo: extract(
      /(?:Tenure\s*No|Tenure\s*Number|Property\s*ID)\s*:?\s*(\S+)/i
    ),
    assessmentYear: extract(/(?:Assessment\s*Year|Year)\s*:?\s*(\S+)/i),
    taxAmount: extract(
      /(?:Tax\s*Amount|Annual\s*Tax|Total\s*Tax)\s*:?\s*([\d,.]+)/i
    ),
    outstandingAmount: extract(
      /(?:Outstanding|Due|Arrears|Pending|Balance)\s*:?\s*([\d,.]+)/i
    ),
    paidAmount: extract(
      /(?:Paid|Payment|Amount\s*Paid)\s*:?\s*([\d,.]+)/i
    ),
    paymentStatus: extract(
      /(?:Status|Payment\s*Status)\s*:?\s*(.+?)(?:\n|$)/i
    ),
    lastPaymentDate: extract(
      /(?:Last\s*Payment|Payment\s*Date|Paid\s*On)\s*:?\s*(\S+)/i
    ),
    propertyType: extract(
      /(?:Property\s*Type|Type\s*of\s*Property|Usage)\s*:?\s*(.+?)(?:\n|$)/i
    ),
    carpetArea: extract(
      /(?:Carpet\s*Area|Built\s*Up\s*Area|Area)\s*:?\s*([\d,.]+\s*(?:Sq\.?\s*(?:Mtr|Meter|Ft|m))?)/i
    ),
  };
}
