import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // An availability check must not generate real reader engagement.
  await page.route("**/api/**", async route => {
    if (!["GET", "HEAD"].includes(route.request().method())) {
      return route.fulfill({ json: { ok: true, counted: false } });
    }
    await route.continue();
  });
});

test("the deployed application reports readiness", async ({ request }) => {
  const response = await request.get("/api/health?scope=ready");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true, status: "ready", checks: { application: "ready" },
  });
});

test("public health stays sanitized", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(Number.isFinite(Date.parse(payload.generatedAt))).toBe(true);
  expect(payload.sync).toMatchObject({ level: expect.any(String), isRunning: expect.any(Boolean) });
  expect(JSON.stringify(payload)).not.toMatch(/lastError|lastResult|destination|postgres(?:ql)?:\/\//);
});

test("source-check receipts are available without starting an import", async ({ request }) => {
  const response = await request.get("/api/feed/refresh");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.mode).toBe("scheduled");
  expect(payload.preparingCount).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(payload.unavailableSources)).toBe(true);
});

for (const width of [390, 1440]) {
  test(`readers can open a current release at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://moosqa.vercel.app");
    const link = page.locator('#latest a[href^="/releases/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/releases\/[^/?]+/);
    await link.click();
    await expect(page).toHaveURL(/\/releases\/[^/?]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open original source", exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Temporary issue|Release not found/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("Charts includes the Alternative Top 40 feature", async ({ page }) => {
  const response = await page.goto("/charts", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /New Alternative Top 40/i })).toBeVisible();
});
