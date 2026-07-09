
import { API_BASE_URL } from "./apiBaseUrl";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postJson(path: string, body: any) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putJson(path: string, body: any) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteJson(path: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface NetWorthData {
  assets: Record<string, any[]>;
  liabilities: Record<string, any[]>;
  totals: {
    assets: number;
    liabilities: number;
    netWorth: number;
  };
}

export function fetchNetWorth() {
  return fetchJson<NetWorthData>("/api/networth");
}

export function createNetWorth(type: string, data: any) {
  return postJson(`/api/networth/${type}`, data);
}

export function updateNetWorth(type: string, id: string, data: any) {
  return putJson(`/api/networth/${type}/${id}`, data);
}

export function deleteNetWorth(type: string, id: string) {
  return deleteJson(`/api/networth/${type}/${id}`);
}
