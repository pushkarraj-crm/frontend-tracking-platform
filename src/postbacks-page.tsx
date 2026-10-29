import { useState } from "react";
import { send, type Row } from "./api";
import { useCatalog, useData } from "./hooks";
import { useSession } from "./context";
import {
  Badge,
  CopyButton,
  ErrorBox,
  Fields,
  Loading,
  PageHead,
  Panel,
  Secret,
  Table,
} from "./ui";
import { date } from "./format";
import {
  platformPostback,
  platformTemplates,
  postbackFields,
  unavailablePlatforms,
} from "./platform-templates";

function CampaignSetup() {
  const { user } = useSession();
  const campaigns = useCatalog("/campaigns");
  const [id, setId] = useState(
    () => new URLSearchParams(window.location.search).get("campaign") || "",
  );
  const profile = useData<Row>(id ? `/campaigns/${id}/profile` : null);
  const canReadLogs =
    user.role !== "staff" ||
    user.staff_permissions == null ||
    user.staff_permissions.includes("deliveries:read");
  const campaign = profile.data;
  const body = campaign
    ? {
        click_id: "TRACKED_CLICK_ID",
        transaction_id: "UNIQUE_ORDER_ID",
        event_type: campaign.campaign_model === "CPS" ? "sale" : "lead",
        ...(campaign.campaign_model === "CPS"
          ? { sale_amount: "100.00", sale_currency: campaign.currency }
          : {}),
      }
    : null;
  return (
    <>
      <Panel
        title="1. Choose your campaign"
        subtitle="Each campaign has its own conversion endpoint and private key."
      >
        <div className="postback-content">
          <label className="postback-select">
            Campaign
            <select value={id} onChange={(event) => setId(event.target.value)}>
              <option value="">Select a campaign</option>
              {id && !campaigns.data.some((row) => row.id === id) && (
                <option value={id}>
                  {campaign?.name || "Selected campaign"}
                </option>
              )}
              {campaigns.data.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {campaigns.loading && <Loading />}
          {campaigns.error && <ErrorBox error={campaigns.error} />}
          {(campaigns.hasMore || campaigns.error) && (
            <button
              type="button"
              className="text-button"
              disabled={campaigns.loading}
              onClick={campaigns.loadMore}
            >
              {campaigns.error ? "Retry campaigns" : "Load more campaigns"}
            </button>
          )}
          {!campaigns.loading && !campaigns.error && !campaigns.data.length && (
            <div className="postback-empty">
              <p>Create a campaign to get its conversion endpoint.</p>
              <a className="button primary" href="/offers">
                Go to campaigns
              </a>
            </div>
          )}
          {!id && campaigns.data.length > 0 && (
            <p className="postback-hint">
              Choose a campaign above to see its setup instructions and
              connection status.
            </p>
          )}
        </div>
      </Panel>
      {id &&
        (profile.loading ? (
          <Loading />
        ) : profile.error ? (
          <ErrorBox error={profile.error} />
        ) : (
          campaign && (
            <>
              <div className="postback-grid">
                <Panel
                  title="2. Connect your advertiser"
                  subtitle="Share these instructions with the person setting up conversion tracking."
                >
                  <div className="postback-content">
                    <div className="postback-campaign">
                      <strong>{campaign.name}</strong>
                      <Badge value={campaign.active ? "active" : "paused"} />
                    </div>
                    {!campaign.active && (
                      <p className="notice">
                        This campaign is paused. Activate it from the campaign
                        workspace before sending traffic.
                      </p>
                    )}
                    <strong>Conversion endpoint</strong>
                    <div className="postback-copy">
                      <code>{campaign.postback_url}</code>
                      <CopyButton value={campaign.postback_url} />
                    </div>
                    <ol className="postback-steps">
                      <li>
                        <strong>Save the click ID</strong>
                        <p>
                          Pass the platform click ID to the advertiser and keep
                          it with the lead or order.
                        </p>
                      </li>
                      <li>
                        <strong>Add your campaign key</strong>
                        <p>
                          Use the private key saved when the campaign was
                          created. Send it in the <code>X-Postback-Key</code>{" "}
                          header.
                        </p>
                        <a href="/offers">Manage campaign keys →</a>
                        <small>
                          Generating a new key replaces the existing one. Update
                          your advertiser integration when rotating it.
                        </small>
                      </li>
                      <li>
                        <strong>Send the conversion</strong>
                        <p>
                          Send an HTTPS POST to the endpoint with the click ID
                          and a unique order or lead ID.
                        </p>
                      </li>
                    </ol>
                    <details className="postback-advanced">
                      <summary>Advanced: request example and responses</summary>
                      <p>
                        Use <code>Content-Type: application/json</code>. Keep
                        the private key out of URLs.
                      </p>
                      <div className="postback-example">
                        <pre>{JSON.stringify(body, null, 2)}</pre>
                        <CopyButton value={JSON.stringify(body, null, 2)} />
                      </div>
                      <p>
                        Replace the placeholder IDs with real IDs from your test
                        campaign. The example is not sent automatically.
                      </p>
                      <dl>
                        <dt>201 — Recorded</dt>
                        <dd>A new conversion was recorded.</dd>
                        <dt>200 — Already received</dt>
                        <dd>
                          An identical retry was accepted without duplicating
                          the conversion.
                        </dd>
                        <dt>409 — Conflict</dt>
                        <dd>
                          The same transaction or event conflicts with an
                          existing conversion.
                        </dd>
                      </dl>
                      <p>
                        Additional events and repeat conversions depend on
                        campaign event settings. Approval follows the campaign’s
                        validation settings; a received conversion is not
                        necessarily payable.
                      </p>
                    </details>
                  </div>
                </Panel>
                <Panel
                  title="3. Check the connection"
                  subtitle="Check your destination, then confirm incoming conversions below."
                >
                  <div className="postback-content">
                    <h3>Check your destination</h3>
                    <p>
                      Preview the destination without recording a click or
                      creating a conversion.
                    </p>
                    <a
                      className="button secondary"
                      href={`/campaign-operations?campaign=${encodeURIComponent(id)}&tab=url-preview`}
                    >
                      Check destination
                    </a>
                    <h3>Verify a conversion</h3>
                    <p>
                      Use a dedicated test campaign and send a conversion from
                      your advertiser system. Refresh the request status below
                      to confirm it arrived.
                    </p>
                    <p className="postback-hint">
                      The destination check does not test your campaign key or
                      send a conversion. Incoming status is based on recorded
                      requests.
                    </p>
                    <a href="/conversions">Open conversion log →</a>
                  </div>
                </Panel>
              </div>
              {canReadLogs ? (
                <ReceiptStatus key={id} id={id} />
              ) : (
                <p className="notice">
                  Your account needs delivery-log permission to view incoming
                  request status.
                </p>
              )}
            </>
          )
        ))}
    </>
  );
}

function ReceiptStatus({ id }: { id: string }) {
  const [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0);
  const receipts = useData<Row[]>(
    `/postback-receipts?offer_id=${encodeURIComponent(id)}&offset=${offset}&limit=10`,
    version,
  );
  return (
    <Panel
      title="Incoming conversion requests"
      subtitle="Recent requests for the selected campaign. Invalid keys and some early validation failures may not produce a receipt."
      actions={
        <button
          className="button secondary"
          disabled={receipts.loading}
          onClick={() => {
            setOffset(0);
            setVersion((value) => value + 1);
          }}
        >
          {receipts.loading ? "Checking…" : "Refresh status"}
        </button>
      }
    >
      <div className="postback-content">
        {receipts.loading ? (
          <Loading />
        ) : receipts.error ? (
          <ErrorBox error={receipts.error} />
        ) : !receipts.data?.length && offset === 0 ? (
          <div className="postback-empty" role="status">
            <strong>No requests recorded yet</strong>
            <p>
              After your advertiser sends a conversion, refresh here to inspect
              the result.
            </p>
          </div>
        ) : (
          <Table
            rows={receipts.data || []}
            pageSize={10}
            offset={offset}
            setOffset={setOffset}
            columns={[
              {
                key: "created_at",
                title: "Received",
                render: (row) => date(row.created_at),
              },
              { key: "transaction_id", title: "Order / lead ID" },
              { key: "event_key", title: "Event" },
              { key: "result", title: "Result" },
              { key: "http_status", title: "Response" },
            ]}
          />
        )}
      </div>
    </Panel>
  );
}

const globalParameters: [string, string][] = [
  [
    "click_id",
    "Required. Relay's click ID; it identifies the campaign and partner.",
  ],
  [
    "event",
    "Campaign event code, e.g. lead, approved, disbursed, sale. Default: the campaign's main conversion.",
  ],
  [
    "txn_id",
    "Recommended. Your order or application number; prevents double counting.",
  ],
  ["amount", "Sale amount for CPS (percentage) events; ignored for CPL."],
  ["currency", "Optional ISO code such as INR; must match the campaign."],
  [
    "status",
    "Optional: approved, rejected or pending. Send again later to update a conversion.",
  ],
  [
    "coupon",
    "Coupon code used on the order. A code from Coupons credits its partner, even without click_id (then txn_id is required).",
  ],
  [
    "adv_sub1 – adv_sub5",
    "Optional extra values to store with the conversion.",
  ],
];

function GlobalPostback({ admin }: { admin: boolean }) {
  const [version, setVersion] = useState(0),
    [error, setError] = useState<Error | null>(null);
  const settings = useData<Row>("/postback-settings", version);
  const url = settings.data?.url as string | undefined;
  return (
    <Panel
      title="Your global postback URL"
      subtitle="One URL for every campaign in this account. Advertisers fire it with the click ID; Relay finds the campaign from the click."
    >
      <div className="postback-content">
        {settings.loading && <Loading />}
        {settings.error && <ErrorBox error={settings.error} />}
        {url && (
          <>
            <p className="postback-url">
              <code>{`${url}?click_id={click_id}&event={event}&txn_id={txn_id}&amount={amount}&status={status}`}</code>
              <CopyButton
                value={`${url}?click_id={click_id}&event={event}&txn_id={txn_id}&amount={amount}&status={status}`}
              />
            </p>
            <p>
              Replace the values in braces with your advertiser platform's
              macros. GET and POST (form or JSON) are both accepted. Keep this
              URL private: it contains your account's secret.
            </p>
            <Table
              rows={globalParameters.map(([name, meaning]) => ({
                id: name,
                name,
                meaning,
              }))}
              columns={[
                {
                  key: "name",
                  title: "Parameter",
                  render: (r) => <code>{r.name}</code>,
                },
                { key: "meaning", title: "Meaning" },
              ]}
            />
            {admin && (
              <button
                type="button"
                className="button secondary"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Generate a new secret? The current global postback URL stops working immediately.",
                    )
                  )
                    return;
                  setError(null);
                  try {
                    await send("/postback-settings/rotate", {});
                    setVersion((v) => v + 1);
                  } catch (e) {
                    setError(e as Error);
                  }
                }}
              >
                Generate new secret
              </button>
            )}
            {error && <ErrorBox error={error} />}
          </>
        )}
      </div>
      {url && <ConnectPlatform url={url} />}
    </Panel>
  );
}

function ConnectPlatform({ url }: { url: string }) {
  const [id, setId] = useState(""),
    [custom, setCustom] = useState<Record<string, string>>({ click_id: "" });
  const template = platformTemplates.find((t) => t.id === id);
  const macros = template ? template.macros : custom;
  const postback = platformPostback(url, macros);
  return (
    <div className="postback-content">
      <h3>Connect another tracking platform</h3>
      <p>
        If the advertiser tracks on another platform, Relay can receive its
        conversions as a partner. Choose the platform to get the exact setup.
      </p>
      <label className="postback-select">
        Advertiser's platform
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose a platform</option>
          {platformTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="custom">Other (custom macros)</option>
        </select>
      </label>
      {id === "custom" && (
        <div className="network-form">
          {postbackFields.map((field) => (
            <label key={field}>
              Their macro for <code>{field}</code>
              <input
                value={custom[field] || ""}
                placeholder={
                  field === "click_id" ? "Required, e.g. {sub1}" : "Optional"
                }
                onChange={(e) =>
                  setCustom({ ...custom, [field]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
      )}
      {id && (
        <ol>
          <li>
            In your Relay campaign, set the destination URL to the advertiser's{" "}
            {template?.name || "platform"} tracking link with Relay's click ID
            added:{" "}
            <code>
              {"…&"}
              {template ? template.clickParameter : "<their sub-ID parameter>"}
              {"={click_id}"}
            </code>
          </li>
          <li>
            Paste this into{" "}
            {template ? template.where : "the platform's partner postback"}:
            <p className="postback-url">
              <code>{postback}</code>
              <CopyButton value={postback} />
            </p>
          </li>
          <li>
            Conversions go to the campaign's main event. To use a funnel stage,
            add <code>&event=</code> with your Relay event code.
            {template && (
              <>
                {" "}
                Macros from{" "}
                <a href={template.source} target="_blank" rel="noreferrer">
                  {template.name}'s documentation
                </a>
                .
              </>
            )}
          </li>
        </ol>
      )}
      <p className="muted">
        Not available yet:{" "}
        {unavailablePlatforms.map((p) => `${p.name}: ${p.reason}`).join(" ")}
      </p>
    </div>
  );
}

export function Postbacks() {
  const { user } = useSession();
  const [version, setVersion] = useState(0),
    [secret, setSecret] = useState("");
  const result = useData<Row>(
    user.role === "publisher" ? "/publisher-postback" : null,
    version,
  );
  const manager = ["admin", "staff", "advertiser"].includes(user.role);
  return (
    <>
      <PageHead
        title={
          manager ? "Conversion tracking setup" : "Publisher callback setup"
        }
        description={
          manager
            ? "Connect your advertiser, check the setup, and review incoming conversions."
            : "Receive conversion updates from your network in your own tracking system."
        }
      />
      {(user.role === "admin" || user.role === "staff") && (
        <GlobalPostback admin={user.role === "admin"} />
      )}
      {manager && <CampaignSetup />}
      {user.role === "publisher" && (
        <Panel
          title="Connect your tracking system"
          subtitle="Add the endpoint where your system receives conversion updates."
        >
          <div className="postback-content">
            {result.loading ? (
              <Loading />
            ) : result.error ? (
              <ErrorBox error={result.error} />
            ) : (
              <div className="postback-campaign">
                <span>
                  Current callback: {result.data?.url || "Not configured"}
                </span>
                <Badge value={result.data?.active ? "active" : "inactive"} />
              </div>
            )}
            {secret && (
              <Secret title="Publisher signing secret" value={secret} />
            )}
            <Fields
              fields={[
                {
                  name: "url",
                  label: "HTTPS callback URL",
                  type: "url",
                  help: "The network operator must enable your hostname for outbound delivery.",
                },
              ]}
              submit="Save and rotate signing secret"
              onSubmit={async (body) => {
                const saved = await send<Row>(
                  "/publisher-postback",
                  body,
                  "PUT",
                );
                setSecret(saved.secret);
                setVersion((value) => value + 1);
              }}
            />
            <p>
              Saving rotates your signing secret. Update signature verification
              in your receiving system.
            </p>
            <a className="button secondary" href="/callbacks">
              Open callback tests and delivery status
            </a>
          </div>
        </Panel>
      )}
      {!manager && user.role !== "publisher" && (
        <Panel title="Publisher integrations">
          <div className="postback-content">
            <p>
              Manage your publishers’ callbacks and inspect delivery status in
              the callback workspace.
            </p>
            <a className="button primary" href="/callbacks">
              Open publisher callbacks
            </a>
          </div>
        </Panel>
      )}
      <details className="postback-advanced postback-reference">
        <summary>Advanced: callback verification and ad tracking</summary>
        <h3>Callback verification and retries</h3>
        <p>
          Verify X-Webhook-Signature as HMAC-SHA256(secret, X-Webhook-Timestamp
          + "." + raw request body). Reject stale timestamps and deduplicate
          X-Event-ID. Use event versions to ignore older conversion updates.
        </p>
        <p>
          Save the event before returning a successful response. Failed
          deliveries retry with backoff up to eight attempts. See delivery logs
          for the result.
        </p>
        <h3>Google and Meta ad destinations</h3>
        <p>
          Use a stable HTTPS landing page on your advertiser’s verified domain
          as the ad final URL. Redirects preserve supported click IDs and UTM
          parameters. Direct landing-page flows need advertiser-side click
          capture or the attributed landing CTA; a redirect-generated click ID
          does not automatically reach a direct landing page.
        </p>
      </details>
    </>
  );
}
