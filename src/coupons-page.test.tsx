import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountTypeContext, SessionContext } from "./context";
import { Coupons } from "./coupons-page";

afterEach(() => vi.restoreAllMocks());

it("creators create their own codes without choosing a partner", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (input, init) =>
        new Response(
          JSON.stringify(
            init?.method === "POST"
              ? { id: "c1", code: "GLOW10" }
              : String(input).includes("/campaigns")
                ? [{ id: "deal1", name: "Glow kit" }]
                : [],
          ),
          { status: 200 },
        ),
    );
  render(
    <SessionContext.Provider
      value={{
        access_token: "t",
        csrf_token: "t",
        user: { id: "u", email: "me@example.com", role: "admin" },
      }}
    >
      <AccountTypeContext.Provider value="influencer">
        <Coupons />
      </AccountTypeContext.Provider>
    </SessionContext.Provider>,
  );
  expect(screen.queryByLabelText(/Partner who shares/)).not.toBeInTheDocument();
  await userEvent.selectOptions(
    (await screen.findAllByLabelText(/Brand deal/, { selector: "select" }))[0],
    "deal1",
  );
  await userEvent.type(screen.getByLabelText(/^Code/), "glow10");
  await userEvent.click(screen.getByRole("button", { name: "Create code" }));
  const post = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({
    campaign_id: "deal1",
    code: "glow10",
  });
});
