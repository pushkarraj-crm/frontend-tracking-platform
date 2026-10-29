import { describe, expect, it } from "vitest";
import { platformPostback, platformTemplates } from "./platform-templates";

describe("platformPostback", () => {
  it("fills the platform's macros in Relay's field order and skips blanks", () => {
    const everflow = platformTemplates.find((t) => t.id === "everflow")!;
    expect(
      platformPostback("https://r.example/pb/s3cret", everflow.macros),
    ).toBe(
      "https://r.example/pb/s3cret?click_id={sub1}&txn_id={conversion_id}&amount={sale_amount}&currency={offer_currency}&coupon={coupon_code}",
    );
    expect(
      platformPostback("https://r.example/pb/s3cret", {
        click_id: " {cid} ",
        status: "",
      }),
    ).toBe("https://r.example/pb/s3cret?click_id={cid}");
  });

  it("gives every template a click ID macro", () => {
    for (const t of platformTemplates)
      expect(t.macros.click_id).toMatch(/^\{.+\}$/);
  });
});
