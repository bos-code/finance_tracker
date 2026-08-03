import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { PDFDocument } from "pdf-lib";

import type { ReceiptMimeType } from "@/contracts/backend";
import {
  detectReceiptMimeType,
  MAX_RECEIPT_BYTES,
  RECEIPT_MIME_TYPES,
  sanitizeReceiptFilename,
  validateReceiptMetadata,
} from "@/features/attachments/file-validation";

export type PreparedReceiptFile = {
  bytes: ArrayBuffer;
  fileHash: string;
  mimeType: ReceiptMimeType;
  originalFilename: string;
  pageCount: number | null;
  safeFilename: string;
  size: number;
};

function normalizedDeclaredMime(value: string | undefined) {
  if (value === "image/jpg") return "image/jpeg";
  return value?.toLowerCase() ?? null;
}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytes,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readAssetBytes(asset: DocumentPicker.DocumentPickerAsset) {
  if (asset.file) return asset.file.arrayBuffer();
  return new ExpoFile(asset.uri).arrayBuffer();
}

export async function prepareReceiptAsset(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<PreparedReceiptFile> {
  if (asset.size != null && asset.size > MAX_RECEIPT_BYTES) {
    throw new Error("Receipts must be 10 MB or smaller.");
  }

  const bytes = await readAssetBytes(asset);
  const size = bytes.byteLength;
  const mimeType = detectReceiptMimeType(new Uint8Array(bytes));
  if (!mimeType) {
    throw new Error("Choose a PDF, JPEG, PNG, or WebP receipt.");
  }

  const declaredMime = normalizedDeclaredMime(asset.mimeType);
  if (
    declaredMime &&
    declaredMime !== "application/octet-stream" &&
    declaredMime !== mimeType
  ) {
    throw new Error("The receipt contents do not match its declared file type.");
  }

  let pageCount: number | null = null;
  if (mimeType === "application/pdf") {
    try {
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      pageCount = pdf.getPageCount();
    } catch {
      throw new Error(
        "This PDF is encrypted, damaged, or cannot be read safely.",
      );
    }
  }

  const metadata = {
    mimeType,
    name: asset.name,
    pageCount,
    size,
  };
  validateReceiptMetadata(metadata);

  return {
    bytes,
    fileHash: await sha256Hex(bytes),
    mimeType,
    originalFilename: asset.name,
    pageCount,
    safeFilename: sanitizeReceiptFilename(asset.name, mimeType),
    size,
  };
}

export async function pickReceiptFile() {
  const result = await DocumentPicker.getDocumentAsync({
    base64: false,
    copyToCacheDirectory: true,
    multiple: false,
    type: [...RECEIPT_MIME_TYPES],
  });
  if (result.canceled || !result.assets[0]) return null;
  return prepareReceiptAsset(result.assets[0]);
}
