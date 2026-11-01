# Guía de Entornos: Desarrollo (Dev) vs Producción (Prod)
**EXPERIENCIAS.CLUB**

Esta guía detalla cómo configurar, alternar y desplegar la plataforma entre el ambiente de **Desarrollo Local** y el ambiente de **Producción**.

---

## 1. Arquitectura de Entornos

| Componente | Desarrollo (Dev / Local) | Producción (Prod / Vercel) |
| :--- | :--- | :--- |
| **URL Base** | `http://localhost:4200` (o `3000`) | `https://experiencias.club` |
| **Portal Admin** | `http://localhost:4200/?portal=admin` o `/admin` | `https://admin.experiencias.club` |
| **Portal Prestadores** | `http://localhost:4200/?portal=prestador` o `/prestadores/panel` | `https://prestadores.experiencias.club` |
| **Origen de Variables** | Archivo `.env.local` en la raíz | Panel de Vercel (**Environment Variables**) |
| **Archivos Angular** | `src/environments/environment.ts` (`production: false`) | `src/environments/environment.prod.ts` (`production: true`) |
| **Base de Datos** | Proyecto Supabase Dev o Local (`seed.sql`) | Proyecto Supabase Producción |
| **Storage de Archivos** | Cloudflare R2 (o fallback Supabase/local) | Cloudflare R2 (`experiencias-comprobantes`) |
| **Notificaciones Email** | Resend API (Simulado o real con `RESEND_API_KEY`) | Resend API (`api/notify.js` serverless en Vercel) |

---

## 2. Cómo trabajar en MODO DESARROLLO (Local)

### Paso 1: Configurar el archivo `.env.local`
Creá tu archivo local a partir de la plantilla:
```bash
cp .env.example .env.local
```

Abrí `.env.local` y colocá las credenciales de tu proyecto de desarrollo (o local):
```env
# Supabase
SUPABASE_URL=https://tu-proyecto-dev.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudflare R2 (API Tokens)
R2_ACCOUNT_ID=tu_cloudflare_account_id
R2_ACCESS_KEY_ID=tu_r2_access_key_id
R2_SECRET_ACCESS_KEY=tu_r2_secret_access_key
R2_BUCKET_NAME=experiencias-comprobantes
R2_PUBLIC_URL=https://pub-xxxx.r2.dev   # o tu subdominio de Cloudflare

# Resend (Notificaciones Email)
RESEND_API_KEY=re_tu_api_key_aqui      # Opcional en dev: si no está, se simula en consola
RESEND_FROM_EMAIL=Experiencias Club <onboarding@resend.dev>
ADMIN_NOTIFICATION_EMAILS=gonzagramaglia@gmail.com,vegvarel@gmail.com,patriciofacundodiaztillar@gmail.com
```

> **Nota de seguridad:** `.env.local` está ignorado en `.gitignore` y **nunca** se sube al repositorio de Git.

### Paso 2: Poblar la base de datos de desarrollo
1. En tu proyecto de Supabase (o CLI local), abrí el **SQL Editor**.
2. Copiá y pegá el contenido de [`supabase/seed.sql`](../supabase/seed.sql).
3. Hacé clic en **Run**.
   * Esto creará automáticamente las experiencias con fotos y fechas próximas, socios fundadores (`gonzagramaglia@gmail.com`, `vegvarel@gmail.com`, `patriciofacundodiaztillar@gmail.com`), prestadores y comprobantes de prueba.

### Paso 3: Configurar Google OAuth para Localhost en Supabase
En **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:
* **Site URL**: `http://localhost:4200`
* **Redirect URLs** (Allow List):
  ```text
  http://localhost:4200/**
  http://localhost:3000/**
  http://127.0.0.1:4200/**
  ```

### Paso 4: Iniciar el servidor local
```bash
npm run dev
```
> El script `npm run dev` ejecuta automáticamente `node ./scripts/set-env.js`, que lee `.env.local` y actualiza los archivos `environment.ts` antes de levantar Angular.

* **Web pública:** [http://localhost:4200](http://localhost:4200)
* **Portal de Admin:** [http://localhost:4200/?portal=admin](http://localhost:4200/?portal=admin) o [http://localhost:4200/admin](http://localhost:4200/admin)
* **Portal de Prestadores:** [http://localhost:4200/?portal=prestador](http://localhost:4200/?portal=prestador) o [http://localhost:4200/prestadores/panel](http://localhost:4200/prestadores/panel)

---

## 3. Cómo pasar a MODO PRODUCCIÓN

En producción, la aplicación se compila y aloja en **Vercel** conectado a tu dominio oficial.

### Paso 1: Configurar Variables de Entorno en Vercel
En **Vercel Dashboard** -> Seleccioná tu proyecto -> **Settings** -> **Environment Variables**.
Agregá las siguientes variables asignadas a los entornos **Production** (y **Preview** si corresponde):

| Variable | Descripción | Ejemplo / Valor |
| :--- | :--- | :--- |
| `SUPABASE_URL` | URL de la API del proyecto de producción en Supabase | `https://xyzproject.supabase.co` |
| `SUPABASE_ANON_KEY` | Llave pública anónima de producción de Supabase | `eyJhbGciOi...` |
| `R2_ACCOUNT_ID` | Account ID de tu cuenta de Cloudflare | `8f21...` |
| `R2_ACCESS_KEY_ID` | Access Key ID del API Token R2 | `3c8e...` |
| `R2_SECRET_ACCESS_KEY` | Secret Key del API Token R2 | `d91a...` |
| `R2_BUCKET_NAME` | Nombre del bucket en Cloudflare R2 | `experiencias-comprobantes` |
| `R2_PUBLIC_URL` | Dominio público conectado al bucket R2 | `https://cdn.catamarcasecreta.com` |
| `RESEND_API_KEY` | Llave secreta de la API de Resend para envíos | `re_123456789...` |
| `RESEND_FROM_EMAIL` | Remitente verificado en Resend | `Experiencias Club <onboarding@resend.dev>` o tu dominio |
| `ADMIN_NOTIFICATION_EMAILS` | Correos que reciben alertas de nuevos comprobantes | `gonzagramaglia@gmail.com,vegvarel@gmail.com,patriciofacundodiaztillar@gmail.com` |

### Paso 2: Configurar Google OAuth en el Supabase de Producción
En el proyecto de producción de **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:
* **Site URL**: `https://experiencias.club`
* **Redirect URLs** (Allow List):
  ```text
  https://experiencias.club/**
  https://admin.experiencias.club/**
  https://prestadores.experiencias.club/**
  ```

### Paso 3: Aplicar Migraciones en Producción
En el **SQL Editor** del proyecto de producción de Supabase, ejecutá los archivos de migración en orden:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_experiencias_y_pagos.sql`
3. `supabase/migrations/003_administracion_y_prestadores.sql`

*(No ejecutes `seed.sql` en producción a menos que quieras poblar las experiencias iniciales; el catálogo de experiencias también podés crearlo desde el Portal de Admin)*.

### Paso 4: Desplegar a Producción
Hacé push a la rama principal:
```bash
git push origin main
```
Vercel ejecutará automáticamente el script de build:
`node ./scripts/set-env.js && npm run build --workspace=apps/public && node ./scripts/post-build.js`
* `scripts/set-env.js` detectará las variables de entorno de Vercel y generará `environment.prod.ts`.
* Angular compilará con `--configuration production` (reemplazando `environment.ts` por `environment.prod.ts`).
* Las rutas de subdominios (`admin.experiencias.club` y `prestadores.experiencias.club`) quedarán enlazadas en vivo.

---

## 4. Cheat Sheet de Comandos Útiles

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia Angular en modo dev leyendo variables de `.env.local`. |
| `npm run env` | Ejecuta `scripts/set-env.js` para regenerar los archivos `environment.ts` manualmente. |
| `npm run build` | Compila el proyecto en modo producción como lo hace Vercel. |
| `npm test` | Ejecuta las pruebas unitarias de los servicios, guardias y componentes. |
| `npx tsc --noEmit` | Valida que no existan errores de tipos de TypeScript. |

