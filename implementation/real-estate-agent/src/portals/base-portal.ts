// Shared browser automation helpers for Gujarat government portal interactions
// Uses dev-browser (globally installed) for sandboxed browser automation

import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { resolve } from "path";

export interface PortalResult {
  success: boolean;
  data: unknown;
  screenshots: string[];
  errors: string[];
}

/**
 * Run a script in dev-browser's sandboxed QuickJS environment.
 *
 * dev-browser scripts have access to these globals:
 *   - browser: browser automation API
 *   - console: logging
 *   - saveScreenshot(name, buffer): persist screenshot
 *   - writeFile / readFile: file I/O
 *
 * Scripts support top-level await. Pages are created/reused via
 * `browser.getPage("name")`.
 */
export function runDevBrowserScript(
  script: string,
  timeoutMs = 120000
): string {
  try {
    const result = execSync(
      `dev-browser --headless <<'DEVBROWSER_EOF'\n${script}\nDEVBROWSER_EOF`,
      { encoding: "utf-8", timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    );
    return result;
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(
      `dev-browser script failed: ${err.stderr || err.message}`
    );
  }
}

/**
 * Ensure the output directory exists for a given purchase + portal
 * combination and return the absolute path.
 */
export function ensureOutputDir(purchaseId: string, portal: string): string {
  const dir = resolve("output", purchaseId, "screenshots", portal);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Build a resilient dev-browser script that:
 *  1. Navigates to a URL with a timeout
 *  2. Waits for the page to settle
 *  3. Falls back to snapshot extraction if selectors fail
 */
export function buildNavigationScript(
  pageName: string,
  url: string,
  bodyScript: string
): string {
  return `
const page = await browser.getPage("${pageName}");

// Navigate with timeout handling
try {
  await page.goto("${url}", { waitUntil: "domcontentloaded", timeout: 30000 });
} catch (e) {
  console.log("Navigation slow, continuing with partial load...");
}

// Let the page settle
await new Promise(r => setTimeout(r, 2000));

${bodyScript}
`.trim();
}

/**
 * Create a standard error result when a portal operation fails.
 */
export function errorResult(message: string, screenshots: string[] = []): PortalResult {
  return {
    success: false,
    data: null,
    screenshots,
    errors: [message],
  };
}

/**
 * Create a standard success result.
 */
export function successResult(data: unknown, screenshots: string[] = []): PortalResult {
  return {
    success: true,
    data,
    screenshots,
    errors: [],
  };
}
