import { supabase } from "@/integrations/supabase/client";

export const ATTACHMENTS_BUCKET = "attachments";

export function isExternalUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

/** Open an attachment stored either as a storage path or a raw external URL. */
export async function openAttachment(pathOrUrl: string): Promise<void> {
  if (!pathOrUrl) return;
  if (isExternalUrl(pathOrUrl)) {
    window.open(pathOrUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(pathOrUrl, 60 * 10); // 10 min
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not generate link");
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

/** Return the file's basename for display. */
export function attachmentLabel(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (isExternalUrl(pathOrUrl)) return "Open link";
  const parts = pathOrUrl.split("/");
  const name = parts[parts.length - 1] ?? pathOrUrl;
  // strip leading uuid prefix like "abc123-filename.pdf"
  return name.replace(/^[a-f0-9-]{8,}-/i, "");
}

export async function uploadAttachment(
  folder: string,
  file: File,
  userId: string,
): Promise<string> {
  const cleanName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${folder}/${userId}/${crypto.randomUUID()}-${cleanName}`;
  const { error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeAttachment(pathOrUrl: string): Promise<void> {
  if (!pathOrUrl || isExternalUrl(pathOrUrl)) return;
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([pathOrUrl]);
}
