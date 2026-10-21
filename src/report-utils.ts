import type { Row } from "./api";

export function previousPeriod(params: string) {
  const previous = new URLSearchParams(params);
  const start = new Date(previous.get("start") || "").getTime();
  const end = new Date(previous.get("end") || "").getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return null;
  previous.set("start", new Date(start - (end - start)).toISOString());
  previous.set("end", new Date(start).toISOString());
  return previous;
}
export function comparisonRows(
  current: Row[],
  previous: Row[],
  shiftMilliseconds = 0,
) {
  const rows = new Map<string, Row>();
  const group = (value: string, shift = 0) => {
    if (!shiftMilliseconds) return value;
    const parsed = new Date(
      value.length === 10 || /Z|[+-]\d\d:\d\d$/.test(value)
        ? value
        : value + "Z",
    ).getTime();
    return Number.isFinite(parsed)
      ? new Date(parsed + shift).toISOString()
      : value;
  };
  for (const row of current)
    rows.set(JSON.stringify([group(row.group), row.currency]), {
      id: JSON.stringify([row.group, row.currency]),
      group: row.group,
      currency: row.currency,
      clicks: row.clicks,
      conversions: row.conversions,
      previous_clicks: 0,
      previous_conversions: 0,
    });
  for (const row of previous) {
    const key = JSON.stringify([
      group(row.group, shiftMilliseconds),
      row.currency,
    ]);
    const next = rows.get(key) || {
      id: key,
      group: group(row.group, shiftMilliseconds),
      currency: row.currency,
      clicks: 0,
      conversions: 0,
    };
    rows.set(key, {
      ...next,
      previous_clicks: row.clicks,
      previous_conversions: row.conversions,
    });
  }
  return [...rows.values()];
}
export function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0%" : "New";
  const percent = ((current - previous) / previous) * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}
