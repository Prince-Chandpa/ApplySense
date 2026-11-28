export type EventType =
  | 'experiment_exposed'
  | 'application_started'
  | 'application_completed';

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
  startRate: number | null;
  completionRate: number | null;
}

export interface ExperimentSummary {
  control: VariantStats;
  treatment: VariantStats;
  totalStarts: number;
  totalCompletions: number;
  overallRate: number | null;
  absoluteDifference: number | null;
}

export interface ExperimentVariantPerformance {
  visitors: number;
  applicationsStarted: number;
  applicationsCompleted: number;
  startRate: number | null;
  conversionRate: number | null;
}

export interface ExperimentPerformance {
  name: string;
  source: 'shared_backend_telemetry';
  status: 'no_data' | 'collecting_data';
  control: ExperimentVariantPerformance;
  smart_insights: ExperimentVariantPerformance;
  conversionDifference: number | null;
  lastUpdated: string;
}

export interface SharedAnalyticsResponse {
  summary: ExperimentSummary;
  experiment: ExperimentPerformance | null;
  experimentError?: string;
  events: TelemetryEvent[];
  totalEventsCount: number;
  lastSyncedAt: string;
  source: 'shared_backend' | 'local_fallback';
}
