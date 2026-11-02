/**
 * Pure helpers for receipt photos sent to the Telegram bot. No network and no
 * Deno globals, so they are unit tested and shared with the Edge Function.
 */

/** Keeps a download well under the 10 MB storage limit and Telegram's 20 MB cap. */
export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

export const RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ReceiptMimeType = (typeof RECEIPT_MIME_TYPES)[number];

export type ReceiptMedia = {
  /** Telegram's id for downloading the file; never stored. */
  fileId: string;
  mimeType: ReceiptMimeType;
  filename: string;
  /** Size Telegram reported, when it reported one. */
  fileSize: number | null;
  /** Telegram's stable, non-secret id for the file, kept for traceability. */
  providerMediaId: string | null;
};

export type MediaPick =
  | { kind: "none" }
  | { kind: "receipt"; media: ReceiptMedia }
  | { kind: "unsupported"; reason: "document" | "other" | "too_large" };

const EXTENSIONS: Record<ReceiptMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const OTHER_MEDIA_KEYS = [
  "voice",
  "video",
  "audio",
  "video_note",
  "animation",
  "sticker",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 255;
}

function sizeOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function isReceiptMime(value: unknown): value is ReceiptMimeType {
  return (RECEIPT_MIME_TYPES as readonly unknown[]).includes(value);
}

/**
 * A name that is safe to store and show: no folders, no odd characters, and an
 * extension that matches the real image type.
 */
export function safeReceiptFilename(
  mimeType: ReceiptMimeType,
  original?: string | null,
) {
  const extension = EXTENSIONS[mimeType];
  const base = (original ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 60);
  return `${base && base !== "." ? base : "receipt"}.${extension}`;
}

/**
 * Decides what to do with the media in a message. Photos arrive as a list of
 * sizes (smallest first); this takes the largest one that is not too big.
 */
export function pickReceiptMedia(message: unknown): MediaPick {
  if (!isRecord(message)) return { kind: "none" };

  const photo = message.photo;
  if (Array.isArray(photo) && photo.length > 0) {
    const sizes = photo.filter(
      (entry): entry is Record<string, unknown> =>
        isRecord(entry) && validId(entry.file_id),
    );
    if (sizes.length === 0) return { kind: "unsupported", reason: "other" };
    const usable = sizes.filter((entry) => {
      const size = sizeOf(entry.file_size);
      return size === null || size <= MAX_RECEIPT_BYTES;
    });
    if (usable.length === 0) return { kind: "unsupported", reason: "too_large" };
    const best = usable[usable.length - 1];
    return {
      kind: "receipt",
      media: {
        fileId: best.file_id as string,
        filename: safeReceiptFilename("image/jpeg"),
        fileSize: sizeOf(best.file_size),
        // Telegram re-encodes photos as JPEG.
        mimeType: "image/jpeg",
        providerMediaId: validId(best.file_unique_id)
          ? best.file_unique_id
          : null,
      },
    };
  }

  const document = message.document;
  if (isRecord(document)) {
    if (!validId(document.file_id) || !isReceiptMime(document.mime_type)) {
      return { kind: "unsupported", reason: "document" };
    }
    const size = sizeOf(document.file_size);
    if (size !== null && size > MAX_RECEIPT_BYTES) {
      return { kind: "unsupported", reason: "too_large" };
    }
    return {
      kind: "receipt",
      media: {
        fileId: document.file_id,
        filename: safeReceiptFilename(
          document.mime_type,
          typeof document.file_name === "string" ? document.file_name : null,
        ),
        fileSize: size,
        mimeType: document.mime_type,
        providerMediaId: validId(document.file_unique_id)
          ? document.file_unique_id
          : null,
      },
    };
  }

  if (OTHER_MEDIA_KEYS.some((key) => message[key])) {
    return { kind: "unsupported", reason: "other" };
  }
  return { kind: "none" };
}

/**
 * The image type from the file's first bytes. A file's name or claimed type is
 * never trusted: anything that is not really a JPEG, PNG or WebP is rejected.
 */
export function sniffImageType(bytes: Uint8Array): ReceiptMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
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
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
