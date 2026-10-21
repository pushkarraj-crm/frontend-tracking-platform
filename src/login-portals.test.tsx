import { Partners } from "./pages";
import { SessionContext } from "./context";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi, afterEach } from "vitest";
import { AuthPage } from "./auth-pages";
import { currentSession, setSession } from "./api";
afterEach(() => {
  vi.restoreAllMocks();
  setSession(null);
});
it.each(["advertiser", "publisher"])(
  "opens a shared %s link without public role buttons",
  async (role) => {
    render(
      <MemoryRouter initialEntries={[`/login?portal=${role}`]}>
        <AuthPage />
      </MemoryRouter>,
    );
    const label = role[0].toUpperCase() + role.slice(1);
    expect(
      screen.getByRole("heading", { name: `${label} login` }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Login portals" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  },
);
it("portal links never submit or grant an account role", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: "test",
        csrf_token: "test",
        user: {
          id: "publisher",
          email: "pub@example.com",
          role: "publisher",
        },
      }),
      { status: 200 },
    ),
  );
  render(
    <MemoryRouter initialEntries={["/login?portal=advertiser"]}>
      <AuthPage />
    </MemoryRouter>,
  );
  await userEvent.type(
    screen.getByLabelText(/Email address/),
    "pub@example.com",
  );
  await userEvent.type(screen.getByLabelText(/Password/), "test-password-123");
  await userEvent.click(
    screen.getByRole("button", { name: "Sign in as advertiser" }),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    email: "pub@example.com",
    password: "test-password-123",
  });
  expect(currentSession()?.user.role).toBe("publisher");
});

it("network admins create partners and find their login URLs inside the dashboard", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify([]), { status: 200 }),
  );
  render(
    <MemoryRouter>
      <SessionContext.Provider
        value={{
          access_token: "test",
          csrf_token: "test",
          user: { id: "admin", email: "admin@example.com", role: "admin" },
        }}
      >
        <Partners />
      </SessionContext.Provider>
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Partner login URLs" }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", {
      name: window.location.origin + "/login?portal=publisher",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", {
      name: window.location.origin + "/login?portal=advertiser",
    }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Add advertiser" }));
  expect(screen.getByLabelText(/Role/)).toHaveValue("advertiser");
});
