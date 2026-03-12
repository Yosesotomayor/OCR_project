export type LeaseStatus = 'active' | 'pending_renewal' | 'expired' | 'terminated';
export type OccupancyType = 'residential' | 'commercial' | 'industrial' | 'retail';

export interface ILeaseContract {
  id: string;
  tenant: string;
  monthly_rent: number;
  expiry_date: string;
  status: LeaseStatus;
  occupancy_type: OccupancyType;
  property_name: string;
  property_zone: string;
}

export interface IKPIs {
  total_mrr: number;
  active_leases: number;
  pending_renewals: number;
  vacancy_rate: number;
  doc_health: number; // percentage
  expiring_soon: number; // < 30 days
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export interface Document {
  id: string;
  name: string;
  status: 'indexed' | 'processing' | 'failed';
  uploadedAt: string;
  size?: string;
}

export interface Source {
  filename: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isThinking?: boolean;
  sources?: Source[]; // Source Attribution
}
