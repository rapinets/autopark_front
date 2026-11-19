import { apiRequest } from "./api/client.js";
import { HashRouter } from "./router.js";
import {
  pageHeader,
  stateBlock,
} from "./components.js";
import {
  companiesPage,
  busesPage,
  routesPage,
  driversPage,
} from "./pages/list-pages.js";
import {
  companiesDetail,
  busesDetail,
  routesDetail,
  driversDetail,
} from "./pages/detail-pages.js";
import {
  companiesCreate,
  busesCreate,
  routesCreate,
  driversCreate,
  driversEdit,
} from "./pages/create-pages.js";

const app = document.querySelector("#app");

const sections = [
  { path: "/", label: "Головна" },
  { path: "/companies", label: "Перевізники" },
  { path: "/buses", label: "Автобуси" },
  { path: "/routes", label: "Маршрути" },
  { path: "/drivers", label: "Водії" },
];

let healthController = null;
let pageCleanup = null;

function createShell() {
  app.replaceChildren();

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const header = document.createElement("header");
  header.className = "mobile-header";
  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "menu-button";
  menuButton.setAttribute("aria-label", "Відкрити меню");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.textContent = "Меню";
  const brandMobile = document.createElement("strong");
  brandMobile.textContent = "Автопарк";
  header.append(menuButton, brandMobile);

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "mobile-backdrop";
  backdrop.setAttribute("aria-label", "Закрити меню");

  const sidebar = document.createElement("aside");
  sidebar.className = "sidebar";
  sidebar.setAttribute("aria-label", "Основна навігація");

  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = "#/";
  brand.textContent = "Автопарк";
  sidebar.append(brand);

  const nav = document.createElement("nav");
  const list = document.createElement("ul");
  list.className = "nav-list";

  sections.forEach((section) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = `#${section.path}`;
    link.textContent = section.label;
    link.dataset.path = section.path;
    item.append(link);
    list.append(item);
  });

  nav.append(list);
  sidebar.append(nav);

  const main = document.createElement("main");
  main.className = "main";
  main.id = "main-content";

  const content = document.createElement("div");
  content.className = "content";
  content.id = "route-content";
  main.append(content);

  shell.append(header, backdrop, sidebar, main);
  app.append(shell);

  const closeMenu = () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  };

  menuButton.addEventListener("click", () => {
    const open = !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
  });
  backdrop.addEventListener("click", closeMenu);
  sidebar.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("open")) {
      closeMenu();
      menuButton.focus();
    }
  });
}

createShell();

function setActive(path) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    if (link.dataset.path === path) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

async function checkHealth(container) {
  if (healthController) {
    healthController.abort();
  }
  healthController = new AbortController();

  const status = container.querySelector("[data-health-status]");
  if (!status) return;
  status.textContent = "Перевірка...";
  status.parentElement.querySelector(".status-dot")?.classList.remove("success", "error");

  try {
    const data = await apiRequest("/health", { signal: healthController.signal });
    if (data?.status === "ok") {
      status.textContent = "API доступне";
      status.parentElement.querySelector(".status-dot")?.classList.add("success");
    } else {
      status.textContent = "API відповів без очікуваного статусу";
      status.parentElement.querySelector(".status-dot")?.classList.add("error");
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    status.textContent = "API недоступне";
    status.parentElement.querySelector(".status-dot")?.classList.add("error");
  }
}

function homePage(container) {
  document.title = "Огляд автопарку — Автопарк";
  container.append(pageHeader("Огляд автопарку", "Загальний розмір даних у поточній базі."));

  let dashboardController = new AbortController();
  let healthController = new AbortController();

  const toolbar = document.createElement("div");
  toolbar.className = "dashboard-toolbar";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "button button-secondary";
  refresh.textContent = "Оновити";
  toolbar.append(refresh);
  container.append(toolbar);

  const healthRow = document.createElement("div");
  healthRow.className = "health-row";
  const healthStatus = document.createElement("p");
  healthStatus.className = "status-label";
  healthStatus.dataset.healthStatus = "";
  const healthDot = document.createElement("span");
  healthDot.className = "status-dot";
  const healthText = document.createElement("span");
  healthText.textContent = "Перевірка...";
  healthStatus.append(healthDot, healthText);
  healthRow.append(healthStatus);
  container.append(healthRow);

  const cards = document.createElement("section");
  cards.className = "dashboard-grid";
  cards.setAttribute("aria-label", "Загальна кількість записів");

  const definitions = [
    { key: "companies", label: "Перевізники", href: "#/companies", path: "/companies/" },
    { key: "buses", label: "Автобуси", href: "#/buses", path: "/buses/" },
    { key: "routes", label: "Маршрути", href: "#/routes", path: "/routes/" },
    { key: "drivers", label: "Водії", href: "#/drivers", path: null },
  ];

  const cardElements = {};
  definitions.forEach((definition) => {
    const link = document.createElement("a");
    link.className = "dashboard-card";
    link.href = definition.href;
    const number = document.createElement("strong");
    number.className = "dashboard-number";
    number.dataset.count = definition.key;
    number.textContent = "—";
    const label = document.createElement("span");
    label.className = "dashboard-label";
    label.textContent = definition.label;
    const arrow = document.createElement("span");
    arrow.className = "dashboard-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    link.append(number, label, arrow);
    cards.append(link);
    cardElements[definition.key] = { number, link };
  });
  container.append(cards);

  function setCount(key, value, failed = false) {
    const number = cardElements[key].number;
    number.textContent = failed ? "—" : String(value);
    number.setAttribute("aria-label", failed ? "Кількість недоступна" : String(value));
  }

  async function countFullArray(path, key) {
    cardElements[key].link.setAttribute("aria-busy", "true");
    setCount(key, "—", true);
    try {
      const data = await apiRequest(path, { signal: dashboardController.signal });
      if (!Array.isArray(data)) throw new Error("Некоректна відповідь API.");
      setCount(key, data.length);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setCount(key, "—", true);
    } finally {
      cardElements[key].link.removeAttribute("aria-busy");
    }
  }

  async function countDrivers() {
    const key = "drivers";
    cardElements[key].link.setAttribute("aria-busy", "true");
    setCount(key, "—", true);
    let offset = 0;
    let total = 0;
    try {
      while (true) {
        const data = await apiRequest(`/drivers?limit=100&offset=${offset}`, {
          signal: dashboardController.signal,
        });
        if (!Array.isArray(data)) throw new Error("Некоректна відповідь API.");
        total += data.length;
        if (data.length < 100) break;
        offset += 100;
      }
      setCount(key, total);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setCount(key, "—", true);
    } finally {
      cardElements[key].link.removeAttribute("aria-busy");
    }
  }

  async function checkDashboardHealth() {
    healthController.abort();
    healthController = new AbortController();
    healthDot.classList.remove("success", "error");
    healthText.textContent = "Перевірка...";
    try {
      const data = await apiRequest("/health", { signal: healthController.signal });
      if (data?.status === "ok") {
        healthDot.classList.add("success");
        healthText.textContent = "API доступне";
      } else {
        healthDot.classList.add("error");
        healthText.textContent = "Не вдалося перевірити доступність API";
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      healthDot.classList.add("error");
      healthText.textContent = "Не вдалося перевірити доступність API";
    }
  }

  function loadAll() {
    dashboardController.abort();
    dashboardController = new AbortController();
    countFullArray("/companies/", "companies");
    countFullArray("/buses/", "buses");
    countFullArray("/routes/", "routes");
    countDrivers();
    checkDashboardHealth();
  }

  refresh.addEventListener("click", loadAll);
  loadAll();

  return () => {
    dashboardController.abort();
    healthController.abort();
  };
}

function notFoundPage(container) {
  document.title = "Сторінку не знайдено — Автопарк";
  container.append(pageHeader("Сторінку не знайдено", "Невідомий маршрут"));
  container.append(stateBlock("Такого розділу не існує.", "error"));
  const link = document.createElement("a");
  link.className = "button button-primary";
  link.href = "#/";
  link.textContent = "На головну";
  container.append(link);
}

const routes = [
  { path: "/", render: homePage },
  { path: "/companies", render: companiesPage },
  { path: "/buses", render: busesPage },
  { path: "/routes", render: routesPage },
  { path: "/drivers", render: driversPage },
  { path: "/companies/new", render: companiesCreate },
  { path: "/buses/new", render: busesCreate },
  { path: "/routes/new", render: routesCreate },
  { path: "/drivers/new", render: driversCreate },
  { path: "/drivers/:id/edit", pattern: /^\/drivers\/([^/?]+)\/edit$/, paramNames: ["id"], render: driversEdit },
  { path: "/companies/:id", pattern: /^\/companies\/([^/?]+)$/, paramNames: ["id"], render: companiesDetail },
  { path: "/buses/:id", pattern: /^\/buses\/([^/?]+)$/, paramNames: ["id"], render: busesDetail },
  { path: "/routes/:id", pattern: /^\/routes\/([^/?]+)$/, paramNames: ["id"], render: routesDetail },
  { path: "/drivers/:id", pattern: /^\/drivers\/([^/?]+)$/, paramNames: ["id"], render: driversDetail },
];

const router = new HashRouter(routes, (match, route, searchParams, params) => {
  if (healthController) {
    healthController.abort();
  }
  if (pageCleanup) {
    pageCleanup();
    pageCleanup = null;
  }

  const container = document.querySelector("#route-content");
  container.replaceChildren();

  if (match.path === "*") {
    setActive(null);
    notFoundPage(container);
  } else {
    const sectionPath = route === "/" ? "/" : `/${route.split("/")[1]}`;
    setActive(sectionPath);
    const renderParams = match.pattern ? params : searchParams;
    const result = match.render(container, renderParams);
    pageCleanup = typeof result === "function" ? result : null;
  }

  requestAnimationFrame(() => {
    const heading = container.querySelector("h1");
    heading?.focus();
  });
});

router.start();
