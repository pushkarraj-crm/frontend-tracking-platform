import { LoginGate } from "./login-gate";
import { CampaignOperations } from "./campaign-operations";
import { NetworkOperations, NetworkTools } from "./network-operations";
import { PartnerCallbacks } from "./callbacks-page";
import { useData } from "./hooks";
import {
  AccountTypeContext,
  SessionContext,
  ToastContext,
  useAccountType,
  useSession,
  useToast,
} from "./context";
import { Brand } from "./brand";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Globe2,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  X,
  ChartNoAxesCombined,
  ReceiptText,
} from "lucide-react";
import {
  currentSession,
  endSession,
  onSession,
  refresh,
  type Row,
} from "./api";
import { ErrorBox, Loading } from "./ui";
import { AuthPage, AccountPage } from "./auth-pages";
import {
  Dashboard,
  Partners,
  LinksPage,
  Conversions,
  Reports,
  Fraud,
  Billing,
  Settings,
  Platform,
} from "./pages";
import {
  Campaigns,
  Applications,
  Invoices,
  AdvertiserDomains,
  Postbacks,
} from "./business-pages";
import { InfluencerHome, InfluencerLinks } from "./influencer-pages";
const currentYear = new Date().getFullYear();
// Creators track their own brand deals: no partner, application or invoice screens.
const influencerLabels: Record<string, string> = {
  "/offers": "Brand deals",
  "/campaign-operations": "Deal settings",
  "/conversions": "Sales",
  "/postbacks": "Postbacks",
  "/tools": "Tools",
  "/network": "Account settings",
};
const influencerHidden = new Set([
  "/partners",
  "/applications",
  "/fraud",
  "/links",
  "/callbacks",
  "/payouts",
  "/domains",
]);
const shownFor = (path: string, accountType: string) =>
  accountType === "influencer"
    ? !influencerHidden.has(path)
    : path !== "/my-links";
function Home() {
  return useAccountType() === "influencer" ? <InfluencerHome /> : <Dashboard />;
}
// Brand accounts are their own advertiser and work with agencies.
const brandLabels: Record<string, string> = {
  "/partners": "Agencies & partners",
  "/callbacks": "Agency callbacks",
  "/payouts": "Agency invoices",
  "/domains": "Tracking domains",
  "/network": "Brand settings",
  "/tools": "Tools",
};
const navigation = [
  {
    path: "/",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["admin", "staff", "affiliate", "publisher", "advertiser"],
  },
  {
    path: "/offers",
    label: "Campaigns",
    icon: Tag,
    roles: ["admin", "staff", "affiliate", "publisher", "advertiser"],
  },
  {
    path: "/campaign-operations",
    label: "Campaign workspace",
    icon: Tag,
    roles: ["admin", "staff", "advertiser", "publisher", "affiliate"],
  },
  {
    path: "/reports",
    label: "Reports",
    icon: ChartNoAxesCombined,
    roles: ["admin", "staff", "affiliate", "publisher", "advertiser"],
  },
  {
    path: "/conversions",
    label: "Conversions",
    icon: ArrowDownLeft,
    roles: ["admin", "staff", "affiliate", "publisher", "advertiser"],
  },
  {
    path: "/partners",
    label: "Partners",
    icon: Users,
    roles: ["admin", "staff", "affiliate"],
  },
  {
    path: "/applications",
    label: "Applications",
    icon: Users,
    roles: ["admin", "staff", "advertiser", "publisher"],
  },
  {
    path: "/fraud",
    label: "Fraud protection",
    icon: ShieldCheck,
    roles: ["admin", "staff"],
  },
  {
    path: "/links",
    label: "Tracking links",
    icon: Link2,
    roles: ["admin", "staff", "affiliate", "publisher"],
  },
  {
    path: "/my-links",
    label: "My links",
    icon: Link2,
    roles: ["admin", "staff"],
  },
  {
    path: "/postbacks",
    label: "S2S postbacks",
    icon: Network,
    roles: ["admin", "staff", "advertiser", "publisher"],
  },
  {
    path: "/callbacks",
    label: "Publisher callbacks",
    icon: Network,
    roles: ["admin", "staff", "publisher", "affiliate"],
  },
  {
    path: "/tools",
    label: "Network tools",
    icon: Network,
    roles: ["admin", "staff", "advertiser", "publisher", "affiliate"],
  },
  {
    path: "/payouts",
    label: "Publisher invoices",
    icon: ReceiptText,
    roles: ["admin", "staff", "publisher", "advertiser"],
  },
  {
    path: "/billing",
    label: "Plan & billing",
    icon: ReceiptText,
    roles: ["admin"],
  },
  {
    path: "/domains",
    label: "Advertiser domains",
    icon: Globe2,
    roles: ["admin", "staff", "advertiser"],
  },
  {
    path: "/network",
    label: "Network settings",
    icon: Settings2,
    roles: ["admin", "staff", "advertiser", "publisher", "affiliate"],
  },
  {
    path: "/settings",
    label: "Settings",
    icon: Settings2,
    roles: [
      "admin",
      "staff",
      "affiliate",
      "publisher",
      "advertiser",
      "platform_admin",
    ],
  },
  {
    path: "/platform",
    label: "Platform overview",
    icon: Network,
    roles: ["platform_admin"],
  },
];
function Layout() {
  const { user } = useSession(),
    toast = useToast(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [leaving, setLeaving] = useState(false);
  const [now] = useState(Date.now);
  const branding = useData<Row>(
    user.role === "platform_admin" ? null : "/branding",
  );
  const logoUrl =
    branding.data?.logo_url &&
    new URL(branding.data.logo_url).origin === window.location.origin
      ? branding.data.logo_url
      : null;
  const workspace = useData<Row>("/workspace"),
    company = workspace.data?.name || "Your network",
    accountType = (workspace.data?.account_type as string) || "network";
  const days = workspace.data?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(workspace.data.trial_ends_at).getTime() - now) / 86400000,
        ),
      )
    : null;
  async function signout() {
    setLeaving(true);
    try {
      await endSession();
      navigate("/login");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setLeaving(false);
    }
  }
  return (
    <div
      className="app-shell"
      style={
        branding.data?.accent_color
          ? ({ "--green": branding.data.accent_color } as CSSProperties)
          : undefined
      }
    >
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link to="/" className="brand-link">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${company} logo`}
              width="150"
              height="45"
              style={{ objectFit: "contain" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <Brand />
          )}
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="network-switch">
          <span className="network-avatar">
            {company.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{company}</strong>
            <small>
              {user.role === "admin" && accountType === "brand"
                ? "brand"
                : user.role === "admin" && accountType === "influencer"
                  ? "creator"
                  : user.role.replace("_", " ")}{" "}
              portal
            </small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation
            .filter(
              (n) =>
                n.roles.includes(user.role) && shownFor(n.path, accountType),
            )
            .map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                <span>
                  {user.role === "affiliate" && path === "/partners"
                    ? accountType === "brand"
                      ? "My team"
                      : "My publishers"
                    : (accountType === "brand" && brandLabels[path]) ||
                      (accountType === "influencer" &&
                        influencerLabels[path]) ||
                      label}
                </span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          {user.role === "admin" && workspace.data?.plan === "trial" && (
            <div className="trial-card">
              <Sparkles size={19} />
              <strong>Room to grow.</strong>
              <p>{days} days left in your free trial.</p>
              <Link to="/billing">
                Explore plans <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
          <Link className="help-link" to="/settings">
            <CircleHelp size={18} />
            Account details
          </Link>
          <button
            className="user-card"
            disabled={leaving}
            onClick={signout}
            title="Sign out"
          >
            <span className="avatar">{user.email[0].toUpperCase()}</span>
            <span>
              <strong>{user.name || user.email.split("@")[0]}</strong>
              <small>{user.role.replace("_", " ")}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <PanelLeftClose className="desktop-icon" size={17} />
            <span>{company}</span>
            <span className="slash">/</span>
            <strong>Partner operations</strong>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <i />
              Private network
            </span>
            <Link
              className="icon-button"
              to="/settings"
              aria-label="Account settings"
            >
              <Settings2 size={18} />
            </Link>
            <span className="avatar small">{user.email[0].toUpperCase()}</span>
          </div>
        </header>
        <main>
          <AccountTypeContext.Provider value={accountType}>
            <Outlet />
          </AccountTypeContext.Provider>
        </main>
        <footer className="app-footer">
          <span>© {currentYear} Relay · Built for better partnerships.</span>
          <span>
            <ShieldCheck size={13} /> Secure partner operations
          </span>
        </footer>
      </div>
    </div>
  );
}
function Guard({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useSession();
  const entry = navigation.find((n) => n.path === path);
  return entry?.roles.includes(user.role) ? (
    children
  ) : (
    <Navigate to={user.role === "platform_admin" ? "/platform" : "/"} replace />
  );
}
export default function App() {
  const [session, setSession] = useState(currentSession),
    [ready, setReady] = useState(false),
    [failure, setFailure] = useState<Error | null>(null),
    [toast, setToast] = useState("");
  useEffect(() => onSession(() => setSession(currentSession())), []);
  async function bootstrap() {
    try {
      await refresh();
      setFailure(null);
    } catch (e) {
      setFailure(e as Error);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Initial session bootstrap synchronizes server cookie state.
    void bootstrap();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!ready)
    return (
      <div className="boot">
        <Brand />
        <Loading />
      </div>
    );
  return (
    <SessionContext.Provider value={session}>
      <ToastContext.Provider value={setToast}>
        {import.meta.env.VITE_DEPLOYMENT_MODE === "staging" && (
          <aside className="stage-banner" role="status">
            Personal testing only . Use dummy data . Email and live payments are
            unavailable
          </aside>
        )}
        {failure && !session && (
          <div className="connection-banner">
            <ErrorBox error={failure} retry={bootstrap} />
          </div>
        )}
        <Routes>
          <Route path="/login" element={<LoginGate />} />
          <Route
            path="/register"
            element={
              session ? <Navigate to="/" replace /> : <AuthPage register />
            }
          />
          <Route path="/account" element={<AccountPage />} />
          <Route
            element={session ? <Layout /> : <Navigate to="/login" replace />}
          >
            {[
              ["/campaign-operations", CampaignOperations],
              ["/network", NetworkOperations],
              ["/tools", NetworkTools],
              ["/callbacks", PartnerCallbacks],
              ["/", Home],
              ["/my-links", InfluencerLinks],
              ["/offers", Campaigns],
              ["/partners", Partners],
              ["/links", LinksPage],
              ["/conversions", Conversions],
              ["/reports", Reports],
              ["/payouts", Invoices],
              ["/fraud", Fraud],
              ["/domains", AdvertiserDomains],
              ["/billing", Billing],
              ["/applications", Applications],
              ["/postbacks", Postbacks],
              ["/settings", Settings],
              ["/platform", Platform],
            ].map(([path, Component]) => {
              const Page = Component as typeof Dashboard;
              return (
                <Route
                  key={path as string}
                  path={path as string}
                  element={
                    <Guard path={path as string}>
                      <Page />
                    </Guard>
                  }
                />
              );
            })}
          </Route>
          <Route
            path="*"
            element={
              <div className="not-found">
                <Brand />
                <h1>Page not found.</h1>
                <p>This page may have moved.</p>
                <Link className="button primary" to="/">
                  Back to your network
                </Link>
              </div>
            }
          />
        </Routes>
        {toast && (
          <div className="toast" role="status">
            <ShieldCheck size={18} />
            <span>{toast}</span>
            <button
              className="icon-button"
              onClick={() => setToast("")}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </ToastContext.Provider>
    </SessionContext.Provider>
  );
}
