const { test, expect } = require("@playwright/test");

test("dashboard shows seed counts and links", async ({ page }) => {
  await page.route("**/companies/", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }))),
  }));
  await page.route("**/buses/", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))),
  }));
  await page.route("**/routes/", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))),
  }));
  await page.route(/\/drivers\?.*limit=100/, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))),
  }));
  await page.route("**/health", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ status: "ok" }),
  }));

  await page.goto("http://127.0.0.1:4173/#/");
  await expect(page.getByRole("heading", { name: "Огляд автопарку" })).toBeVisible();
  await expect(page.locator('[data-count="companies"]')).toHaveText("5");
  await expect(page.locator('[data-count="buses"]')).toHaveText("10");
  await expect(page.locator('[data-count="routes"]')).toHaveText("10");
  await expect(page.locator('[data-count="drivers"]')).toHaveText("10");
  await expect(page.getByText("API доступне", { exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-card[href="#/companies"]')).toBeVisible();
});

for (const total of [0, 100, 101]) {
  test(`driver paging returns exact ${total}`, async ({ page }) => {
    await page.route(/\/drivers\?.*limit=100/, async (route) => {
      const url = new URL(route.request().url());
      const offset = Number(url.searchParams.get("offset"));
      const length = Math.min(100, Math.max(0, total - offset));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(Array.from({ length }, (_, i) => ({ id: offset + i + 1 }))),
      });
    });
    await page.route("**/companies/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.route("**/buses/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.route("**/routes/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.route("**/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }));
    await page.goto("http://127.0.0.1:4173/#/");
    await expect(page.locator('[data-count="drivers"]')).toHaveText(String(total), { timeout: 120000 });
  });
}

test("independent source error shows dash without zero", async ({ page }) => {
  await page.route("**/companies/", (route) => route.abort("failed"));
  await page.route("**/buses/", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await page.route("**/routes/", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await page.route(/\/drivers\?.*limit=100/, (route) => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await page.route("**/health", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }),
  }));
  await page.goto("http://127.0.0.1:4173/#/");
  await expect(page.locator('[data-count="companies"]')).toHaveText("—");
  await expect(page.locator('[data-count="buses"]')).toHaveText("0");
  await expect(page.locator('[data-count="routes"]')).toHaveText("0");
  await expect(page.locator('[data-count="drivers"]')).toHaveText("0");
});

test("health failure and 360px layout", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.route("**/health", (route) => route.abort("failed"));
  await page.route("**/companies/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/buses/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/routes/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route(/\/drivers\?.*limit=100/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.goto("http://127.0.0.1:4173/#/");
  await expect(page.getByText("Не вдалося перевірити доступність API", { exact: true })).toBeVisible();
  const noOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
});

test("refresh reloads independent counts", async ({ page }) => {
  let companyCount = 5;
  await page.route("**/companies/", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(Array.from({ length: companyCount }, (_, i) => ({ id: i + 1 }))),
  }));
  await page.route("**/buses/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/routes/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route(/\/drivers\?.*limit=100/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }));

  await page.goto("http://127.0.0.1:4173/#/");
  await expect(page.locator('[data-count="companies"]')).toHaveText("5");
  companyCount = 6;
  await page.getByRole("button", { name: "Оновити" }).click();
  await expect(page.locator('[data-count="companies"]')).toHaveText("6");
});
