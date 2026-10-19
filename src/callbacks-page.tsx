import { useState } from "react";
import { send, type Row } from "./api";
import { useCatalog } from "./hooks";
import { useSession, staff } from "./context";
import { PageHead, Panel, Fields, Secret } from "./ui";
import { Action, ResourceRows } from "./network-ui";
import { text, select } from "./network-fields";
export function PartnerCallbacks() {
  const { user } = useSession(),
    [version, setVersion] = useState(0),
    [secret, setSecret] = useState("");
  const users = useCatalog(staff(user.role) ? "/users" : null),
    campaigns = useCatalog("/campaigns");
  return (
    <>
      <PageHead
        title="Publisher callbacks"
        description="Signed server-to-server notifications, delivery logs and test events."
      />
      <Panel
        title="Configure callback"
        subtitle="A campaign callback overrides the global callback. Saving rotates its signing secret."
      >
        <div className="network-form">
          <Fields
            fields={[
              ...(staff(user.role)
                ? [
                    {
                      name: "publisher_id",
                      label: "Publisher or affiliate",
                      options: users.data
                        .filter((u) =>
                          ["publisher", "affiliate"].includes(u.role),
                        )
                        .map((u) => ({ value: u.id, label: u.email })),
                      source: users,
                    },
                  ]
                : []),
              {
                name: "offer_id",
                label: "Campaign (optional; leave empty for global)",
                required: false,
                options: campaigns.data.map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
                source: campaigns,
              },
              select("method", "Delivery method", ["POST", "GET"], {
                defaultValue: "POST",
              }),
              text("url", "HTTPS callback URL", {
                help: "Query macros: {click_id}, {transaction_id}, {payout}, {currency}, {status}, {event_key}, {aff_click_id}, {source}, {aff_sub1} ... {aff_sub10}, {adv_sub1} ... {adv_sub5}. GET includes a signed query; POST includes signed JSON.",
              }),
            ]}
            onSubmit={async (b) => {
              const result = await send<Row>("/callbacks", b, "PUT");
              setSecret(result.secret);
              setVersion((v) => v + 1);
            }}
          />
        </div>
        {secret && (
          <Secret title="Callback signing secret - shown once" value={secret} />
        )}
      </Panel>
      <Panel title="Configured callbacks">
        <ResourceRows
          path="/callbacks"
          version={version}
          columns={["publisher_id", "offer_id", "url", "method", "active"]}
          actions={(r) => (
            <>
              <Action
                run={async () => {
                  await send(`/callbacks/${r.id}/test`, {});
                  setVersion((v) => v + 1);
                }}
              >
                Send test
              </Action>
              <Action
                run={async () => {
                  await send(
                    `/callbacks/${r.id}`,
                    { active: !r.active },
                    "PATCH",
                  );
                  setVersion((v) => v + 1);
                }}
              >
                {r.active ? "Disable" : "Enable"}
              </Action>
            </>
          )}
        />
        <p className="network-note">
          Test events use TEST_ONLY identifiers and zero payout. They create no
          conversions, invoices or earnings.
        </p>
      </Panel>
      <Panel title="Callback delivery logs">
        <ResourceRows
          path="/callback-deliveries"
          version={version}
          columns={[
            "id",
            "status",
            "attempts",
            "http_status",
            "last_error",
            "created_at",
          ]}
          actions={(r) =>
            r.status === "failed" && (
              <Action
                run={async () => {
                  await send(`/callback-deliveries/${r.id}/retry`, {});
                  setVersion((v) => v + 1);
                }}
              >
                Retry delivery
              </Action>
            )
          }
        />
      </Panel>
    </>
  );
}
