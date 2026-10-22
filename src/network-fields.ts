import type { Row } from "./api";
import type { Field } from "./ui";
export const choices = (values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("_", " ") }));
export const text = (
  name: string,
  label: string,
  extra: Partial<Field> = {},
): Field => ({ name, label, ...extra });
export const select = (
  name: string,
  label: string,
  values: string[],
  extra: Partial<Field> = {},
): Field => ({ name, label, options: choices(values), ...extra });
export const json = (
  name: string,
  label: string,
  value: unknown,
  help: string,
): Field =>
  text(name, label, {
    type: "textarea",
    defaultValue: JSON.stringify(value, null, 2),
    help,
    full: true,
  });
export const money = (name: string, label: string): Field =>
  text(name, label, {
    type: "number",
    step: "0.0001",
    min: 0,
    defaultValue: "0",
  });
export function parseJson(body: Row, names: string[]) {
  const result = { ...body };
  for (const name of names)
    if (typeof result[name] === "string") {
      try {
        result[name] = JSON.parse(result[name]);
      } catch {
        throw new Error(`${name.replaceAll("_", " ")}: enter valid JSON`);
      }
    }
  return result;
}

export const conditionOperators: Record<string, string> = {
  eq: "equals",
  ne: "does not equal",
  in: "is one of",
  not_in: "is not one of",
  contains: "contains",
  not_contains: "does not contain",
  is_empty: "is empty",
  not_empty: "is not empty",
  gt: "is greater than",
  lt: "is less than",
  between: "is between",
};
// Quote-aware CSV rows; the server re-parses, so this only drives column and status pickers.
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };
  const text = content.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else cell += c;
  }
  if (cell || row.length) endRow();
  return rows.filter((r) => r.some((v) => v.trim()));
}
