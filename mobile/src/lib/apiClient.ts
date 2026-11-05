import { apiUrl } from "./apiBaseUrl";

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = apiUrl(path);
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    let errorData: unknown;

    try {
      const parsed = await response.json();
      errorData = parsed;
      if (parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string") {
        errorMessage = parsed.error;
      } else if (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string") {
        errorMessage = parsed.message;
      }
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Fallback to HTTP error
      }
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export function apiGet<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "GET" });
}

export function apiPost<T = unknown>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T = unknown>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "DELETE" });
}

