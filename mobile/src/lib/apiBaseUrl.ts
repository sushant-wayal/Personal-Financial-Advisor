const normalizedApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "https://movenorth.vercel.app";

export const API_BASE_URL = normalizedApiBaseUrl;
