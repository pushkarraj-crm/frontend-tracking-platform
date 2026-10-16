import { useData, useCatalog } from "./hooks";
import { money, date, short } from "./format";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  ExternalLink,
  Globe2,
  MousePointer2,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { api, download, endSession, query, send, type Row } from "./api";
import { staff, useSession, useToast } from "./context";
import {
  Badge,
  CopyButton,
  Empty,
  ErrorBox,
  Fields,
  Loading,
  Modal,
  PageHead,
  Panel,
  SearchBox,
  Secret,
  Table,
  type Field,
} from "./ui";
const size = 50;
function useReload() {
  const [version, setVersion] = useState(0);
  return [version, () => setVersion((v) => v + 1)] as const;
}
const roleOptions = (roles: string[]) =>
  roles.map((value) => ({
    value,
    label: value.replace("_", " ").replace(/^./, (c) => c.toUpperCase()),
  }));
function Action({
  children,
  run,
  danger = false,
}: {
  children: React.ReactNode;
  run: () => Promise<unknown>;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    toast = useToast();
  return (
    <button
      className={`text-button ${danger ? "danger" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await run();
        } catch (e) {
          toast((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Working…" : children}
    </button>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
  hint,
  featured,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof MousePointer2;
  hint: string;
  featured?: boolean;
}) {
  return (
    <article className={`metric ${featured ? "featured" : ""}`}>
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
function Chart({ rows }: { rows: Row[] }) {
  const grouped = new Map<string, number>();
  rows.forEach((r) => {
    const key = String(r.group).slice(0, 10);
    grouped.set(key, (grouped.get(key) || 0) + r.clicks);
  });
  const points = [...grouped].sort((a, b) => a[0].localeCompare(b[0]));
  if (!points.length)
    return (
      <Empty
        title="Your performance starts here"
        description="Share a tracking link. Your first clicks and conversions will appear here."
        action={
          <Link className="button secondary" to="/offers">
            Explore your offers <ArrowUpRight size={16} />
          </Link>
        }
      />
    );
  const maximum = Math.max(1, ...points.map((p) => p[1]));
  const coordinates = points
    .map(
      (p, i) =>
        `${30 + (i * 700) / Math.max(1, points.length - 1)},${190 - (p[1] / maximum) * 155}`,
    )
    .join(" ");
  return (
    <div className="chart">
      <div className="chart-legend">
        <i /> Clicks <span>UTC · recorded activity</span>
      </div>
      <svg
        viewBox="0 0 760 225"
        role="img"
        aria-label="Daily click performance"
      >
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#30a887" stopOpacity="0.2" />
            <stop offset="1" stopColor="#30a887" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 87, 139, 190].map((y) => (
          <line
            key={y}
            x1="30"
            x2="730"
            y1={y}
            y2={y}
            stroke="#e9eeeb"
            strokeDasharray="4 4"
          />
        ))}
        <polygon
          points={`30,190 ${coordinates} ${30 + ((points.length - 1) * 700) / Math.max(1, points.length - 1)},190`}
          fill="url(#area)"
        />
        <polyline
          points={coordinates}
          fill="none"
          stroke="#24876b"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {points.map(([key, value], i) => (
          <circle
            key={key}
            cx={30 + (i * 700) / Math.max(1, points.length - 1)}
            cy={190 - (value / maximum) * 155}
            r="4"
            fill="#24876b"
          >
            <title>
              {key}: {value} clicks
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{points[0][0]}</span>
        <span>{points.at(-1)?.[0]}</span>
      </div>
    </div>
  );
}
export function Dashboard() {
  const { user } = useSession(),
    [days, setDays] = useState("7"),
    [version, reload] = useReload();
  const [now] = useState(Date.now);
  const start = useMemo(
      () => new Date(now - Number(days) * 86400000).toISOString(),
      [days, now],
    ),
    filter = query({ start });
  const summary = useData<Row>("/reports/summary?" + filter, version),
    performance = useData<Row[]>(
      "/reports/grouped?group_by=day&" + filter,
      version,
    ),
    top = useData<Row[]>("/reports/grouped?group_by=offer&" + filter, version),
    offers = useData<Row[]>("/offers?limit=100", version),
    recent = useData<Row[]>("/conversions?limit=5", version);
  const currency = summary.data?.totals?.[0],
    approved =
      summary.data?.totals?.reduce(
        (total: number, r: Row) => total + r.approved_conversions,
        0,
      ) || 0,
    amountKey = ["affiliate", "publisher"].includes(user.role)
      ? "payout"
      : "revenue";
  return (
    <>
      <PageHead
        eyebrow="THE BIG PICTURE"
        title="Overview"
        description="Every partnership. Every click. All coming together."
        actions={
          <>
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
            <button className="button secondary" onClick={reload}>
              <RefreshCw size={16} /> Refresh
            </button>
          </>
        }
      />
      {summary.error ? (
        <ErrorBox error={summary.error} retry={reload} />
      ) : summary.loading ? (
        <Loading />
      ) : (
        <div className="metrics">
          <Metric
            label="Total clicks"
            value={Number(summary.data?.clicks || 0).toLocaleString()}
            icon={MousePointer2}
            hint="Traffic across your offers"
            featured
          />
          <Metric
            label="Approved conversions"
            value={approved.toLocaleString()}
            icon={Zap}
            hint="Verified by your network"
          />
          <Metric
            label={
              amountKey === "payout" ? "Commission earned" : "Approved revenue"
            }
            value={
              currency ? money(currency[amountKey], currency.currency) : "—"
            }
            icon={CircleDollarSign}
            hint={
              summary.data?.totals?.length > 1
                ? "First currency shown · see reports for all"
                : "Approved conversions only"
            }
          />
          <Metric
            label="Conversion rate"
            value={
              summary.data?.clicks
                ? `${((approved / summary.data.clicks) * 100).toFixed(2)}%`
                : "0.00%"
            }
            icon={TrendingUp}
            hint="Approved conversions ÷ clicks"
          />
        </div>
      )}
      <div className="overview-grid">
        <Panel
          title="Performance at a glance"
          subtitle="A clearer view of your network’s momentum."
          actions={<span className="chart-period">{days} DAY VIEW</span>}
          className="performance-panel"
        >
          {performance.error ? (
            <ErrorBox error={performance.error} />
          ) : performance.loading ? (
            <Loading />
          ) : (
            <Chart rows={performance.data || []} />
          )}
        </Panel>
        <section className="launch-card">
          <div className="launch-icon">
            <NetworkMark />
          </div>
          <div className="eyebrow">MAKE YOUR NEXT MOVE</div>
          <h2>
            More connections.
            <br />
            More possibilities.
          </h2>
          <p>
            {staff(user.role)
              ? "Bring your best offers and partners together. Your next great partnership starts here."
              : "Find your next opportunity and turn your reach into results."}
          </p>
          <Link
            to={staff(user.role) ? "/partners" : "/offers"}
            className="button lime"
          >
            {staff(user.role) ? "Manage partners" : "Explore offers"}
            <ArrowUpRight size={17} />
          </Link>
          <div className="launch-decoration" aria-hidden="true">
            ↗
          </div>
        </section>
      </div>
      <div className="overview-bottom">
        <Panel
          title="Offer performance"
          subtitle="Your tracked offers, at a glance."
          actions={
            <Link className="text-button" to="/reports">
              View reports <ArrowUpRight size={15} />
            </Link>
          }
        >
          {top.error ? (
            <ErrorBox error={top.error} />
          ) : top.loading ? (
            <Loading />
          ) : (
            <Table
              rows={(top.data || [])
                .slice()
                .sort((a, b) => b.clicks - a.clicks)
                .slice(0, 5)}
              columns={[
                {
                  key: "group",
                  title: "Offer",
                  render: (r) => (
                    <div className="cell-identity">
                      <span className="offer-avatar">
                        <Tag size={16} />
                      </span>
                      <strong>
                        {offers.data?.find((o) => o.id === r.group)?.name ||
                          short(r.group)}
                      </strong>
                    </div>
                  ),
                },
                { key: "clicks", title: "Clicks" },
                { key: "conversions", title: "Conversions" },
                {
                  key: amountKey,
                  title: amountKey === "payout" ? "Commission" : "Revenue",
                  render: (r) => money(r[amountKey], r.currency),
                },
              ]}
            />
          )}
        </Panel>
        <Panel
          title="Latest conversions"
          subtitle="The most recent activity in your network."
          actions={
            <Link className="text-button" to="/conversions">
              View all <ArrowUpRight size={15} />
            </Link>
          }
        >
          {recent.error ? (
            <ErrorBox error={recent.error} />
          ) : recent.loading ? (
            <Loading />
          ) : (
            <Table
              rows={recent.data || []}
              columns={[
                {
                  key: "transaction_id",
                  title: "Transaction",
                  render: (r) => (
                    <span className="mono">{r.transaction_id}</span>
                  ),
                },
                {
                  key: "status",
                  title: "Status",
                  render: (r) => <Badge value={r.status} />,
                },
                {
                  key: "created_at",
                  title: "Received",
                  render: (r) => date(r.created_at),
                },
              ]}
            />
          )}
        </Panel>
      </div>
      <div className="insight-strip">
        <ShieldCheck size={21} />
        <div>
          <strong>Your network, with confidence.</strong>
          <span>
            Tenant-isolated data, verified conversions, and a complete audit
            trail.
          </span>
        </div>
        <Link to="/settings">
          Account settings <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
function NetworkMark() {
  return (
    <>
      <span />
      <span />
      <span />
      <span />
    </>
  );
}
export function Offers() {
  const { user } = useSession(),
    toast = useToast(),
    [version, reload] = useReload(),
    [offset, setOffset] = useState(0),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<"create" | Row | null>(null),
    [secret, setSecret] = useState("");
  const result = useData<Row[]>(
      `/offers?offset=${offset}&limit=${size}`,
      version,
    ),
    people = useCatalog(staff(user.role) ? "/users" : null),
    rules = useData<Row>(
      modal && typeof modal === "object" ? `/offers/${modal.id}/rules` : null,
    );
  const fields: Field[] = [
    { name: "name", label: "Offer name", full: true },
    {
      name: "destination_url",
      label: "Destination URL",
      type: "url",
      full: true,
      placeholder: "https://advertiser.com/landing",
    },
    {
      name: "revenue",
      label: "Revenue per conversion",
      type: "number",
      min: 0,
      step: "0.0001",
    },
    {
      name: "payout",
      label: "Partner payout",
      type: "number",
      min: 0,
      step: "0.0001",
    },
    { name: "currency", label: "Currency", defaultValue: "USD" },
    {
      name: "attribution_hours",
      label: "Attribution window (hours)",
      type: "number",
      min: 1,
      max: 2160,
      defaultValue: 720,
    },
    ...(staff(user.role)
      ? [
          {
            name: "advertiser_id",
            source: people,
            label: "Advertiser",
            required: false,
            options:
              people.data
                ?.filter((p) => p.role === "advertiser")
                .map((p) => ({ value: p.id, label: p.email })) || [],
          },
        ]
      : []),
  ];
  const ruleFields: Field[] = [
    {
      name: "countries",
      label: "Country codes",
      required: false,
      help: "Comma-separated ISO codes, e.g. IN, US",
    },
    {
      name: "devices",
      label: "Devices",
      required: false,
      help: "desktop, mobile, tablet, unknown",
    },
    {
      name: "operating_systems",
      label: "Operating systems",
      required: false,
      help: "android, ios, windows, macos, linux, other",
    },
    {
      name: "languages",
      label: "Languages",
      required: false,
      help: "Comma-separated language codes, e.g. en, hi",
    },
    {
      name: "starts_at",
      label: "Starts at",
      type: "datetime-local",
      required: false,
    },
    {
      name: "ends_at",
      label: "Ends at",
      type: "datetime-local",
      required: false,
    },
    {
      name: "utc_hours",
      label: "Allowed UTC hours",
      required: false,
      help: "Comma-separated hours 0–23; blank allows all",
    },
    {
      name: "denied_networks",
      label: "Blocked IP networks",
      required: false,
      help: "Comma-separated CIDR networks",
    },
    ...[
      "daily_clicks",
      "total_clicks",
      "daily_conversions",
      "total_conversions",
      "daily_revenue",
      "total_revenue",
    ].map((name) => ({
      name,
      label: name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
      type: "number",
      min: name.includes("revenue") ? 0.0001 : 1,
      step: name.includes("revenue") ? "0.0001" : "1",
      required: false,
    })),
    {
      name: "clicks_per_ip_minute",
      label: "Clicks per IP / minute",
      type: "number",
      min: 1,
      max: 10000,
      defaultValue: 120,
    },
    {
      name: "minimum_conversion_seconds",
      label: "Minimum conversion delay (seconds)",
      type: "number",
      min: 0,
      max: 3600,
      defaultValue: 0,
    },
    {
      name: "block_bots",
      label: "Block common bots",
      type: "checkbox",
      defaultValue: true,
    },
  ];
  return (
    <>
      <PageHead
        title="Offers"
        description="Connect the right opportunities with the right partners."
        actions={
          (staff(user.role) || user.role === "advertiser") && (
            <button
              className="button primary"
              onClick={() => setModal("create")}
            >
              <Plus size={17} />{" "}
              {user.role === "advertiser" ? "Submit offer" : "Create offer"}
            </button>
          )
        }
      />
      {secret && <Secret title="Postback key" value={secret} />}
      <Panel
        title="Your offer catalog"
        subtitle="Manage availability, attribution and targeting."
        actions={<SearchBox value={search} onChange={setSearch} />}
      >
        {result.error ? (
          <ErrorBox error={result.error} retry={reload} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={(result.data || []).filter((r) =>
              r.name.toLowerCase().includes(search.toLowerCase()),
            )}
            offset={offset}
            setOffset={setOffset}
            hasNext={(result.data || []).length >= size}
            columns={[
              {
                key: "name",
                title: "Offer",
                render: (r) => (
                  <div className="cell-identity">
                    <span className="offer-avatar">
                      <Tag size={17} />
                    </span>
                    <div>
                      <strong>{r.name}</strong>
                      <small className="mono">{short(r.id)}</small>
                    </div>
                  </div>
                ),
              },
              {
                key: "active",
                title: "Status",
                render: (r) => <Badge value={r.active} />,
              },
              ...(!["affiliate", "publisher"].includes(user.role)
                ? [
                    {
                      key: "revenue",
                      title: "Revenue",
                      render: (r: Row) => money(r.revenue, r.currency),
                    },
                  ]
                : []),
              ...(user.role !== "advertiser"
                ? [
                    {
                      key: "payout",
                      title: "Payout",
                      render: (r: Row) => money(r.payout, r.currency),
                    },
                  ]
                : []),
              {
                key: "attribution_hours",
                title: "Attribution",
                render: (r) => `${r.attribution_hours} hours`,
              },
              {
                key: "actions",
                title: "Actions",
                render: (r) => (
                  <div className="row-actions">
                    {staff(user.role) && (
                      <>
                        <button
                          className="text-button"
                          onClick={() => setModal(r)}
                        >
                          <SlidersHorizontal size={14} /> Rules
                        </button>
                        <Action
                          run={async () => {
                            await send(
                              `/offers/${r.id}`,
                              { active: !r.active },
                              "PATCH",
                            );
                            reload();
                          }}
                        >
                          {r.active ? "Pause" : "Activate"}
                        </Action>
                      </>
                    )}
                    {(staff(user.role) || user.role === "advertiser") && (
                      <Action
                        run={async () => {
                          if (
                            !confirm(
                              "Rotate the postback key? The old key stops working immediately.",
                            )
                          )
                            return;
                          const data = await send(
                            `/offers/${r.id}/rotate-postback-key`,
                          );
                          setSecret(data.postback_key);
                          toast("Postback key rotated. Save the new key now.");
                        }}
                      >
                        Rotate key
                      </Action>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
      {modal && (
        <Modal
          title={
            modal === "create" ? "Create an offer" : `Rules · ${modal.name}`
          }
          onClose={() => setModal(null)}
        >
          {modal === "create" ? (
            <Fields
              fields={fields}
              submit={
                user.role === "advertiser"
                  ? "Submit for approval"
                  : "Create offer"
              }
              onSubmit={async (body) => {
                const result = await send("/offers", body);
                setSecret(result.postback_key);
                setModal(null);
                reload();
                toast(
                  user.role === "advertiser"
                    ? "Offer submitted for network approval."
                    : "Offer created. Assign it with a tracking link.",
                );
              }}
            />
          ) : rules.loading ? (
            <Loading />
          ) : rules.error ? (
            <ErrorBox error={rules.error} />
          ) : (
            <>
              <div className="notice">
                Daily caps use UTC. Every accepted conversion counts toward
                caps, including pending or rejected conversions.
              </div>
              <Fields
                fields={ruleFields}
                initial={Object.fromEntries(
                  Object.entries(rules.data || {}).map(([k, v]) => [
                    k,
                    Array.isArray(v)
                      ? v.join(", ")
                      : k.endsWith("_at") && v
                        ? new Date(v).toISOString().slice(0, 16)
                        : v,
                  ]),
                )}
                onSubmit={async (body) => {
                  for (const key of [
                    "countries",
                    "devices",
                    "operating_systems",
                    "languages",
                    "denied_networks",
                    "utc_hours",
                  ])
                    body[key] = String(body[key] || "")
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean)
                      .map((v) => (key === "utc_hours" ? Number(v) : v));
                  for (const key of ["starts_at", "ends_at"])
                    if (body[key])
                      body[key] = new Date(body[key]).toISOString();
                  await send(`/offers/${modal.id}/rules`, body, "PUT");
                  setModal(null);
                  toast("Offer rules updated.");
                }}
              />
            </>
          )}
        </Modal>
      )}
    </>
  );
}
export function Partners() {
  const { user } = useSession(),
    toast = useToast(),
    [version, reload] = useReload(),
    [offset, setOffset] = useState(0),
    [search, setSearch] = useState(""),
    [open, setOpen] = useState(false),
    parents = useCatalog(user.role === "admin" && open ? "/users" : null),
    result = useData<Row[]>(`/users?offset=${offset}&limit=${size}`, version);
  return (
    <>
      <PageHead
        title={user.role === "affiliate" ? "My publishers" : "Partners"}
        description="The people behind your network’s next chapter."
        actions={
          user.role !== "staff" && (
            <button className="button primary" onClick={() => setOpen(true)}>
              <Plus size={17} />{" "}
              {user.role === "affiliate" ? "Add publisher" : "Add partner"}
            </button>
          )
        }
      />
      <Panel
        title="Your people"
        subtitle="Account access and partnership roles."
        actions={<SearchBox value={search} onChange={setSearch} />}
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={(result.data || []).filter((r) =>
              r.email.toLowerCase().includes(search.toLowerCase()),
            )}
            offset={offset}
            setOffset={setOffset}
            hasNext={(result.data || []).length >= size}
            columns={[
              {
                key: "email",
                title: "Partner",
                render: (r) => (
                  <div className="cell-identity">
                    <span className="avatar">{r.email[0].toUpperCase()}</span>
                    <div>
                      <strong>{r.name || r.email}</strong>
                      <small>{r.email}</small>
                    </div>
                  </div>
                ),
              },
              {
                key: "role",
                title: "Role",
                render: (r) => <span className="role-label">{r.role}</span>,
              },
              {
                key: "active",
                title: "Access",
                render: (r) => <Badge value={r.active} />,
              },
              {
                key: "email_verified",
                title: "Email",
                render: (r) => (
                  <span>
                    {r.email_verified ? "Verified" : "Awaiting verification"}
                  </span>
                ),
              },
              {
                key: "actions",
                title: "Actions",
                render: (r) =>
                  user.role !== "staff" &&
                  r.id !== user.id && (
                    <Action
                      run={async () => {
                        if (
                          r.active &&
                          !confirm(
                            `Deactivate ${r.email}? Their sessions will be revoked.`,
                          )
                        )
                          return;
                        await send(
                          `/users/${r.id}`,
                          { active: !r.active },
                          "PATCH",
                        );
                        reload();
                        toast("Partner access updated.");
                      }}
                    >
                      {r.active ? "Deactivate" : "Reactivate"}
                    </Action>
                  ),
              },
            ]}
          />
        )}
      </Panel>
      {open && (
        <Modal
          title={
            user.role === "affiliate" ? "Add a publisher" : "Add a partner"
          }
          onClose={() => setOpen(false)}
        >
          <Fields
            fields={[
              {
                name: "email",
                label: "Email address",
                type: "email",
                full: true,
              },
              {
                name: "password",
                label: "Initial password",
                type: "password",
                help: "12–128 characters. Share securely.",
                full: true,
              },
              {
                name: "role",
                label: "Role",
                options: roleOptions(
                  user.role === "affiliate"
                    ? ["publisher"]
                    : [
                        "affiliate",
                        "publisher",
                        "advertiser",
                        "staff",
                        "admin",
                      ],
                ),
                defaultValue:
                  user.role === "affiliate" ? "publisher" : undefined,
              },
              {
                name: "parent_user_id",
                source: parents,
                label: "Parent affiliate",
                required: false,
                options: (parents.data || [])
                  .filter((r) => r.role === "affiliate")
                  .map((r) => ({ value: r.id, label: r.email })),
                help: "Required for publishers created by a network admin.",
              },
            ].filter(
              (f) => user.role !== "affiliate" || f.name !== "parent_user_id",
            )}
            submit="Create account"
            onSubmit={async (body) => {
              if (body.role !== "publisher") delete body.parent_user_id;
              if (
                user.role === "admin" &&
                body.role === "publisher" &&
                !body.parent_user_id
              )
                throw new Error(
                  "Select a parent affiliate for this publisher.",
                );
              await send("/users", body);
              setOpen(false);
              reload();
              toast("Partner account created.");
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function LinksPage() {
  const { user } = useSession(),
    toast = useToast(),
    [version, reload] = useReload(),
    [offset, setOffset] = useState(0),
    [domain, setDomain] = useState(""),
    [open, setOpen] = useState(false),
    result = useData<Row[]>(
      `/links?${query({ offset, limit: size, tracking_domain_id: domain })}`,
      version,
    ),
    offers = useCatalog("/offers"),
    people = useCatalog(user.role !== "publisher" ? "/users" : null),
    domains = useData<Row[]>(staff(user.role) ? "/tracking-domains" : null);
  return (
    <>
      <PageHead
        title="Tracking links"
        description="One connection between every click and its outcome."
        actions={
          user.role !== "publisher" && (
            <button className="button primary" onClick={() => setOpen(true)}>
              <Plus size={17} /> Create tracking link
            </button>
          )
        }
      />
      <Panel
        title="Your connections"
        subtitle="Copy a link and add ?sub_id=your-placement to identify traffic."
        actions={
          staff(user.role) && (
            <select
              aria-label="Tracking domain"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Default tracking domain</option>
              {domains.data
                ?.filter((r) => r.active)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.hostname}
                  </option>
                ))}
            </select>
          )
        }
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={setOffset}
            hasNext={(result.data || []).length >= size}
            columns={[
              {
                key: "offer_id",
                title: "Offer",
                render: (r) => (
                  <strong>
                    {offers.data?.find((o) => o.id === r.offer_id)?.name ||
                      short(r.offer_id)}
                  </strong>
                ),
              },
              {
                key: "affiliate_id",
                title: "Partner",
                render: (r) =>
                  people.data?.find((p) => p.id === r.affiliate_id)?.email ||
                  short(r.affiliate_id),
              },
              {
                key: "url",
                title: "Tracking URL",
                render: (r) => (
                  <div className="copy-cell">
                    <code>{r.url}</code>
                    <CopyButton value={r.url} label="Copy tracking URL" />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
      {open && (
        <Modal title="Create tracking link" onClose={() => setOpen(false)}>
          <Fields
            fields={[
              {
                name: "offer_id",
                source: offers,
                label: "Offer",
                options:
                  offers.data
                    ?.filter((r) => r.active)
                    .map((r) => ({ value: r.id, label: r.name })) || [],
                full: true,
              },
              {
                name: "affiliate_id",
                source: people,
                label:
                  user.role === "affiliate"
                    ? "Publisher"
                    : "Affiliate / publisher",
                options:
                  people.data
                    ?.filter(
                      (r) =>
                        r.active &&
                        (user.role === "affiliate"
                          ? r.role === "publisher"
                          : ["affiliate", "publisher"].includes(r.role)),
                    )
                    .map((r) => ({ value: r.id, label: r.email })) || [],
                full: true,
              },
            ]}
            submit="Create link"
            onSubmit={async (body) => {
              await send(
                "/links?" + query({ tracking_domain_id: domain }),
                body,
              );
              setOpen(false);
              reload();
              toast("Tracking link created.");
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function Conversions() {
  const { user } = useSession(),
    [version, reload] = useReload(),
    [offset, setOffset] = useState(0),
    result = useData<Row[]>(
      `/conversions?offset=${offset}&limit=${size}`,
      version,
    );
  return (
    <>
      <PageHead
        title="Conversions"
        description="Every outcome, accounted for. Review and reconcile your results."
        actions={
          <button className="button secondary" onClick={reload}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />
      <Panel
        title="Conversion activity"
        subtitle="Approval records commissions. Rejection reverses previously approved earnings."
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={setOffset}
            hasNext={(result.data || []).length >= size}
            columns={[
              {
                key: "transaction_id",
                title: "Transaction",
                render: (r) => (
                  <div>
                    <strong className="mono">{r.transaction_id}</strong>
                    <small>{short(r.id)}</small>
                  </div>
                ),
              },
              {
                key: "status",
                title: "Status",
                render: (r) => <Badge value={r.status} />,
              },
              ...(!["affiliate", "publisher"].includes(user.role)
                ? [
                    {
                      key: "revenue",
                      title: "Revenue",
                      render: (r: Row) => money(r.revenue, r.currency),
                    },
                  ]
                : []),
              ...(user.role !== "advertiser"
                ? [
                    {
                      key: "payout",
                      title: "Payout",
                      render: (r: Row) => money(r.payout, r.currency),
                    },
                  ]
                : []),
              {
                key: "created_at",
                title: "Received",
                render: (r) => date(r.created_at),
              },
              ...(staff(user.role)
                ? [
                    {
                      key: "actions",
                      title: "Review",
                      render: (r: Row) => (
                        <div className="row-actions">
                          {r.status !== "approved" && (
                            <Action
                              run={async () => {
                                await send(
                                  `/conversions/${r.id}`,
                                  { status: "approved" },
                                  "PATCH",
                                );
                                reload();
                              }}
                            >
                              Approve
                            </Action>
                          )}
                          {r.status !== "rejected" && (
                            <Action
                              danger
                              run={async () => {
                                if (
                                  !confirm(
                                    "Reject this conversion? Any approved commission will be reversed.",
                                  )
                                )
                                  return;
                                await send(
                                  `/conversions/${r.id}`,
                                  { status: "rejected" },
                                  "PATCH",
                                );
                                reload();
                              }}
                            >
                              Reject
                            </Action>
                          )}
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Panel>
    </>
  );
}
export function Reports() {
  const toast = useToast(),
    [version, reload] = useReload(),
    [offset, setOffset] = useState(0),
    [dataset, setDataset] = useState("grouped"),
    [filters, setFilters] = useState<Row>(() => ({
      start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
      group_by: "offer",
    })),
    [applied, setApplied] = useState(filters),
    [exporting, setExporting] = useState(false);
  const params = query({
      ...applied,
      start: applied.start
        ? new Date(applied.start + "T00:00:00Z").toISOString()
        : undefined,
      end: applied.end
        ? new Date(applied.end + "T23:59:59.999Z").toISOString()
        : undefined,
      ...(dataset === "grouped" ? { limit: 1000 } : { offset, limit: size }),
    }),
    result = useData<Row[]>(`/reports/${dataset}?${params}`, version);
  async function exportCSV(type: string) {
    setExporting(true);
    try {
      const truncated = await download(
        `/reports/export/${type}?${params}&max_rows=100000`,
        `relay-${type}.csv`,
      );
      toast(
        truncated
          ? "Export limited to 100,000 rows. Use a smaller date range for remaining data."
          : "CSV downloaded.",
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHead
        title="Reports"
        description="Find the signal in your network’s performance."
        actions={
          <>
            <button
              className="button secondary"
              disabled={exporting}
              onClick={() => exportCSV("clicks")}
            >
              <ArrowDownToLine size={16} /> Clicks CSV
            </button>
            <button
              className="button primary"
              disabled={exporting}
              onClick={() => exportCSV("conversions")}
            >
              <ArrowDownToLine size={16} /> Conversions CSV
            </button>
          </>
        }
      />
      <form
        className="filter-panel"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...filters });
          setOffset(0);
          reload();
        }}
      >
        {[
          { key: "start", label: "From (UTC)", type: "date" },
          { key: "end", label: "Through (UTC)", type: "date" },
          { key: "offer_id", label: "Offer ID" },
          { key: "affiliate_id", label: "Partner ID" },
          { key: "country", label: "Country code" },
          { key: "sub_id", label: "Placement ID" },
        ].map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              type={f.type || "text"}
              value={filters[f.key] || ""}
              onChange={(e) =>
                setFilters({ ...filters, [f.key]: e.target.value })
              }
            />
          </label>
        ))}
        <label>
          Conversion status
          <select
            value={filters.status || ""}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All statuses</option>
            {["pending", "approved", "rejected"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Group by
          <select
            value={filters.group_by}
            onChange={(e) =>
              setFilters({ ...filters, group_by: e.target.value })
            }
          >
            {[
              "offer",
              "affiliate",
              "sub_id",
              "country",
              "device",
              "operating_system",
              "day",
              "hour",
            ].map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary">
          Apply filters <ArrowRight size={15} />
        </button>
      </form>
      <Panel
        title="Performance explorer"
        subtitle="Currency totals remain separate. Maximum reporting window: 366 days."
        actions={
          <div className="tabs">
            {["grouped", "clicks", "conversions"].map((v) => (
              <button
                className={dataset === v ? "selected" : ""}
                key={v}
                onClick={() => {
                  setDataset(v);
                  setOffset(0);
                }}
              >
                {v === "grouped" ? "Summary" : v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={dataset !== "grouped" ? setOffset : undefined}
            columns={(result.data?.length
              ? Object.keys(result.data[0])
              : dataset === "grouped"
                ? [
                    "group",
                    "currency",
                    "clicks",
                    "conversions",
                    "approved_conversions",
                  ]
                : ["id", "offer_id", "created_at"]
            ).map((key) => ({
              key,
              title: key
                .replaceAll("_", " ")
                .replace(/^./, (c) => c.toUpperCase()),
              render: (row: Row) =>
                key === "status" ? (
                  <Badge value={row[key]} />
                ) : key === "created_at" ? (
                  date(row[key])
                ) : ["revenue", "payout"].includes(key) ? (
                  money(row[key], row.currency)
                ) : (
                  String(row[key] ?? "—")
                ),
            }))}
          />
        )}
      </Panel>
    </>
  );
}
export function Domains() {
  const { user } = useSession(),
    toast = useToast(),
    [version, reload] = useReload(),
    [open, setOpen] = useState(false),
    [created, setCreated] = useState<Row | null>(null),
    result = useData<Row[]>("/tracking-domains", version);
  return (
    <>
      <PageHead
        title="Tracking domains"
        description="Your brand at every touchpoint, from first click to conversion."
        actions={
          user.role === "admin" && (
            <button className="button primary" onClick={() => setOpen(true)}>
              <Plus size={17} /> Add domain
            </button>
          )
        }
      />
      <div className="info-banner">
        <Globe2 size={24} />
        <div>
          <strong>Make every connection yours.</strong>
          <p>
            Add a dedicated tracking subdomain, verify its DNS records, and use
            it for your tracking links. Ownership renews automatically while
            your records remain installed.
          </p>
        </div>
      </div>
      {created && (
        <Panel
          title="Install these DNS records"
          subtitle="Save the TXT value now. It is only returned when the domain is created."
        >
          <div className="dns-record">
            <strong>TXT</strong>
            <code>{created.txt_name}</code>
            <code>{created.txt_value}</code>
            <CopyButton value={created.txt_value} />
          </div>
          <div className="dns-record">
            <strong>CNAME</strong>
            <code>{created.hostname}</code>
            <code>{created.cname_target}</code>
            <CopyButton value={created.cname_target} />
          </div>
        </Panel>
      )}
      <Panel
        title="Your domains"
        subtitle="Only verified domains can serve tracking traffic."
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={result.data || []}
            columns={[
              {
                key: "hostname",
                title: "Domain",
                render: (r) => (
                  <div className="cell-identity">
                    <span className="offer-avatar">
                      <Globe2 size={17} />
                    </span>
                    <strong>{r.hostname}</strong>
                  </div>
                ),
              },
              {
                key: "active",
                title: "Status",
                render: (r) => (
                  <Badge value={r.active ? "verified" : "pending"} />
                ),
              },
              {
                key: "expires_at",
                title: "Verification expires",
                render: (r) => date(r.expires_at),
              },
              {
                key: "actions",
                title: "Actions",
                render: (r) =>
                  user.role === "admin" && (
                    <div className="row-actions">
                      <Action
                        run={async () => {
                          await send(`/tracking-domains/${r.id}/verify`);
                          reload();
                          toast(
                            "Domain verified. HTTPS certificates are issued by the deployment gateway.",
                          );
                        }}
                      >
                        Verify DNS
                      </Action>
                      {r.active && (
                        <Action
                          danger
                          run={async () => {
                            if (!confirm(`Disable tracking on ${r.hostname}?`))
                              return;
                            await api(`/tracking-domains/${r.id}`, {
                              method: "DELETE",
                            });
                            reload();
                          }}
                        >
                          Disable
                        </Action>
                      )}
                    </div>
                  ),
              },
            ]}
          />
        )}
      </Panel>
      {open && (
        <Modal title="Add a tracking domain" onClose={() => setOpen(false)}>
          <Fields
            fields={[
              {
                name: "hostname",
                label: "Tracking hostname",
                placeholder: "click.yournetwork.com",
                full: true,
                help: "A dedicated subdomain, without https://, paths or wildcards.",
              },
            ]}
            submit="Add domain"
            onSubmit={async (body) => {
              setCreated(await send("/tracking-domains", body));
              setOpen(false);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function Fraud() {
  const [version, reload] = useReload(),
    result = useData<Row[]>("/fraud/events?limit=100", version);
  return (
    <>
      <PageHead
        title="Fraud protection"
        description="Keep a closer eye on the traffic that matters."
        actions={
          <button className="button secondary" onClick={reload}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />
      <div className="info-banner">
        <ShieldCheck size={26} />
        <div>
          <strong>A stronger foundation for your network.</strong>
          <p>
            Rule-based checks flag bot traffic, blocked IP networks, abnormal
            click velocity and conversions arriving too quickly. Configure these
            checks in each offer’s rules.
          </p>
        </div>
        <Link to="/offers" className="text-button">
          Offer rules <ArrowUpRight size={16} />
        </Link>
      </div>
      <Panel
        title="Flagged activity"
        subtitle="Latest 100 events. Review decisions are recorded in your audit log."
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={result.data || []}
            columns={[
              {
                key: "reason",
                title: "Detection",
                render: (r) => <strong>{r.reason.replaceAll("_", " ")}</strong>,
              },
              {
                key: "score",
                title: "Risk score",
                render: (r) => (
                  <span className="risk-score">
                    {r.score}
                    <small>/100</small>
                  </span>
                ),
              },
              {
                key: "offer_id",
                title: "Offer ID",
                render: (r) => <code>{short(r.offer_id)}</code>,
              },
              {
                key: "created_at",
                title: "Detected",
                render: (r) => date(r.created_at),
              },
              {
                key: "reviewed",
                title: "Review",
                render: (r) =>
                  r.reviewed ? (
                    <Badge value="reviewed" />
                  ) : (
                    <Action
                      run={async () => {
                        await send(`/fraud/events/${r.id}/review`);
                        reload();
                      }}
                    >
                      Mark reviewed
                    </Action>
                  ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
export function Payouts() {
  const { user } = useSession(),
    toast = useToast(),
    [version, reload] = useReload(),
    [tab, setTab] = useState("balances"),
    [offset, setOffset] = useState(0),
    [modal, setModal] = useState(""),
    [requestKey, setRequestKey] = useState(""),
    [providerNotice, setProviderNotice] = useState(""),
    people = useCatalog(
      user.role === "admin" || user.role === "staff" ? "/users" : null,
    ),
    provider = useData<Row>(
      user.role === "admin" ? "/automated-payouts/provider" : null,
      version,
    );
  const result = useData<Row[]>(
    tab === "requests"
      ? "/automated-payouts/requests?limit=100"
      : `/payouts${tab === "balances" ? "/balances" : ""}?offset=${offset}&limit=${size}`,
    version,
  );
  const recipients =
    people.data
      ?.filter((r) => ["affiliate", "publisher"].includes(r.role))
      .map((r) => ({ value: r.id, label: r.email })) || [];
  const recipient: Field = {
    name: "affiliate_id",
    source: people,
    label: "Affiliate / publisher",
    options: recipients,
    full: true,
  };
  const providerFields: Field[] = [
    { name: "key_id", label: "RazorpayX key ID", placeholder: "rzp_live_…" },
    { name: "key_secret", label: "API key secret", type: "password" },
    { name: "account_number", label: "Network funding account number" },
    {
      name: "webhook_secret",
      label: "Webhook signing secret",
      type: "password",
      help: "At least 32 characters.",
    },
    {
      name: "minimum_amount",
      label: "Minimum payout (INR)",
      type: "number",
      min: 1,
      step: "0.01",
      defaultValue: provider.data?.minimum_amount || 1000,
    },
    {
      name: "interval_hours",
      label: "Schedule interval (hours)",
      type: "number",
      min: 1,
      max: 744,
      defaultValue: provider.data?.interval_hours || 168,
    },
    {
      name: "automatic",
      label: "Enable automatic payouts from this network’s account",
      type: "checkbox",
      defaultValue: provider.data?.automatic || false,
      full: true,
    },
  ];
  return (
    <>
      <PageHead
        title="Payouts"
        description="Reward your partners. Keep every rupee accounted for."
        actions={
          <>
            {staff(user.role) && (
              <button
                className="button secondary"
                onClick={() => setModal("manual")}
              >
                Record paid transfer
              </button>
            )}
            {user.role === "admin" && (
              <button
                className="button primary"
                onClick={() => {
                  setRequestKey(crypto.randomUUID());
                  setModal("transfer");
                }}
              >
                <Plus size={17} /> New payout
              </button>
            )}
          </>
        }
      />
      {user.role === "admin" && (
        <div className="payout-provider">
          <span className="provider-logo">
            R<span>↗</span>
          </span>
          <div>
            <strong>RazorpayX · Your network’s account</strong>
            <p>
              {provider.loading
                ? "Loading provider status…"
                : provider.data?.configured
                  ? `Connected · INR · ${provider.data.automatic ? "Automatic payouts enabled" : "Manual scheduling"} · Every ${provider.data.interval_hours} hours`
                  : "Connect your own funded RazorpayX account to enable bank transfers."}
            </p>
            {provider.error && (
              <p className="danger">{provider.error.message}</p>
            )}
          </div>
          <div className="row-actions">
            <button
              className="button secondary"
              onClick={() => setModal("beneficiary")}
            >
              Add beneficiary
            </button>
            <button
              className="button secondary"
              onClick={() => setModal("provider")}
            >
              {provider.data?.configured ? "Configure" : "Connect account"}{" "}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
      )}
      {providerNotice && (
        <Secret title="Network payout webhook URL" value={providerNotice} />
      )}
      <Panel
        title="Partner accounting"
        subtitle="Available balances exclude reserved transfers. Financial totals stay separated by currency."
        actions={
          <div className="tabs">
            {["balances", "history", "requests"].map((v) => (
              <button
                key={v}
                className={tab === v ? "selected" : ""}
                onClick={() => {
                  setTab(v);
                  setOffset(0);
                }}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={tab === "requests" ? undefined : setOffset}
            columns={[
              {
                key: "affiliate_id",
                title: "Partner",
                render: (r) => (
                  <strong>
                    {people.data?.find((p) => p.id === r.affiliate_id)?.email ||
                      short(r.affiliate_id)}
                  </strong>
                ),
              },
              {
                key: tab === "balances" ? "balance" : "amount",
                title: tab === "balances" ? "Available balance" : "Amount",
                render: (r) => (
                  <strong className="amount">
                    {money(
                      tab === "balances" ? r.balance : r.amount,
                      r.currency,
                    )}
                  </strong>
                ),
              },
              ...(tab === "requests"
                ? [
                    {
                      key: "status",
                      title: "Status",
                      render: (r: Row) => <Badge value={r.status} />,
                    },
                    {
                      key: "created_at",
                      title: "Requested",
                      render: (r: Row) => date(r.created_at),
                    },
                    ...(user.role === "admin"
                      ? [
                          {
                            key: "actions",
                            title: "Actions",
                            render: (r: Row) =>
                              r.status === "queued" && (
                                <Action
                                  danger
                                  run={async () => {
                                    await send(
                                      `/automated-payouts/requests/${r.id}/cancel`,
                                    );
                                    reload();
                                    toast("Unsubmitted payout cancelled.");
                                  }}
                                >
                                  Cancel unsubmitted
                                </Action>
                              ),
                          },
                        ]
                      : []),
                  ]
                : tab === "history"
                  ? [
                      { key: "reference", title: "Reference" },
                      {
                        key: "created_at",
                        title: "Paid at",
                        render: (r: Row) => date(r.created_at),
                      },
                    ]
                  : [{ key: "currency", title: "Currency" }]),
            ]}
          />
        )}
      </Panel>
      <div className="footnote">
        <ShieldCheck size={16} /> Transfers with an uncertain provider result
        remain reserved until reconciled, preventing duplicate spending.
      </div>
      {modal && (
        <Modal
          title={
            modal === "provider"
              ? "Connect network RazorpayX account"
              : modal === "beneficiary"
                ? "Register a beneficiary"
                : modal === "manual"
                  ? "Record a completed transfer"
                  : "Create an INR bank payout"
          }
          onClose={() => setModal("")}
        >
          {modal === "provider" ? (
            <>
              <div className="notice">
                Use this network’s own credentials. Automatic payouts are
                opt-in. Changing credentials requires entering the complete
                secret set.
              </div>
              <Fields
                fields={providerFields}
                submit="Save network account"
                onSubmit={async (body) => {
                  const r = await send(
                    "/automated-payouts/provider",
                    body,
                    "PUT",
                  );
                  setProviderNotice(r.webhook_url || "");
                  setModal("");
                  reload();
                  toast("Network payout account configured.");
                }}
              />
            </>
          ) : modal === "beneficiary" ? (
            <Fields
              fields={[
                recipient,
                {
                  name: "fund_account_id",
                  label: "RazorpayX fund account ID",
                  placeholder: "fa_…",
                  full: true,
                  help: "Create this beneficiary in this network’s RazorpayX account first.",
                },
              ]}
              submit="Verify and save beneficiary"
              onSubmit={async (body) => {
                await send("/automated-payouts/beneficiaries", body, "PUT");
                setModal("");
                toast("Beneficiary verified using your network’s account.");
              }}
            />
          ) : modal === "manual" ? (
            <Fields
              fields={[
                recipient,
                {
                  name: "amount",
                  label: "Amount transferred",
                  type: "number",
                  min: 0.0001,
                  step: "0.0001",
                },
                { name: "currency", label: "Currency", defaultValue: "INR" },
                {
                  name: "reference",
                  label: "Unique bank/provider reference",
                  full: true,
                },
              ]}
              submit="Record completed transfer"
              onSubmit={async (body) => {
                await send("/payouts", body);
                setModal("");
                reload();
                toast("Completed transfer recorded.");
              }}
            >
              <label className="check-label consent">
                <input type="checkbox" required /> This transfer has already
                been completed outside Relay.
              </label>
            </Fields>
          ) : (
            <Fields
              fields={[
                recipient,
                {
                  name: "amount",
                  label: "Amount (INR)",
                  type: "number",
                  min: 0.01,
                  step: "0.01",
                  full: true,
                },
              ]}
              submit="Queue bank transfer"
              onSubmit={async (body) => {
                await send("/automated-payouts/requests", {
                  ...body,
                  request_key: requestKey,
                });
                setModal("");
                setTab("requests");
                reload();
                toast(
                  "Payout queued. Your network’s account funds this transfer.",
                );
              }}
            >
              <div className="notice">
                This action initiates an IMPS bank transfer using your network’s
                RazorpayX account. Review the recipient and amount before
                submitting.
              </div>
              <label className="check-label consent">
                <input type="checkbox" required /> I have checked the recipient
                and amount and authorize this transfer.
              </label>
            </Fields>
          )}
        </Modal>
      )}
    </>
  );
}
export function Billing() {
  const toast = useToast(),
    [version, reload] = useReload(),
    workspace = useData<Row>("/workspace", version),
    plans = useData<Row[]>("/billing/plans", version),
    invoices = useData<Row>("/billing/invoices", version);
  return (
    <>
      <PageHead
        title="Plan & billing"
        description="The right foundation for your next stage of growth."
        actions={
          <Action
            run={async () => {
              await send("/billing/reconcile");
              reload();
              toast("Subscription reconciled with Razorpay.");
            }}
          >
            <RefreshCw size={16} /> Sync billing
          </Action>
        }
      />
      {workspace.error ? (
        <ErrorBox error={workspace.error} />
      ) : (
        <section className="billing-hero">
          <span className="pill">
            <Zap size={15} /> YOUR CURRENT PLAN
          </span>
          <h2>
            {workspace.data?.plan || "Loading"}
            <Badge value={workspace.data?.subscription_status} />
          </h2>
          <p>
            {workspace.data?.plan === "trial"
              ? `Your free trial ends ${date(workspace.data?.trial_ends_at)}. No credit card is required during your trial.`
              : `Current paid period ends ${date(workspace.data?.paid_until)}.`}
          </p>
          <div className="row-actions">
            {workspace.data?.subscription_status === "active" && (
              <Action
                run={async () => {
                  if (
                    !confirm(
                      "Pause your subscription now? Business operations may become unavailable.",
                    )
                  )
                    return;
                  await send("/billing/pause");
                  reload();
                }}
              >
                Pause subscription
              </Action>
            )}
            {workspace.data?.subscription_status === "paused" && (
              <Action
                run={async () => {
                  await send("/billing/resume");
                  reload();
                }}
              >
                Resume subscription
              </Action>
            )}
            {workspace.data?.plan !== "trial" && (
              <Action
                danger
                run={async () => {
                  if (!confirm("Cancel at the end of this billing cycle?"))
                    return;
                  await send("/billing/cancel");
                  reload();
                  toast(
                    "Cancellation requested for the end of the billing cycle.",
                  );
                }}
              >
                Cancel at cycle end
              </Action>
            )}
          </div>
        </section>
      )}
      <Panel
        title="Plans that grow with you"
        subtitle="Checkout displays the provider’s current price and billing terms."
      >
        {plans.error ? (
          <ErrorBox error={plans.error} />
        ) : plans.loading ? (
          <Loading />
        ) : !plans.data?.length ? (
          <Empty
            title="Plans aren’t configured yet"
            description="Your platform administrator needs to connect Razorpay plans."
          />
        ) : (
          <div className="plan-grid">
            {plans.data.map((p) => (
              <article className="plan-card" key={p.id}>
                <span className="eyebrow">RELAY FOR NETWORKS</span>
                <h3>{p.id}</h3>
                <p>Everything you need to keep your network moving.</p>
                <ul>
                  {Object.entries(p.limits).map(([key, value]) => (
                    <li key={key}>
                      <Check size={16} />
                      {String(value)} {key.replaceAll("_", " ")}
                    </li>
                  ))}
                </ul>
                <Action
                  run={async () => {
                    const r = await send("/billing/subscribe", { plan: p.id });
                    const url = new URL(r.checkout_url);
                    if (url.protocol !== "https:")
                      throw new Error("Invalid checkout URL");
                    window.location.assign(url.href);
                  }}
                >
                  Continue to secure checkout <ArrowUpRight size={16} />
                </Action>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel
        title="Invoices"
        subtitle="Invoices retrieved directly from your billing provider."
      >
        {invoices.error ? (
          <ErrorBox error={invoices.error} />
        ) : invoices.loading ? (
          <Loading />
        ) : (
          <Table
            rows={invoices.data?.items || []}
            columns={[
              {
                key: "id",
                title: "Invoice",
                render: (r) => <code>{r.id}</code>,
              },
              {
                key: "status",
                title: "Status",
                render: (r) => <Badge value={r.status} />,
              },
              {
                key: "amount",
                title: "Amount",
                render: (r) => money(Number(r.amount || 0) / 100, r.currency),
              },
              {
                key: "short_url",
                title: "Receipt",
                render: (r) =>
                  r.short_url && /^https:\/\//.test(r.short_url) ? (
                    <a
                      className="text-button"
                      href={r.short_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View invoice <ExternalLink size={14} />
                    </a>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
export function Settings() {
  const { user } = useSession(),
    toast = useToast(),
    [tab, setTab] = useState("account"),
    [version, reload] = useReload(),
    [offset, setOffset] = useState(0),
    [secret, setSecret] = useState(""),
    workspace = useData<Row>("/workspace"),
    result = useData<Row[]>(
      tab === "audit"
        ? `/audit-events?offset=${offset}&limit=${size}`
        : tab === "deliveries"
          ? `/deliveries?offset=${offset}&limit=${size}`
          : null,
      version,
    ),
    people = useCatalog(
      staff(user.role) && tab === "webhooks" ? "/users" : null,
    );
  const tabs = [
    "account",
    ...(["admin", "platform_admin"].includes(user.role) ? ["audit"] : []),
    ...(staff(user.role) ? ["deliveries"] : []),
    ...(["admin", "staff", "affiliate", "publisher"].includes(user.role)
      ? ["webhooks"]
      : []),
  ];
  return (
    <>
      <PageHead
        title="Settings"
        description="The details that keep your network running smoothly."
      />
      <div className="settings-tabs">
        {tabs.map((v) => (
          <button
            className={tab === v ? "selected" : ""}
            key={v}
            onClick={() => {
              setTab(v);
              setOffset(0);
            }}
          >
            {v === "audit" ? "Audit log" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      {tab === "account" ? (
        <div className="settings-grid">
          <Panel
            title="Your account"
            subtitle="Your identity and network details."
          >
            <dl className="detail-list">
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd className="role-label">{user.role.replace("_", " ")}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{workspace.data?.name || "—"}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{workspace.data?.plan || "—"}</dd>
              </div>
              {Object.entries(workspace.data?.profile || {}).map(
                ([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>
                      {Array.isArray(value)
                        ? value
                            .map((v) => String(v).replaceAll("_", " "))
                            .join(", ")
                        : String(value ?? "—")}
                    </dd>
                  </div>
                ),
              )}
            </dl>
            {workspace.error && <ErrorBox error={workspace.error} />}
          </Panel>
          <Panel
            title="Security & access"
            subtitle="Manage your credentials and active sessions."
          >
            <div className="security-item">
              <ShieldCheck size={24} />
              <h3>A secure place to connect.</h3>
              <p>
                Passwords are protected by the API. Refresh sessions rotate
                automatically and access tokens stay in memory.
              </p>
              <Link className="button secondary" to="/account?action=forgot">
                Reset your password <ArrowUpRight size={15} />
              </Link>
              <Action
                danger
                run={async () => {
                  if (!confirm("Sign out all sessions on every device?"))
                    return;
                  await endSession(true);
                }}
              >
                Sign out all devices
              </Action>
            </div>
          </Panel>
        </div>
      ) : tab === "webhooks" ? (
        <Panel
          title="Conversion notifications"
          subtitle="Configure a partner HTTPS webhook. Saving rotates the signing secret."
        >
          {secret && <Secret title="Webhook signing secret" value={secret} />}
          <div className="panel-form">
            <Fields
              fields={[
                ...(staff(user.role)
                  ? [
                      {
                        name: "affiliate_id",
                        source: people,
                        label: "Partner",
                        options:
                          people.data
                            ?.filter((r) =>
                              ["affiliate", "publisher"].includes(r.role),
                            )
                            .map((r) => ({ value: r.id, label: r.email })) ||
                          [],
                        full: true,
                      },
                    ]
                  : []),
                {
                  name: "url",
                  label: "HTTPS callback URL",
                  type: "url",
                  placeholder: "https://partner.example.com/conversions",
                  full: true,
                  help: "The destination must be permitted by the server’s outbound allowlist.",
                },
              ]}
              submit="Save and rotate secret"
              onSubmit={async (body) => {
                if (!confirm("Save endpoint and rotate its signing secret?"))
                  return;
                const r = await send(
                  "/webhooks",
                  { ...body, affiliate_id: body.affiliate_id || user.id },
                  "PUT",
                );
                setSecret(r.secret);
                toast("Webhook configured. Save the signing secret securely.");
              }}
            />
          </div>
        </Panel>
      ) : (
        <Panel
          title={tab === "audit" ? "Audit trail" : "Delivery queue"}
          subtitle="Latest activity with server-enforced network visibility."
        >
          {result.error ? (
            <ErrorBox error={result.error} />
          ) : result.loading ? (
            <Loading />
          ) : (
            <Table
              rows={result.data || []}
              offset={offset}
              setOffset={setOffset}
              hasNext={(result.data || []).length >= size}
              columns={
                tab === "audit"
                  ? [
                      {
                        key: "action",
                        title: "Action",
                        render: (r) => <strong>{r.action}</strong>,
                      },
                      {
                        key: "actor_id",
                        title: "Actor",
                        render: (r) => <code>{short(r.actor_id)}</code>,
                      },
                      { key: "detail", title: "Detail" },
                      {
                        key: "created_at",
                        title: "When",
                        render: (r) => date(r.created_at),
                      },
                    ]
                  : [
                      { key: "kind", title: "Type" },
                      {
                        key: "status",
                        title: "Status",
                        render: (r) => <Badge value={r.status} />,
                      },
                      { key: "attempts", title: "Attempts" },
                      { key: "last_error", title: "Last error" },
                      {
                        key: "created_at",
                        title: "Created",
                        render: (r) => date(r.created_at),
                      },
                      {
                        key: "actions",
                        title: "Actions",
                        render: (r) =>
                          user.role === "admin" &&
                          r.status === "failed" && (
                            <Action
                              run={async () => {
                                await send(`/deliveries/${r.id}/retry`);
                                reload();
                              }}
                            >
                              Retry delivery
                            </Action>
                          ),
                      },
                    ]
              }
            />
          )}
        </Panel>
      )}
    </>
  );
}
export function Platform() {
  const toast = useToast(),
    [version, reload] = useReload(),
    [offset, setOffset] = useState(0),
    summary = useData<Row>("/platform/summary", version),
    result = useData<Row[]>(
      `/platform/workspaces?offset=${offset}&limit=${size}`,
      version,
    );
  return (
    <>
      <PageHead
        eyebrow="PLATFORM OWNER"
        title="Platform overview"
        description="A clear view across the networks you power."
        actions={
          <button className="button secondary" onClick={reload}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />
      {summary.error ? (
        <ErrorBox error={summary.error} />
      ) : (
        <div className="metrics">
          {[
            { key: "workspaces", label: "Networks", icon: Globe2 },
            { key: "users", label: "Total users", icon: Users },
            {
              key: "active_subscriptions",
              label: "Active subscriptions",
              icon: CircleDollarSign,
            },
            {
              key: "pending_deliveries",
              label: "Pending deliveries",
              icon: Zap,
            },
          ].map((m, i) => (
            <Metric
              key={m.key}
              label={m.label}
              value={summary.data?.[m.key] ?? "—"}
              icon={m.icon}
              hint="Across the platform"
              featured={i === 0}
            />
          ))}
        </div>
      )}
      <Panel
        title="Customer networks"
        subtitle="Manage subscription visibility and network suspension."
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={setOffset}
            hasNext={(result.data || []).length >= size}
            columns={[
              {
                key: "name",
                title: "Network",
                render: (r) => <strong>{r.name}</strong>,
              },
              {
                key: "active",
                title: "Access",
                render: (r) => <Badge value={r.active} />,
              },
              { key: "plan", title: "Plan" },
              {
                key: "subscription_status",
                title: "Subscription",
                render: (r) => <Badge value={r.subscription_status} />,
              },
              {
                key: "created_at",
                title: "Created",
                render: (r) => date(r.created_at),
              },
              {
                key: "actions",
                title: "Actions",
                render: (r) => (
                  <Action
                    danger={r.active}
                    run={async () => {
                      if (
                        !confirm(
                          `${r.active ? "Suspend" : "Reactivate"} ${r.name}?`,
                        )
                      )
                        return;
                      await send(
                        `/platform/workspaces/${r.id}`,
                        { active: !r.active },
                        "PATCH",
                      );
                      reload();
                      toast("Network access updated.");
                    }}
                  >
                    {r.active ? "Suspend" : "Reactivate"}
                  </Action>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
