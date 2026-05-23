import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
} from "@marketplace/shared";
import { apiFetch } from "./api";

export const registerRequest = (input: RegisterInput): Promise<AuthResponse> =>
  apiFetch<AuthResponse>("/auth/register", { method: "POST", body: input });

export const loginRequest = (input: LoginInput): Promise<AuthResponse> =>
  apiFetch<AuthResponse>("/auth/login", { method: "POST", body: input });

export const meRequest = (token?: string | null) =>
  apiFetch<{ user: AuthResponse["user"] }>("/auth/me", { token });
