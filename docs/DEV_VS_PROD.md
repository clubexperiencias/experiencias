# Environment Guide: Development (Dev) vs Production (Prod)
**EXPERIENCIAS.CLUB**

This guide provides step-by-step instructions for configuring, switching, and deploying the platform between the **Local Development** environment and the **Production** environment.

---

## 1. Environment Architecture

| Component | Development (Dev / Local) | Production (Prod / Vercel) |
| :--- | :--- | :--- |
| **Base URL** | `http://localhost:4200` (or `3000`) | `https://experiencias.club` |
| **Admin Portal** | `http://localhost:4200/?portal=admin` or `/admin` | `https://admin.experiencias.club` |
| **Provider Portal** | `http://localhost:4200/?portal=prestador` or `/prestadores/panel` | `https://prestadores.experiencias.club` |
| **Variables Source** | `.env.local` file in workspace root | Vercel Project Dashboard (**Environment Variables**) |
| **Angular Configs** | `src/environments/environment.ts` (`production: false`) | `src/environments/environment.prod.ts` (`production: true`) |
| **Database** | Supabase Dev / Local Project (`seed.sql`) | Supabase Production Project |
| **File Storage** | Supabase Storage (`experiencias` & `comprobantes`) | Supabase Storage (`experiencias` & `comprobantes`) |
| **Email Notifications** | Resend API (Simulated or live via `RESEND_API_KEY`) | Resend API (`api/notify.js` Vercel Serverless Function) |

---

## 2. Working in DEVELOPMENT MODE (Local)

### Step 1: Configure `.env.local`
Create your local environment file from the template:
```bash
cp .env.example .env.local
```

Open `.env.local` and add your development Supabase credentials and notification settings:
```env
# Supabase
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend (Email Notifications)
RESEND_API_KEY=re_your_api_key_here          # Optional in dev: simulated in console if omitted
RESEND_FROM_EMAIL=Experiencias Club <onboarding@resend.dev>
ADMIN_NOTIFICATION_EMAILS=gonzagramaglia@gmail.com,vegvarel@gmail.com,patriciofacundodiaztillar@gmail.com
```

> **Security Note:** `.env.local` is ignored by `.gitignore` and **must never** be committed to version control.

### Step 2: Seed the Development Database
1. In your development Supabase project dashboard (or local CLI), open the **SQL Editor**.
2. Copy and paste the contents of [`supabase/seed.sql`](../supabase/seed.sql).
3. Click **Run**.
   * This automatically populates mock experiences, upcoming departures, founding members (`gonzagramaglia@gmail.com`, `vegvarel@gmail.com`, `patriciofacundodiaztillar@gmail.com`), providers, and test transfer submissions.

### Step 3: Configure Google OAuth for Localhost in Supabase
In **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:
* **Site URL**: `http://localhost:4200`
* **Redirect URLs** (Allow List):
  ```text
  http://localhost:4200/**
  http://localhost:3000/**
  http://127.0.0.1:4200/**
  ```

### Step 4: Start the Development Server
```bash
npm run dev
```
> The `npm run dev` script automatically executes `node ./scripts/set-env.js`, which reads `.env.local` and updates the Angular `environment.ts` files before serving the app.

* **Public Web:** [http://localhost:4200](http://localhost:4200)
* **Admin Portal:** [http://localhost:4200/?portal=admin](http://localhost:4200/?portal=admin) or [http://localhost:4200/admin](http://localhost:4200/admin)
* **Provider Portal:** [http://localhost:4200/?portal=prestador](http://localhost:4200/?portal=prestador) or [http://localhost:4200/prestadores/panel](http://localhost:4200/prestadores/panel)

---

## 3. Switching to PRODUCTION MODE

In production, the application is built and hosted on **Vercel** connected to your official custom domain.

### Step 1: Configure Environment Variables in Vercel
In **Vercel Dashboard** -> Select Project -> **Settings** -> **Environment Variables**.
Add the following variables configured for **Production** (and **Preview** if desired):

| Variable | Description | Example / Value |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Production Supabase project API URL | `https://xyzproject.supabase.co` |
| `SUPABASE_ANON_KEY` | Production Supabase anonymous public key | `eyJhbGciOi...` |
| `RESEND_API_KEY` | Resend API secret key for email dispatch | `re_123456789...` |
| `RESEND_FROM_EMAIL` | Verified sender email in Resend | `Experiencias Club <onboarding@resend.dev>` or your domain |
| `ADMIN_NOTIFICATION_EMAILS` | Comma-separated emails to receive payment alerts | `gonzagramaglia@gmail.com,vegvarel@gmail.com,patriciofacundodiaztillar@gmail.com` |

### Step 2: Configure Google OAuth in Production Supabase
In the production project at **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:
* **Site URL**: `https://experiencias.club`
* **Redirect URLs** (Allow List):
  ```text
  https://experiencias.club/**
  https://admin.experiencias.club/**
  https://prestadores.experiencias.club/**
  ```

### Step 3: Run Database Migrations in Production
In the **SQL Editor** of your production Supabase project, run the migration scripts in sequence:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_experiencias_y_pagos.sql`
3. `supabase/migrations/003_administracion_y_prestadores.sql`
4. `supabase/migrations/004_experiencias_storage.sql`

*(Do not execute `seed.sql` in production unless you wish to load initial sample experiences; real experiences can also be created from the Admin Portal)*.

### Step 4: Deploy to Production
Push to your main branch:
```bash
git push origin main
```
Vercel executes the automated build script:
`node ./scripts/set-env.js && npm run build --workspace=apps/public && node ./scripts/post-build.js`
* `scripts/set-env.js` reads Vercel environment variables and generates `environment.prod.ts`.
* Angular compiles with `--configuration production` (swapping `environment.ts` for `environment.prod.ts`).
* Subdomain rewrites (`admin.experiencias.club` and `prestadores.experiencias.club`) route directly to their respective portals.

---

## 4. Useful Command Cheat Sheet

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts Angular in dev mode, injecting variables from `.env.local`. |
| `npm run env` | Runs `scripts/set-env.js` to manually regenerate `environment.ts` files. |
| `npm run build` | Compiles the production build locally following the Vercel pipeline. |
| `npm test` | Runs unit test suites across services, guards, and components. |
| `npx tsc --noEmit` | Validates TypeScript type checking across the entire project with zero code emit. |
