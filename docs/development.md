# Local development

## Prerequisites

- Node.js 22 or newer
- Docker Desktop (or another Docker-compatible daemon)
- npm

The Supabase CLI and all test tools are project dev dependencies; no global installation is required.

## First setup

```bash
npm install
npm run supabase:start
```

Copy `.env.example` to `.env.local`, then map values from `npx supabase status -o env`:

- `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `PUBLISHABLE_KEY` or `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SECRET_KEY` or `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
- `DB_URL` → `DATABASE_URL`

Apply the generated Drizzle migrations and create the first organization:

```bash
npm run db:migrate
npm run db:bootstrap
```

## Verification

```bash
npm test
npm run test:db:local
npm run test:e2e:local
npm run typecheck
npm run build
```

`npm run test:milestone0` runs the complete sequence. Database tests reset local Supabase and must never target a hosted or production database.

## Production boundary

Milestone 0 verifies local migrations, bootstrap, RLS, browser journeys, accessibility, and build output. Hosted Supabase/Vercel provisioning, production secrets, backups, monitoring, and rollback execution belong to the production-platform milestone.
