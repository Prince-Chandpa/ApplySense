export type EventType = 'application_started' | 'application_completed';

export interface TelemetryEvent {
  id: string;
  eventType: EventType;
  timestamp: string;
  visitorId: string;
  variation: 'control' | 'smart_insights';
  jobId: string;
  metadata?: Record<string, unknown>;
}

export interface VariantStats {
  variant: 'control' | 'smart_insights';
  label: string;
  uniqueUsersExposed: number;
  starts: number;
  completions: number;
  completionRate: number; // percentage (0-100)
}

export interface ExperimentSummary {
  control: VariantStats;
  treatment: VariantStats;
  totalStarts: number;
  totalCompletions: number;
  overallRate: number;
  absoluteDifference: number; // treatmentRate - controlRate
  relativeLift: number | null; // percentage lift, or null if invalid
  isStatisticallySignificant: boolean;
  pValue: number | null;
  confidenceInterval: [number, number] | null;
  sampleSizeSufficient: boolean;
  notes: string[];
}

export interface FlagsmithBackendResult {
  experimentId: string;
  status: 'active' | 'completed' | 'waiting_for_data';
  primaryMetric: string;
  secondaryMetric: string;
  controlConversions?: number;
  controlVisitors?: number;
  treatmentConversions?: number;
  treatmentVisitors?: number;
  winner?: string;
  probabilityOfBest?: {
    control: number;
    treatment: number;
  };
  lastUpdated?: string;
  dataAvailable: boolean;
  message?: string;
}

export interface SharedAnalyticsResponse {
  summary: ExperimentSummary;
  events: TelemetryEvent[];
  totalEventsCount: number;
  lastSyncedAt: string;
  source: 'shared_backend' | 'local_fallback';
}
