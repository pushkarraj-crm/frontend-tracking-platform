import { useState } from "react";
import { ApiError, send, type Row } from "./api";
import { useAccountType } from "./context";
import { useCatalog, useData } from "./hooks";
import { CopyButton, ErrorBox, Fields, Loading, Panel, Table } from "./ui";

// The campaign's Affiliates tab (as in Offer18): give a partner access and their
// tracking link in one step, and copy every partner's link from one list.
export function CampaignAffiliates({ id }: { id: string }) {
  const brand = useAccountType() === "brand",
    word = brand ? "agency" : "affiliate",
    [version, setVersion] = useState(0),
    links = useData<Row[]>(`/links?limit=100&offer_id=${id}`, version),
    people = useCatalog("/users");
  const partners = people.data.filter(
    (u) => u.active && ["affiliate", "publisher"].includes(u.role),
  );
  const email = (userId: string) =>
    people.data.find((u) => u.id === userId)?.email || userId;
  const linked = new Set((links.data || []).map((l) => l.affiliate_id));
  return (
    <>
      <Panel
        title={`Add ${brand ? "an agency" : "an affiliate"}`}
        subtitle={`Approves them for this campaign and creates their tracking link.`}
      >
        <div className="network-form">
          <Fields
            key={version}
            submit={`Add ${word} and create link`}
            fields={[
              {
                name: "affiliate_id",
                label: brand ? "Agency" : "Affiliate",
                source: people,
                full: true,
                options: partners
                  .filter((u) => !linked.has(u.id))
                  .map((u) => ({ value: u.id, label: u.name || u.email })),
              },
            ]}
            onSubmit={async (b) => {
              const partner = partners.find((u) => u.id === b.affiliate_id);
              // Publishers need approved access before their clicks are tracked.
              if (partner?.role === "publisher")
                await send(`/campaigns/${id}/assign`, {
                  publisher_id: partner.id,
                  status: "approved",
                });
              try {
                await send("/links", {
                  offer_id: id,
                  affiliate_id: b.affiliate_id,
                });
              } catch (e) {
                if (!(e instanceof ApiError && e.status === 409)) throw e;
              }
              setVersion((v) => v + 1);
            }}
          />
        </div>
      </Panel>
      <Panel
        title={
          brand ? "Agencies and their links" : "Affiliates and their links"
        }
        subtitle="Share each link with its owner. Add &sub_id=placement to tell placements apart."
      >
        {links.error ? (
          <ErrorBox error={links.error} />
        ) : !links.data ? (
          <Loading />
        ) : (
          <Table
            rows={links.data}
            columns={[
              {
                key: "affiliate_id",
                title: brand ? "Agency" : "Affiliate",
                render: (r) => email(r.affiliate_id),
              },
              {
                key: "url",
                title: "Tracking link",
                render: (r) => (
                  <span className="link-cell">
                    <code>{r.url}</code> <CopyButton value={r.url} />
                  </span>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
