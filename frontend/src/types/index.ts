import React from 'react';

// Container types
export interface Container {
  id: string;
  name: string;
  image: string;
  status:
    | 'running'
    | 'stopped'
    | 'paused'
    | 'restarting'
    | 'removing'
    | 'dead'
    | 'created'
    | 'exited';
  state: string;
  created: string;
  ports: Port[];
  networks: NetworkConnection[];
  mounts: Mount[];
  labels: Record<string, string>;
  stats?: ContainerStats;
}

export interface Port {
  privatePort: number;
  publicPort?: number;
  type: 'tcp' | 'udp';
  ip?: string;
}

export interface NetworkConnection {
  networkId: string;
  networkName: string;
  ipAddress: string;
  gateway: string;
  macAddress: string;
}

export interface Mount {
  type: 'bind' | 'volume' | 'tmpfs';
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
}

// Container statistics
export interface ContainerStats {
  id: string;
  timestamp: string;
  cpu: CPUStats;
  memory: MemoryStats;
  network: NetworkStats;
  blockIO: BlockIOStats;
}

export interface CPUStats {
  usagePercent: number;
  totalUsage: number;
  systemUsage: number;
  onlineCPUs: number;
}

export interface MemoryStats {
  usage: number;
  limit: number;
  usagePercent: number;
  cache: number;
  rss: number;
}

export interface NetworkStats {
  rxBytes: number;
  rxPackets: number;
  rxErrors: number;
  rxDropped: number;
  txBytes: number;
  txPackets: number;
  txErrors: number;
  txDropped: number;
}

export interface BlockIOStats {
  readBytes: number;
  writeBytes: number;
  readOps: number;
  writeOps: number;
}

// Network types
export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: 'local' | 'global' | 'swarm';
  attachable: boolean;
  ingress: boolean;
  ipam: IPAM;
  containers: Record<string, NetworkContainer>;
  options: Record<string, string>;
  labels: Record<string, string>;
}

export interface IPAM {
  driver: string;
  config: IPAMConfig[];
  options: Record<string, string>;
}

export interface IPAMConfig {
  subnet: string;
  gateway: string;
  ipRange?: string;
  auxAddress?: Record<string, string>;
}

export interface NetworkContainer {
  name: string;
  endpointId: string;
  macAddress: string;
  ipv4Address: string;
  ipv6Address?: string;
}

// API response types
export interface APIResponse<T> {
  data: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// UI component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Chart data types
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Filter and search types
export interface ContainerFilters {
  status?: Container['status'][];
  name?: string;
  image?: string;
  network?: string;
  label?: Record<string, string>;
}

export interface SortConfig {
  field: keyof Container;
  direction: 'asc' | 'desc';
}
