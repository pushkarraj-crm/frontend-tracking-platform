import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Invoices, Postbacks, Campaigns } from "./business-pages";
import { SessionContext } from "./context";
import type { Role } from "./api";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
afterEach(() => vi.restoreAllMocks());
// After saving, a new campaign opens on its own page with the one-time postback key.
function CampaignPageProbe() {
  const location = useLocation();
  return (
    <p>
      {(location.state as { postbackKey?: string }).postbackKey}{" "}
      {location.search}
    </p>
  );
}
function portal(role: Role, children: ReactNode) {
  render(
    <MemoryRouter>
      <SessionContext.Provider
        value={{
          access_token: "test",
          csrf_token: "test",
          user: { id: "party", email: "party@example.com", role },
        }}
      >
        <Routes>
          <Route path="/campaign-operations" element={<CampaignPageProbe />} />
          <Route path="*" element={children} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}
function invoices(status: string) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    const invoice = {
      id: "invoice",
      number: "INV-001",
      amount: "12.5000",
      currency: "USD",
      status,
      lines: [],
      events: [],
    };
    return new Response(
      JSON.stringify(
        path.endsWith("/summary")
          ? { totals: [] }
          : path.endsWith("/invoice")
            ? invoice
            : [invoice],
      ),
      { status: 200 },
    );
  });
}
describe("direct payment role boundaries", () => {
  it("advertisers can report payment but cannot confirm publisher receipt", async () => {
    invoices("approved");
    portal("advertiser", <Invoices />);
    await userEvent.click(
      await screen.findByRole("button", { name: "View invoice" }),
    );
    expect(
      await screen.findByRole("option", { name: "report payment" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "confirm receipt" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit invoice" }),
    ).not.toBeInTheDocument();
  });
  it("only publishers see receipt confirmation and dispute actions", async () => {
    invoices("payment_reported");
    portal("publisher", <Invoices />);
    await userEvent.click(
      await screen.findByRole("button", { name: "View invoice" }),
    );
    expect(
      await screen.findByRole("option", { name: "confirm receipt" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "dispute" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "report payment" }),
    ).not.toBeInTheDocument();
  });
  it("network staff can inspect invoices without acting as either payment party", async () => {
    invoices("submitted");
    portal("staff", <Invoices />);
    await userEvent.click(
      await screen.findByRole("button", { name: "View invoice" }),
    );
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "approve" }),
    ).not.toBeInTheDocument();
  });
});
it("publishers configure S2S callbacks and see the signature contract", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ url: null, active: false }), { status: 200 }),
  );
  portal("publisher", <Postbacks />);
  expect(
    await screen.findByLabelText(/HTTPS callback URL/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/X-Webhook-Signature as HMAC-SHA256/),
  ).toBeInTheDocument();
});
it("publishers apply to campaigns and cannot create campaigns or rotate advertiser secrets", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          id: "campaign",
          name: "Lead campaign",
          campaign_model: "CPL",
          payout: "5",
          currency: "USD",
          active: true,
        },
      ]),
      { status: 200 },
    ),
  );
  portal("publisher", <Campaigns />);
  expect(
    await screen.findByRole("button", { name: "Apply" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Create campaign" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Rotate S2S key" }),
  ).not.toBeInTheDocument();
});

it("advertisers clone into a paused campaign and receive the new key", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const path = String(input);
      return new Response(
        JSON.stringify(
          path.endsWith("/clone")
            ? { id: "copy", active: false, postback_key: "new-secret-key" }
            : [
                {
                  id: "original",
                  name: "Original campaign",
                  campaign_model: "CPL",
                  payout: "5",
                  currency: "INR",
                  active: true,
                  postback_url: "/postbacks/original",
                },
              ],
        ),
        { status: 200 },
      );
    });
  portal("advertiser", <Campaigns />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Clone campaign" }),
  );
  expect(screen.getByLabelText(/New campaign name/)).toHaveValue(
    "Original campaign copy",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Create paused copy" }),
  );
  expect(await screen.findByText("new-secret-key")).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining("/campaigns/original/clone"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Original campaign copy" }),
    }),
  );
});
it("creates a campaign with independent pricing, targeting and access settings", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (_input, init) =>
        new Response(
          JSON.stringify(
            init?.method === "POST"
              ? { id: "new", postback_key: "created-key" }
              : [],
          ),
          { status: 200 },
        ),
    );
  portal("advertiser", <Campaigns />);
  await userEvent.click(
    screen.getByRole("button", { name: "Create campaign" }),
  );
  await userEvent.type(screen.getByLabelText("Campaign name"), "Demo campaign");
  await userEvent.type(
    screen.getByLabelText(/Final advertiser URL/),
    "https://brand.example/offer",
  );
  await userEvent.clear(screen.getByLabelText(/Advertiser revenue/));
  await userEvent.type(screen.getByLabelText(/Advertiser revenue/), "10");
  await userEvent.clear(screen.getByLabelText("Publisher payout"));
  await userEvent.type(screen.getByLabelText("Publisher payout"), "5");
  await userEvent.type(screen.getByLabelText(/Geo coverage/), "in, us");
  await userEvent.type(screen.getByLabelText(/Categories/), "Ecommerce");
  await userEvent.selectOptions(screen.getByLabelText("Visibility"), "open");
  await userEvent.selectOptions(screen.getByLabelText("Status"), "paused");
  await userEvent.click(
    screen.getAllByRole("button", { name: "Create campaign" }).at(-1)!,
  );
  expect(await screen.findByText(/created-key .*tab=affiliates/)).toBeVisible();
  const call = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
    revenue: "10",
    payout: "5",
    active: false,
    settings: { visibility: "open", categories: ["Ecommerce"] },
    tracking_rules: { countries: ["IN", "US"] },
  });
});
it("a fintech template creates the campaign with its funnel stages", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (_input, init) =>
        new Response(
          JSON.stringify(
            init?.method === "POST"
              ? { id: "new", postback_key: "loan-key" }
              : [],
          ),
          { status: 200 },
        ),
    );
  portal("advertiser", <Campaigns />);
  await userEvent.click(
    screen.getByRole("button", { name: "Create campaign" }),
  );
  await userEvent.click(screen.getByRole("radio", { name: /personal loan/ }));
  await userEvent.type(
    screen.getByLabelText("Campaign name"),
    "HDFC personal loan",
  );
  await userEvent.type(
    screen.getByLabelText(/Final advertiser URL/),
    "https://lender.example/apply",
  );
  await userEvent.click(screen.getByRole("button", { name: /Add click_id=/ }));
  await userEvent.click(
    screen.getAllByRole("button", { name: "Create campaign" }).at(-1)!,
  );
  expect(await screen.findByText(/loan-key .*tab=affiliates/)).toBeVisible();
  const call = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
  const body = JSON.parse(String(call?.[1]?.body));
  expect(body).toMatchObject({
    destination_url: "https://lender.example/apply?click_id={click_id}",
    attribution_hours: 1440,
    settings: { categories: ["Loans"] },
    tracking_rules: { countries: ["IN"] },
  });
  expect(body.events.map((e: { code: string }) => e.code)).toEqual([
    "approved",
    "disbursed",
  ]);
});
