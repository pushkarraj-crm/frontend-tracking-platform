import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AlertSettings } from "./alert-settings";

afterEach(() => vi.restoreAllMocks());
it("saves only the chosen alerts and keeps blank secrets unchanged", async () => {
  const sent: { method: string; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT")
      sent.push({ method: "PUT", body: JSON.parse(String(init.body)) });
    return new Response(
      JSON.stringify({
        slack: true,
        telegram: false,
        telegram_chat_id: "",
        events: ["caps", "postback_errors", "fraud"],
      }),
      { status: 200 },
    );
  });
  render(<AlertSettings />);
  expect(
    await screen.findByText("Slack webhook (connected)"),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("checkbox", { name: /blocked as fraud/ }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(sent[0].body).toEqual({ events: ["caps", "postback_errors"] });
  expect(
    screen.getByRole("button", { name: "Send Slack test" }),
  ).toBeInTheDocument();
});
