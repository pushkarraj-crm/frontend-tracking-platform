import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import type { Role } from "./api";
import { menuFor } from "./menu";
import { SidebarMenu } from "./sidebar-menu";

function mount(accountType: string, role: Role, at: string) {
  render(
    <MemoryRouter initialEntries={[at]}>
      <SidebarMenu
        groups={menuFor(accountType, role)}
        role={role}
        allowed={(path) => path !== "/platform"}
        onNavigate={() => {}}
      />
    </MemoryRouter>,
  );
}

it("opens the current page's group and highlights the most specific item", () => {
  mount("brand", "admin", "/settings?tab=alerts");
  expect(screen.getByRole("button", { name: /Agencies/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Account/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(screen.getByRole("link", { name: "Alerts" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute(
    "aria-current",
  );
});

it("keeps a campaign's own page under Campaigns and filters items by role", () => {
  mount("network", "publisher", "/campaign-operations?campaign=abc");
  expect(screen.getByRole("link", { name: "All campaigns" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    screen.getByRole("link", { name: "My tracking links" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Create campaign" })).toBeNull();
});
