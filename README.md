# ApplySense

ApplySense is a hackathon demo of a job-search interface with a feature-flagged
job-insights experience and a shared telemetry dashboard. It is a prototype,
not a job board or an application service for real employers.

## What is implemented

- Three sample job listings and a static example candidate profile.
- FitLens skill comparisons and suggestions.
- A Flagsmith-controlled standard experience and Smart Insights experience.
- A job application form and a visitor-scoped **My Applications** page.
- Shared telemetry collection and an analytics dashboard.
- A simulation action for creating a synthetic cohort.

## FitLens

FitLens uses deterministic rules, not an AI/ML model. It trims and lowercases
skill names, matches exact strings, and calculates the match score as:

```text
round(number of matched job skills / total job skills * 100)
```

The suggested skill improvements are fixed conditional text based on the
missing skills. The simulator updates the example profile in the current page;
it does not train a model or retrieve real job or candidate data.

## Flagsmith experiment

The frontend initializes the Flagsmith SDK with
`VITE_FLAGSMITH_ENVIRONMENT_KEY` and the stable browser identity stored as
`appliesense_visitor_id`. The application reads the `smartapply_job_experience`
flag and recognizes the `control` and `smart_insights` variations. Flagsmith
evaluates the assignment; this repository does not contain the remote
experiment configuration.

The dashboard calls the experiment **ApplySense Smart Job Insights Experiment**.
That is the application’s label, not verification of the name configured in
Flagsmith. The effective allocation is remote and cannot be verified from this
repository. Confirm the environment’s actual configuration in Flagsmith before
interpreting results.

The app mirrors an `experiment_exposed` event to shared telemetry only when
Flagsmith reports the visitor is in the experiment with a recognized
variation. It also tracks `application_started` when the application flow is
opened and `application_completed` after the application is saved successfully.
Application events are sent to the Flagsmith SDK and mirrored to shared
telemetry; SDK delivery is not required for the local backend save to succeed.

The custom dashboard calculates descriptive results from shared telemetry:

- Exposures are unique visitors with a valid recorded variation.
- Completed applications are unique exposed visitors with a matching
  `application_completed` event.
- Conversion rate is completed visitors divided by exposed visitors.
- Application starts are distinct start events; the start rate uses unique
  visitors who started divided by exposed visitors.
- The conversion difference is the Smart Insights rate minus the control rate.

Repeated exposure events for the same visitor and variation count once;
application start/completion events are deduplicated by event ID. Conversion
events must match the visitor’s variation and occur at or after exposure.
Visitors with conflicting recorded variations are excluded. Empty groups have
no rate rather than a fabricated percentage. These are descriptive metrics
only: the dashboard does not calculate statistical significance or declare a
winner.

## Analytics and storage

The main shared analytics route is `GET /api/telemetry/analytics`. Related
routes are:

| Route | Purpose |
| --- | --- |
| `POST /api/telemetry/events` | Record shared telemetry events |
| `DELETE /api/telemetry/events` | Clear shared telemetry events |
| `POST /api/telemetry/simulate` | Replace telemetry with a synthetic cohort |
| `GET /api/applications` | List applications for the supplied visitor identity |
| `POST /api/applications` | Save an application for the supplied visitor identity |
| `DELETE /api/applications` | Clear all applications belonging to that visitor |

These endpoints are Vite middleware registered for development and preview;
they are not a standalone production backend. The middleware persists data as
JSON files in `.data/`, relative to the server process’s working directory.
Data can survive a refresh or restart when the same filesystem is retained,
but it is not guaranteed to be shared across hosts or to persist on ephemeral
deployment filesystems.

My Applications uses the stable browser ID to filter records, and the backend
validates the ID and enforces that scope for application requests. This is
visitor scoping, not authentication: the ID is stored in browser storage and
is not a secret or proof of identity. The demo has no production-grade
authentication, database, or privacy controls; do not use it to store real
applicant information.

## Simulation warning

The synthetic-cohort action **replaces the shared telemetry dataset**; it does
not keep simulated and real events in separate stores. The synthetic events
are marked as simulated, but they still feed the shared dashboard while
present. Clearing shared telemetry removes the current event dataset. This
does not delete server-side application records. Do not use the simulation
against telemetry you need to retain.

## Setup

Use Node.js `^20.19.0` or `>=22.12.0` and npm. From the repository root:

```sh
git clone https://github.com/Prince-Chandpa/ApplySense.git
cd ApplySense/frontend
npm install
cp .env.example .env.local
```

Set `VITE_FLAGSMITH_ENVIRONMENT_KEY` in `frontend/.env.local` to the
environment key for the Flagsmith environment you intend to use. The key is
consumed by the browser SDK, so it is not a server-side secret. Never put a
Flagsmith Management API token or other privileged credential in a `VITE_`
variable. `.env.local` is ignored by Git; `.env.example` contains only a
placeholder.

Without a valid environment key, the app cannot rely on Flagsmith for a live
assignment or exposure. The UI can render its standard experience as a
fallback, but that is not evidence that the visitor was assigned to the
control variation.

Run these commands from `frontend/`:

```sh
npm run dev      # start the Vite development server and its API middleware
npm run build    # TypeScript project build and Vite production bundle
npm run lint     # ESLint
npm run preview  # preview the built frontend with Vite preview middleware
```

The preview server is for local preview, not a production deployment of a
standalone backend. There is no `test` script in `frontend/package.json`.

## Limitations

- Jobs and candidate skills are sample data; there is no external job feed,
  resume parser, employer integration, or AI model.
- Flagsmith flag definitions, experiment naming, and traffic allocation are
  configured remotely and are not verifiable from this repository.
- Shared telemetry and application storage are local JSON-file persistence
  behind Vite middleware, not a production database or multi-instance service.
- Visitor IDs scope demo application records but do not authenticate users.
- Simulation overwrites the shared telemetry dataset.
- CSS includes responsive breakpoints, but this repository does not provide
  evidence of testing at particular viewport sizes.
