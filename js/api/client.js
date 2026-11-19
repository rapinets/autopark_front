export const API_BASE_URL = "https://autopark-back.onrender.com";
export const API_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, status = 0, detail = null, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

export async function apiRequest(path, options = {}) {
  const externalSignal = options.signal;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort("timeout"), API_TIMEOUT_MS);
  let response;

  const abortFromExternal = () => timeoutController.abort("navigation");
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException("Aborted", "AbortError");
    }
    externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: timeoutController.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternal);
    if (externalSignal?.aborted) {
      throw error;
    }
    if (timeoutController.signal.aborted) {
      throw new ApiError(
        "Час очікування відповіді API минув. Результат може бути невизначеним.",
        0,
        null,
        "TIMEOUT",
      );
    }
    throw new ApiError("Не вдалося підключитися до API. Перевірте мережу або налаштування CORS.");
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.status >= 500) {
        throw new ApiError("Сервер тимчасово недоступний. Спробуйте пізніше.", response.status);
      }
      throw new ApiError("Сервер повернув некоректну відповідь.", response.status);
    }
  }

  if (!response.ok) {
    const detail = data && data.detail;
    let message;

    if (response.status === 409) {
      if (typeof detail === "string" && detail.trim()) {
        message = detail;
      } else if (Array.isArray(detail) && detail.length) {
        message = detail.map((item) => item?.msg).filter(Boolean).join("; ") || "Порушено цілісність даних";
      } else {
        message = "Порушено цілісність даних";
      }
    } else if (response.status >= 500) {
      message = "Сервер тимчасово недоступний. Спробуйте пізніше.";
    } else if (Array.isArray(detail)) {
      message = detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .join("; ");
    } else if (typeof detail === "string") {
      message = detail;
    } else {
      message = "Запит не виконано.";
    }

    throw new ApiError(message, response.status, detail);
  }

  return data;
}
