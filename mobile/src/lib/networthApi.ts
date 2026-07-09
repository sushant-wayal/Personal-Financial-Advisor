import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useNetWorth() {
  return useQuery({
    queryKey: ["networth"],
    queryFn: () => fetchJson<NetWorthData>("/api/networth"),
  });
}

export function useCreateNetWorth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, data }: { type: string; data: any }) =>
      postJson(`/api/networth/${type}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["networth"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-v2"] });
    },
  });
}

export function useUpdateNetWorth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id, data }: { type: string; id: string; data: any }) =>
      putJson(`/api/networth/${type}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["networth"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-v2"] });
    },
  });
}

export function useDeleteNetWorth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      deleteJson(`/api/networth/${type}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["networth"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-v2"] });
    },
  });
}
