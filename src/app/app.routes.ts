import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
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
    path: 'socios',
    loadComponent: () =>
      import('./features/members/members.component').then((m) => m.MembersComponent),
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
    path: 'experiencias/kayak',
    loadComponent: () =>
      import('./features/experiences/kayak-experience/kayak-experience.component').then(
        (m) => m.KayakExperienceComponent,
      ),
  },
  {
    path: 'experiencias/kayak/fotos',
    loadComponent: () =>
      import('./features/experiences/kayak-experience/kayak-photos/kayak-photos.component').then(
        (m) => m.KayakPhotosComponent,
      ),
  },
  {
    path: 'experiencias/kayak/calificaciones',
    loadComponent: () =>
      import('./features/experiences/kayak-experience/kayak-ratings/kayak-ratings.component').then(
        (m) => m.KayakRatingsComponent,
      ),
  },
  {
    path: 'experiencias/kayak/calificacion',
    redirectTo: 'experiencias/kayak/calificaciones',
    pathMatch: 'full',
  },
  {
    path: 'kayak/calificaciones',
    redirectTo: 'experiencias/kayak/calificaciones',
    pathMatch: 'full',
  },
  {
    path: 'kayak/calificacion',
    redirectTo: 'experiencias/kayak/calificaciones',
    pathMatch: 'full',
  },
  {
    path: 'experiencia/kayak/calificacion',
    redirectTo: 'experiencias/kayak/calificaciones',
    pathMatch: 'full',
  },
  {
    path: 'experiencia/kayak/calificaciones',
    redirectTo: 'experiencias/kayak/calificaciones',
    pathMatch: 'full',
  },
  {
    path: 'experiencia/kayak/fotos',
    redirectTo: 'experiencias/kayak/fotos',
    pathMatch: 'full',
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
    path: 'prestador',
    loadComponent: () =>
      import('./features/provider-panel/provider-panel.component').then(
        (m) => m.ProviderPanelComponent,
      ),
    children: [
      { path: '', redirectTo: 'experiencias', pathMatch: 'full' },
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
        path: 'comprobantes',
        loadComponent: () =>
          import('./features/provider-panel/provider-receipts/provider-receipts.component').then(
            (m) => m.ProviderReceiptsComponent,
          ),
      },
    ],
  },
  {
    path: 'experiencias/prestadores',
    loadComponent: () =>
      import('./features/providers/providers.component').then((m) => m.ProvidersComponent),
  },
  {
    path: 'prestadores',
    redirectTo: 'experiencias/prestadores',
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
