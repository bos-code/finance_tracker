import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_RECEIPT_BYTES,
  detectReceiptMimeType,
  receiptStoragePath,
  sanitizeReceiptFilename,
  validateReceiptMetadata,
} from "../../src/features/attachments/file-validation.ts";

test("receipt signatures are detected from bytes instead of extensions", () => {
  assert.equal(
    detectReceiptMimeType(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])),
    "application/pdf",
  );
  assert.equal(
    detectReceiptMimeType(Uint8Array.from([0xff, 0xd8, 0xff])),
    "image/jpeg",
  );
  assert.equal(
    detectReceiptMimeType(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    "image/png",
  );
  assert.equal(
    detectReceiptMimeType(
      Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45,
        0x42, 0x50,
      ]),
    ),
    "image/webp",
  );
  assert.equal(detectReceiptMimeType(Uint8Array.from([0x00, 0x01])), null);
});

test("receipt names and paths cannot preserve traversal characters", () => {
  assert.equal(
    sanitizeReceiptFilename("../../My café receipt.PDF", "application/pdf"),
    "My-cafe-receipt.pdf",
  );
  assert.equal(
    receiptStoragePath({
      attachmentId: "attachment-1",
      filename: "My-cafe-receipt.pdf",
      ownerUserId: "user-1",
      workspaceId: "workspace-1",
    }),
    "user-1/workspace-1/attachment-1/My-cafe-receipt.pdf",
  );
});

test("receipt metadata enforces file and PDF limits", () => {
  assert.doesNotThrow(() =>
    validateReceiptMetadata({
      mimeType: "image/png",
      name: "receipt.png",
      pageCount: null,
      size: MAX_RECEIPT_BYTES,
    }),
  );
  assert.doesNotThrow(() =>
    validateReceiptMetadata({
      mimeType: "application/pdf",
      name: "receipt.pdf",
      pageCount: 25,
      size: 1,
    }),
  );
  assert.throws(
    () =>
      validateReceiptMetadata({
        mimeType: "image/jpeg",
        name: "receipt.jpg",
        pageCount: null,
        size: MAX_RECEIPT_BYTES + 1,
      }),
    /10 MB or smaller/,
  );
  assert.throws(
    () =>
      validateReceiptMetadata({
        mimeType: "application/pdf",
        name: "receipt.pdf",
        pageCount: 26,
        size: 100,
      }),
    /between 1 and 25 pages/,
  );
  assert.throws(
    () =>
      validateReceiptMetadata({
        mimeType: "image/webp",
        name: "receipt.webp",
        pageCount: 1,
        size: 100,
      }),
    /only valid for PDF/,
  );
});
