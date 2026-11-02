import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { providerGuard } from './core/guards/provider.guard';

const isBrowser = typeof window !== 'undefined';
const host = isBrowser ? window.location.hostname.toLowerCase() : '';
const search = isBrowser ? window.location.search.toLowerCase() : '';

const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');

const storedPortal = isBrowser ? (sessionStorage.getItem('detected_portal') || '') : '';
if (isBrowser) {
  if (search.includes('portal=admin') || search.includes('admin=true')) {
    sessionStorage.setItem('detected_portal', 'admin');
  } else if (search.includes('portal=prestador') || search.includes('prestador=true')) {
    sessionStorage.setItem('detected_portal', 'prestador');
  }
}

// Detección estricta de subdominios (y soporte para pruebas locales con subdominio o ?portal=admin/prestador)
const isAdminHost =
  host.startsWith('admin.') ||
  host.includes('admin.experiencias') ||
  (isLocalHost && (search.includes('portal=admin') || search.includes('admin=true') || storedPortal === 'admin'));

const isProviderHost =
  host.startsWith('prestadores.') ||
  host.includes('prestadores.experiencias') ||
  (isLocalHost && (search.includes('portal=prestador') || search.includes('portal=true') || storedPortal === 'prestador'));

// ══════════════════════════════════════════════════════════════════════
// 1. Rutas exclusivas de administración central (admin.experiencias.club)
// ══════════════════════════════════════════════════════════════════════
const adminRoutes: Routes = [
  {
    path: 'login',
    title: 'Acceso Administración - Experiencias Club',
    loadComponent: () =>
      import('./features/admin-portal/admin-login/admin-login.component').then(
        (m) => m.AdminLoginComponent,
      ),
  },
  {
    path: '',
    title: 'Portal de Admin del Club de Experiencias',
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    loadComponent: () =>
      import('./features/admin-portal/admin-panel.component').then((m) => m.AdminPanelComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'socios',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-members/admin-members.component').then(
            (m) => m.AdminMembersComponent,
          ),
      },
      {
        path: 'comprobantes',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-receipts/admin-receipts.component').then(
            (m) => m.AdminReceiptsComponent,
          ),
      },
      {
        path: 'propuestas',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-applications/admin-applications.component').then(
            (m) => m.AdminApplicationsComponent,
          ),
      },
      {
        path: 'postulaciones',
        redirectTo: 'propuestas',
        pathMatch: 'full',
      },
      {
        path: 'experiencias',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-experiences/admin-experiences.component').then(
            (m) => m.AdminExperiencesComponent,
          ),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];

// ══════════════════════════════════════════════════════════════════════
// 2. Rutas exclusivas del portal de prestadores (prestadores.experiencias.club)
// ══════════════════════════════════════════════════════════════════════
const providerRoutes: Routes = [
  {
    path: 'login',
    title: 'Acceso Prestadores - Experiencias Club',
    loadComponent: () =>
      import('./features/provider-panel/provider-login/provider-login.component').then(
        (m) => m.ProviderLoginComponent,
      ),
  },
  {
    path: '',
    title: 'Portal de Prestadores del Club de Experiencias',
    canActivate: [providerGuard],
    canActivateChild: [providerGuard],
    loadComponent: () =>
      import('./features/provider-panel/provider-panel.component').then(
        (m) => m.ProviderPanelComponent,
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/provider-panel/provider-dashboard/provider-dashboard.component').then(
            (m) => m.ProviderDashboardComponent,
          ),
      },
      {
        path: 'experiencias',
        loadComponent: () =>
          import('./features/provider-panel/provider-experiences/provider-experiences.component').then(
            (m) => m.ProviderExperiencesComponent,
          ),
      },
      {
        path: 'experiencias/nueva',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-form/provider-experience-form.component').then(
            (m) => m.ProviderExperienceFormComponent,
          ),
      },
      {
        path: 'experiencias/:id/editar',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-form/provider-experience-form.component').then(
            (m) => m.ProviderExperienceFormComponent,
          ),
      },
      {
        path: 'socios',
        loadComponent: () =>
          import('./features/provider-panel/provider-members/provider-members.component').then(
            (m) => m.ProviderMembersComponent,
          ),
      },
      {
        path: 'comprobantes',
        redirectTo: 'socios',
        pathMatch: 'full',
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/provider-panel/provider-profile/provider-profile.component').then(
            (m) => m.ProviderProfileComponent,
          ),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];

// ══════════════════════════════════════════════════════════════════════
// 3. Rutas del portal público principal (experiencias.club)
// ══════════════════════════════════════════════════════════════════════
const publicRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/waitlist/waitlist.component').then((m) => m.WaitlistComponent),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'perfil/actividades',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/activities-history/activities-history.component').then(
        (m) => m.ActivitiesHistoryComponent,
      ),
  },
  {
    path: 'ingresar',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'login',
    redirectTo: 'ingresar',
    pathMatch: 'full',
  },
  {
    path: 'socios',
    loadComponent: () =>
      import('./features/members/members.component').then((m) => m.MembersComponent),
  },
  {
    path: 'socios/emergentes',
    loadComponent: () =>
      import('./features/members/emerging-member/emerging-member.component').then(
        (m) => m.EmergingMemberComponent,
      ),
  },
  {
    path: 'socios/emergentes/ingreso',
    redirectTo: 'socios/emergentes',
    pathMatch: 'full',
  },
  {
    path: 'emergentes',
    redirectTo: 'socios/emergentes',
    pathMatch: 'full',
  },
  {
    path: 'socios/plenos',
    loadComponent: () =>
      import('./features/subscription/subscription.component').then((m) => m.SubscriptionComponent),
  },
  {
    path: 'socios/activar',
    redirectTo: 'socios/plenos',
    pathMatch: 'full',
  },
  {
    path: 'activar',
    redirectTo: 'socios/plenos',
    pathMatch: 'full',
  },
  {
    path: 'socios/fundadores',
    loadComponent: () =>
      import('./features/founders/founders.component').then((m) => m.FoundersComponent),
  },
  {
    path: 'fundadores',
    redirectTo: 'socios/fundadores',
    pathMatch: 'full',
  },
  {
    path: 'experiencias',
    loadComponent: () =>
      import('./features/experiences/experiences.component').then((m) => m.ExperiencesComponent),
  },
  {
    path: 'experiencias/fotos',
    loadComponent: () =>
      import('./features/experiences/experiences-photos/experiences-photos.component').then(
        (m) => m.ExperiencesPhotosComponent,
      ),
  },
  {
    path: 'fotos',
    redirectTo: 'experiencias/fotos',
    pathMatch: 'full',
  },
  {
    path: 'experiencias/prestadores',
    redirectTo: 'prestadores',
    pathMatch: 'full',
  },
  {
    path: 'experiencias/kayak',
    loadComponent: () =>
      import('./features/experiences/kayak-experience/kayak-experience.component').then(
        (m) => m.KayakExperienceComponent,
      ),
  },
  {
    path: 'experiencias/kayak/fotos',
    data: { slug: 'kayak' },
    loadComponent: () =>
      import('./features/experiences/experience-photos/experience-photos.component').then(
        (m) => m.ExperiencePhotosComponent,
      ),
  },
  {
    path: 'experiencia/kayak/fotos',
    redirectTo: 'experiencias/kayak/fotos',
    pathMatch: 'full',
  },
  // Rutas dinámicas de álbum de fotos para cualquier experiencia del catálogo
  {
    path: 'experiencias/:slug/fotos',
    loadComponent: () =>
      import('./features/experiences/experience-photos/experience-photos.component').then(
        (m) => m.ExperiencePhotosComponent,
      ),
  },
  {
    path: 'experiencia/:slug/fotos',
    redirectTo: 'experiencias/:slug/fotos',
  },
  {
    path: 'experiencia/kayak',
    redirectTo: 'experiencias/kayak',
    pathMatch: 'full',
  },
  {
    path: 'experiencias/kayak/pago',
    data: { slug: 'kayak' },
    loadComponent: () =>
      import('./features/experiences/experience-payment/experience-payment.component').then(
        (m) => m.ExperiencePaymentComponent,
      ),
  },
  {
    path: 'experiencias/kayak/pagar',
    redirectTo: 'experiencias/kayak/pago',
    pathMatch: 'full',
  },
  // Rutas dinámicas de pago para cualquier experiencia del catálogo
  {
    path: 'experiencias/:slug/pago',
    loadComponent: () =>
      import('./features/experiences/experience-payment/experience-payment.component').then(
        (m) => m.ExperiencePaymentComponent,
      ),
  },
  {
    path: 'experiencias/:slug/pagar',
    redirectTo: 'experiencias/:slug/pago',
  },
  {
    path: 'experiencia/:slug/pago',
    redirectTo: 'experiencias/:slug/pago',
  },
  {
    path: 'experiencia/:slug/pagar',
    redirectTo: 'experiencias/:slug/pago',
  },
  // Ruta dinámica universal para cualquier experiencia del catálogo
  {
    path: 'experiencias/:slug',
    loadComponent: () =>
      import('./features/experiences/experience-detail/experience-detail.component').then(
        (m) => m.ExperienceDetailComponent,
      ),
  },
  {
    path: 'experiencia/:slug',
    redirectTo: 'experiencias/:slug',
  },

  // "La web de antes" para prestadores y convocatoria abierta
  {
    path: 'prestadores',
    loadComponent: () =>
      import('./features/providers/providers.component').then((m) => m.ProvidersComponent),
  },

  // ── Portal de Administración (Rutas securizadas bajo /admin) ──
  {
    path: 'admin/login',
    title: 'Acceso Administración - Experiencias Club',
    loadComponent: () =>
      import('./features/admin-portal/admin-login/admin-login.component').then(
        (m) => m.AdminLoginComponent,
      ),
  },
  {
    path: 'admin',
    title: 'Portal de Admin del Club de Experiencias',
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    loadComponent: () =>
      import('./features/admin-portal/admin-panel.component').then((m) => m.AdminPanelComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'socios',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-members/admin-members.component').then(
            (m) => m.AdminMembersComponent,
          ),
      },
      {
        path: 'comprobantes',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-receipts/admin-receipts.component').then(
            (m) => m.AdminReceiptsComponent,
          ),
      },
      {
        path: 'propuestas',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-applications/admin-applications.component').then(
            (m) => m.AdminApplicationsComponent,
          ),
      },
      {
        path: 'postulaciones',
        redirectTo: 'propuestas',
        pathMatch: 'full',
      },
      {
        path: 'experiencias',
        title: 'Portal de Admin del Club de Experiencias',
        loadComponent: () =>
          import('./features/admin-portal/admin-experiences/admin-experiences.component').then(
            (m) => m.AdminExperiencesComponent,
          ),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  // ── Portal de Prestadores (Rutas securizadas bajo /prestadores/panel y login) ──
  {
    path: 'prestadores/login',
    title: 'Acceso Prestadores - Experiencias Club',
    loadComponent: () =>
      import('./features/provider-panel/provider-login/provider-login.component').then(
        (m) => m.ProviderLoginComponent,
      ),
  },
  {
    path: 'prestadores/panel',
    title: 'Panel de Prestadores - Experiencias Club',
    canActivate: [providerGuard],
    canActivateChild: [providerGuard],
    loadComponent: () =>
      import('./features/provider-panel/provider-panel.component').then(
        (m) => m.ProviderPanelComponent,
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/provider-panel/provider-dashboard/provider-dashboard.component').then(
            (m) => m.ProviderDashboardComponent,
          ),
      },
      {
        path: 'experiencias',
        loadComponent: () =>
          import('./features/provider-panel/provider-experiences/provider-experiences.component').then(
            (m) => m.ProviderExperiencesComponent,
          ),
      },
      {
        path: 'experiencias/nueva',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-form/provider-experience-form.component').then(
            (m) => m.ProviderExperienceFormComponent,
          ),
      },
      {
        path: 'experiencias/:id/editar',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-form/provider-experience-form.component').then(
            (m) => m.ProviderExperienceFormComponent,
          ),
      },
      {
        path: 'socios',
        loadComponent: () =>
          import('./features/provider-panel/provider-members/provider-members.component').then(
            (m) => m.ProviderMembersComponent,
          ),
      },
      {
        path: 'comprobantes',
        redirectTo: 'socios',
        pathMatch: 'full',
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/provider-panel/provider-profile/provider-profile.component').then(
            (m) => m.ProviderProfileComponent,
          ),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'prestadores/dashboard',
    redirectTo: 'prestadores/panel/dashboard',
    pathMatch: 'full',
  },

  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];

// Dependiendo del subdominio en el navegador, se cargan las rutas correspondientes:
// - admin.experiencias.club -> adminRoutes (raíz redirige a dashboard)
// - prestadores.experiencias.club -> providerRoutes (raíz redirige a dashboard)
// - experiencias.club -> publicRoutes (/admin no existe, /prestadores lleva a la web de registro)
export const routes: Routes = isAdminHost
  ? adminRoutes
  : isProviderHost
    ? providerRoutes
    : publicRoutes;
