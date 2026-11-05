// export const API_BASE_URL = "http://192.168.1.71:3000";
export const API_BASE_URL = "https://movenorth.vercel.app";

/**
 * Resolves an API path against the configured API_BASE_URL.
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
