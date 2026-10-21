import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { LoginGate } from "./login-gate";
import { SessionContext } from "./context";
import type { Role } from "./api";
import * as api from "./api";
afterEach(() => vi.restoreAllMocks());
function show(role: Role) {
  render(<MemoryRouter initialEntries={["/login?portal=publisher"]}>
    <SessionContext.Provider value={{ access_token: "test", csrf_token: "test", user: { id: "account", email: "account@example.com", role } }}>
      <Routes><Route path="/login" element={<LoginGate />} /><Route path="/" element={<h1>Publisher dashboard</h1>} /></Routes>
    </SessionContext.Provider>
  </MemoryRouter>);
}
it("keeps publisher login visible when an admin session exists", async () => {
  const logout = vi.spyOn(api, "endSession").mockResolvedValue(undefined);
  show("admin");
  expect(screen.getByRole("heading", { name: "Publisher login" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Publisher dashboard" })).not.toBeInTheDocument();
  expect(logout).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Sign out and use publisher login" }));
  expect(logout).toHaveBeenCalledOnce();
});
it("lets an authenticated publisher reach their dashboard", () => {
  show("publisher");
  expect(screen.getByRole("heading", { name: "Publisher dashboard" })).toBeVisible();
});
it("shows logout failures rather than navigating to another portal", async () => {
  vi.spyOn(api, "endSession").mockRejectedValue(new Error("Could not sign out"));
  show("admin");
  await userEvent.click(screen.getByRole("button", { name: "Sign out and use publisher login" }));
  expect(await screen.findByText("Could not sign out")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Publisher login" })).toBeVisible();
});