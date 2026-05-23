import { env } from "./env";

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: ApiErrorDetail[];

  constructor(
    message: string,
    status: number,
    code: string,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string | null;
}

const tokenStorageKey = "marketplace.auth.token";

export const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenStorageKey);
};

export const setStoredToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token === null) {
    window.localStorage.removeItem(tokenStorageKey);
  } else {
    window.localStorage.setItem(tokenStorageKey, token);
  }
};

export const apiFetch = async <T,>(
  path: string,
  { body, token, headers, ...init }: RequestOptions = {},
): Promise<T> => {
  const resolvedToken = token === undefined ? getStoredToken() : token;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${env.API_URL}${path}`, {
    ...init,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; code?: string; details?: ApiErrorDetail[] }
    | T
    | null;

  if (!response.ok) {
    const errPayload = (payload ?? {}) as {
      error?: string;
      code?: string;
      details?: ApiErrorDetail[];
    };
    throw new ApiError(
      errPayload.error ?? `Request failed with status ${response.status}`,
      response.status,
      errPayload.code ?? "UNKNOWN_ERROR",
      errPayload.details,
    );
  }

  return payload as T;
};
