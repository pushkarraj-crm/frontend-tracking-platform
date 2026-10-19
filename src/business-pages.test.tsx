import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Invoices, Postbacks, Campaigns } from "./business-pages";
import { SessionContext } from "./context";
import type { Role } from "./api";
import type { ReactNode } from "react";
afterEach(() => vi.restoreAllMocks());
function portal(role: Role, children: ReactNode) {
  render(
    <SessionContext.Provider
      value={{
        access_token: "test",
        csrf_token: "test",
        user: { id: "party", email: "party@example.com", role },
      }}
    >
      {children}
    </SessionContext.Provider>,
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
