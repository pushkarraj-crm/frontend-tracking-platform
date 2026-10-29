import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Role } from "./api";
import { pathOf, type MenuGroup, type MenuItem } from "./menu";

// A campaign's own page belongs to the Campaigns menu.
const aliases: Record<string, string> = { "/campaign-operations": "/offers" };

export function SidebarMenu({
  groups,
  role,
  allowed,
  onNavigate,
}: {
  groups: MenuGroup[];
  role: Role;
  allowed: (path: string) => boolean;
  onNavigate: () => void;
}) {
  const location = useLocation(),
    params = new URLSearchParams(location.search),
    here = aliases[location.pathname] || location.pathname;
  const query = (item: MenuItem) => [
    ...new URLSearchParams(item.to.split("?")[1] || ""),
  ];
  const matches = (item: MenuItem) =>
    pathOf(item.to) === here &&
    (here !== location.pathname
      ? query(item).length === 0
      : query(item).every(([k, v]) => params.get(k) === v));
  // The most specific match wins: "Settings → Alerts" over plain "Settings".
  const isActive = (item: MenuItem, siblings: MenuItem[]) =>
    matches(item) &&
    !siblings.some(
      (s) => s !== item && matches(s) && query(s).length > query(item).length,
    );
  const visible = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => allowed(pathOf(i.to)) && (!i.roles || i.roles.includes(role)),
      ),
    }))
    .filter((g) => g.items.length);
  const all = visible.flatMap((g) => g.items);
  const current = visible.find((g) => g.items.some((i) => isActive(i, all)));
  const [opened, setOpened] = useState<string | null>(null);
  const open = opened ?? current?.label ?? null;
  return (
    <nav>
      {visible.map(({ label, icon: Icon, items }) => {
        if (items.length === 1) {
          const [item] = items;
          return (
            <Link
              key={label}
              to={item.to}
              className={isActive(item, all) ? "active" : undefined}
              onClick={onNavigate}
            >
              <Icon size={18} />
              <span>
                {label === "Fraud" || label === "Platform" ? item.label : label}
              </span>
            </Link>
          );
        }
        const expanded = open === label;
        return (
          <div
            key={label}
            className={`nav-group${current?.label === label ? " current" : ""}`}
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpened(expanded ? "" : label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronDown size={14} className="nav-chevron" />
            </button>
            {expanded && (
              <div className="nav-sub">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={isActive(item, all) ? "active" : undefined}
                    aria-current={isActive(item, all) ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
