import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, send, type Row } from "./api";
import { useCatalog, useData } from "./hooks";
import { useSession, staff } from "./context";
import {
  PageHead,
  Panel,
  Fields,
  ErrorBox,
  Loading,
  Secret,
  type Field,
} from "./ui";
import { Action, ResourceRows, RequestForm, Result } from "./network-ui";
import { text, select, json, parseJson, parseCsv } from "./network-fields";
export function NetworkOperations() {
  const { user } = useSession(),
    [params, setParams] = useSearchParams(),
    tab = params.get("tab") || "inbox";
  const tabs = [
    "inbox",
    "saved-reports",
    "api-keys",
    "integrations",
    ...(user.role === "admin" ? ["branding", "employees"] : []),
  ];
  return (
    <>
      <PageHead
        title="Network settings"
        description="Notifications, reporting preferences and account integrations."
      />
      <nav className="network-tabs" aria-label="Network settings">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "button primary" : "button secondary"}
            onClick={() => setParams({ tab: t })}
          >
            {t.replaceAll("-", " ")}
          </button>
        ))}
      </nav>
      {tab === "inbox" && <Inbox />}
      {tab === "saved-reports" && <SavedReports />}
      {tab === "api-keys" && <ApiKeys />}
      {tab === "integrations" && <Integrations />}
      {tab === "branding" && user.role === "admin" && <Branding />}
      {tab === "employees" && user.role === "admin" && <Employees />}
    </>
  );
}
function Inbox() {
  const [version, setVersion] = useState(0);
  return (
    <Panel
      title="Your notifications"
      actions={
        <Action
          run={async () => {
            await send("/notifications/read-all", {});
            setVersion((v) => v + 1);
          }}
        >
          Mark all read
        </Action>
      }
    >
      <ResourceRows
        path="/notifications"
        version={version}
        columns={["title", "message", "created_at", "read_at"]}
        actions={(r) =>
          !r.read_at && (
            <Action
              run={async () => {
                await send(`/notifications/${r.id}/read`, {});
                setVersion((v) => v + 1);
              }}
            >
              Mark read
            </Action>
          )
        }
      />
    </Panel>
  );
}
function SavedReports() {
  const [version, setVersion] = useState(0),
    [result, setResult] = useState<unknown>(null);
  return (
    <>
      <RequestForm
        title="Save a report"
        path="/report-templates"
        fields={[
          text("name", "Report name"),
          select(
            "dataset",
            "Dataset",
            ["grouped", "clicks", "conversions", "impressions"],
            { defaultValue: "grouped" },
          ),
          select(
            "group_by",
            "Group by",
            [
              "offer",
              "affiliate",
              "country",
              "sub_id",
              "source",
              "event",
              "device",
              "day",
              "hour",
            ],
            { defaultValue: "offer" },
          ),
          text("lookback_days", "Lookback days", {
            type: "number",
            min: 1,
            max: 366,
            defaultValue: 7,
          }),
          json(
            "filters",
            "Optional filters",
            {},
            "Campaign offer_id, affiliate_id, country, sub_id, source, status, event_key, aff_sub1 through aff_sub10. Omit fixed start/end dates.",
          ),
        ]}
        transform={(b) => parseJson(b, ["filters"])}
      />
      <Panel
        title="Saved reports"
        actions={
          <button
            className="button secondary"
            onClick={() => setVersion((v) => v + 1)}
          >
            Refresh
          </button>
        }
      >
        <ResourceRows
          path="/report-templates"
          version={version}
          columns={["name", "dataset", "lookback_days", "group_by"]}
          actions={(r) => (
            <>
              <Action
                run={async () =>
                  setResult(await api(`/report-templates/${r.id}/run`))
                }
              >
                Run
              </Action>
              <Action
                run={async () => {
                  await api(`/report-templates/${r.id}`, { method: "DELETE" });
                  setVersion((v) => v + 1);
                }}
              >
                Delete
              </Action>
            </>
          )}
        />
        {result !== null && <Result value={result} />}
      </Panel>
    </>
  );
}
function ApiKeys() {
  const { user } = useSession(),
    [version, setVersion] = useState(0),
    [secret, setSecret] = useState("");
  const users = useCatalog(user.role === "admin" ? "/users" : null);
  return (
    <>
      {user.role === "admin" && (
        <Panel title="Allow partner API access">
          <div className="network-form">
            <Fields
              fields={[
                {
                  name: "user_id",
                  label: "Account",
                  options: users.data.map((u) => ({
                    value: u.id,
                    label: u.email,
                  })),
                  source: users,
                },
                text("enabled", "API access enabled", {
                  type: "checkbox",
                  required: false,
                }),
              ]}
              onSubmit={async (b) => {
                await send(
                  `/users/${b.user_id}/api-access`,
                  { enabled: b.enabled },
                  "PUT",
                );
                setVersion((v) => v + 1);
              }}
            />
          </div>
        </Panel>
      )}
      <Panel
        title="Create an API key"
        subtitle="An admin must enable API access first. The secret is shown only once."
      >
        <div className="network-form">
          <Fields
            fields={[
              text("name", "Key name"),
              ...(user.role === "admin"
                ? [
                    {
                      name: "user_id",
                      label: "Account",
                      options: users.data.map((u) => ({
                        value: u.id,
                        label: u.email,
                      })),
                      source: users,
                    },
                  ]
                : []),
              json(
                "scopes",
                "Allowed scopes",
                ["reports:read"],
                "campaigns:read, campaigns:apply, reports:read, conversions:read, links:write, invoices:read",
              ),
              text("expires_in_days", "Expires in days", {
                type: "number",
                defaultValue: 90,
                min: 1,
                max: 365,
              }),
            ]}
            onSubmit={async (b) => {
              const key = await send<Row>(
                "/api-keys",
                parseJson(b, ["scopes"]),
              );
              setSecret(key.key);
              setVersion((v) => v + 1);
            }}
          />
        </div>
        {secret && <Secret title="API key - store securely" value={secret} />}
      </Panel>
      <Panel title="Issued API keys">
        <ResourceRows
          path="/api-keys"
          version={version}
          columns={[
            "name",
            "prefix",
            "scopes",
            "active",
            "expires_at",
            "last_used_at",
          ]}
          actions={(r) =>
            r.active && (
              <Action
                run={async () => {
                  await api(`/api-keys/${r.id}`, { method: "DELETE" });
                  setVersion((v) => v + 1);
                }}
              >
                Revoke
              </Action>
            )
          }
        />
      </Panel>
    </>
  );
}
function Integrations() {
  const catalog = useData<Row[]>("/integrations/catalog"),
    [provider, setProvider] = useState("");
  const spec = catalog.data?.find((p) => p.provider === provider);
  return (
    <>
      <Panel
        title="Provider setup"
        subtitle="Configuration drafts only. No live provider delivery is enabled."
      >
        <div className="network-form">
          <label>
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="">Select provider</option>
              {catalog.data?.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {catalog.error && <ErrorBox error={catalog.error} />}
        </div>
      </Panel>
      {spec && <ProviderForm key={provider} spec={spec} />}
      <Panel title="Your saved integration drafts">
        <ResourceRows
          path="/integrations"
          columns={[
            "provider",
            "status",
            "active",
            "credential_fields_present",
            "missing_credentials",
            "updated_at",
          ]}
        />
      </Panel>
    </>
  );
}
function ProviderForm({ spec }: { spec: Row }) {
  const saved = useData<Row[]>("/integrations"),
    [result, setResult] = useState<unknown>(null);
  if (saved.loading) return <Loading />;
  if (saved.error) return <ErrorBox error={saved.error} />;
  const draft = saved.data?.find((d) => d.provider === spec.provider);
  const fields: Field[] = [
    ...spec.fields.map((n: string) =>
      text(n, n.replaceAll("_", " "), { required: false }),
    ),
    ...spec.secrets.map((n: string) =>
      text(`secret_${n}`, n.replaceAll("_", " "), {
        type: "password",
        required: false,
        help: "Leave every credential empty to keep existing credentials. Entering credentials replaces the credential set.",
      }),
    ),
  ];
  return (
    <Panel
      title={spec.name + " setup draft"}
      subtitle="Credentials are encrypted and never returned. Setup does not activate provider delivery."
    >
      <div className="network-form">
        <Fields
          fields={fields}
          initial={draft?.configuration}
          submit="Save draft"
          onSubmit={async (b) => {
            const configuration = Object.fromEntries(
                spec.fields
                  .filter((n: string) => b[n] !== undefined)
                  .map((n: string) => [n, String(b[n])]),
              ),
              secrets = Object.fromEntries(
                spec.secrets
                  .filter((n: string) => b[`secret_${n}`])
                  .map((n: string) => [n, b[`secret_${n}`]]),
              );
            setResult(
              await send(
                `/integrations/${spec.provider}`,
                {
                  configuration,
                  ...(Object.keys(secrets).length ? { secrets } : {}),
                },
                "PUT",
              ),
            );
          }}
        />
        {result !== null && <Result value={result} />}
        <p>{spec.setup_note}</p>
        <p>
          <a href={spec.guide} target="_blank" rel="noopener noreferrer">
            Provider reference and setup guide
          </a>
        </p>
        <h3>Setup checklist</h3>
        <ol>
          <li>
            Create a test account in {spec.name} and locate the identifiers
            listed above.
          </li>
          <li>
            Save public configuration now. Keep credentials on the server; never
            place them in tracking URLs.
          </li>
          <li>
            Configure your advertiser's HTTPS domain and conversion event
            mapping.
          </li>
          <li>
            When credentials are available, verify the provider adapter in its
            test environment before enabling delivery. This release does not
            include a live adapter.
          </li>
        </ol>
        <p>
          For direct advertiser S2S tracking, use the existing S2S postback API
          instead.
        </p>
      </div>
    </Panel>
  );
}
function Branding() {
  const result = useData<Row>("/branding");
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorBox error={result.error} />;
  return (
    <RequestForm
      title="Network branding"
      method="PUT"
      path="/branding"
      initial={result.data!}
      fields={[
        text("network_name", "Network name"),
        text("accent_color", "Accent colour", { type: "color" }),
        text("logo_url", "HTTPS logo URL", {
          type: "url",
          required: false,
          help: "This deployment displays logos hosted on the frontend origin. External logo configuration is stored for a future narrowly approved image host.",
        }),
        text("support_email", "Support email", {
          type: "email",
          required: false,
        }),
        text("timezone", "Reporting timezone", { defaultValue: "UTC" }),
        text("terms_url", "Terms URL", { type: "url", required: false }),
        text("privacy_url", "Privacy URL", { type: "url", required: false }),
      ]}
    />
  );
}
function Employees() {
  const users = useCatalog("/users"),
    permissions = useData<Row>("/employee-permissions");
  const [result, setResult] = useState<unknown>(null);
  return (
    <Panel
      title="Employee permissions"
      subtitle="Permissions restrict staff accounts; they never grant administrator access."
    >
      <div className="network-form">
        <Fields
          fields={[
            {
              name: "user_id",
              label: "Staff account",
              options: users.data
                .filter((u) => u.role === "staff")
                .map((u) => ({ value: u.id, label: u.email })),
              source: users,
            },
            json(
              "permissions",
              "Allowed permissions",
              [],
              "An empty list denies all management modules. Use only the available permissions below. Use null to restore the original staff role access.",
            ),
          ]}
          onSubmit={async (b) => {
            const parsed = parseJson(b, ["permissions"]);
            setResult(
              await send(
                `/users/${b.user_id}/permissions`,
                { permissions: parsed.permissions },
                "PUT",
              ),
            );
          }}
        />
        {permissions.data && (
          <p>Available: {permissions.data.permissions.join(", ")}</p>
        )}
        {permissions.error && <ErrorBox error={permissions.error} />}{" "}
        {result !== null && <Result value={result} />}
      </div>
    </Panel>
  );
}
export function NetworkTools() {
  const { user } = useSession(),
    manage = staff(user.role) || user.role === "advertiser",
    [params, setParams] = useSearchParams(),
    tab = params.get("tab") || (manage ? "imports" : "smart-links");
  const tabs = manage
    ? [
        "imports",
        "mis-upload",
        "bulk-review",
        "link-health",
        "automation",
        ...(staff(user.role) ? ["smart-links"] : []),
      ]
    : ["smart-links"];
  return (
    <>
      <PageHead
        title="Network tools"
        description="Preview imports, review conversions and manage traffic automation."
      />
      <nav className="network-tabs" aria-label="Tools">
        {tabs.map((t) => (
          <button
            className={t === tab ? "button primary" : "button secondary"}
            key={t}
            onClick={() => setParams({ tab: t })}
          >
            {t.replaceAll("-", " ")}
          </button>
        ))}
      </nav>
      {tab === "imports" && manage && (
        <RequestForm
          title="Import campaigns"
          path="/tools/import-campaigns"
          fields={[
            jsonCsv,
            text("dry_run", "Preview only", {
              type: "checkbox",
              defaultValue: true,
              required: false,
            }),
          ]}
        />
      )}
      {tab === "bulk-review" && manage && (
        <RequestForm
          title="Review conversions together"
          path="/tools/conversions/status"
          fields={[
            json(
              "conversion_ids",
              "Conversion IDs",
              [],
              "Up to 100 conversion IDs. All changes succeed together, or none are saved. Invoiced conversions are protected.",
            ),
            select("status", "Status", ["approved", "rejected"]),
          ]}
          transform={(b) => parseJson(b, ["conversion_ids"])}
        />
      )}
      {tab === "mis-upload" && manage && <MisUpload />}
      {tab === "link-health" && manage && <CampaignHealth />}
      {tab === "automation" && manage && <Automations />}
      {tab === "smart-links" && <SmartLinks />}
    </>
  );
}
const jsonCsv: Field = text("csv_content", "Campaign CSV", {
  type: "textarea",
  full: true,
  help: "Header: name,destination_url,revenue,payout,campaign_model. Network admins also supply advertiser_id. Up to 100 rows. Preview before unchecking Preview only.",
});
export function MisUpload() {
  const campaigns = useCatalog("/campaigns"),
    [id, setId] = useState(""),
    events = useData<Row[]>(id ? `/campaigns/${id}/events` : null),
    [content, setContent] = useState(""),
    [columns, setColumns] = useState<Record<string, string>>({}),
    [statuses, setStatuses] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<Row | null>(null),
    [result, setResult] = useState<Row | null>(null),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  const rows = parseCsv(content),
    headers = rows[0] || [],
    statusIndex = headers.indexOf(columns.status_column || ""),
    values =
      statusIndex < 0
        ? []
        : [...new Set(rows.slice(1).map((r) => (r[statusIndex] || "").trim()))]
            .filter(Boolean)
            .slice(0, 50),
    stages = [
      { code: "initial", name: "Lead" },
      ...(events.data || []).map((e) => ({ code: e.code, name: e.name })),
    ];
  const reset = () => (setPreview(null), setResult(null), setError(null));
  async function submit(dry_run: boolean) {
    reset();
    setBusy(true);
    try {
      const mapped = Object.fromEntries(
        Object.entries(statuses)
          .filter(([, v]) => v)
          .map(([k, v]) => {
            const [event_key, status] = v.split("|");
            return [k, status ? { event_key, status } : { event_key }];
          }),
      );
      const response = await api<Row>("/tools/conversions/import", {
        method: "POST",
        body: JSON.stringify({
          campaign_id: id,
          csv_content: content,
          ...Object.fromEntries(Object.entries(columns).filter(([, v]) => v)),
          statuses: mapped,
          dry_run,
        }),
      });
      if (dry_run) setPreview(response);
      else setResult(response);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  const column = (name: string, label: string, required: boolean) => (
    <label key={name}>
      {label}
      <select
        value={columns[name] || ""}
        required={required}
        onChange={(e) => {
          reset();
          setColumns({ ...columns, [name]: e.target.value });
        }}
      >
        <option value="">{required ? "Select column" : "Not in file"}</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
  const ready =
    id &&
    columns.reference_column &&
    columns.status_column &&
    Object.values(statuses).some(Boolean);
  return (
    <Panel
      title="Upload advertiser MIS"
      subtitle="Apply a bank or advertiser status report (CSV). Rows match our click ID when the file has it, otherwise the advertiser reference of an earlier conversion. Preview first; nothing is saved until you import."
    >
      <div className="network-form">
        <label>
          Campaign
          <select
            value={id}
            onChange={(e) => {
              reset();
              setId(e.target.value);
              setStatuses({});
            }}
          >
            <option value="">Select campaign</option>
            {campaigns.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          MIS file (CSV; save Excel sheets as CSV)
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              reset();
              setColumns({});
              setStatuses({});
              setContent((await e.target.files?.[0]?.text()) || "");
            }}
          />
        </label>
        {headers.length > 0 && (
          <>
            {column("reference_column", "Advertiser reference column", true)}
            {column("status_column", "Status column", true)}
            {column("click_id_column", "Our click ID column", false)}
            {column("amount_column", "Sale amount column (CPS only)", false)}
          </>
        )}
        {values.map((v) => (
          <label key={v}>
            Status “{v}” means
            <select
              value={statuses[v] || ""}
              onChange={(e) => {
                reset();
                setStatuses({ ...statuses, [v]: e.target.value });
              }}
            >
              <option value="">Ignore these rows</option>
              {stages.flatMap((s) => [
                <option key={`${s.code}|approved`} value={`${s.code}|approved`}>
                  {s.name}: approved
                </option>,
                <option key={`${s.code}|rejected`} value={`${s.code}|rejected`}>
                  {s.name}: rejected
                </option>,
                <option key={`${s.code}|`} value={`${s.code}|`}>
                  {s.name}: record for review
                </option>,
              ])}
            </select>
          </label>
        ))}
      </div>
      <div className="network-form row-actions">
        <button
          className="button secondary"
          disabled={!ready || busy}
          onClick={() => submit(true)}
        >
          Preview
        </button>
        <button
          className="button primary"
          disabled={!preview?.can_import || busy}
          onClick={() => submit(false)}
        >
          Import
        </button>
      </div>
      {error && <ErrorBox error={error} />}
      {(result || preview) && <Result value={result || preview} />}
    </Panel>
  );
}
function CampaignHealth() {
  const campaigns = useCatalog("/campaigns"),
    [id, setId] = useState("");
  return (
    <>
      <Panel
        title="Landing URL health"
        subtitle="Checks public HTTPS redirects without recording traffic. This cannot certify advertising platform approval."
      >
        <div className="network-form">
          <label>
            Campaign
            <select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Select campaign</option>
              {campaigns.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>
      {id && (
        <RequestForm
          title="Check campaign landing URL"
          path={`/tools/campaigns/${id}/link-health`}
          fields={[]}
        />
      )}
    </>
  );
}
function Automations() {
  const [version, setVersion] = useState(0);
  const campaigns = useCatalog("/campaigns");
  return (
    <>
      <RequestForm
        title="Campaign automation rule"
        path="/tools/automation"
        fields={[
          text("name", "Rule name"),
          {
            name: "offer_id",
            label: "Campaign",
            options: campaigns.data.map((c) => ({
              value: c.id,
              label: c.name,
            })),
            source: campaigns,
          },
          select(
            "metric",
            "Metric",
            ["clicks", "approved_conversions", "conversion_rate"],
            { defaultValue: "conversion_rate" },
          ),
          select("comparison", "Comparison", ["lt", "gt"]),
          text("threshold", "Threshold", {
            type: "number",
            step: "0.0001",
            min: 0,
          }),
          text("minimum_clicks", "Minimum clicks", {
            type: "number",
            min: 1,
            defaultValue: 100,
          }),
          text("lookback_hours", "Lookback hours", {
            type: "number",
            min: 1,
            max: 168,
            defaultValue: 24,
          }),
          text("cooldown_hours", "Cooldown hours", {
            type: "number",
            min: 1,
            max: 168,
            defaultValue: 24,
          }),
          select("action", "Action", ["notify", "pause"], {
            defaultValue: "notify",
          }),
        ]}
      />
      <Panel title="Automation rules">
        <ResourceRows
          path="/tools/automation"
          version={version}
          actions={(r) => (
            <Action
              run={async () => {
                await send(
                  `/tools/automation/${r.id}`,
                  { active: !r.active },
                  "PATCH",
                );
                setVersion((v) => v + 1);
              }}
            >
              {r.active ? "Disable" : "Enable"}
            </Action>
          )}
        />
      </Panel>
      <Panel title="Automation history">
        <ResourceRows path="/tools/automation-logs" />
      </Panel>
    </>
  );
}
function SmartLinks() {
  const [version, setVersion] = useState(0);
  return (
    <>
      <RequestForm
        title="Create weighted smart link"
        path="/smart-links"
        fields={[
          text("name", "Smart link name"),
          text("publisher_id", "Publisher ID", {
            required: false,
            help: "Leave empty to use your publisher account.",
          }),
          json(
            "children",
            "Approved child links",
            [],
            'At least two links for one publisher and advertiser. Example: [{"link_id":"...","weight":1},{"link_id":"...","weight":2}]. Targeting and caps are enforced for every click.',
          ),
        ]}
        transform={(b) => parseJson(b, ["children"])}
      />
      <Panel title="Your smart links">
        <ResourceRows
          path="/smart-links"
          version={version}
          actions={(r) => (
            <Action
              run={async () => {
                await send(
                  `/smart-links/${r.id}`,
                  { active: !r.active },
                  "PATCH",
                );
                setVersion((v) => v + 1);
              }}
            >
              {r.active ? "Disable" : "Enable"}
            </Action>
          )}
        />
      </Panel>
    </>
  );
}
