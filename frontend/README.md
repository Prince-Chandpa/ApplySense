# ApplySense frontend

This directory contains the React/TypeScript application, Vite configuration,
and Vite middleware used for local API routes. For a feature and architecture
overview, see the [project README](../README.md).

## Requirements and setup

Use Node.js `^20.19.0` or `>=22.12.0` and npm. From this directory:

```sh
npm install
cp .env.example .env.local
```

Set `VITE_FLAGSMITH_ENVIRONMENT_KEY` in `.env.local` to the Flagsmith
environment key for the environment to evaluate. The variable is used by the
browser SDK; do not put a Management API token or other privileged credential
in a `VITE_` variable. `.env.local` is ignored by Git, and `.env.example`
contains a placeholder.

Without a valid key, live Flagsmith assignment and enrollment-dependent
exposure tracking are unavailable. The UI may show the standard experience as
a fallback, which should not be treated as an assigned control group.

## Commands

Run from `frontend/`:

```sh
npm run dev      # Vite development server and API middleware
npm run build    # TypeScript build and Vite bundle
npm run lint     # ESLint
npm run preview  # local preview with Vite preview middleware
```

The API middleware stores shared telemetry and applications as JSON files in
`.data/` relative to the server process working directory. Vite development
and preview middleware are for the demo; they are not a standalone production
backend. The synthetic-cohort action replaces shared telemetry rather than
isolating simulated records from real events. See the project README for
telemetry calculations and storage limitations.

There is no `test` script in `package.json`.
