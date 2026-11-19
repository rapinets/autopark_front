import { apiRequest } from "../api/client.js";
import { pageHeader, skeleton, stateBlock, confirmDialog } from "../components.js";

function setDocumentTitle(title) {
  document.title = `${title} — Автопарк`;
}

function createTable(headers, rows) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "table";

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headRow.append(cell);
  });
  head.append(headRow);

  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value, index) => {
      const td = document.createElement("td");
      td.dataset.label = headers[index];
      if (value instanceof Node) {
        td.append(value);
      } else {
        td.textContent = value ?? "—";
      }
      tr.append(td);
    });
    body.append(tr);
  });

  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function createRefreshButton(load) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-secondary";
  button.textContent = "Оновити";
  button.addEventListener("click", load);
  return button;
}

function detailLink(label, href) {
  const link = document.createElement("a");
  link.className = "button button-secondary";
  link.href = href;
  link.textContent = label;
  return link;
}

function addLink(label, href) {
  const link = document.createElement("a");
  link.className = "button button-primary";
  link.href = href;
  link.textContent = label;
  return link;
}

function addError(container, error, load) {
  const block = stateBlock(error?.message || "Не вдалося завантажити дані.", "error");
  block.append(createRefreshButton(load));
  container.append(block);
}

function genericList(container, config) {
  setDocumentTitle(config.title);
  container.append(pageHeader(config.title, config.description));

  const toolbar = document.createElement("div");
  toolbar.className = "list-toolbar";
  toolbar.append(createRefreshButton(load));
  if (config.addHref) {
    toolbar.append(addLink("Додати", config.addHref));
  }
  container.append(toolbar);

  let controller = null;

  async function load() {
    if (controller) controller.abort();
    controller = new AbortController();
    const existingToolbar = toolbar;
    container.querySelectorAll(".state-block, .table-wrap, .empty-block").forEach((item) => item.remove());
    container.insertBefore(skeleton(), existingToolbar.nextSibling);

    try {
      const data = await apiRequest(config.path, { signal: controller.signal });
      container.querySelector(".state-block")?.remove();

      if (!Array.isArray(data)) {
        throw new Error("Сервер повернув некоректний формат списку.");
      }

      container.querySelectorAll(".table-wrap, .empty-block").forEach((item) => item.remove());
      if (data.length === 0) {
        const empty = stateBlock(config.emptyText);
        empty.className = "state-block empty-block";
        container.append(empty);
        return;
      }

      const headers = [...config.headers, "Дія"];
      const rows = data.map((item) => [
        ...config.row(item),
        detailLink("Переглянути", config.detailHref(item)),
      ]);
      container.append(createTable(headers, rows));
    } catch (error) {
      if (error?.name === "AbortError") return;
      container.querySelectorAll(".state-block, .table-wrap, .empty-block").forEach((item) => item.remove());
      addError(container, error, load);
    }
  }

  load();
  return () => {
    if (controller) controller.abort();
  };
}

export function companiesPage(container) {
  return genericList(container, {
    title: "Перевізники",
    description: "Список перевізників",
    path: "/companies/",
    emptyText: "Перевізників ще немає.",
    headers: ["Назва", "Телефон"],
    row: (item) => [item.name, item.phone],
    detailHref: (item) => `#/companies/${item.id}`,
    addHref: "#/companies/new",
  });
}

export function busesPage(container) {
  return genericList(container, {
    title: "Автобуси",
    description: "Список автобусів",
    path: "/buses/",
    emptyText: "Автобусів ще немає.",
    headers: ["Номер", "Модель", "Місця", "Перевізник"],
    row: (item) => [item.plate_number, item.model, item.seats, item.company_name],
    detailHref: (item) => `#/buses/${item.id}`,
    addHref: "#/buses/new",
  });
}

export function routesPage(container) {
  return genericList(container, {
    title: "Маршрути",
    description: "Список маршрутів",
    path: "/routes/",
    emptyText: "Маршрутів ще немає.",
    headers: ["Номер", "Назва", "Відстань, км"],
    row: (item) => [item.number, item.title, item.distance_km],
    detailHref: (item) => `#/routes/${item.id}`,
    addHref: "#/routes/new",
  });
}

export function driversPage(container, searchParams) {
  setDocumentTitle("Водії");
  container.append(pageHeader("Водії", "Список водіїв"));
  if (!searchParams || typeof searchParams.get !== "function") {
    searchParams = new URLSearchParams();
  }

  const allowedLimits = [10, 20, 50];
  const rawLimit = Number(searchParams.get("limit"));
  const rawOffset = Number(searchParams.get("offset"));
  let limit = allowedLimits.includes(rawLimit) ? rawLimit : 20;
  let offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const query = (searchParams.get("q") || "").trim();

  const normalized = new URLSearchParams();
  normalized.set("limit", String(limit));
  normalized.set("offset", String(offset));
  if (query) normalized.set("q", query);
  sessionStorage.setItem("drivers-list-state", normalized.toString());
  if (
    searchParams.get("limit") !== String(limit)
    || searchParams.get("offset") !== String(offset)
    || (searchParams.get("q") || "") !== query
  ) {
    window.location.replace(`#/drivers?${normalized.toString()}`);
  }

  const toolbar = document.createElement("form");
  toolbar.className = "list-toolbar";
  toolbar.setAttribute("role", "search");

  const searchField = document.createElement("div");
  searchField.className = "field";
  const searchLabel = document.createElement("label");
  searchLabel.htmlFor = "driver-search";
  searchLabel.textContent = "Пошук";
  const searchInput = document.createElement("input");
  searchInput.id = "driver-search";
  searchInput.className = "input";
  searchInput.type = "search";
  searchInput.value = query;
  searchInput.placeholder = "ПІБ, телефон або посвідчення";
  searchField.append(searchLabel, searchInput);

  const sizeField = document.createElement("div");
  sizeField.className = "field";
  const sizeLabel = document.createElement("label");
  sizeLabel.htmlFor = "driver-page-size";
  sizeLabel.textContent = "Рядків";
  const sizeSelect = document.createElement("select");
  sizeSelect.id = "driver-page-size";
  sizeSelect.className = "select";
  allowedLimits.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    option.selected = value === limit;
    sizeSelect.append(option);
  });
  sizeField.append(sizeLabel, sizeSelect);

  const hint = document.createElement("p");
  hint.className = "search-hint";
  hint.textContent = "Пошук лише на поточній сторінці";

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "button button-secondary";
  refresh.textContent = "Оновити";

  const searchButton = document.createElement("button");
  searchButton.type = "submit";
  searchButton.className = "button button-primary";
  searchButton.textContent = "Знайти";

  toolbar.append(searchField, sizeField, searchButton, refresh, addLink("Додати", "#/drivers/new"));
  container.append(toolbar, hint);

  const notice = document.createElement("div");
  notice.className = "form-message";
  notice.setAttribute("role", "status");
  const storedNotice = sessionStorage.getItem("drivers-list-notice");
  if (storedNotice) {
    notice.textContent = storedNotice;
    notice.className = "form-message form-message-success";
    sessionStorage.removeItem("drivers-list-notice");
  }
  container.append(notice);

  const pagination = document.createElement("nav");
  pagination.className = "pagination";
  pagination.setAttribute("aria-label", "Пагінація водіїв");

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "button button-secondary";
  previous.textContent = "Попередня";

  const pagePosition = document.createElement("span");
  pagePosition.className = "page-position";

  const next = document.createElement("button");
  next.type = "button";
  next.className = "button button-primary";
  next.textContent = "Наступна";
  pagination.append(previous, pagePosition, next);
  container.append(pagination);

  let controller = null;
  let hasNext = false;

  async function deleteDriver(item) {
    const confirmed = await confirmDialog(
      "Видалити водія?",
      `Видалити водія «${item.full_name}»? Усі його допуски до маршрутів також буде видалено. Цю дію неможливо скасувати.`,
      "Видалити",
    );
    if (!confirmed) return;

    try {
      await apiRequest(`/drivers/${item.id}`, { method: "DELETE" });
      const remaining = await apiRequest(`/drivers?limit=${limit + 1}&offset=${offset}`);
      if (Array.isArray(remaining) && remaining.length === 0 && offset > 0) {
        notice.textContent = "Водія видалено.";
        notice.className = "form-message form-message-success";
        updateHash(Math.max(0, offset - limit), limit, query);
      } else {
        notice.textContent = "Водія видалено.";
        notice.className = "form-message form-message-success";
        await load();
      }
    } catch (error) {
      if (error?.status === 404) {
        notice.textContent = "Водія вже не знайдено. Список оновлено.";
        notice.className = "form-message form-message-success";
        await load();
      } else if (error?.code === "TIMEOUT") {
        notice.textContent =
          "Результат мутації не підтверджено. Актуалізуйте дані перед повторною дією.";
        notice.className = "form-message form-message-warning";
        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.className = "button button-secondary";
        refresh.textContent = "Актуалізувати дані";
        refresh.addEventListener("click", load);
        notice.append(refresh);
      } else {
        notice.textContent = error?.message || "Не вдалося видалити водія.";
        notice.className = "form-message form-message-warning";
      }
    }
  }

  function updateHash(nextOffset, nextLimit = limit, nextQuery = query) {
    const params = new URLSearchParams();
    params.set("limit", String(nextLimit));
    params.set("offset", String(Math.max(0, nextOffset)));
    const trimmedQuery = nextQuery.trim();
    if (trimmedQuery) params.set("q", trimmedQuery);
    window.location.hash = `/drivers?${params.toString()}`;
  }

  async function load() {
    if (controller) controller.abort();
    controller = new AbortController();
    container.querySelectorAll(".state-block, .table-wrap, .empty-block").forEach((item) => item.remove());
    container.insertBefore(skeleton(), pagination);

    try {
      const data = await apiRequest(`/drivers?limit=${limit + 1}&offset=${offset}`, {
        signal: controller.signal,
      });
      container.querySelectorAll(".state-block, .table-wrap, .empty-block").forEach((item) => item.remove());
      if (!Array.isArray(data)) {
        throw new Error("Сервер повернув некоректний формат списку.");
      }

      hasNext = data.length > limit;
      const pageRows = data.slice(0, limit);
      const normalizedQuery = query.toLocaleLowerCase();
      const visibleRows = normalizedQuery
        ? pageRows.filter((item) =>
          [item.full_name, item.phone, item.license_number]
            .some((value) => String(value ?? "").toLocaleLowerCase().includes(normalizedQuery)))
        : pageRows;

      if (pageRows.length === 0) {
        container.insertBefore(stateBlock("Водіїв на цій сторінці немає."), pagination);
      } else if (visibleRows.length === 0) {
        const empty = stateBlock("На поточній сторінці немає збігів.");
        empty.className = "state-block empty-block";
        container.insertBefore(empty, pagination);
      } else {
        const actionRows = visibleRows.map((item) => {
          const actions = document.createElement("div");
          actions.className = "row-actions";
          const view = document.createElement("a");
          view.className = "button button-secondary";
          view.href = `#/drivers/${item.id}`;
          view.textContent = "Переглянути";
          const edit = document.createElement("a");
          edit.className = "button button-secondary";
          edit.href = `#/drivers/${item.id}/edit`;
          edit.textContent = "Редагувати";
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "button button-danger";
          remove.textContent = "Видалити";
          remove.addEventListener("click", () => deleteDriver(item));
          actions.append(view, edit, remove);
          return [
            item.full_name,
            item.phone,
            item.license_number,
            item.company_name,
            actions,
          ];
        });
        container.insertBefore(createTable(
          ["ПІБ", "Телефон", "Посвідчення", "Перевізник", "Дія"],
          actionRows,
        ), pagination);
      }

      previous.disabled = offset === 0;
      next.disabled = !hasNext;
      pagePosition.textContent = `З ${offset + 1}`;
    } catch (error) {
      if (error?.name === "AbortError") return;
      container.querySelectorAll(".state-block, .table-wrap, .empty-block").forEach((item) => item.remove());
      addError(container, error, load);
      previous.disabled = true;
      next.disabled = true;
    }
  }

  toolbar.addEventListener("submit", (event) => {
    event.preventDefault();
    updateHash(0, limit, searchInput.value);
  });
  sizeSelect.addEventListener("change", () => {
    updateHash(0, Number(sizeSelect.value), searchInput.value);
  });
  previous.addEventListener("click", () => {
    updateHash(Math.max(0, offset - limit));
  });
  next.addEventListener("click", () => {
    if (hasNext) updateHash(offset + limit);
  });
  refresh.addEventListener("click", load);

  load();
  return () => {
    if (controller) controller.abort();
  };
}
