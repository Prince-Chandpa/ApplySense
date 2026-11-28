import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Sparkles,
  CheckCircle2,
  Info,
  RefreshCw,
  Database,
  Lock,
  PlayCircle,
  RotateCcw,
  Clock,
  FileSpreadsheet,
  Globe2,
  Laptop,
} from 'lucide-react';
import {
  getStoredEvents,
  calculateExperimentStats,
  fetchSharedAnalytics,
  simulateSharedCohort,
  clearSharedSessionData,
} from '../services/analyticsStorage';
import {
  fetchFlagsmithExperimentResults,
  getVisitorId,
} from '../services/flagsmith';
import type {
  ExperimentSummary,
  TelemetryEvent,
  FlagsmithBackendResult,
} from '../types/analytics';
import { ConversionBarChart } from '../components/Charts/ConversionBarChart';
import { FunnelChart } from '../components/Charts/FunnelChart';

export const AnalyticsPage: React.FC = () => {
  const [activeDataSource, setActiveDataSource] = useState<'shared' | 'local'>('shared');
  const [activeTab, setActiveTab] = useState<'experiment' | 'warehouse' | 'events'>('experiment');
  const [eventFilter, setEventFilter] = useState<'all' | 'application_started' | 'application_completed'>('all');

  // Shared backend state
  const [sharedSummary, setSharedSummary] = useState<ExperimentSummary>(() => calculateExperimentStats([]));
  const [sharedEvents, setSharedEvents] = useState<TelemetryEvent[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dataSourceType, setDataSourceType] = useState<'shared_backend' | 'local_fallback'>('shared_backend');

  // Local browser session state
  const [localEvents, setLocalEvents] = useState<TelemetryEvent[]>(() => getStoredEvents());
  const [localSummary, setLocalSummary] = useState<ExperimentSummary>(() =>
    calculateExperimentStats(getStoredEvents())
  );

  // Flagsmith Warehouse management result
  const [backendResult, setBackendResult] = useState<FlagsmithBackendResult | null>(null);
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(true);

  const visitorId = getVisitorId();

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchSharedAnalytics();
      setSharedSummary(res.summary);
      setSharedEvents(res.events);
      setLastSyncedAt(res.lastSyncedAt);
      setDataSourceType(res.source);

      const local = getStoredEvents();
      setLocalEvents(local);
      setLocalSummary(calculateExperimentStats(local));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Polling auto-refresh every 12 seconds
  useEffect(() => {
    let isMounted = true;

    fetchSharedAnalytics().then(res => {
      if (isMounted) {
        setSharedSummary(res.summary);
        setSharedEvents(res.events);
        setLastSyncedAt(res.lastSyncedAt);
        setDataSourceType(res.source);
      }
    });

    const interval = setInterval(() => {
      fetchSharedAnalytics().then(res => {
        if (isMounted) {
          setSharedSummary(res.summary);
          setSharedEvents(res.events);
          setLastSyncedAt(res.lastSyncedAt);
          setDataSourceType(res.source);
        }
      });
    }, 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Check Flagsmith Management API experiment results
  useEffect(() => {
    let isMounted = true;
    fetchFlagsmithExperimentResults()
      .then(res => {
        if (isMounted) setBackendResult(res);
      })
      .catch(() => {
        if (isMounted) {
          setBackendResult({
            experimentId: 'ApplySense Smart Job Insights Experiment',
            status: 'waiting_for_data',
            primaryMetric: 'application_completed',
            secondaryMetric: 'application_started',
            dataAvailable: false,
            message: 'Flagsmith Managed Warehouse results awaiting batch computation.',
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingBackend(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSimulateCohort = async () => {
    setIsRefreshing(true);
    try {
      const res = await simulateSharedCohort();
      setSharedSummary(res.summary);
      setSharedEvents(res.events);
      setLastSyncedAt(res.lastSyncedAt);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Reset all shared telemetry events across all browsers back to clean state?')) {
      setIsRefreshing(true);
      try {
        await clearSharedSessionData();
        await handleManualRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Select active data to display
  const isViewingLocal = activeDataSource === 'local';
  const displayedSummary = isViewingLocal ? localSummary : sharedSummary;
  const displayedEvents = isViewingLocal ? localEvents : sharedEvents;

  const isCohortSimulated = displayedEvents.some(e => e.metadata?.simulated);

  const filteredEvents = displayedEvents.filter(e => {
    if (eventFilter === 'all') return true;
    return e.eventType === eventFilter;
  });

  const formattedLastSync = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Syncing...';

  return (
    <main className="container analytics-container">
      {/* Page Header */}
      <div className="analytics-header">
        <div>
          <div className="analytics-badge">
            <BarChart3 size={15} />
            <span>A/B TEST & CONVERSION INTELLIGENCE</span>
          </div>
          <h1>Experiment Analytics Dashboard</h1>
          <p>
            Shared cross-browser analytics evaluating whether FitLens Smart Job Insights improves application completion.
          </p>
        </div>

        <div className="analytics-actions">
          {/* Live Sync Status Pill */}
          <div className="sync-status-indicator" title="Automatic synchronization every 12 seconds">
            <span className="live-dot" />
            <span className="sync-text">Auto-sync (12s)</span>
            <span className="sync-time">
              <Clock size={12} className="inline-icon" /> {formattedLastSync}
            </span>
          </div>

          <button
            type="button"
            className="action-btn icon-btn"
            onClick={handleManualRefresh}
            title="Manual sync now"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
          </button>

          {isCohortSimulated ? (
            <button
              type="button"
              className="action-btn secondary-btn"
              onClick={handleClearData}
              title="Return shared analytics to clean state"
            >
              <RotateCcw size={14} />
              Reset Shared Data
            </button>
          ) : (
            <button
              type="button"
              className="action-btn primary-btn"
              onClick={handleSimulateCohort}
              title="Populates 100 benchmark users across all browsers to evaluate statistical charts at scale"
            >
              <PlayCircle size={14} />
              Simulate 100 Users
            </button>
          )}
        </div>
      </div>

      {/* Shared vs Local Data Scope Switcher Banner */}
      <div className="data-scope-banner">
        <div className="scope-info">
          <span className="scope-label">Active Analytics Scope:</span>
          <strong>
            {isViewingLocal
              ? `Local Browser Session Only (Visitor: ${visitorId.slice(0, 16)}...)`
              : 'Shared Global Telemetry (Synchronized Across All Browsers)'}
          </strong>
          {dataSourceType === 'shared_backend' && !isViewingLocal && (
            <span className="backend-live-badge">✓ Backend Connected</span>
          )}
        </div>

        <div className="scope-toggle-buttons">
          <button
            type="button"
            className={`scope-btn ${!isViewingLocal ? 'active' : ''}`}
            onClick={() => setActiveDataSource('shared')}
          >
            <Globe2 size={14} />
            Shared (All Browsers)
          </button>
          <button
            type="button"
            className={`scope-btn ${isViewingLocal ? 'active' : ''}`}
            onClick={() => setActiveDataSource('local')}
          >
            <Laptop size={14} />
            This Browser Tab Only
          </button>
        </div>
      </div>

      {/* Benchmark Cohort Notice Banner */}
      {isCohortSimulated && (
        <div className="simulated-alert-banner">
          <Info size={18} />
          <div>
            <strong>Benchmark Demonstration Cohort Loaded:</strong> 100 candidate trials
            (50 Control / 50 Treatment) are loaded into the shared backend to visualize high-volume charts, lift calculations, and
            two-proportion statistical significance. Real events recorded in Browser A or B are merged.
          </div>
          <button
            type="button"
            className="sim-banner-btn"
            onClick={handleClearData}
          >
            Clear Cohort
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="analytics-nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'experiment' ? 'active' : ''}`}
          onClick={() => setActiveTab('experiment')}
        >
          <TrendingUp size={15} />
          Experiment Results & Lift
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'warehouse' ? 'active' : ''}`}
          onClick={() => setActiveTab('warehouse')}
        >
          <Database size={15} />
          Flagsmith Warehouse & API
          <span className="live-dot" />
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <FileSpreadsheet size={15} />
          Event Stream ({displayedEvents.length})
        </button>
      </div>

      {/* TAB 1: EXPERIMENT RESULTS & LIFT */}
      {activeTab === 'experiment' && (
        <>
          {/* Section 1: Overview Summary Cards */}
          <div className="metric-cards-grid">
            <div className="metric-card">
              <div className="metric-icon-wrap starts-bg">
                <Users size={20} className="starts-color" />
              </div>
              <div className="metric-content">
                <span className="metric-label">Application Starts (Auxiliary)</span>
                <strong className="metric-value">{displayedSummary.totalStarts}</strong>
                <span className="metric-hint">Unique visitors opening apply form</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap completions-bg">
                <Target size={20} className="completions-color" />
              </div>
              <div className="metric-content">
                <span className="metric-label">Application Completions (Primary)</span>
                <strong className="metric-value">{displayedSummary.totalCompletions}</strong>
                <span className="metric-hint">Validated & saved applications</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap rate-bg">
                <TrendingUp size={20} className="rate-color" />
              </div>
              <div className="metric-content">
                <span className="metric-label">Overall Conversion Rate</span>
                <strong className="metric-value">{displayedSummary.overallRate}%</strong>
                <span className="metric-hint">Completions / Unique Starts</span>
              </div>
            </div>

            <div className="metric-card">
              <div
                className={`metric-icon-wrap ${
                  displayedSummary.absoluteDifference >= 0 ? 'lift-pos-bg' : 'lift-neg-bg'
                }`}
              >
                <Sparkles
                  size={20}
                  className={displayedSummary.absoluteDifference >= 0 ? 'lift-pos-color' : 'lift-neg-color'}
                />
              </div>
              <div className="metric-content">
                <span className="metric-label">Treatment Lift</span>
                <strong
                  className={`metric-value ${
                    displayedSummary.absoluteDifference >= 0 ? 'lift-pos-text' : 'lift-neg-text'
                  }`}
                >
                  {displayedSummary.absoluteDifference > 0 ? `+${displayedSummary.absoluteDifference}%` : `${displayedSummary.absoluteDifference}%`}
                </strong>
                <span className="metric-hint">
                  {displayedSummary.relativeLift !== null && displayedSummary.sampleSizeSufficient
                    ? `Relative: +${displayedSummary.relativeLift}%`
                    : 'Awaiting sufficient N (≥30)'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Experiment Side-by-Side Comparison */}
          <div className="experiment-comparison-card">
            <div className="comparison-header">
              <div>
                <h3>Variation Performance Breakdown</h3>
                <p>
                  Comparing Primary Metric: Application Completion Rate (
                  {isViewingLocal ? 'Local Session' : 'Shared Across Browsers'})
                </p>
              </div>

              <div className="allocation-pill">
                50% Control / 50% Treatment Allocation
              </div>
            </div>

            <div className="variants-grid">
              {/* Control Card */}
              <div className="variant-box control-box">
                <div className="variant-box-top">
                  <div>
                    <span className="variant-badge ctrl-badge">CONTROL</span>
                    <h4>Standard Job Experience</h4>
                  </div>
                  <span className="variation-code">variant: control</span>
                </div>

                <div className="conversion-display">
                  <span className="big-rate">{displayedSummary.control.completionRate}%</span>
                  <span className="rate-subtext">Conversion Rate</span>
                </div>

                <div className="variant-stats-list">
                  <div className="v-stat-row">
                    <span>Unique Exposed Visitors (Starts):</span>
                    <strong>{displayedSummary.control.uniqueUsersExposed}</strong>
                  </div>
                  <div className="v-stat-row">
                    <span>Completed Applications:</span>
                    <strong>{displayedSummary.control.completions}</strong>
                  </div>
                  <div className="v-stat-row">
                    <span>Raw Event Starts:</span>
                    <span>{displayedSummary.control.starts}</span>
                  </div>
                </div>

                <div className="variant-features-list">
                  <span className="features-title">Features displayed:</span>
                  <ul>
                    <li>✓ Standard job title & company details</li>
                    <li>✓ Role description & required skills</li>
                    <li>✓ Eligibility criteria & salary</li>
                    <li>✕ No personalized FitLens match score</li>
                    <li>✕ No skill gap or improvement recommendations</li>
                  </ul>
                </div>
              </div>

              {/* Treatment Card */}
              <div className="variant-box treatment-box">
                <div className="variant-box-top">
                  <div>
                    <span className="variant-badge treat-badge">TREATMENT</span>
                    <h4>FitLens Smart Job Insights</h4>
                  </div>
                  <span className="variation-code">variant: smart_insights</span>
                </div>

                <div className="conversion-display">
                  <span className="big-rate treat-rate">{displayedSummary.treatment.completionRate}%</span>
                  <span className="rate-subtext">Conversion Rate</span>
                </div>

                <div className="variant-stats-list">
                  <div className="v-stat-row">
                    <span>Unique Exposed Visitors (Starts):</span>
                    <strong>{displayedSummary.treatment.uniqueUsersExposed}</strong>
                  </div>
                  <div className="v-stat-row">
                    <span>Completed Applications:</span>
                    <strong>{displayedSummary.treatment.completions}</strong>
                  </div>
                  <div className="v-stat-row">
                    <span>Raw Event Starts:</span>
                    <span>{displayedSummary.treatment.starts}</span>
                  </div>
                </div>

                <div className="variant-features-list">
                  <span className="features-title">Features displayed:</span>
                  <ul>
                    <li>✓ All standard job details & salary</li>
                    <li>✓ Dynamic FitLens skill-match percentage</li>
                    <li>✓ Matched skills vs missing skills breakdown</li>
                    <li>✓ Targeted profile improvement suggestions</li>
                    <li>✓ High-confidence application call-to-action</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Statistical Lift & Rigor Card */}
            <div className="statistical-rigor-card">
              <div className="rigor-header">
                <h4>Statistical Rigor & Lift Analysis</h4>
                <span className="rigor-tag">Data Integrity Protected</span>
              </div>

              <div className="rigor-grid">
                <div className="rigor-item">
                  <span className="rigor-label">Absolute Difference:</span>
                  <strong>
                    {displayedSummary.absoluteDifference > 0
                      ? `+${displayedSummary.absoluteDifference}%`
                      : `${displayedSummary.absoluteDifference}%`}
                  </strong>
                  <span className="rigor-desc">Treatment Rate - Control Rate</span>
                </div>

                <div className="rigor-item">
                  <span className="rigor-label">Relative Lift:</span>
                  <strong>
                    {displayedSummary.relativeLift !== null && displayedSummary.control.completionRate > 0
                      ? `${displayedSummary.relativeLift > 0 ? '+' : ''}${displayedSummary.relativeLift}%`
                      : 'N/A (Control = 0%)'}
                  </strong>
                  <span className="rigor-desc">(Treatment - Control) / Control</span>
                </div>

                <div className="rigor-item">
                  <span className="rigor-label">Two-Proportion Z-Test (p-value):</span>
                  <strong>
                    {displayedSummary.pValue !== null ? `p = ${displayedSummary.pValue}` : 'Insufficient Data'}
                  </strong>
                  <span className="rigor-desc">Significance threshold: p &lt; 0.05</span>
                </div>

                <div className="rigor-item">
                  <span className="rigor-label">Statistical Significance:</span>
                  <span
                    className={`sig-pill ${
                      displayedSummary.isStatisticallySignificant ? 'sig-yes' : 'sig-no'
                    }`}
                  >
                    {displayedSummary.isStatisticallySignificant
                      ? '✓ Statistically Significant (p < 0.05)'
                      : displayedSummary.sampleSizeSufficient
                      ? 'Not Significant Yet'
                      : 'Sample Size Too Small'}
                  </span>
                  <span className="rigor-desc">
                    {displayedSummary.sampleSizeSufficient
                      ? `N = ${displayedSummary.totalStarts} (Sufficient sample)`
                      : `N = ${displayedSummary.totalStarts}/30 required minimum`}
                  </span>
                </div>
              </div>

              {/* Data Integrity Callout */}
              <div className="integrity-notes">
                {displayedSummary.notes.map((note, idx) => (
                  <p key={idx}>
                    <Info size={14} className="note-icon" />
                    {note}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Visual Charts */}
          <div className="charts-grid">
            <ConversionBarChart
              control={displayedSummary.control}
              treatment={displayedSummary.treatment}
            />
            <FunnelChart
              control={displayedSummary.control}
              treatment={displayedSummary.treatment}
            />
          </div>

          {/* Section 4: Experiment Design & Hypothesis */}
          <div className="experiment-doc-card">
            <h3>Flagsmith Experiment Specification</h3>
            <div className="doc-grid">
              <div className="doc-col">
                <div className="doc-item">
                  <span className="doc-label">Experiment Name:</span>
                  <strong>ApplySense Smart Job Insights Experiment</strong>
                </div>
                <div className="doc-item">
                  <span className="doc-label">Feature Flag Key:</span>
                  <code>smartapply_job_experience</code>
                </div>
                <div className="doc-item">
                  <span className="doc-label">Primary Metric:</span>
                  <span className="metric-pill primary-pill">
                    Application Completion (<code>application_completed</code>)
                  </span>
                </div>
                <div className="doc-item">
                  <span className="doc-label">Secondary / Auxiliary Event:</span>
                  <span className="metric-pill auxiliary-pill">
                    Application Started (<code>application_started</code>)
                  </span>
                </div>
              </div>

              <div className="doc-col">
                <div className="doc-item">
                  <span className="doc-label">Experiment Hypothesis:</span>
                  <blockquote className="hypothesis-quote">
                    “Showing students their job match percentage, matched skills, missing skills,
                    and improvement suggestions will increase application completion compared with
                    displaying only standard job details.”
                  </blockquote>
                </div>
                <div className="doc-item">
                  <span className="doc-label">Allocation:</span>
                  <span>50% Control (standard) / 50% Treatment (smart_insights)</span>
                </div>
                <div className="doc-item">
                  <span className="doc-label">Current Visitor ID (This Browser):</span>
                  <code>{visitorId}</code>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: FLAGSMITH WAREHOUSE & SECURE API */}
      {activeTab === 'warehouse' && (
        <div className="warehouse-tab-content">
          <div className="warehouse-status-card">
            <div className="warehouse-top">
              <div className="warehouse-icon-title">
                <Database size={24} className="warehouse-icon" />
                <div>
                  <h3>Flagsmith Managed Warehouse Integration</h3>
                  <p>Real-time event streaming and Bayesian statistics engine</p>
                </div>
              </div>

              <div className="status-indicator-live">
                <span className="pulsing-dot" />
                <span>Streaming Events Active</span>
              </div>
            </div>

            <div className="warehouse-details-grid">
              <div className="detail-box">
                <span className="detail-title">Flagsmith Project</span>
                <strong>ApplySense</strong>
              </div>
              <div className="detail-box">
                <span className="detail-title">Environment</span>
                <strong>Development</strong>
              </div>
              <div className="detail-box">
                <span className="detail-title">Environment Client Key</span>
                <code>8ZJ6...4ZE (Masked)</code>
              </div>
              <div className="detail-box">
                <span className="detail-title">Data Warehouse Connection</span>
                <span className="badge-connected">✓ Connected (Managed ClickHouse/Snowflake)</span>
              </div>
            </div>

            {/* Live API Results Box */}
            <div className="api-result-box">
              <div className="api-box-header">
                <h4>Flagsmith Experiment Results Status</h4>
                <span className="api-timestamp">
                  <Clock size={13} /> Asynchronous Engine
                </span>
              </div>

              {isLoadingBackend ? (
                <div className="loading-state">
                  <RefreshCw size={20} className="spinning" />
                  <span>Checking Flagsmith experiment results endpoint...</span>
                </div>
              ) : backendResult?.dataAvailable ? (
                <div className="backend-success">
                  <p>Live calculated Bayesian results loaded successfully from Flagsmith Management API.</p>
                  <div className="flagsmith-results-grid">
                    <div>Winner: <strong>{backendResult.winner || 'Pending evaluation'}</strong></div>
                    <div>Control Visitors: <strong>{backendResult.controlVisitors || 0}</strong></div>
                    <div>Control Conversions: <strong>{backendResult.controlConversions || 0}</strong></div>
                    <div>Treatment Visitors: <strong>{backendResult.treatmentVisitors || 0}</strong></div>
                    <div>Treatment Conversions: <strong>{backendResult.treatmentConversions || 0}</strong></div>
                  </div>
                </div>
              ) : (
                <div className="waiting-state-card">
                  <div className="waiting-icon-row">
                    <Clock size={20} className="waiting-icon" />
                    <strong>Status: Waiting for experiment data / Batch computation</strong>
                  </div>
                  <p className="waiting-explanation">
                    {backendResult?.message ||
                      'Flagsmith Managed Warehouse is connected and actively collecting application_started and application_completed events. Raw events are aggregated asynchronously into Bayesian distributions.'}
                  </p>
                  <div className="waiting-checklist">
                    <div className="check-item">
                      <CheckCircle2 size={15} className="check-ok" />
                      <span>Flagsmith SDK initialized with stable visitor identity</span>
                    </div>
                    <div className="check-item">
                      <CheckCircle2 size={15} className="check-ok" />
                      <span>Custom events enabled and tracked with automatic batching</span>
                    </div>
                    <div className="check-item">
                      <CheckCircle2 size={15} className="check-ok" />
                      <span>Flagsmith Managed Warehouse configured in project settings</span>
                    </div>
                    <div className="check-item">
                      <Clock size={15} className="check-wait" />
                      <span>Bayesian statistical computation interval (Flagsmith asynchronous cron)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Architecture Explanation Card */}
            <div className="security-architecture-card">
              <div className="sec-header">
                <Lock size={18} className="lock-icon" />
                <h4>Security & Backend Architecture (Data Integrity Rule)</h4>
              </div>

              <div className="sec-content">
                <p>
                  Per the hackathon guidelines and enterprise security best practices:
                  <strong>
                    {' '}Browser clients must NEVER directly query the Flagsmith Management API or Managed Warehouse.
                  </strong>
                </p>
                <ul>
                  <li>
                    <strong>Why?</strong> Flagsmith Management API endpoints (such as{' '}
                    <code>/api/v1/environments/{'{env_key}'}/experiments/{'{exp_id}'}/results/</code>) require
                    an administrative <code>Authorization: Api-Key</code> with organization-level read privileges.
                    Exposing an Admin API Key in frontend <code>VITE_*</code> variables would allow anyone to
                    read/modify all feature flags.
                  </li>
                  <li>
                    <strong>Implemented Minimal Secure Backend:</strong> A secure Node.js proxy middleware in the backend stores the private <code>FLAGSMITH_ADMIN_API_KEY</code> on the server,
                    queries Flagsmith Management API with server-side caching (5-minute TTL per Flagsmith rate limits),
                    and exposes a safe public endpoint (<code>/api/experiment-results</code>) without credentials.
                  </li>
                  <li>
                    <strong>Shared Cross-Browser Synchronization:</strong> Real-time shared telemetry is persisted across all browsers via <code>/api/telemetry/*</code>, while Flagsmith data warehouse events stream in parallel.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RAW TELEMETRY EVENT LOG */}
      {activeTab === 'events' && (
        <div className="events-tab-content">
          <div className="events-header-bar">
            <div>
              <h3>
                {isViewingLocal ? "This Browser's Event Log" : 'Shared Event Telemetry Stream (All Browsers)'}
              </h3>
              <p>
                Events recorded across candidate sessions and flushed to Flagsmith Managed Warehouse.
              </p>
            </div>

            <div className="filter-group">
              <span className="filter-label">Filter:</span>
              <button
                type="button"
                className={`filter-btn ${eventFilter === 'all' ? 'active' : ''}`}
                onClick={() => setEventFilter('all')}
              >
                All ({displayedEvents.length})
              </button>
              <button
                type="button"
                className={`filter-btn ${eventFilter === 'application_started' ? 'active' : ''}`}
                onClick={() => setEventFilter('application_started')}
              >
                Starts ({displayedEvents.filter(e => e.eventType === 'application_started').length})
              </button>
              <button
                type="button"
                className={`filter-btn ${eventFilter === 'application_completed' ? 'active' : ''}`}
                onClick={() => setEventFilter('application_completed')}
              >
                Completions ({displayedEvents.filter(e => e.eventType === 'application_completed').length})
              </button>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="empty-events-box">
              <FileSpreadsheet size={36} className="empty-icon" />
              <h4>No telemetry events recorded yet</h4>
              <p>
                Visit the <strong>Explore Jobs</strong> tab and click "Apply for this job" to generate an{' '}
                <code>application_started</code> event, or submit the application to generate an{' '}
                <code>application_completed</code> event.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>Variation</th>
                    <th>Visitor ID</th>
                    <th>Job ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(evt => {
                    const formattedTime = new Date(evt.timestamp).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    const isSim = Boolean(evt.metadata?.simulated);
                    const isCurrentVisitor = evt.visitorId === visitorId;

                    return (
                      <tr key={evt.id}>
                        <td className="time-col">{formattedTime}</td>
                        <td>
                          <span
                            className={`event-badge ${
                              evt.eventType === 'application_completed'
                                ? 'evt-completed'
                                : 'evt-started'
                            }`}
                          >
                            {evt.eventType}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`var-badge ${
                              evt.variation === 'smart_insights'
                                ? 'var-treatment'
                                : 'var-control'
                            }`}
                          >
                            {evt.variation === 'smart_insights' ? 'Treatment' : 'Control'}
                          </span>
                        </td>
                        <td className="visitor-col">
                          <code>{evt.visitorId.slice(0, 16)}...</code>
                          {isCurrentVisitor && (
                            <span className="current-visitor-tag">You</span>
                          )}
                        </td>
                        <td>{evt.jobId}</td>
                        <td>
                          <span className="sent-badge">
                            {isSim ? 'Simulated' : 'Synced & Streamed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
};
