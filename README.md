# Experiencias Club

A modern web platform for curated outdoor experiences, expedition reservations, and verified provider management. Built with Angular 19+ (Standalone Components, Signals), Supabase (Auth, Postgres, and Native Storage), and deployed seamlessly on Vercel.

## Quick Start & Development Server

To install dependencies and start the local development server:

```bash
pnpm install
npm run dev
```

The script automatically runs `scripts/set-env.js` to load `.env.local` into runtime configurations, then starts the dev server. Open your browser and navigate to:
- **Public Portal:** `http://localhost:4200/`
- **Provider Portal:** `http://localhost:4200/prestadores/panel` (or `http://localhost:4200/?portal=prestador`)
- **Admin Portal:** `http://localhost:4200/admin` (or `http://localhost:4200/?portal=admin`)

## Production Build

To build the project for production:

```bash
npm run build
```

This compiles the Angular application and distributes build artifacts to `dist/`, synchronizing runtime scripts with the post-build pipeline.

## Running Unit Tests

To run unit tests with [Vitest](https://vitest.dev/):

```bash
npm test
```

## Storage Architecture (Supabase Storage)

All media assets and payment receipts are stored directly in native Supabase Storage buckets:
- **`experiencias`** (Public Bucket): Stores cover images, albums, videos, and proposal uploads for published and pending activities. *(Note: You must create a public bucket named `experiencias` in the Supabase Storage dashboard before applying the migration, as the migration sets up Row-Level Security policies but does not create the bucket itself).*
- **`comprobantes`** (Private Bucket with RLS): Stores bank transfer receipt documents uploaded during checkout for verification.

For a fresh project, run database migrations `001` through `004` in sequential order (refer to the migration guide in [**`docs/DEV_VS_PROD.md`**](./docs/DEV_VS_PROD.md#6-esquema-de-base-de-datos-y-migraciones-supabase)). Specifically, migration [`002_experiencias_y_pagos.sql`](./supabase/migrations/002_experiencias_y_pagos.sql) creates the private `comprobantes` bucket and its access policies, while migration [`004_experiencias_storage.sql`](./supabase/migrations/004_experiencias_storage.sql) configures public read and authenticated provider/admin access policies for the `experiencias` bucket.

## Environments: Development vs Production

For comprehensive instructions on setting up environment variables, seeding mock data, and configuring Google OAuth across local and production environments, refer to [**`docs/DEV_VS_PROD.md`**](./docs/DEV_VS_PROD.md).

## Additional Resources

For more information on Angular CLI commands and architecture, visit the [Angular CLI Documentation](https://angular.dev/tools/cli).
