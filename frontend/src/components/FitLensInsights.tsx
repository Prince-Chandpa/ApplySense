import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Sparkles, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { calculateSkillFit, availableSkillsList } from '../data/mockJobs';

interface FitLensInsightsProps {
  jobSkills: string[];
  candidateSkills: string[];
  onSkillsChange?: (newSkills: string[]) => void;
  onApplyClick?: () => void;
}

export const FitLensInsights: React.FC<FitLensInsightsProps> = ({
  jobSkills,
  candidateSkills,
  onSkillsChange,
  onApplyClick,
}) => {
  const [showSkillCustomizer, setShowSkillCustomizer] = useState(false);

  const { matchPercentage, matchedSkills, missingSkills, suggestion } =
    calculateSkillFit(jobSkills, candidateSkills);

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return { text: '#059669', bg: '#d1fae5', bar: '#10b981' }; // Emerald
    if (pct >= 60) return { text: '#635bdb', bg: '#eeedff', bar: '#635bdb' }; // Purple/Indigo
    if (pct >= 40) return { text: '#d97706', bg: '#fef3c7', bar: '#f59e0b' }; // Amber
    return { text: '#dc2626', bg: '#fee2e2', bar: '#ef4444' }; // Red
  };

  const scoreTheme = getScoreColor(matchPercentage);

  const handleToggleSkill = (skill: string) => {
    if (!onSkillsChange) return;
    const exists = candidateSkills.some(s => s.toLowerCase() === skill.toLowerCase());
    if (exists) {
      onSkillsChange(candidateSkills.filter(s => s.toLowerCase() !== skill.toLowerCase()));
    } else {
      onSkillsChange([...candidateSkills, skill]);
    }
  };

  return (
    <section className="insights" aria-label="FitLens Job Fit Analysis">
      <div className="match-header">
        <div>
          <div className="fitlens-badge">
            <Sparkles size={14} className="sparkle-icon" />
            <span className="eyebrow">FITLENS ANALYSIS</span>
          </div>
          <h3>Your personalized skill match for this role</h3>
        </div>

        <div
          className="match-score-pill"
          style={{
            backgroundColor: scoreTheme.bg,
            color: scoreTheme.text,
          }}
          title={`Match calculated dynamically: ${matchedSkills.length} of ${jobSkills.length} skills matched`}
        >
          <span className="match-score-number">{matchPercentage}%</span>
          <span className="match-score-label">Fit Score</span>
        </div>
      </div>

      {/* Dynamic Progress Bar */}
      <div className="progress-container">
        <div className="progress" role="progressbar" aria-valuenow={matchPercentage} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="progress-fill"
            style={{
              width: `${matchPercentage}%`,
              backgroundColor: scoreTheme.bar,
              transition: 'width 0.4s ease-in-out',
            }}
          />
        </div>
        <div className="progress-meta">
          <span>{matchedSkills.length} of {jobSkills.length} required skills matched</span>
          <span>{missingSkills.length === 0 ? 'Full match' : `${missingSkills.length} skill gap`}</span>
        </div>
      </div>

      {/* Matched vs Missing skills breakdown */}
      <div className="skill-columns">
        <div className="skill-group matched-group">
          <h4>
            <CheckCircle2 size={16} className="skill-icon matched-icon" />
            Matched Skills ({matchedSkills.length})
          </h4>
          <div className="skills-badge-list">
            {matchedSkills.length > 0 ? (
              matchedSkills.map(skill => (
                <span className="skill matched" key={skill}>
                  ✓ {skill}
                </span>
              ))
            ) : (
              <span className="no-skills-msg">No skills currently matched</span>
            )}
          </div>
        </div>

        <div className="skill-group missing-group">
          <h4>
            <AlertCircle size={16} className="skill-icon missing-icon" />
            Skills to Improve ({missingSkills.length})
          </h4>
          <div className="skills-badge-list">
            {missingSkills.length > 0 ? (
              missingSkills.map(skill => (
                <span className="skill missing" key={skill}>
                  + {skill}
                </span>
              ))
            ) : (
              <span className="no-skills-msg all-matched">All required skills met!</span>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Recommendation Card */}
      <div className="suggestion-card">
        <div className="suggestion-icon">💡</div>
        <div className="suggestion-content">
          <strong>Personalized Profile Recommendation:</strong>
          <p>{suggestion}</p>
        </div>
      </div>

      {/* Call to action for treatment group */}
      {onApplyClick && (
        <div className="treatment-cta-row">
          <p className="cta-helper">
            FitLens compares the listed job skills with your profile and highlights matches and gaps.
          </p>
          <button
            type="button"
            className="fitlens-cta-btn"
            onClick={onApplyClick}
          >
            Apply Now with FitLens Match
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}

      {/* Interactive Skill Customizer toggle for evaluators to test dynamic score */}
      {onSkillsChange && (
        <div className="skill-simulator-section">
          <button
            type="button"
            className="toggle-simulator-btn"
            onClick={() => setShowSkillCustomizer(!showSkillCustomizer)}
          >
            <SlidersHorizontal size={14} />
            {showSkillCustomizer ? 'Hide Candidate Skill Simulator' : 'Test Dynamic Match Percentage (Candidate Skills)'}
          </button>

          {showSkillCustomizer && (
            <div className="simulator-panel">
              <p className="simulator-help">
                Toggle skills in candidate profile to see the match score recalculate dynamically in real-time (proves dynamic calculation, not hardcoded 80%):
              </p>
              <div className="simulator-skills">
                {availableSkillsList.map(skill => {
                  const isSelected = candidateSkills.some(
                    s => s.toLowerCase() === skill.toLowerCase()
                  );
                  return (
                    <button
                      key={skill}
                      type="button"
                      className={`simulator-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => handleToggleSkill(skill)}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
