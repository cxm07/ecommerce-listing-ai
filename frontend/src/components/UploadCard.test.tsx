import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadCard } from "./UploadCard";

describe("UploadCard", () => {
  afterEach(cleanup);

  it("explains why upload is disabled before a valid file is selected", () => {
    render(<UploadCard onUpload={async () => undefined} />);
    expect(
      screen.getByRole("button", { name: "上传文件" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByText("请先选择 .xlsx 文件")).toBeTruthy();
  });

  it("rejects a file that is not an xlsx workbook", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<UploadCard onUpload={async () => undefined} />);

    await user.upload(
      screen.getByLabelText("选择 Excel 文件"),
      new File(["data"], "products.csv"),
    );

    expect(screen.getByText("仅支持 .xlsx 文件，请重新选择。")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "上传文件" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("submits a selected xlsx file through its callback", async () => {
    const onUpload = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<UploadCard onUpload={onUpload} />);
    await user.upload(
      screen.getByLabelText("选择 Excel 文件"),
      new File(["data"], "products.xlsx"),
    );
    await user.click(screen.getByRole("button", { name: "上传文件" }));
    expect(onUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "products.xlsx" }),
    );
  });
});
