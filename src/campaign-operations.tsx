import {
  CampaignOverview,
  CampaignTargeting,
  CapUsage,
} from "./campaign-workspace";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Row } from "./api";
import { useCatalog, useData } from "./hooks";
import { useSession, staff } from "./context";
import { PageHead, Panel, Loading, ErrorBox, type Field } from "./ui";
import {
  Action,
  ResourceEditor,
  RequestForm,
  ResourceRows,
  Result,
} from "./network-ui";
import {
  text,
  select,
  json,
  money,
  parseJson,
  conditionOperators,
} from "./network-fields";
const conditions = text("conditions", "Conditions", {
  type: "conditions",
  full: true,
});
const name = text("name", "Name");
export function CampaignOperations() {
  const { user } = useSession(),
    [params, setParams] = useSearchParams(),
    campaigns = useCatalog("/campaigns");
  const id = params.get("campaign") || "",
    requestedTab = params.get("tab") || "overview",
    manage =
      user.role === "advertiser" ||
      (staff(user.role) &&
        (user.staff_permissions == null ||
          user.staff_permissions.includes("campaigns:write")));
  const tabs = manage
    ? [
        "overview",
        "profile",
        "targeting",
        "events",
        "commission-rules",
        "caps",
        "destinations",
        "creatives",
        "traffic-rules",
        "assign",
        "url-preview",
      ]
    : ["overview", "profile", "events", "commission-rules", "creatives"];
  const tab = tabs.includes(requestedTab) ? requestedTab : "overview";
  const labels: Record<string, string> = {
    overview: "Overview",
    profile: "General",
    targeting: "Targeting and fraud",
    events: "Events",
    "commission-rules": "Payout rules",
    caps: "Caps",
    destinations: "Landing pages",
    creatives: "Creatives",
    "traffic-rules": "Traffic rules",
    assign: "Publishers",
    "url-preview": "Test destination",
  };
  const campaign = campaigns.data.find((c) => c.id === id);
  const users = useCatalog(manage && id ? "/users" : null);
  const publisher: Field = {
    name: "publisher_id",
    label: "Publisher (optional)",
    required: false,
    options: users.data
      .filter((u) => u.role === "publisher")
      .map((u) => ({ value: u.id, label: u.email })),
    source: users,
  };
  const event = text("event_key", "Event code (optional)", {
    required: false,
    help: "Leave empty for every event. Use initial for the default event.",
  });
  const choose = (key: string, value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    });
  let fields: Field[] = [],
    jsonFields: string[] = [];
  if (tab === "events")
    fields = [
      text("code", "Immutable event code", {
        help: "Lowercase letters, numbers and underscores; e.g. qualified_lead",
      }),
      name,
      select("model", "Pricing", ["CPL", "CPS"], { defaultValue: "CPL" }),
      {
        ...money("payout", "Publisher payout"),
        showWhen: { name: "model", value: "CPL" },
      },
      money("revenue", "Revenue"),
      text("sale_percentage", "Sale percentage (CPS only)", {
        type: "number",
        step: "0.0001",
        required: true,
        showWhen: { name: "model", value: "CPS" },
        min: 0.0001,
        max: 100,
      }),
      text("repeatable", "Allow multiple transactions per click", {
        type: "checkbox",
        required: false,
      }),
      text("auto_approve", "Automatically approve this event", {
        type: "checkbox",
        required: false,
      }),
      text("active", "Active", {
        type: "checkbox",
        defaultValue: true,
        required: false,
      }),
    ];
  if (tab === "commission-rules") {
    fields = [
      name,
      publisher,
      event,
      text("priority", "Priority (lower runs first)", {
        type: "number",
        min: 1,
        defaultValue: 100,
      }),
      select("model", "Pricing", ["CPL", "CPS"], { defaultValue: "CPL" }),
      {
        ...money("payout", "Publisher payout"),
        showWhen: { name: "model", value: "CPL" },
      },
      money("revenue", "Revenue"),
      text("sale_percentage", "CPS percentage", {
        type: "number",
        step: "0.0001",
        min: 0.0001,
        max: 100,
        required: true,
        showWhen: { name: "model", value: "CPS" },
      }),
      conditions,
      text("visible_to_publishers", "Visible to publishers", {
        type: "checkbox",
        defaultValue: true,
        required: false,
      }),
    ];
    jsonFields = ["conditions"];
  }
  if (tab === "caps")
    fields = [
      name,
      publisher,
      event,
      select(
        "metric",
        "Limit",
        ["clicks", "conversions", "revenue", "payout"],
        { defaultValue: "conversions" },
      ),
      select("period", "Period", ["hour", "day", "week", "month", "total"], {
        defaultValue: "day",
      }),
      text("timezone", "Timezone", {
        defaultValue: "UTC",
        help: "IANA timezone, e.g. Asia/Kolkata",
      }),
      text("amount", "Maximum", {
        type: "number",
        min: 0.0001,
        step: "0.0001",
        help: "Counts must be whole numbers. When editing, only the name and maximum can change; create a new cap for a different scope or period.",
      }),
    ];
  if (tab === "destinations") {
    fields = [
      name,
      text("url", "HTTPS landing URL", { type: "url" }),
      text("weight", "Weight", { type: "number", min: 1, defaultValue: 1 }),
      text("countries", "Countries", {
        type: "list",
        uppercase: true,
        required: false,
        help: "Country codes separated by commas, e.g. IN, US. Leave empty for all countries.",
      }),
      {
        ...publisher,
        name: "publisher_ids",
        label: "Restrict to publishers",
        type: "multiselect",
        help: "Leave unselected for all approved publishers. Use Ctrl or Command to select several.",
      },
    ];
    jsonFields = [];
  }
  if (tab === "creatives")
    fields = [
      name,
      select("kind", "Creative type", ["banner", "logo", "text"], {
        defaultValue: "banner",
      }),
      text("url", "HTTPS asset URL", { type: "url" }),
      text("description", "Description", { type: "textarea", required: false }),
    ];
  if (tab === "traffic-rules") {
    fields = [
      name,
      text("priority", "Priority", {
        type: "number",
        defaultValue: 100,
        min: 1,
      }),
      select("phase", "Apply at", ["click", "conversion"], {
        defaultValue: "click",
      }),
      select("action", "Action", ["allow", "reject"], {
        defaultValue: "reject",
        showWhen: { name: "phase", value: "click" },
      }),
      select("action", "Action", ["pending", "approve", "reject"], {
        defaultValue: "reject",
        showWhen: { name: "phase", value: "conversion" },
      }),
      conditions,
    ];
    jsonFields = ["conditions"];
  }
  return (
    <>
      <PageHead
        title={campaign?.name || "Campaign workspace"}
        description="Manage setup, publisher access, traffic quality and payouts in one place."
      />
      <Panel title="Select a campaign">
        <div className="network-form">
          <label>
            Campaign
            <select
              value={id}
              onChange={(e) => choose("campaign", e.target.value)}
            >
              <option value="">Select campaign</option>
              {campaigns.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            disabled={
              (!campaigns.hasMore && !campaigns.error) || campaigns.loading
            }
            onClick={campaigns.loadMore}
          >
            {campaigns.error ? "Retry campaigns" : "Load more campaigns"}
          </button>
          {campaigns.error && <ErrorBox error={campaigns.error} />}
        </div>
      </Panel>
      {id && (
        <>
          <nav className="network-tabs" aria-label="Campaign settings">
            {tabs.map((t) => (
              <button
                className={tab === t ? "button primary" : "button secondary"}
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => choose("tab", t)}
              >
                {labels[t]}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <CampaignOverview
              key={id}
              id={id}
              manage={manage}
              choose={(tab) => choose("tab", tab)}
            />
          )}
          {tab === "targeting" && manage && (
            <CampaignTargeting key={id} id={id} />
          )}
          {tab === "profile" && <Profile key={id} id={id} manage={manage} />}
          {fields.length > 0 && (
            <ResourceEditor
              key={id + tab}
              title={labels[tab]}
              path={`/campaigns/${id}/${tab}`}
              fields={fields}
              jsonFields={jsonFields}
              columns={
                tab === "events"
                  ? [
                      "name",
                      "code",
                      "model",
                      "payout",
                      ...(manage ? ["revenue"] : []),
                      "repeatable",
                      ...(manage ? ["auto_approve"] : []),
                      "active",
                    ]
                  : tab === "caps"
                    ? [
                        "name",
                        "metric",
                        "period",
                        "timezone",
                        "amount",
                        "recorded_usage",
                        "active",
                      ]
                    : tab === "commission-rules"
                      ? [
                          "name",
                          "publisher_id",
                          "event_key",
                          "model",
                          "payout",
                          ...(manage ? ["revenue"] : []),
                          "sale_percentage",
                          "conditions",
                          "priority",
                          "active",
                        ]
                      : tab === "destinations"
                        ? [
                            "name",
                            "url",
                            "weight",
                            "countries",
                            "publisher_ids",
                            "active",
                          ]
                        : tab === "creatives"
                          ? ["name", "kind", "url", "description", "active"]
                          : tab === "traffic-rules"
                            ? [
                                "name",
                                "phase",
                                "action",
                                "conditions",
                                "priority",
                                "active",
                              ]
                            : undefined
              }
              editable
              renderers={{
                event_key: (row) => row.event_key || "All events",
                payout: (row) =>
                  row.model === "CPS"
                    ? `${row.sale_percentage}% of sale`
                    : `${row.payout} ${campaign?.currency || ""}`,
                revenue: (row) => `${row.revenue} ${campaign?.currency || ""}`,
                recorded_usage: (row) => <CapUsage row={row} />,
                conditions: (row) => (
                  <span>
                    {row.conditions?.all?.length
                      ? row.conditions.all
                          .map(
                            (c: Row) =>
                              `${c.field.replaceAll("_", " ")} ${conditionOperators[c.operator] || c.operator} ${Array.isArray(c.value) ? c.value.join(", ") : c.value}`,
                          )
                          .join(" AND ")
                      : "All traffic"}
                  </span>
                ),
                countries: (row) =>
                  row.countries?.length
                    ? row.countries.join(", ")
                    : "All countries",
                publisher_ids: (row) =>
                  row.publisher_ids?.length
                    ? row.publisher_ids
                        .map(
                          (id: string) =>
                            users.data.find((u) => u.id === id)?.email || id,
                        )
                        .join(", ")
                    : "All approved publishers",
                publisher_id: (row) =>
                  users.data.find((u) => u.id === row.publisher_id)?.email ||
                  row.publisher_id ||
                  "All publishers",
              }}
              readOnly={!manage}
            />
          )}
          {tab === "assign" && manage && (
            <RequestForm
              title="Assign or revoke private campaign access"
              path={`/campaigns/${id}/assign`}
              fields={[
                { ...publisher, required: true },
                select("status", "Access", ["approved", "rejected"]),
                text("note", "Note", { required: false }),
              ]}
            />
          )}
          {tab === "url-preview" && manage && (
            <RequestForm
              title="Preview URL without recording a click"
              path={`/campaigns/${id}/url-preview`}
              fields={[
                publisher,
                json(
                  "source_parameters",
                  "Source parameters",
                  {},
                  'Example: {"source":"google","aff_sub1":"placement"}',
                ),
                text("country", "Country", { required: false }),
              ]}
              transform={(b) => parseJson(b, ["source_parameters"])}
            />
          )}
          {tab === "creatives" && user.role === "publisher" && (
            <CreativeSnippets id={id} />
          )}
          {campaign && (
            <p className="network-note">
              Campaign: {campaign.name}. Publishers must have approved access
              before traffic can be tracked.
            </p>
          )}
        </>
      )}
    </>
  );
}
function Profile({ id, manage }: { id: string; manage: boolean }) {
  const result = useData<Row>(`/campaigns/${id}/profile`);
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorBox error={result.error} />;
  const profile = result.data!;
  if (!manage)
    return (
      <Panel title={profile.name}>
        <p>{profile.description}</p>
        <p>Visibility: {profile.settings.visibility}</p>
        <p>{profile.settings.terms}</p>
      </Panel>
    );
  const settings = profile.settings;
  return (
    <RequestForm
      title="Campaign profile"
      successMessage="Campaign details saved."
      path={`/campaigns/${id}/profile`}
      method="PUT"
      initial={{
        ...profile,
        ...settings,
        categories: settings.categories.join(", "),
        deep_link_hosts: settings.deep_link_hosts.join(", "),
        postback_ip_ranges: settings.postback_ip_ranges.join(", "),
      }}
      fields={[
        text("name", "Campaign name"),
        text("description", "Description", {
          type: "textarea",
          required: false,
        }),
        text("destination_url", "HTTPS destination URL", {
          help: "Query macros: ?click_id={click_id}&source={source}",
        }),
        select("visibility", "Campaign visibility", [
          "open",
          "approval",
          "private",
        ]),
        text("categories", "Categories", {
          required: false,
          help: "Comma separated, up to 8 categories",
        }),
        text("preview_url", "Preview URL", { type: "url", required: false }),
        text("terms", "Campaign terms", { type: "textarea", required: false }),
        text("internal_notes", "Internal notes", {
          type: "textarea",
          required: false,
        }),
        text("external_id", "External campaign reference", { required: false }),
        text("deep_link_enabled", "Allow deep linking", {
          type: "checkbox",
          required: false,
        }),
        text("deep_link_hosts", "Permitted deep-link hosts", {
          required: false,
          help: "Comma separated exact advertiser hosts. No wildcards.",
        }),
        text("postback_ip_ranges", "Postback IP allowlist", {
          required: false,
          help: "Comma separated CIDRs. Leave blank until you know your advertiser server addresses.",
        }),
        text("initial_repeatable", "Allow repeated initial conversions", {
          type: "checkbox",
          required: false,
        }),
        text(
          "initial_auto_approve",
          "Automatically approve initial conversions",
          { type: "checkbox", required: false },
        ),
        text("cap_alert_percent", "Cap notification threshold (%)", {
          type: "number",
          min: 1,
          max: 100,
          help: "Notify when a cap crosses this percentage of its limit.",
        }),
        text("fallback_url", "Unavailable-campaign fallback URL", {
          type: "url",
          required: false,
        }),
      ]}
      transform={(b) => {
        const { name, description, destination_url, ...settings } = b;
        for (const key of [
          "categories",
          "deep_link_hosts",
          "postback_ip_ranges",
        ])
          settings[key] = String(settings[key] || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        return {
          name,
          description: description || "",
          destination_url,
          settings,
        };
      }}
    />
  );
}
function CreativeSnippets({ id }: { id: string }) {
  const [result, setResult] = useState<unknown>(null);
  return (
    <Panel title="Your creative snippets">
      <ResourceRows
        path={`/campaigns/${id}/creatives`}
        columns={["name", "kind", "active"]}
        actions={(r) => (
          <Action
            run={async () =>
              setResult(await api(`/campaigns/${id}/creatives/${r.id}/snippet`))
            }
          >
            Generate snippet
          </Action>
        )}
      />
      {result !== null && <Result value={result} />}
    </Panel>
  );
}
