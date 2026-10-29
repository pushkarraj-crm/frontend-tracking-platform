import { useState, type FormEvent } from "react";
import { send, type Row, type Role } from "./api";
import { staff, useAccountType } from "./context";
import { useCatalog, useData } from "./hooks";
import { ErrorBox, PageHead } from "./ui";
import { platformTemplates } from "./platform-templates";

type Stage = {
  code: string;
  name: string;
  payout: string;
  revenue: string;
  auto_approve: boolean;
};
type Template = {
  id: string;
  title: string;
  description: string;
  model: "CPL" | "CPS";
  payout: string;
  revenue: string;
  percentage?: string;
  category: string;
  attributionDays: number;
  stages: Stage[];
};
const stage = (
  code: string,
  name: string,
  payout: string,
  revenue: string,
) => ({
  code,
  name,
  payout,
  revenue,
  auto_approve: false,
});
// Starting points for Relay's verticals; every value stays editable.
const campaignTemplates: Template[] = [
  {
    id: "loan",
    title: "Fintech: personal loan",
    description:
      "Lead, then paid stages when the lender approves and disburses.",
    model: "CPL",
    payout: "50",
    revenue: "60",
    category: "Loans",
    attributionDays: 60,
    stages: [
      stage("approved", "Loan approved", "200", "250"),
      stage("disbursed", "Loan disbursed", "500", "650"),
    ],
  },
  {
    id: "card",
    title: "Fintech: credit card",
    description: "Application, approval and card activation.",
    model: "CPL",
    payout: "30",
    revenue: "40",
    category: "Credit cards",
    attributionDays: 60,
    stages: [
      stage("approved", "Card approved", "300", "400"),
      stage("card_activated", "Card activated", "800", "1000"),
    ],
  },
  {
    id: "d2c",
    title: "D2C: online sale",
    description: "Percentage of each order. Approve after the return window.",
    model: "CPS",
    payout: "0",
    revenue: "0",
    percentage: "8",
    category: "E-commerce",
    attributionDays: 30,
    stages: [],
  },
  {
    id: "influencer",
    title: "Influencer deal",
    description: "A creator's commission on sales from their posts.",
    model: "CPS",
    payout: "0",
    revenue: "0",
    percentage: "10",
    category: "Influencer",
    attributionDays: 30,
    stages: [],
  },
  {
    id: "blank",
    title: "Start from scratch",
    description: "One conversion, fixed payout.",
    model: "CPL",
    payout: "5",
    revenue: "10",
    category: "",
    attributionDays: 30,
    stages: [],
  },
];
const devices = ["mobile", "desktop", "tablet"];
const systems = ["android", "ios", "windows", "macos"];

export function CampaignBuilder({
  users,
  role,
  close,
  created,
}: {
  users: ReturnType<typeof useCatalog>;
  role: Role;
  close: () => void;
  created: (row: Row) => void;
}) {
  const accountType = useAccountType(),
    influencer = accountType === "influencer",
    network = accountType === "network",
    chooseAdvertiser = staff(role) && network;
  const [template, setTemplate] = useState(
    influencer ? campaignTemplates[3] : campaignTemplates[4],
  );
  const [model, setModel] = useState(template.model),
    [stages, setStages] = useState<Stage[]>(template.stages),
    [destination, setDestination] = useState(""),
    [platform, setPlatform] = useState("own"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  // Creators choose one of their brands (login-less records) as the deal's advertiser.
  const [brandVersion, setBrandVersion] = useState(0),
    [newBrand, setNewBrand] = useState(""),
    [brandId, setBrandId] = useState("");
  const brands = useData<Row[]>(influencer ? "/brands" : null, brandVersion);
  function choose(next: Template) {
    setTemplate(next);
    setModel(next.model);
    setStages(next.stages);
  }
  const clickParameter =
    platformTemplates.find((t) => t.id === platform)?.clickParameter ||
    "click_id";
  function addClickId() {
    if (!destination || destination.includes("{click_id}")) return;
    const joiner = destination.includes("?") ? "&" : "?";
    setDestination(`${destination}${joiner}${clickParameter}={click_id}`);
  }
  async function addBrand() {
    if (!newBrand.trim()) return;
    setError(null);
    try {
      const brand = await send<Row>("/brands", { name: newBrand.trim() });
      setBrandId(brand.id);
      setNewBrand("");
      setBrandVersion((v) => v + 1);
    } catch (e) {
      setError(e as Error);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) || "").trim();
    const list = (key: string) =>
      value(key)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    const checked = (key: string) => data.getAll(key).map(String);
    // Dates are whole UTC days: a campaign ending on a date runs through that day.
    const date = (key: string, time: string) =>
      value(key) ? new Date(`${value(key)}T${time}Z`).toISOString() : null;
    const payout = value("payout") || "0";
    setBusy(true);
    setError(null);
    try {
      const campaign = await send<Row>("/campaigns", {
        name: value("name"),
        description: value("description"),
        ...(chooseAdvertiser || influencer
          ? { advertiser_id: value("advertiser_id") }
          : {}),
        campaign_model: model,
        destination_url: value("destination_url"),
        // Brands and creators have no separate advertiser price.
        revenue: model === "CPS" ? "0" : network ? value("revenue") : payout,
        payout: model === "CPS" ? "0" : payout,
        ...(model === "CPS"
          ? { sale_percentage: value("sale_percentage") }
          : {}),
        currency: value("currency").toUpperCase(),
        active: value("status") === "active",
        attribution_hours: Number(value("attribution_days") || 30) * 24,
        settings: {
          visibility: influencer ? "private" : value("visibility"),
          categories: list("categories"),
          preview_url: value("preview_url") || null,
          external_id: value("external_id"),
          terms: value("terms"),
          internal_notes: value("internal_notes"),
          deep_link_enabled: data.get("deep_links") === "on",
          initial_auto_approve: data.get("auto_approve") === "on",
          cap_action: value("cap_action"),
        },
        tracking_rules: {
          countries: list("countries").map((v) => v.toUpperCase()),
          devices: checked("devices"),
          operating_systems: checked("operating_systems"),
          starts_at: date("starts_on", "00:00:00"),
          ends_at: date("ends_on", "23:59:59"),
          ...(value("daily_conversions")
            ? { daily_conversions: Number(value("daily_conversions")) }
            : {}),
        },
        events: stages.map((s) => ({
          code: s.code,
          name: s.name,
          payout: s.payout || "0",
          revenue: network ? s.revenue || "0" : s.payout || "0",
          auto_approve: s.auto_approve,
        })),
      });
      created(campaign);
    } catch (e) {
      setError(e as Error);
      window.scrollTo({ top: 0 });
    } finally {
      setBusy(false);
    }
  }
  const updateStage = (index: number, patch: Partial<Stage>) =>
    setStages(stages.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  return (
    <>
      <PageHead
        eyebrow="NEW CAMPAIGN"
        title={influencer ? "Add brand deal" : "Create campaign"}
        description="Pick a starting point, then review each section before publishing."
        actions={
          <button className="button secondary" type="button" onClick={close}>
            Back to campaigns
          </button>
        }
      />
      {error && <ErrorBox error={error} />}
      <div className="template-grid" role="radiogroup" aria-label="Template">
        {campaignTemplates.map((t) => (
          <button
            type="button"
            key={t.id}
            role="radio"
            aria-checked={template.id === t.id}
            className={`template-card ${template.id === t.id ? "is-selected" : ""}`}
            onClick={() => choose(t)}
          >
            <strong>{t.title}</strong>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
      <form className="campaign-create" onSubmit={submit} key={template.id}>
        <fieldset disabled={busy}>
          <legend>1. Basics</legend>
          <div className="form-grid">
            <label className="full">
              Campaign name
              <input name="name" required maxLength={200} />
            </label>
            {influencer && (
              <label>
                Brand
                <select
                  name="advertiser_id"
                  required
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                >
                  <option value="">Select brand</option>
                  {(brands.data || []).map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <span className="row-actions">
                  <input
                    aria-label="New brand name"
                    placeholder="New brand, e.g. boAt"
                    value={newBrand}
                    maxLength={120}
                    onChange={(e) => setNewBrand(e.target.value)}
                  />
                  <button
                    type="button"
                    className="button secondary"
                    onClick={addBrand}
                  >
                    Add brand
                  </button>
                </span>
              </label>
            )}
            {chooseAdvertiser && (
              <label>
                Advertiser
                <select name="advertiser_id" required defaultValue="">
                  <option value="">Select advertiser</option>
                  {users.data
                    .filter((u) => u.role === "advertiser" && u.active)
                    .map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                </select>
                {users.error && <ErrorBox error={users.error} />}
              </label>
            )}
            <label>
              Categories (comma separated)
              <input name="categories" defaultValue={template.category} />
            </label>
            <label>
              Advertiser's campaign ID (optional)
              <input name="external_id" maxLength={120} />
            </label>
            <label className="full">
              Description
              <textarea name="description" rows={3} maxLength={10000} />
            </label>
            <label>
              Status
              <select name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>2. Destination and click ID</legend>
          <div className="form-grid">
            <label>
              Advertiser tracks on
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="own">Their own website or app</option>
                {platformTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Final advertiser URL (HTTPS)
              <input
                name="destination_url"
                type="url"
                required
                placeholder="https://brand.example/offer"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </label>
            <p className="full">
              Relay's click ID must reach the advertiser so conversions match.{" "}
              <button
                type="button"
                className="text-button"
                onClick={addClickId}
              >
                Add {clickParameter}={"{click_id}"} to the URL
              </button>
            </p>
            <label className="full">
              Preview URL (optional)
              <input name="preview_url" type="url" />
            </label>
            <label className="checkbox">
              <input type="checkbox" name="deep_links" /> Allow partners to deep
              link to other pages on this site
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>3. Payout and funnel</legend>
          <div className="form-grid">
            <label>
              Objective
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as "CPL" | "CPS")}
              >
                <option value="CPL">Leads or actions — fixed amount</option>
                <option value="CPS">Sales — percentage of order</option>
              </select>
            </label>
            <label>
              Currency
              <input
                name="currency"
                defaultValue="INR"
                maxLength={3}
                pattern="[A-Za-z]{3}"
              />
            </label>
            {model === "CPL" ? (
              <>
                {network && (
                  <label>
                    Advertiser revenue per conversion
                    <input
                      name="revenue"
                      type="number"
                      min="0"
                      step="0.0001"
                      defaultValue={template.revenue}
                    />
                  </label>
                )}
                <label>
                  {influencer
                    ? "Your earning per conversion"
                    : "Publisher payout"}
                  <input
                    name="payout"
                    type="number"
                    min="0"
                    step="0.0001"
                    defaultValue={template.payout}
                  />
                </label>
              </>
            ) : (
              <label>
                Commission (% of sale)
                <input
                  name="sale_percentage"
                  type="number"
                  min="0.0001"
                  max="100"
                  step="0.0001"
                  defaultValue={template.percentage || "10"}
                  required
                />
              </label>
            )}
            <label className="checkbox">
              <input type="checkbox" name="auto_approve" /> Approve the main
              conversion automatically
            </label>
          </div>
          <div className="stage-list">
            <strong>Later paid stages (optional)</strong>
            <small>
              Each stage is a separate paid event, sent as event=code in the
              postback. Approving a stage also approves its pending lead.
            </small>
            {stages.map((s, i) => (
              <div className="stage-row" key={i}>
                <input
                  aria-label={`Stage ${i + 1} name`}
                  value={s.name}
                  maxLength={120}
                  onChange={(e) => updateStage(i, { name: e.target.value })}
                />
                <input
                  aria-label={`Stage ${i + 1} code`}
                  value={s.code}
                  pattern="[a-z][a-z0-9_]{0,63}"
                  onChange={(e) =>
                    updateStage(i, { code: e.target.value.toLowerCase() })
                  }
                />
                <input
                  aria-label={`Stage ${i + 1} payout`}
                  type="number"
                  min="0"
                  step="0.0001"
                  value={s.payout}
                  onChange={(e) => updateStage(i, { payout: e.target.value })}
                />
                {network && (
                  <input
                    aria-label={`Stage ${i + 1} revenue`}
                    type="number"
                    min="0"
                    step="0.0001"
                    value={s.revenue}
                    onChange={(e) =>
                      updateStage(i, { revenue: e.target.value })
                    }
                  />
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setStages(stages.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setStages([
                  ...stages,
                  stage(`stage_${stages.length + 1}`, "New stage", "0", "0"),
                ])
              }
            >
              Add stage
            </button>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>4. Targeting and limits</legend>
          <div className="form-grid">
            <label>
              Geo coverage (country codes)
              <input
                name="countries"
                placeholder="IN"
                defaultValue={template.id === "blank" ? "" : "IN"}
              />
            </label>
            <label>
              Attribution window (days)
              <input
                name="attribution_days"
                type="number"
                min="1"
                max="90"
                defaultValue={template.attributionDays}
              />
            </label>
            <fieldset className="inline-checks">
              <legend>Devices (none = all)</legend>
              {devices.map((d) => (
                <label key={d} className="checkbox">
                  <input type="checkbox" name="devices" value={d} /> {d}
                </label>
              ))}
            </fieldset>
            <fieldset className="inline-checks">
              <legend>Operating systems (none = all)</legend>
              {systems.map((s) => (
                <label key={s} className="checkbox">
                  <input type="checkbox" name="operating_systems" value={s} />{" "}
                  {s}
                </label>
              ))}
            </fieldset>
            <label>
              Starts on
              <input name="starts_on" type="date" />
            </label>
            <label>
              Ends on
              <input name="ends_on" type="date" />
            </label>
            <label>
              Daily conversion limit (optional)
              <input name="daily_conversions" type="number" min="1" />
            </label>
            <label>
              When a conversion limit is full
              <select name="cap_action" defaultValue="refuse">
                <option value="refuse">Refuse the conversion</option>
                <option value="reject">Record it as rejected</option>
                <option value="pending">Record it as pending</option>
                <option value="accept">Accept it anyway</option>
                <option value="stop">Hold it and pause the campaign</option>
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>5. Access and terms</legend>
          <div className="form-grid">
            {!influencer && (
              <label>
                Visibility
                <select name="visibility" defaultValue="approval">
                  <option value="open">Open to all partners</option>
                  <option value="approval">Partners apply for approval</option>
                  <option value="private">
                    Private — invited partners only
                  </option>
                </select>
              </label>
            )}
            <label className="full">
              Terms for partners
              <textarea name="terms" rows={3} maxLength={20000} />
            </label>
            <label className="full">
              Internal notes
              <textarea name="internal_notes" rows={2} maxLength={10000} />
            </label>
          </div>
        </fieldset>
        <div className="campaign-create-actions">
          <button className="button secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create campaign"}
          </button>
        </div>
      </form>
    </>
  );
}
