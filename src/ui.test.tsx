import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Fields, Table } from "./ui";
describe("financial and data-entry contracts", () => {
  it("submits decimal money as a string and quota counts as numbers", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <Fields
        fields={[
          { name: "amount", label: "Amount", type: "number", step: "0.0001" },
          { name: "interval_hours", label: "Interval", type: "number" },
        ]}
        onSubmit={submit}
      />,
    );
    await userEvent.type(screen.getByLabelText(/Amount/), "123.4500");
    await userEvent.type(screen.getByLabelText(/Interval/), "24");
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    expect(submit).toHaveBeenCalledWith({
      amount: "123.45",
      interval_hours: 24,
    });
  });
  it("shows server errors without reporting success", async () => {
    render(
      <Fields
        fields={[]}
        onSubmit={async () => {
          throw new Error("Insufficient balance");
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Insufficient balance",
    );
  });
  it("keeps the next page disabled when fewer than 50 records return", () => {
    render(
      <Table
        rows={[{ id: "1", name: "Offer" }]}
        columns={[{ key: "name", title: "Name" }]}
        offset={0}
        setOffset={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
  });
  it("shows an honest empty state for no records", () => {
    render(<Table rows={[]} columns={[{ key: "name", title: "Name" }]} />);
    expect(screen.getByText("Nothing here yet")).toBeVisible();
  });
});

it("loads more dropdown choices without submitting the enclosing form", async () => {
  const loadMore = vi.fn(),
    submit = vi.fn();
  render(
    <Fields
      fields={[
        {
          name: "affiliate_id",
          label: "Partner",
          options: [{ value: "first", label: "First partner" }],
          source: { hasMore: true, loadMore, loading: false, error: null },
        },
      ]}
      onSubmit={submit}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Load more choices" }),
  );
  expect(loadMore).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
});

it("keeps pagination available while filtering the current page", () => {
  render(
    <Table
      rows={[{ id: "1", name: "Match" }]}
      columns={[{ key: "name", title: "Name" }]}
      offset={0}
      hasNext={true}
      setOffset={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
});
