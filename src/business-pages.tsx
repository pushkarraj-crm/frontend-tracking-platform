import { CampaignCreate } from "./campaign-create";
import { CampaignRules } from "./campaign-rules";
import { useState, type ReactNode } from "react";
import { api, send, type Row } from "./api";
import { useCatalog, useData } from "./hooks";
import { useSession, useToast, staff } from "./context";
import {
  PageHead,
  Panel,
  Table,
  Fields,
  Modal,
  Badge,
  Secret,
  CopyButton,
  ErrorBox,
  Loading,
  type Field,
} from "./ui";

function Action({
  children,
  run,
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  return (
    <>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await run();
          } catch (e) {
            setError(e as Error);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : children}
      </button>
      {error && <ErrorBox error={error} />}
    </>
  );
}
const options = (rows: Row[], label = "email") =>
  rows.map((r) => ({ value: r.id, label: String(r[label] || r.id) }));
function Resource({
  result,
  children,
}: {
  result: { loading: boolean; error: Error | null };
  children: ReactNode;
}) {
  return result.error ? (
    <ErrorBox error={result.error} />
  ) : result.loading ? (
    <Loading />
  ) : (
    children
  );
}

function PublisherLink({
  campaign,
  close,
}: {
  campaign: Row;
  close: () => void;
}) {
  const domains = useData<Row[]>(`/campaigns/${campaign.id}/tracking-domains`),
    [result, setResult] = useState<Row | null>(null);
  return (
    <Modal title="Campaign tracking and final URLs" onClose={close}>
      <p>
        Use the tracking link for redirect tracking. For ad destinations use an
        advertiser landing page. Its CTA records your attributed click.
      </p>
      <Resource result={domains}>
        <Fields
          fields={[
            {
              name: "domain_id",
              label: "Verified advertiser tracking domain",
              required: false,
              options: options(domains.data || [], "hostname"),
              help: "Leave empty to use the network tracking host.",
            },
          ]}
          submit="Generate URLs"
          onSubmit={async (b) =>
            setResult(
              await send<Row>(
                `/campaigns/${campaign.id}/link${b.domain_id ? "?domain_id=" + encodeURIComponent(b.domain_id) : ""}`,
                {},
              ),
            )
          }
        />
      </Resource>
      {result && (
        <>
          <h3>Tracking URL</h3>
          <p>
            <code>{result.url}</code>
            <CopyButton value={result.url} />
          </p>
          <h3>Final landing URLs</h3>
          {result.final_urls?.length ? (
            result.final_urls.map((url: string) => (
              <p key={url}>
                <code>{url}</code>
                <CopyButton value={url} />
              </p>
            ))
          ) : (
            <p>
              The advertiser has not published a landing page yet. Ask them to
              connect a landing domain and create a campaign page.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

export function Campaigns() {
  const { user } = useSession(),
    toast = useToast(),
    [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0),
    [open, setOpen] = useState(false),
    [rulesCampaign, setRulesCampaign] = useState<Row | null>(null),
    [cloneCampaign, setCloneCampaign] = useState<Row | null>(null),
    [secret, setSecret] = useState(""),
    [linkCampaign, setLinkCampaign] = useState<Row | null>(null);
  const result = useData<Row[]>(
      `/campaigns?offset=${offset}&limit=50`,
      version,
    ),
    users = useCatalog(open && staff(user.role) ? "/users" : null);
  const manage = user.role === "advertiser" || (staff(user.role) && (user.staff_permissions == null || user.staff_permissions.includes("campaigns:write")));
  return (
    <>
      <PageHead
        title="Campaigns"
        description="CPL and CPS campaigns within your network."
        actions={
          manage && (
            <button className="button primary" onClick={() => setOpen(true)}>
              Create campaign
            </button>
          )
        }
      />
      {rulesCampaign && (
        <CampaignRules
          campaign={rulesCampaign}
          close={() => setRulesCampaign(null)}
        />
      )}
      {cloneCampaign && (
        <Modal title="Clone campaign" onClose={() => setCloneCampaign(null)}>
          <p>The copy starts paused with a new S2S key. Publisher approvals, traffic and payment history are not copied.</p>
          <Fields
            fields={[{ name: "name", label: "New campaign name", defaultValue: `${cloneCampaign.name} copy` }]}
            submit="Create paused copy"
            onSubmit={async (body) => {
              const created = await send<Row>(`/campaigns/${cloneCampaign.id}/clone`, body);
              setSecret(created.postback_key);
              setCloneCampaign(null);
              setOffset(0);
              setVersion((v) => v + 1);
              toast("Campaign copied. Review its settings before activation.");
            }}
          />
        </Modal>
      )}
      {secret && <Secret title="Advertiser postback key" value={secret} />}{" "}
      {linkCampaign && (
        <PublisherLink
          campaign={linkCampaign}
          close={() => setLinkCampaign(null)}
        />
      )}
      <Panel
        title={manage ? "Your campaigns" : "Discover campaigns"}
        subtitle="Publishers need an approved application before traffic is accepted."
      >
        <Resource result={result}>
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={setOffset}
            columns={[
              {
                key: "name",
                title: "Campaign",
                render: (r) => (
                  <>
                    <a className="campaign-title-link" href={`/campaign-operations?campaign=${encodeURIComponent(r.id)}`}><strong>{r.name}</strong></a>
                    <p>{r.description}</p>
                  </>
                ),
              },
              { key: "campaign_model", title: "Model" },
              {
                key: "payout",
                title: "Commission",
                render: (r) =>
                  r.campaign_model === "CPS"
                    ? `${r.sale_percentage}% of sale`
                    : `${r.payout} ${r.currency}`,
              },
              {
                key: "active",
                title: "Status",
                render: (r) => <Badge value={r.active} />,
              },
              {
                key: "postback_url",
                title: manage ? "Advertiser S2S endpoint" : "",
                render: (r) =>
                  manage ? (
                    <>
                      <code>{r.postback_url}</code>
                      <CopyButton value={r.postback_url} />
                    </>
                  ) : null,
              },
              {
                key: "actions",
                title: "Actions",
                render: (r) =>
                  manage ? (
                    <>
                      <Action
                        run={async () => {
                          await send(
                            `/campaigns/${r.id}`,
                            { active: !r.active },
                            "PATCH",
                          );
                          setVersion((v) => v + 1);
                        }}
                      >
                        {r.active ? "Pause" : "Activate"}
                      </Action>
                      <Action
                        run={async () => {
                          const v = await send<Row>(
                            `/campaigns/${r.id}/postback-key`,
                            {},
                          );
                          setSecret(v.postback_key);
                        }}
                      >
                        Rotate S2S key
                      </Action>
                      <button className="button secondary" onClick={() => setCloneCampaign(r)}>Clone campaign</button>
                      <button
                        className="button secondary"
                        onClick={() => setRulesCampaign(r)}
                      >
                        Targeting and caps
                      </button>
                    </>
                  ) : user.role === "publisher" ? (
                    <>
                      <Action
                        run={async () => {
                          await send(`/campaigns/${r.id}/apply`, {
                            message: "",
                          });
                          toast(
                            "Application submitted. Check Applications for approval.",
                          );
                        }}
                      >
                        Apply
                      </Action>
                      <button
                        className="button secondary"
                        onClick={() => setLinkCampaign(r)}
                      >
                        Get approved link
                      </button>
                    </>
                  ) : null,
              },
            ]}
          />
        </Resource>
      </Panel>
      {open && (
        <CampaignCreate users={users} role={user.role} close={() => setOpen(false)} created={(campaign) => {
          setSecret(campaign.postback_key);
          setOpen(false);
          setOffset(0);
          setVersion((v) => v + 1);
          toast("Campaign created. Targeting and publisher access settings are saved.");
        }} />
      )}
    </>
  );
}

export function Applications() {
  const { user } = useSession(),
    [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0);
  const result = useData<Row[]>(
      `/campaign-applications?offset=${offset}&limit=50`,
      version,
    ),
    manage = staff(user.role) || user.role === "advertiser";
  return (
    <>
      <PageHead
        title="Applications"
        description="Campaign access is granted by the campaign advertiser or network staff."
      />
      <Panel title="Publisher applications">
        <Resource result={result}>
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={setOffset}
            columns={[
              {
                key: "offer_id",
                title: "Campaign",
                render: (r) => r.campaign_name || r.offer_id,
              },
              {
                key: "publisher_id",
                title: "Publisher",
                render: (r) => r.publisher_email || r.publisher_id,
              },
              { key: "message", title: "Message" },
              {
                key: "status",
                title: "Status",
                render: (r) => <Badge value={r.status} />,
              },
              { key: "review_note", title: "Review note" },
              {
                key: "actions",
                title: "Review",
                render: (r) =>
                  manage ? (
                    <>
                      <Action
                        run={async () => {
                          await send(
                            `/campaign-applications/${r.id}`,
                            { status: "approved", note: "" },
                            "PATCH",
                          );
                          setVersion((v) => v + 1);
                        }}
                      >
                        Approve
                      </Action>
                      <Action
                        run={async () => {
                          await send(
                            `/campaign-applications/${r.id}`,
                            {
                              status: "rejected",
                              note: "Campaign access declined",
                            },
                            "PATCH",
                          );
                          setVersion((v) => v + 1);
                        }}
                      >
                        Reject / revoke
                      </Action>
                    </>
                  ) : null,
              },
            ]}
          />
        </Resource>
      </Panel>
    </>
  );
}

function InvoiceDetail({
  id,
  close,
  reload,
}: {
  id: string;
  close: () => void;
  reload: () => void;
}) {
  const { user } = useSession(),
    [version, setVersion] = useState(0),
    result = useData<Row>(`/publisher-invoices/${id}`, version),
    [action, setAction] = useState("");
  const invoice = result.data;
  const actions = invoice
    ? user.role === "advertiser"
      ? invoice.status === "submitted"
        ? ["approve", "reject"]
        : ["approved", "disputed"].includes(invoice.status)
          ? ["report_payment"]
          : []
      : user.role === "publisher"
        ? invoice.status === "submitted"
          ? ["cancel"]
          : invoice.status === "payment_reported"
            ? ["confirm_receipt", "dispute"]
            : []
        : []
    : [];
  const fields: Field[] =
    action === "report_payment"
      ? [
          { name: "payment_reference", label: "External payment reference" },
          {
            name: "receipt_url",
            label: "Payment proof URL (HTTPS)",
            type: "url",
            required: false,
          },
          { name: "note", label: "Note", required: false },
        ]
      : [
          {
            name: "note",
            label:
              action === "dispute" || action === "reject" ? "Reason" : "Note",
            required: action === "dispute" || action === "reject",
          },
        ];
  return (
    <Modal title="Publisher invoice" onClose={close}>
      <Resource result={result}>
        {invoice && (
          <>
            <p>
              <strong>{invoice.number}</strong> · {invoice.amount}{" "}
              {invoice.currency} · <Badge value={invoice.status} />
            </p>
            <p>
              Advertiser pays the publisher directly, outside this platform.
              Reporting a payment does not confirm receipt.
            </p>
            <p>Reference: {invoice.payment_reference || "Not reported"}</p>
            {invoice.receipt_url && (
              <a
                href={invoice.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View payment proof
              </a>
            )}
            <Table
              rows={invoice.lines || []}
              columns={[
                { key: "conversion_id", title: "Conversion" },
                { key: "amount", title: "Commission" },
              ]}
            />
            <label>
              Available action
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="">Select action</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            {action && actions.includes(action) && (
              <Fields
                key={action}
                fields={fields}
                submit={action.replaceAll("_", " ")}
                onSubmit={async (b) => {
                  await send(`/publisher-invoices/${id}/actions`, {
                    ...b,
                    action,
                  });
                  setAction("");
                  setVersion((v) => v + 1);
                  reload();
                }}
              />
            )}
            <h3>Invoice history</h3>
            <Table
              rows={invoice.events || []}
              columns={[
                { key: "created_at", title: "Time" },
                { key: "action", title: "Action" },
                { key: "detail", title: "Details" },
                {
                  key: "evidence",
                  title: "Payment proof",
                  render: (r) =>
                    r.evidence?.receipt_url ? (
                      <a
                        href={r.evidence.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View proof
                      </a>
                    ) : null,
                },
              ]}
            />
          </>
        )}
      </Resource>
    </Modal>
  );
}

export function Invoices() {
  const { user } = useSession(),
    [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0),
    [open, setOpen] = useState(false),
    [detail, setDetail] = useState("");
  const result = useData<Row[]>(
      `/publisher-invoices?offset=${offset}&limit=50`,
      version,
    ),
    summary = useData<Row>("/publisher-invoices/summary", version);
  const eligible = useCatalog(
    open ? "/publisher-invoices/eligible-conversions" : null,
  );
  return (
    <>
      <PageHead
        title="Publisher invoices"
        description="Advertisers pay publishers directly. This platform records invoice and receipt status."
        actions={
          user.role === "publisher" && (
            <button className="button primary" onClick={() => setOpen(true)}>
              Submit invoice
            </button>
          )
        }
      />
      <Panel title="Earnings and invoice status">
        <Resource result={summary}>
          <Table
            rows={summary.data?.totals || []}
            columns={[
              { key: "currency", title: "Currency" },
              {
                key: "status",
                title: "Status",
                render: (r) => <Badge value={r.status} />,
              },
              { key: "amount", title: "Amount" },
            ]}
          />
        </Resource>
      </Panel>
      <Panel title="Invoices">
        <Resource result={result}>
          <Table
            rows={result.data || []}
            offset={offset}
            setOffset={setOffset}
            columns={[
              { key: "number", title: "Invoice" },
              {
                key: "advertiser_id",
                title: "Advertiser",
                render: (r) => r.advertiser_email || r.advertiser_id,
              },
              {
                key: "publisher_id",
                title: "Publisher",
                render: (r) => r.publisher_email || r.publisher_id,
              },
              {
                key: "amount",
                title: "Amount",
                render: (r) => `${r.amount} ${r.currency}`,
              },
              {
                key: "status",
                title: "Status",
                render: (r) => <Badge value={r.status} />,
              },
              {
                key: "actions",
                title: "Details",
                render: (r) => (
                  <button
                    className="text-button"
                    onClick={() => setDetail(r.id)}
                  >
                    View invoice
                  </button>
                ),
              },
            ]}
          />
        </Resource>
      </Panel>
      {detail && (
        <InvoiceDetail
          id={detail}
          close={() => setDetail("")}
          reload={() => setVersion((v) => v + 1)}
        />
      )}
      {open && (
        <Modal
          title="Submit invoice to advertiser"
          onClose={() => setOpen(false)}
        >
          <p>
            Select approved, uninvoiced conversions for one advertiser and
            currency. Enter their IDs separated by commas.
          </p>
          <Table
            rows={eligible.data}
            columns={[
              { key: "id", title: "Conversion ID" },
              {
                key: "advertiser_id",
                title: "Advertiser",
                render: (r) => r.advertiser_email || r.advertiser_id,
              },
              { key: "amount", title: "Commission" },
              { key: "currency", title: "Currency" },
            ]}
          />
          {eligible.error && <ErrorBox error={eligible.error} />}
          <button
            className="text-button"
            disabled={!eligible.hasMore || eligible.loading}
            onClick={eligible.loadMore}
          >
            Load more eligible conversions
          </button>
          <Fields
            fields={[
              { name: "number", label: "Invoice number" },
              {
                name: "conversion_ids",
                label: "Conversion IDs",
                type: "textarea",
                full: true,
              },
            ]}
            submit="Submit invoice"
            onSubmit={async (b) => {
              await send("/publisher-invoices", {
                ...b,
                conversion_ids: String(b.conversion_ids)
                  .split(/[\s,]+/)
                  .filter(Boolean),
              });
              setOpen(false);
              setVersion((v) => v + 1);
            }}
          />
        </Modal>
      )}
    </>
  );
}

export function AdvertiserDomains() {
  const { user } = useSession(),
    [version, setVersion] = useState(0),
    [open, setOpen] = useState(false),
    [pageOpen, setPageOpen] = useState(false),
    [dns, setDns] = useState<Row | null>(null),
    [offset, setOffset] = useState(0);
  const domains = useData<Row[]>("/tracking-domains", version),
    pages = useData<Row[]>(`/landing-pages?offset=${offset}&limit=50`, version),
    campaigns = useCatalog(pageOpen ? "/campaigns" : null),
    users = useCatalog(open && user.role === "admin" ? "/users" : null);
  return (
    <>
      <PageHead
        title="Advertiser domains"
        description="Connect advertiser-owned landing and tracking domains. DNS verification and HTTPS gateway configuration are required."
        actions={
          user.role !== "staff" && (
            <button className="button primary" onClick={() => setOpen(true)}>
              Connect domain
            </button>
          )
        }
      />
      {dns && (
        <Panel title="DNS setup">
          <p>
            Create a TXT record at <code>{dns.txt_name}</code> with value{" "}
            <code>{dns.txt_value}</code> <CopyButton value={dns.txt_value} />
          </p>
          <p>
            Point the domain CNAME at <code>{dns.cname_target}</code>. Save
            these instructions now, then verify.
          </p>
        </Panel>
      )}
      <Panel title="Connected domains">
        <Resource result={domains}>
          <Table
            rows={domains.data || []}
            columns={[
              { key: "hostname", title: "Domain" },
              { key: "purpose", title: "Purpose" },
              {
                key: "active",
                title: "DNS verified",
                render: (r) => <Badge value={r.active} />,
              },
              { key: "https_status", title: "HTTPS setup" },
              {
                key: "actions",
                title: "Actions",
                render: (r) =>
                  user.role !== "staff" ? (
                    <>
                      <Action
                        run={async () => {
                          await send(`/tracking-domains/${r.id}/verify`, {});
                          setVersion((v) => v + 1);
                        }}
                      >
                        Verify DNS
                      </Action>
                      <Action
                        run={async () => {
                          await send(
                            `/tracking-domains/${r.id}/verify-https`,
                            {},
                          );
                          setVersion((v) => v + 1);
                        }}
                      >
                        Verify HTTPS
                      </Action>
                      <Action
                        run={async () => {
                          await api(`/tracking-domains/${r.id}`, {
                            method: "DELETE",
                          });
                          setVersion((v) => v + 1);
                        }}
                      >
                        Disable
                      </Action>
                    </>
                  ) : null,
              },
            ]}
          />
        </Resource>
      </Panel>
      <Panel
        title="Landing pages"
        actions={
          <button
            className="button secondary"
            onClick={() => setPageOpen(true)}
          >
            Create landing page
          </button>
        }
        subtitle="Public pages show the same content to visitors and crawlers. Custom domains do not guarantee ad approval."
      >
        <Resource result={pages}>
          <Table
            rows={pages.data || []}
            offset={offset}
            setOffset={setOffset}
            columns={[
              { key: "title", title: "Page" },
              {
                key: "url",
                title: "Final landing URL",
                render: (r) => (
                  <>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.url}
                    </a>
                    <CopyButton value={r.url} />
                    <p>
                      For publisher attribution append
                      ?link=APPROVED_TRACKING_LINK_ID; the CTA records a click.
                    </p>
                  </>
                ),
              },
              {
                key: "active",
                title: "Status",
                render: (r) => <Badge value={r.active} />,
              },
              {
                key: "actions",
                title: "Actions",
                render: (r) => (
                  <Action
                    run={async () => {
                      await send(
                        `/landing-pages/${r.id}`,
                        { active: !r.active },
                        "PATCH",
                      );
                      setVersion((v) => v + 1);
                    }}
                  >
                    {r.active ? "Pause" : "Activate"}
                  </Action>
                ),
              },
            ]}
          />
        </Resource>
      </Panel>
      {open && (
        <Modal title="Connect advertiser domain" onClose={() => setOpen(false)}>
          <Fields
            fields={[
              {
                name: "hostname",
                label: "Hostname",
                placeholder: "offers.brand.com",
              },
              {
                name: "purpose",
                label: "Purpose",
                options: [
                  { value: "tracking", label: "Tracking links" },
                  { value: "landing", label: "Landing pages" },
                  { value: "both", label: "Both" },
                ],
              },
              ...(user.role === "admin"
                ? [
                    {
                      name: "advertiser_id",
                      label: "Advertiser",
                      options: options(
                        users.data.filter(
                          (r) => r.role === "advertiser" && r.active,
                        ),
                      ),
                      source: users,
                    },
                  ]
                : []),
            ]}
            submit="Get DNS instructions"
            onSubmit={async (b) => {
              setDns(await send<Row>("/tracking-domains", b));
              setOpen(false);
              setVersion((v) => v + 1);
            }}
          />
        </Modal>
      )}
      {pageOpen && (
        <Modal title="Create landing page" onClose={() => setPageOpen(false)}>
          <Fields
            fields={[
              {
                name: "offer_id",
                label: "Campaign",
                options: options(campaigns.data, "name"),
                source: campaigns,
              },
              {
                name: "domain_id",
                label: "Verified landing domain",
                options: options(
                  (domains.data || []).filter(
                    (r) => r.active && r.purpose !== "tracking",
                  ),
                  "hostname",
                ),
              },
              { name: "slug", label: "Page path", placeholder: "summer-offer" },
              { name: "title", label: "Page title" },
              {
                name: "body",
                label: "Page content",
                type: "textarea",
                full: true,
              },
              {
                name: "button_text",
                label: "Button text",
                defaultValue: "Continue",
              },
            ]}
            submit="Create page"
            onSubmit={async (b) => {
              await send("/landing-pages", b);
              setPageOpen(false);
              setVersion((v) => v + 1);
            }}
          />
        </Modal>
      )}
    </>
  );
}

export { Postbacks } from "./postbacks-page";
