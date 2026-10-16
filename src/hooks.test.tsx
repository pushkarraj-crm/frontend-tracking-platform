import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCatalog } from "./hooks";
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("paginated API choices", () => {
  it("loads the next server page on demand and retains previous choices", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(first))
      .mockResolvedValueOnce(response([{ id: "100" }]));
    const { result } = renderHook(() => useCatalog("/users"));
    await waitFor(() => expect(result.current.data).toHaveLength(100));
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data).toHaveLength(101));
    expect(fetcher.mock.calls[1][0]).toBe("/api/users?limit=100&offset=100");
    expect(result.current.hasMore).toBe(false);
  });
  it("retries the same failed page rather than skipping records", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ detail: "Unavailable" }, 503))
      .mockResolvedValueOnce(response([{ id: "one" }]));
    const { result } = renderHook(() => useCatalog("/offers"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(fetcher.mock.calls[0][0]).toBe(fetcher.mock.calls[1][0]);
  });
});
