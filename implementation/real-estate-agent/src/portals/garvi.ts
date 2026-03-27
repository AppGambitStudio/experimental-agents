// GARVI (Gujarat Registration & Valuation Inspector) portal automation
// Portal: https://garvi.gujarat.gov.in/
//
// VERIFIED PATTERNS:
// 1. ASP.NET app with ViewState — form submissions preserve ViewState via browser
// 2. Has sections for registered document search and Jantri (circle rate) lookup
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
 * Search GARVI for a registered document by document number, year, and SRO.
 */
export async function searchRegisteredDocument(
  documentNo: string,
  year: string,
  sro: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "garvi");
  const safe = (s: string) => s.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://garvi.gujarat.gov.in/", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Force dismiss ALL modal overlays
await page.evaluate(() => {
  document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog, .popup-overlay').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
});
await new Promise(r => setTimeout(r, 1000));

// Step 2: Navigate to document search section via page.evaluate
await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, button, div, span, li'));
  const docLink = links.find(el => el.innerText && el.innerText.match(/document\\s*search|search\\s*document|registered\\s*document|index\\s*-?\\s*2|index.*ii/i));
  if (docLink) docLink.click();
});
await new Promise(r => setTimeout(r, 5000));

// Step 3: Select SRO (Sub Registrar Office) from dropdown via page.evaluate
await page.evaluate((sroVal) => {
  const selects = Array.from(document.querySelectorAll('select'));
  const sroSelect = selects.find(s =>
    s.id.toLowerCase().includes('sro') ||
    s.name.toLowerCase().includes('sro') ||
    s.id.toLowerCase().includes('office') ||
    s.name.toLowerCase().includes('office')
  );
  if (sroSelect) {
    const options = Array.from(sroSelect.options);
    const match = options.find(o => o.text.toLowerCase().includes(sroVal.toLowerCase()));
    if (match) {
      sroSelect.value = match.value;
      sroSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safe(sro)}');
await new Promise(r => setTimeout(r, 2000));

// Step 4: Select year from dropdown via page.evaluate
await page.evaluate((yr) => {
  const selects = Array.from(document.querySelectorAll('select'));
  const yearSelect = selects.find(s =>
    s.id.toLowerCase().includes('year') ||
    s.name.toLowerCase().includes('year')
  );
  if (yearSelect) {
    const options = Array.from(yearSelect.options);
    const match = options.find(o => o.text.includes(yr) || o.value.includes(yr));
    if (match) {
      yearSelect.value = match.value;
      yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safe(year)}');
await new Promise(r => setTimeout(r, 2000));

// Step 5: Fill document number via page.evaluate
await page.evaluate((docNo) => {
  const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
  const docInput = inputs.find(i =>
    i.id.toLowerCase().includes('doc') ||
    i.name.toLowerCase().includes('doc') ||
    i.id.toLowerCase().includes('serial') ||
    i.name.toLowerCase().includes('serial') ||
    i.placeholder.toLowerCase().includes('document')
  );
  if (docInput) {
    docInput.value = docNo;
    docInput.dispatchEvent(new Event('input', { bubbles: true }));
    docInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, '${safe(documentNo)}');
await new Promise(r => setTimeout(r, 1000));

// Step 6: Click search/submit button via page.evaluate (ASP.NET postback)
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
  const searchBtn = btns.find(b =>
    (b.innerText && b.innerText.match(/search|submit|view|get\\s*detail|show/i)) ||
    (b.value && b.value.match(/search|submit|view|get\\s*detail|show/i))
  );
  if (searchBtn) searchBtn.click();
});
await new Promise(r => setTimeout(r, 8000));

// Step 7: Take screenshot
try {
  const buf = await page.screenshot({ fullPage: true });
  await saveScreenshot(buf, "${screenshotDir}/01-garvi-doc-result.png");
} catch(e) {}

// Step 8: Extract page text
const text = await page.evaluate(() => document.body.innerText);
const url = page.url();

console.log("__RESULT_START__" + JSON.stringify({
  url: url,
  documentNo: '${safe(documentNo)}',
  year: '${safe(year)}',
  sro: '${safe(sro)}',
  pageText: text,
  screenshots: ["${screenshotDir}/01-garvi-doc-result.png"]
}) + "__RESULT_END__");
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse results from GARVI portal");
    }

    const pageText = (parsed.pageText as string) || "";
    const docDetails = extractDocumentFromText(pageText);
    const hasResults =
      pageText.includes("Document") &&
      (pageText.includes("Party") ||
        pageText.includes("Stamp") ||
        pageText.includes("Registration"));

    return successResult(
      {
        documentNo,
        year,
        sro,
        found: hasResults,
        document: docDetails,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `GARVI portal timed out. The portal may be slow — try again.`
      );
    }
    return errorResult(`GARVI document search failed: ${message}`);
  }
}

/**
 * Look up Jantri (circle rate / government valuation rate) on GARVI.
 */
export async function lookupJantriOnline(
  district: string,
  taluka: string,
  village: string,
  surveyNo: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "garvi");
  const safe = (s: string) => s.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://garvi.gujarat.gov.in/", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Dismiss modals via page.evaluate
await page.evaluate(() => {
  document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog, .popup-overlay').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
});
await new Promise(r => setTimeout(r, 1000));

// Step 2: Navigate to Jantri section via page.evaluate
await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, button, div, span, li'));
  const jantriLink = links.find(el => el.innerText && el.innerText.match(/jantri|circle\\s*rate|valuation|annual\\s*statement/i));
  if (jantriLink) jantriLink.click();
});
await new Promise(r => setTimeout(r, 5000));

// Step 3: Select district via page.evaluate
await page.evaluate((dist) => {
  const selects = Array.from(document.querySelectorAll('select'));
  const districtSelect = selects.find(s =>
    s.id.toLowerCase().includes('district') ||
    s.name.toLowerCase().includes('district')
  );
  if (districtSelect) {
    const options = Array.from(districtSelect.options);
    const match = options.find(o => o.text.toLowerCase().includes(dist.toLowerCase()));
    if (match) {
      districtSelect.value = match.value;
      districtSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safe(district)}');
await new Promise(r => setTimeout(r, 3000));

// Step 4: Select taluka via page.evaluate
await page.evaluate((tal) => {
  const selects = Array.from(document.querySelectorAll('select'));
  const talukaSelect = selects.find(s =>
    s.id.toLowerCase().includes('taluka') ||
    s.name.toLowerCase().includes('taluka')
  );
  if (talukaSelect) {
    const options = Array.from(talukaSelect.options);
    const match = options.find(o => o.text.toLowerCase().includes(tal.toLowerCase()));
    if (match) {
      talukaSelect.value = match.value;
      talukaSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safe(taluka)}');
await new Promise(r => setTimeout(r, 3000));

// Step 5: Select village via page.evaluate
await page.evaluate((vil) => {
  const selects = Array.from(document.querySelectorAll('select'));
  const villageSelect = selects.find(s =>
    s.id.toLowerCase().includes('village') ||
    s.name.toLowerCase().includes('village')
  );
  if (villageSelect) {
    const options = Array.from(villageSelect.options);
    const match = options.find(o => o.text.toLowerCase().includes(vil.toLowerCase()));
    if (match) {
      villageSelect.value = match.value;
      villageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safe(village)}');
await new Promise(r => setTimeout(r, 2000));

// Step 6: Fill survey number via page.evaluate
await page.evaluate((survey) => {
  const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
  const surveyInput = inputs.find(i =>
    i.id.toLowerCase().includes('survey') ||
    i.name.toLowerCase().includes('survey') ||
    i.placeholder.toLowerCase().includes('survey')
  );
  if (surveyInput) {
    surveyInput.value = survey;
    surveyInput.dispatchEvent(new Event('input', { bubbles: true }));
    surveyInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, '${safe(surveyNo)}');
await new Promise(r => setTimeout(r, 1000));

// Step 7: Click submit/search via page.evaluate
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
  const searchBtn = btns.find(b =>
    (b.innerText && b.innerText.match(/search|submit|view|get\\s*detail|show|jantri/i)) ||
    (b.value && b.value.match(/search|submit|view|get\\s*detail|show|jantri/i))
  );
  if (searchBtn) searchBtn.click();
});
await new Promise(r => setTimeout(r, 8000));

// Step 8: Screenshot
try {
  const buf = await page.screenshot({ fullPage: true });
  await saveScreenshot(buf, "${screenshotDir}/02-garvi-jantri-result.png");
} catch(e) {}

// Step 9: Extract text
const text = await page.evaluate(() => document.body.innerText);
const url = page.url();

console.log("__RESULT_START__" + JSON.stringify({
  url: url,
  district: '${safe(district)}',
  taluka: '${safe(taluka)}',
  village: '${safe(village)}',
  surveyNo: '${safe(surveyNo)}',
  pageText: text,
  screenshots: ["${screenshotDir}/02-garvi-jantri-result.png"]
}) + "__RESULT_END__");
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse Jantri results from GARVI portal");
    }

    const pageText = (parsed.pageText as string) || "";
    const jantriDetails = extractJantriFromText(pageText);
    const hasResults =
      pageText.includes("Jantri") ||
      pageText.includes("Rate") ||
      pageText.includes("Valuation") ||
      pageText.includes("Rs");

    return successResult(
      {
        district,
        taluka,
        village,
        surveyNo,
        found: hasResults,
        jantri: jantriDetails,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `GARVI portal timed out fetching Jantri rates. The portal may be slow — try again.`
      );
    }
    return errorResult(`GARVI Jantri lookup failed: ${message}`);
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

function extractDocumentFromText(
  text: string
): Record<string, string | undefined> {
  const extract = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  return {
    documentNo: extract(
      /Document\s*(?:No|Number|Sr)[.:\s]*\s*(\S+)/i
    ),
    registrationDate: extract(
      /(?:Registration|Reg\.?)\s*Date\s*:?\s*(\S+)/i
    ),
    party1: extract(
      /(?:Party\s*1|First\s*Party|Seller|Executant)\s*:?\s*(.+?)(?:\n|Party|$)/i
    ),
    party2: extract(
      /(?:Party\s*2|Second\s*Party|Buyer|Claimant)\s*:?\s*(.+?)(?:\n|Property|$)/i
    ),
    propertyDescription: extract(
      /(?:Property|Schedule|Description)\s*:?\s*(.+?)(?:\n|Stamp|$)/i
    ),
    stampDuty: extract(/(?:Stamp\s*Duty|Stamp\s*Value)\s*:?\s*([\d,.]+)/i),
    registrationFee: extract(
      /(?:Registration\s*Fee|Reg\.?\s*Fee)\s*:?\s*([\d,.]+)/i
    ),
    marketValue: extract(
      /(?:Market\s*Value|Consideration)\s*:?\s*([\d,.]+)/i
    ),
    documentType: extract(
      /(?:Document\s*Type|Type\s*of\s*Document|Deed\s*Type)\s*:?\s*(.+?)(?:\n|$)/i
    ),
    sro: extract(/(?:SRO|Sub\s*Registrar)\s*:?\s*(.+?)(?:\n|$)/i),
  };
}

function extractJantriFromText(
  text: string
): Record<string, string | undefined> {
  const extract = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  return {
    village: extract(/Village\s*:?\s*(.+?)(?:\n|Taluka|District)/i),
    surveyNo: extract(/Survey\s*(?:No|Number)[.:\s]*\s*(\S+)/i),
    landRate: extract(
      /(?:Land\s*Rate|Rate\s*per\s*(?:Sq|sq))\s*:?\s*([\d,.]+)/i
    ),
    constructionRate: extract(
      /(?:Construction\s*Rate|Building\s*Rate)\s*:?\s*([\d,.]+)/i
    ),
    zone: extract(/(?:Zone|Area\s*Type)\s*:?\s*(.+?)(?:\n|$)/i),
    subZone: extract(/(?:Sub\s*Zone|Sub\s*Area)\s*:?\s*(.+?)(?:\n|$)/i),
    effectiveDate: extract(
      /(?:Effective\s*Date|w\.e\.f|From)\s*:?\s*(\S+)/i
    ),
    ratePerSqMtr: extract(
      /(?:Rate.*?Sq\.?\s*(?:Mtr|Meter|m))\s*:?\s*([\d,.]+)/i
    ),
    ratePerSqFt: extract(
      /(?:Rate.*?Sq\.?\s*(?:Ft|Feet|foot))\s*:?\s*([\d,.]+)/i
    ),
  };
}
