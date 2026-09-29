export type DispatchStatus = 'QUEUED' | 'IN-FLIGHT' | 'DELIVERED';
export type SparrowState = 'ROOSTING' | 'FLYING' | 'RESTING';

export interface Sparrow {
  id: string;
  name: string;
  state: SparrowState;
  stamina: number; // 0-100
  trips: number;
}

export interface Dispatch {
  id: string;
  crate: string; // stamped mono index, e.g. CRATE 07
  recipient: string;
  note: string;
  priority: 'LOW' | 'STANDARD' | 'URGENT';
  status: DispatchStatus;
  sparrowId: string | null;
  createdAt: number;
  dispatchedAt: number | null;
  deliveredAt: number | null;
}

export interface LogEntry {
  id: string;
  at: number;
  kind: 'HATCH' | 'QUEUE' | 'DISPATCH' | 'DELIVER' | 'RETURN' | 'NOTE';
  sparrowId: string | null;
  dispatchId: string | null;
  text: string;
}

export interface DepotState {
  sparrows: Sparrow[];
  dispatches: Dispatch[];
  log: LogEntry[];
  crateCounter: number;
}
