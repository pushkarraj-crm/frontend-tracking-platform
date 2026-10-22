import { describe, expect, it } from "vitest";
import { parseCsv } from "./network-fields";

describe("parseCsv", () => {
  it("handles BOM, quotes, embedded commas and CRLF", () => {
    expect(
      parseCsv(
        '﻿Ref,Status,City\r\nA1,"Disbursed",Mumbai\r\nA2,Rejected,"Pune, ""MH"""\r\n\r\n',
      ),
    ).toEqual([
      ["Ref", "Status", "City"],
      ["A1", "Disbursed", "Mumbai"],
      ["A2", "Rejected", 'Pune, "MH"'],
    ]);
  });
});
