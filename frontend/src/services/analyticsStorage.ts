import type {
  TelemetryEvent,
  EventType,
  ExperimentSummary,
  VariantStats,
  SharedAnalyticsResponse,
} from '../types/analytics';
import type { ApplicationRecord } from '../types/job';
import { getVisitorId } from './flagsmith';

const LOCAL_EVENTS_KEY = 'appliesense_telemetry_events';
const LOCAL_APPS_KEY = 'appliesense_applications';

/**
 * Retrieve all events recorded locally in this browser.
 */
export function getStoredEvents(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading local telemetry events:', err);
    return [];
  }
}

/**
 * Record a telemetry event.
 * Saves to local browser storage AND syncs to shared backend API for cross-browser analytics.
 */
export async function recordSessionEvent(
  eventType: EventType,
  variation: 'control' | 'smart_insights',
  jobId: string,
  metadata?: Record<string, unknown>
): Promise<TelemetryEvent> {
  const visitorId = getVisitorId();
  const event: TelemetryEvent = {
    id: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    visitorId,
    variation,
    jobId,
    metadata,
  };

  // 1. Save to local browser session
  const existing = getStoredEvents();
  try {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify([event, ...existing]));
  } catch (err) {
    console.error('Error saving local telemetry event:', err);
  }

  // 2. Synchronize to shared backend for cross-browser dashboard
  try {
    await fetch('/api/telemetry/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch {
    // If backend is temporarily offline, local storage preserves it
  }

  return event;
}

/**
 * Fetch shared analytics across all browsers from backend API.
 * Falls back to local storage if server is unavailable.
 */
export async function fetchSharedAnalytics(): Promise<SharedAnalyticsResponse> {
  try {
    const res = await fetch('/api/telemetry/analytics', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return {
        summary: data.summary,
        events: data.events || [],
        totalEventsCount: data.totalEventsCount || (data.events ? data.events.length : 0),
        lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
        source: 'shared_backend',
      };
    }
  } catch (err) {
    console.warn('Could not fetch from shared backend, using local fallback:', err);
  }

  // Fallback to local session computation
  const localEvents = getStoredEvents();
  return {
    summary: calculateExperimentStats(localEvents),
    events: localEvents,
    totalEventsCount: localEvents.length,
    lastSyncedAt: new Date().toISOString(),
    source: 'local_fallback',
  };
}

/**
 * Fetch applications submitted by the current visitor/browser.
 * Enforces visitorId filtering both on the backend API and local storage fallback.
 */
export async function fetchSharedApplications(visitorId?: string): Promise<ApplicationRecord[]> {
  const vId = (visitorId || getVisitorId()).trim();

  try {
    const res = await fetch('/api/applications', {
      headers: {
        Accept: 'application/json',
        'x-visitor-id': vId,
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.applications)) {
        return data.applications.filter(
          (app: ApplicationRecord) => app.visitorId === vId
        );
      }
    }
  } catch {
    // Fall back to local storage
  }

  try {
    const raw = localStorage.getItem(LOCAL_APPS_KEY);
    const all: ApplicationRecord[] = raw ? JSON.parse(raw) : [];
    return all.filter((app: ApplicationRecord) => app.visitorId === vId);
  } catch {
    return [];
  }
}

/**
 * Save application to both local storage and shared backend API,
 * bound to the stable visitor ID.
 */
export async function saveSharedApplication(application: ApplicationRecord): Promise<void> {
  const visitorId = getVisitorId();
  const recordToSave: ApplicationRecord = {
    ...application,
    visitorId,
  };

  const response = await fetch('/api/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-visitor-id': visitorId,
    },
    body: JSON.stringify(recordToSave),
  });
  if (!response.ok) {
    throw new Error(`Application could not be saved (HTTP ${response.status})`);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('application' in result)) {
    throw new Error('The server returned an invalid application response');
  }

  const applicationResponse = result.application;
  if (
    !applicationResponse ||
    typeof applicationResponse !== 'object' ||
    !('visitorId' in applicationResponse) ||
    applicationResponse.visitorId !== visitorId
  ) {
    throw new Error('The server returned an application for a different visitor');
  }
  const savedApplication = applicationResponse as ApplicationRecord;

  try {
    const existingRaw = localStorage.getItem(LOCAL_APPS_KEY);
    const existing: ApplicationRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
    localStorage.setItem(LOCAL_APPS_KEY, JSON.stringify([savedApplication, ...existing]));
  } catch (err) {
    console.error('Error saving application to local storage:', err);
  }
}

/**
 * Clear applications for a specific visitor from both local storage and backend.
 */
export async function clearVisitorApplications(visitorId?: string): Promise<void> {
  const vId = (visitorId || getVisitorId()).trim();

  const response = await fetch('/api/applications', {
    method: 'DELETE',
    headers: { 'x-visitor-id': vId },
  });
  if (!response.ok) {
    throw new Error(`Applications could not be cleared (HTTP ${response.status})`);
  }

  try {
    const raw = localStorage.getItem(LOCAL_APPS_KEY);
    if (raw) {
      const all: ApplicationRecord[] = JSON.parse(raw);
      const remaining = all.filter((app: ApplicationRecord) => app.visitorId !== vId);
      localStorage.setItem(LOCAL_APPS_KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.error('Error clearing local visitor applications:', err);
  }
}

/**
 * Trigger shared benchmark cohort simulation across all browsers.
 */
export async function simulateSharedCohort(): Promise<SharedAnalyticsResponse> {
  try {
    const res = await fetch('/api/telemetry/simulate', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      return await fetchSharedAnalytics();
    }
  } catch {
    // Fall back to local simulation
  }

  const events = generateLocalSimulatedCohort();
  return {
    summary: calculateExperimentStats(events),
    events,
    totalEventsCount: events.length,
    lastSyncedAt: new Date().toISOString(),
    source: 'local_fallback',
  };
}

/**
 * Clears shared telemetry events and local session data.
 */
export async function clearSharedSessionData(): Promise<void> {
  // Clear local storage
  localStorage.removeItem(LOCAL_EVENTS_KEY);
  localStorage.removeItem(LOCAL_APPS_KEY);

  // Clear backend shared data
  try {
    await fetch('/api/telemetry/events', {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Could not reset backend telemetry:', err);
  }
}

/**
 * Local simulation fallback (50 Control / 50 Treatment)
 */
export function generateLocalSimulatedCohort(): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  const now = Date.now();

  for (let i = 1; i <= 50; i++) {
    const visitorId = `sim_ctrl_${i.toString().padStart(3, '0')}`;
    const timeOffset = (50 - i) * 60000;
    const startTime = new Date(now - timeOffset).toISOString();

    events.push({
      id: crypto.randomUUID(),
      eventType: 'application_started',
      timestamp: startTime,
      visitorId,
      variation: 'control',
      jobId: 'JOB-001',
      metadata: { simulated: true },
    });

    if (i <= 16) {
      events.push({
        id: crypto.randomUUID(),
        eventType: 'application_completed',
        timestamp: new Date(now - timeOffset + 30000).toISOString(),
        visitorId,
        variation: 'control',
        jobId: 'JOB-001',
        metadata: { simulated: true },
      });
    }
  }

  for (let i = 1; i <= 50; i++) {
    const visitorId = `sim_treat_${i.toString().padStart(3, '0')}`;
    const timeOffset = (50 - i) * 60000 + 15000;
    const startTime = new Date(now - timeOffset).toISOString();

    events.push({
      id: crypto.randomUUID(),
      eventType: 'application_started',
      timestamp: startTime,
      visitorId,
      variation: 'smart_insights',
      jobId: 'JOB-001',
      metadata: { simulated: true },
    });

    if (i <= 26) {
      events.push({
        id: crypto.randomUUID(),
        eventType: 'application_completed',
        timestamp: new Date(now - timeOffset + 25000).toISOString(),
        visitorId,
        variation: 'smart_insights',
        jobId: 'JOB-001',
        metadata: { simulated: true },
      });
    }
  }

  try {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch (err) {
    console.error('Error saving simulated cohort locally:', err);
  }

  return events;
}

/**
 * Standard normal cumulative distribution function (CDF approximation).
 */
function normalCDF(z: number): number {
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2.0);
  const t = 1.0 / (1.0 + p * x);
  const erf =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * erf);
}

/**
 * Calculate statistically sound metrics from recorded events.
 */
export function calculateExperimentStats(eventsList?: TelemetryEvent[]): ExperimentSummary {
  const events = eventsList || getStoredEvents();

  const controlStarts = new Set<string>();
  const controlCompletions = new Set<string>();
  let controlRawStarts = 0;
  let controlRawCompletions = 0;

  const treatStarts = new Set<string>();
  const treatCompletions = new Set<string>();
  let treatRawStarts = 0;
  let treatRawCompletions = 0;

  for (const e of events) {
    if (e.variation === 'control') {
      if (e.eventType === 'application_started') {
        controlStarts.add(e.visitorId);
        controlRawStarts++;
      } else if (e.eventType === 'application_completed') {
        controlCompletions.add(e.visitorId);
        controlRawCompletions++;
      }
    } else if (e.variation === 'smart_insights') {
      if (e.eventType === 'application_started') {
        treatStarts.add(e.visitorId);
        treatRawStarts++;
      } else if (e.eventType === 'application_completed') {
        treatCompletions.add(e.visitorId);
        treatRawCompletions++;
      }
    }
  }

  const controlUniqueStarts = controlStarts.size;
  const controlUniqueCompletions = controlCompletions.size;
  const controlRate =
    controlUniqueStarts > 0
      ? (controlUniqueCompletions / controlUniqueStarts) * 100
      : 0;

  const treatUniqueStarts = treatStarts.size;
  const treatUniqueCompletions = treatCompletions.size;
  const treatRate =
    treatUniqueStarts > 0
      ? (treatUniqueCompletions / treatUniqueStarts) * 100
      : 0;

  const controlStats: VariantStats = {
    variant: 'control',
    label: 'Control (Standard Details)',
    uniqueUsersExposed: controlUniqueStarts,
    starts: controlRawStarts,
    completions: controlRawCompletions,
    completionRate: Number(controlRate.toFixed(1)),
  };

  const treatStats: VariantStats = {
    variant: 'smart_insights',
    label: 'Treatment (FitLens Insights)',
    uniqueUsersExposed: treatUniqueStarts,
    starts: treatRawStarts,
    completions: treatRawCompletions,
    completionRate: Number(treatRate.toFixed(1)),
  };

  const totalStarts = controlUniqueStarts + treatUniqueStarts;
  const totalCompletions = controlUniqueCompletions + treatUniqueCompletions;
  const overallRate =
    totalStarts > 0 ? Number(((totalCompletions / totalStarts) * 100).toFixed(1)) : 0;

  const absoluteDiff = Number((treatStats.completionRate - controlStats.completionRate).toFixed(1));
  const sampleSizeSufficient = controlUniqueStarts >= 15 && treatUniqueStarts >= 15;

  let relativeLift: number | null = null;
  if (controlStats.completionRate > 0) {
    const rawLift =
      ((treatStats.completionRate - controlStats.completionRate) / controlStats.completionRate) * 100;
    relativeLift = Number(rawLift.toFixed(1));
  }

  let pValue: number | null = null;
  let isStatisticallySignificant = false;
  let confidenceInterval: [number, number] | null = null;

  if (sampleSizeSufficient && controlUniqueStarts > 0 && treatUniqueStarts > 0) {
    const p1 = treatUniqueCompletions / treatUniqueStarts;
    const p2 = controlUniqueCompletions / controlUniqueStarts;
    const n1 = treatUniqueStarts;
    const n2 = controlUniqueStarts;

    const pooledP = (treatUniqueCompletions + controlUniqueCompletions) / (n1 + n2);
    const standardError = Math.sqrt(
      pooledP * (1 - pooledP) * (1 / n1 + 1 / n2)
    );

    if (standardError > 0) {
      const zScore = (p1 - p2) / standardError;
      pValue = Number((2 * (1 - normalCDF(Math.abs(zScore)))).toFixed(4));
      isStatisticallySignificant = pValue < 0.05;

      const diffSE = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
      const margin = 1.96 * diffSE * 100;
      confidenceInterval = [
        Number((absoluteDiff - margin).toFixed(1)),
        Number((absoluteDiff + margin).toFixed(1)),
      ];
    }
  }

  const notes: string[] = [];
  if (!sampleSizeSufficient) {
    notes.push(
      `Sample size is currently insufficient (${totalStarts}/30 minimum unique starts across both variants). Lift and significance metrics are preliminary.`
    );
  }
  if (controlUniqueStarts === 0 || treatUniqueStarts === 0) {
    notes.push(
      'One or both variation cohorts currently have zero recorded applications. Submit applications across browsers to generate observations.'
    );
  }
  if (isStatisticallySignificant) {
    notes.push(
      `The treatment variation shows a statistically significant improvement at 95% confidence level (p = ${pValue}).`
    );
  }

  return {
    control: controlStats,
    treatment: treatStats,
    totalStarts,
    totalCompletions,
    overallRate,
    absoluteDifference: absoluteDiff,
    relativeLift,
    isStatisticallySignificant,
    pValue,
    confidenceInterval,
    sampleSizeSufficient,
    notes,
  };
}
