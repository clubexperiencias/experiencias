import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AdminStoreService } from '../services/admin-store.service';

describe('adminGuard', () => {
  let adminStoreMock: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    restoreSupabaseSession: ReturnType<typeof vi.fn>;
  };
  let routerMock: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };

  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/admin/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    adminStoreMock = {
      isAuthenticated: vi.fn(),
      restoreSupabaseSession: vi.fn(),
    };
    routerMock = {
      createUrlTree: vi.fn((commands, extras) => ({ commands, extras } as unknown as UrlTree)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AdminStoreService, useValue: adminStoreMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('should allow navigation if adminStore is already authenticated', async () => {
    adminStoreMock.isAuthenticated.mockReturnValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(dummyRoute, dummyState),
    );

    expect(result).toBe(true);
    expect(adminStoreMock.restoreSupabaseSession).not.toHaveBeenCalled();
  });

  it('should allow navigation if restoring Supabase session succeeds', async () => {
    adminStoreMock.isAuthenticated.mockReturnValueOnce(false).mockReturnValueOnce(true);
    adminStoreMock.restoreSupabaseSession.mockResolvedValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(dummyRoute, dummyState),
    );

    expect(result).toBe(true);
    expect(adminStoreMock.restoreSupabaseSession).toHaveBeenCalled();
  });

  it('should redirect to admin login if not authenticated', async () => {
    adminStoreMock.isAuthenticated.mockReturnValue(false);
    adminStoreMock.restoreSupabaseSession.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(dummyRoute, dummyState),
    );

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(
      ['/admin/login'],
      { queryParams: { returnUrl: '/admin/dashboard' } },
    );
    expect(result).toEqual({
      commands: ['/admin/login'],
      extras: { queryParams: { returnUrl: '/admin/dashboard' } },
    });
  });
});

