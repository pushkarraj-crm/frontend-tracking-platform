import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CircleDollarSign,
  MousePointer2,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import { query, type Row } from "./api";
import { useData } from "./hooks";
import { staff, useAccountType, useSession } from "./context";
import { date, money, short } from "./format";
import { Badge, ErrorBox, Loading, PageHead, Panel, Table } from "./ui";
import { AccountManagerCard } from "./teams";

const toneColor: Record<string, string> = {
  violet: "#8b5cf6",
  green: "#16b47a",
  orange: "#ff8a3d",
  sky: "#2f8cff",
};
const stageColors = ["#6d4aff", "#16b47a", "#ff8a3d", "#2f8cff", "#ff5379"];
const paceLabels: Record<string, string> = {
  ahead: "On track",
  behind: "Behind pace",
  met: "Met",
  missed: "Missed",
  not_started: "Not started",
};

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => `${(i * 110) / (values.length - 1)},${30 - (v / max) * 26}`)
    .join(" ");
  return (
    <svg className="kpi-spark" width="110" height="32" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({
  tone,
  icon: Icon,
  label,
  value,
  change,
  hint,
  spark,
}: {
  tone: string;
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  change: number | null;
  hint: string;
  spark: number[];
}) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <span className="kpi-icon">
        <Icon size={20} />
      </span>
      <small className="kpi-label">{label}</small>
      <strong>{value}</strong>
      <p className="kpi-change">
        {change === null ? (
          hint
        ) : (
          <>
            <b className={change >= 0 ? "up" : "down"}>
              {change >= 0 ? "↗" : "↘"} {Math.abs(change).toFixed(1)}%
            </b>{" "}
            vs previous period
          </>
        )}
      </p>
      <Sparkline values={spark} color={toneColor[tone]} />
    </article>
  );
}

function Donut({ slices }: { slices: { label: string; value: number }[] }) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  if (!total)
    return <p className="muted">Conversions by stage will appear here.</p>;
  // Each slice starts where the previous ones end (25 = the top of the ring).
  const shares = slices.map((s) => (s.value / total) * 100);
  const offsets = shares.map(
    (_, i) => 25 - shares.slice(0, i).reduce((t, v) => t + v, 0),
  );
  return (
    <div className="donut-wrap">
      <svg
        viewBox="0 0 42 42"
        className="donut"
        role="img"
        aria-label="Conversions by stage"
      >
        {slices.map((s, i) => (
          <circle
            key={s.label}
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke={stageColors[i % stageColors.length]}
            strokeWidth="6"
            strokeDasharray={`${shares[i]} ${100 - shares[i]}`}
            strokeDashoffset={offsets[i]}
          />
        ))}
        <text x="21" y="21" textAnchor="middle" className="donut-total">
          {total.toLocaleString("en-IN")}
        </text>
        <text x="21" y="26" textAnchor="middle" className="donut-caption">
          conversions
        </text>
      </svg>
      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <i style={{ background: stageColors[i % stageColors.length] }} />
            <span>{s.label}</span>
            <b>{s.value.toLocaleString("en-IN")}</b>
            <small>{((s.value / total) * 100).toFixed(0)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Trend({
  days,
}: {
  days: { day: string; clicks: number; conversions: number }[];
}) {
  if (!days.length)
    return (
      <p className="muted">
        Share a tracking link. Clicks and conversions will appear here.
      </p>
    );
  const maxClicks = Math.max(1, ...days.map((d) => d.clicks));
  const maxConv = Math.max(1, ...days.map((d) => d.conversions));
  const x = (i: number) => 30 + (i * 680) / Math.max(1, days.length - 1);
  const line = (key: "clicks" | "conversions", max: number) =>
    days.map((d, i) => `${x(i)},${180 - (d[key] / max) * 150}`).join(" ");
  const clicks = line("clicks", maxClicks);
  return (
    <div className="trend">
      <div className="trend-legend">
        <span>
          <i className="dot violet" /> Clicks
        </span>
        <span>
          <i className="dot teal" /> Conversions
        </span>
      </div>
      <svg
        viewBox="0 0 740 200"
        role="img"
        aria-label="Daily clicks and conversions"
      >
        <defs>
          <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6d4aff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#6d4aff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 80, 130, 180].map((y) => (
          <line key={y} x1="30" x2="710" y1={y} y2={y} stroke="#f0eff8" />
        ))}
        <polygon
          points={`30,180 ${clicks} ${x(days.length - 1)},180`}
          fill="url(#trend-area)"
        />
        <polyline
          points={clicks}
          fill="none"
          stroke="#6d4aff"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <polyline
          points={line("conversions", maxConv)}
          fill="none"
          stroke="#00b896"
          strokeWidth="2.5"
          strokeDasharray="5 4"
          strokeLinejoin="round"
        />
        {days.map((d, i) => (
          <circle
            key={d.day}
            cx={x(i)}
            cy={180 - (d.clicks / maxClicks) * 150}
            r="4"
            fill="#fff"
            stroke="#6d4aff"
            strokeWidth="2"
          >
            <title>
              {d.day}: {d.clicks} clicks, {d.conversions} conversions
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{days[0].day}</span>
        <span>{days.at(-1)?.day}</span>
      </div>
    </div>
  );
}

function Ranking({
  rows,
}: {
  rows: { label: string; value: number; sub: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="muted">No activity in this period.</p>;
  return (
    <ul className="ranking">
      {rows.map((r, i) => (
        <li key={r.label + i}>
          <span
            className="rank-avatar"
            style={{ background: stageColors[i % stageColors.length] }}
          >
            {r.label.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{r.label}</strong>
            <small>{r.sub}</small>
            <div className="target-bar">
              <i style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
          <b>{r.value.toLocaleString("en-IN")}</b>
        </li>
      ))}
    </ul>
  );
}

// Brand home: each campaign goal and its per-agency split, with pace for the date range.
function TargetProgress({ version }: { version: number }) {
  const targets = useData<Row[]>("/targets", version);
  if (targets.error) return <ErrorBox error={targets.error} />;
  if (!targets.data) return <Loading />;
  return (
    <Panel
      title="Sales targets"
      subtitle="Progress counts approved and pending conversions; targets never block extra sales."
    >
      {targets.data.length === 0 ? (
        <p className="muted">
          Add targets in Campaign workspace → Sales targets to track each
          agency's goal here.
        </p>
      ) : (
        <div className="target-grid">
          {targets.data.map((t) => (
            <div className="target-card" key={t.id}>
              <small>{t.campaign_name}</small>
              <strong>{t.name}</strong>
              <div className="target-row">
                <span>
                  {t.achieved} / {t.amount}
                </span>
                <b>{t.percent}%</b>
              </div>
              <div
                className="target-bar"
                role="progressbar"
                aria-label={`${t.name} progress`}
                aria-valuenow={Math.min(t.percent, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i
                  className={`pace-${t.pace}`}
                  style={{ width: `${Math.min(t.percent, 100)}%` }}
                />
              </div>
              <div className="target-row">
                <Badge value={paceLabels[t.pace] || t.pace} />
                <span>Commission {money(t.commission, t.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

const percentChange = (now: number, before: number) =>
  before ? ((now - before) / before) * 100 : null;
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
};

export function Dashboard() {
  const { user } = useSession(),
    brand = useAccountType() === "brand",
    manager = staff(user.role),
    partner = ["affiliate", "publisher"].includes(user.role),
    [days, setDays] = useState("30"),
    [version, setVersion] = useState(0);
  const [now] = useState(Date.now);
  const { current, previous } = useMemo(() => {
    const span = Number(days) * 86400000;
    const start = new Date(now - span).toISOString();
    return {
      current: query({ start }),
      previous: query({
        start: new Date(now - 2 * span).toISOString(),
        end: start,
      }),
    };
  }, [days, now]);
  const summary = useData<Row>("/reports/summary?" + current, version),
    before = useData<Row>("/reports/summary?" + previous, version),
    daily = useData<Row[]>("/reports/grouped?group_by=day&" + current, version),
    stages = useData<Row[]>(
      "/reports/grouped?group_by=event&" + current,
      version,
    ),
    partners = useData<Row[]>(
      manager ? "/reports/grouped?group_by=affiliate&" + current : null,
      version,
    ),
    countries = useData<Row[]>(
      "/reports/grouped?group_by=country&" + current,
      version,
    ),
    people = useData<Row[]>(manager ? "/users?limit=100" : null),
    recent = useData<Row[]>("/conversions?limit=6", version);
  const amountKey = partner ? "payout" : "revenue";
  const total = (data: Row | null) => {
    const row = data?.totals?.[0];
    return {
      clicks: Number(data?.clicks || 0),
      approved: (data?.totals || []).reduce(
        (t: number, r: Row) => t + r.approved_conversions,
        0,
      ),
      amount: Number(row?.[amountKey] || 0),
      currency: row?.currency || "INR",
      unique: Number(data?.approved_unique_clicks ?? 0),
    };
  };
  const nowTotals = total(summary.data),
    beforeTotals = total(before.data);
  const rate = (t: ReturnType<typeof total>) =>
    t.clicks ? ((t.unique || t.approved) / t.clicks) * 100 : 0;
  const series = useMemo(() => {
    const byDay = new Map<
      string,
      { day: string; clicks: number; conversions: number; amount: number }
    >();
    for (const r of daily.data || []) {
      const day = String(r.group).slice(0, 10);
      const d = byDay.get(day) || { day, clicks: 0, conversions: 0, amount: 0 };
      d.clicks += r.clicks;
      d.conversions += r.approved_conversions || 0;
      d.amount += Number(r[amountKey] || 0);
      byDay.set(day, d);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [daily.data, amountKey]);
  const slices = (stages.data || [])
    .filter((r) => r.group && r.conversions)
    .map((r) => ({
      label:
        r.group === "initial"
          ? "Main conversion"
          : String(r.group).replaceAll("_", " "),
      value: r.conversions,
    }))
    .sort((a, b) => b.value - a.value);
  const name = (id: string) => {
    const p = people.data?.find((u) => u.id === id);
    return p?.name || p?.email || short(id);
  };
  const topPartners = (partners.data || [])
    .slice()
    .sort(
      (a, b) =>
        b.approved_conversions - a.approved_conversions || b.clicks - a.clicks,
    )
    .slice(0, 5)
    .map((r) => ({
      label: name(r.group),
      value: r.approved_conversions,
      sub: `${r.clicks.toLocaleString("en-IN")} clicks`,
    }));
  const topCountries = (countries.data || [])
    .filter((r) => r.group)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5)
    .map((r) => ({
      label: r.group,
      value: r.clicks,
      sub: `${r.approved_conversions} conversions`,
    }));
  // Greet by first name only when the account has one; never by email address.
  const firstName = String(user.name || "")
    .trim()
    .split(" ")[0];
  return (
    <>
      <PageHead
        eyebrow="OVERVIEW"
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description={
          brand
            ? "How your agencies and campaigns performed."
            : partner
              ? "How your traffic performed."
              : "How your network performed."
        }
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
            <button
              className="button secondary"
              onClick={() => setVersion((v) => v + 1)}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </>
        }
      />
      {summary.error ? (
        <ErrorBox
          error={summary.error}
          retry={() => setVersion((v) => v + 1)}
        />
      ) : summary.loading ? (
        <Loading />
      ) : (
        <div className="kpi-grid">
          <KpiCard
            tone="violet"
            icon={MousePointer2}
            label="Clicks"
            value={nowTotals.clicks.toLocaleString("en-IN")}
            change={percentChange(nowTotals.clicks, beforeTotals.clicks)}
            hint="Traffic across your campaigns"
            spark={series.map((d) => d.clicks)}
          />
          <KpiCard
            tone="green"
            icon={Zap}
            label="Approved conversions"
            value={nowTotals.approved.toLocaleString("en-IN")}
            change={percentChange(nowTotals.approved, beforeTotals.approved)}
            hint="Verified conversions"
            spark={series.map((d) => d.conversions)}
          />
          <KpiCard
            tone="orange"
            icon={CircleDollarSign}
            label={partner ? "Commission earned" : "Approved revenue"}
            value={money(nowTotals.amount, nowTotals.currency)}
            change={percentChange(nowTotals.amount, beforeTotals.amount)}
            hint={
              (summary.data?.totals?.length || 0) > 1
                ? "First currency shown · see reports for all"
                : "Approved conversions only"
            }
            spark={series.map((d) => d.amount)}
          />
          <KpiCard
            tone="sky"
            icon={TrendingUp}
            label="Conversion rate"
            value={`${rate(nowTotals).toFixed(2)}%`}
            change={percentChange(rate(nowTotals), rate(beforeTotals))}
            hint="Clicks that converted"
            spark={series.map((d) =>
              d.clicks ? (d.conversions / d.clicks) * 100 : 0,
            )}
          />
        </div>
      )}
      <div className="home-grid">
        <Panel
          title="Conversions by stage"
          subtitle="Leads and the paid stages after them."
        >
          {stages.error ? (
            <ErrorBox error={stages.error} />
          ) : (
            <Donut slices={slices} />
          )}
        </Panel>
        <Panel
          title="Performance trend"
          subtitle={`Daily, last ${days} days (UTC).`}
        >
          {daily.error ? (
            <ErrorBox error={daily.error} />
          ) : daily.loading ? (
            <Loading />
          ) : (
            <Trend days={series} />
          )}
        </Panel>
      </div>
      {brand && manager && <TargetProgress version={version} />}
      <div className="home-grid wide-left">
        <Panel
          title="Latest conversions"
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
                  title: "Reference",
                  render: (r) => (
                    <strong className="mono">{r.transaction_id}</strong>
                  ),
                },
                {
                  key: "event_key",
                  title: "Stage",
                  render: (r) => (
                    <span className="pill pill-stage">
                      {!r.event_key || r.event_key === "initial"
                        ? "Main"
                        : String(r.event_key).replaceAll("_", " ")}
                    </span>
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
        <Panel
          title={
            manager
              ? brand
                ? "Top agencies"
                : "Top partners"
              : "Top countries"
          }
        >
          {manager ? (
            partners.error ? (
              <ErrorBox error={partners.error} />
            ) : (
              <Ranking rows={topPartners} />
            )
          ) : countries.error ? (
            <ErrorBox error={countries.error} />
          ) : (
            <Ranking rows={topCountries} />
          )}
          {manager && (
            <>
              <h3 className="ranking-title">Top countries</h3>
              <Ranking rows={topCountries} />
            </>
          )}
        </Panel>
      </div>
      <section className="home-banner">
        <div>
          <strong>
            {manager
              ? "Bank or brand sent this week's report?"
              : "Looking for your next campaign?"}
          </strong>
          <p>
            {manager
              ? "Upload the MIS file to approve leads, disbursals and sales in one go."
              : "Browse the campaigns open to you and get your tracking link in seconds."}
          </p>
        </div>
        <Link
          className="banner-cta"
          to={manager ? "/tools?tab=mis-upload" : "/offers"}
        >
          {manager ? "Upload MIS" : "Explore campaigns"}{" "}
          <ArrowUpRight size={16} />
        </Link>
      </section>
      {["advertiser", "affiliate", "publisher"].includes(user.role) && (
        <AccountManagerCard />
      )}
    </>
  );
}
