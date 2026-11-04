import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProviderStoreService } from '../services/provider-store.service';

/**
 * Guardia de seguridad para el Portal de Prestadores.
 * Exige sesión activa mediante Google OAuth y estado de prestador formalmente aprobado.
 */
export const providerGuard: CanActivateFn = async (_route, state) => {
  const providerStore = inject(ProviderStoreService);
  const router = inject(Router);

  // 1. Restaurar y revalidar sesión activa de Supabase (Google OAuth y provider_access)
  await providerStore.restoreSupabaseSession();
  if (providerStore.isAuthenticated() && providerStore.isProviderApproved()) {
    return true;
  }

  // 3. Determinar ruta de login según subdominio o path
  const isBrowser = typeof window !== 'undefined';
  const host = isBrowser ? window.location.hostname.toLowerCase() : '';
  const search = isBrowser ? window.location.search.toLowerCase() : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const isProviderHost =
    host.startsWith('prestadores.') ||
    host.includes('prestadores.experiencias') ||
    (isLocalHost && (search.includes('portal=prestador') || search.includes('prestador=true')));

  const loginPath = isProviderHost ? '/login' : '/prestadores/login';
  return router.createUrlTree([loginPath], {
    queryParams: { returnUrl: state.url },
  });
};

