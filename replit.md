# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project is **Concept AI** — an AI-powered business feasibility analysis tool ported from Lovable.dev.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### `artifacts/concept-ai` — Frontend web app (Vite + React)
- **Preview path**: `/` (root)
- **Auth**: Clerk (`@clerk/react`) — `VITE_CLERK_PUBLISHABLE_KEY` required
- **Routing**: `wouter` (NOT react-router-dom)
- **Theme**: Tailwind v3 with shadcn/ui components, `ThemeProvider` wraps app
- **State**: TanStack Query for server state, `AuthContext` bridges Clerk → components

Key pages:
- `/` — Index/landing with hero
- `/sign-in`, `/sign-up` — Clerk-hosted UI (path routing mode)
- `/analyze` — Multi-step feasibility analysis wizard (4 steps)
- `/results` — Analysis results (passed via `sessionStorage` key `__concept_ai_result__`)
- `/dashboard` — User's saved analyses
- `/compare` — Side-by-side report comparison
- `/r/:slug` — Shared public report view

Protected routes (`/analyze`, `/results`, `/dashboard`, `/compare`) redirect to `/sign-in` when unauthenticated via `ProtectedRoute` using `useUser` from Clerk.

### `artifacts/api-server` — Express API server
- **Port**: 8080 (proxied at `/api`)
- **Auth middleware**: `@clerk/express` (`requireAuth`)
- **DB client**: Drizzle + `@workspace/db`

API routes:
- `GET /api/healthz` — health check (public)
- `GET/POST /api/reports` — list and create reports
- `GET/PATCH/DELETE /api/reports/:id` — single report CRUD
- `POST /api/reports/:id/share` — generate share slug
- `GET /api/reports/shared/:slug` — public shared report (no auth)
- `GET/POST /api/notifications` — notification list + mark read
- `GET/POST /api/reports/:reportId/comments` — comments per report
- `GET/PUT /api/profiles/me` — user profile upsert
- `POST /api/ai/autofill-brief` — AI: expand one-liner into draft
- `POST /api/ai/complete-field` — AI: complete a single form field
- `POST /api/ai/analyze-concept` — AI: run full feasibility analysis

AI routes use Replit AI integration (OpenAI-compatible) via `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY`.

### `lib/db` — Drizzle schema + client
Tables: `reports`, `notifications`, `report_comments`, `profiles`, `report_status_history`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- `VITE_API_URL` defaults to `""` (empty) — API calls use relative paths which route through Replit's proxy
- Results page uses `sessionStorage` key `__concept_ai_result__` + `window.dispatchEvent("concept-ai-result")` to pass data (wouter has no location.state)
- Supabase integration has been fully removed; no Supabase dependencies remain
- AI model: `gpt-5.4` (configured in `artifacts/api-server/src/routes/ai/index.ts`)
