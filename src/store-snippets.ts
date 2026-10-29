// Ready-to-paste store snippets. Shopify custom pixels run in Shopify's sandbox, so they use
// its Web Pixels API (analytics.subscribe, browser.localStorage) instead of relay.js.
// Checkout event names come from Offer18's Shopify guide; not yet verified on a live store.
export type StorePlatform = {
  id: string;
  name: string;
  steps: string[];
  snippets: (
    endpoint: string,
    sdk: string,
  ) => { title: string; code: string }[];
};

const shopifyBase = (endpoint: string) => `const RELAY_ENDPOINT = "${endpoint}";
// Keep Relay's click ID from the landing URL in this shop's own storage for 30 days.
analytics.subscribe("page_viewed", async (event) => {
  const id = new URL(event.context.document.location.href).searchParams.get("click_id");
  if (id && /^[a-f0-9]{32}$/.test(id)) {
    await browser.localStorage.setItem("relay_click", JSON.stringify({ id, at: Date.now() }));
  }
});
async function relaySale(orderId, amount, currency, coupon) {
  let click = null;
  try {
    const saved = JSON.parse((await browser.localStorage.getItem("relay_click")) || "null");
    if (saved && Date.now() - saved.at < 30 * 864e5) click = saved.id;
  } catch (e) {}
  if (!orderId || (!click && !coupon)) return;
  const body = { txn_id: String(orderId) };
  if (click) body.click_id = click;
  if (coupon) body.coupon = String(coupon);
  if (amount != null) body.amount = String(amount);
  if (currency) body.currency = String(currency);
  // text/plain avoids a CORS preflight; Relay records the sale as pending.
  fetch(RELAY_ENDPOINT, { method: "POST", mode: "cors", credentials: "omit", keepalive: true,
    headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) });
}`;

const shopifySteps = [
  "In Shopify admin open Settings → Customer events → Add custom pixel.",
  "Name it Relay, delete the sample code and paste the code below.",
  "Save, then Connect the pixel.",
];

const shopifyVariant = (
  id: string,
  name: string,
  purchase: string,
): StorePlatform => ({
  id,
  name,
  steps: shopifySteps,
  snippets: (endpoint) => [
    {
      title: "Custom pixel code",
      code: `${shopifyBase(endpoint)}\n${purchase}`,
    },
  ],
});

export const storePlatforms: StorePlatform[] = [
  shopifyVariant(
    "shopify",
    "Shopify (standard checkout)",
    `analytics.subscribe("checkout_completed", (event) => {
  const c = event.data.checkout;
  const code = (c.discountApplications || []).find((d) => d.type === "DISCOUNT_CODE");
  relaySale(c.order && c.order.id, c.totalPrice && c.totalPrice.amount, c.currencyCode, code && code.title);
});`,
  ),
  shopifyVariant(
    "shiprocket",
    "Shopify + Shiprocket checkout",
    `analytics.subscribe("PurchaseSR", (event) => {
  relaySale(event.customData.transaction_id, event.customData.value, "", "");
});`,
  ),
  shopifyVariant(
    "gokwik",
    "Shopify + GoKwik checkout",
    `analytics.subscribe("gokwik_purchase_event", (event) => {
  relaySale(event.customData.order_name, event.customData.total_price, "", "");
});`,
  ),
  shopifyVariant(
    "flexype",
    "Shopify + Flexype checkout",
    `analytics.subscribe("flexype:purchase", (event) => {
  const d = event.customData;
  const coupon = (d.coupons || [])[0];
  relaySale(d.shopify_order_name, d.pricing && d.pricing.total, d.currency, coupon && coupon.code);
});`,
  ),
  {
    id: "woocommerce",
    name: "WooCommerce",
    steps: [
      "Add the first snippet to every page's header (for example with the WPCode plugin → Header & Footer).",
      "Add the second snippet to your theme's functions.php (or a code-snippets plugin) as PHP.",
      "Place a test order from a Relay tracking link and check Conversions.",
    ],
    snippets: (endpoint, sdk) => [
      {
        title: "Header (all pages)",
        code: `<script src="${sdk}"></script>
<script>RelayTracking.remember({ param: "click_id" });</script>`,
      },
      {
        title: "functions.php",
        code: `add_action('woocommerce_thankyou', function ($order_id) {
  $order = wc_get_order($order_id);
  if (!$order) return;
  $codes = $order->get_coupon_codes();
  $sale = array(
    'endpoint' => '${endpoint}',
    'orderId'  => (string) $order->get_order_number(),
    'amount'   => (string) $order->get_subtotal(),
    'currency' => $order->get_currency(),
    'coupon'   => $codes ? (string) reset($codes) : '',
  );
  echo '<script src="${sdk}"></script>';
  echo '<script>RelayTracking.conversion(' . wp_json_encode($sale) . ');</script>';
});`,
      },
    ],
  },
  {
    id: "website",
    name: "Any other website",
    steps: [
      "Add the first snippet to every page.",
      "Add the second snippet to the order confirmation page, filled with the real order values.",
    ],
    snippets: (endpoint, sdk) => [
      {
        title: "Every page",
        code: `<script src="${sdk}"></script>
<script>RelayTracking.remember({ param: "click_id" });</script>`,
      },
      {
        title: "Order confirmation page",
        code: `<script src="${sdk}"></script>
<script>
  RelayTracking.conversion({
    endpoint: "${endpoint}",
    orderId: "ORDER_ID",   // your order number
    amount: "ORDER_TOTAL", // for % commission
    currency: "INR",
    coupon: "",            // the discount code, if any
  });
</script>`,
      },
    ],
  },
];
