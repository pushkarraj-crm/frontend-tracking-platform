import { parseJson } from "./network-fields";
import { useState, type ReactNode } from "react";
import { api, send, type Row } from "./api";
import { useData } from "./hooks";
import { useToast } from "./context";
import { Panel, Table, Fields, ErrorBox, Loading, type Field } from "./ui";

export function Action({
  children,
  run,
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  return (
    <>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await run();
          } catch (e) {
            setError(e as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working..." : children}
      </button>
      {error && <ErrorBox error={error} />}
    </>
  );
}
export function Result({ value }: { value: unknown }) {
  return (
    <pre className="network-result" aria-live="polite">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
export function ResourceRows({
  path,
  version = 0,
  actions,
  columns,
  renderers = {},
}: {
  path: string | null;
  version?: number;
  actions?: (r: Row) => ReactNode;
  columns?: string[];
  renderers?: Record<string, (row: Row) => ReactNode>;
}) {
  const [offset, setOffset] = useState(0);
  const paginated = Boolean(
    path &&
    /^\/(notifications|callbacks|callback-deliveries|smart-links|postback-receipts|tools\/automation-logs)(?:\?|$)/.test(
      path,
    ),
  );
  const result = useData<Row[]>(
    path
      ? paginated
        ? `${path}${path.includes("?") ? "&" : "?"}offset=${offset}&limit=50`
        : path
      : null,
    version,
  );
  if (result.error) return <ErrorBox error={result.error} />;
  if (result.loading) return <Loading />;
  const rows = result.data || [],
    keys =
      columns ||
      Object.keys(rows[0] || {})
        .filter(
          (k) =>
            ![
              "workspace_id",
              "credentials",
              "configuration",
              "pricing_snapshot",
            ].includes(k),
        )
        .slice(0, 7);
  return (
    <Table
      rows={rows}
      offset={paginated ? offset : undefined}
      setOffset={paginated ? setOffset : undefined}
      hasNext={rows.length === 50}
      columns={[
        ...keys.map((key) => ({
          key,
          title: key.replaceAll("_", " "),
          render:
            renderers[key] ||
            ((r: Row) =>
              r[key] == null
                ? "—"
                : typeof r[key] === "object"
                  ? JSON.stringify(r[key])
                  : String(r[key] ?? "—")),
        })),
        ...(actions
          ? [{ key: "actions", title: "Actions", render: actions }]
          : []),
      ]}
    />
  );
}
export function ResourceEditor({
  path,
  title,
  fields,
  jsonFields = [],
  readOnly = false,
  initial,
  columns,
  renderers,
  editable = false,
}: {
  path: string;
  title: string;
  fields: Field[];
  jsonFields?: string[];
  readOnly?: boolean;
  initial?: Row;
  columns?: string[];
  renderers?: Record<string, (row: Row) => ReactNode>;
  editable?: boolean;
}) {
  const [version, setVersion] = useState(0),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Row | null>(null);
  const toast = useToast();
  return (
    <Panel
      title={title}
      actions={
        !readOnly && (
          <button
            className="button primary"
            onClick={() => {
              setOpen(!open);
              setEditing(null);
            }}
          >
            {open ? "Close form" : "Add " + title.toLowerCase()}
          </button>
        )
      }
    >
      {open && (
        <div className="network-form">
          <Fields
            fields={fields}
            key={editing?.id || "new"}
            initial={editing || initial}
            submit={editing ? "Save changes" : "Create"}
            onSubmit={async (body) => {
              await send(
                editing ? `${path}/${editing.id}` : path,
                parseJson(body, jsonFields),
                editing ? "PUT" : "POST",
              );
              setVersion((v) => v + 1);
              setOpen(false);
              setEditing(null);
              toast("Saved successfully");
            }}
          />
        </div>
      )}
      <ResourceRows
        path={path}
        version={version}
        columns={columns}
        renderers={renderers}
        actions={
          readOnly
            ? undefined
            : (r) =>
                typeof r.active === "boolean" ? (
                  <>
                    <button
                      className="button secondary"
                      hidden={!editable && !path.endsWith("/events")}
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <Action
                      run={async () => {
                        const event = path.endsWith("/events");
                        const body = event
                          ? Object.fromEntries(
                              fields
                                .map((f) => [f.name, r[f.name]])
                                .filter(
                                  ([, v]) => v !== null && v !== undefined,
                                ),
                            )
                          : { active: !r.active };
                        body.active = !r.active;
                        await send(
                          `${path}/${r.id}`,
                          body,
                          event ? "PUT" : "PATCH",
                        );
                        setVersion((v) => v + 1);
                      }}
                    >
                      {r.active ? "Disable" : "Enable"}
                    </Action>
                  </>
                ) : null
        }
      />
    </Panel>
  );
}
export function RequestForm({
  title,
  path,
  fields,
  method = "POST",
  transform,
  initial,
  successMessage,
}: {
  title: string;
  path: string;
  fields: Field[];
  method?: string;
  transform?: (b: Row) => Row;
  initial?: Row;
  successMessage?: string;
}) {
  const [result, setResult] = useState<unknown>(null);
  return (
    <Panel title={title}>
      <div className="network-form">
        <Fields
          fields={fields}
          initial={initial}
          onSubmit={async (b) => {
            setResult(null);
            setResult(
              await api(path, {
                method,
                body: JSON.stringify(transform ? transform(b) : b),
              }),
            );
          }}
        />
        {result !== null &&
          (successMessage ? (
            <p role="status" className="notice">
              {successMessage}
            </p>
          ) : (
            <Result value={result} />
          ))}
      </div>
    </Panel>
  );
}
