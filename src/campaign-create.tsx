import { useState, type FormEvent } from "react";
import { send, type Row, type Role } from "./api";
import { staff } from "./context";
import { useCatalog } from "./hooks";
import { Modal, ErrorBox } from "./ui";

export function CampaignCreate({
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
  const [model, setModel] = useState("CPL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
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
    setBusy(true);
    setError(null);
    try {
      const campaign = await send<Row>("/campaigns", {
        name: value("name"),
        description: value("description"),
        ...(staff(role) ? { advertiser_id: value("advertiser_id") } : {}),
        campaign_model: model,
        destination_url: value("destination_url"),
        revenue: value("revenue"),
        payout: model === "CPL" ? value("payout") : "0",
        ...(model === "CPS"
          ? { sale_percentage: value("sale_percentage") }
          : {}),
        currency: value("currency").toUpperCase(),
        active: value("status") === "active",
        settings: {
          visibility: value("visibility"),
          categories: list("categories"),
          preview_url: value("preview_url") || null,
          terms: value("terms"),
          internal_notes: value("internal_notes"),
        },
        tracking_rules: {
          countries: list("countries").map((v) => v.toUpperCase()),
        },
      });
      created(campaign);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Create advertiser campaign" onClose={close}>
      <p>Set campaign details, tracking, and commission before publishing.</p>
      <form className="campaign-create" onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Campaign details</legend>
          <div className="form-grid">
            <label>
              Objective
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="CPL">Leads — fixed commission</option>
                <option value="CPS">Sales — percentage commission</option>
              </select>
            </label>
            {staff(role) && (
              <label>
                Advertiser
                <select name="advertiser_id" required defaultValue="">
                  <option value="">Select advertiser</option>
                  {users.data
                    .filter((u) => u.role === "advertiser" && u.active)
                    .map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.email}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="text-button"
                  disabled={users.loading || (!users.hasMore && !users.error)}
                  onClick={users.loadMore}
                >
                  {users.error
                    ? "Retry advertisers"
                    : users.loading
                      ? "Loading…"
                      : "Load more advertisers"}
                </button>
                {users.error && <ErrorBox error={users.error} />}
              </label>
            )}
            <label className="full">
              Campaign name
              <input name="name" required maxLength={200} />
            </label>
            <label className="full">
              Description
              <textarea name="description" rows={3} maxLength={10000} />
            </label>
            <label>
              Categories
              <input name="categories" placeholder="Ecommerce, Finance" />
              <small>Comma separated; up to 8 categories.</small>
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
          <legend>Tracking and destination</legend>
          <p>
            Server postback tracking. An advertiser S2S key is generated after
            creation.
          </p>
          <div className="form-grid">
            <label className="full">
              Final advertiser URL
              <input
                name="destination_url"
                type="url"
                required
                maxLength={2048}
                placeholder="https://brand.example/offer?click_id={click_id}"
              />
              <small>
                HTTPS only. Supported query macros include {"{click_id}"},{" "}
                {"{campaign_id}"}, and {"{affiliate_id}"}.
              </small>
            </label>
            <label className="full">
              Preview URL
              <input
                name="preview_url"
                type="url"
                placeholder="https://brand.example/preview"
              />
            </label>
            <label>
              Geo coverage
              <input name="countries" placeholder="IN, US" />
              <small>
                ISO country codes separated by commas. Leave empty to allow all
                countries.
              </small>
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Revenue and payout</legend>
          <div className="form-grid">
            <label>
              Currency
              <input
                name="currency"
                defaultValue="USD"
                required
                pattern="[A-Za-z]{3}"
                maxLength={3}
              />
            </label>
            <label>
              Advertiser revenue
              <input
                name="revenue"
                type="number"
                min="0"
                step="0.0001"
                required
                defaultValue="0"
              />
              <small>Revenue per conversion, in campaign currency.</small>
            </label>
            {model === "CPL" ? (
              <label>
                Publisher payout
                <input
                  name="payout"
                  type="number"
                  min="0"
                  step="0.0001"
                  required
                  defaultValue="0"
                />
              </label>
            ) : (
              <label>
                Sale commission percentage
                <input
                  name="sale_percentage"
                  type="number"
                  min="0.0001"
                  max="100"
                  step="0.0001"
                  required
                />
                <small>
                  Publisher payout is calculated from the reported sale amount.
                </small>
              </label>
            )}
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Access and advanced settings</legend>
          <div className="form-grid">
            <label>
              Visibility
              <select name="visibility" defaultValue="approval">
                <option value="approval">Ask for permission</option>
                <option value="open">Public — auto approve applications</option>
                <option value="private">
                  Private — assigned publishers only
                </option>
              </select>
            </label>
            <label className="full">
              Terms and traffic restrictions
              <textarea name="terms" rows={3} maxLength={20000} />
            </label>
            <label className="full">
              Internal notes
              <textarea name="internal_notes" rows={2} maxLength={10000} />
              <small>Visible to campaign managers only.</small>
            </label>
          </div>
        </fieldset>
        {error && <ErrorBox error={error} />}
        <div className="campaign-create-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create campaign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
