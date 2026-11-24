import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ExperienceProposalRequest } from '../../../core/services/provider-store.service';

describe('AdminDashboardComponent - Proposal Review Routes and Actions', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let mockStore: any;
  let mockExpService: any;

  beforeEach(async () => {
    mockStore = {
      currentAdmin: signal({ email: 'admin@test.com', name: 'Admin' }),
      stats: signal({ totalMembers: 0, activeProviders: 0, totalRevenueArs: 0, pendingReviews: 1 }),
      members: signal([]),
      submissions: signal([]),
      applications: signal([]),
      pendingApplications: signal([]),
      pendingApplicationCount: signal(0),
      pendingExperienceRequestsCount: signal(1),
      experienceRequests: signal([]),
      providerStore: {
        providers: signal([]),
        experienceRequests: signal([]),
        experiences: signal([]),
        isProviderDeleted: () => false,
        reloadFromStorage: vi.fn(),
        loadProposalsFromSupabase: vi.fn().mockResolvedValue(undefined),
      },
      approveExperienceRequest: vi.fn().mockResolvedValue(true),
      rejectExperienceRequest: vi.fn().mockResolvedValue(true),
      isProviderEmail: () => false,
      loadAll: vi.fn().mockResolvedValue(undefined),
      loadAllMembers: vi.fn().mockResolvedValue(undefined),
      loadAllSubmissions: vi.fn().mockResolvedValue(undefined),
      loadAllApplications: vi.fn().mockResolvedValue(undefined),
    };

    const expSignal = signal<any[]>([]);
    mockExpService = {
      experiences: expSignal,
      publishedExperiences: expSignal,
      reloadFromSupabase: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AdminStoreService, useValue: mockStore },
        { provide: ExperienceService, useValue: mockExpService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  });

  describe('getProposalDetailRoute', () => {
    it('should return catalog experience route when matching experience exists', () => {
      mockExpService.experiences.set([
        { id: 'exp-1', slug: 'kayak-jumeal', title: 'Kayak Jumeal' },
      ]);

      const req: ExperienceProposalRequest = {
        id: 'exp-1',
        title: 'Kayak Jumeal',
      } as any;

      expect(component.getProposalDetailRoute(req)).toBe('/admin/experiencias/kayak-jumeal');
    });

    it('should return provider-store experience route when match is only in provider store', () => {
      mockExpService.experiences.set([]);
      mockStore.providerStore.experiences.set([
        { id: 'req-prov-1', slug: 'travesia-puna', title: 'Travesía Puna' },
      ]);

      const req: ExperienceProposalRequest = {
        id: 'req-prov-1',
        title: 'Travesía Puna',
      } as any;

      expect(component.getProposalDetailRoute(req)).toBe('/admin/experiencias/travesia-puna');
    });

    it('should resolve route using proposal slug when not in catalog', () => {
      mockExpService.experiences.set([]);
      mockStore.providerStore.experiences.set([]);

      const req: ExperienceProposalRequest = {
        id: 'req-unique-99',
        slug: 'expedicion-volcan',
        title: 'Expedición al Volcán',
      } as any;

      expect(component.getProposalDetailRoute(req)).toBe('/admin/experiencias/expedicion-volcan');
    });

    it('should fallback to slugified title or id when req has no slug', () => {
      mockExpService.experiences.set([]);
      mockStore.providerStore.experiences.set([]);

      const req: ExperienceProposalRequest = {
        id: 'req-unique-100',
        title: 'Trekking en Belén',
      } as any;

      expect(component.getProposalDetailRoute(req)).toBe('/admin/experiencias/trekking-en-belen');
    });
  });

  describe('dashboard row actions', () => {
    it('should call approveExperienceRequest when clicking APROBAR', async () => {
      await component.approveExperience('req-test-1');
      expect(mockStore.approveExperienceRequest).toHaveBeenCalledWith('req-test-1');
    });

    it('should call rejectExperienceRequest when clicking RECHAZAR', async () => {
      await component.rejectExperience('req-test-1');
      expect(mockStore.rejectExperienceRequest).toHaveBeenCalledWith('req-test-1');
    });
  });

  describe('topFavoritedExperiences', () => {
    it('should ignore waitlist leads and survey interest keys when computing top favorited experiences', () => {
      mockExpService.experiences.set([
        {
          id: 'exp-1',
          slug: 'kayak',
          title: 'Promo 2x1 hidropedales y kayaks',
          status: 'publicada',
          favoritesCount: 0,
        },
        {
          id: 'exp-2',
          slug: 'cabalgata-ambato',
          title: 'Cabalgata en Ambato',
          status: 'publicada',
          favoritesCount: 2,
        },
      ]);

      mockStore.members.set([
        // 7 waitlist leads who selected 'kayak' in the onboarding survey
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `w-${i}`,
          membershipTier: 'waitlist',
          type: 'waitlist',
          experiencesWishlist: ['kayak'],
        })),
        // 1 active member with a real favorite
        {
          id: 'socio-1',
          membershipTier: 'activo',
          type: 'socio',
          experiencesWishlist: ['cabalgata-ambato'],
        },
      ]);

      const top = component.topFavoritedExperiences();
      const kayakRow = top.find((r) => r.slug === 'kayak');
      const cabalgataRow = top.find((r) => r.slug === 'cabalgata-ambato');

      expect(kayakRow?.favoritesCount).toBe(0);
      expect(cabalgataRow?.favoritesCount).toBe(2);
    });

    it('should exclude generic registration survey keys (e.g. kayak, astroturismo) from inflating experience favorites', () => {
      mockExpService.experiences.set([
        {
          id: 'exp-kayak',
          slug: 'kayak',
          title: 'Kayak en el dique',
          status: 'publicada',
          favoritesCount: 0,
        },
        {
          id: 'exp-trekking',
          slug: 'trekking-valle',
          title: 'Trekking en el valle',
          status: 'publicada',
          favoritesCount: 0,
        },
      ]);

      mockStore.members.set([
        // Active member with registration survey answers (kayak, astroturismo) and a genuine experience favorite (trekking-valle)
        {
          id: 'socio-1',
          membershipTier: 'activo',
          type: 'socio',
          experiencesWishlist: ['kayak', 'astroturismo', 'trekking-valle'],
        },
      ]);

      const top = component.topFavoritedExperiences();
      const kayakRow = top.find((r) => r.slug === 'kayak');
      const trekkingRow = top.find((r) => r.slug === 'trekking-valle');
      expect(kayakRow?.favoritesCount).toBe(0);
      expect(trekkingRow?.favoritesCount).toBe(1);
    });
  });

  describe('dashboardProviders', () => {
    it('should exclude archived and deleted providers from dashboard list', () => {
      mockStore.applications.set([
        {
          id: 'app-archived-1',
          type: 'prestador',
          fullName: 'Gonzalo Gramaglia',
          email: 'archived_provider_gonzagramaglia@gmail.com',
          status: 'pendiente',
          agency: 'Hola hola',
          category: 'Test',
          phone: '1234',
          createdAt: '2026-11-07T10:00:00Z',
        },
        {
          id: 'app-active-1',
          type: 'prestador',
          fullName: 'Prestador Valido',
          email: 'valido@prestador.com',
          status: 'pendiente',
          agency: 'Agencia Valida',
          category: 'Trekking',
          phone: '123456',
          createdAt: '2026-11-08T10:00:00Z',
        },
      ]);

      const list = component.dashboardProviders();
      expect(list.some((p) => p.email.startsWith('archived_'))).toBe(false);
      expect(list.length).toBe(1);
      expect(list[0].email).toBe('valido@prestador.com');
    });
  });
});

