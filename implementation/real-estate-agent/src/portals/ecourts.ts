// eCourts dispute search portal automation
// Portal: https://services.ecourts.gov.in/ecourtindia_v6/
//
// VERIFIED PATTERNS:
// 1. eCourts uses CAPTCHA on search forms — script detects and returns captcha_required flag
// 2. Search by party name requires state + district selection from dropdowns
// 3. If CAPTCHA is detected, the agent should fall back to Claude Browser MCP
// 4. Uses page.evaluate() for ALL interactions to bypass overlay issues
// 5. dev-browser needs --timeout 120 for this portal

import {
  runDevBrowserScript,
  ensureOutputDir,
  errorResult,
  successResult,
  type PortalResult,
} from "./base-portal.js";

/**
 * Search eCourts for cases by party name (e.g., seller or builder name).
 * Returns case results or captcha_required flag if CAPTCHA blocks the search.
 */
export async function searchByPartyName(
  partyName: string,
  state: string,
  district: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "ecourts");

  const safeName = partyName.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
  const safeState = state.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
  const safeDistrict = district.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://services.ecourts.gov.in/ecourtindia_v6/", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Force dismiss ALL modal overlays
await page.evaluate(() => {
  document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog, .popup, .overlay').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
});
await new Promise(r => setTimeout(r, 1000));

// Step 2: Navigate to "Party Name" search tab/section
await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, button, li, span, div'));
  const partyLink = links.find(el => el.innerText && el.innerText.trim().match(/party\\s*name/i));
  if (partyLink) partyLink.click();
});
await new Promise(r => setTimeout(r, 3000));

// Step 3: Select state from dropdown via page.evaluate
await page.evaluate((st) => {
  const selects = Array.from(document.querySelectorAll('select'));
  const stateSelect = selects.find(s =>
    s.id.toLowerCase().includes('state') ||
    s.name.toLowerCase().includes('state') ||
    (s.previousElementSibling && s.previousElementSibling.textContent && s.previousElementSibling.textContent.toLowerCase().includes('state'))
  );
  if (stateSelect) {
    const options = Array.from(stateSelect.options);
    const match = options.find(o => o.text.toLowerCase().includes(st.toLowerCase()));
    if (match) {
      stateSelect.value = match.value;
      stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safeState}');
await new Promise(r => setTimeout(r, 3000));

// Step 4: Select district from dropdown via page.evaluate
await page.evaluate((dist) => {
  const selects = Array.from(document.querySelectorAll('select'));
  const districtSelect = selects.find(s =>
    s.id.toLowerCase().includes('district') ||
    s.name.toLowerCase().includes('district') ||
    (s.previousElementSibling && s.previousElementSibling.textContent && s.previousElementSibling.textContent.toLowerCase().includes('district'))
  );
  if (districtSelect) {
    const options = Array.from(districtSelect.options);
    const match = options.find(o => o.text.toLowerCase().includes(dist.toLowerCase()));
    if (match) {
      districtSelect.value = match.value;
      districtSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}, '${safeDistrict}');
await new Promise(r => setTimeout(r, 2000));

// Step 5: Fill party name input via page.evaluate
await page.evaluate((name) => {
  const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
  const partyInput = inputs.find(i =>
    i.id.toLowerCase().includes('party') ||
    i.name.toLowerCase().includes('party') ||
    i.placeholder.toLowerCase().includes('party')
  );
  if (partyInput) {
    partyInput.value = name;
    partyInput.dispatchEvent(new Event('input', { bubbles: true }));
    partyInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, '${safeName}');
await new Promise(r => setTimeout(r, 1000));

// Step 6: Detect CAPTCHA
const hasCaptcha = await page.evaluate(() => {
  const text = document.body.innerText.toLowerCase();
  const html = document.body.innerHTML.toLowerCase();
  return text.includes('captcha') ||
    html.includes('captcha') ||
    !!document.querySelector('img[src*="captcha"]') ||
    !!document.querySelector('#captcha') ||
    !!document.querySelector('[name*="captcha"]');
});

// Step 7: Take screenshot
try {
  const buf = await page.screenshot({ fullPage: true });
  await saveScreenshot(buf, "${screenshotDir}/01-ecourts-search.png");
} catch(e) {}

// Step 8: Extract page text
const text = await page.evaluate(() => document.body.innerText);
const url = page.url();

console.log("__RESULT_START__" + JSON.stringify({
  url: url,
  partyName: '${safeName}',
  state: '${safeState}',
  district: '${safeDistrict}',
  captcha_required: hasCaptcha,
  pageText: text,
  screenshots: ["${screenshotDir}/01-ecourts-search.png"]
}) + "__RESULT_END__");
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse results from eCourts portal");
    }

    const pageText = (parsed.pageText as string) || "";
    const captchaRequired = parsed.captcha_required as boolean;

    if (captchaRequired) {
      return successResult(
        {
          partyName,
          state,
          district,
          captcha_required: true,
          message:
            "CAPTCHA detected on eCourts. Use Claude Browser MCP to complete the search manually.",
          rawText: pageText.substring(0, 3000),
        },
        (parsed.screenshots as string[]) || []
      );
    }

    // Extract case information from results
    const cases = extractCasesFromText(pageText);
    const hasResults =
      cases.length > 0 ||
      pageText.includes("Case Number") ||
      pageText.includes("case(s) found");

    return successResult(
      {
        partyName,
        state,
        district,
        found: hasResults,
        captcha_required: false,
        caseCount: cases.length,
        cases,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `eCourts portal timed out searching for "${partyName}". The portal may be slow — try again.`
      );
    }
    return errorResult(`eCourts search failed: ${message}`);
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

function extractCasesFromText(
  text: string
): Record<string, string | undefined>[] {
  const cases: Record<string, string | undefined>[] = [];

  // eCourts shows cases in tabular format — look for case number patterns
  const caseNumberPattern =
    /(?:Case\s*(?:No|Number)[.:\s]*)\s*([A-Z\/\d\-]+\s*\/\s*\d{4})/gi;
  let match;
  while ((match = caseNumberPattern.exec(text)) !== null) {
    cases.push({ caseNumber: match[1]?.trim() });
  }

  // Also look for structured rows with typical case patterns: "Civil Suit/123/2024"
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    const caseMatch = line.match(/([A-Za-z\s]+\/\d+\/\d{4})/);
    if (
      caseMatch &&
      !cases.find((c) => c.caseNumber === caseMatch[1]?.trim())
    ) {
      const nextLine = lines[i + 1] || "";
      cases.push({
        caseNumber: caseMatch[1]?.trim(),
        caseType: line.match(/(Civil|Criminal|Writ|Appeal|Petition|Suit)/i)?.[0],
        parties:
          nextLine.includes("Vs") || nextLine.includes("vs")
            ? nextLine
            : undefined,
        status: line.match(/(Pending|Disposed|Closed|Listed|Decided)/i)?.[0],
        filingDate: line.match(/(\d{2}[/-]\d{2}[/-]\d{4})/)?.[1],
      });
    }
  }

  return cases;
}
