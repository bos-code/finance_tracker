const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();

function fail(message, details) {
  console.error(`Supabase connection check failed: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

if (!url || !anonKey) {
  fail(
    "missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY.",
    "Load the development/EAS environment first. Do not commit credentials.",
  );
}

let baseUrl;
try {
  baseUrl = new URL(url);
} catch {
  fail("EXPO_PUBLIC_SUPABASE_URL is not a valid URL.");
}

if (!/^https?:$/.test(baseUrl.protocol)) {
  fail("Supabase URL must use http or https.");
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
};

async function request(label, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(new URL(path, baseUrl), {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
      signal: controller.signal,
    });

    const body = await response.text();
    if (!response.ok) {
      fail(
        `${label} returned HTTP ${response.status}.`,
        body.slice(0, 400),
      );
    }

    return { body, status: response.status };
  } catch (error) {
    if (error?.name === "AbortError") {
      fail(`${label} timed out after 12 seconds.`);
    }
    fail(`${label} could not be reached.`, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

const auth = await request("Auth health endpoint", "/auth/v1/health");
const rest = await request("PostgREST endpoint", "/rest/v1/", {
  headers: { Accept: "application/openapi+json" },
});

let projectLabel = baseUrl.hostname;
const hostedMatch = baseUrl.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
if (hostedMatch) projectLabel = hostedMatch[1];

console.log("Supabase connection check passed.");
console.log(`Project: ${projectLabel}`);
console.log(`Auth: HTTP ${auth.status}`);
console.log(`PostgREST: HTTP ${rest.status}`);
console.log("Credentials were used only for the checks and were not printed.");
