import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  TelemetryEvent,
  ExperimentSummary,
  VariantStats,
  FlagsmithBackendResult,
} from '../src/types/analytics.ts';
import type { ApplicationRecord } from '../src/types/job.ts';

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
      return JSON.parse(data);
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

// Approximation of Normal CDF for two-proportion Z-test
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

// Statistical calculation with unique users denominator
export function calculateSharedExperimentStats(events: TelemetryEvent[]): ExperimentSummary {
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

  sharedEvents = events;
  saveEventsToDisk();
  return events;
}

// Server-side cache for Flagsmith Management API experiment results
let cachedFlagsmithResults: { data: FlagsmithBackendResult; timestamp: number } | null = null;
const FLAGSMITH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function queryFlagsmithManagementAPI(): Promise<FlagsmithBackendResult> {
  const adminApiKey = process.env.FLAGSMITH_ADMIN_API_KEY;
  const envKey = process.env.VITE_FLAGSMITH_ENVIRONMENT_KEY || '8ZJ6EZdWLaZQEV5P2kr4ZE';
  const experimentId = process.env.FLAGSMITH_EXPERIMENT_ID || 'smartapply_job_experience';

  const now = Date.now();
  if (cachedFlagsmithResults && now - cachedFlagsmithResults.timestamp < FLAGSMITH_CACHE_TTL_MS) {
    return cachedFlagsmithResults.data;
  }

  if (!adminApiKey) {
    return {
      experimentId: 'ApplySense Smart Job Insights Experiment',
      status: 'waiting_for_data',
      primaryMetric: 'application_completed',
      secondaryMetric: 'application_started',
      dataAvailable: false,
      message:
        'Flagsmith Managed Warehouse is connected and actively ingesting events. Server proxy is active, waiting for warehouse batch computation or FLAGSMITH_ADMIN_API_KEY configuration for direct Bayesian query.',
    };
  }

  try {
    const res = await fetch(
      `https://edge.api.flagsmith.com/api/v1/environments/${envKey}/experiments/${experimentId}/results/`,
      {
        headers: {
          Authorization: `Api-Key ${adminApiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (res.ok) {
      const json = (await res.json()) as {
        control_conversions?: number;
        control_visitors?: number;
        treatment_conversions?: number;
        treatment_visitors?: number;
        winner?: string;
      };
      const result: FlagsmithBackendResult = {
        experimentId: 'ApplySense Smart Job Insights Experiment',
        status: 'active',
        primaryMetric: 'application_completed',
        secondaryMetric: 'application_started',
        dataAvailable: true,
        controlConversions: json.control_conversions,
        controlVisitors: json.control_visitors,
        treatmentConversions: json.treatment_conversions,
        treatmentVisitors: json.treatment_visitors,
        winner: json.winner,
        lastUpdated: new Date().toISOString(),
      };
      cachedFlagsmithResults = { data: result, timestamp: now };
      return result;
    }
  } catch (err) {
    console.warn('Could not reach Flagsmith Management API:', err);
  }

  return {
    experimentId: 'ApplySense Smart Job Insights Experiment',
    status: 'waiting_for_data',
    primaryMetric: 'application_completed',
    secondaryMetric: 'application_started',
    dataAvailable: false,
    message:
      'Flagsmith Managed Warehouse is processing events. Batch calculations are running asynchronously.',
  };
}

interface EventRequestBody {
  id?: string;
  eventType: 'application_started' | 'application_completed';
  timestamp?: string;
  visitorId: string;
  variation: 'control' | 'smart_insights';
  jobId?: string;
  metadata?: Record<string, unknown>;
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
      sendJsonResponse(res, 200, {
        summary,
        events: sharedEvents,
        totalEventsCount: sharedEvents.length,
        lastSyncedAt: new Date().toISOString(),
        source: 'shared_backend',
      });
      return;
    }

    // 2. POST /api/telemetry/events (Shared ingestion from any browser)
    if (pathname === '/api/telemetry/events' && method === 'POST') {
      try {
        const body = await parseRequestBody<EventRequestBody>(req);
        if (!body.eventType || !body.variation || !body.visitorId) {
          sendJsonResponse(res, 400, { error: 'Missing required event fields (eventType, variation, visitorId)' });
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

    // 7. GET /api/experiment-results (Secure Proxy to Flagsmith Management API)
    if (pathname === '/api/experiment-results' && method === 'GET') {
      const results = await queryFlagsmithManagementAPI();
      sendJsonResponse(res, 200, results);
      return;
    }

    // Not an API route, pass to next middleware
    next();
  };
}
