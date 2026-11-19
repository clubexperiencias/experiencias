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
  } else if (search.includes('portal=public') || search.includes('portal=web')) {
    sessionStorage.removeItem('detected_portal');
  }
}

// Detección estricta de subdominios (y soporte para pruebas locales con subdominio o ?portal=admin/prestador)
const isPublicSearch = search.includes('portal=public') || search.includes('portal=web');
const isAdminHost =
  !isPublicSearch && (
    host.startsWith('admin.') ||
    host.includes('admin.experiencias') ||
    (isLocalHost && (search.includes('portal=admin') || search.includes('admin=true') || storedPortal === 'admin'))
  );

const isProviderHost =
  host.startsWith('prestadores.') ||
  host.includes('prestadores.experiencias') ||
  (isLocalHost && (search.includes('portal=prestador') || search.includes('prestador=true') || storedPortal === 'prestador'));

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
        title: 'Nómina de Socios - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-members/admin-members.component').then(
            (m) => m.AdminMembersComponent,
          ),
      },
      {
        path: 'socios/:id/editar',
        title: 'Editar Socio - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-members/admin-members.component').then(
            (m) => m.AdminMembersComponent,
          ),
      },
      {
        path: 'socios/:id',
        title: 'Ficha del Socio - Portal de Admin',
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
        path: 'prestadores',
        title: 'Prestadores y Postulaciones - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-providers/admin-providers.component').then(
            (m) => m.AdminProvidersComponent,
          ),
      },
      {
        path: 'prestadores/:slug/editar',
        title: 'Editar Prestador - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-providers/admin-providers.component').then(
            (m) => m.AdminProvidersComponent,
          ),
      },
      {
        path: 'prestadores/:slug',
        title: 'Ficha del Prestador - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-providers/admin-providers.component').then(
            (m) => m.AdminProvidersComponent,
          ),
      },
      {
        path: 'propuestas',
        redirectTo: 'experiencias',
        pathMatch: 'full',
      },
      {
        path: 'admin/experiencias/:slug',
        redirectTo: 'experiencias/:slug',
        pathMatch: 'full',
      },
      {
        path: 'admin/experiencias',
        redirectTo: 'experiencias',
        pathMatch: 'full',
      },
      {
        path: 'postulaciones',
        redirectTo: 'prestadores',
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
      {
        path: 'experiencias/:slug/editar',
        title: 'Editar Experiencia - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-experiences/admin-experiences.component').then(
            (m) => m.AdminExperiencesComponent,
          ),
      },
      {
        path: 'experiencias/:slug',
        title: 'Ficha de la Experiencia - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-experiences/admin-experiences.component').then(
            (m) => m.AdminExperiencesComponent,
          ),
      },
      {
        path: 'ranking',
        title: 'Ranking de Prestadores & Favoritos - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-ranking/admin-ranking.component').then(
            (m) => m.AdminRankingComponent,
          ),
      },
      {
        path: 'descuentos',
        title: 'Descuentos & Promociones - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-discounts/admin-discounts.component').then(
            (m) => m.AdminDiscountsComponent,
          ),
      },
      {
        path: 'descuentos/nuevo',
        title: 'Nuevo Descuento & Promoción - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-discounts/admin-discount-editor.component').then(
            (m) => m.AdminDiscountEditorComponent,
          ),
      },
      {
        path: 'descuentos/:id/editar',
        title: 'Editar Descuento - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-discounts/admin-discount-editor.component').then(
            (m) => m.AdminDiscountEditorComponent,
          ),
      },
      {
        path: 'plenos',
        title: 'Membresías Plenas - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-plenos/admin-plenos.component').then(
            (m) => m.AdminPlenosComponent,
          ),
      },
      {
        path: 'fundadores',
        title: 'Círculo de Fundadores - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-fundadores/admin-fundadores.component').then(
            (m) => m.AdminFundadoresComponent,
          ),
      },
      {
        path: 'logs',
        title: 'Registro de Actividad - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'logs/admins',
        title: 'Logs de Administradores - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'logs/prestadores',
        title: 'Logs de Prestadores - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'logs/socios',
        title: 'Logs de Socios - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'configuracion',
        title: 'Configuración General - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-settings/admin-settings.component').then(
            (m) => m.AdminSettingsComponent,
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
    path: 'prestadores/emergentes',
    title: 'Prestador Emergente - Experiencias Club',
    loadComponent: () =>
      import('./features/providers/providers.component').then((m) => m.ProvidersComponent),
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
        title: 'Nueva Propuesta de Experiencia - Experiencias Club',
        loadComponent: () =>
          import(
            './features/provider-panel/provider-experience-proposal-modal/provider-experience-proposal-modal.component'
          ).then((m) => m.ProviderExperienceProposalModalComponent),
      },
      {
        path: 'experiencias/:id/editar',
        title: 'Editar Experiencia - Experiencias Club',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-form/provider-experience-form.component').then(
            (m) => m.ProviderExperienceFormComponent,
          ),
      },
      {
        path: 'experiencias/:slug',
        title: 'Ficha de Experiencia - Portal de Prestadores',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-detail/provider-experience-detail.component').then(
            (m) => m.ProviderExperienceDetailComponent,
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
    path: 'faq',
    title: 'Preguntas Frecuentes - Experiencias Club',
    loadComponent: () =>
      import('./features/faq/faq.component').then((m) => m.FaqComponent),
  },
  {
    path: 'preguntas-frecuentes',
    redirectTo: 'faq',
    pathMatch: 'full',
  },
  {
    path: 'experiencias',
    loadComponent: () =>
      import('./features/experiences/experiences.component').then((m) => m.ExperiencesComponent),
  },
  {
    path: 'experiencias/hospedajes',
    loadComponent: () =>
      import('./features/experiences/hospedajes/hospedajes.component').then(
        (m) => m.HospedajesComponent,
      ),
    title: 'Hospedajes, Hosterías & Refugios en Catamarca · EXPERIENCIAS.CLUB',
  },
  {
    path: 'experiencias/hospedajes/:slug/fotos',
    loadComponent: () =>
      import('./features/experiences/experience-photos/experience-photos.component').then(
        (m) => m.ExperiencePhotosComponent,
      ),
  },
  {
    path: 'experiencias/hospedajes/:slug/pago',
    loadComponent: () =>
      import('./features/experiences/experience-payment/experience-payment.component').then(
        (m) => m.ExperiencePaymentComponent,
      ),
  },
  {
    path: 'experiencias/hospedajes/:slug/pagar',
    redirectTo: 'experiencias/hospedajes/:slug/pago',
  },
  {
    path: 'experiencias/hospedajes/:slug',
    loadComponent: () =>
      import('./features/experiences/experience-detail/experience-detail.component').then(
        (m) => m.ExperienceDetailComponent,
      ),
  },
  {
    path: 'hospedajes',
    redirectTo: 'experiencias/hospedajes',
    pathMatch: 'full',
  },
  {
    path: 'hospedajes/:slug/fotos',
    redirectTo: 'experiencias/hospedajes/:slug/fotos',
  },
  {
    path: 'hospedajes/:slug/pago',
    redirectTo: 'experiencias/hospedajes/:slug/pago',
  },
  {
    path: 'hospedajes/:slug/pagar',
    redirectTo: 'experiencias/hospedajes/:slug/pago',
  },
  {
    path: 'hospedajes/:slug',
    redirectTo: 'experiencias/hospedajes/:slug',
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
    path: 'experiencias/prestadores/:slug',
    redirectTo: 'prestadores/:slug',
  },
  {
    path: 'experiencias/kayak',
    data: { slug: 'kayak' },
    loadComponent: () =>
      import('./features/experiences/experience-detail/experience-detail.component').then(
        (m) => m.ExperienceDetailComponent,
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

  // Directorio y catálogo de prestadores oficiales verificados
  {
    path: 'prestadores',
    title: 'Prestadores Oficiales Verificados - Experiencias Club',
    loadComponent: () =>
      import('./features/providers/providers-catalog/providers-catalog.component').then(
        (m) => m.ProvidersCatalogComponent,
      ),
  },

  // "La web de antes" para prestadores y convocatoria abierta -> ahora /prestadores/emergentes
  {
    path: 'prestadores/emergentes',
    title: 'Prestador Emergente - Experiencias Club',
    loadComponent: () =>
      import('./features/providers/providers.component').then((m) => m.ProvidersComponent),
  },
  {
    path: 'prestadores/plenos',
    title: 'Prestador Pleno - Experiencias Club',
    loadComponent: () =>
      import('./features/providers/provider-pleno/provider-pleno.component').then(
        (m) => m.ProviderPlenoComponent,
      ),
  },
  {
    path: 'prestadores/fundadores',
    title: 'Prestador Fundador - Experiencias Club',
    loadComponent: () =>
      import('./features/providers/provider-founder/provider-founder.component').then(
        (m) => m.ProviderFounderComponent,
      ),
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
        title: 'Nómina de Socios - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-members/admin-members.component').then(
            (m) => m.AdminMembersComponent,
          ),
      },
      {
        path: 'socios/:id/editar',
        title: 'Editar Socio - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-members/admin-members.component').then(
            (m) => m.AdminMembersComponent,
          ),
      },
      {
        path: 'socios/:id',
        title: 'Ficha del Socio - Portal de Admin',
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
        path: 'prestadores',
        title: 'Prestadores y Postulaciones - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-providers/admin-providers.component').then(
            (m) => m.AdminProvidersComponent,
          ),
      },
      {
        path: 'prestadores/:slug/editar',
        title: 'Editar Prestador - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-providers/admin-providers.component').then(
            (m) => m.AdminProvidersComponent,
          ),
      },
      {
        path: 'prestadores/:slug',
        title: 'Ficha del Prestador - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-providers/admin-providers.component').then(
            (m) => m.AdminProvidersComponent,
          ),
      },
      {
        path: 'propuestas',
        redirectTo: 'experiencias',
        pathMatch: 'full',
      },
      {
        path: 'admin/experiencias/:slug',
        redirectTo: 'experiencias/:slug',
        pathMatch: 'full',
      },
      {
        path: 'admin/experiencias',
        redirectTo: 'experiencias',
        pathMatch: 'full',
      },
      {
        path: 'postulaciones',
        redirectTo: 'prestadores',
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
      {
        path: 'experiencias/:slug/editar',
        title: 'Editar Experiencia - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-experiences/admin-experiences.component').then(
            (m) => m.AdminExperiencesComponent,
          ),
      },
      {
        path: 'experiencias/:slug',
        title: 'Ficha de la Experiencia - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-experiences/admin-experiences.component').then(
            (m) => m.AdminExperiencesComponent,
          ),
      },
      {
        path: 'ranking',
        title: 'Ranking de Prestadores & Favoritos - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-ranking/admin-ranking.component').then(
            (m) => m.AdminRankingComponent,
          ),
      },
      {
        path: 'descuentos',
        title: 'Descuentos & Promociones - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-discounts/admin-discounts.component').then(
            (m) => m.AdminDiscountsComponent,
          ),
      },
      {
        path: 'descuentos/nuevo',
        title: 'Nuevo Descuento & Promoción - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-discounts/admin-discount-editor.component').then(
            (m) => m.AdminDiscountEditorComponent,
          ),
      },
      {
        path: 'descuentos/:id/editar',
        title: 'Editar Descuento - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-discounts/admin-discount-editor.component').then(
            (m) => m.AdminDiscountEditorComponent,
          ),
      },
      {
        path: 'plenos',
        title: 'Membresías Plenas - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-plenos/admin-plenos.component').then(
            (m) => m.AdminPlenosComponent,
          ),
      },
      {
        path: 'fundadores',
        title: 'Círculo de Fundadores - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-fundadores/admin-fundadores.component').then(
            (m) => m.AdminFundadoresComponent,
          ),
      },
      {
        path: 'logs',
        title: 'Registro de Actividad - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'logs/admins',
        title: 'Logs de Administradores - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'logs/prestadores',
        title: 'Logs de Prestadores - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'logs/socios',
        title: 'Logs de Socios - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-logs/admin-logs.component').then(
            (m) => m.AdminLogsComponent,
          ),
      },
      {
        path: 'configuracion',
        title: 'Configuración General - Portal de Admin',
        loadComponent: () =>
          import('./features/admin-portal/admin-settings/admin-settings.component').then(
            (m) => m.AdminSettingsComponent,
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
        title: 'Nueva Propuesta de Experiencia - Experiencias Club',
        loadComponent: () =>
          import(
            './features/provider-panel/provider-experience-proposal-modal/provider-experience-proposal-modal.component'
          ).then((m) => m.ProviderExperienceProposalModalComponent),
      },
      {
        path: 'experiencias/:id/editar',
        title: 'Editar Experiencia - Experiencias Club',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-form/provider-experience-form.component').then(
            (m) => m.ProviderExperienceFormComponent,
          ),
      },
      {
        path: 'experiencias/:slug',
        title: 'Ficha de Experiencia - Portal de Prestadores',
        loadComponent: () =>
          import('./features/provider-panel/provider-experience-detail/provider-experience-detail.component').then(
            (m) => m.ProviderExperienceDetailComponent,
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
    path: 'prestadores/:slug',
    title: 'Perfil de Prestador - Experiencias Club',
    loadComponent: () =>
      import('./features/providers/provider-public-profile/provider-public-profile.component').then(
        (m) => m.ProviderPublicProfileComponent,
      ),
  },
  {
    path: 'prestador/:slug',
    redirectTo: 'prestadores/:slug',
  },

  {
    path: 'ranking',
    redirectTo: 'admin/ranking',
    pathMatch: 'full',
  },
  {
    path: 'descuentos',
    redirectTo: 'admin/descuentos',
    pathMatch: 'full',
  },
  {
    path: 'descuentos/nuevo',
    redirectTo: 'admin/descuentos/nuevo',
    pathMatch: 'full',
  },
  {
    path: 'descuentos/:id/editar',
    redirectTo: 'admin/descuentos/:id/editar',
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
