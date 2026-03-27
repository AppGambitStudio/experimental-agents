// GSTN (GST Network) verification portal automation
// Portal: https://services.gst.gov.in/services/searchtp
//
// VERIFIED PATTERNS:
// 1. Simple portal — input field id="for_gstin", no CAPTCHA
// 2. Fill GSTIN, click search, extract business details
// 3. Uses page.evaluate() for ALL interactions to bypass overlay issues
// 4. dev-browser needs --timeout 120 for this portal

import {
  runDevBrowserScript,
  ensureOutputDir,
  errorResult,
  successResult,
  type PortalResult,
} from "./base-portal.js";

/**
 * Verify a GSTIN (GST Identification Number) on the GST portal.
 * Extracts: legal name, trade name, status, registration date, state, business type.
 */
export async function verifyGstin(
  gstin: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "gstn");
  const safeGstin = gstin.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://services.gst.gov.in/services/searchtp", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Force dismiss ALL modal overlays
await page.evaluate(() => {
  document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
});
await new Promise(r => setTimeout(r, 1000));

// Step 2: Fill GSTIN in the input field (id="for_gstin") via page.evaluate
await page.evaluate((gst) => {
  const input = document.getElementById('for_gstin') ||
    document.querySelector('input[name="gstin"]') ||
    document.querySelector('input[placeholder*="GSTIN"]');
  if (input) {
    input.value = gst;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Fallback: try any text input on the page
    const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
    const gstInput = inputs.find(i =>
      i.placeholder.toLowerCase().includes('gstin') ||
      i.placeholder.toLowerCase().includes('gst') ||
      i.id.toLowerCase().includes('gstin')
    );
    if (gstInput) {
      gstInput.value = gst;
      gstInput.dispatchEvent(new Event('input', { bubbles: true }));
      gstInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safeGstin}');
await new Promise(r => setTimeout(r, 1000));

// Step 3: Click search button via page.evaluate
await page.evaluate(() => {
  const searchBtn = document.querySelector('button.search-btn') ||
    document.querySelector('#lotsearch') ||
    document.querySelector('input[type="submit"]') ||
    document.querySelector('button[type="submit"]');
  if (searchBtn) {
    searchBtn.click();
  } else {
    // Fallback: find any button with search text
    const btns = Array.from(document.querySelectorAll('button, input[type="button"]'));
    const btn = btns.find(b =>
      (b.innerText && b.innerText.match(/search/i)) ||
      (b.value && b.value.match(/search/i))
    );
    if (btn) btn.click();
  }
});
await new Promise(r => setTimeout(r, 8000));

// Step 4: Take screenshot
try {
  const buf = await page.screenshot({ fullPage: true });
  await saveScreenshot(buf, "${screenshotDir}/01-gstn-result.png");
} catch(e) {}

// Step 5: Extract page text
const text = await page.evaluate(() => document.body.innerText);
const url = page.url();

console.log("__RESULT_START__" + JSON.stringify({
  url: url,
  gstin: '${safeGstin}',
  pageText: text,
  screenshots: ["${screenshotDir}/01-gstn-result.png"]
}) + "__RESULT_END__");
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse results from GSTN portal");
    }

    const pageText = (parsed.pageText as string) || "";
    const gstDetails = extractGstDetailsFromText(pageText);
    const hasResults =
      pageText.includes("Legal Name") ||
      pageText.includes("Trade Name") ||
      pageText.includes("GSTIN") ||
      pageText.includes("Active") ||
      pageText.includes("Cancelled");

    return successResult(
      {
        gstin,
        found: hasResults,
        gstDetails,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `GSTN portal timed out verifying "${gstin}". The portal may be slow — try again.`
      );
    }
    return errorResult(`GSTN verification failed: ${message}`);
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

function extractGstDetailsFromText(
  text: string
): Record<string, string | undefined> {
  const extract = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  return {
    gstin: extract(/GSTIN\s*(?:\/\s*UIN)?\s*:?\s*([A-Z0-9]{15})/i),
    legalName: extract(
      /Legal\s*Name\s*(?:of\s*Business)?\s*:?\s*(.+?)(?:\n|Trade|$)/i
    ),
    tradeName: extract(
      /Trade\s*Name\s*:?\s*(.+?)(?:\n|Date|Status|$)/i
    ),
    status: extract(
      /(?:GSTIN\s*)?Status\s*:?\s*(Active|Inactive|Cancelled|Suspended)/i
    ),
    registrationDate: extract(
      /(?:Date\s*of\s*Registration|Registration\s*Date|Reg\.?\s*Date)\s*:?\s*(\S+)/i
    ),
    cancellationDate: extract(
      /(?:Date\s*of\s*Cancellation|Cancellation\s*Date)\s*:?\s*(\S+)/i
    ),
    stateJurisdiction: extract(
      /(?:State\s*Jurisdiction|State)\s*:?\s*(.+?)(?:\n|Centre|$)/i
    ),
    centreJurisdiction: extract(
      /(?:Centre\s*Jurisdiction|Centre)\s*:?\s*(.+?)(?:\n|State|$)/i
    ),
    constitutionOfBusiness: extract(
      /(?:Constitution\s*of\s*Business|Business\s*Type|Nature\s*of\s*Business)\s*:?\s*(.+?)(?:\n|$)/i
    ),
    taxpayerType: extract(
      /(?:Taxpayer\s*Type)\s*:?\s*(.+?)(?:\n|$)/i
    ),
    principalPlace: extract(
      /(?:Principal\s*Place|Address)\s*:?\s*(.+?)(?:\n|$)/i
    ),
  };
}
