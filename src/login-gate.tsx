import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSession } from "./context";
import { endSession } from "./api";
import { AuthPage } from "./auth-pages";
import { ErrorBox } from "./ui";

export function LoginGate() {
  const session = useSession();
  const [params] = useSearchParams();
  const portal = params.get("portal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  if (!session) return <AuthPage />;
  if (["advertiser", "publisher", "affiliate"].includes(portal || "") && session.user.role !== portal) {
    const label = portal![0].toUpperCase() + portal!.slice(1);
    return <main className="boot"><section className="panel">
      <h1>{label} login</h1>
      <p>You are currently signed in as {session.user.email} ({session.user.role.replaceAll("_", " ")}). Sign out to use a {portal} account.</p>
      <p>This link does not change your account role.</p>
      {error && <ErrorBox error={error} />}
      <button className="button primary" disabled={busy} onClick={async () => {
        setBusy(true);
        setError(null);
        try { await endSession(); } catch (e) { setError(e as Error); } finally { setBusy(false); }
      }}>{busy ? "Signing out…" : `Sign out and use ${portal} login`}</button>
    </section></main>;
  }
  return <Navigate to={session.user.role === "platform_admin" ? "/platform" : "/"} replace />;
}