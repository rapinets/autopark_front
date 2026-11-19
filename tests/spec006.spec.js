const { test, expect } = require("@playwright/test");

function mockDriverAndAssignmentRoutes(page, assignments, routes) {
  page.route("**/drivers/1", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          full_name: "Тест Водій",
          phone: "+380501112233",
          license_number: "DRV001",
          company_id: 1,
          company_name: "Перевізник",
        }),
      });
    }
    return route.continue();
  });
  page.route("**/drivers/1/routes", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(assignments),
  }));
  page.route("**/routes/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(routes),
  }));
}

test("only unassigned routes are available and empty values are rejected", async ({ page }) => {
  mockDriverAndAssignmentRoutes(page, [
    { driver_id: 1, route_id: 1 },
  ], [
    { id: 1, number: "101", title: "Перший", distance_km: 100 },
    { id: 2, number: "202", title: "Другий", distance_km: 200 },
  ]);
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByText("Допущений до 1 маршруту", { exact: true })).toBeVisible({ timeout: 120000 });
  await expect(page.getByLabel("Маршрут")).toContainText("202 — Другий");
  await expect(page.getByLabel("Маршрут").locator('option[value="1"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Допустити до маршруту" }).click();
  await expect(page.getByText("Оберіть маршрут.", { exact: true })).toBeVisible();
});

test("201 adds assignment once and refreshes list", async ({ page }) => {
  let postCount = 0;
  let assigned = [{ driver_id: 1, route_id: 1 }];
  page.route("**/drivers/1", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 1, full_name: "Тест Водій", phone: "+380501112233", license_number: "DRV001", company_id: 1, company_name: "Перевізник" }),
  }));
  page.route("**/drivers/1/routes", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(assigned),
  }));
  page.route("**/routes/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([
      { id: 1, number: "101", title: "Перший", distance_km: 100 },
      { id: 2, number: "202", title: "Другий", distance_km: 200 },
    ]),
  }));
  page.route("**/assignments", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      assigned = [{ driver_id: 1, route_id: 1 }, { driver_id: 1, route_id: 2 }];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ driver_id: 1, route_id: 2 }) });
    } else {
      await route.continue();
    }
  });

  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await page.getByLabel("Маршрут").selectOption("2");
  await page.getByRole("button", { name: "Допустити до маршруту" }).dblclick();
  await expect(page.getByText("Допущений до 2 маршрутів", { exact: true })).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("Усі маршрути вже призначені.", { exact: true })).toBeVisible();
  expect(postCount).toBe(1);
});

test("409 keeps server detail and refreshes assignments", async ({ page }) => {
  let assigned = [{ driver_id: 1, route_id: 1 }];
  mockDriverAndAssignmentRoutes(page, assigned, [
    { id: 1, number: "101", title: "Перший", distance_km: 100 },
    { id: 2, number: "202", title: "Другий", distance_km: 200 },
  ]);
  await page.route("**/assignments", async (route) => {
    if (route.request().method() === "POST") {
      assigned = [{ driver_id: 1, route_id: 1 }, { driver_id: 1, route_id: 2 }];
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Допуск уже існує" }),
      });
    }
  });
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await page.getByLabel("Маршрут").selectOption("2");
  await page.getByRole("button", { name: "Допустити до маршруту" }).click();
  await expect(page.getByText("Допуск уже існує", { exact: true })).toBeVisible({ timeout: 120000 });
});

test("404 assignment creation shows detail and no success", async ({ page }) => {
  mockDriverAndAssignmentRoutes(page, [], [
    { id: 2, number: "202", title: "Другий", distance_km: 200 },
  ]);
  await page.route("**/assignments", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ detail: "Маршруту не знайдено" }),
  }));
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await page.getByLabel("Маршрут").selectOption("2");
  await page.getByRole("button", { name: "Допустити до маршруту" }).click();
  await expect(page.getByText("Маршруту не знайдено", { exact: true })).toBeVisible({ timeout: 120000 });
});

test("cancel dialog can be aborted and 204 removes only assignment", async ({ page }) => {
  let deleteCount = 0;
  let assigned = [{ driver_id: 1, route_id: 1 }];
  page.route("**/drivers/1", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 1, full_name: "Тест Водій", phone: "+380501112233", license_number: "DRV001", company_id: 1, company_name: "Перевізник" }),
  }));
  page.route("**/drivers/1/routes", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(assigned),
  }));
  page.route("**/routes/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([
      { id: 1, number: "101", title: "Перший", distance_km: 100 },
      { id: 2, number: "202", title: "Другий", distance_km: 200 },
    ]),
  }));
  page.route("**/assignments/1/1", async (route) => {
    deleteCount += 1;
    assigned = [];
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await page.getByRole("button", { name: "Скасувати допуск" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(deleteCount).toBe(0);

  await page.getByRole("button", { name: "Скасувати допуск" }).click();
  await page.getByRole("button", { name: "Скасувати допуск", exact: true }).last().click();
  await expect(page.getByText("Допущений до 0 маршрутів", { exact: true })).toBeVisible({ timeout: 120000 });
  await expect(page.getByLabel("Маршрут").locator('option[value="1"]')).toHaveCount(1);
  expect(deleteCount).toBe(1);
});

test("no routes, all assigned, and catalog error are distinct", async ({ page }) => {
  mockDriverAndAssignmentRoutes(page, [], []);
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByText("Створених маршрутів немає.", { exact: true })).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole("link", { name: "Створити маршрут" })).toBeVisible();

  await page.unroute("**/routes/");
  await page.unroute("**/drivers/1/routes");
  mockDriverAndAssignmentRoutes(page, [
    { driver_id: 1, route_id: 1 },
  ], [
    { id: 1, number: "101", title: "Перший", distance_km: 100 },
  ]);
  await page.goto("http://127.0.0.1:4173/#/");
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByText("Усі маршрути вже призначені.", { exact: true })).toBeVisible({ timeout: 120000 });

  await page.unroute("**/routes/");
  await page.route("**/routes/", (route) => route.abort("failed"));
  await page.reload();
  await expect(page.getByText("Не вдалося завантажити каталог маршрутів.", { exact: true })).toBeVisible({ timeout: 120000 });
});

test("360px and route count word forms", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("http://127.0.0.1:4173/");
  const forms = await page.evaluate(async () => {
    const module = await import("/js/pages/detail-pages.js");
    return [0, 1, 2, 11, 21, 111].map(module.routeCountText);
  });
  expect(forms).toEqual([
    "Допущений до 0 маршрутів",
    "Допущений до 1 маршруту",
    "Допущений до 2 маршрутів",
    "Допущений до 11 маршрутів",
    "Допущений до 21 маршруту",
    "Допущений до 111 маршрутів",
  ]);

  mockDriverAndAssignmentRoutes(page, [], [
    { id: 1, number: "101", title: "Довга назва маршруту ".repeat(5), distance_km: 100 },
  ]);
  await page.goto("http://127.0.0.1:4173/#/drivers/1");
  await expect(page.getByLabel("Маршрут")).toBeVisible({ timeout: 120000 });
  const noOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);
});
