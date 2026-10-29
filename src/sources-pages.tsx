import { useState } from "react";
import { send, type Row } from "./api";
import { useCatalog, useData } from "./hooks";
import { date } from "./format";
import { Badge, ErrorBox, Fields, Loading, Panel, Table } from "./ui";
import { Action } from "./network-ui";

const quickPresets = [
  "cashback_sites",
  "messaging_apps",
  "google_ads",
  "meta_ads",
  "no_referrer",
];
const presetHelp: Record<string, string> = {
  cashback_sites: "Visitors arriving from cashback and coupon sites.",
  messaging_apps: "Links shared in Telegram or WhatsApp groups and channels.",
  google_ads: "Clicks from Google ads, e.g. bidding on your brand name.",
  meta_ads: "Clicks from Facebook and Instagram ads.",
  no_referrer:
    "Visits that hide where they came from. Careful: many apps, including Instagram's in-app browser, send no referrer.",
};

// Account-wide or campaign-only blocks; blocked traffic earns no commission.
export function BlockedSources() {
  const [version, setVersion] = useState(0);
  const data = useData<Row>("/blocked-sources", version);
  const campaigns = useCatalog("/campaigns");
  const reload = () => setVersion((v) => v + 1);
  const blocks = (data.data?.blocks || []) as Row[];
  const active = (preset: string) =>
    blocks.find((b) => b.preset === preset && !b.campaign_id && b.active);
  async function toggle(preset: string) {
    const existing = blocks.find((b) => b.preset === preset && !b.campaign_id);
    if (existing)
      await send(
        `/blocked-sources/${existing.id}`,
        { active: !existing.active },
        "PATCH",
      );
    else await send("/blocked-sources", { preset });
    reload();
  }
  return (
    <Panel
      title="Blocked traffic sources"
      subtitle="Clicks from a blocked source are rejected and logged here. Conversions on earlier clicks from a source blocked later are recorded as rejected, with no commission. Partners see the reason."
    >
      {data.error && <ErrorBox error={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data && (
        <>
          <div className="template-grid">
            {quickPresets.map((preset) => (
              <button
                type="button"
                key={preset}
                role="switch"
                aria-checked={Boolean(active(preset))}
                className={`template-card ${active(preset) ? "is-selected" : ""}`}
                onClick={toggle.bind(null, preset)}
              >
                <strong>
                  {active(preset) ? "Blocked: " : "Allow: "}
                  {data.data!.presets[preset]}
                </strong>
                <small>{presetHelp[preset]}</small>
              </button>
            ))}
          </div>
          <p className="muted">
            Cashback and coupon sites include{" "}
            {(data.data.cashback_domains as string[]).join(", ")}. Add others
            below.
          </p>
          <div className="network-form">
            <Fields
              fields={[
                {
                  name: "preset",
                  label: "Block",
                  options: [
                    { value: "custom_domain", label: "A referring website" },
                    {
                      value: "custom_source",
                      label: "A source / utm_source value",
                    },
                  ],
                  defaultValue: "custom_domain",
                },
                {
                  name: "value",
                  label: "Website or source value",
                  help: "e.g. dealsite.example or telegram",
                },
                {
                  name: "campaign_id",
                  label: "Campaign (empty = all campaigns)",
                  required: false,
                  options: campaigns.data.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                  source: campaigns,
                },
              ]}
              submit="Add block"
              onSubmit={async (b) => {
                await send("/blocked-sources", {
                  ...b,
                  campaign_id: b.campaign_id || null,
                });
                reload();
              }}
            />
          </div>
          <Table
            rows={blocks}
            columns={[
              {
                key: "label",
                title: "Blocked",
                render: (r) => (
                  <>
                    <strong>{r.label}</strong>
                    {r.value && <code> {r.value}</code>}
                  </>
                ),
              },
              {
                key: "campaign_name",
                title: "Applies to",
                render: (r) => r.campaign_name || "All campaigns",
              },
              {
                key: "active",
                title: "Status",
                render: (r) => <Badge value={r.active ? "active" : "paused"} />,
              },
              {
                key: "id",
                title: "",
                render: (r) => (
                  <Action
                    run={async () => {
                      await send(
                        `/blocked-sources/${r.id}`,
                        { active: !r.active },
                        "PATCH",
                      );
                      reload();
                    }}
                  >
                    {r.active ? "Pause" : "Resume"}
                  </Action>
                ),
              },
            ]}
          />
        </>
      )}
    </Panel>
  );
}

// Partners see which of their traffic was rejected and why.
export function RejectedTraffic() {
  const events = useData<Row[]>("/fraud/partner-events");
  if (events.error) return <ErrorBox error={events.error} />;
  if (!events.data) return <Loading />;
  return (
    <Panel
      title="Rejected traffic"
      subtitle="Traffic the advertiser or network does not pay for. Rejected clicks and conversions earn no commission."
    >
      {events.data.length === 0 ? (
        <p className="muted">None of your traffic has been rejected.</p>
      ) : (
        <Table
          rows={events.data}
          columns={[
            { key: "campaign_name", title: "Campaign" },
            { key: "reason", title: "Reason" },
            {
              key: "created_at",
              title: "When",
              render: (r) => date(r.created_at),
            },
          ]}
        />
      )}
    </Panel>
  );
}
