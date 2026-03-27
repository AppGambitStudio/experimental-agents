// Shared browser automation helpers for Gujarat government portal interactions
// Uses dev-browser (globally installed) for sandboxed browser automation
//
// IMPORTANT: dev-browser saves screenshots to ~/.dev-browser/tmp/<name>
// We must copy them to our output directory after the script runs.

import { execSync } from "child_process";
import { mkdirSync, copyFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";

export interface PortalResult {
  success: boolean;
  data: unknown;
  screenshots: string[];
  errors: string[];
}

const DEV_BROWSER_TMP = join(homedir(), ".dev-browser", "tmp");

/**
 * Run a script in dev-browser's sandboxed QuickJS environment.
 *
 * dev-browser scripts have access to these globals:
 *   - browser: browser automation API
 *   - console: logging
 *   - saveScreenshot(buffer, name): saves to ~/.dev-browser/tmp/<name>
 *   - writeFile / readFile: file I/O in sandbox
 *
 * Scripts support top-level await.
 */
export function runDevBrowserScript(
  script: string,
  timeoutSeconds = 120
): string {
  try {
    const result = execSync(
      `dev-browser --headless --timeout ${timeoutSeconds} <<'DEVBROWSER_EOF'\n${script}\nDEVBROWSER_EOF`,
      { encoding: "utf-8", timeout: (timeoutSeconds + 10) * 1000, maxBuffer: 10 * 1024 * 1024 }
    );
    return result;
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    // dev-browser may produce partial output before timeout — check stdout
    if (err.stdout && err.stdout.includes("__RESULT_START__")) {
      return err.stdout;
    }
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
 * Copy screenshots from dev-browser's sandbox (~/.dev-browser/tmp/)
 * to our output directory. Returns the list of copied file paths.
 *
 * dev-browser saves files with saveScreenshot(buf, "name.png") to
 * ~/.dev-browser/tmp/name.png — we copy matching files to our output dir.
 */
export function collectScreenshots(
  screenshotNames: string[],
  outputDir: string
): string[] {
  const collected: string[] = [];

  for (const name of screenshotNames) {
    // The name might be a full path or just a filename
    const baseName = name.split("/").pop() ?? name;
    const srcPath = join(DEV_BROWSER_TMP, baseName);

    if (existsSync(srcPath)) {
      const destPath = join(outputDir, baseName);
      try {
        copyFileSync(srcPath, destPath);
        collected.push(destPath);
      } catch {
        // Copy failed — skip this screenshot
      }
    }
  }

  // Also check for any recent screenshots in the tmp dir that we might have missed
  if (existsSync(DEV_BROWSER_TMP)) {
    try {
      const files = readdirSync(DEV_BROWSER_TMP)
        .filter(f => f.endsWith(".png"))
        .sort()
        .slice(-10); // Last 10 screenshots

      for (const file of files) {
        const destPath = join(outputDir, file);
        if (!existsSync(destPath)) {
          try {
            copyFileSync(join(DEV_BROWSER_TMP, file), destPath);
            if (!collected.includes(destPath)) {
              collected.push(destPath);
            }
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Can't read tmp dir
    }
  }

  return collected;
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
