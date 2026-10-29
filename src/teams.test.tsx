import { afterEach, expect, it, vi } from "vitest";
import {
  currentSession,
  endSession,
  isActingAsPartner,
  logInAs,
  returnToOwnAccount,
  setSession,
} from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  setSession(null);
});
it("switches to a partner and back without signing the admin out", async () => {
  const admin = {
    access_token: "admin-token",
    csrf_token: "csrf",
    user: { id: "a", email: "admin@example.com", role: "admin" as const },
  };
  setSession(admin);
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: "partner-token",
        user: { id: "p", email: "agency@example.com", role: "affiliate" },
      }),
      { status: 200 },
    ),
  );
  await logInAs("p");
  expect(String(fetcher.mock.calls[0][0])).toContain("/users/p/login-as");
  expect(currentSession()?.user.email).toBe("agency@example.com");
  expect(currentSession()?.csrf_token).toBe("csrf");
  expect(isActingAsPartner()).toBe(true);
  // "Sign out" while viewing as a partner only returns to the admin.
  await endSession();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(currentSession()).toBe(admin);
  expect(isActingAsPartner()).toBe(false);
  returnToOwnAccount();
  expect(currentSession()).toBe(admin);
});
