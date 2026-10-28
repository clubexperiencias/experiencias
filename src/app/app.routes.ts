import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/waitlist/waitlist.component').then((m) => m.WaitlistComponent),
  },
  {
    path: 'perfil',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'perfil/actividades',
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
    path: 'experiencias/calificaciones',
    loadComponent: () =>
      import('./features/experiences/experiences-ratings/experiences-ratings.component').then(
        (m) => m.ExperiencesRatingsComponent,
      ),
  },
  {
    path: 'calificaciones',
    redirectTo: 'experiencias/calificaciones',
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
    loadComponent: () =>
      import('./features/members/emerging-signup/emerging-signup.component').then(
        (m) => m.EmergingSignupComponent,
      ),
  },
  {
    path: 'emergentes',
    redirectTo: 'socios/emergentes',
    pathMatch: 'full',
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/admin/admin-login/admin-login.component').then(
        (m) => m.AdminLoginComponent,
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./features/admin/admin-users/admin-users.component').then(
        (m) => m.AdminUsersComponent,
      ),
  },
  {
    path: 'admin/users/:id',
    loadComponent: () =>
      import('./features/admin/admin-user-detail/admin-user-detail.component').then(
        (m) => m.AdminUserDetailComponent,
      ),
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
