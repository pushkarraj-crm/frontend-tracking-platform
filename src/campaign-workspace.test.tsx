import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignOperations } from "./campaign-operations";
import { SessionContext } from "./context";
import { previousPeriod, comparisonRows, change } from "./report-utils";
import type { Role } from "./api";

afterEach(() => vi.restoreAllMocks());
const campaign = {
  id: "abc",
  name: "Demo campaign",
  campaign_model: "CPL",
  payout: "5",
  revenue: "10",
  currency: "USD",
  active: true,
  destination_url: "https://brand.example",
  settings: {
    visibility: "approval",
    categories: [],
    terms: "Approved sources only",
  },
};
function setup(tab: string, role: Role = "advertiser", rows: unknown[] = []) {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const path = String(input);
      return new Response(
        JSON.stringify(
          init?.method
            ? { id: "saved", ...JSON.parse(String(init.body)) }
            : path.endsWith("/profile")
              ? campaign
              : path.includes("/campaigns?")
                ? [campaign]
                : path.includes("/users?")
                  ? [
                      {
                        id: "publisher",
                        role: "publisher",
                        active: true,
                        email: "publisher@example.com",
                      },
                    ]
                  : rows,
        ),
        { status: 200 },
      );
    });
  render(
    <MemoryRouter
      initialEntries={[`/campaign-operations?campaign=abc&tab=${tab}`]}
    >
      <SessionContext.Provider
        value={{
          access_token: "test",
          csrf_token: "test",
          user: { id: "user", role, email: "user@example.com" },
        }}
      >
        <CampaignOperations />
      </SessionContext.Provider>
    </MemoryRouter>,
  );
  return fetcher;
}
describe("campaign workspace", () => {
  it("builds payout conditions and submits API-compatible rules without JSON entry", async () => {
    const fetcher = setup("commission-rules");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add payout rules" }),
    );
    await userEvent.type(screen.getByLabelText(/^Name/), "US traffic");
    await userEvent.click(
      screen.getByRole("button", { name: "Add condition" }),
    );
    const condition = screen.getByRole("group", { name: "Condition 1" });
    await userEvent.selectOptions(
      within(condition).getByLabelText("Comparison"),
      "in",
    );
    await userEvent.type(
      within(condition).getByLabelText(/Values \(comma separated\)/),
      "US, IN",
    );
    expect(screen.queryByLabelText(/CPS percentage/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await vi.waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "POST"),
      ).toBe(true),
    );
    const [, init] = fetcher.mock.calls.find(
      ([, init]) => init?.method === "POST",
    )!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      conditions: {
        all: [{ field: "country", operator: "in", value: ["US", "IN"] }],
      },
      model: "CPL",
    });
  });
  it("edits an existing destination with selected publishers and normalized countries", async () => {
    const fetcher = setup("destinations", "advertiser", [
      {
        id: "page",
        name: "First page",
        url: "https://brand.example/one",
        weight: 1,
        countries: ["US"],
        publisher_ids: ["publisher"],
        active: true,
      },
    ]);
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/Countries/)).toHaveValue("US");
    await userEvent.type(screen.getByLabelText(/Countries/), ", in");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await vi.waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "PUT"),
      ).toBe(true),
    );
    const [path, init] = fetcher.mock.calls.find(
      ([, init]) => init?.method === "PUT",
    )!;
    expect(String(path)).toContain("/destinations/page");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      countries: ["US", "IN"],
      publisher_ids: ["publisher"],
    });
  });
  it("ignores a manager-only tab requested by a publisher", async () => {
    const fetcher = setup("traffic-rules", "publisher");
    expect(await screen.findByText("Approved sources only")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Add traffic rules" }),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(([path]) =>
        String(path).includes("/traffic-rules"),
      ),
    ).toBe(false);
    expect(screen.queryByText("Advertiser revenue")).not.toBeInTheDocument();
  });
  it("shows cap usage and a warning at the configured threshold", async () => {
    setup("caps", "advertiser", [
      {
        id: "cap",
        name: "Daily conversions",
        amount: "100",
        recorded_usage: "75",
        alert_percent: 75,
        active: true,
      },
    ]);
    const progress = await screen.findByRole("progressbar", {
      name: "Daily conversions usage",
    });
    expect(progress).toHaveAttribute("value", "75");
    expect(progress.parentElement).toHaveClass("cap-warning");
  });
});
describe("previous-period reporting", () => {
  it("uses equal, adjacent UTC windows while retaining filters", () => {
    const params = previousPeriod(
      "start=2026-10-14T00:00:00Z&end=2026-10-21T00:00:00Z&country=IN&group_by=offer",
    );
    expect(params?.get("start")).toBe("2026-10-07T00:00:00.000Z");
    expect(params?.get("end")).toBe("2026-10-14T00:00:00.000Z");
    expect(params?.get("country")).toBe("IN");
    expect(previousPeriod("start=invalid&end=invalid")).toBeNull();
  });
  it("keeps currencies and disappearing groups separate, and aligns time buckets", () => {
    const rows = comparisonRows(
      [{ group: "one", currency: "USD", clicks: 10, conversions: 2 }],
      [{ group: "one", currency: "INR", clicks: 20, conversions: 4 }],
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      clicks: 0,
      previous_clicks: 20,
      currency: "INR",
    });
    expect(
      comparisonRows(
        [{ group: "2026-10-21", currency: "USD", clicks: 5 }],
        [{ group: "2026-10-14", currency: "USD", clicks: 3 }],
        7 * 86400000,
      ),
    ).toHaveLength(1);
    expect(change(5, 0)).toBe("New");
    expect(change(0, 0)).toBe("0%");
    expect(change(15, 10)).toBe("+50.0%");
  });
});
