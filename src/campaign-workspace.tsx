import { useState } from "react";
import { send, type Row } from "./api";
import { useData } from "./hooks";
import { useSession, useToast } from "./context";
import {
  Badge,
  CopyButton,
  ErrorBox,
  Fields,
  Loading,
  Panel,
  TrackingUrl,
} from "./ui";
import { campaignRuleFields } from "./campaign-rule-fields";
import { Action } from "./network-ui";

export function CampaignOverview({
  id,
  manage,
  choose,
}: {
  id: string;
  manage: boolean;
  choose: (tab: string) => void;
}) {
  const { user } = useSession();
  const [version, setVersion] = useState(0);
  const profile = useData<Row>(`/campaigns/${id}/profile`, version);
  const [link, setLink] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  if (profile.loading) return <Loading />;
  if (profile.error) return <ErrorBox error={profile.error} />;
  const campaign = profile.data!;
  const settings = campaign.settings;
  const visibility =
    { open: "Public", approval: "Approval required", private: "Private" }[
      settings.visibility as string
    ] || settings.visibility;
  return (
    <div className="campaign-workspace">
      <div className="campaign-summary-grid">
        <article>
          <span>Status</span>
          <Badge value={campaign.active ? "active" : "paused"} />
        </article>
        <article>
          <span>Commission</span>
          <strong>
            {campaign.campaign_model === "CPS"
              ? `${campaign.sale_percentage}% of sale`
              : `${campaign.payout} ${campaign.currency}`}
          </strong>
        </article>
        <article>
          <span>Publisher access</span>
          <strong>{visibility}</strong>
        </article>
        <article>
          <span>Categories</span>
          <strong>{settings.categories?.join(", ") || "Uncategorized"}</strong>
        </article>
      </div>
      <div className="campaign-workspace-grid">
        <Panel
          title="Campaign overview"
          actions={
            manage && (
              <>
                <Action
                  run={async () => {
                    await send(
                      `/campaigns/${id}`,
                      { active: !campaign.active },
                      "PATCH",
                    );
                    setVersion((v) => v + 1);
                  }}
                >
                  {campaign.active ? "Pause campaign" : "Activate campaign"}
                </Action>
                <button
                  className="button secondary"
                  onClick={() => choose("profile")}
                >
                  Edit details
                </button>
              </>
            )
          }
        >
          <div className="workspace-content">
            <h3>{campaign.name}</h3>
            <p className="preserve-lines">
              {campaign.description || "No description added yet."}
            </p>
            <dl className="campaign-details">
              <dt>Campaign ID</dt>
              <dd>
                <code>{id}</code>
                <CopyButton value={id} />
              </dd>
              {manage && (
                <>
                  <dt>Advertiser revenue</dt>
                  <dd>
                    {campaign.revenue} {campaign.currency} per conversion
                  </dd>
                  <dt>Destination</dt>
                  <dd>
                    <code>{campaign.destination_url}</code>
                    <CopyButton value={campaign.destination_url} />
                  </dd>
                </>
              )}
              <dt>Preview</dt>
              <dd>
                {settings.preview_url ? (
                  <a
                    href={settings.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open preview ↗
                  </a>
                ) : (
                  "No preview URL"
                )}
              </dd>
              <dt>Terms</dt>
              <dd className="preserve-lines">
                {settings.terms || "No additional terms provided."}
              </dd>
            </dl>
          </div>
        </Panel>
        <Panel title={manage ? "Launch checklist" : "Start promoting"}>
          <div className="workspace-content">
            {manage ? (
              <>
                <ol className="campaign-checklist">
                  <li>
                    <strong>Review destination and access</strong>
                    <p>
                      Confirm the final URL, terms and publisher visibility.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => choose("profile")}
                    >
                      Review general settings →
                    </button>
                  </li>
                  <li>
                    <strong>Set traffic quality and limits</strong>
                    <p>Choose countries, fraud controls and campaign caps.</p>
                    <button
                      className="text-button"
                      onClick={() => choose("targeting")}
                    >
                      Configure targeting →
                    </button>
                    <button
                      className="text-button"
                      onClick={() => choose("caps")}
                    >
                      Manage caps →
                    </button>
                  </li>
                  <li>
                    <strong>Configure conversion events</strong>
                    <p>
                      Define additional goals and conditional publisher payouts.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => choose("events")}
                    >
                      Manage events →
                    </button>
                    <button
                      className="text-button"
                      onClick={() => choose("commission-rules")}
                    >
                      Set payout rules →
                    </button>
                  </li>
                  <li>
                    <strong>Test before sending traffic</strong>
                    <p>
                      Check the destination without recording a click, then
                      verify a conversion through your advertiser integration.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => choose("url-preview")}
                    >
                      Test destination →
                    </button>
                    <a
                      className="text-button"
                      href={`/postbacks?campaign=${encodeURIComponent(id)}`}
                    >
                      Open S2S integration →
                    </a>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p>
                  Review the terms and request campaign access before generating
                  your tracking link.
                </p>
                <a className="button secondary" href="/applications">
                  Check applications
                </a>
                {user.role === "publisher" && (
                  <button
                    className="button primary"
                    disabled={busy || !campaign.active}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        setLink(await send<Row>(`/campaigns/${id}/link`, {}));
                      } catch (e) {
                        setError(e as Error);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Generating…" : "Generate tracking link"}
                  </button>
                )}
                {error && <ErrorBox error={error} />}
                {link && (
                  <div className="notice">
                    <strong>Your tracking link</strong>
                    <TrackingUrl url={link.url} />
                  </div>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function CampaignTargeting({ id }: { id: string }) {
  const [version, setVersion] = useState(0);
  const result = useData<Row>(`/offers/${id}/rules`, version);
  const toast = useToast();
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorBox error={result.error} />;
  return (
    <Panel
      title="Targeting and fraud protection"
      subtitle="Restrictions are enforced on traffic. Empty selections allow all values. Schedules use UTC."
    >
      <div className="network-form">
        <Fields
          key={version}
          fields={campaignRuleFields}
          initial={Object.fromEntries(
            Object.entries(result.data || {}).map(([key, value]) => [
              key,
              Array.isArray(value)
                ? value.join(", ")
                : key.endsWith("_at") && value
                  ? new Date(value).toISOString().slice(0, 16)
                  : value,
            ]),
          )}
          submit="Save targeting"
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
                .map((v) =>
                  key === "utc_hours"
                    ? Number(v)
                    : key === "countries"
                      ? v.toUpperCase()
                      : v,
                );
            for (const key of ["starts_at", "ends_at"])
              if (body[key])
                body[key] = new Date(String(body[key]) + "Z").toISOString();
            await send(`/offers/${id}/rules`, body, "PUT");
            toast("Targeting and fraud settings saved.");
            setVersion((v) => v + 1);
          }}
        />
      </div>
    </Panel>
  );
}

export function CapUsage({ row }: { row: Row }) {
  const amount = Number(row.amount),
    used = Number(row.recorded_usage);
  const percentage = amount > 0 ? Math.max(0, (used / amount) * 100) : 0;
  return (
    <div
      className={`cap-usage ${percentage >= 100 ? "cap-full" : percentage >= Number(row.alert_percent ?? 80) ? "cap-warning" : ""}`}
    >
      <span>
        {row.recorded_usage} / {row.amount}{" "}
        <small>({percentage.toFixed(1)}%)</small>
      </span>
      <progress
        value={Math.min(percentage, 100)}
        max={100}
        aria-label={`${row.name} usage`}
      />
      <small>
        {!row.active
          ? "Disabled"
          : percentage >= 100
            ? "Cap reached"
            : "Current period"}
      </small>
    </div>
  );
}
