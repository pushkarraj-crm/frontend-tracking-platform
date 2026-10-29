// Partner-postback templates for advertisers that track on another platform.
// Macros verified against each platform's help centre on 2026-10-29; re-check when a platform changes them.
export type PlatformTemplate = {
  id: string;
  name: string;
  /** Parameter on the platform's tracking link that carries Relay's click ID. */
  clickParameter: string;
  /** Relay postback parameter → the platform's macro. */
  macros: Record<string, string>;
  where: string;
  source: string;
};

export const platformTemplates: PlatformTemplate[] = [
  {
    id: "trackier",
    name: "Trackier",
    clickParameter: "p1",
    macros: { click_id: "{p1}", txn_id: "{txn_id}" },
    where: "Publisher postback (pixel) for this publisher in Trackier",
    source:
      "https://help.trackier.com/en/articles/8107293-publisher-tracking-link-macro-and-postback-parameter",
  },
  {
    id: "offer18",
    name: "Offer18",
    clickParameter: "aff_click_id",
    macros: { click_id: "{aff_click_id}" },
    where: "Affiliate global postback (S2S) in Offer18",
    source: "https://knowledgebase.offer18.com/network/postback-integration",
  },
  {
    id: "affise",
    name: "Affise",
    clickParameter: "sub1",
    macros: {
      click_id: "{sub1}",
      txn_id: "{transactionid}",
      amount: "{order_sum}",
      currency: "{order_currency}",
      coupon: "{promo_code}",
    },
    where: "Affiliate postback URL in Affise",
    source:
      "https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros",
  },
  {
    id: "everflow",
    name: "Everflow",
    clickParameter: "sub1",
    macros: {
      click_id: "{sub1}",
      txn_id: "{conversion_id}",
      amount: "{sale_amount}",
      currency: "{offer_currency}",
      coupon: "{coupon_code}",
    },
    where:
      "Partner postback in Everflow (sale amount needs “Expose Sale Amount to Partner”)",
    source:
      "https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros",
  },
  {
    id: "impact",
    name: "Impact",
    clickParameter: "subId1",
    macros: {
      click_id: "{SubId1}",
      txn_id: "{ActionId}",
      amount: "{Amount}",
      currency: "{Currency}",
      coupon: "{PromoCode}",
    },
    where:
      "Event Notification (Action Life Cycle) in Impact; decode the URL if Impact encodes it",
    source:
      "https://help.trackier.com/en/articles/8722459-integrating-with-impact",
  },
];

/** Platforms that cannot be connected by pasting a URL, with the reason shown to users. */
export const unavailablePlatforms = [
  {
    name: "AppsFlyer",
    reason:
      "AppsFlyer only sends postbacks to registered AppsFlyer integrated partners. Relay is not registered yet.",
  },
  {
    name: "Adjust",
    reason:
      "Adjust callbacks need an Adjust partner setup; attaching them to the click link would expose your postback secret.",
  },
];

export const postbackFields = [
  "click_id",
  "txn_id",
  "event",
  "amount",
  "currency",
  "status",
  "coupon",
];

/** The global postback with the platform's macros filled in; empty macros are left out. */
export function platformPostback(
  globalUrl: string,
  macros: Record<string, string>,
) {
  const query = postbackFields
    .filter((field) => macros[field]?.trim())
    .map((field) => `${field}=${macros[field].trim()}`)
    .join("&");
  return query ? `${globalUrl}?${query}` : globalUrl;
}
