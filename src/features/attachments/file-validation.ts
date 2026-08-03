import type { ReceiptMimeType } from "@/contracts/backend";

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_PDF_PAGES = 25;
export const RECEIPT_BUCKET = "transaction-receipts" as const;
export const RECEIPT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const satisfies readonly ReceiptMimeType[];

const MIME_EXTENSIONS: Record<ReceiptMimeType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ReceiptFileMetadata = {
  mimeType: ReceiptMimeType;
  name: string;
  pageCount: number | null;
  size: number;
};

export function detectReceiptMimeType(bytes: Uint8Array): ReceiptMimeType | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function sanitizeReceiptFilename(
  originalName: string,
  mimeType: ReceiptMimeType,
) {
  const extension = MIME_EXTENSIONS[mimeType];
  const withoutExtension = originalName.replace(/\.[^.]+$/, "");
  const stem = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "receipt";
  return `${stem}.${extension}`;
}

export function receiptStoragePath({
  attachmentId,
  filename,
  ownerUserId,
  workspaceId,
}: {
  attachmentId: string;
  filename: string;
  ownerUserId: string;
  workspaceId: string;
}) {
  const safeFilename = filename.replaceAll("/", "-").replaceAll("\\", "-");
  return `${ownerUserId}/${workspaceId}/${attachmentId}/${safeFilename}`;
}

export function validateReceiptMetadata(metadata: ReceiptFileMetadata) {
  if (!metadata.name.trim() || metadata.name.length > 255) {
    throw new Error("Use a receipt filename between 1 and 255 characters.");
  }
  if (!Number.isInteger(metadata.size) || metadata.size <= 0) {
    throw new Error("The selected receipt is empty or unreadable.");
  }
  if (metadata.size > MAX_RECEIPT_BYTES) {
    throw new Error("Receipts must be 10 MB or smaller.");
  }
  if (metadata.mimeType === "application/pdf") {
    if (
      metadata.pageCount == null ||
      metadata.pageCount < 1 ||
      metadata.pageCount > MAX_RECEIPT_PDF_PAGES
    ) {
      throw new Error("PDF receipts must contain between 1 and 25 pages.");
    }
  } else if (metadata.pageCount != null) {
    throw new Error("Page count is only valid for PDF receipts.");
  }
}

export function formatReceiptSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
