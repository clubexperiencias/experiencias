import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NewsletterService } from '../services/newsletter.service';

/**
 * Guardia de autenticación para proteger /perfil y sus subrutas.
 * Si el usuario no tiene una sesión activa (ni local ni en Supabase),
 * lo redirige al portal de ingreso (/ingresar).
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const newsletter = inject(NewsletterService);
  const router = inject(Router);

  const isAuthenticated = await newsletter.isAuthenticated();
  if (isAuthenticated) {
    return true;
  }

  return router.createUrlTree(['/ingresar'], {
    queryParams: { returnUrl: state.url },
  });
};
