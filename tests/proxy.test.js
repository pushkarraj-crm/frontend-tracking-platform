// @vitest-environment node
import { Writable } from "node:stream";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import proxy, { proxyIdentity, rewriteCookie } from "../api/proxy.js";
const key = "proxy-test-secret-".repeat(3);
const handler = (req, res) =>
  proxy(
    { ...req, headers: { "x-forwarded-for": "203.0.113.10", ...req.headers } },
    res,
  );
class Result extends Writable {
  headers = {};
  chunks = [];
  statusCode = 200;
  setHeader(k, v) {
    this.headers[k.toLowerCase()] = v;
  }
  _write(chunk, encoding, done) {
    this.chunks.push(Buffer.from(chunk));
    done();
  }
  get text() {
    return Buffer.concat(this.chunks).toString();
  }
}
beforeEach(() => {
  vi.stubEnv("PROXY_IP_SECRET", key);
  vi.stubEnv("VERCEL", "1");
});
afterEach(() => {
  delete process.env.API_ORIGIN;
  delete process.env.COMPANY_BASE_DOMAIN;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("preserves refresh cookies while moving their path behind the frontend API", () => {
  expect(
    rewriteCookie("refresh_token=test; HttpOnly; Path=/auth; SameSite=Strict"),
  ).toBe(
    "refresh_token=test; HttpOnly; Path=/api/auth; SameSite=Strict; Secure",
  );
  expect(rewriteCookie("csrf_token=test; Path=/; Secure")).toBe(
    "csrf_token=test; Path=/; Secure",
  );
});
it("proxies authenticated requests and streams CSV without caching", async () => {
  process.env.API_ORIGIN = "https://backend.example.com";
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response("id,amount\n1,1.00", {
        headers: { "Content-Type": "text/csv", "X-Export-Truncated": "false" },
      }),
    );
  const res = new Result();
  await handler(
    {
      url: "/api/proxy?upstreamPath=reports/export/conversions&country=IN",
      method: "GET",
      headers: {
        cookie:
          "refresh_token=test; csrf_token=csrf; unrelated_private_cookie=omit",
        authorization: "Bearer test",
      },
    },
    res,
  );
  expect(fetcher.mock.calls[0][0].href).toBe(
    "https://backend.example.com/reports/export/conversions?country=IN",
  );
  expect(fetcher.mock.calls[0][1].headers.get("cookie")).toBe(
    "refresh_token=test; csrf_token=csrf",
  );
  expect(res.text).toContain("1,1.00");
  expect(res.headers["cache-control"]).toBe("no-store");
});
it("rejects path traversal and does not contact an arbitrary destination", async () => {
  process.env.API_ORIGIN = "https://backend.example.com";
  const fetcher = vi.spyOn(globalThis, "fetch");
  const res = new Result();
  await handler(
    { url: "/api/proxy?upstreamPath=../internal", method: "GET", headers: {} },
    res,
  );
  expect(res.statusCode).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it("returns an explicit setup error when the backend is not connected", async () => {
  const res = new Result();
  await handler(
    { url: "/api/proxy?upstreamPath=offers", method: "GET", headers: {} },
    res,
  );
  expect(res.statusCode).toBe(503);
});

it("routes companies from the request host and ignores a supplied company header", async () => {
  process.env.API_ORIGIN = "https://backend.example.com";
  process.env.COMPANY_BASE_DOMAIN = "example.com";
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response("{}", { headers: { "Content-Type": "application/json" } }),
    );
  await handler(
    {
      url: "/api/proxy?upstreamPath=offers",
      method: "GET",
      headers: { host: "media.example.com", "x-company-slug": "other" },
    },
    new Result(),
  );
  expect(fetcher.mock.calls[0][1].headers.get("x-company-slug")).toBe("media");
});
it("does not route root or unrelated hosts to a supplied company", async () => {
  process.env.API_ORIGIN = "https://backend.example.com";
  process.env.COMPANY_BASE_DOMAIN = "example.com";
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response("{}"));
  for (const host of ["example.com", "media.example.com.evil.test"]) {
    await handler(
      {
        url: "/api/proxy?upstreamPath=offers",
        method: "GET",
        headers: { host, "x-company-slug": "media" },
      },
      new Result(),
    );
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const call of fetcher.mock.calls)
    expect(call[1].headers.get("x-company-slug")).toBeNull();
});

it("signs provider visitor identity and binds method, target and company", () => {
  const target = new URL("https://backend.invalid/auth/login?next=a+b");
  const headers = proxyIdentity(
    { method: "POST", headers: { "x-forwarded-for": "203.0.113.10" } },
    target,
    "demo",
  );
  const message = [
    "relay-ip-v1",
    headers["x-relay-proxy-time"],
    "203.0.113.10",
    "POST",
    "/auth/login?next=a+b",
    "demo",
  ].join("\n");
  expect(headers["x-relay-client-ip"]).toBe("203.0.113.10");
  expect(headers["x-relay-proxy-signature"]).toBe(
    createHmac("sha256", key).update(message).digest("hex"),
  );
});

it("outside Vercel uses the socket peer instead of forwarded headers", () => {
  vi.stubEnv("VERCEL", "0");
  const result = proxyIdentity(
    {
      method: "GET",
      headers: { "x-forwarded-for": "203.0.113.10" },
      socket: { remoteAddress: "::1" },
    },
    new URL("https://backend.invalid/me"),
  );
  expect(result["x-relay-client-ip"]).toBe("::1");
});

it("agrees with the backend signature protocol vector", () => {
  vi.spyOn(Date, "now").mockReturnValue(1800000000000);
  const headers = proxyIdentity(
    { method: "POST", headers: { "x-forwarded-for": "203.0.113.10" } },
    new URL("https://backend.invalid/auth/login?next=a+b"),
    "demo",
  );
  expect(headers["x-relay-proxy-signature"]).toBe(
    "b9859815436896fc85c26900995cda50ebf30dd6b96917324cc0ae94407f4516",
  );
});

it("requires an unambiguous valid provider IP and a strong secret", () => {
  const target = new URL("https://backend.invalid/me");
  for (const ip of [
    undefined,
    "invalid",
    "203.0.113.10, 198.51.100.2",
    ["203.0.113.10"],
  ]) {
    expect(() =>
      proxyIdentity(
        { method: "GET", headers: { "x-forwarded-for": ip } },
        target,
      ),
    ).toThrow();
  }
  vi.stubEnv("PROXY_IP_SECRET", "short");
  expect(() =>
    proxyIdentity(
      { method: "GET", headers: { "x-forwarded-for": "203.0.113.10" } },
      target,
    ),
  ).toThrow();
});

it("replaces caller-supplied identity headers and keeps visitors distinct", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(null, { status: 204 }));
  process.env.API_ORIGIN = "https://backend.invalid/";
  for (const ip of ["203.0.113.10", "198.51.100.20"]) {
    const res = new Result();
    await handler(
      {
        method: "POST",
        url: "/api/proxy?upstreamPath=auth%2Flogin",
        headers: {
          "x-forwarded-for": ip,
          "x-relay-client-ip": "127.0.0.1",
          "x-relay-proxy-signature": "forged",
        },
        body: {},
      },
      res,
    );
    expect(res.statusCode).toBe(204);
  }
  const [first, second] = fetcher.mock.calls.map((call) => call[1].headers);
  expect(first.get("x-relay-client-ip")).toBe("203.0.113.10");
  expect(second.get("x-relay-client-ip")).toBe("198.51.100.20");
  expect(first.get("x-relay-proxy-signature")).not.toBe(
    second.get("x-relay-proxy-signature"),
  );
  expect(first.get("x-forwarded-for")).toBeNull();
});

it("fails closed without contacting the backend when signing is unconfigured", async () => {
  process.env.API_ORIGIN = "https://backend.invalid/";
  vi.stubEnv("PROXY_IP_SECRET", "");
  const fetcher = vi.spyOn(globalThis, "fetch");
  const res = new Result();
  await handler(
    { method: "GET", url: "/api/proxy?upstreamPath=me", headers: {} },
    res,
  );
  expect(res.statusCode).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
