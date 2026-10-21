import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Postbacks } from "./postbacks-page";
import { SessionContext } from "./context";

afterEach(() => vi.restoreAllMocks());
function mount() {
  render(
    <SessionContext.Provider
      value={{
        access_token: "test",
        csrf_token: "test",
        user: {
          id: "user",
          email: "advertiser@example.com",
          role: "advertiser",
        },
      }}
    >
      <Postbacks />
    </SessionContext.Provider>,
  );
}
it("guides the user through a campaign-specific endpoint and receipt status", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const path = String(input);
      const campaign = {
        id: "campaign",
        name: "Sale campaign",
        active: true,
        campaign_model: "CPS",
        currency: "INR",
        postback_url: "https://api.example/postbacks/campaign",
      };
      return new Response(
        JSON.stringify(
          path.endsWith("/profile")
            ? campaign
            : path.includes("postback-receipts")
              ? [
                  {
                    id: "receipt",
                    transaction_id: "order-1",
                    event_key: "initial",
                    result: "accepted",
                    http_status: 201,
                    created_at: "2026-10-21T10:00:00Z",
                  },
                ]
              : [campaign],
        ),
        { status: 200 },
      );
    });
  mount();
  await userEvent.selectOptions(
    await screen.findByRole("combobox", { name: "Campaign" }),
    "campaign",
  );
  expect(
    await screen.findByText("https://api.example/postbacks/campaign"),
  ).toBeVisible();
  expect(await screen.findByText("order-1")).toBeVisible();
  expect(
    fetcher.mock.calls.some(([path]) =>
      String(path).includes("postback-receipts?offer_id=campaign"),
    ),
  ).toBe(true);
  const advanced = screen
    .getByText("Advanced: request example and responses")
    .closest("details")!;
  expect(advanced).not.toHaveAttribute("open");
  await userEvent.click(
    screen.getByText("Advanced: request example and responses"),
  );
  expect(advanced.textContent).toContain('"sale_currency": "INR"');
  expect(advanced.textContent).toContain('"event_type": "sale"');
  await userEvent.click(screen.getByRole("button", { name: "Refresh status" }));
  await vi.waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([path]) =>
        String(path).includes("postback-receipts"),
      ),
    ).toHaveLength(2),
  );
  expect(
    fetcher.mock.calls.every(
      ([, init]) => !init?.method || init.method === "GET",
    ),
  ).toBe(true);
});
it("shows a useful next step when no campaigns exist", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("[]", { status: 200 }),
  );
  mount();
  expect(
    await screen.findByRole("link", { name: "Go to campaigns" }),
  ).toHaveAttribute("href", "/offers");
  expect(
    screen.queryByText("Incoming conversion requests"),
  ).not.toBeInTheDocument();
});
