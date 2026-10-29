import { useMemo, useState } from "react";
import { send, type Row } from "./api";
import { useCatalog, useData } from "./hooks";
import { money } from "./format";
import {
  CopyButton,
  ErrorBox,
  Fields,
  Loading,
  PageHead,
  Panel,
  Table,
} from "./ui";

const platforms = [
  "instagram",
  "youtube",
  "facebook",
  "x",
  "telegram",
  "whatsapp",
  "blog",
  "other",
];
const label = (value: string) =>
  ({ x: "X (Twitter)", youtube: "YouTube", whatsapp: "WhatsApp" })[value] ||
  value.replace(/^./, (c) => c.toUpperCase());

// Creator home: which brand, post and platform earned the most.
export function InfluencerHome() {
  const [days, setDays] = useState("30");
  const [now] = useState(Date.now);
  const query = useMemo(() => {
    const end = new Date(now);
    const start = new Date(now - (Number(days) - 1) * 86400000);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    return `start=${day(start)}&end=${day(end)}`;
  }, [days, now]);
  const summary = useData<Row>(`/influencer/summary?${query}`);
  const data = summary.data;
  const currency = data?.deals?.[0]?.currency || "INR";
  const totals = (data?.deals || []).reduce(
    (t: Row, d: Row) => ({
      clicks: t.clicks + d.clicks,
      sales: t.sales + d.sales,
      earnings: t.earnings + Number(d.earnings),
    }),
    { clicks: 0, sales: 0, earnings: 0 },
  );
  const rate = (r: Row) => `${r.conversion_rate}%`;
  return (
    <>
      <PageHead
        eyebrow="YOUR BRAND DEALS"
        title="Overview"
        description="Clicks and sales from every link you post, by brand, post and platform."
        actions={
          <select
            className="period-select"
            aria-label="Reporting period"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        }
      />
      {summary.error && <ErrorBox error={summary.error} />}
      {!data && !summary.error && <Loading />}
      {data && (
        <>
          <div className="target-grid">
            {[
              ["Clicks", totals.clicks.toLocaleString("en-IN")],
              ["Sales", totals.sales.toLocaleString("en-IN")],
              ["Earnings", money(totals.earnings, currency)],
              [
                "Conversion rate",
                totals.clicks
                  ? `${((totals.sales * 100) / totals.clicks).toFixed(2)}%`
                  : "—",
              ],
            ].map(([name, value]) => (
              <div className="target-card" key={name}>
                <small>{name}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <Panel
            title="By brand"
            subtitle="Sales include totals that brands reported to you."
          >
            <Table
              rows={data.deals}
              columns={[
                { key: "brand", title: "Brand" },
                { key: "name", title: "Deal" },
                { key: "clicks", title: "Clicks" },
                { key: "sales", title: "Sales" },
                {
                  key: "earnings",
                  title: "Earnings",
                  render: (r) => money(r.earnings, r.currency),
                },
                { key: "conversion_rate", title: "CR", render: rate },
              ]}
            />
          </Panel>
          <Panel title="By post or link">
            <Table
              rows={data.placements}
              columns={[
                { key: "name", title: "Post / link" },
                {
                  key: "platform",
                  title: "Platform",
                  render: (r) => label(r.platform),
                },
                { key: "clicks", title: "Clicks" },
                { key: "sales", title: "Sales" },
                {
                  key: "earnings",
                  title: "Earnings",
                  render: (r) => money(r.earnings, currency),
                },
                { key: "conversion_rate", title: "CR", render: rate },
              ]}
            />
          </Panel>
          <Panel title="By platform">
            <Table
              rows={data.platforms}
              columns={[
                {
                  key: "platform",
                  title: "Platform",
                  render: (r) => label(r.platform),
                },
                { key: "clicks", title: "Clicks" },
                { key: "sales", title: "Sales" },
                {
                  key: "earnings",
                  title: "Earnings",
                  render: (r) => money(r.earnings, currency),
                },
                { key: "conversion_rate", title: "CR", render: rate },
              ]}
            />
          </Panel>
        </>
      )}
    </>
  );
}

// One link per post or spot, plus sales that brands report only as totals.
export function InfluencerLinks() {
  const deals = useCatalog("/campaigns");
  const [version, setVersion] = useState(0);
  const placements = useData<Row[]>("/placements", version);
  const manual = useData<Row[]>("/manual-results", version);
  const dealOptions = deals.data.map((d) => ({ value: d.id, label: d.name }));
  const dealName = (id: string) =>
    deals.data.find((d) => d.id === id)?.name || "—";
  async function submit(path: string, body: Row) {
    await send(path, body);
    setVersion((v) => v + 1);
  }
  return (
    <>
      <PageHead
        eyebrow="YOUR POSTS"
        title="My links"
        description="Create a separate link for every story, video or bio link to see which one earns."
      />
      <Panel title="New link">
        <div className="network-form">
          <Fields
            fields={[
              {
                name: "campaign_id",
                label: "Brand deal",
                options: dealOptions,
                source: deals,
              },
              {
                name: "name",
                label: "Post or spot name",
                help: "e.g. Insta story 28 Oct, YouTube review, Link in bio",
              },
              {
                name: "platform",
                label: "Platform",
                options: platforms.map((p) => ({ value: p, label: label(p) })),
                defaultValue: "instagram",
              },
            ]}
            submit="Create link"
            onSubmit={(b) => submit("/placements", b)}
          />
        </div>
      </Panel>
      <Panel title="Your links">
        {placements.error && <ErrorBox error={placements.error} />}
        {!placements.data && !placements.error && <Loading />}
        {placements.data && (
          <Table
            rows={placements.data}
            columns={[
              { key: "name", title: "Post / link" },
              {
                key: "platform",
                title: "Platform",
                render: (r) => label(r.platform),
              },
              {
                key: "campaign_id",
                title: "Brand deal",
                render: (r) => dealName(r.campaign_id),
              },
              {
                key: "url",
                title: "Link to post",
                render: (r) => (
                  <div className="copy-cell">
                    <code>{r.url}</code>
                    <CopyButton value={r.url} label="Copy link" />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
      <Panel
        title="Sales reported by brands"
        subtitle="Use this when a brand only shares totals. For order-level sales, use the postback or the report upload in Tools."
      >
        <div className="network-form">
          <Fields
            fields={[
              {
                name: "campaign_id",
                label: "Brand deal",
                options: dealOptions,
                source: deals,
              },
              { name: "period_start", label: "From", type: "date" },
              { name: "period_end", label: "To", type: "date" },
              {
                name: "sales",
                label: "Sales",
                type: "number",
                min: 0,
                step: "1",
              },
              {
                name: "earnings",
                label: "Your earnings",
                type: "number",
                min: 0,
                step: "0.01",
              },
              { name: "note", label: "Note", required: false },
            ]}
            submit="Add reported sales"
            onSubmit={(b) => submit("/manual-results", b)}
          />
        </div>
        {manual.data && manual.data.length > 0 && (
          <Table
            rows={manual.data}
            columns={[
              { key: "campaign_name", title: "Brand deal" },
              { key: "period_start", title: "From" },
              { key: "period_end", title: "To" },
              { key: "sales", title: "Sales" },
              {
                key: "earnings",
                title: "Earnings",
                render: (r) => money(r.earnings, r.currency),
              },
              { key: "note", title: "Note" },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
