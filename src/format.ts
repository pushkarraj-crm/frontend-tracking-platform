export function money(value: unknown, currency = "USD") {
  const numeric = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 4,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
}
export function date(value: unknown) {
  return value
    ? new Date(String(value)).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}
export function short(value: unknown) {
  return value ? String(value).slice(0, 8) : "—";
}
