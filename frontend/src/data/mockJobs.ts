import type { Job, CandidateProfile } from '../types/job';

export const defaultCandidateProfile: CandidateProfile = {
  id: 'cand_priya_01',
  name: 'Priya Sharma',
  email: 'priya.sharma@example.com',
  education: 'B.Tech in Computer Science & Engineering (Final Year, 2025)',
  skills: ['React', 'Node.js', 'JavaScript', 'SQL'],
};

export const availableSkillsList: string[] = [
  'React',
  'Node.js',
  'JavaScript',
  'TypeScript',
  'SQL',
  'Git',
  'PostgreSQL',
  'Docker',
  'AWS',
  'CSS',
  'Redux',
  'GraphQL',
  'MongoDB',
  'Python',
  'REST APIs',
];

export const mockJobs: Job[] = [
  {
    id: 'JOB-001',
    title: 'Junior Full Stack Developer',
    company: 'TechNova Solutions',
    location: 'Ahmedabad, India (Hybrid)',
    salary: '₹3–5 LPA',
    eligibility: 'B.Tech / BE / BCA / MCA (2024–2026 Batch) or 0–1 year software dev experience',
    experienceLevel: 'Entry-Level / Fresher',
    type: 'Full-time',
    department: 'Engineering',
    skills: ['React', 'Node.js', 'JavaScript', 'SQL', 'Git'],
    description:
      'We are looking for an enthusiastic junior developer to build modern web applications using React and Node.js. You will collaborate with senior engineers to design and maintain scalable software solutions, implement responsive UIs, and integrate RESTful APIs.',
    responsibilities: [
      'Build responsive, accessible user interfaces using React and modern CSS.',
      'Develop robust REST API endpoints with Node.js and SQL database models.',
      'Write clean, maintainable code following team standards and version control workflows.',
      'Participate in sprint planning, agile standups, and peer code reviews.',
    ],
  },
  {
    id: 'JOB-002',
    title: 'Frontend React Engineer',
    company: 'PulseTech Labs',
    location: 'Bengaluru, India (Remote)',
    salary: '₹5–7 LPA',
    eligibility: 'Bachelor’s degree in CS/IT or equivalent experience with frontend technologies',
    experienceLevel: '1–2 years experience',
    type: 'Full-time',
    department: 'Product Design & Web',
    skills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'Redux'],
    description:
      'Join our product engineering team building high-performance customer-facing SaaS dashboards. You will implement stateful React components, design system elements, and maintain TypeScript type safety across the web frontend.',
    responsibilities: [
      'Develop scalable React web applications with TypeScript and modern state management.',
      'Optimize web performance, Core Web Vitals, and responsive UI interactions.',
      'Collaborate with UI/UX designers to translate Figma prototypes into pixel-perfect components.',
    ],
  },
  {
    id: 'JOB-003',
    title: 'Backend API Engineer',
    company: 'CloudScale Systems',
    location: 'Pune, India (Hybrid)',
    salary: '₹6–9 LPA',
    eligibility: 'Degree in Engineering or Computer Applications; strong grasp of server-side architecture',
    experienceLevel: '1–3 years experience',
    type: 'Full-time',
    department: 'Cloud Infrastructure',
    skills: ['Node.js', 'PostgreSQL', 'Docker', 'AWS', 'REST APIs'],
    description:
      'Seeking a backend engineer to design microservices and data processing pipelines. You will optimize database queries, deploy containerized services on cloud infrastructure, and ensure high availability.',
    responsibilities: [
      'Design, implement, and maintain low-latency RESTful microservices.',
      'Architect relational schemas, indices, and transactions with PostgreSQL.',
      'Containerize applications with Docker and participate in CI/CD cloud deployments.',
    ],
  },
];

export function calculateSkillFit(jobSkills: string[], candidateSkills: string[]) {
  const normalizedCandidate = candidateSkills.map(s => s.trim().toLowerCase());
  
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of jobSkills) {
    if (normalizedCandidate.includes(skill.trim().toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const matchPercentage =
    jobSkills.length > 0 ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 0;

  let suggestion: string;
  if (missingSkills.length === 0) {
    suggestion = 'All listed job skills match your profile.';
  } else if (missingSkills.length === 1) {
    suggestion = `Build and document experience with ${missingSkills[0]} to address the remaining listed skill gap.`;
  } else {
    suggestion = `To address the listed gaps, consider building projects that demonstrate ${missingSkills.slice(0, 2).join(' and ')}.`;
  }

  return {
    matchPercentage,
    matchedSkills,
    missingSkills,
    suggestion,
  };
}
