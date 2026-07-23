import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditLog } from "../domain/contracts";
import { AuditDetailPanel } from "./AuditDetailPanel";

const event: AuditLog = {
  id: "audit-1",
  task_id: "task",
  actor_id: null,
  action: "parsing_completed",
  source_ref: null,
  created_at: "2026-07-24T00:00:00Z",
};

describe("AuditDetailPanel", () => {
  afterEach(cleanup);

  it("uses neutral copy when the current audit contract has no field diff", () => {
    render(<AuditDetailPanel event={event} />);
    expect(screen.getByText("系统处理完成")).toBeTruthy();
    expect(
      screen.getByText("当前审计契约未提供修改前后字段快照。"),
    ).toBeTruthy();
  });
});
