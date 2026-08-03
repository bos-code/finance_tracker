import { createClient } from "npm:@supabase/supabase-js@2.99.1";

const JSON_HEADERS = { "content-type": "application/json" };
const RETENTION_DAYS = 7;
const BATCH_SIZE = 100;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: JSON_HEADERS,
    status,
  });
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function secretsMatch(provided: string, expected: string) {
  const [left, right] = await Promise.all([
    digest(provided),
    digest(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED", request_id: requestId });
  }

  const cleanupSecret = Deno.env.get("RECEIPT_CLEANUP_SECRET") ?? "";
  const providedSecret = request.headers.get("x-cleanup-secret") ?? "";
  if (
    !cleanupSecret ||
    !providedSecret ||
    !(await secretsMatch(providedSecret, cleanupSecret))
  ) {
    return json(401, { error: "UNAUTHORIZED", request_id: requestId });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "SERVER_MISCONFIGURED", request_id: requestId });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const { data: stale, error: readError } = await admin
    .from("transaction_attachments")
    .select("id, storage_bucket, storage_path")
    .in("upload_status", ["pending", "uploading", "failed"])
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (readError) {
    return json(500, { error: "CLEANUP_READ_FAILED", request_id: requestId });
  }

  let removed = 0;
  let failed = 0;
  for (const attachment of stale ?? []) {
    const { error: storageError } = await admin.storage
      .from(attachment.storage_bucket)
      .remove([attachment.storage_path]);
    if (storageError) {
      failed += 1;
      continue;
    }

    const { error: deleteError } = await admin
      .from("transaction_attachments")
      .delete()
      .eq("id", attachment.id);
    if (deleteError) failed += 1;
    else removed += 1;
  }

  return json(200, {
    failed,
    inspected: stale?.length ?? 0,
    removed,
    request_id: requestId,
  });
});
