import { useState } from "react";
import { send, type Row } from "./api";
import { useCatalog, useData } from "./hooks";
import { staff, useAccountType, useSession } from "./context";
import { money } from "./format";
import {
  Badge,
  ErrorBox,
  Fields,
  Loading,
  PageHead,
  Panel,
  Table,
  type Field,
} from "./ui";
import { Action, Result } from "./network-ui";

const columns = (manage: boolean, reload: () => void) => [
  {
    key: "code",
    title: "Code",
    render: (r: Row) => <strong className="mono">{r.code}</strong>,
  },
  { key: "campaign_name", title: "Campaign" },
  ...(manage ? [{ key: "partner_name", title: "Partner" }] : []),
  {
    key: "uses",
    title: "Uses",
    render: (r: Row) => (r.quota ? `${r.uses} / ${r.quota}` : r.uses),
  },
  { key: "conversions", title: "Credited sales" },
  {
    key: "earnings",
    title: "Commission",
    render: (r: Row) => money(r.earnings, r.currency),
  },
  {
    key: "ends_on",
    title: "Valid",
    render: (r: Row) =>
      r.starts_on || r.ends_on
        ? `${r.starts_on || "now"} → ${r.ends_on || "no end"}`
        : "Always",
  },
  {
    key: "active",
    title: "Status",
    render: (r: Row) => <Badge value={r.active ? "active" : "paused"} />,
  },
  ...(manage
    ? [
        {
          key: "id",
          title: "",
          render: (r: Row) => (
            <Action
              run={async () => {
                await send(`/coupons/${r.id}`, { active: !r.active }, "PATCH");
                reload();
              }}
            >
              {r.active ? "Pause" : "Resume"}
            </Action>
          ),
        },
      ]
    : []),
];

export function Coupons() {
  const { user } = useSession();
  const creator = useAccountType() === "influencer",
    manage = staff(user.role);
  const [version, setVersion] = useState(0),
    [preview, setPreview] = useState<Row | null>(null);
  const reload = () => setVersion((v) => v + 1);
  const list = useData<Row[]>(manage ? "/coupons" : "/coupons/mine", version);
  const campaigns = useCatalog(manage ? "/campaigns" : null);
  const people = useCatalog(manage && !creator ? "/users" : null);
  const campaign: Field = {
    name: "campaign_id",
    label: creator ? "Brand deal" : "Campaign",
    options: campaigns.data.map((c) => ({ value: c.id, label: c.name })),
    source: campaigns,
  };
  const partner: Field[] = creator
    ? []
    : [
        {
          name: "partner_id",
          label: "Partner who shares the code",
          options: people.data
            .filter(
              (p) => ["affiliate", "publisher"].includes(p.role) && p.active,
            )
            .map((p) => ({ value: p.id, label: p.name || p.email })),
          source: people,
        },
      ];
  const clean = (b: Row) =>
    Object.fromEntries(
      Object.entries(b).filter(([, v]) => v !== "" && v != null),
    );
  return (
    <>
      <PageHead
        eyebrow="COUPONS"
        title={manage ? "Coupon codes" : "My coupon codes"}
        description={
          manage
            ? "Give each partner or creator their own code. Sales that use it are credited to them, even without a click."
            : "Codes assigned to you. Sales that use them are credited to you."
        }
      />
      {manage && (
        <Panel
          title="New code"
          subtitle="Send coupon=CODE with txn_id in the postback, or include it in the order report you upload."
        >
          <div className="network-form">
            <Fields
              fields={[
                campaign,
                ...partner,
                {
                  name: "code",
                  label: "Code",
                  help: "Letters, numbers, - and _ (not case-sensitive)",
                },
                {
                  name: "quota",
                  label: "Maximum uses (optional)",
                  type: "number",
                  min: 1,
                  required: false,
                },
                {
                  name: "starts_on",
                  label: "Valid from (optional)",
                  type: "date",
                  required: false,
                },
                {
                  name: "ends_on",
                  label: "Valid until (optional)",
                  type: "date",
                  required: false,
                },
                {
                  name: "description",
                  label: "Note (optional)",
                  required: false,
                },
              ]}
              submit="Create code"
              onSubmit={async (b) => {
                await send("/coupons", clean(b));
                reload();
              }}
            />
          </div>
        </Panel>
      )}
      <Panel title={manage ? "All codes" : "Your codes"}>
        {list.error && <ErrorBox error={list.error} />}
        {!list.data && !list.error && <Loading />}
        {list.data &&
          (list.data.length ? (
            <Table rows={list.data} columns={columns(manage, reload)} />
          ) : (
            <p className="muted">No coupon codes yet.</p>
          ))}
      </Panel>
      {manage && (
        <Panel
          title="Import many codes"
          subtitle="CSV with a code column and optional quota, starts_on, ends_on, description. Preview first; an import with errors adds nothing."
        >
          <div className="network-form">
            <Fields
              fields={[
                campaign,
                ...partner,
                {
                  name: "csv_content",
                  label: "CSV",
                  type: "textarea",
                  full: true,
                  help: "code,quota,ends_on\nDIWALI10,500,2026-11-15",
                },
                {
                  name: "dry_run",
                  label: "Preview only",
                  type: "checkbox",
                  defaultValue: true,
                  required: false,
                },
              ]}
              submit="Run"
              onSubmit={async (b) => {
                setPreview(
                  await send<Row>("/coupons/import", {
                    ...clean(b),
                    dry_run: Boolean(b.dry_run),
                  }),
                );
                reload();
              }}
            />
            {preview && <Result value={preview} />}
          </div>
        </Panel>
      )}
    </>
  );
}
