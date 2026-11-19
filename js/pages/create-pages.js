import { apiRequest } from "../api/client.js";
import { pageHeader, stateBlock } from "../components.js";
import { textError, integerError, positiveIdError } from "../utils/validation.js";

function createBreadcrumb(entityLabel, listHref) {
  const nav = document.createElement("nav");
  nav.className = "breadcrumbs";
  nav.setAttribute("aria-label", "Хлібні крихти");
  const list = document.createElement("a");
  list.href = listHref;
  list.textContent = entityLabel;
  const separator = document.createElement("span");
  separator.setAttribute("aria-hidden", "true");
  separator.textContent = " / ";
  const current = document.createElement("span");
  current.setAttribute("aria-current", "page");
  current.textContent = "Створення";
  nav.append(list, separator, current);
  return nav;
}

function createField({ name, label, hint, type = "text", min, max, required = true }) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const labelElement = document.createElement("label");
  labelElement.htmlFor = name;
  labelElement.textContent = label;

  const input = document.createElement(type === "select" ? "select" : "input");
  input.id = name;
  input.name = name;
  input.className = type === "select" ? "select" : "input";
  input.required = required;
  if (type !== "select") {
    input.type = type;
  }
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  if (type === "tel") input.autocomplete = "tel";
  if (type === "number") input.step = "1";

  const hintElement = document.createElement("p");
  hintElement.id = `${name}-hint`;
  hintElement.className = "field-hint";
  hintElement.textContent = hint;
  input.setAttribute("aria-describedby", hintElement.id);

  const errorElement = document.createElement("p");
  errorElement.id = `${name}-error`;
  errorElement.className = "field-error";
  errorElement.setAttribute("role", "alert");

  wrapper.append(labelElement, input, hintElement, errorElement);
  return { wrapper, input, errorElement };
}

function setFieldError(input, errorElement, message) {
  errorElement.textContent = message;
  if (message) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", `${input.id}-hint ${input.id}-error`);
  } else {
    input.removeAttribute("aria-invalid");
    input.setAttribute("aria-describedby", `${input.id}-hint`);
  }
}

function serverFieldName(loc) {
  if (!Array.isArray(loc)) return "";
  const stringParts = loc.filter((part) => typeof part === "string");
  return stringParts[stringParts.length - 1] || "";
}

export function genericCreatePage(container, config) {
  document.title = `Створення ${config.entityGenitive} — Автопарк`;
  container.append(createBreadcrumb(config.entityLabel, config.listHref));
  container.append(pageHeader(config.title, config.description));

  const card = document.createElement("section");
  card.className = "card form-card";
  const body = document.createElement("div");
  body.className = "card-body";
  const form = document.createElement("form");
  form.noValidate = true;

  const fields = {};
  config.fields.forEach((fieldConfig) => {
    const field = createField(fieldConfig);
    fields[fieldConfig.name] = field;
    form.append(field.wrapper);
  });

  const formMessage = document.createElement("div");
  formMessage.className = "form-message";
  formMessage.setAttribute("role", "alert");
  form.append(formMessage);

  const actions = document.createElement("div");
  actions.className = "form-actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "button button-primary";
  submit.textContent = "Створити";
  const cancel = document.createElement("a");
  cancel.className = "button button-secondary";
  cancel.href = config.listHref;
  cancel.textContent = "Скасувати";
  actions.append(submit, cancel);
  form.append(actions);

  body.append(form);
  card.append(body);
  container.append(card);

  let submitting = false;
  let submittedSuccessfully = false;

  config.fields.forEach((fieldConfig) => {
    const field = fields[fieldConfig.name];
    field.input.addEventListener("blur", () => {
      if (submittedSuccessfully) return;
      const message = config.validate(fieldConfig.name, field.input.value);
      setFieldError(field.input, field.errorElement, message);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventEventDefault;
    event.preventDefault();
    if (submitting || submittedSuccessfully) return;

    formMessage.replaceChildren();
    let firstInvalid = null;
    config.fields.forEach((fieldConfig) => {
      const field = fields[fieldConfig.name];
      const message = config.validate(fieldConfig.name, field.input.value);
      setFieldError(field.input, field.errorElement, message);
      if (message && !firstInvalid) firstInvalid = field.input;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    submitting = true;
    submit.disabled = true;
    submit.textContent = "Створення...";
    const payload = config.payload(Object.fromEntries(
      config.fields.map((fieldConfig) => [fieldConfig.name, fields[fieldConfig.name].input.value]),
    ));

    try {
      const created = await apiRequest(config.path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!created?.id) {
        throw new Error("Сервер не повернув ID створеного запису.");
      }

      submittedSuccessfully = true;
      formMessage.textContent = "Запис успішно створено.";
      formMessage.className = "form-message form-message-success";
      await verifyCreatedCard(created, config.detailHref(created), formMessage);
    } catch (error) {
      submitting = false;
      submit.disabled = false;
      submit.textContent = "Створити";

      if (error?.status === 422 && Array.isArray(error.detail)) {
        let shownGeneral = false;
        error.detail.forEach((item) => {
          const name = serverFieldName(item.loc);
          const field = fields[name];
          if (field) {
            setFieldError(field.input, field.errorElement, item.msg || "Некоректне значення.");
          } else {
            shownGeneral = true;
          }
        });
        if (shownGeneral) {
          formMessage.textContent = "Сервер відхилив дані. Перевірте введені поля.";
        }
      } else if (error?.code === "TIMEOUT") {
        formMessage.className = "form-message form-message-warning";
        formMessage.textContent =
          "Результат мутації не підтверджено. Актуалізуйте дані перед повторною дією.";
        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.className = "button button-secondary";
        refresh.textContent = "Актуалізувати дані";
        refresh.addEventListener("click", () => {
          window.location.hash = config.listHref.slice(1);
        });
        formMessage.append(refresh);
      } else {
        formMessage.textContent =
          typeof error?.detail === "string"
            ? error.detail
            : error?.message || "Не вдалося створити запис.";
      }

      const firstServerField = config.fields
        .map((fieldConfig) => fields[fieldConfig.name])
        .find((field) => field.input.getAttribute("aria-invalid") === "true");
      firstServerField?.input.focus();
    }
  });

  async function verifyCreatedCard(created, href, messageElement) {
    try {
      await apiRequest(config.detailApi(created.id));
      window.location.hash = href.slice(1);
    } catch (error) {
      submittedSuccessfully = true;
      submit.disabled = true;
      messageElement.className = "form-message form-message-warning";
      messageElement.textContent = "Збережено, але не вдалося оновити дані.";

      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "button button-secondary";
      retry.textContent = "Повторити GET";
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        try {
          await apiRequest(config.detailApi(created.id));
          window.location.hash = href.slice(1);
        } catch (retryError) {
          retry.disabled = false;
          messageElement.textContent =
            "Збережено, але не вдалося оновити дані.";
        }
      });
      formMessage.append(retry);
    }
  }
}

async function loadCompanies(container, config) {
  let controller = null;
  const companyField = config.field;
  try {
    controller = new AbortController();
    const companies = await apiRequest("/companies/", { signal: controller.signal });
    if (!Array.isArray(companies)) throw new Error("Сервер повернув некоректний формат списку.");
    if (companies.length === 0) {
      return { companies, empty: true };
    }
    return { companies, empty: false };
  } catch (error) {
    return { error, companies: [] };
  }
}

export function companiesCreate(container) {
  genericCreatePage(container, {
    title: "Створення перевізника",
    entityLabel: "Перевізники",
    entityGenitive: "перевізника",
    listHref: "#/companies",
    description: "Додайте нового перевізника",
    path: "/companies/",
    detailApi: (id) => `/companies/${id}`,
    detailHref: (created) => `#/companies/${created.id}`,
    fields: [
      { name: "name", label: "Назва", hint: "Від 2 до 120 символів", type: "text" },
      { name: "phone", label: "Телефон", hint: "Від 7 до 20 символів", type: "tel" },
    ],
    validate: (name, value) => {
      if (name === "name") return textError(value, 2, 120, "назву");
      return textError(value, 7, 20, "телефон");
    },
    payload: (values) => ({ name: values.name.trim(), phone: values.phone.trim() }),
  });
}

export function busesCreate(container) {
  createCompanyDependentPage(container, {
    title: "Створення автобуса",
    entityLabel: "Автобуси",
    entityGenitive: "автобуса",
    listHref: "#/buses",
    description: "Додайте новий автобус",
    path: "/buses/",
    detailApi: (id) => `/buses/${id}`,
    detailHref: (created) => `#/buses/${created.id}`,
    fields: [
      { name: "plate_number", label: "Номерний знак", hint: "Від 4 до 15 символів", type: "text" },
      { name: "model", label: "Модель", hint: "Від 2 до 80 символів", type: "text" },
      { name: "seats", label: "Кількість місць", hint: "Від 10 до 120", type: "number", min: 10, max: 120 },
      { name: "company_id", label: "Перевізник", hint: "Оберіть перевізника", type: "select" },
    ],
    validate: (name, value) => {
      if (name === "plate_number") return textError(value, 4, 15, "номерний знак");
      if (name === "model") return textError(value, 2, 80, "модель");
      if (name === "seats") return integerError(value, 10, 120, "Кількість місць");
      return positiveIdError(value, "Перевізник");
    },
    payload: (values) => ({
      plate_number: values.plate_number.trim(),
      model: values.model.trim(),
      seats: Number(values.seats),
      company_id: Number(values.company_id),
    }),
  });
}

export function routesCreate(container) {
  genericCreatePage(container, {
    title: "Створення маршруту",
    entityLabel: "Маршрути",
    entityGenitive: "маршруту",
    listHref: "#/routes",
    description: "Додайте новий маршрут",
    path: "/routes/",
    detailApi: (id) => `/routes/${id}`,
    detailHref: (created) => `#/routes/${created.id}`,
    fields: [
      { name: "number", label: "Номер маршруту", hint: "Від 1 до 10 символів", type: "text" },
      { name: "title", label: "Назва", hint: "Від 3 до 120 символів", type: "text" },
      { name: "distance_km", label: "Відстань, км", hint: "Від 1 до 5000", type: "number", min: 1, max: 5000 },
    ],
    validate: (name, value) => {
      if (name === "number") return textError(value, 1, 10, "номер маршруту");
      if (name === "title") return textError(value, 3, 120, "назву");
      return integerError(value, 1, 5000, "Відстань");
    },
    payload: (values) => ({
      number: values.number.trim(),
      title: values.title.trim(),
      distance_km: Number(values.distance_km),
    }),
  });
}

export function driversCreate(container) {
  createCompanyDependentPage(container, {
    title: "Створення водія",
    entityLabel: "Водії",
    entityGenitive: "водія",
    listHref: "#/drivers",
    description: "Додайте нового водія",
    path: "/drivers",
    detailApi: (id) => `/drivers/${id}`,
    detailHref: (created) => `#/drivers/${created.id}`,
    fields: [
      { name: "full_name", label: "ПІБ", hint: "Від 3 до 120 символів", type: "text" },
      { name: "phone", label: "Телефон", hint: "Від 7 до 20 символів", type: "tel" },
      { name: "license_number", label: "Посвідчення", hint: "Від 5 до 20 символів", type: "text" },
      { name: "company_id", label: "Перевізник", hint: "Оберіть перевізника", type: "select" },
    ],
    validate: (name, value) => {
      if (name === "full_name") return textError(value, 3, 120, "ПІБ");
      if (name === "phone") return textError(value, 7, 20, "телефон");
      if (name === "license_number") return textError(value, 5, 20, "посвідчення");
      return positiveIdError(value, "Перевізник");
    },
    payload: (values) => ({
      full_name: values.full_name.trim(),
      phone: values.phone.trim(),
      license_number: values.license_number.trim(),
      company_id: Number(values.company_id),
    }),
  });
}

export function driversEdit(container, params) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    container.replaceChildren();
    container.append(createBreadcrumb("Водії", "#/drivers"));
    container.append(pageHeader("Редагування водія"));
    const block = stateBlock("ID має бути додатним цілим числом.", "error");
    container.append(block);
    return null;
  }

  document.title = "Редагування водія — Автопарк";
  container.append(createBreadcrumb("Водії", getEditBackHref()));
  container.append(pageHeader("Редагування водія", "Завантаження даних водія і перевізників"));

  const card = document.createElement("section");
  card.className = "card form-card";
  const body = document.createElement("div");
  body.className = "card-body";
  const form = document.createElement("form");
  form.noValidate = true;
  const fields = {};
  const fieldConfigs = [
    { name: "full_name", label: "ПІБ", hint: "Від 3 до 120 символів", type: "text" },
    { name: "phone", label: "Телефон", hint: "Від 7 до 20 символів", type: "tel" },
    { name: "license_number", label: "Посвідчення", hint: "Від 5 до 20 символів", type: "text" },
    { name: "company_id", label: "Перевізник", hint: "Оберіть перевізника", type: "select" },
  ];
  const validate = (name, value) => {
    if (name === "full_name") return textError(value, 3, 120, "ПІБ");
    if (name === "phone") return textError(value, 7, 20, "телефон");
    if (name === "license_number") return textError(value, 5, 20, "посвідчення");
    return positiveIdError(value, "Перевізник");
  };

  fieldConfigs.forEach((fieldConfig) => {
    const field = createField(fieldConfig);
    fields[fieldConfig.name] = field;
    form.append(field.wrapper);
  });
  const message = document.createElement("div");
  message.className = "form-message";
  message.setAttribute("role", "alert");
  form.append(message);
  const actions = document.createElement("div");
  actions.className = "form-actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "button button-primary";
  submit.textContent = "Зберегти зміни";
  submit.disabled = true;
  const cancel = document.createElement("a");
  cancel.className = "button button-secondary";
  cancel.href = `#/drivers/${id}`;
  cancel.textContent = "Скасувати";
  actions.append(submit, cancel);
  form.append(actions);
  body.append(form);
  card.append(body);
  container.append(card);

  let controller = new AbortController();
  let submitting = false;

  async function load() {
    controller.abort();
    controller = new AbortController();
    submit.disabled = true;
    try {
      const [driver, companies] = await Promise.all([
        apiRequest(`/drivers/${id}`, { signal: controller.signal }),
        apiRequest("/companies/", { signal: controller.signal }),
      ]);
      if (!Array.isArray(companies)) throw new Error("Сервер повернув некоректний формат списку.");
      if (companies.length === 0) {
        message.textContent = "Немає доступних перевізників.";
        return;
      }

      fields.full_name.input.value = driver.full_name;
      fields.phone.input.value = driver.phone;
      fields.license_number.input.value = driver.license_number;
      fields.company_id.input.replaceChildren();
      companies.forEach((company) => {
        const option = document.createElement("option");
        option.value = String(company.id);
        option.textContent = company.name;
        option.selected = company.id === driver.company_id;
        fields.company_id.input.append(option);
      });
      submit.disabled = false;
    } catch (error) {
      if (error?.name === "AbortError") return;
      message.textContent =
        error?.status === 404
          ? "Запис не знайдено."
          : error?.message || "Не вдалося завантажити дані.";
      submit.disabled = true;
    }
  }

  fieldConfigs.forEach((fieldConfig) => {
    const field = fields[fieldConfig.name];
    field.input.addEventListener("blur", () => {
      setFieldError(field.input, field.errorElement, validate(fieldConfig.name, field.input.value));
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    message.textContent = "";
    let firstInvalid = null;
    fieldConfigs.forEach((fieldConfig) => {
      const field = fields[fieldConfig.name];
      const error = validate(fieldConfig.name, field.input.value);
      setFieldError(field.input, field.errorElement, error);
      if (error && !firstInvalid) firstInvalid = field.input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    submitting = true;
    submit.disabled = true;
    submit.textContent = "Збереження...";
    const payload = {
      full_name: fields.full_name.input.value.trim(),
      phone: fields.phone.input.value.trim(),
      license_number: fields.license_number.input.value.trim(),
      company_id: Number(fields.company_id.input.value),
    };
    try {
      await apiRequest(`/drivers/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      window.location.hash = `/drivers/${id}`;
    } catch (error) {
      submitting = false;
      submit.disabled = false;
      submit.textContent = "Зберегти зміни";
      if (error?.status === 422 && Array.isArray(error.detail)) {
        let general = false;
        error.detail.forEach((item) => {
          const name = serverFieldName(item.loc);
          if (fields[name]) {
            setFieldError(fields[name].input, fields[name].errorElement, item.msg || "Некоректне значення.");
          } else {
            general = true;
          }
        });
        if (general) message.textContent = "Сервер відхилив дані. Перевірте введені поля.";
        const first = fieldConfigs
          .map((fieldConfig) => fields[fieldConfig.name])
          .find((field) => field.input.getAttribute("aria-invalid") === "true");
        first?.input.focus();
      } else if (error?.code === "TIMEOUT") {
        message.className = "form-message form-message-warning";
        message.textContent =
          "Результат мутації не підтверджено. Актуалізуйте дані перед повторною дією.";
        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.className = "button button-secondary";
        refresh.textContent = "Актуалізувати дані";
        refresh.addEventListener("click", () => {
          window.location.hash = getEditBackHref().slice(1);
        });
        message.append(refresh);
      } else {
        message.textContent =
          typeof error?.detail === "string"
            ? error.detail
            : error?.message || "Не вдалося зберегти зміни.";
      }
    }
  });

  load();
  return () => controller.abort();
}

function getEditBackHref() {
  return sessionStorage.getItem("drivers-list-state")
    ? `#/drivers?${sessionStorage.getItem("drivers-list-state")}`
    : "#/drivers";
}

async function createCompanyDependentPage(container, config) {
  const temporary = document.createElement("div");
  container.append(createBreadcrumb(config.entityLabel, config.listHref));
  container.append(pageHeader(config.title, config.description));
  container.append(stateBlock("Завантаження перевізників...", ""));

  const result = await loadCompanies(container, config);
  container.replaceChildren();
  container.append(createBreadcrumb(config.entityLabel, config.listHref));
  container.append(pageHeader(config.title, config.description));

  if (result.error) {
    const block = stateBlock(result.error.message || "Не вдалося завантажити перевізників.", "error");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-secondary";
    retry.textContent = "Повторити";
    retry.addEventListener("click", () => createCompanyDependentPage(container, config));
    block.append(retry);
    container.append(block);
    return;
  }
  if (result.empty) {
    const block = stateBlock("Спочатку створіть перевізника.");
    const link = document.createElement("a");
    link.className = "button button-primary";
    link.href = "#/companies/new";
    link.textContent = "Створити перевізника";
    block.append(link);
    container.append(block);
    return;
  }

  const originalFields = config.fields;
  config.fields = originalFields.map((field) =>
    field.type === "select"
      ? { ...field, options: result.companies }
      : field
  );

  const card = document.createElement("section");
  card.className = "card form-card";
  const body = document.createElement("div");
  body.className = "card-body";
  const form = document.createElement("form");
  form.noValidate = true;

  const fields = {};
  config.fields.forEach((fieldConfig) => {
    const field = createField(fieldConfig);
    fields[fieldConfig.name] = field;
    if (fieldConfig.type === "select") {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Оберіть перевізника";
      field.input.append(placeholder);
      fieldConfig.options.forEach((company) => {
        const option = document.createElement("option");
        option.value = String(company.id);
        option.textContent = company.name;
        field.input.append(option);
      });
    }
    form.append(field.wrapper);
  });

  const formMessage = document.createElement("div");
  formMessage.className = "form-message";
  formMessage.setAttribute("role", "alert");
  form.append(formMessage);
  const actions = document.createElement("div");
  actions.className = "form-actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "button button-primary";
  submit.textContent = "Створити";
  const cancel = document.createElement("a");
  cancel.className = "button button-secondary";
  cancel.href = config.listHref;
  cancel.textContent = "Скасувати";
  actions.append(submit, cancel);
  form.append(actions);
  body.append(form);
  card.append(body);
  container.append(card);

  let submitting = false;
  let submittedSuccessfully = false;

  config.fields.forEach((fieldConfig) => {
    const field = fields[fieldConfig.name];
    field.input.addEventListener("blur", () => {
      if (submittedSuccessfully) return;
      setFieldError(field.input, field.errorElement, config.validate(fieldConfig.name, field.input.value));
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || submittedSuccessfully) return;
    formMessage.textContent = "";

    let firstInvalid = null;
    config.fields.forEach((fieldConfig) => {
      const field = fields[fieldConfig.name];
      const message = config.validate(fieldConfig.name, field.input.value);
      setFieldError(field.input, field.errorElement, message);
      if (message && !firstInvalid) firstInvalid = field.input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    submitting = true;
    submit.disabled = true;
    submit.textContent = "Створення...";
    const payload = config.payload(Object.fromEntries(
      config.fields.map((fieldConfig) => [fieldConfig.name, fields[fieldConfig.name].input.value]),
    ));

    try {
      const created = await apiRequest(config.path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!created?.id) throw new Error("Сервер не повернув ID створеного запису.");
      submittedSuccessfully = true;
      formMessage.className = "form-message form-message-success";
      formMessage.textContent = "Запис успішно створено.";
      await verifyCompanyDependentCreated(created);
    } catch (error) {
      handleCreateError(error);
    }
  });

  async function verifyCompanyDependentCreated(created) {
    const href = config.detailHref(created);
    try {
      await apiRequest(config.detailApi(created.id));
      window.location.hash = href.slice(1);
    } catch {
      submittedSuccessfully = true;
      submit.disabled = true;
      formMessage.className = "form-message form-message-warning";
      formMessage.textContent = "Збережено, але не вдалося оновити дані.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "button button-secondary";
      retry.textContent = "Повторити GET";
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        try {
          await apiRequest(config.detailApi(created.id));
          window.location.hash = href.slice(1);
        } catch {
          retry.disabled = false;
          formMessage.textContent = "Збережено, але не вдалося оновити дані.";
        }
      });
      formMessage.append(retry);
    }
  }

  function handleCreateError(error) {
    submitting = false;
    submit.disabled = false;
    submit.textContent = "Створити";
    if (error?.status === 422 && Array.isArray(error.detail)) {
      let general = false;
      error.detail.forEach((item) => {
        const name = serverFieldName(item.loc);
        if (fields[name]) {
          setFieldError(fields[name].input, fields[name].errorElement, item.msg || "Некоректне значення.");
        } else {
          general = true;
        }
      });
      formMessage.textContent = general
        ? "Сервер відхилив дані. Перевірте введені поля."
        : "";
      const first = config.fields
        .map((fieldConfig) => fields[fieldConfig.name])
        .find((field) => field.input.getAttribute("aria-invalid") === "true");
      first?.input.focus();
    } else if (error?.code === "TIMEOUT") {
      formMessage.className = "form-message form-message-warning";
      formMessage.textContent =
        "Результат мутації не підтверджено. Актуалізуйте дані перед повторною дією.";
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "button button-secondary";
      refresh.textContent = "Актуалізувати дані";
      refresh.addEventListener("click", () => {
        window.location.hash = config.listHref.slice(1);
      });
      formMessage.append(refresh);
    } else {
      formMessage.textContent =
        typeof error?.detail === "string"
          ? error.detail
          : error?.message || "Не вдалося створити запис.";
    }
  }
}
