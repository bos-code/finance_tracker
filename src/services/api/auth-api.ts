import { httpClient } from "@/services/api/http-client";

type AuthPayload = {
  email: string;
  password: string;
  fullName?: string;
};

type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
  };
};

export async function signInRequest(payload: AuthPayload) {
  return httpClient<AuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function signUpRequest(payload: AuthPayload) {
  return httpClient<AuthResponse>("/auth/register", {
    method: "POST",
    body: payload,
  });
}
