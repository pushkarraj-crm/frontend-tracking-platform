import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CampaignOperations } from "./campaign-operations";
import { NetworkOperations } from "./network-operations";
import { PartnerCallbacks } from "./callbacks-page";
import { SessionContext } from "./context";
import type { ReactNode } from "react";
import type { Role } from "./api";
afterEach(() => vi.restoreAllMocks());
function portal(role: Role, element: ReactNode, url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <SessionContext.Provider
        value={{
          access_token: "test",
          csrf_token: "test",
          user: { id: "party", email: "qa@example.com", role },
        }}
      >
        {element}
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}
function responses() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    return new Response(
      JSON.stringify(
        url.includes("/integrations/catalog")
          ? [
              {
                provider: "meta_ads",
                name: "Meta Conversions API",
                fields: ["dataset_id"],
                secrets: ["access_token"],
                guide:
                  "https://developers.facebook.com/docs/marketing-api/conversions-api/",
              },
            ]
          : [],
      ),
      { status: 200 },
    );
  });
}
describe("network operation role boundaries", () => {
  it("publishers cannot see campaign cap and access-management controls", () => {
    responses();
    portal(
      "publisher",
      <CampaignOperations />,
      "/campaign-operations?campaign=abc&tab=events",
    );
    expect(
      screen.queryByRole("button", { name: "caps" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "assign" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add events" }),
    ).not.toBeInTheDocument();
  });
  it("provider drafts state that live delivery is disabled and omit blank credentials", async () => {
    const fetch = responses();
    portal("advertiser", <NetworkOperations />, "/network?tab=integrations");
    await screen.findByRole("option", { name: "Meta Conversions API" });
    await userEvent.selectOptions(
      screen.getByLabelText("Provider"),
      "meta_ads",
    );
    await userEvent.type(
      await screen.findByLabelText(/dataset id/),
      "test-dataset",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    const call = fetch.mock.calls.find((c) =>
      String(c[0]).endsWith("/integrations/meta_ads"),
    );
    expect(call).toBeDefined();
    const body = JSON.parse(String(call![1]?.body));
    expect(body).toEqual({ configuration: { dataset_id: "test-dataset" } });
    expect(
      screen.getByText(/No live provider delivery is enabled/),
    ).toBeInTheDocument();
  });
  it("publisher callback configuration cannot select another publisher", async () => {
    responses();
    portal("publisher", <PartnerCallbacks />, "/callbacks");
    expect(
      screen.queryByLabelText("Publisher or affiliate"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/zero payout/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Delivery method/)).toHaveValue("POST");
  });
});
