import React, { useState, useRef, type FormEvent } from 'react';
import {
  Briefcase,
  MapPin,
  Banknote,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
} from 'lucide-react';
import type { Job, ApplicationRecord } from '../types/job';
import { FitLensInsights } from './FitLensInsights';
import {
  trackApplicationStartedEvent,
  trackApplicationCompletedEvent,
  getVisitorId,
} from '../services/flagsmith';
import {
  recordSessionEvent,
  saveSharedApplication,
} from '../services/analyticsStorage';

interface JobCardProps {
  job: Job;
  isTreatment: boolean;
  candidateSkills: string[];
  onCandidateSkillsChange?: (newSkills: string[]) => void;
  onApplicationSuccess?: () => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isTreatment,
  candidateSkills,
  onCandidateSkillsChange,
  onApplicationSuccess,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ref to guarantee we avoid duplicate application_started events during the same attempt
  const hasTrackedAttemptStart = useRef<boolean>(false);

  const handleToggleForm = async () => {
    if (!showForm) {
      // User is opening the form - beginning an application attempt
      if (!hasTrackedAttemptStart.current) {
        hasTrackedAttemptStart.current = true;
        const variation = isTreatment ? 'smart_insights' : 'control';

        // 1. Track with Flagsmith SDK Managed Warehouse
        await trackApplicationStartedEvent();

        // 2. Track in shared backend & local telemetry
        await recordSessionEvent('application_started', variation, job.id);
      }
      setShowForm(true);
    } else {
      // Closing the form: keep hasTrackedAttemptStart.current true so reopening doesn't duplicate
      setShowForm(false);
    }
  };

  const handleApplicationSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form validation
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const variation: 'control' | 'smart_insights' = isTreatment ? 'smart_insights' : 'control';
      const visitorId = getVisitorId();
      const application: ApplicationRecord = {
        id: `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        name: name.trim(),
        email: email.trim(),
        portfolioUrl: portfolioUrl.trim() || undefined,
        submittedAt: new Date().toISOString(),
        variation,
        visitorId,
      };

      // 1. Save application to shared backend & localStorage bound to visitorId
      await saveSharedApplication(application);

      // 2. Track application_completed with Flagsmith SDK Managed Warehouse
      await trackApplicationCompletedEvent();

      // 3. Track application_completed in shared backend & local telemetry
      await recordSessionEvent('application_completed', variation, job.id, {
        applicationId: application.id,
      });

      // Reset attempt tracker after successful submission
      hasTrackedAttemptStart.current = false;
      setSubmitted(true);
      setShowForm(false);

      if (onApplicationSuccess) {
        onApplicationSuccess();
      }
    } catch (err) {
      console.error('Failed to save application or track completion:', err);
      setErrorMessage(
        'There was an error saving your application. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const companyInitials = job.company
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="job-card" id={`job-${job.id}`}>
      {/* Top Header */}
      <div className="job-top">
        <div className="company-logo" aria-hidden="true">
          {companyInitials}
        </div>
        <div className="job-title">
          <div className="job-header-row">
            <h2>{job.title}</h2>
            <div className="badge-row">
              <span className="job-tag">{job.type}</span>
              <span className="job-level-tag">{job.experienceLevel}</span>
            </div>
          </div>
          <p className="company-name">{job.company}</p>
        </div>
      </div>

      {/* Meta Grid: Location, Salary, Eligibility */}
      <div className="job-meta-grid">
        <div className="meta-item">
          <MapPin size={16} className="meta-icon" />
          <span>{job.location}</span>
        </div>
        <div className="meta-item">
          <Banknote size={16} className="meta-icon" />
          <span>Salary: <strong>{job.salary}</strong></span>
        </div>
        <div className="meta-item eligibility-item">
          <GraduationCap size={16} className="meta-icon" />
          <span>Eligibility: <strong>{job.eligibility}</strong></span>
        </div>
      </div>

      {/* Treatment Group: FitLens AI Analysis */}
      {isTreatment && (
        <FitLensInsights
          jobSkills={job.skills}
          candidateSkills={candidateSkills}
          onSkillsChange={onCandidateSkillsChange}
          onApplyClick={!showForm && !submitted ? handleToggleForm : undefined}
        />
      )}

      {/* Standard Job Description Section */}
      <div className="job-description">
        <h3>About this role</h3>
        <p>{job.description}</p>

        {job.responsibilities && job.responsibilities.length > 0 && (
          <div className="responsibilities-section">
            <h4>Key Responsibilities:</h4>
            <ul>
              {job.responsibilities.map((resp, idx) => (
                <li key={idx}>{resp}</li>
              ))}
            </ul>
          </div>
        )}

        <h3>Required skills</h3>
        <div className="skills">
          {job.skills.map(skill => (
            <span className="skill" key={skill}>
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Submission Success Notice */}
      {submitted ? (
        <div className="success" role="status">
          <CheckCircle2 size={20} className="success-icon" />
          <div>
            <strong>Application Submitted Successfully!</strong>
            <p>
              Your demo application for <strong>{job.title}</strong> at {job.company} has been recorded.
              You can view it on the <em>My Applications</em> tab.
            </p>
          </div>
        </div>
      ) : (
        <div className="action-row">
          <button
            className={`apply-button ${isTreatment ? 'treatment-apply' : 'standard-apply'}`}
            type="button"
            onClick={handleToggleForm}
            aria-expanded={showForm}
          >
            {showForm ? (
              <>
                <ChevronUp size={16} /> Close application form
              </>
            ) : (
              <>
                <Briefcase size={16} />
                {isTreatment ? 'Apply with FitLens Match' : 'Apply for this job'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Application Form */}
      {showForm && !submitted && (
        <form className="application-form" onSubmit={handleApplicationSubmit}>
          <div className="form-header">
            <h3>Complete your application</h3>
            <p>Demo candidate profile for {job.company}</p>
          </div>

          {errorMessage && (
            <div className="form-error" role="alert">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="form-field">
            <label htmlFor={`name-${job.id}`}>Full Name *</label>
            <input
              id={`name-${job.id}`}
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-field">
            <label htmlFor={`email-${job.id}`}>Email Address *</label>
            <input
              id={`email-${job.id}`}
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. priya.sharma@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-field">
            <label htmlFor={`portfolio-${job.id}`}>
              Portfolio / GitHub / LinkedIn URL (optional)
            </label>
            <input
              id={`portfolio-${job.id}`}
              type="url"
              value={portfolioUrl}
              onChange={e => setPortfolioUrl(e.target.value)}
              placeholder="https://github.com/username"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-actions">
            <button
              className={`apply-button submit-btn ${isTreatment ? 'treatment-apply' : 'standard-apply'}`}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Demo Application'}
            </button>
            <button
              className="cancel-btn"
              type="button"
              onClick={() => setShowForm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
};
