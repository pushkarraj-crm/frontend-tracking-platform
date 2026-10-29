import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  isActingAsPartner,
  logInAs,
  returnToOwnAccount,
  send,
  type Row,
} from "./api";
import { useAccountType, useSession } from "./context";
import { date } from "./format";
import { useData } from "./hooks";
import { Action } from "./network-ui";
import { Badge, ErrorBox, Fields, Loading, Panel, Table } from "./ui";

// Shown across the app while an admin uses "log in as" or a team member is signed in.
export function ActingBanner() {
  const { user } = useSession(),
    navigate = useNavigate(),
    role =
      useAccountType() === "brand" && user.role === "publisher"
        ? "agency"
        : user.role;
  if (isActingAsPartner())
    return (
      <div className="acting-banner" role="status">
        <span>
          You are viewing Relay as <strong>{user.email}</strong> ({role}).
          Everything you do is recorded under your name.
        </span>
        <button
          className="button secondary"
          onClick={() => {
            returnToOwnAccount();
            navigate("/partners");
          }}
        >
          Return to my account
        </button>
      </div>
    );
  if (user.team_member)
    return (
      <div className="acting-banner" role="status">
        <span>
          Signed in as{" "}
          <strong>{user.team_member.name || user.team_member.email}</strong>, a
          team member of {user.email}.
        </span>
      </div>
    );
  return null;
}

export function LogInAsButton({ partner }: { partner: Row }) {
  const navigate = useNavigate();
  return (
    <Action
      run={async () => {
        await logInAs(partner.id);
        navigate("/");
      }}
    >
      Log in as
    </Action>
  );
}

export function ManagerPicker({
  partner,
  managers,
  onSaved,
}: {
  partner: Row;
  managers: Row[];
  onSaved: () => void;
}) {
  const [error, setError] = useState<Error | null>(null);
  return (
    <>
      <select
        aria-label={`Account manager for ${partner.email}`}
        value={partner.manager_id || ""}
        onChange={async (e) => {
          setError(null);
          try {
            await send(
              `/users/${partner.id}/manager`,
              { manager_id: e.target.value || null },
              "PUT",
            );
            onSaved();
          } catch (caught) {
            setError(caught as Error);
          }
        }}
      >
        <option value="">No manager</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.email}
          </option>
        ))}
      </select>
      {error && <ErrorBox error={error} />}
    </>
  );
}

export function AccountManagerCard() {
  const manager = useData<Row | null>("/account-manager");
  if (!manager.data) return null;
  return (
    <Panel
      title="Your account manager"
      subtitle="Your contact for campaigns, payouts and questions."
    >
      <div className="network-form">
        <strong>{manager.data.name || manager.data.email}</strong>
        <p>
          <a href={`mailto:${manager.data.email}`}>{manager.data.email}</a>
        </p>
      </div>
    </Panel>
  );
}

export function TeamSettings() {
  const [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    team = useData<Row[]>("/team", version);
  const reload = () => setVersion((v) => v + 1);
  return (
    <>
      <Panel
        title="Add a team member"
        subtitle="Each person gets their own login to this account. They can do everything you can, except manage the team, API keys and sign-out of all devices."
      >
        <div className="network-form">
          <Fields
            key={version}
            submit="Add team member"
            fields={[
              { name: "name", label: "Name", required: false },
              { name: "email", label: "Email address", type: "email" },
              {
                name: "password",
                label: "Initial password (12+ characters)",
                type: "password",
                help: "Share it with them securely.",
              },
            ]}
            onSubmit={async (b) => {
              await send("/team", b);
              setNotice(
                `${b.email} can now sign in with the same login page as you.`,
              );
              reload();
            }}
          />
          {notice && <p className="muted">{notice}</p>}
        </div>
      </Panel>
      <Panel title="Your team" subtitle="People who sign in to this account.">
        {team.error ? (
          <ErrorBox error={team.error} />
        ) : !team.data ? (
          <Loading />
        ) : (
          <Table
            rows={team.data}
            columns={[
              {
                key: "email",
                title: "Member",
                render: (r) => (
                  <div>
                    <strong>{r.name || r.email}</strong>
                    <small> {r.email}</small>
                  </div>
                ),
              },
              {
                key: "active",
                title: "Access",
                render: (r) => <Badge value={r.active} />,
              },
              {
                key: "last_login_at",
                title: "Last sign-in",
                render: (r) =>
                  r.last_login_at ? date(r.last_login_at) : "Never",
              },
              {
                key: "actions",
                title: "Actions",
                render: (r) => (
                  <div className="row-actions">
                    <Action
                      run={async () => {
                        await send(
                          `/team/${r.id}`,
                          { active: !r.active },
                          "PATCH",
                        );
                        reload();
                      }}
                    >
                      {r.active ? "Remove access" : "Restore access"}
                    </Action>
                    <Action
                      run={async () => {
                        const password = prompt(
                          `New password for ${r.email} (12+ characters). They will be signed out.`,
                        );
                        if (!password) return;
                        await send(
                          `/team/${r.id}/password`,
                          { password },
                          "PUT",
                        );
                        setNotice(`Password changed for ${r.email}.`);
                      }}
                    >
                      Set new password
                    </Action>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
