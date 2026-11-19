const { test, expect } = require("@playwright/test");

test("422 field error is linked and 409 integrity stays operation-level", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/companies/new");
  await page.getByLabel("Назва").fill("Тест");
  await page.getByLabel("Телефон").fill("+380501112233");

  await page.route("**/companies/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ detail: [{ loc: ["body", "phone"], msg: "Невірний телефон", type: "value_error" }] }),
      });
    } else {
      await route.continue();
    }
  });
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByText("Невірний телефон", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Телефон")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Створити" })).toBeEnabled();

  await page.unroute("**/companies/");
  await page.route("**/companies/", (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ detail: "Порушено цілісність даних" }),
  }));
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByText("Порушено цілісність даних", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Телефон")).not.toHaveAttribute("aria-invalid", "true");
});

test("5xx and unexpected HTML are not exposed as raw response", async ({ page }) => {
  await page.route("**/routes/1", (route) => route.fulfill({
    status: 500,
    contentType: "text/html",
    body: "<html><b>stack trace</b></html>",
  }));
  await page.goto("http://127.0.0.1:4173/#/routes/1");
  await expect(page.getByText("Сервер тимчасово недоступний. Спробуйте пізніше.", { exact: true })).toBeVisible();
  await expect(page.getByText(/stack trace|<html>/)).toHaveCount(0);
});

test("404 detail and retryable network error", async ({ page }) => {
  await page.route("**/companies/999999", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ detail: "Запис не знайдено" }),
  }));
  await page.goto("http://127.0.0.1:4173/#/companies/999999");
  await expect(page.getByText("Запис не знайдено.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "До списку перевізників" })).toBeVisible();

  await page.unroute("**/companies/999999");
  await page.route("**/companies/999999", (route) => route.abort("failed"));
  await page.goto("http://127.0.0.1:4173/#/");
  await page.evaluate(() => { window.location.hash = "/companies/999999"; });
  await expect(page.getByRole("button", { name: "Оновити" })).toBeVisible();
  await expect(page.getByText(/підключитися|мережу|CORS/i)).toBeVisible();
});

test("HTML-like API and detail text is rendered safely", async ({ page }) => {
  const unsafe = "<img src=x onerror=alert(1)>";
  await page.route("**/companies/1", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 1, name: unsafe, phone: unsafe }),
  }));
  await page.goto("http://127.0.0.1:4173/#/companies/1");
  await expect(page.getByText(unsafe, { exact: true }).first()).toBeVisible();
  const imgCount = await page.locator("img").count();
  expect(imgCount).toBe(0);
});

test("stale detail response cannot replace current route", async ({ page }) => {
  await page.route("**/companies/1", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, name: "Старий запис", phone: "+380501112233" }),
    });
  });
  await page.route("**/companies/2", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 2, name: "Новий запис", phone: "+380502223344" }),
  }));
  await page.goto("http://127.0.0.1:4173/#/");
  await page.evaluate(() => { window.location.hash = "/companies/1"; });
  await page.evaluate(() => { window.location.hash = "/companies/2"; });
  await expect(page.getByRole("heading", { name: "Новий запис" })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByRole("heading", { name: "Новий запис" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Старий запис" })).toHaveCount(0);
});

test("mutation timeout has no success and offers refresh only", async ({ page }) => {
  let postCount = 0;
  await page.route("**/routes/", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 16000));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 901, number: "901", title: "Тест", distance_km: 100 }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto("http://127.0.0.1:4173/#/routes/new");
  await page.getByLabel("Номер маршруту").fill("901");
  await page.getByLabel("Назва").fill("Тест");
  await page.getByLabel("Відстань, км").fill("100");
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByText(/Результат мутації не підтверджено/)).toBeVisible({ timeout: 18000 });
  await expect(page.getByRole("button", { name: "Актуалізувати дані" })).toBeVisible();
  expect(postCount).toBe(1);
});
