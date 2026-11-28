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
            title="View this visitor identity and the displayed experience"
          >
            {isTreatment ? (
              <>
                <Sparkles size={14} />
                <span>Treatment (Smart Insights)</span>
              </>
            ) : (
              <>
                <span className="dot-indicator" />
                <span>Standard Experience</span>
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
              <h3>Visitor Identity & Flagsmith Experience</h3>
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
                <span className="modal-label">Displayed Experience:</span>
                <span className={`status-tag ${isTreatment ? 'tag-treatment' : 'tag-control'}`}>
                  {isTreatment ? 'Smart Insights' : 'Standard experience'}
                </span>
              </div>
              <div className="modal-item">
                <span className="modal-label">Stable Visitor ID:</span>
                <code>{visitorId}</code>
              </div>
              <div className="modal-item">
                <span className="modal-label">Assignment:</span>
                <span>Managed by Flagsmith; allocation percentages are not verified here.</span>
              </div>

              <div className="modal-helper">
                <HelpCircle size={16} />
                <p>
                  This visitor ID is passed to Flagsmith. Resetting it may produce a different
                  variation, depending on the Flagsmith environment configuration.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="reset-identity-btn"
                  onClick={handleResetIdentity}
                >
                  <RefreshCw size={14} />
                  Reset Visitor Identity
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
