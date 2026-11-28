# ApplySense 🚀
> **AI-Driven Job Fit & Experiment-Powered Application Platform**
> Built for the **WeMakeDevs × Flagsmith Toggle Wars Hackathon**

ApplySense is a modern SaaS job discovery platform designed to solve student job search anxiety and drop-off by evaluating whether personalized job-fit insights (**FitLens**) increase application completion rates using **Flagsmith A/B Experimentation** and **Managed Data Warehouse**.

---

## 🎯 The Experiment

* **Experiment Name:** ApplySense Smart Job Insights Experiment
* **Hypothesis:**
  > *"Showing students their job match percentage, matched skills, missing skills, and improvement suggestions will increase application completion compared with displaying only standard job details."*
* **Feature Flag:** `smartapply_job_experience`
* **Allocation:** 50% Control (`control`) / 50% Treatment (`smart_insights`)
* **Primary Metric:** Application Completion (`application_completed`)
* **Secondary / Auxiliary Metric:** Application Started (`application_started`)
* **Data Warehouse:** Flagsmith Managed Warehouse (Streaming Events)

---

## 🔬 Experiences Demonstrated

### 1. Control Group (`variant: control`)
* **Standard Job Listing:** Job title, company badge, work arrangement, and department.
* **Role Overview:** In-depth job description and key day-to-day responsibilities.
* **Requirements:** List of required technical skills.
* **Eligibility & Compensation:** Clear eligibility criteria (e.g. batch/degree) and salary ranges.
* **Standard Apply Action:** Simple application form without personalized analytics.
* **No FitLens Insights:** No match percentage, no matched/missing skill split, and no recommendations.

### 2. Treatment Group (`variant: smart_insights`)
* **All Standard Details:** Retains all baseline job data, description, salary, and eligibility.
* **Dynamic FitLens AI Job-Fit Analysis:**
  * **Dynamic Match Score:** Dynamically calculated based on candidate skills and job requirements (e.g., $4/5 \times 100 = 80\%$, $5/5 = 100\%$, $2/5 = 40\%$). **Never hardcoded.**
  * **Dynamic Color Progress Bar:** Transitions across emerald (high match), indigo (moderate match), and amber (skill gaps).
  * **Matched Skills Breakdown:** Clear checkmark badges highlighting candidate strengths for the role.
  * **Skills to Improve / Gap Analysis:** Visual alert badges indicating missing skills.
  * **Personalized Recommendations:** Dynamic profile guidance tailored specifically to the missing skills.
  * **High-Confidence Call-to-Action:** Direct prompt encouraging candidate submission.
  * **Interactive Candidate Skill Simulator:** Allows evaluators to toggle candidate skills in real-time to witness the dynamic recalculation live.

---

## 📊 Analytics Dashboard (`/analytics`)

A dedicated SaaS analytics dashboard with high data integrity:

1. **Overview KPI Cards:**
   * Total Application Starts (Auxiliary)
   * Unique Visitors with Completed Applications (Primary)
   * Overall Conversion Rate
   * Treatment-Control Conversion Rate Difference
2. **Side-by-Side Variation Comparison:**
   * Conversion rate comparison (Primary Metric)
   * Denominator integrity: Unique visitors with a recorded experiment exposure
   * Numerator integrity: Unique candidates who successfully completed the application
   * Feature comparison table
3. **Interactive SVG Visualizations:**
   * Conversion Rate Bar Chart (Control vs Treatment)
   * Starts vs Completions Funnel Chart
4. **Shared Backend Experiment Performance:**
   * Control and Smart Insights exposures, starts, completions, and conversion rates.
   * Conversion-rate difference, data source, last update time, and early-data messaging.
5. **Telemetry Event Stream:**
   * Live, filterable shared event table for experiment exposures, `application_started`, and `application_completed`.
6. **Demonstration Controls:**
   * **Simulate 100-User Cohort:** Populates a clearly labeled benchmark dataset (50 Control / 50 Treatment) to illustrate event counts and rates.
   * **Reset Session Data:** Clears local session telemetry back to a clean state at any time.

---

## 🛡️ Data Integrity, Cross-Browser Synchronization & Security Architecture

1. **Shared Cross-Browser Data Synchronization:**
   To resolve browser isolation (where events previously remained trapped in a single browser's `localStorage`), ApplySense features a shared backend API (`/api/telemetry/*` and `/api/applications`) integrated into Vite's dev and preview servers.
   * When Browser A (Visitor A) submits an application, the event and application record are persisted on the shared backend.
   * When Browser B (Visitor B, with an independent Flagsmith visitor identity) opens the `/analytics` dashboard, the dashboard automatically synchronizes with the shared backend.
   * The dashboard includes automatic polling every 12 seconds, an on-demand manual refresh button, and displays the exact timestamp of the last successful synchronization.
2. **Clear Distinction of Data Scopes:**
   * **Flagsmith SDK:** Evaluates the feature flag and assigns each visitor a variation.
   * **Shared Global Telemetry (All Browsers):** Experiment metrics are calculated from exposure and application events persisted by the backend.
   * **Local Browser Session Telemetry:** Explicitly inspects only the active tab's visitor actions (`visitor_...`).
3. **No Frontend Secret Exposure:**
   Browser clients only communicate with Flagsmith using the public Client-side Environment API Key (`VITE_FLAGSMITH_ENVIRONMENT_KEY`). Flagsmith Admin API / Organization tokens are never exposed.
4. **Accurate Tracking & Duplicate Prevention:**
   * `application_started`: Fired once per application attempt. If a user closes and re-opens the form during the same attempt, no duplicate events are sent.
   * `application_completed`: Fired strictly after the application is saved and validated. Cancelled or failed attempts never trigger this event.
6. **Mobile Responsiveness Across All Viewports:**
   Fully responsive down to 320px viewport without any horizontal scrolling, with optimized typography, responsive SVG charts, touch-friendly tap targets ($\ge 44\text{px}$), and adaptive card grids. Tested across `320×640`, `375×812`, `390×844`, `768×1024`, and `1366×768`.

---

## 🛠️ Tech Stack

* **Frontend Framework:** React 19 (TypeScript)
* **Build Tool:** Vite 8 (Rolldown/ESNext)
* **Experimentation & Feature Flags:** `@flagsmith/flagsmith` & `@flagsmith/flagsmith/react` (v12.6.0)
* **Routing:** `react-router-dom` (v7)
* **Icons:** `lucide-react`
* **Styling:** Modular CSS with CSS Custom Properties (Zero bloated UI libraries for optimal performance on low-resource machines)

---

## 🚀 Running the Project

### Prerequisites
* Node.js 18+ (tested on Node.js 24)
* npm 9+

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Ensure `frontend/.env.local` contains your Flagsmith Environment Key:
```env
VITE_FLAGSMITH_ENVIRONMENT_KEY=YOUR_CLIENT_SIDE_KEY
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Build and Preview Production
```bash
npm run build
npm run preview
```

### 5. Run Lint and Typechecks
```bash
npm run lint
npm run build
```

---

## 📁 Project Structure

```
ApplySense/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Charts/
│   │   │   │   ├── ConversionBarChart.tsx    # Responsive SVG conversion rate chart
│   │   │   │   └── FunnelChart.tsx           # Responsive SVG funnel chart
│   │   │   ├── FitLensInsights.tsx           # Treatment-exclusive AI job-fit analysis
│   │   │   ├── JobCard.tsx                   # Job listing with Control/Treatment logic
│   │   │   └── Navbar.tsx                    # Header with brand, nav, variation modal
│   │   ├── data/
│   │   │   └── mockJobs.ts                   # Realistic job roles, candidate skills, fit calculator
│   │   ├── pages/
│   │   │   ├── AnalyticsPage.tsx             # Full analytics & experiment dashboard
│   │   │   ├── ApplicationsPage.tsx          # Submitted candidate applications view
│   │   │   └── JobListingPage.tsx            # Main job discovery page
│   │   ├── services/
│   │   │   ├── analyticsStorage.ts           # Statistical engine, local telemetry, cohort simulator
│   │   │   └── flagsmith.ts                  # Flagsmith SDK helpers, visitor ID, event trackers
│   │   ├── types/
│   │   │   ├── analytics.ts                  # Telemetry and experiment result interfaces
│   │   │   └── job.ts                        # Job, Candidate, Application types
│   │   ├── App.css                           # SaaS responsive design system
│   │   ├── App.tsx                           # Route configuration & variant resolution
│   │   ├── main.tsx                          # FlagsmithProvider root initialization
│   │   └── index.css                         # Global CSS resets
│   ├── .env.local                            # Flagsmith environment configuration
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```
