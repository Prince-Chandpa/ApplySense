import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  TelemetryEvent,
  ExperimentSummary,
  EventType,
} from '../src/types/analytics.ts';
import type { ApplicationRecord } from '../src/types/job.ts';
import {
  calculateExperimentPerformance,
  calculateExperimentStats,
  isEventType,
  isValidTelemetryEvent,
} from '../src/services/experimentAnalytics.ts';

// Shared data file paths
const DATA_DIR = path.resolve(process.cwd(), '.data');
const EVENTS_FILE = path.join(DATA_DIR, 'shared_events.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'shared_applications.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// In-memory cache synced with disk
let sharedEvents: TelemetryEvent[] = loadEventsFromDisk();
let sharedApplications: ApplicationRecord[] = loadApplicationsFromDisk();

function loadEventsFromDisk(): TelemetryEvent[] {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
      const parsed: unknown = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        console.error('Shared telemetry data must be an array.');
        return [];
      }
      return parsed.filter(isValidTelemetryEvent);
    }
  } catch (err) {
    console.error('Error reading shared events from disk:', err);
  }
  return [];
}

function saveEventsToDisk(): void {
  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(sharedEvents, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving shared events to disk:', err);
  }
}

function loadApplicationsFromDisk(): ApplicationRecord[] {
  try {
    if (fs.existsSync(APPLICATIONS_FILE)) {
      const data = fs.readFileSync(APPLICATIONS_FILE, 'utf-8');
      const parsed: ApplicationRecord[] = JSON.parse(data);
      return parsed.map(app => ({
        ...app,
        visitorId: app.visitorId || 'visitor_legacy',
      }));
    }
  } catch (err) {
    console.error('Error reading shared applications from disk:', err);
  }
  return [];
}

function saveApplicationsToDisk(): void {
  try {
    fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify(sharedApplications, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving shared applications to disk:', err);
  }
}

export function calculateSharedExperimentStats(events: TelemetryEvent[]): ExperimentSummary {
  return calculateExperimentStats(events);
}

// Generate benchmark cohort
export function generateSharedSimulatedCohort(): TelemetryEvent[] {
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

  sharedEvents = events;
  saveEventsToDisk();
  return events;
}

interface EventRequestBody {
  id?: string;
  eventType: EventType;
  timestamp?: string;
  visitorId: string;
  variation: 'control' | 'smart_insights';
  jobId?: string;
  metadata?: Record<string, unknown>;
}

function isValidEventRequest(value: unknown): value is EventRequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;

  return (
    isEventType(body.eventType) &&
    typeof body.visitorId === 'string' &&
    body.visitorId.trim().length > 0 &&
    body.visitorId.length <= 200 &&
    (body.variation === 'control' || body.variation === 'smart_insights') &&
    (body.id === undefined ||
      (typeof body.id === 'string' && body.id.trim().length > 0 && body.id.length <= 200)) &&
    (body.timestamp === undefined ||
      (typeof body.timestamp === 'string' && Number.isFinite(Date.parse(body.timestamp)))) &&
    (body.jobId === undefined ||
      (typeof body.jobId === 'string' && body.jobId.length <= 100)) &&
    (body.metadata === undefined ||
      (typeof body.metadata === 'object' && body.metadata !== null && !Array.isArray(body.metadata)))
  );
}

interface ApplicationRequestBody {
  jobId: string;
  jobTitle?: string;
  company?: string;
  name: string;
  email: string;
  portfolioUrl?: string;
  submittedAt?: string;
  variation?: 'control' | 'smart_insights' | 'unknown';
  matchScore?: number;
  visitorId?: string;
}

const VISITOR_ID_PATTERN =
  /^visitor_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getApplicationVisitorId(req: IncomingMessage): string | null {
  const header = req.headers['x-visitor-id'];
  if (typeof header !== 'string') return null;

  const visitorId = header.trim();
  return VISITOR_ID_PATTERN.test(visitorId) ? visitorId : null;
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isApplicationRequestBody(value: unknown): value is ApplicationRequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;

  if (
    !isNonEmptyString(body.jobId, 100) ||
    !isNonEmptyString(body.name, 200) ||
    !isNonEmptyString(body.email, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) {
    return false;
  }

  if (
    (body.jobTitle !== undefined && !isNonEmptyString(body.jobTitle, 200)) ||
    (body.company !== undefined && !isNonEmptyString(body.company, 200)) ||
    (body.portfolioUrl !== undefined &&
      (typeof body.portfolioUrl !== 'string' || body.portfolioUrl.length > 2048)) ||
    (body.submittedAt !== undefined &&
      (typeof body.submittedAt !== 'string' || !Number.isFinite(Date.parse(body.submittedAt)))) ||
    (body.variation !== undefined &&
      !['control', 'smart_insights', 'unknown'].includes(String(body.variation))) ||
    (body.matchScore !== undefined &&
      (typeof body.matchScore !== 'number' ||
        !Number.isFinite(body.matchScore) ||
        body.matchScore < 0 ||
        body.matchScore > 100)) ||
    (body.visitorId !== undefined && typeof body.visitorId !== 'string')
  ) {
    return false;
  }

  if (typeof body.portfolioUrl === 'string' && body.portfolioUrl.trim()) {
    try {
      const url = new URL(body.portfolioUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    } catch {
      return false;
    }
  }

  return true;
}

// Helper to read JSON request body
function parseRequestBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer | string) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJsonResponse(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-visitor-id',
  });
  res.end(JSON.stringify(data));
}

/**
 * Connect middleware for Vite dev & preview servers
 */
export function createApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '';
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-visitor-id',
      });
      res.end();
      return;
    }

    // 1. GET /api/telemetry/analytics (Shared across ALL browsers)
    if (pathname === '/api/telemetry/analytics' && method === 'GET') {
      const summary = calculateSharedExperimentStats(sharedEvents);
      const lastSyncedAt = new Date().toISOString();
      sendJsonResponse(res, 200, {
        summary,
        experiment: calculateExperimentPerformance(sharedEvents, lastSyncedAt),
        events: sharedEvents,
        totalEventsCount: sharedEvents.length,
        lastSyncedAt,
        source: 'shared_backend',
      });
      return;
    }

    // 2. POST /api/telemetry/events (Shared ingestion from any browser)
    if (pathname === '/api/telemetry/events' && method === 'POST') {
      try {
        const body = await parseRequestBody<EventRequestBody>(req);
        if (!isValidEventRequest(body)) {
          sendJsonResponse(res, 400, { error: 'Invalid telemetry event fields' });
          return;
        }

        const newEvent: TelemetryEvent = {
          id: body.id || crypto.randomUUID(),
          eventType: body.eventType,
          timestamp: body.timestamp || new Date().toISOString(),
          visitorId: body.visitorId.trim(),
          variation: body.variation,
          jobId: body.jobId || 'JOB-001',
          metadata: body.metadata,
        };

        sharedEvents = [newEvent, ...sharedEvents];
        saveEventsToDisk();

        const summary = calculateSharedExperimentStats(sharedEvents);
        sendJsonResponse(res, 201, {
          event: newEvent,
          summary,
          experiment: calculateExperimentPerformance(sharedEvents),
          lastSyncedAt: new Date().toISOString(),
        });
      } catch {
        sendJsonResponse(res, 400, { error: 'Invalid JSON payload' });
      }
      return;
    }

    // 3. DELETE /api/telemetry/events (Reset shared events)
    if (pathname === '/api/telemetry/events' && method === 'DELETE') {
      sharedEvents = [];
      saveEventsToDisk();
      const summary = calculateSharedExperimentStats(sharedEvents);
      sendJsonResponse(res, 200, {
        message: 'Shared telemetry events cleared',
        summary,
        experiment: calculateExperimentPerformance(sharedEvents),
        lastSyncedAt: new Date().toISOString(),
      });
      return;
    }

    // 4. POST /api/telemetry/simulate (Populate benchmark cohort)
    if (pathname === '/api/telemetry/simulate' && method === 'POST') {
      const events = generateSharedSimulatedCohort();
      const summary = calculateSharedExperimentStats(events);
      sendJsonResponse(res, 201, {
        message: 'Benchmark cohort populated across all browsers',
        eventsCount: events.length,
        summary,
        lastSyncedAt: new Date().toISOString(),
      });
      return;
    }

    // 5. GET /api/applications (PRIVATE to the requesting visitor ID)
    if (pathname === '/api/applications' && method === 'GET') {
      const visitorId = getApplicationVisitorId(req);

      if (!visitorId) {
        sendJsonResponse(res, 400, {
          error: 'A valid x-visitor-id header is required to retrieve applications',
          applications: [],
          count: 0,
        });
        return;
      }

      const requestedVisitorId = parsedUrl.searchParams.get('visitorId');
      if (requestedVisitorId !== null && requestedVisitorId !== visitorId) {
        sendJsonResponse(res, 403, { error: 'visitorId does not match the requesting visitor' });
        return;
      }

      // Backend ownership enforcement: Only return applications belonging to this visitor
      const visitorApplications = sharedApplications.filter(
        app => app.visitorId === visitorId
      );

      sendJsonResponse(res, 200, {
        applications: visitorApplications,
        count: visitorApplications.length,
        visitorId,
        lastSyncedAt: new Date().toISOString(),
      });
      return;
    }

    // 5b. DELETE /api/applications (Deletes only the requesting visitor's applications)
    if (pathname === '/api/applications' && method === 'DELETE') {
      const visitorId = getApplicationVisitorId(req);

      if (!visitorId) {
        sendJsonResponse(res, 400, { error: 'A valid x-visitor-id header is required' });
        return;
      }

      const requestedVisitorId = parsedUrl.searchParams.get('visitorId');
      if (requestedVisitorId !== null && requestedVisitorId !== visitorId) {
        sendJsonResponse(res, 403, { error: 'visitorId does not match the requesting visitor' });
        return;
      }

      sharedApplications = sharedApplications.filter(app => app.visitorId !== visitorId);
      saveApplicationsToDisk();

      sendJsonResponse(res, 200, {
        message: 'Applications for this visitor cleared',
      });
      return;
    }

    // 6. POST /api/applications (Associates submitted application with visitorId)
    if (pathname === '/api/applications' && method === 'POST') {
      try {
        const body = await parseRequestBody<ApplicationRequestBody>(req);
        const visitorId = getApplicationVisitorId(req);

        if (!visitorId) {
          sendJsonResponse(res, 400, { error: 'A valid x-visitor-id header is required' });
          return;
        }

        if (!isApplicationRequestBody(body)) {
          sendJsonResponse(res, 400, { error: 'Invalid application payload' });
          return;
        }

        if (body.visitorId !== undefined && body.visitorId.trim() !== visitorId) {
          sendJsonResponse(res, 403, { error: 'visitorId does not match the requesting visitor' });
          return;
        }

        const newApp: ApplicationRecord = {
          id: `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          jobId: body.jobId,
          jobTitle: body.jobTitle || 'Job Opportunity',
          company: body.company || 'Company',
          name: body.name.trim(),
          email: body.email.trim(),
          portfolioUrl: body.portfolioUrl?.trim(),
          submittedAt: body.submittedAt || new Date().toISOString(),
          variation: body.variation || 'control',
          matchScore: body.matchScore,
          visitorId,
        };

        sharedApplications = [newApp, ...sharedApplications];
        saveApplicationsToDisk();

        const visitorCount = sharedApplications.filter(a => a.visitorId === visitorId).length;

        sendJsonResponse(res, 201, {
          application: newApp,
          visitorCount,
        });
      } catch {
        sendJsonResponse(res, 400, { error: 'Invalid JSON payload' });
      }
      return;
    }

    // Not an API route, pass to next middleware
    next();
  };
}
