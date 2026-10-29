import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { BlockedSources } from "./sources-pages";

afterEach(() => vi.restoreAllMocks());

const presets = {
  cashback_sites: "Cashback and coupon sites",
  messaging_apps: "Telegram and WhatsApp",
  google_ads: "Google ads (gclid, gbraid, wbraid)",
  meta_ads: "Facebook / Instagram ads (fbclid)",
  no_referrer: "Traffic with no referring site",
};

it("toggles a preset: creates it once, then pauses the existing block", async () => {
  const block = {
    id: "b1",
    preset: "meta_ads",
    label: presets.meta_ads,
    value: "",
    campaign_id: null,
    active: true,
  };
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (input) =>
        new Response(
          JSON.stringify(
            String(input).includes("/blocked-sources") &&
              !String(input).includes("/b1")
              ? { presets, cashback_domains: ["cashkaro.com"], blocks: [block] }
              : String(input).includes("/campaigns")
                ? []
                : { ...block, active: false },
          ),
          { status: 200 },
        ),
    );
  render(<BlockedSources />);
  await userEvent.click(
    await screen.findByRole("switch", { name: /Allow: Cashback/ }),
  );
  await userEvent.click(
    screen.getByRole("switch", { name: /Blocked: Facebook/ }),
  );
  const writes = fetcher.mock.calls.filter(
    ([, init]) => init?.method && init.method !== "GET",
  );
  expect(
    writes.map(([url, init]) => [
      String(url).replace(/.*\/api/, ""),
      init?.method,
      init?.body,
    ]),
  ).toEqual([
    ["/blocked-sources", "POST", JSON.stringify({ preset: "cashback_sites" })],
    ["/blocked-sources/b1", "PATCH", JSON.stringify({ active: false })],
  ]);
});
