const { test, expect } = require("@playwright/test");

test("edit loads current driver and submits required PUT fields", async ({ page }) => {
  await page.route("**/drivers/1", async (route) => {
    if (route.request().method() === "PUT") {
      const payload = route.request().postDataJSON();
      expect(payload).toEqual({
        full_name: "Новий Петрович",
        phone: "+380501112233",
        license_number: "DRV-NEW",
        company_id: 2,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, ...payload, company_name: "Тестовий перевізник" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          full_name: "Старий ПІБ",
          phone: "+380501112233",
          license_number: "DRV-OLD",
          company_id: 1,
          company_name: "Старий перевізник",
        }),
      });
    }
  });
  await page.route("**/companies/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([
      { id: 1, name: "Старий перевізник", phone: "+380501112233" },
      { id: 2, name: "Новий перевізник", phone: "+380502223344" },
    ]),
  }));
  await page.goto("http://127.0.0.1:4173/#/drivers/1/edit");
  await expect(page.getByRole("heading", { name: "Редагування водія" })).toBeVisible();
  await expect(page.getByLabel("ПІБ")).toHaveValue("Старий ПІБ");
  await expect(page.getByRole("button", { name: "Зберегти зміни" })).toBeEnabled();
  await page.getByLabel("ПІБ").fill("Новий Петрович");
  await page.getByLabel("Посвідчення").fill("DRV-NEW");
  await page.getByLabel("Перевізник").selectOption("2");
  await page.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(page).toHaveURL(/#\/drivers\/1$/, { timeout: 120000 });
});

test("edit 422 keeps values and marks field", async ({ page }) => {
  await page.route("**/drivers/1", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ detail: [{ loc: ["body", "license_number"], msg: "Некоректне посвідчення", type: "value_error" }] }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, full_name: "ПІБ Тест", phone: "+380501112233", license_number: "DRV001", company_id: 1, company_name: "Перевізник" }),
      });
    }
  });
  await page.route("**/companies/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ id: 1, name: "Перевізник", phone: "+380501112233" }]),
  }));
  await page.goto("http://127.0.0.1:4173/#/drivers/1/edit");
  await expect(page.getByLabel("ПІБ")).toHaveValue("ПІБ Тест");
  await page.getByLabel("Посвідчення").fill("BAD22");
  await page.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(page.getByText("Некоректне посвідчення", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Посвідчення")).toHaveValue("BAD22");
});

test("delete cancel executes no DELETE and dialog uses safe focus", async ({ page }) => {
  let deleteCount = 0;
  await page.route("**/drivers/1", (route) => {
    if (route.request().method() === "DELETE") {
      deleteCount += 1;
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, full_name: "Тест Водій", phone: "+380501112233", license_number: "DRV001", company_id: 1, company_name: "Перевізник" }),
    });
  });
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByRole("heading", { name: "Тест Водій" })).toBeVisible({ timeout: 120000 });
  await page.getByRole("button", { name: "Видалити" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Скасувати" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(deleteCount).toBe(0);
});

test("confirmed DELETE sends once and 204 is not parsed", async ({ page }) => {
  let deleteCount = 0;
  await page.route("**/drivers/1", (route) => {
    if (route.request().method() === "DELETE") {
      deleteCount += 1;
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, full_name: "Тест Водій", phone: "+380501112233", license_number: "DRV001", company_id: 1, company_name: "Перевізник" }),
    });
  });
  await page.route("**/drivers?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByRole("heading", { name: "Тест Водій" })).toBeVisible({ timeout: 120000 });
  await page.getByRole("button", { name: "Видалити" }).click();
  await page.getByRole("button", { name: "Видалити", exact: true }).last().click();
  await expect(page).toHaveURL(/#\/drivers(?:\?|$)/, { timeout: 120000 });
  expect(deleteCount).toBe(1);
});

test("network delete failure shows no success", async ({ page }) => {
  await page.route("**/drivers/1", (route) => {
    if (route.request().method() === "DELETE") return route.abort("failed");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, full_name: "Тест Водій", phone: "+380501112233", license_number: "DRV001", company_id: 1, company_name: "Перевізник" }),
    });
  });
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByRole("heading", { name: "Тест Водій" })).toBeVisible({ timeout: 120000 });
  await page.getByRole("button", { name: "Видалити" }).click();
  await page.getByRole("button", { name: "Видалити", exact: true }).last().click();
  await expect(page.getByText(/підключитися до API|мережу|CORS/i)).toBeVisible();
});

test("edit 404 and 360px dialog are clear", async ({ page }) => {
  await page.route("**/drivers/999999", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ detail: "Водія не знайдено" }),
  }));
  await page.route("**/companies/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("http://127.0.0.1:4173/#/drivers/999999/edit");
  await expect(page.getByText("Запис не знайдено.", { exact: true })).toBeVisible();
  const noOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
});

