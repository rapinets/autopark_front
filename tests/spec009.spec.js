const { test, expect } = require("@playwright/test");

for (const width of [360, 768, 1440]) {
  test(`final responsive route at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.route("**/companies/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.route("**/buses/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.route("**/routes/", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.route(/\/drivers\?.*limit=/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.route("**/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }));

    await page.goto("http://127.0.0.1:4173/#/");
    await expect(page.getByRole("heading", { name: "Огляд автопарку" })).toBeVisible();
    const noOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noOverflow).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("final direct links and 404 navigation", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/companies/999999");
  await expect(page.getByText("Запис не знайдено.", { exact: true })).toBeVisible({ timeout: 120000 });
  await page.getByRole("link", { name: "До списку перевізників" }).click();
  await expect(page).toHaveURL(/#\/companies$/);
});

test("keyboard menu Escape and visible focus", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("http://127.0.0.1:4173/#/");
  const menu = page.getByRole("button", { name: "Відкрити меню" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});
