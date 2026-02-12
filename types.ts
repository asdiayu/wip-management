
export interface User {
  id: string;
  email: string;
  user_metadata: {
    role?: 'admin' | 'operator' | 'manager' | 'viewer';
  };
  app_metadata?: {
    role?: 'admin' | 'operator' | 'manager' | 'viewer';
    [key: string]: any;
  };
}

export interface Location {
  id: string;
  name: string;
}

export interface Material {
  id: string;
  name: string;
  stock: number;
  unit: string;
  department?: string | null;
  machine_number?: string | null;
  min_stock?: number | null;
  max_stock?: number | null;
  default_location_id?: string | null;
}

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
  // Removed explicit ENUM types that don't exist in DB to prevent errors
  // Virtual types handled in UI logic:
  // TRANSFER_IN, TRANSFER_OUT, RETURN_IN, RETURN_OUT, INITIAL
}

export interface Transaction {
  id: string;
  material_id: string;
  materialName?: string;
  type: TransactionType;
  quantity: number;
  timestamp: string;
  notes?: string;
  shift?: string;
  pic?: string;
  location_id?: string | null;
  locations?: { name: string } | null; // For joined data
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_email: string;
  action: string;
  details: string;
}