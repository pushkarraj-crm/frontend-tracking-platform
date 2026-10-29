import {
  ChartNoAxesCombined,
  LayoutDashboard,
  Network,
  PlugZap,
  Settings2,
  ShieldCheck,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./api";

// Sidebar groups follow Offer18's layout so networks moving over find things where they
// expect them. Each item points at an existing page (and tab); the route guard still
// decides access, so an item only shows when its page is allowed for the role.
export type MenuItem = { label: string; to: string; roles?: Role[] };
export type MenuGroup = { label: string; icon: LucideIcon; items: MenuItem[] };

const managers: Role[] = ["admin", "staff", "advertiser"];
const partners: Role[] = ["affiliate", "publisher", "advertiser"];

export function menuFor(accountType: string, role: Role): MenuGroup[] {
  if (accountType === "influencer")
    return [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        items: [{ label: "Dashboard", to: "/" }],
      },
      {
        label: "Brand deals",
        icon: Tag,
        items: [
          { label: "Add brand deal", to: "/offers?new=1" },
          { label: "All brand deals", to: "/offers" },
          { label: "Links & posts", to: "/my-links" },
          { label: "Coupons", to: "/coupons" },
        ],
      },
      {
        label: "Results",
        icon: ChartNoAxesCombined,
        items: [
          { label: "Sales", to: "/conversions" },
          { label: "Reports", to: "/reports" },
          { label: "Postbacks", to: "/postbacks" },
        ],
      },
      {
        label: "Account",
        icon: Settings2,
        items: [
          { label: "Settings", to: "/settings" },
          { label: "Billing", to: "/billing" },
        ],
      },
    ];
  const brand = accountType === "brand";
  // Partners see their own postbacks and invoices, not other partners'.
  const partner = role === "affiliate" || role === "publisher";
  const own =
    role === "affiliate" ? (brand ? "My team" : "My publishers") : null;
  return [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      items: [{ label: "Dashboard", to: "/" }],
    },
    {
      label: "Campaigns",
      icon: Tag,
      items: [
        { label: "Create campaign", to: "/offers?new=1", roles: managers },
        { label: "All campaigns", to: "/offers" },
        {
          label: partner ? "My applications" : "Approve requests",
          to: "/applications",
        },
        { label: "Coupons", to: "/coupons" },
        {
          label: "My tracking links",
          to: "/links",
          roles: ["affiliate", "publisher"],
        },
      ],
    },
    {
      label: "Reports",
      icon: ChartNoAxesCombined,
      items: [
        { label: "Reports", to: "/reports" },
        { label: "Conversions", to: "/conversions" },
        { label: "Saved reports", to: "/network?tab=saved-reports" },
      ],
    },
    {
      label:
        own ??
        (partner ? "Payouts & postbacks" : brand ? "Agencies" : "Partners"),
      icon: Users,
      items: [
        {
          label: own ?? (brand ? "All agencies" : "All partners"),
          to: "/partners",
        },
        {
          label: partner
            ? "My postbacks"
            : brand
              ? "Agency postbacks"
              : "Partner postbacks",
          to: "/callbacks",
        },
        {
          label: partner
            ? "My invoices"
            : brand
              ? "Agency invoices"
              : "Invoices",
          to: "/payouts",
        },
      ],
    },
    {
      label: "Fraud",
      icon: ShieldCheck,
      items: [{ label: "Fraud protection", to: "/fraud" }],
    },
    {
      label: "Integration",
      icon: PlugZap,
      items: [
        { label: "Postbacks & stores", to: "/postbacks" },
        { label: "MIS upload", to: "/tools?tab=mis-upload", roles: managers },
        {
          label: "Import campaigns",
          to: "/tools?tab=imports",
          roles: managers,
        },
        { label: "API keys", to: "/network?tab=api-keys" },
        { label: "Integrations", to: "/network?tab=integrations" },
      ],
    },
    {
      label: "Tools",
      icon: Wrench,
      items: [
        { label: "Bulk review", to: "/tools?tab=bulk-review", roles: managers },
        { label: "Link health", to: "/tools?tab=link-health", roles: managers },
        { label: "Automation", to: "/tools?tab=automation", roles: managers },
        {
          label: "Smart links",
          to: "/tools?tab=smart-links",
          roles: ["admin", "staff", "affiliate", "publisher"],
        },
      ],
    },
    {
      label: "Account",
      icon: Settings2,
      items: [
        { label: "Settings", to: "/settings" },
        { label: "Notifications", to: "/network?tab=inbox" },
        { label: "Team", to: "/settings?tab=team", roles: partners },
        { label: "Employees", to: "/network?tab=employees", roles: ["admin"] },
        { label: "Alerts", to: "/settings?tab=alerts", roles: ["admin"] },
        { label: "Branding", to: "/network?tab=branding", roles: ["admin"] },
        { label: "Tracking domains", to: "/domains" },
        { label: "Audit log", to: "/settings?tab=audit", roles: ["admin"] },
        {
          label: "Deliveries",
          to: "/settings?tab=deliveries",
          roles: ["admin", "staff"],
        },
        { label: "Plan & billing", to: "/billing" },
      ],
    },
    {
      label: "Platform",
      icon: Network,
      items: [{ label: "Platform overview", to: "/platform" }],
    },
  ];
}

export const pathOf = (to: string) => to.split("?")[0];
export const tabOf = (to: string) =>
  new URLSearchParams(to.split("?")[1] || "").get("tab");
