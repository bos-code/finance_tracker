import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cleanupUrl = new URL(
  "../../supabase/functions/receipt-orphan-cleanup/index.ts",
  import.meta.url,
);
const cleanup = await readFile(cleanupUrl, "utf8");

test("orphan cleanup is authenticated, bounded, and server-only", () => {
  assert.match(cleanup, /RECEIPT_CLEANUP_SECRET/);
  assert.match(cleanup, /x-cleanup-secret/);
  assert.match(cleanup, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(cleanup, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(cleanup, /const RETENTION_DAYS = 7/);
  assert.match(cleanup, /const BATCH_SIZE = 100/);
  assert.match(cleanup, /\.limit\(BATCH_SIZE\)/);
});

test("orphan cleanup removes Storage before attachment metadata", () => {
  const storageRemoval = cleanup.indexOf(".remove([attachment.storage_path])");
  const metadataDeletion = cleanup.indexOf('.from("transaction_attachments")');
  const finalMetadataDeletion = cleanup.indexOf(
    '.from("transaction_attachments")',
    metadataDeletion + 1,
  );
  assert.ok(storageRemoval > -1);
  assert.ok(finalMetadataDeletion > storageRemoval);
  assert.match(cleanup, /\.in\("upload_status", \["pending", "uploading", "failed"\]\)/);
  assert.match(cleanup, /\.lt\("updated_at", cutoff\)/);
});
