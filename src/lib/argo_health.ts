/**
 * Argo Health Status Module
 * Provides health monitoring utilities for the service.
 */

export interface ArgoHealthStatus {
  status: 'ok' | 'healthy';
  timestamp: string;
  uptime: number;
  environment: string;
}

export function getHealthStatus(): ArgoHealthStatus {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: typeof process !== 'undefined' && typeof process.uptime === 'function' ? process.uptime() : 0,
    environment: process.env.NODE_ENV || 'development',
  };
}

export default getHealthStatus;
