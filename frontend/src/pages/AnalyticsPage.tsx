import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Sparkles,
  Info,
  RefreshCw,
  Database,
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
import { getVisitorId } from '../services/flagsmith';
import type {
  ExperimentSummary,
  ExperimentPerformance,
  TelemetryEvent,
} from '../types/analytics';
import { ConversionBarChart } from '../components/Charts/ConversionBarChart';
import { FunnelChart } from '../components/Charts/FunnelChart';
import { calculateExperimentPerformance } from '../services/experimentAnalytics';

export const AnalyticsPage: React.FC = () => {
  const [activeDataSource, setActiveDataSource] = useState<'shared' | 'local'>('shared');
  const [activeTab, setActiveTab] = useState<'experiment' | 'warehouse' | 'events'>('experiment');
  const [eventFilter, setEventFilter] = useState<
    'all' | 'experiment_exposed' | 'application_started' | 'application_completed'
  >('all');

  // Shared backend state
  const [sharedSummary, setSharedSummary] = useState<ExperimentSummary>(() => calculateExperimentStats([]));
  const [sharedEvents, setSharedEvents] = useState<TelemetryEvent[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dataSourceType, setDataSourceType] = useState<'shared_backend' | 'local_fallback'>('shared_backend');
  const [sharedPerformance, setSharedPerformance] = useState<ExperimentPerformance | null>(null);
  const [experimentError, setExperimentError] = useState<string | null>(null);
  const [isLoadingExperiment, setIsLoadingExperiment] = useState(true);

  // Local browser session state
  const [localEvents, setLocalEvents] = useState<TelemetryEvent[]>(() => getStoredEvents());
  const [localSummary, setLocalSummary] = useState<ExperimentSummary>(() =>
    calculateExperimentStats(getStoredEvents())
  );

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
      setSharedPerformance(res.experiment);
      setExperimentError(res.experimentError || null);
      setIsLoadingExperiment(false);

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
        setSharedPerformance(res.experiment);
        setExperimentError(res.experimentError || null);
        setIsLoadingExperiment(false);
      }
    });

    const interval = setInterval(() => {
      fetchSharedAnalytics().then(res => {
        if (isMounted) {
          setSharedSummary(res.summary);
          setSharedEvents(res.events);
          setLastSyncedAt(res.lastSyncedAt);
          setDataSourceType(res.source);
          setSharedPerformance(res.experiment);
          setExperimentError(res.experimentError || null);
          setIsLoadingExperiment(false);
        }
      });
    }, 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSimulateCohort = async () => {
    setIsRefreshing(true);
    try {
      const res = await simulateSharedCohort();
      setSharedSummary(res.summary);
      setSharedEvents(res.events);
      setLastSyncedAt(res.lastSyncedAt);
      setDataSourceType(res.source);
      setSharedPerformance(res.experiment);
      setExperimentError(res.experimentError || null);
      if (res.source === 'local_fallback') {
        setActiveDataSource('local');
        setLocalEvents(res.events);
        setLocalSummary(res.summary);
      }
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
  const displayedPerformance = isViewingLocal
    ? calculateExperimentPerformance(localEvents)
    : sharedPerformance;
  const hasExperimentData = displayedPerformance?.status === 'collecting_data';
  const conversionDifference = displayedPerformance?.conversionDifference ?? null;

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
              title="Populates 100 simulated visitors and application events across all browsers"
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
            <strong>Benchmark Demonstration Cohort Loaded:</strong> 100 simulated visitors
            (50 Control / 50 Treatment) are loaded into shared telemetry to illustrate counts and conversion rates.
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
          Experiment Performance
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'warehouse' ? 'active' : ''}`}
          onClick={() => setActiveTab('warehouse')}
        >
          <Database size={15} />
          Shared Backend Telemetry
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

      {/* TAB 1: EXPERIMENT PERFORMANCE */}
      {activeTab === 'experiment' && (
        <>
          {!isViewingLocal && isLoadingExperiment ? (
            <div className="loading-state">
              <RefreshCw size={20} className="spinning" />
              <span>Loading shared experiment metrics...</span>
            </div>
          ) : !isViewingLocal && experimentError ? (
            <div className="waiting-state-card" role="alert">
              <strong>Shared analytics unavailable</strong>
              <p className="waiting-explanation">{experimentError}</p>
            </div>
          ) : !hasExperimentData || !displayedPerformance ? (
            <div className="waiting-state-card">
              <strong>No experiment exposure data yet</strong>
              <p className="waiting-explanation">
                Experiment performance appears after visitors receive a recorded variation.
              </p>
              {displayedPerformance && (
                <p>Last updated: {new Date(displayedPerformance.lastUpdated).toLocaleString()}</p>
              )}
            </div>
          ) : (
            <div className="api-result-box">
              <div className="api-box-header">
                <h4>ApplySense Experiment Performance</h4>
                <span className="api-timestamp">
                  <Database size={13} /> Data source:{' '}
                  {isViewingLocal || dataSourceType === 'local_fallback'
                    ? 'This Browser'
                    : 'ApplySense Shared Backend'}
                </span>
              </div>
              <div className="waiting-icon-row">
                <Clock size={16} className="waiting-icon" />
                <strong>Data collection in progress</strong>
                <span>Last updated: {new Date(displayedPerformance.lastUpdated).toLocaleString()}</span>
              </div>
              <div className="warehouse-details-grid">
                <div>Control visitors: <strong>{displayedPerformance.control.visitors}</strong></div>
                <div>Smart Insights visitors: <strong>{displayedPerformance.smart_insights.visitors}</strong></div>
                <div>Control completed applications: <strong>{displayedPerformance.control.applicationsCompleted}</strong></div>
                <div>Smart Insights completed applications: <strong>{displayedPerformance.smart_insights.applicationsCompleted}</strong></div>
                <div>
                  Control conversion rate:{' '}
                  <strong>
                    {displayedPerformance.control.conversionRate === null
                      ? 'Not available'
                      : `${displayedPerformance.control.conversionRate.toFixed(2)}%`}
                  </strong>
                </div>
                <div>
                  Smart Insights conversion rate:{' '}
                  <strong>
                    {displayedPerformance.smart_insights.conversionRate === null
                      ? 'Not available'
                      : `${displayedPerformance.smart_insights.conversionRate.toFixed(2)}%`}
                  </strong>
                </div>
                <div>
                  Conversion rate difference:{' '}
                  <strong>
                    {displayedPerformance.conversionDifference === null
                      ? 'Not available'
                      : `${displayedPerformance.conversionDifference > 0 ? '+' : ''}${displayedPerformance.conversionDifference.toFixed(2)} percentage points`}
                  </strong>
                </div>
                <div>Control application starts: <strong>{displayedPerformance.control.applicationsStarted}</strong></div>
                <div>Smart Insights application starts: <strong>{displayedPerformance.smart_insights.applicationsStarted}</strong></div>
              </div>
              {(displayedPerformance.control.visitors < 50 ||
                displayedPerformance.smart_insights.visitors < 50) && (
                <p className="waiting-explanation">
                  Early data — collect more visitors before drawing conclusions.
                </p>
              )}
            </div>
          )}

          {hasExperimentData && (
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
                <span className="metric-hint">Distinct application_started events</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap completions-bg">
                <Target size={20} className="completions-color" />
              </div>
              <div className="metric-content">
                <span className="metric-label">Visitors with Completed Applications</span>
                <strong className="metric-value">{displayedSummary.totalCompletions}</strong>
                <span className="metric-hint">Unique exposed visitors with a completion</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrap rate-bg">
                <TrendingUp size={20} className="rate-color" />
              </div>
              <div className="metric-content">
                <span className="metric-label">Overall Conversion Rate</span>
                <strong className="metric-value">
                  {displayedSummary.overallRate === null
                    ? 'Not available'
                    : `${displayedSummary.overallRate.toFixed(2)}%`}
                </strong>
                <span className="metric-hint">Unique completions / Exposed visitors</span>
              </div>
            </div>

            <div className="metric-card">
              <div
                className={`metric-icon-wrap ${conversionDifference !== null && conversionDifference >= 0
                  ? 'lift-pos-bg'
                  : 'lift-neg-bg'
                  }`}
              >
                <Sparkles
                  size={20}
                  className={
                    conversionDifference !== null && conversionDifference >= 0
                      ? 'lift-pos-color'
                      : 'lift-neg-color'
                  }
                />
              </div>
              <div className="metric-content">
                <span className="metric-label">Conversion Rate Difference</span>
                <strong
                  className={`metric-value ${conversionDifference !== null && conversionDifference >= 0
                    ? 'lift-pos-text'
                    : 'lift-neg-text'
                    }`}
                >
                  {conversionDifference === null
                    ? 'Not available'
                    : `${conversionDifference > 0 ? '+' : ''}${conversionDifference.toFixed(2)} pp`}
                </strong>
                <span className="metric-hint">Treatment rate minus control rate</span>
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
                  <span className="big-rate">
                    {displayedSummary.control.completionRate === null
                      ? 'Not available'
                      : `${displayedSummary.control.completionRate.toFixed(2)}%`}
                  </span>
                  <span className="rate-subtext">Conversion Rate</span>
                </div>

                <div className="variant-stats-list">
                  <div className="v-stat-row">
                    <span>Unique Exposed Visitors:</span>
                    <strong>{displayedSummary.control.uniqueUsersExposed}</strong>
                  </div>
                  <div className="v-stat-row">
                    <span>Visitors with Completed Applications:</span>
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
                  <span className="big-rate treat-rate">
                    {displayedSummary.treatment.completionRate === null
                      ? 'Not available'
                      : `${displayedSummary.treatment.completionRate.toFixed(2)}%`}
                  </span>
                  <span className="rate-subtext">Conversion Rate</span>
                </div>

                <div className="variant-stats-list">
                  <div className="v-stat-row">
                    <span>Unique Exposed Visitors:</span>
                    <strong>{displayedSummary.treatment.uniqueUsersExposed}</strong>
                  </div>
                  <div className="v-stat-row">
                    <span>Visitors with Completed Applications:</span>
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
        </>
      )}

      {/* TAB 2: SHARED BACKEND TELEMETRY */}
      {activeTab === 'warehouse' && (
        <div className="warehouse-tab-content">
          <div className="security-architecture-card">
            <div className="sec-header">
              <Database size={18} className="lock-icon" />
              <h4>Shared Analytics Data Source</h4>
            </div>
            <div className="sec-content">
              <p>
                Experiment performance is calculated from telemetry persisted by the ApplySense backend.
                Flagsmith remains responsible for feature-flag evaluation and variation assignment.
              </p>
              <ul>
                <li>Exposure events record each visitor's assigned variation.</li>
                <li>Application starts and completions are matched to the same visitor and variation.</li>
                <li>Analytics are shared across browsers through <code>/api/telemetry/analytics</code>.</li>
              </ul>
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
                Events recorded by the Flagsmith SDK and mirrored to shared ApplySense telemetry.
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
                className={`filter-btn ${eventFilter === 'experiment_exposed' ? 'active' : ''}`}
                onClick={() => setEventFilter('experiment_exposed')}
              >
                Exposures ({displayedEvents.filter(e => e.eventType === 'experiment_exposed').length})
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
                Visit the <strong>Explore Jobs</strong> tab to record an exposure, click "Apply for this job"
                to generate an <code>application_started</code> event, or submit the application to generate
                an <code>application_completed</code> event.
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
                            className={`event-badge ${evt.eventType === 'application_completed'
                                ? 'evt-completed'
                                : evt.eventType === 'application_started'
                                  ? 'evt-started'
                                  : 'evt-started'
                              }`}
                          >
                            {evt.eventType}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`var-badge ${evt.variation === 'smart_insights'
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
