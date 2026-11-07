import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminStoreService } from '../services/admin-store.service';

/**
 * Guardia de seguridad para el Portal de Administración.
 * Exige sesión activa mediante Google OAuth y permisos verificados en public.administradores.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const adminStore = inject(AdminStoreService);
  const router = inject(Router);

  // 1. Si ya está autenticado en el estado de señales
  if (adminStore.isAuthenticated()) {
    return true;
  }

  // 2. Intentar restaurar sesión activa de Supabase (Google OAuth)
  const isAuth = await adminStore.restoreSupabaseSession();
  if (isAuth && adminStore.isAuthenticated()) {
    return true;
  }

  // 3. Determinar ruta de login según subdominio o path
  const isBrowser = typeof window !== 'undefined';
  const host = isBrowser ? window.location.hostname.toLowerCase() : '';
  const search = isBrowser ? window.location.search.toLowerCase() : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const isAdminHost =
    host.startsWith('admin.') ||
    host.includes('admin.experiencias') ||
    (isLocalHost && (search.includes('portal=admin') || search.includes('admin=true')));

  const loginPath = isAdminHost ? '/login' : '/admin/login';
  return router.createUrlTree([loginPath], {
    queryParams: { returnUrl: state.url },
  });
};

