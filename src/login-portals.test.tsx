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
  "shows a visible %s login entry point",
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
    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      `/login?portal=${role}`,
    );
    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
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
    screen.getByRole("button", { name: "Sign in to your network" }),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    email: "pub@example.com",
    password: "test-password-123",
  });
  expect(currentSession()?.user.role).toBe("publisher");
});
