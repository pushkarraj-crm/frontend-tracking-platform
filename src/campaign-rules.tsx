import { campaignRuleFields } from "./campaign-rule-fields";
import { useData } from "./hooks";
import { send, type Row } from "./api";
import { Modal, Fields, Loading, ErrorBox } from "./ui";
export function CampaignRules({
  campaign,
  close,
}: {
  campaign: Row;
  close: () => void;
}) {
  const result = useData<Row>(`/offers/${campaign.id}/rules`);
  return (
    <Modal title={`Targeting and caps � ${campaign.name}`} onClose={close}>
      {result.error ? (
        <ErrorBox error={result.error} />
      ) : result.loading ? (
        <Loading />
      ) : (
        <>
          <p>
            Schedules and daily caps use UTC. Every accepted unique conversion
            counts toward caps. Fraud rules apply equally to all traffic.
          </p>
          <Fields
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
            submit="Save campaign rules"
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
                  body[key] = new Date(String(body[key]) + "Z").toISOString();
              await send(`/offers/${campaign.id}/rules`, body, "PUT");
              close();
            }}
          />
        </>
      )}
    </Modal>
  );
}
