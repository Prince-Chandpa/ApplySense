export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  eligibility: string;
  experienceLevel: string;
  type: string;
  department: string;
  skills: string[];
  description: string;
  responsibilities: string[];
}

export interface CandidateProfile {
  id: string;
  name: string;
  email: string;
  education: string;
  skills: string[];
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  name: string;
  email: string;
  portfolioUrl?: string;
  submittedAt: string;
  variation: 'control' | 'smart_insights' | 'unknown';
  matchScore?: number;
  visitorId: string;
}
