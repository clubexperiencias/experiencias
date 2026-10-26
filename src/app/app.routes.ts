import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/waitlist/waitlist.component').then((m) => m.WaitlistComponent)
  },
  {
    path: 'perfil',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent)
  },
  {
    path: 'ingresar',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'socios',
    loadComponent: () =>
      import('./features/members/members.component').then((m) => m.MembersComponent)
  },
  {
    path: 'experiencias',
    loadComponent: () =>
      import('./features/experiences/experiences.component').then((m) => m.ExperiencesComponent)
  },
  {
    path: 'experiencias/kayak',
    loadComponent: () =>
      import('./features/experiences/kayak-experience/kayak-experience.component').then(
        (m) => m.KayakExperienceComponent
      )
  },
  {
    path: 'experiencias/kayak/fotos',
    loadComponent: () =>
      import('./features/experiences/kayak-experience/kayak-photos/kayak-photos.component').then(
        (m) => m.KayakPhotosComponent
      )
  },
  {
    path: 'experiencia/kayak/fotos',
    redirectTo: 'experiencias/kayak/fotos',
    pathMatch: 'full'
  },
  {
    path: 'experiencia/kayak',
    redirectTo: 'experiencias/kayak',
    pathMatch: 'full'
  },
  {
    path: 'experiencias/prestadores',
    loadComponent: () =>
      import('./features/providers/providers.component').then((m) => m.ProvidersComponent)
  },
  {
    path: 'prestadores',
    redirectTo: 'experiencias/prestadores',
    pathMatch: 'full'
  },
  {
    path: 'socios/activos',
    loadComponent: () =>
      import('./features/subscription/subscription.component').then((m) => m.SubscriptionComponent)
  },
  {
    path: 'socios/activar',
    redirectTo: 'socios/activos',
    pathMatch: 'full'
  },
  {
    path: 'activar',
    redirectTo: 'socios/activos',
    pathMatch: 'full'
  },
  {
    path: 'socios/fundadores',
    loadComponent: () =>
      import('./features/founders/founders.component').then((m) => m.FoundersComponent)
  },
  {
    path: 'fundadores',
    redirectTo: 'socios/fundadores',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
