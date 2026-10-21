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
