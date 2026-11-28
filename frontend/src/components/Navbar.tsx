import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Briefcase,
  BarChart3,
  FileText,
  Sparkles,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { getVisitorId, resetVisitorId } from '../services/flagsmith';

interface NavbarProps {
  isTreatment: boolean;
  applicationCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ isTreatment, applicationCount = 0 }) => {
  const [visitorId, setVisitorId] = useState<string>(() => getVisitorId());
  const [showIdentityModal, setShowIdentityModal] = useState<boolean>(false);

  const handleResetIdentity = async () => {
    const newId = await resetVisitorId();
    setVisitorId(newId);
    setShowIdentityModal(false);
    // Reload page to re-initialize Flagsmith SDK with new identity
    window.location.reload();
  };

  return (
    <>
      <header className="navbar">
        <Link to="/" className="brand-link">
          <div className="brand">
            Apply<span>Sense</span>
          </div>
          <span className="brand-tag">Toggle Wars</span>
        </Link>

        <nav className="nav-links" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Briefcase size={16} />
            <span>Explore Jobs</span>
          </NavLink>

          <NavLink
            to="/analytics"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <BarChart3 size={16} />
            <span>Analytics Dashboard</span>
            <span className="live-pill">Live Experiment</span>
          </NavLink>

          <NavLink
            to="/applications"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <FileText size={16} />
            <span>My Applications</span>
            {applicationCount > 0 && (
              <span className="counter-pill">{applicationCount}</span>
            )}
          </NavLink>
        </nav>

        <div className="nav-right">
          <button
            type="button"
            className={`variation-pill ${isTreatment ? 'treatment-pill' : 'control-pill'}`}
            onClick={() => setShowIdentityModal(true)}
            title="Click to view Flagsmith visitor identity details or re-allocate variation"
          >
            {isTreatment ? (
              <>
                <Sparkles size={14} />
                <span>Treatment (Smart Insights)</span>
              </>
            ) : (
              <>
                <span className="dot-indicator" />
                <span>Control (Standard)</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="avatar-btn"
            onClick={() => setShowIdentityModal(true)}
            title={`Active Visitor: ${visitorId}`}
          >
            P
          </button>
        </div>
      </header>

      {/* Visitor Identity & Variation Info Modal for Hackathon Evaluators */}
      {showIdentityModal && (
        <div className="modal-backdrop" onClick={() => setShowIdentityModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Flagsmith Identity & Experiment Allocation</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowIdentityModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-item">
                <span className="modal-label">Feature Flag:</span>
                <code>smartapply_job_experience</code>
              </div>
              <div className="modal-item">
                <span className="modal-label">Assigned Variation:</span>
                <span className={`status-tag ${isTreatment ? 'tag-treatment' : 'tag-control'}`}>
                  {isTreatment ? 'smart_insights (Treatment Group)' : 'control (Control Group)'}
                </span>
              </div>
              <div className="modal-item">
                <span className="modal-label">Stable Visitor ID:</span>
                <code>{visitorId}</code>
              </div>
              <div className="modal-item">
                <span className="modal-label">Allocation Strategy:</span>
                <span>Flagsmith 50% Control / 50% Treatment based on Visitor ID hash</span>
              </div>

              <div className="modal-helper">
                <HelpCircle size={16} />
                <p>
                  Flagsmith maintains consistent variation stickiness using this stable visitor identity.
                  To test the other experiment bucket as a new candidate, you can reset your visitor ID.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="reset-identity-btn"
                  onClick={handleResetIdentity}
                >
                  <RefreshCw size={14} />
                  Reset Identity & Re-allocate (50/50)
                </button>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowIdentityModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
