import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/waitlist/waitlist.component').then((m) => m.WaitlistComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
