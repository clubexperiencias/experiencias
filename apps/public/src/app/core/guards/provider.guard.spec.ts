import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { providerGuard } from './provider.guard';
import { ProviderStoreService } from '../services/provider-store.service';

describe('providerGuard', () => {
  let providerStoreMock: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    isProviderApproved: ReturnType<typeof vi.fn>;
    restoreSupabaseSession: ReturnType<typeof vi.fn>;
  };
  let routerMock: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };

  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/prestadores/panel/dashboard' } as RouterStateSnapshot;

  beforeEach(() => {
    providerStoreMock = {
      isAuthenticated: vi.fn(),
      isProviderApproved: vi.fn(),
      restoreSupabaseSession: vi.fn(),
    };
    routerMock = {
      createUrlTree: vi.fn((commands, extras) => ({ commands, extras } as unknown as UrlTree)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ProviderStoreService, useValue: providerStoreMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('should allow navigation if provider is authenticated and approved', async () => {
    providerStoreMock.isAuthenticated.mockReturnValue(true);
    providerStoreMock.isProviderApproved.mockReturnValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      providerGuard(dummyRoute, dummyState),
    );

    expect(result).toBe(true);
    expect(providerStoreMock.restoreSupabaseSession).not.toHaveBeenCalled();
  });

  it('should allow navigation if restoreSupabaseSession validates provider approval', async () => {
    providerStoreMock.isAuthenticated.mockReturnValueOnce(false).mockReturnValue(true);
    providerStoreMock.isProviderApproved.mockReturnValue(true);
    providerStoreMock.restoreSupabaseSession.mockResolvedValue(undefined);

    const result = await TestBed.runInInjectionContext(() =>
      providerGuard(dummyRoute, dummyState),
    );

    expect(result).toBe(true);
    expect(providerStoreMock.restoreSupabaseSession).toHaveBeenCalled();
  });

  it('should redirect to provider login if provider is not authenticated or not approved', async () => {
    providerStoreMock.isAuthenticated.mockReturnValue(false);
    providerStoreMock.isProviderApproved.mockReturnValue(false);
    providerStoreMock.restoreSupabaseSession.mockResolvedValue(undefined);

    const result = await TestBed.runInInjectionContext(() =>
      providerGuard(dummyRoute, dummyState),
    );

    expect(routerMock.createUrlTree).toHaveBeenCalledWith(
      ['/prestadores/login'],
      { queryParams: { returnUrl: '/prestadores/panel/dashboard' } },
    );
    expect(result).toEqual({
      commands: ['/prestadores/login'],
      extras: { queryParams: { returnUrl: '/prestadores/panel/dashboard' } },
    });
  });
});
