import { useRef, useState } from "react";
import { Loader2, Paperclip, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  attachmentLabel,
  openAttachment,
  removeAttachment,
  uploadAttachment,
} from "@/lib/attachment";

const MAX_MB = 10;
const ACCEPT =
  "image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx";

export function FileUpload({
  value,
  onChange,
  folder,
  label = "Attachment",
  disabled,
}: {
  value: string;
  onChange: (path: string) => void;
  folder: string;
  label?: string;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handlePick(file: File) {
    if (!user) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      return toast.error(`File too large (max ${MAX_MB} MB)`);
    }
    setBusy(true);
    try {
      // If replacing an uploaded file, best-effort delete previous
      if (value) await removeAttachment(value).catch(() => undefined);
      const path = await uploadAttachment(folder, file, user.id);
      onChange(path);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleView() {
    try {
      await openAttachment(value);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open");
    }
  }

  async function handleRemove() {
    if (!value) return;
    setBusy(true);
    try {
      await removeAttachment(value);
    } finally {
      onChange("");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePick(f);
        }}
      />
      {value ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleView}
            disabled={busy}
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">{attachmentLabel(value)}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || busy}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="mr-2 h-4 w-4" />
          )}
          Upload {label}
        </Button>
      )}
      <span className="text-xs text-muted-foreground">
        PDF/image, max {MAX_MB} MB
      </span>
    </div>
  );
}

/** Read-only view button for an existing attachment path/URL. */
export function AttachmentViewButton({ value }: { value: string }) {
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    try {
      await openAttachment(value);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-primary"
      onClick={handle}
      disabled={busy}
    >
      {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ExternalLink className="mr-1 h-3 w-3" />}
      Open
    </Button>
  );
}
