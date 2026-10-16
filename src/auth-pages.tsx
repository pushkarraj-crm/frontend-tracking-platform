import { useData } from "./hooks";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { login, send, setSession, type Row, type Session } from "./api";
import { Brand } from "./brand";
import { ErrorBox, Fields, Loading, type Field } from "./ui";
const currentYear = new Date().getFullYear();
export function AuthPage({ register = false }: { register?: boolean }) {
  const navigate = useNavigate(),
    options = useData<Row>(register ? "/auth/registration-options" : null),
    [sent, setSent] = useState(""),
    [usage, setUsage] = useState<string[]>([]),
    [teams, setTeams] = useState(false);
  const config = options.data;
  const fields: Field[] = register
    ? [
        { name: "name", label: "Full name", placeholder: "Alex Morgan" },
        {
          name: "email",
          label: "Work email",
          type: "email",
          placeholder: "alex@company.com",
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          help: "Use 12–128 characters.",
          full: true,
        },
        { name: "company", label: "Company", placeholder: "Your company" },
        {
          name: "business_type",
          label: "Business type",
          options: config?.business_type || [],
        },
        { name: "country", label: "Country", options: config?.countries || [] },
        {
          name: "mobile",
          label: "Mobile number",
          type: "tel",
          placeholder: "+91 98765 43210",
        },
        {
          name: "preferred_language",
          label: "Preferred language",
          options: config?.preferred_language || [],
          defaultValue: "en",
        },
        {
          name: "referral_source",
          label: "How did you hear about us?",
          options: config?.referral_source || [],
        },
        ...(teams
          ? [
              {
                name: "teams_email",
                label: "Microsoft Teams email",
                type: "email",
                full: true,
              },
            ]
          : []),
      ]
    : [
        {
          name: "email",
          label: "Email address",
          type: "email",
          placeholder: "you@company.com",
          autoComplete: "username",
          full: true,
        },
        { name: "password", label: "Password", type: "password", full: true },
      ];
  return (
    <div className={`auth-layout ${register ? "registration" : ""}`}>
      <aside className="auth-story">
        <Link to="/login">
          <Brand />
        </Link>
        <div className="auth-story-copy">
          <div className="pill">
            <Sparkles size={14} /> THE PARTNER OPERATIONS PLATFORM
          </div>
          <h1>
            Great partnerships.
            <br />
            <em>Exceptional results.</em>
          </h1>
          <p>
            One place to connect your partners, track every conversion, and
            build a network that grows with you.
          </p>
          <div className="auth-orbit" aria-hidden="true">
            <div className="orbit-grid" />
            <div className="orbit-center">
              <ArrowUpRight size={52} />
            </div>
            <span className="orbit-label one">
              <span className="orbit-icon">↗</span> Offers connected{" "}
              <Check size={14} />
            </span>
            <span className="orbit-label two">
              <span className="orbit-icon">◎</span> Every conversion counts
            </span>
            <span className="orbit-label three">
              <ShieldCheck size={16} /> Your network. Protected.
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <ShieldCheck size={17} /> Secure by design. Ready for your next
          chapter.
        </div>
      </aside>
      <section className="auth-form-side">
        <div className="auth-top">
          {register ? "Already part of the network?" : "New to Relay?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}{" "}
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="auth-form">
          <span className="eyebrow">
            {register ? "LET’S BUILD YOUR NETWORK" : "WELCOME BACK"}
          </span>
          <h1>
            {register ? "Start something great." : "Your network awaits."}
          </h1>
          <p>
            {register
              ? "15 days free. No credit card. No setup fees."
              : "Sign in to stay connected to every opportunity."}
          </p>
          {sent ? (
            <div className="success-box" role="status">
              <Check size={22} />
              <h2>Check your inbox</h2>
              <p>{sent}</p>
              <Link to="/login" className="button primary">
                Back to sign in
              </Link>
            </div>
          ) : register && options.loading ? (
            <Loading />
          ) : register && options.error ? (
            <ErrorBox error={options.error} />
          ) : register && !config?.registration_enabled ? (
            <div className="notice">
              Account registration is currently closed. Contact your network
              administrator.
            </div>
          ) : (
            <Fields
              fields={fields}
              submit={
                register ? "Create your account" : "Sign in to your network"
              }
              onSubmit={async (body) => {
                if (!register) {
                  await login(body.email, body.password);
                  navigate("/");
                  return;
                }
                if (!usage.length)
                  throw new Error("Select at least one usage type.");
                const result = await send("/auth/register", {
                  ...body,
                  usage_types: usage,
                  teams_enabled: teams,
                  terms_accepted: true,
                  legal_version: config?.legal_version,
                });
                if (result.access_token) {
                  setSession(result as Session);
                  navigate("/");
                } else
                  setSent(
                    `We sent a verification email to ${body.email}. Verify your email before signing in.`,
                  );
              }}
            >
              {register ? (
                <>
                  <fieldset className="usage-types">
                    <legend>
                      What will you use Relay for?{" "}
                      <span className="required">*</span>
                    </legend>
                    {config?.usage_types?.map((option: Row) => (
                      <label
                        key={option.value}
                        className={`choice-chip ${usage.includes(option.value) ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={usage.includes(option.value)}
                          onChange={(event) =>
                            setUsage(
                              event.target.checked
                                ? [...usage, option.value]
                                : usage.filter((v) => v !== option.value),
                            )
                          }
                        />
                        {option.label}
                      </label>
                    ))}
                  </fieldset>
                  <label className="check-label teams-toggle">
                    <input
                      type="checkbox"
                      checked={teams}
                      onChange={(e) => setTeams(e.target.checked)}
                    />{" "}
                    Add a Microsoft Teams contact
                  </label>
                  <label className="check-label consent">
                    <input type="checkbox" required />{" "}
                    <span>
                      I agree to the{" "}
                      {config?.terms_url ? (
                        <a
                          href={config.terms_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Terms & Conditions
                        </a>
                      ) : (
                        "Terms & Conditions"
                      )}{" "}
                      and{" "}
                      {config?.privacy_url ? (
                        <a
                          href={config.privacy_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Privacy Policy
                        </a>
                      ) : (
                        "Privacy Policy"
                      )}
                      .
                    </span>
                  </label>
                  {(!config?.terms_url || !config?.privacy_url) && (
                    <small className="muted">
                      Policy links have not been configured by the
                      administrator.
                    </small>
                  )}
                </>
              ) : (
                <div className="auth-links">
                  <span>
                    <ShieldCheck size={13} /> Secure sign in
                  </span>
                  <Link to="/account?action=forgot">Forgot password?</Link>
                </div>
              )}
            </Fields>
          )}
          {!register && (
            <Link className="text-button" to="/account?action=resend">
              Resend verification email
            </Link>
          )}
          <div className="auth-bottom">
            <span className="line" />
            <ShieldCheck size={14} />
            <span>Your data stays in your network.</span>
            <span className="line" />
          </div>
        </div>
        <footer className="auth-copyright">
          © {currentYear} Relay · Partner operations, connected.
        </footer>
      </section>
    </div>
  );
}
export function AccountPage() {
  const navigate = useNavigate(),
    [token] = useState(
      () =>
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
    ),
    [action] = useState(
      () =>
        new URLSearchParams(window.location.search).get("action") || "forgot",
    ),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
  }, []);
  const verify = action === "verify",
    reset = action === "reset";
  return (
    <div className="account-layout">
      <Link to="/login">
        <Brand />
      </Link>
      <section className="panel account-panel">
        <span className="eyebrow">YOUR ACCOUNT</span>
        <h1>
          {verify
            ? "Verify your email."
            : reset
              ? "A fresh start."
              : action === "resend"
                ? "Request verification."
                : "Forgot your password?"}
        </h1>
        <p>
          {verify
            ? "Confirm your email to activate your login."
            : reset
              ? "Choose a strong new password for your account."
              : "Enter your email and we’ll send you a secure link."}
        </p>
        {message ? (
          <div className="success-box" role="status">
            <Check size={24} />
            <p>{message}</p>
            <Link to="/login" className="button primary">
              Return to sign in <ArrowRight size={16} />
            </Link>
          </div>
        ) : (verify || reset) && !token ? (
          <div className="notice">
            This link is missing its secure token.{" "}
            <Link
              to={verify ? "/account?action=resend" : "/account?action=forgot"}
            >
              Request a new link
            </Link>
            .
          </div>
        ) : (
          <Fields
            fields={
              verify
                ? []
                : reset
                  ? [
                      {
                        name: "password",
                        label: "New password",
                        type: "password",
                        full: true,
                        help: "Use 12–128 characters.",
                      },
                    ]
                  : [
                      {
                        name: "email",
                        label: "Email address",
                        type: "email",
                        full: true,
                      },
                    ]
            }
            submit={
              verify
                ? "Verify email"
                : reset
                  ? "Reset password"
                  : "Send secure link"
            }
            onSubmit={async (body) => {
              await send(
                verify
                  ? "/auth/verify"
                  : reset
                    ? "/auth/reset-password"
                    : action === "resend"
                      ? "/auth/request-verification"
                      : "/auth/forgot-password",
                verify
                  ? { token }
                  : reset
                    ? { token, password: body.password }
                    : body,
              );
              setMessage(
                verify
                  ? "Your email is verified. You can now sign in."
                  : reset
                    ? "Your password has been reset. Sign in with your new password."
                    : "If an eligible account exists, a secure link will arrive in your inbox.",
              );
            }}
          />
        )}
        <button className="text-button" onClick={() => navigate("/login")}>
          Back to sign in
        </button>
      </section>
    </div>
  );
}
