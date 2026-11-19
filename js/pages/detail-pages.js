import { apiRequest } from "../api/client.js";
import { pageHeader, skeleton, stateBlock, confirmDialog } from "../components.js";

function createBreadcrumb(items) {
  const nav = document.createElement("nav");
  nav.className = "breadcrumbs";
  nav.setAttribute("aria-label", "Хлібні крихти");
  items.forEach((item, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = " / ";
      nav.append(separator);
    }
    if (item.href) {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      nav.append(link);
    } else {
      const current = document.createElement("span");
      current.setAttribute("aria-current", "page");
      current.textContent = item.label;
      nav.append(current);
    }
  });
  return nav;
}

function detailCard(title, fields) {
  const card = document.createElement("section");
  card.className = "card";
  const body = document.createElement("div");
  body.className = "card-body";
  const heading = document.createElement("h2");
  heading.textContent = title;
  body.append(heading);
  const dl = document.createElement("dl");
  dl.className = "detail-list";
  fields.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    if (value instanceof Node) {
      description.append(value);
    } else {
      description.textContent = value ?? "—";
    }
    dl.append(term, description);
  });
  body.append(dl);
  card.append(body);
  return card;
}

function listLink(label, href) {
  const link = document.createElement("a");
  link.className = "button button-secondary";
  link.href = href;
  link.textContent = label;
  return link;
}

function parsePositiveId(value) {
  if (!/^([1-9]\d*)$/.test(value || "")) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadDetail(container, config, id) {
  let controller = null;
  async function load() {
    if (controller) controller.abort();
    controller = new AbortController();
    container.replaceChildren();
    container.append(createBreadcrumb(config.breadcrumb(id)));

    const heading = pageHeader(config.loadingTitle, "");
    container.append(heading);
    container.append(skeleton());

    try {
      const data = await apiRequest(config.path(id), { signal: controller.signal });
      const expectedHash = `${config.backHref}/${id}`;
      if (window.location.hash !== expectedHash) return;
      container.replaceChildren();
      container.append(createBreadcrumb(config.breadcrumb(id)));

      const header = pageHeader(config.title(data), config.subtitle(data));
      container.append(header);
      container.append(detailCard("Основні дані", config.fields(data)));

      if (config.extra) {
        container.append(config.extra(data));
      }

      const back = document.createElement("div");
      back.className = "detail-actions";
      back.append(listLink(config.backLabel, config.backHref));
      container.append(back);
    } catch (error) {
      if (error?.name === "AbortError") return;
      const expectedHash = `${config.backHref}/${id}`;
      if (window.location.hash !== expectedHash) return;
      container.replaceChildren();
      container.append(createBreadcrumb(config.breadcrumb(id)));
      container.append(pageHeader(config.loadingTitle));
      const block = stateBlock(
        error?.status === 404
          ? "Запис не знайдено."
          : error?.message || "Не вдалося завантажити дані.",
        "error",
      );
      if (error?.status !== 404) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "button button-secondary";
        retry.textContent = "Оновити";
        retry.addEventListener("click", load);
        block.append(retry);
      }
      block.append(listLink(config.backLabel, config.backHref));
      container.append(block);
    }
  }
  load();
  return () => controller?.abort();
}

function companyLink(companyId, companyName) {
  const link = document.createElement("a");
  link.href = `#/companies/${companyId}`;
  link.textContent = companyName;
  return link;
}

export function routeCountText(count) {
  if (count === 1) return "Допущений до 1 маршруту";
  if (count % 10 === 1 && count % 100 !== 11) return `Допущений до ${count} маршруту`;
  return `Допущений до ${count} маршрутів`;
}

export function companiesDetail(container, params) {
  const id = parsePositiveId(params.id);
  if (!id) return invalidDetail(container, "Перевізники", "#/companies");
  return loadDetail(container, {
    loadingTitle: "Картка перевізника",
    breadcrumb: () => [
      { label: "Перевізники", href: "#/companies" },
      { label: `Перевізник №${id}` },
    ],
    path: (value) => `/companies/${value}`,
    title: (data) => data.name,
    subtitle: (data) => `Перевізник · ID ${data.id}`,
    fields: (data) => [
      ["Назва", data.name],
      ["Телефон", data.phone],
      ["ID", data.id],
    ],
    backLabel: "До списку перевізників",
    backHref: "#/companies",
  }, id);
}

export function busesDetail(container, params) {
  const id = parsePositiveId(params.id);
  if (!id) return invalidDetail(container, "Автобуси", "#/buses");
  return loadDetail(container, {
    loadingTitle: "Картка автобуса",
    breadcrumb: () => [
      { label: "Автобуси", href: "#/buses" },
      { label: `Автобус №${id}` },
    ],
    path: (value) => `/buses/${value}`,
    title: (data) => data.plate_number,
    subtitle: (data) => `Автобус · ID ${data.id}`,
    fields: (data) => [
      ["Номер", data.plate_number],
      ["Модель", data.model],
      ["Місця", data.seats],
      ["Перевізник", companyLink(data.company_id, data.company_name)],
      ["ID", data.id],
    ],
    backLabel: "До списку автобусів",
    backHref: "#/buses",
  }, id);
}

export function routesDetail(container, params) {
  const id = parsePositiveId(params.id);
  if (!id) return invalidDetail(container, "Маршрути", "#/routes");
  return loadDetail(container, {
    loadingTitle: "Картка маршруту",
    breadcrumb: () => [
      { label: "Маршрути", href: "#/routes" },
      { label: `Маршрут №${id}` },
    ],
    path: (value) => `/routes/${value}`,
    title: (data) => data.title,
    subtitle: (data) => `Маршрут · ID ${data.id}`,
    fields: (data) => [
      ["Номер", data.number],
      ["Назва", data.title],
      ["Відстань", `${data.distance_km} км`],
      ["ID", data.id],
    ],
    backLabel: "До списку маршрутів",
    backHref: "#/routes",
  }, id);
}

export function driversDetail(container, params) {
  const id = parsePositiveId(params.id);
  if (!id) return invalidDetail(container, "Водії", "#/drivers");

  let driversController = null;
  async function load() {
    if (driversController) driversController.abort();
    driversController = new AbortController();
    container.replaceChildren();
    container.append(createBreadcrumb([
      { label: "Водії", href: getDriversBackHref() },
      { label: `Водій №${id}` },
    ]));
    container.append(pageHeader("Картка водія"));
    container.append(skeleton());

    try {
      const data = await apiRequest(`/drivers/${id}`, { signal: driversController.signal });
      if (window.location.hash !== `#/drivers/${id}`) return;
      container.replaceChildren();
      container.append(createBreadcrumb([
        { label: "Водії", href: getDriversBackHref() },
        { label: data.full_name },
      ]));
      container.append(pageHeader(data.full_name, `Водій · ID ${data.id}`));

      const grid = document.createElement("div");
      grid.className = "detail-grid";
      grid.append(detailCard("Основні дані", [
        ["ПІБ", data.full_name],
        ["Телефон", data.phone],
        ["Посвідчення", data.license_number],
        ["ID", data.id],
      ]));
      const companyCard = detailCard("Перевізник", [
        ["Назва", companyLink(data.company_id, data.company_name)],
      ]);
      grid.append(companyCard);
      container.append(grid);
      await loadAssignments(container, id, driversController);

      const actions = document.createElement("div");
      actions.className = "detail-actions";
      actions.append(listLink("До списку водіїв", getDriversBackHref()));

      const edit = document.createElement("a");
      edit.className = "button button-secondary";
      edit.href = `#/drivers/${id}/edit`;
      edit.textContent = "Редагувати";
      actions.append(edit);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button button-danger";
      deleteButton.textContent = "Видалити";
      deleteButton.addEventListener("click", () => deleteDriverFromDetail(id, data.full_name, container));
      actions.append(deleteButton);
      container.append(actions);
    } catch (error) {
      if (error?.name === "AbortError") return;
      renderDriverError(container, error, id, load);
    }
  }

  load();
  return () => driversController?.abort();
}

function getDriversBackHref() {
  const saved = sessionStorage.getItem("drivers-list-state");
  if (!saved) return "#/drivers";
  try {
    const params = new URLSearchParams(saved);
    const limit = [10, 20, 50].includes(Number(params.get("limit"))) ? params.get("limit") : "20";
    const offsetValue = Number(params.get("offset"));
    const offset = Number.isInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0;
    const query = (params.get("q") || "").trim();
    const result = new URLSearchParams({ limit, offset: String(offset) });
    if (query) result.set("q", query);
    return `#/drivers?${result.toString()}`;
  } catch {
    return "#/drivers";
  }
}

async function deleteDriverFromDetail(id, fullName, container) {
  const confirmed = await confirmDialog(
    "Видалити водія?",
    `Видалити водія «${fullName}»? Усі його допуски до маршрутів також буде видалено. Цю дію неможливо скасувати.`,
    "Видалити",
  );
  if (!confirmed) return;

  try {
    await apiRequest(`/drivers/${id}`, { method: "DELETE" });
    sessionStorage.setItem("drivers-list-notice", "Водія видалено.");
    window.location.hash = getDriversBackHref().slice(1);
  } catch (error) {
    if (error?.status === 404) {
      sessionStorage.setItem("drivers-list-notice", "Водія вже не знайдено. Список оновлено.");
      window.location.hash = getDriversBackHref().slice(1);
      return;
    }
    const existing = container.querySelector(".delete-error");
    if (existing) existing.remove();
    if (error?.code === "TIMEOUT") {
      const unknown = stateBlock(
        "Результат мутації не підтверджено. Актуалізуйте дані перед повторною дією.",
        "error",
      );
      unknown.className += " delete-error";
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "button button-secondary";
      refresh.textContent = "Актуалізувати дані";
      refresh.addEventListener("click", () => {
        window.location.hash = getDriversBackHref().slice(1);
      });
      unknown.append(refresh);
      container.append(unknown);
      return;
    }
    const message = stateBlock(
      error?.message || "Не вдалося видалити водія.",
      "error",
    );
    message.className += " delete-error";
    container.append(message);
  }
}

async function loadAssignments(container, driverId) {
  const block = document.createElement("section");
  block.className = "card assignment-card";
  const body = document.createElement("div");
  body.className = "card-body";
  const heading = document.createElement("h2");
  heading.textContent = "Допуски до маршрутів";
  const count = document.createElement("p");
  count.className = "assignment-count";
  count.textContent = "Кількість допусків невідома";
  body.append(heading, count);
  block.append(body);
  container.append(block);

  const loading = skeleton();
  body.append(loading);

  let assignments = null;
  let routes = null;
  let loadingController = null;
  let mutationInProgress = false;
  let refreshGeneration = 0;
  let mutationMessage = "";
  let mutationRefreshNeeded = false;

  async function loadAssignmentsAndRoutes() {
    if (loadingController) loadingController.abort();
    loadingController = new AbortController();
    const generation = ++refreshGeneration;
    body.replaceChildren(heading, count);
    count.textContent = "Кількість допусків невідома";
    body.append(skeleton());

    const [assignmentsResult, routesResult] = await Promise.allSettled([
      apiRequest(`/drivers/${driverId}/routes`, { signal: loadingController.signal }),
      apiRequest("/routes/", { signal: loadingController.signal }),
    ]);
    if (generation !== refreshGeneration || !block.isConnected) return;

    assignments = assignmentsResult.status === "fulfilled" && Array.isArray(assignmentsResult.value)
      ? assignmentsResult.value.filter((item) => item.driver_id === driverId)
      : null;
    routes = routesResult.status === "fulfilled" && Array.isArray(routesResult.value)
      ? routesResult.value
      : null;

    render();
  }

  function render() {
    body.replaceChildren(heading, count);
    if (mutationMessage) {
      const mutationState = document.createElement("p");
      mutationState.className = "partial-error";
      mutationState.setAttribute("role", "alert");
      mutationState.textContent = mutationMessage;
      body.append(mutationState);
      if (mutationRefreshNeeded) {
        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.className = "button button-secondary";
        refresh.textContent = "Актуалізувати дані";
        refresh.addEventListener("click", () => {
          mutationMessage = "";
          mutationRefreshNeeded = false;
          loadAssignmentsAndRoutes();
        });
        body.append(refresh);
      }
    }

    if (!assignments) {
      count.textContent = "Кількість допусків невідома";
      const state = document.createElement("p");
      state.className = "partial-error";
      state.textContent = "Не вдалося завантажити допуски.";
      body.append(state);
      if (!routes) {
        const catalogError = document.createElement("p");
        catalogError.className = "partial-error";
        catalogError.textContent = "Не вдалося завантажити каталог маршрутів.";
        body.append(catalogError);
      }
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "button button-secondary";
      retry.textContent = "Оновити";
      retry.addEventListener("click", loadAssignmentsAndRoutes);
      body.append(retry);
      return;
    }

    count.textContent = routeCountText(assignments.length);

    const layout = document.createElement("div");
    layout.className = "assignment-layout";

    const listSection = document.createElement("div");
    listSection.className = "assignment-list-section";
    if (assignments.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Водій не допущений до жодного маршруту.";
      listSection.append(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "assignment-list";
      assignments.forEach((assignment) => {
        const item = document.createElement("li");
        item.className = "assignment-item";
        const route = routes?.find((value) => value.id === assignment.route_id);
        if (route) {
          const link = document.createElement("a");
          link.href = `#/routes/${route.id}`;
          link.textContent = `${route.number} — ${route.title}, ${route.distance_km} км`;
          item.append(link);
        } else {
          item.textContent = routes
            ? `Маршрут ID ${assignment.route_id}: деталі недоступні`
            : `Маршрут ID ${assignment.route_id}`;
        }

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button button-danger";
        cancel.textContent = "Скасувати допуск";
        cancel.addEventListener("click", () => cancelAssignment(assignment, route));
        item.append(cancel);
        list.append(item);
      });
      listSection.append(list);
    }
    layout.append(listSection);

    const formCard = document.createElement("div");
    formCard.className = "assignment-form";
    if (!routes) {
      const catalogError = document.createElement("p");
      catalogError.className = "partial-error";
      catalogError.textContent = "Не вдалося завантажити каталог маршрутів.";
      formCard.append(catalogError);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "button button-secondary";
      retry.textContent = "Оновити";
      retry.addEventListener("click", loadAssignmentsAndRoutes);
      formCard.append(retry);
    } else if (routes.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Створених маршрутів немає.";
      const create = document.createElement("a");
      create.className = "button button-primary";
      create.href = "#/routes/new";
      create.textContent = "Створити маршрут";
      formCard.append(empty, create);
    } else {
      const assignedIds = new Set(assignments.map((item) => item.route_id));
      const availableRoutes = routes.filter((route) => !assignedIds.has(route.id));

      if (availableRoutes.length === 0) {
        const allAssigned = document.createElement("p");
        allAssigned.textContent = "Усі маршрути вже призначені.";
        formCard.append(allAssigned);
      } else {
        const form = document.createElement("form");
        form.noValidate = true;
        const field = document.createElement("div");
        field.className = "field";
        const label = document.createElement("label");
        label.htmlFor = "assignment-route";
        label.textContent = "Маршрут";
        const select = document.createElement("select");
        select.id = "assignment-route";
        select.className = "select";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Оберіть маршрут";
        select.append(placeholder);
        availableRoutes.forEach((route) => {
          const option = document.createElement("option");
          option.value = String(route.id);
          option.textContent = `${route.number} — ${route.title}`;
          select.append(option);
        });
        const error = document.createElement("p");
        error.className = "field-error";
        error.setAttribute("role", "alert");
        field.append(label, select, error);
        form.append(field);

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "button button-primary";
        submit.textContent = "Допустити до маршруту";
        form.append(submit);
        formCard.append(form);

        form.addEventListener("submit", async (event) => {
          event.preventEventDefault;
          event.preventDefault();
          if (mutationInProgress) return;
          const routeId = Number(select.value);
          if (!select.value || !Number.isSafeInteger(routeId) || routeId <= 0) {
            error.textContent = "Оберіть маршрут.";
            select.setAttribute("aria-invalid", "true");
            select.focus();
            return;
          }
          if (!availableRoutes.some((route) => route.id === routeId)) {
            error.textContent = "Цей маршрут уже призначений.";
            await loadAssignmentsAndRoutes();
            return;
          }

          mutationInProgress = true;
          submit.disabled = true;
          submit.textContent = "Збереження...";
          error.textContent = "";
          try {
            await apiRequest("/assignments", {
              method: "POST",
              body: JSON.stringify({ driver_id: driverId, route_id: routeId }),
            });
            mutationMessage = "";
            await refreshAssignmentsAfterMutation();
          } catch (mutationError) {
            if (mutationError?.code === "TIMEOUT") {
              mutationMessage =
                "Результат мутації не підтверджено. Актуалізуйте дані перед повторною дією.";
              mutationRefreshNeeded = true;
              mutationInProgress = false;
              submit.disabled = false;
              submit.textContent = "Допустити до маршруту";
              render();
              return;
            }
            if (mutationError?.status === 409 || mutationError?.status === 404) {
              mutationMessage =
                typeof mutationError.detail === "string"
                  ? mutationError.detail
                  : mutationError.message || "Допуск не вдалося створити.";
              await refreshAssignmentsAfterMutation();
            } else {
              error.textContent =
                typeof mutationError.detail === "string"
                  ? mutationError.detail
                  : mutationError.message || "Не вдалося створити допуск.";
              mutationInProgress = false;
              submit.disabled = false;
              submit.textContent = "Допустити до маршруту";
            }
          }
        });
      }
    }
    layout.append(formCard);
    body.append(layout);
  }

  async function refreshAssignmentsAfterMutation() {
    const generation = ++refreshGeneration;
    if (loadingController) loadingController.abort();
    loadingController = new AbortController();
    try {
      const data = await apiRequest(`/drivers/${driverId}/routes`, { signal: loadingController.signal });
      if (generation !== refreshGeneration || !block.isConnected) return;
      assignments = Array.isArray(data)
        ? data.filter((item) => item.driver_id === driverId)
        : null;
      mutationInProgress = false;
      render();
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (generation !== refreshGeneration || !block.isConnected) return;
      assignments = null;
      mutationInProgress = false;
      render();
    }
  }

  async function cancelAssignment(assignment, route) {
    if (mutationInProgress) return;
    const routeLabel = route
      ? `${route.number} — ${route.title}`
      : `ID ${assignment.route_id}`;
    const confirmed = await confirmDialog(
      "Скасувати допуск?",
      `Скасувати допуск водія до маршруту «${routeLabel}»?`,
      "Скасувати допуск",
    );
    if (!confirmed) return;

    mutationInProgress = true;
    try {
      await apiRequest(`/assignments/${driverId}/${assignment.route_id}`, { method: "DELETE" });
      mutationMessage = "";
      await refreshAssignmentsAfterMutation();
    } catch (error) {
      mutationInProgress = false;
      if (error?.code === "TIMEOUT") {
        mutationMessage =
          "Результат мутації не підтверджено. Актуалізуйте дані перед повторною дією.";
        mutationRefreshNeeded = true;
        render();
        return;
      }
      mutationMessage =
        typeof error?.detail === "string"
          ? error.detail
          : error?.message || "Не вдалося скасувати допуск.";
      if (error?.status === 404) {
        await refreshAssignmentsAfterMutation();
      } else {
        render();
      }
    }
  }

  loadAssignmentsAndRoutes();
}

function renderDriverError(container, error, id, load) {
  container.replaceChildren();
  container.append(createBreadcrumb([
    { label: "Водії", href: getDriversBackHref() },
    { label: `Водій №${id}` },
  ]));
  container.append(pageHeader("Картка водія"));
  const block = stateBlock(
    error?.status === 404 ? "Водія не знайдено." : error?.message || "Не вдалося завантажити дані.",
    "error",
  );
  if (error?.status !== 404) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-secondary";
    retry.textContent = "Оновити";
    retry.addEventListener("click", load);
    block.append(retry);
  }
  block.append(listLink("До списку водіїв", getDriversBackHref()));
  container.append(block);
}

function invalidDetail(container, label, href) {
  container.replaceChildren();
  container.append(createBreadcrumb([
    { label, href },
    { label: "Неправильний ID" },
  ]));
  container.append(pageHeader("Неправильний ID"));
  const block = stateBlock("ID має бути додатним цілим числом.", "error");
  block.append(listLink(`До списку ${label.toLowerCase()}`, href));
  container.append(block);
  return null;
}
