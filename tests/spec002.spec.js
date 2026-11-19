const { test, expect } = require("@playwright/test");

for (const [hash, heading] of [
  ["#/companies", "Перевізники"],
  ["#/buses", "Автобуси"],
  ["#/routes", "Маршрути"],
]) {
  test(`loads real ${heading} list`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:4173/${hash}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("button", { name: "Оновити" })).toBeVisible();
    await expect(page.locator(".table tbody tr").first()).toBeVisible({ timeout: 120000 });
  });
}

test("driver pagination and local search", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/drivers?limit=10&offset=0");
  await expect(page.getByRole("heading", { name: "Водії" })).toBeVisible();
  await expect(page.locator(".table tbody tr")).toHaveCount(10, { timeout: 120000 });
  await expect(page.getByRole("button", { name: "Наступна" })).toBeDisabled();

  await page.getByLabel("Пошук").fill("неіснує");
  await page.getByRole("button", { name: "Знайти" }).click();
  await expect(page.getByText("На поточній сторінці немає збігів.", { exact: true })).toBeVisible();

  await page.getByLabel("Пошук").fill("");
  await page.getByRole("button", { name: "Знайти" }).click();
  await expect(page.locator(".table tbody tr")).toHaveCount(10);
  await expect(page.locator(".search-hint")).toHaveText("Пошук лише на поточній сторінці");
});

test("normalizes driver hash and keeps offset nonnegative", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/drivers?limit=nope&offset=-5");
  await expect(page).toHaveURL(/#\/drivers\?limit=20&offset=0/);
  await expect(page.getByLabel("Рядків")).toHaveValue("20");
});

test("360px mobile cards and no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("http://127.0.0.1:4173/#/buses");
  await expect(page.locator(".table tbody tr").first()).toBeVisible({ timeout: 120000 });
  const noOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
});

for (const size of [10, 20, 50]) {
  test(`P+1 at ${size}/${size + 1}`, async ({ page }) => {
    await page.route("**/drivers?limit=*", async (route) => {
      const url = new URL(route.request().url());
      const limit = Number(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset")) || 0;
      const exactCount = Number(url.searchParams.get("limit")) - 1;
      const hasOneExtra = offset === 0;
      const count = exactCount + (hasOneExtra ? 1 : 0);
      const rows = Array.from({ length: count }, (_, index) => ({
        id: index + offset + 1,
        full_name: `Водій ${index + offset + 1}`,
        phone: `+380001${index + offset}`,
        license_number: `DRV${index + offset + 1}`,
        company_id: 1,
        company_name: "Тестовий перевізник",
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    });

    await page.goto(`http://127.0.0.1:4173/#/drivers?limit=${size}&offset=0`);
    await expect(page.locator(".table tbody tr")).toHaveCount(size);
    await expect(page.getByRole("button", { name: "Наступна" })).toBeEnabled();
  });
}
