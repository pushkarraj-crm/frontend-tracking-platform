import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi } from "vitest";
import { Partners } from "./pages";
import { SessionContext } from "./context";
import type { Role } from "./api";
function portal(role: Role) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          id: "other",
          email: "publisher@example.com",
          role: "publisher",
          active: true,
        },
      ]),
      { status: 200 },
    ),
  );
  render(
    <MemoryRouter>
      <SessionContext.Provider
        value={{
          access_token: "test",
          csrf_token: "test",
          user: { id: "current", email: "staff@example.com", role },
        }}
      >
        <Partners />
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}
it("staff can read partners but cannot create or deactivate accounts", async () => {
  portal("staff");
  await screen.findByRole("table");
  expect(
    screen.queryByRole("button", { name: "Add partner" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Deactivate" }),
  ).not.toBeInTheDocument();
});
it("affiliates see only publisher creation and cannot choose privileged roles", async () => {
  portal("affiliate");
  await userEvent.click(screen.getByRole("button", { name: "Add publisher" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByRole("option", { name: "Publisher" })).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Admin" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Parent affiliate/)).not.toBeInTheDocument();
});
