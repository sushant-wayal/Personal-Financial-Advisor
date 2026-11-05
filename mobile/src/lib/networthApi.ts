
import { apiGet, apiPost, apiPut, apiDelete } from "./apiClient";

export interface NetWorthItem {
  id?: string;
  name?: string;
  institution?: string;
  currentWorth?: number;
  amount?: number;
  balance?: number;
  value?: number;
  currentValue?: number;
  [key: string]: unknown;
}

export interface NetWorthData {
  assets: Record<string, NetWorthItem[]>;
  liabilities: Record<string, NetWorthItem[]>;
  totals: {
    assets: number;
    liabilities: number;
    netWorth: number;
  };
}

export function fetchNetWorth() {
  return apiGet<NetWorthData>("/api/networth");
}

export function createNetWorth(type: string, data: unknown) {
  return apiPost(`/api/networth/${type}`, data);
}

export function updateNetWorth(type: string, id: string, data: unknown) {
  return apiPut(`/api/networth/${type}/${id}`, data);
}

export function deleteNetWorth(type: string, id: string) {
  return apiDelete(`/api/networth/${type}/${id}`);
}
