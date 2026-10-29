import { useState } from "react";
import { send, type Row } from "./api";
import { useData } from "./hooks";
import { Action } from "./network-ui";
import { ErrorBox, Fields, Loading, Panel } from "./ui";

const events = [
  ["caps", "A cap nears its limit, or a campaign pauses at its cap"],
  ["postback_errors", "An advertiser postback is refused"],
  ["fraud", "Traffic is blocked as fraud or a blocked source"],
] as const;

export function AlertSettings() {
  const [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    settings = useData<Row>("/alert-settings", version);
  if (settings.error) return <ErrorBox error={settings.error} />;
  if (!settings.data) return <Loading />;
  const current = settings.data;
  const save = async (body: Row) => {
    await send("/alert-settings", body, "PUT");
    setVersion((v) => v + 1);
  };
  const test = (channel: string) => async () => {
    setNotice("");
    await send("/alert-settings/test", { channel });
    setNotice(
      `Test message sent to ${channel === "slack" ? "Slack" : "Telegram"}.`,
    );
  };
  return (
    <Panel
      title="Slack and Telegram alerts"
      subtitle="Get a message when a cap fills up, a postback fails or fraud is blocked. Fraud and postback alerts are sent at most once per campaign per hour."
    >
      <div className="network-form">
        <Fields
          key={version}
          initial={Object.fromEntries(
            events.map(([key]) => [key, current.events.includes(key)]),
          )}
          fields={[
            {
              name: "slack_webhook_url",
              label: current.slack
                ? "Slack webhook (connected)"
                : "Slack incoming webhook URL",
              type: "url",
              required: false,
              full: true,
              help: current.slack
                ? "Leave blank to keep it. Paste a new URL to replace it."
                : "In Slack: Apps → Incoming Webhooks → Add to a channel, then copy the URL.",
            },
            {
              name: "telegram_bot_token",
              label: current.telegram
                ? "Telegram bot token (connected)"
                : "Telegram bot token",
              type: "password",
              required: false,
              help: current.telegram
                ? "Leave blank to keep it."
                : "Create a bot with @BotFather and paste its token.",
            },
            {
              name: "telegram_chat_id",
              label: "Telegram chat ID",
              required: false,
              defaultValue: current.telegram_chat_id,
              help: "Add the bot to your group, then use the group's ID (for example -1001234567890) or @channelname.",
            },
            ...events.map(([key, label]) => ({
              name: key,
              label,
              type: "checkbox",
              required: false,
            })),
          ]}
          onSubmit={async (b) => {
            const { caps, postback_errors, fraud, ...channels } = b;
            await save({
              ...channels,
              events: events
                .map(([key]) => key)
                .filter((key) => ({ caps, postback_errors, fraud })[key]),
            });
            setNotice("Alert settings saved.");
          }}
        />
        <div className="row-actions">
          {current.slack && (
            <>
              <Action run={test("slack")}>Send Slack test</Action>
              <Action
                run={() =>
                  save({ slack_webhook_url: "", events: current.events })
                }
              >
                Disconnect Slack
              </Action>
            </>
          )}
          {current.telegram && (
            <>
              <Action run={test("telegram")}>Send Telegram test</Action>
              <Action
                run={() =>
                  save({
                    telegram_bot_token: "",
                    telegram_chat_id: "",
                    events: current.events,
                  })
                }
              >
                Disconnect Telegram
              </Action>
            </>
          )}
        </div>
        {notice && <p className="muted">{notice}</p>}
      </div>
    </Panel>
  );
}
