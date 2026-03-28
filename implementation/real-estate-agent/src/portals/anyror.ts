// AnyRoR (Any Record of Rights) Gujarat land records portal automation
// Portal: https://anyror.gujarat.gov.in/
//
// VERIFIED PATTERNS:
// 1. Pages are flaky — "Application Error" on some URLs
// 2. Try "VIEW LAND RECORD - URBAN" link for Surat and similar cities
// 3. If portal returns error, return portal_unavailable flag for fallback to Chrome DevTools MCP (mcp__chrome-devtools__*)
// 4. Uses page.evaluate() for ALL form interactions (fill, click) to bypass overlays
// 5. dev-browser needs --timeout 120 for this portal

import {
  runDevBrowserScript,
  ensureOutputDir,
  errorResult,
  successResult,
  type PortalResult,
} from "./base-portal.js";

/**
 * Search AnyRoR for urban land records by survey details.
 */
export async function searchUrbanLandRecord(
  district: string,
  taluka: string,
  village: string,
  surveyNo: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "anyror");
  const safe = (s: string) => s.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://anyror.gujarat.gov.in/", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Check if portal loaded or returned an error
const initialText = await page.evaluate(() => document.body.innerText);
if (initialText.includes('Application Error') || initialText.includes('Service Unavailable') || initialText.includes('Server Error')) {
  try {
    const buf = await page.screenshot({ fullPage: true });
    await saveScreenshot(buf, "${screenshotDir}/01-anyror-error.png");
  } catch(e) {}

  console.log("__RESULT_START__" + JSON.stringify({
    portal_unavailable: true,
    message: "AnyRoR portal returned an error page",
    pageText: initialText.substring(0, 2000),
    screenshots: ["${screenshotDir}/01-anyror-error.png"]
  }) + "__RESULT_END__");
} else {

  // Step 2: Force dismiss ALL modal overlays
  await page.evaluate(() => {
    document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = 'auto';
  });
  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Click on "VIEW LAND RECORD - URBAN" link via page.evaluate
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button, div, span'));
    const urbanLink = links.find(el => el.innerText && el.innerText.match(/VIEW LAND RECORD.*URBAN|URBAN.*LAND RECORD|urban/i));
    if (urbanLink) urbanLink.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  // Step 4: Check if the sub-page loaded or errored
  const subText = await page.evaluate(() => document.body.innerText);
  if (subText.includes('Application Error') || subText.includes('Service Unavailable')) {
    try {
      const buf = await page.screenshot({ fullPage: true });
      await saveScreenshot(buf, "${screenshotDir}/01-anyror-error.png");
    } catch(e) {}

    console.log("__RESULT_START__" + JSON.stringify({
      portal_unavailable: true,
      message: "AnyRoR urban land record page returned an error",
      pageText: subText.substring(0, 2000),
      screenshots: ["${screenshotDir}/01-anyror-error.png"]
    }) + "__RESULT_END__");
  } else {

    // Step 5: Select district from dropdown via page.evaluate
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

    // Step 6: Select taluka from dropdown via page.evaluate
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

    // Step 7: Select village from dropdown via page.evaluate
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

    // Step 8: Fill survey number via page.evaluate
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

    // Step 9: Click search/submit button via page.evaluate
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      const searchBtn = btns.find(b =>
        (b.innerText && b.innerText.match(/search|submit|get\\s*detail|view/i)) ||
        (b.value && b.value.match(/search|submit|get\\s*detail|view/i))
      );
      if (searchBtn) searchBtn.click();
    });
    await new Promise(r => setTimeout(r, 8000));

    // Step 10: Take screenshot
    try {
      const buf = await page.screenshot({ fullPage: true });
      await saveScreenshot(buf, "${screenshotDir}/01-anyror-urban-result.png");
    } catch(e) {}

    // Step 11: Extract page text
    const text = await page.evaluate(() => document.body.innerText);
    const url = page.url();

    console.log("__RESULT_START__" + JSON.stringify({
      url: url,
      district: '${safe(district)}',
      taluka: '${safe(taluka)}',
      village: '${safe(village)}',
      surveyNo: '${safe(surveyNo)}',
      portal_unavailable: false,
      pageText: text,
      screenshots: ["${screenshotDir}/01-anyror-urban-result.png"]
    }) + "__RESULT_END__");
  }
}
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse results from AnyRoR portal");
    }

    if (parsed.portal_unavailable) {
      return successResult(
        {
          district,
          taluka,
          village,
          surveyNo,
          portal_unavailable: true,
          message:
            "AnyRoR portal is unavailable. Use Chrome DevTools MCP (mcp__chrome-devtools__*) to access land records manually.",
          rawText: ((parsed.pageText as string) || "").substring(0, 2000),
        },
        (parsed.screenshots as string[]) || []
      );
    }

    const pageText = (parsed.pageText as string) || "";
    const record = extractLandRecordFromText(pageText);
    const ownerNames = record.ownerNames as string[] | undefined;
    const hasResults =
      (ownerNames && ownerNames.length > 0) ||
      pageText.includes("Owner") ||
      pageText.includes("Survey") ||
      pageText.includes("Khata");

    return successResult(
      {
        district,
        taluka,
        village,
        surveyNo,
        found: hasResults,
        portal_unavailable: false,
        record,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `AnyRoR portal timed out. The portal may be slow or unavailable — try again.`
      );
    }
    return errorResult(`AnyRoR urban search failed: ${message}`);
  }
}

/**
 * Search AnyRoR by owner name to find properties.
 */
export async function searchPropertyByOwner(
  ownerName: string,
  district: string,
  purchaseId = "anonymous"
): Promise<PortalResult> {
  const screenshotDir = ensureOutputDir(purchaseId, "anyror");
  const safe = (s: string) => s.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

  const script = `
const page = await browser.newPage();
await page.goto("https://anyror.gujarat.gov.in/", { timeout: 60000, waitUntil: "load" });
await new Promise(r => setTimeout(r, 5000));

// Step 1: Check if portal loaded
const initialText = await page.evaluate(() => document.body.innerText);
if (initialText.includes('Application Error') || initialText.includes('Service Unavailable') || initialText.includes('Server Error')) {
  try {
    const buf = await page.screenshot({ fullPage: true });
    await saveScreenshot(buf, "${screenshotDir}/01-anyror-owner-error.png");
  } catch(e) {}

  console.log("__RESULT_START__" + JSON.stringify({
    portal_unavailable: true,
    message: "AnyRoR portal returned an error page",
    pageText: initialText.substring(0, 2000),
    screenshots: ["${screenshotDir}/01-anyror-owner-error.png"]
  }) + "__RESULT_END__");
} else {

  // Step 2: Dismiss modals via page.evaluate
  await page.evaluate(() => {
    document.querySelectorAll('.modal, .modal-backdrop, .modal-dialog').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = 'auto';
  });
  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Click on "VIEW LAND RECORD - URBAN" section via page.evaluate
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button, div, span'));
    const urbanLink = links.find(el => el.innerText && el.innerText.match(/VIEW LAND RECORD.*URBAN|URBAN.*LAND RECORD|urban/i));
    if (urbanLink) urbanLink.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  // Step 4: Check sub-page
  const subText = await page.evaluate(() => document.body.innerText);
  if (subText.includes('Application Error') || subText.includes('Service Unavailable')) {
    try {
      const buf = await page.screenshot({ fullPage: true });
      await saveScreenshot(buf, "${screenshotDir}/01-anyror-owner-error.png");
    } catch(e) {}

    console.log("__RESULT_START__" + JSON.stringify({
      portal_unavailable: true,
      message: "AnyRoR portal page returned an error",
      pageText: subText.substring(0, 2000),
      screenshots: ["${screenshotDir}/01-anyror-owner-error.png"]
    }) + "__RESULT_END__");
  } else {

    // Step 5: Select district via page.evaluate
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

    // Step 6: Look for and fill owner name search input via page.evaluate
    await page.evaluate((name) => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const ownerInput = inputs.find(i =>
        i.id.toLowerCase().includes('owner') ||
        i.name.toLowerCase().includes('owner') ||
        i.placeholder.toLowerCase().includes('owner') ||
        i.placeholder.toLowerCase().includes('name')
      );
      if (ownerInput) {
        ownerInput.value = name;
        ownerInput.dispatchEvent(new Event('input', { bubbles: true }));
        ownerInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, '${safe(ownerName)}');
    await new Promise(r => setTimeout(r, 1000));

    // Step 7: Click search button via page.evaluate
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      const searchBtn = btns.find(b =>
        (b.innerText && b.innerText.match(/search|submit|get\\s*detail|view/i)) ||
        (b.value && b.value.match(/search|submit|get\\s*detail|view/i))
      );
      if (searchBtn) searchBtn.click();
    });
    await new Promise(r => setTimeout(r, 8000));

    // Step 8: Screenshot
    try {
      const buf = await page.screenshot({ fullPage: true });
      await saveScreenshot(buf, "${screenshotDir}/01-anyror-owner-result.png");
    } catch(e) {}

    // Step 9: Extract text
    const text = await page.evaluate(() => document.body.innerText);
    const url = page.url();

    console.log("__RESULT_START__" + JSON.stringify({
      url: url,
      ownerName: '${safe(ownerName)}',
      district: '${safe(district)}',
      portal_unavailable: false,
      pageText: text,
      screenshots: ["${screenshotDir}/01-anyror-owner-result.png"]
    }) + "__RESULT_END__");
  }
}
`;

  try {
    const raw = runDevBrowserScript(script, 120);
    const parsed = extractJsonResult(raw);

    if (!parsed) {
      return errorResult("Could not parse results from AnyRoR portal");
    }

    if (parsed.portal_unavailable) {
      return successResult(
        {
          ownerName,
          district,
          portal_unavailable: true,
          message:
            "AnyRoR portal is unavailable. Use Chrome DevTools MCP (mcp__chrome-devtools__*) to access land records manually.",
          rawText: ((parsed.pageText as string) || "").substring(0, 2000),
        },
        (parsed.screenshots as string[]) || []
      );
    }

    const pageText = (parsed.pageText as string) || "";
    const record = extractLandRecordFromText(pageText);
    const ownerNames = record.ownerNames as string[] | undefined;
    const hasResults =
      (ownerNames && ownerNames.length > 0) ||
      pageText.includes("Owner") ||
      pageText.includes("Survey") ||
      pageText.includes("Khata");

    return successResult(
      {
        ownerName,
        district,
        found: hasResults,
        portal_unavailable: false,
        record,
        rawText: pageText.substring(0, 5000),
      },
      (parsed.screenshots as string[]) || []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out") || message.includes("timeout")) {
      return errorResult(
        `AnyRoR portal timed out. The portal may be slow or unavailable — try again.`
      );
    }
    return errorResult(`AnyRoR owner search failed: ${message}`);
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

function extractLandRecordFromText(text: string): Record<string, unknown> {
  const extract = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  // Extract owner names — they often appear after "Owner" or "Malik" labels
  const ownerNames: string[] = [];
  const ownerPattern =
    /(?:Owner|Malik|Name)\s*:?\s*(.+?)(?:\n|Survey|Area|Land)/gi;
  let match;
  while ((match = ownerPattern.exec(text)) !== null) {
    const name = match[1]?.trim();
    if (name && name.length > 2 && !ownerNames.includes(name)) {
      ownerNames.push(name);
    }
  }

  return {
    ownerNames,
    surveyNo: extract(/Survey\s*(?:No|Number)[.:\s]*\s*(\S+)/i),
    area: extract(
      /Area\s*:?\s*([\d,.]+\s*(?:Sq\.?\s*(?:Mtr|Meter|Ft|Yard|m)|Hectare|Acre|Vigha|Guntha)?)/i
    ),
    landType: extract(
      /(?:Land\s*Type|Land\s*Use|Type\s*of\s*Land)\s*:?\s*(.+?)(?:\n|$)/i
    ),
    mutationHistory: extract(
      /(?:Mutation|Ferfar|Entry)\s*(?:No|Number)?\s*:?\s*(.+?)(?:\n|$)/i
    ),
    khataNo: extract(/(?:Khata\s*No|Khata\s*Number)\s*:?\s*(\S+)/i),
    village: extract(/Village\s*:?\s*(.+?)(?:\n|Taluka|District)/i),
    taluka: extract(/Taluka\s*:?\s*(.+?)(?:\n|District|Village)/i),
    district: extract(/District\s*:?\s*(.+?)(?:\n|Taluka|Village)/i),
  };
}
