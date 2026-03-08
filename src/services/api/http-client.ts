import Constants from "expo-constants";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestConfig = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
};

const baseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ?? "https://example.api.company.com";

export async function httpClient<TResponse>(
  path: string,
  config: RequestConfig = {},
): Promise<TResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: config.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(config.headers ?? {}),
    },
    body: config.body ? JSON.stringify(config.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
