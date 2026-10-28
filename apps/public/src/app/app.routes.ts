import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
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
        path: 'comprobantes',
        loadComponent: () =>
          import('./features/provider-panel/provider-members/provider-members.component').then(
            (m) => m.ProviderMembersComponent,
          ),
      },
      {
        path: 'socios',
        redirectTo: 'comprobantes',
        pathMatch: 'full',
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/provider-panel/provider-profile/provider-profile.component').then(
            (m) => m.ProviderProfileComponent,
          ),
      },
      {
        path: 'ingreso',
        loadComponent: () =>
          import('./features/provider-panel/provider-login/provider-login.component').then(
            (m) => m.ProviderLoginComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
