export function characterLength(value) {
  return Array.from(value).length;
}

export function textError(value, min, max, label) {
  const trimmed = value.trim();
  const length = characterLength(trimmed);
  if (!trimmed) return `Введіть ${label}.`;
  if (length < min) return `Мінімум ${min} символів.`;
  if (length > max) return `Максимум ${max} символів.`;
  return "";
}

export function integerError(value, min, max, label) {
  const text = String(value).trim();
  if (!text) return `Введіть ${label}.`;
  if (!/^[+-]?\d+$/.test(text)) return `${label} має бути цілим числом.`;
  const number = Number(text);
  if (!Number.isSafeInteger(number)) return `${label} має бути цілим числом.`;
  if (number < min || number > max) return `Допустимий діапазон: ${min}–${max}.`;
  return "";
}

export function positiveIdError(value, label) {
  return integerError(value, 1, Number.MAX_SAFE_INTEGER, label);
}
