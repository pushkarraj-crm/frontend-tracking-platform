import { conditionOperators as operators } from "./network-fields";
import { useRef, useState } from "react";

const fields = [
  "country",
  "device",
  "operating_system",
  "language",
  "source",
  "sub_id",
  "sub_aff_id",
  "aff_click_id",
  "event",
  "publisher_id",
  "sale_amount",
  "ctit",
  "weekday",
  ...Array.from({ length: 10 }, (_, i) => `aff_sub${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `adv_sub${i + 1}`),
];

type Condition = { field: string; operator: string; value: string | string[] };
type Entry = Condition & { id: number };
export function ConditionBuilder({
  name,
  initial,
}: {
  name: string;
  initial?: unknown;
}) {
  const parsed = (
    typeof initial === "string" ? JSON.parse(initial) : initial
  ) as { all?: Condition[] } | undefined;
  const [rows, setRows] = useState<Entry[]>(() =>
    (parsed?.all || []).map((row: Condition, id: number) => ({ ...row, id })),
  );
  const next = useRef(rows.length);
  const update = (id: number, patch: Partial<Condition>) =>
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  return (
    <div className="condition-builder">
      <p>
        All conditions must match. With no conditions, this rule matches all
        traffic.
      </p>
      <input
        type="hidden"
        name={name}
        value={JSON.stringify({
          all: rows.map(({ field, operator, value }) => ({
            field,
            operator,
            value,
          })),
        })}
      />
      {rows.map((row, index) => {
        const multiple = ["in", "not_in", "between"].includes(row.operator);
        const empty = ["is_empty", "not_empty"].includes(row.operator);
        return (
          <fieldset className="condition-row" key={row.id}>
            <legend>Condition {index + 1}</legend>
            <label>
              Field
              <select
                aria-label="Field"
                value={row.field}
                onChange={(e) => update(row.id, { field: e.target.value })}
              >
                {fields.map((field) => (
                  <option key={field} value={field}>
                    {field.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comparison
              <select
                aria-label="Comparison"
                value={row.operator}
                onChange={(e) => {
                  const operator = e.target.value;
                  update(row.id, {
                    operator,
                    value: ["in", "not_in", "between"].includes(operator)
                      ? []
                      : "",
                  });
                }}
              >
                {Object.entries(operators).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {!empty && (
              <label>
                {multiple ? "Values (comma separated)" : "Value"}
                <input
                  required={!empty}
                  maxLength={multiple ? 12800 : 256}
                  defaultValue={
                    Array.isArray(row.value) ? row.value.join(", ") : row.value
                  }
                  key={row.operator}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const value = multiple
                      ? raw
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean)
                      : raw;
                    e.target.setCustomValidity(
                      row.operator === "between" &&
                        (!Array.isArray(value) || value.length !== 2)
                        ? "Enter two numbers separated by a comma."
                        : "",
                    );
                    update(row.id, { value });
                  }}
                />
                <small>
                  {row.operator === "between"
                    ? "Enter a minimum and maximum, e.g. 10, 100."
                    : row.field === "country"
                      ? "Use uppercase country codes, e.g. IN, US."
                      : row.field === "ctit"
                        ? "Time from click to conversion, in seconds."
                        : "Values are case sensitive."}
                </small>
              </label>
            )}
            <button
              type="button"
              className="button secondary"
              aria-label={`Remove condition ${index + 1}`}
              onClick={() =>
                setRows((previous) => previous.filter((r) => r.id !== row.id))
              }
            >
              Remove
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        className="button secondary"
        disabled={rows.length >= 20}
        onClick={() => {
          const id = next.current++;
          setRows((previous) => [
            ...previous,
            { id, field: "country", operator: "eq", value: "" },
          ]);
        }}
      >
        Add condition
      </button>
    </div>
  );
}
