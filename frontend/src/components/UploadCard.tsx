import { useState, type ChangeEvent, type DragEvent } from "react";

export function UploadCard({
  onUpload,
}: {
  onUpload: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("请先选择 .xlsx 文件");
  const [sending, setSending] = useState(false);
  const choose = (next: File | null) => {
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setMessage("仅支持 .xlsx 文件，请重新选择。");
      return;
    }
    setFile(next);
    setMessage(`${next.name} · ${(next.size / 1024).toFixed(1)} KB`);
  };
  const change = (event: ChangeEvent<HTMLInputElement>) =>
    choose(event.target.files?.[0] ?? null);
  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    choose(event.dataTransfer.files?.[0] ?? null);
  };
  const submit = async () => {
    if (!file || sending) return;
    setSending(true);
    try {
      await onUpload(file);
    } catch {
      setMessage("上传失败，请检查文件后重试。");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="upload-card">
      <label
        className="file-drop"
        data-testid="upload-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
      >
        拖拽或点击选择 Excel 文件
        <input
          aria-label="选择 Excel 文件"
          type="file"
          accept=".xlsx"
          onChange={change}
        />
      </label>
      <p className="muted">{message}</p>
      {file ? (
        <button
          className="link-button"
          onClick={() => {
            setFile(null);
            setMessage("请先选择 .xlsx 文件");
          }}
        >
          移除文件
        </button>
      ) : null}
      <button
        className="primary-button"
        disabled={!file || sending}
        onClick={submit}
      >
        {sending ? "正在上传…" : "上传文件"}
      </button>
    </div>
  );
}
