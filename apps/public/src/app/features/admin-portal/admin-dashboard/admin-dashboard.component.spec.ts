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

    mockExpService = {
      experiences: signal([]),
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
});

