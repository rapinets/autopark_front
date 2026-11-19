const { test, expect } = require("@playwright/test");

test("company detail direct link and refresh", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/companies/1");
  await expect(page.getByRole("heading", { name: "КиївТрансСервіс" })).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("ID", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "КиївТрансСервіс" })).toBeVisible();
});

test("bus detail contains company link", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/buses/1");
  await expect(page.getByRole("heading", { name: "AA1234BC" })).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole("link", { name: "КиївТрансСервіс" })).toBeVisible();
});

test("route detail direct link", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/routes/1");
  await expect(page.getByRole("heading", { name: "Київ — Чернігів" })).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("145 км", { exact: true })).toBeVisible();
});

test("driver detail assignments and return state", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/drivers?limit=10&offset=0&q=");
  await page.evaluate(() => sessionStorage.setItem("drivers-list-state", "limit=10&offset=0&q="));
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByRole("heading", { name: "Олександр Іваненко" })).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("Допущений до 3 маршрутів", { exact: true })).toBeVisible();
  await expect(page.locator(".assignment-list li")).toHaveCount(3);
  await page.getByRole("link", { name: "До списку водіїв" }).click();
  await expect(page).toHaveURL(/#\/drivers\?limit=10&offset=0/);
});

test("unknown and invalid ids have clear states", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/companies/999999");
  await expect(page.getByText("Запис не знайдено.", { exact: true })).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole("link", { name: "До списку перевізників" })).toBeVisible();

  await page.goto("http://127.0.0.1:4173/#/buses/not-an-id");
  await expect(page.getByText("ID має бути додатним цілим числом.", { exact: true })).toBeVisible();
});

test("network detail error has retry", async ({ page }) => {
  await page.route("**/routes/1", (route) => route.abort("failed"));
  await page.goto("http://127.0.0.1:4173/#/routes/1");
  await expect(page.getByRole("button", { name: "Оновити" })).toBeVisible({ timeout: 120000 });
});

test("catalog failure does not hide driver data", async ({ page }) => {
  await page.route("**/routes/", (route) => route.abort("failed"));
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByRole("heading", { name: "Олександр Іваненко" })).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("Допущений до 3 маршрутів", { exact: true })).toBeVisible();
  await expect(page.locator(".assignment-list li")).toHaveCount(3);
});

test("route count forms", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/");
  const counts = await page.evaluate(async () => {
    const module = await import("/js/pages/detail-pages.js");
    return [0, 1, 2, 5, 11, 21, 111].map(module.routeCountText);
  });
  expect(counts).toEqual([
    "Допущений до 0 маршрутів",
    "Допущений до 1 маршруту",
    "Допущений до 2 маршрутів",
    "Допущений до 5 маршрутів",
    "Допущений до 11 маршрутів",
    "Допущений до 21 маршруту",
    "Допущений до 111 маршрутів",
  ]);
});

test("360px detail has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByRole("heading", { name: "Олександр Іваненко" })).toBeVisible({ timeout: 120000 });
  const noOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
});
