import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  api,
  currentSession,
  endSession,
  login,
  query,
  refresh,
  setSession,
} from "./api";
const user = {
  id: "a".repeat(32),
  email: "admin@example.com",
  role: "admin" as const,
};
const session = { access_token: "access-1", csrf_token: "csrf-1", user };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  setSession(null);
  vi.restoreAllMocks();
});
describe("API authentication contract", () => {
  it("logs in with only email and password; tokens are not persisted", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(session));
    await login(user.email, "long-password-123");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(JSON.parse(init!.body as string)).toEqual({
      email: user.email,
      password: "long-password-123",
    });
    expect(init!.credentials).toBe("include");
    expect(currentSession()?.access_token).toBe("access-1");
    expect(localStorage.length).toBe(0);
  });
  it("refreshes using a fresh CSRF token and coalesces concurrent calls", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ csrf_token: "csrf-cookie" }))
      .mockResolvedValueOnce(json(session));
    await Promise.all([refresh(), refresh()]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      "X-CSRF-Token": "csrf-cookie",
    });
  });
  it("retries an expired access token once after rotating the session", async () => {
    setSession(session);
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ csrf_token: "csrf-next" }))
      .mockResolvedValueOnce(json({ ...session, access_token: "access-2" }))
      .mockResolvedValueOnce(json([{ id: "offer" }]));
    expect(await api("/offers")).toEqual([{ id: "offer" }]);
    expect(fetcher.mock.calls[3][1]?.headers).toMatchObject({
      Authorization: "Bearer access-2",
    });
  });
  it("sends the CSRF and bearer credentials when signing out", async () => {
    setSession(session);
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ csrf_token: "csrf-1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await endSession();
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      "X-CSRF-Token": "csrf-1",
      Authorization: "Bearer access-1",
    });
    expect(currentSession()).toBeNull();
  });
  it("retains the session when logout fails", async () => {
    setSession(session);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ detail: "Unavailable" }, 503),
    );
    await expect(endSession()).rejects.toThrow("Unavailable");
    expect(currentSession()).not.toBeNull();
  });
  it("returns actionable validation errors and request references", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [{ loc: ["body", "country"], msg: "Invalid country" }],
        }),
        { status: 422, headers: { "X-Request-ID": "request-123" } },
      ),
    );
    try {
      await api("/offers");
      expect.fail("Expected error");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe("country: Invalid country");
      expect((e as ApiError).requestId).toBe("request-123");
    }
  });
  it("does not retry rejected writes or 402 entitlement failures", async () => {
    setSession(session);
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ detail: "Trial expired" }, 402));
    await expect(
      api("/offers", { method: "POST", body: "{}" }),
    ).rejects.toThrow("Trial expired");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("omits blank query filters without losing zero values", () => {
    expect(
      query({ limit: 0, offset: 0, country: "", offer_id: undefined }),
    ).toBe("limit=0&offset=0");
  });
});
