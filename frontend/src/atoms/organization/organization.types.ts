export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
  is_active: boolean;
  max_users?: number;
  max_volumes?: number;
  max_storage?: number;
}

export interface User {
  id: number;
  email: string;
  name?: string;
  organization_id: number;
  role: 'admin' | 'member' | 'viewer';
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface OrganizationStats {
  organization_id: number;
  total_volumes: number;
  total_size: number;
  total_users: number;
  total_files: number;
  volume_growth?: number;
  storage_growth?: number;
  growth_trends?: GrowthTrend[];
}

export interface GrowthTrend {
  date: string;
  volumes: number;
  storage: number;
  files: number;
}
