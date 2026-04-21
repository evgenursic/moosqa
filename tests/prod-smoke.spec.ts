import { expect, type Page, test } from "@playwright/test";

const knownReleasePath = "/releases/laufey-1spov0b?from=%2F%23latest";

test("known release detail renders without the temporary fallback", async ({ page }) => {
  const issues = collectRuntimeIssues(page);

  await page.goto(knownReleasePath, { waitUntil: "networkidle" });

  await expect(page.locator("body")).toContainText(/Laufey/i);
  await expect(page.locator("body")).not.toContainText(/Temporary issue/i);
  expect(filteredRuntimeIssues(issues)).toEqual([]);
});

test("release card return keeps latest URL canonical and restores scroll", async ({ page }) => {
  const issues = collectRuntimeIssues(page);

  await page.goto("/#latest", { waitUntil: "networkidle" });
  await expect(page.locator("#latest")).toBeVisible();

  const firstRelease = page.locator('#latest a[href^="/releases/"]').first();
  await firstRelease.scrollIntoViewIfNeeded();
  const beforeClickScrollY = await page.evaluate(() => window.scrollY);

  await firstRelease.click();
  await page.waitForURL(/\/releases\//);
  await expect(page.locator("body")).not.toContainText(/Temporary issue/i);

  const backButton = page.getByRole("button", { name: /back to front page/i }).first();
  await expect(backButton).toBeVisible();
  await backButton.click();
  await page.waitForTimeout(1_500);

  const afterReturn = await page.evaluate(() => ({
    hash: window.location.hash,
    href: window.location.href,
    scrollY: window.scrollY,
  }));

  expect(afterReturn.hash).toBe("#latest");
  expect(afterReturn.href).not.toContain("#latest#latest");
  expect(afterReturn.scrollY).toBeGreaterThan(100);
  expect(Math.abs(afterReturn.scrollY - beforeClickScrollY)).toBeLessThan(450);
  expect(filteredRuntimeIssues(issues)).toEqual([]);
});

function collectRuntimeIssues(page: Page) {
  const issues: string[] = [];

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push(`console: ${message.text()}`);
    }
  });

  return issues;
}

function filteredRuntimeIssues(issues: string[]) {
  return issues.filter((issue) => !/favicon|Failed to load resource|ERR_ABORTED/i.test(issue));
}
