import React, { useState } from 'react';
import type { CandidateProfile } from '../types/job';
import { mockJobs, defaultCandidateProfile } from '../data/mockJobs';
import { JobCard } from '../components/JobCard';
import { User, Sparkles, ShieldCheck } from 'lucide-react';

interface JobListingPageProps {
  isTreatment: boolean;
  onApplicationSuccess?: () => void;
}

export const JobListingPage: React.FC<JobListingPageProps> = ({
  isTreatment,
  onApplicationSuccess,
}) => {
  const [candidateProfile, setCandidateProfile] =
    useState<CandidateProfile>(defaultCandidateProfile);
  const [selectedJobId, setSelectedJobId] = useState<string>('JOB-001');

  const selectedJob =
    mockJobs.find(j => j.id === selectedJobId) || mockJobs[0];

  const handleCandidateSkillsChange = (newSkills: string[]) => {
    setCandidateProfile(prev => ({
      ...prev,
      skills: newSkills,
    }));
  };

  return (
    <main className="container">
      {/* Welcome Hero */}
      <section className="welcome">
        <p className="eyebrow">WE MAKE DEVS × FLAGSMITH TOGGLE WARS</p>
        <h1>Find jobs that match your true potential.</h1>
        <p>
          Discover tech opportunities and understand how your real skills fit before applying.
        </p>
      </section>

      {/* Candidate Profile Strip */}
      <div className="candidate-strip">
        <div className="candidate-info">
          <div className="candidate-avatar">
            <User size={18} />
          </div>
          <div>
            <div className="candidate-name-row">
              <h3>{candidateProfile.name}</h3>
              <span className="profile-badge">Candidate Profile</span>
            </div>
            <p className="candidate-edu">{candidateProfile.education}</p>
          </div>
        </div>

        <div className="candidate-skills-summary">
          <span className="skills-summary-label">Profile Skills:</span>
          <div className="skills-tags">
            {candidateProfile.skills.map(skill => (
              <span key={skill} className="skill-chip">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Experience Notice Banner */}
      <div className={`experiment-banner ${isTreatment ? 'treatment-banner' : 'control-banner'}`}>
        <div className="banner-icon">
          {isTreatment ? <Sparkles size={18} /> : <ShieldCheck size={18} />}
        </div>
        <div className="banner-content">
          <strong>
            {isTreatment
              ? 'Smart Insights Experience Active: FitLens Skill Insights'
              : 'Standard Experience Active: Standard Job Details'}
          </strong>
          <p>
            {isTreatment
              ? 'Personalized skill match percentage, matched skills, missing skills, and improvement suggestions are dynamically calculated below.'
              : 'Displaying standard job details, required skills, eligibility criteria, and salary without FitLens analytics.'}
          </p>
        </div>
      </div>

      {/* Job Selection Tabs */}
      <div className="job-selection-bar">
        <div className="job-selection-header">
          <div>
            <h2>Featured Opportunities</h2>
            <p>Select a job to view experience variation</p>
          </div>
          <span className="job-count">{mockJobs.length} opportunities</span>
        </div>

        <div className="job-tabs">
          {mockJobs.map(job => (
            <button
              key={job.id}
              type="button"
              className={`job-tab ${job.id === selectedJobId ? 'active' : ''}`}
              onClick={() => setSelectedJobId(job.id)}
            >
              <span className="tab-title">{job.title}</span>
              <span className="tab-company">{job.company}</span>
              {job.id === 'JOB-001' && (
                <span className="primary-pill">Hackathon Demo</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Active Job Card */}
      <JobCard
        job={selectedJob}
        isTreatment={isTreatment}
        candidateSkills={candidateProfile.skills}
        onCandidateSkillsChange={handleCandidateSkillsChange}
        onApplicationSuccess={onApplicationSuccess}
      />

      {/* Experiment Footer Note */}
      <footer className="experiment-footer-note">
        <p>
          Flagsmith Experiment: <code>smartapply_job_experience</code> | Active Variation:{' '}
          <strong>{isTreatment ? 'smart_insights' : 'control'}</strong> | Allocation: 50% / 50%
        </p>
      </footer>
    </main>
  );
};
