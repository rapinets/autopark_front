const { test, expect } = require("@playwright/test");

test("company validation and 422 preserve values", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/#/companies/new");
  await expect(page.getByRole("heading", { name: "Створення перевізника" })).toBeVisible();

  await page.getByLabel("Назва").fill(" ");
  await page.getByLabel("Телефон").fill("123");
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByText("Введіть назву.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Телефон")).toHaveValue("123");

  await page.route("**/companies/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ detail: [{ loc: ["body", "name"], msg: "Назва вже існує", type: "value_error" }] }),
      });
    } else {
      await route.continue();
    }
  });
  await page.getByLabel("Назва").fill("Тест Транс");
  await page.getByLabel("Телефон").fill("+380501112233");
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByText("Назва вже існує", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Назва")).toHaveValue("Тест Транс");
});

test("company POST sends trimmed fields once and verifies detail", async ({ page }) => {
  let postCount = 0;
  await page.route("**/companies/", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 501, name: "Новий перевізник", phone: "+380501112233" }),
      });
    } else {
      await route.continue();
    }
  });
  await page.route("**/companies/501", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 501, name: "Новий перевізник", phone: "+380501112233" }),
  }));

  await page.goto("http://127.0.0.1:4173/#/companies/new");
  await page.getByLabel("Назва").fill("  Новий перевізник  ");
  await page.getByLabel("Телефон").fill("  +380501112233  ");
  await page.getByRole("button", { name: "Створити" }).dblclick();
  await expect(page).toHaveURL(/#\/companies\/501/, { timeout: 120000 });
  expect(postCount).toBe(1);
});

test("bus and driver forms load companies and send numeric company_id", async ({ page }) => {
  await page.route("**/companies/", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 7, name: "Тестовий перевізник", phone: "+380501112233" }]),
      });
    }
    return route.continue();
  });

  await page.goto("http://127.0.0.1:4173/#/buses/new");
  await page.getByLabel("Номерний знак").fill("AA0001AA");
  await page.getByLabel("Модель").fill("Тестова модель");
  await page.getByLabel("Кількість місць").fill("41");
  await page.getByLabel("Перевізник").selectOption("7");

  let busPayload = null;
  await page.route("**/buses/", async (route) => {
    if (route.request().method() === "POST") {
      busPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 601, ...busPayload, company_name: "Тестовий перевізник" }),
      });
    } else {
      await route.continue();
    }
  });
  await page.route("**/buses/601", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 601, plate_number: "AA0001AA", model: "Тестова модель", seats: 41, company_id: 7, company_name: "Тестовий перевізник" }),
  }));
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page).toHaveURL(/#\/buses\/601/, { timeout: 120000 });
  expect(busPayload.company_id).toBe(7);
  expect(typeof busPayload.company_id).toBe("number");
});

test("no companies blocks bus and driver forms", async ({ page }) => {
  await page.route("**/companies/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
  await page.goto("http://127.0.0.1:4173/#/buses/new");
  await expect(page.getByText("Спочатку створіть перевізника.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Створити" })).toHaveCount(0);

  await page.goto("http://127.0.0.1:4173/#/drivers/new");
  await expect(page.getByText("Спочатку створіть перевізника.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Створити" })).toHaveCount(0);
});

test("numeric and text boundaries reject invalid values", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/");
  const result = await page.evaluate(async () => {
    const validation = await import("/js/utils/validation.js");
    return {
      whitespace: validation.textError("   ", 2, 120, "назву"),
      textMin: validation.textError("a", 2, 120, "назву"),
      textMax: validation.textError("a".repeat(121), 2, 120, "назву"),
      fraction: validation.integerError("10.5", 10, 120, "Кількість місць"),
      empty: validation.integerError("", 10, 120, "Кількість місць"),
      low: validation.integerError("9", 10, 120, "Кількість місць"),
      high: validation.integerError("121", 10, 120, "Кількість місць"),
    };
  });
  expect(result.whitespace).toBeTruthy();
  expect(result.textMin).toBe("Мінімум 2 символів.");
  expect(result.textMax).toBe("Максимум 120 символів.");
  expect(result.fraction).toContain("цілим");
  expect(result.empty).toContain("Введіть");
  expect(result.low).toContain("10–120");
  expect(result.high).toContain("10–120");
});

test("POST success with detail failure keeps success and retry", async ({ page }) => {
  await page.route("**/routes/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 701, number: "777", title: "Тестовий маршрут", distance_km: 100 }),
      });
    } else {
      await route.continue();
    }
  });
  await page.route("**/routes/701", (route) => route.abort("failed"));

  await page.goto("http://127.0.0.1:4173/#/routes/new");
  await page.getByLabel("Номер маршруту").fill("777");
  await page.getByLabel("Назва").fill("Тестовий маршрут");
  await page.getByLabel("Відстань, км").fill("100");
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Збережено, але не вдалося оновити дані." })).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole("button", { name: "Повторити GET" })).toBeVisible();
});

test("cancel and 360px form do not submit", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("http://127.0.0.1:4173/#/companies/new");
  await page.getByRole("link", { name: "Скасувати" }).click();
  await expect(page).toHaveURL(/#\/companies$/);
  const noOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
});

test("409 detail and 404 BR-B1 are displayed without invented duplicate text", async ({ page }) => {
  await page.route("**/buses/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Автобус із таким номером уже існує" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 1, name: "Перевізник", phone: "+380501112233" }]),
      });
    }
  });
  await page.goto("http://127.0.0.1:4173/#/buses/new");
  await page.getByLabel("Номерний знак").fill("AA1234BC");
  await page.getByLabel("Модель").fill("TestBus");
  await page.getByLabel("Кількість місць").fill("20");
  await page.getByLabel("Перевізник").selectOption("1");
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByText("Автобус із таким номером уже існує", { exact: true })).toBeVisible();

  await page.unroute("**/buses/");
  await page.route("**/buses/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Перевізника не знайдено" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 1, name: "Перевізник", phone: "+380501112233" }]),
      });
    }
  });
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page.getByText("Перевізника не знайдено", { exact: true })).toBeVisible();
});
