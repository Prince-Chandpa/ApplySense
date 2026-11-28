import type {
  TelemetryEvent,
  EventType,
  ExperimentPerformance,
  ExperimentSummary,
  SharedAnalyticsResponse,
} from '../types/analytics';
import type { ApplicationRecord } from '../types/job';
import { getVisitorId } from './flagsmith';
import {
  calculateExperimentPerformance,
  calculateExperimentStats as calculateStats,
  isValidTelemetryEvent,
} from './experimentAnalytics';

const LOCAL_EVENTS_KEY = 'appliesense_telemetry_events';
const LOCAL_APPS_KEY = 'appliesense_applications';

/**
 * Retrieve all events recorded locally in this browser.
 */
export function getStoredEvents(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidTelemetryEvent) : [];
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
      const events = Array.isArray(data.events)
        ? data.events.filter(isValidTelemetryEvent)
        : [];
      const experiment: ExperimentPerformance | null =
        data.experiment && typeof data.experiment === 'object' ? data.experiment : null;
      return {
        summary: experiment ? calculateStats(events, experiment) : calculateStats(events),
        experiment,
        ...(experiment ? {} : { experimentError: 'The shared backend did not return experiment metrics.' }),
        events,
        totalEventsCount: events.length,
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
    experiment: null,
    experimentError: 'Shared backend analytics are unavailable.',
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
  const experiment = calculateExperimentPerformance(events);
  return {
    summary: calculateExperimentStats(events),
    experiment,
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
      eventType: 'experiment_exposed',
      timestamp: startTime,
      visitorId,
      variation: 'control',
      jobId: 'JOB-001',
      metadata: { simulated: true },
    });

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
      eventType: 'experiment_exposed',
      timestamp: startTime,
      visitorId,
      variation: 'smart_insights',
      jobId: 'JOB-001',
      metadata: { simulated: true },
    });

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

export function calculateExperimentStats(eventsList?: TelemetryEvent[]): ExperimentSummary {
  return calculateStats(eventsList || getStoredEvents());
}
