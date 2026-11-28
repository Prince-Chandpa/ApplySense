import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ApplicationRecord } from '../types/job';
import {
  fetchSharedApplications,
  clearVisitorApplications,
} from '../services/analyticsStorage';
import { getVisitorId } from '../services/flagsmith';
import {
  FileText,
  Building,
  Calendar,
  Sparkles,
  ShieldCheck,
  Trash2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  User,
  CheckCircle,
} from 'lucide-react';

export const ApplicationsPage: React.FC = () => {
  const visitorId = getVisitorId();

  const [applications, setApplications] = useState<ApplicationRecord[]>(() => {
    try {
      const raw = localStorage.getItem('appliesense_applications');
      const list: ApplicationRecord[] = raw ? JSON.parse(raw) : [];
      return list.filter(app => app.visitorId === visitorId);
    } catch {
      return [];
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const list = await fetchSharedApplications(visitorId);
      setApplications(list);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchSharedApplications(visitorId).then(list => {
      if (isMounted) setApplications(list);
    });

    const interval = setInterval(() => {
      fetchSharedApplications(visitorId).then(list => {
        if (isMounted) setApplications(list);
      });
    }, 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [visitorId]);

  const handleClearApplications = async () => {
    if (window.confirm('Clear all demo applications submitted from this browser?')) {
      setErrorMessage(null);
      try {
        await clearVisitorApplications(visitorId);
        setApplications([]);
      } catch {
        setErrorMessage('Could not clear applications. Please try again.');
      }
    }
  };

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <p className="eyebrow">BROWSER-SPECIFIC APPLICATIONS</p>
          <h1>My Applications</h1>
          <p>
            Demo applications submitted from this browser session. Applications are private to each browser.
          </p>
          <div className="visitor-meta-badge" style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: '16px', fontWeight: 500 }}>
            <User size={13} />
            <span>Visitor ID: <strong>{visitorId}</strong></span>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="action-btn icon-btn"
            onClick={handleManualRefresh}
            title="Refresh my applications"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
          </button>
          {applications.length > 0 && (
            <button
              type="button"
              className="clear-records-btn"
              onClick={handleClearApplications}
            >
              <Trash2 size={15} />
              Clear My Applications
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="form-error" role="alert">
          {errorMessage}
        </div>
      )}

      {applications.length === 0 ? (
        <div className="empty-state-card">
          <FileText size={48} className="empty-icon" />
          <h3>No applications submitted yet</h3>
          <p>
            You have not submitted any applications from this browser (Visitor ID: <code>{visitorId}</code>).
            Apply for an opportunity on the jobs page to see your application recorded here.
          </p>
          <Link to="/" className="empty-action-btn">
            Explore Open Jobs
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="applications-list">
          {applications.map(app => {
            const formattedDate = new Date(app.submittedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div key={app.id} className="application-card">
                <div className="app-card-header">
                  <div className="app-title-group">
                    <h3>{app.jobTitle}</h3>
                    <div className="app-company-row">
                      <Building size={14} />
                      <span>{app.company}</span>
                      <span className="app-id-badge">{app.id}</span>
                    </div>
                  </div>

                  <span
                    className={`variation-tag ${
                      app.variation === 'smart_insights' ? 'tag-treatment' : 'tag-control'
                    }`}
                  >
                    {app.variation === 'smart_insights' ? (
                      <>
                        <Sparkles size={12} /> FitLens Treatment
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={12} /> Standard Control
                      </>
                    )}
                  </span>
                </div>

                <div className="app-card-details">
                  <div className="detail-item">
                    <span className="detail-label">Candidate Name:</span>
                    <strong>{app.name}</strong>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Candidate Email:</span>
                    <strong>{app.email}</strong>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Submitted:</span>
                    <span>
                      <Calendar size={13} className="inline-icon" /> {formattedDate}
                    </span>
                  </div>
                  {app.portfolioUrl && (
                    <div className="detail-item">
                      <span className="detail-label">Portfolio:</span>
                      <a
                        href={app.portfolioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="portfolio-link"
                      >
                        {app.portfolioUrl}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>

                <div className="app-status-bar">
                  <CheckCircle size={14} className="status-indicator-check" style={{ color: '#16a34a' }} />
                  <span>
                    Private to this browser • Bound to <code>{visitorId.slice(0, 16)}...</code> • Streamed to Flagsmith (<code>application_completed</code>)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};
