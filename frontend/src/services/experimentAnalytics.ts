import type {
  EventType,
  ExperimentPerformance,
  ExperimentSummary,
  ExperimentVariantPerformance,
  TelemetryEvent,
  VariantStats,
} from '../types/analytics.ts';

export const isValidTelemetryEvent = (value: unknown): value is TelemetryEvent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;

  return (
    typeof event.id === 'string' &&
    event.id.trim().length > 0 &&
    event.id.length <= 200 &&
    typeof event.visitorId === 'string' &&
    event.visitorId.trim().length > 0 &&
    event.visitorId.length <= 200 &&
    typeof event.jobId === 'string' &&
    event.jobId.length <= 100 &&
    (event.variation === 'control' || event.variation === 'smart_insights') &&
    ['experiment_exposed', 'application_started', 'application_completed'].includes(
      String(event.eventType)
    ) &&
    typeof event.timestamp === 'string' &&
    Number.isFinite(Date.parse(event.timestamp))
  );
};

const percentage = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : null;

export function calculateExperimentPerformance(
  input: unknown[],
  lastUpdated = new Date().toISOString()
): ExperimentPerformance {
  const events = input.filter(isValidTelemetryEvent);
  const assignments = new Map<
    string,
    { variation: 'control' | 'smart_insights'; timestamp: number }
  >();
  const conflictingVisitors = new Set<string>();

  for (const event of events) {
    if (event.eventType !== 'experiment_exposed') continue;
    const timestamp = Date.parse(event.timestamp);
    const previous = assignments.get(event.visitorId);
    if (previous && previous.variation !== event.variation) {
      conflictingVisitors.add(event.visitorId);
    } else if (!previous || timestamp < previous.timestamp) {
      assignments.set(event.visitorId, { variation: event.variation, timestamp });
    }
  }

  const controlVisitors = new Set<string>();
  const treatmentVisitors = new Set<string>();
  for (const [visitorId, assignment] of assignments) {
    if (conflictingVisitors.has(visitorId)) continue;
    (assignment.variation === 'control' ? controlVisitors : treatmentVisitors).add(visitorId);
  }

  const controlStarts = new Set<string>();
  const treatmentStarts = new Set<string>();
  const controlStartVisitors = new Set<string>();
  const treatmentStartVisitors = new Set<string>();
  const controlCompletions = new Set<string>();
  const treatmentCompletions = new Set<string>();
  const seenEventIds = new Set<string>();

  for (const event of events) {
    if (event.eventType === 'experiment_exposed' || seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);

    const assignment = assignments.get(event.visitorId);
    if (
      !assignment ||
      conflictingVisitors.has(event.visitorId) ||
      assignment.variation !== event.variation ||
      Date.parse(event.timestamp) < assignment.timestamp
    ) {
      continue;
    }

    if (event.eventType === 'application_started') {
      const starts = assignment.variation === 'control' ? controlStarts : treatmentStarts;
      const startVisitors =
        assignment.variation === 'control' ? controlStartVisitors : treatmentStartVisitors;
      starts.add(event.id);
      startVisitors.add(event.visitorId);
    } else if (event.eventType === 'application_completed') {
      (assignment.variation === 'control' ? controlCompletions : treatmentCompletions).add(
        event.visitorId
      );
    }
  }

  const variantPerformance = (
    visitors: Set<string>,
    starts: Set<string>,
    startVisitors: Set<string>,
    completions: Set<string>
  ): ExperimentVariantPerformance => ({
    visitors: visitors.size,
    applicationsStarted: starts.size,
    applicationsCompleted: completions.size,
    startRate: percentage(startVisitors.size, visitors.size),
    conversionRate: percentage(completions.size, visitors.size),
  });

  const control = variantPerformance(
    controlVisitors,
    controlStarts,
    controlStartVisitors,
    controlCompletions
  );
  const smartInsights = variantPerformance(
    treatmentVisitors,
    treatmentStarts,
    treatmentStartVisitors,
    treatmentCompletions
  );
  const conversionDifference =
    control.conversionRate !== null && smartInsights.conversionRate !== null
      ? Number((smartInsights.conversionRate - control.conversionRate).toFixed(2))
      : null;

  return {
    name: 'ApplySense Smart Job Insights Experiment',
    source: 'shared_backend_telemetry',
    status: control.visitors + smartInsights.visitors > 0 ? 'collecting_data' : 'no_data',
    control,
    smart_insights: smartInsights,
    conversionDifference,
    lastUpdated,
  };
}

export function calculateExperimentStats(
  events: unknown[],
  performance = calculateExperimentPerformance(events)
): ExperimentSummary {
  const toVariantStats = (
    variant: 'control' | 'smart_insights',
    label: string,
    stats: ExperimentVariantPerformance
  ): VariantStats => ({
    variant,
    label,
    uniqueUsersExposed: stats.visitors,
    starts: stats.applicationsStarted,
    completions: stats.applicationsCompleted,
    startRate: stats.startRate,
    completionRate: stats.conversionRate,
  });

  const control = toVariantStats(
    'control',
    'Control (Standard Details)',
    performance.control
  );
  const treatment = toVariantStats(
    'smart_insights',
    'Treatment (FitLens Insights)',
    performance.smart_insights
  );
  const visitors = control.uniqueUsersExposed + treatment.uniqueUsersExposed;
  const totalCompletions = control.completions + treatment.completions;

  return {
    control,
    treatment,
    totalStarts: control.starts + treatment.starts,
    totalCompletions,
    overallRate: percentage(totalCompletions, visitors),
    absoluteDifference: performance.conversionDifference,
  };
}

export function isEventType(value: unknown): value is EventType {
  return (
    value === 'experiment_exposed' ||
    value === 'application_started' ||
    value === 'application_completed'
  );
}
