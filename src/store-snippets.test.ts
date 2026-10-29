import { describe, expect, it } from "vitest";
import { storePlatforms } from "./store-snippets";

const endpoint = "https://track.example/wc/AbCdEfGhIjKlMnOpQrStUv";
const sdk = "https://track.example/sdk/relay.js";

describe("store snippets", () => {
  it("Shopify pixels are valid JavaScript with the endpoint filled in", () => {
    const shopify = storePlatforms.filter((p) =>
      ["shopify", "shiprocket", "gokwik", "flexype"].includes(p.id),
    );
    expect(shopify).toHaveLength(4);
    for (const platform of shopify) {
      const [pixel] = platform.snippets(endpoint, sdk);
      expect(pixel.code).toContain(`"${endpoint}"`);
      // Shopify runs this as a script body with analytics/browser in scope.
      expect(
        () => new Function("analytics", "browser", pixel.code),
      ).not.toThrow();
    }
  });

  it("WooCommerce and plain sites load relay.js and report to the same endpoint", () => {
    for (const id of ["woocommerce", "website"]) {
      const code = storePlatforms
        .find((p) => p.id === id)!
        .snippets(endpoint, sdk)
        .map((s) => s.code)
        .join("\n");
      expect(code).toContain(sdk);
      expect(code).toContain(endpoint);
      expect(code).toContain("RelayTracking.remember");
    }
  });
});
