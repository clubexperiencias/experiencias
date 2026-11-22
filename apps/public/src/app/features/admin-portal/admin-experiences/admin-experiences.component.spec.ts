import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminExperiencesComponent } from './admin-experiences.component';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { Experience } from '../../../core/models/experience.model';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { signal } from '@angular/core';

describe('AdminExperiencesComponent - Mercado Pago Precedence', () => {
  let component: AdminExperiencesComponent;
  let fixture: ComponentFixture<AdminExperiencesComponent>;
  let mockAdminStore: {
    providerStore: {
      providers: ReturnType<typeof signal<ProviderUser[]>>;
      experienceRequests: ReturnType<typeof signal<any[]>>;
      loadProposalsFromSupabase: () => Promise<void>;
      experiences?: ReturnType<typeof signal<any[]>>;
      reloadFromStorage?: () => void;
    };
    clubProfile: ReturnType<typeof signal<any>>;
    experiences: ReturnType<typeof signal<Experience[]>>;
    approveExperienceRequest?: (id: string, publicUrl?: string, dates?: string[]) => Promise<boolean>;
    rejectExperienceRequest?: (id: string) => Promise<boolean>;
  };

  const sampleConnectedProvider: ProviderUser = {
    id: 'prov-1-uuid',
    name: 'Patricio Diaz',
    email: 'patricio@kayak.com',
    slug: 'patricio-catamarca',
    mpConnected: true,
    mpCollectorId: '123456789',
    mpNickname: 'PATRICIO_MP',
  } as ProviderUser;

  const sampleDisconnectedProvider: ProviderUser = {
    id: 'prov-2-uuid',
    name: 'Juan Perez',
    email: 'juan@trekking.com',
    slug: 'juan-trekking',
    mpConnected: false,
    mpCollectorId: '',
    mpNickname: '',
  } as ProviderUser;

  beforeEach(async () => {
    mockAdminStore = {
      providerStore: {
        providers: signal<ProviderUser[]>([sampleConnectedProvider, sampleDisconnectedProvider]),
        experienceRequests: signal<any[]>([]),
        loadProposalsFromSupabase: () => Promise.resolve(),
        experiences: signal<any[]>([]),
        reloadFromStorage: () => {},
      },
      clubProfile: signal({
        name: 'Club de Experiencias',
        phone: '123',
        cbuAlias: 'club.cbu',
        cuitDni: '30-12345678-9',
        bankName: 'Banco Nacion',
      }),
      experiences: signal<Experience[]>([]),
      approveExperienceRequest: () => Promise.resolve(true),
      rejectExperienceRequest: () => Promise.resolve(true),
    };

    await TestBed.configureTestingModule({
      imports: [AdminExperiencesComponent],
      providers: [
        provideRouter([{ path: '**', component: AdminExperiencesComponent }]),
        { provide: AdminStoreService, useValue: mockAdminStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminExperiencesComponent);
    component = fixture.componentInstance;
    (component as any).experienceService.remoteLoadPromise = Promise.resolve(true);
  });

  describe('getExpMpConnected', () => {
    it('should return true for club experiences by default', () => {
      const clubExp: Partial<Experience> = {
        id: 'club-exp-1',
        slug: 'kayak-club',
        isClubExperience: true,
      };
      expect(component.getExpMpConnected(clubExp as Experience)).toBe(true);
    });

    it('should return false for club experiences if mpConnected is explicitly false', () => {
      const clubExp: Partial<Experience> = {
        id: 'club-exp-1',
        slug: 'kayak-club',
        isClubExperience: true,
        mpConnected: false,
      };
      expect(component.getExpMpConnected(clubExp as Experience)).toBe(false);
    });

    it('should return true when provider is connected and experience does not disable it', () => {
      const exp: Partial<Experience> = {
        id: 'exp-1',
        slug: 'kayak-salida',
        providerId: 'prov-1-uuid',
      };
      expect(component.getExpMpConnected(exp as Experience)).toBe(true);
    });

    it('should return false when provider is disconnected, even if exp.mpConnected is true (server gate alignment)', () => {
      const exp: Partial<Experience> = {
        id: 'exp-2',
        slug: 'trekking-salida',
        providerId: 'prov-2-uuid',
        mpConnected: true,
      };
      // Provider is NOT connected, so server and checkout cannot accept MP
      expect(component.getExpMpConnected(exp as Experience)).toBe(false);
    });

    it('should return false when provider is connected but experience explicitly disables it', () => {
      const exp: Partial<Experience> = {
        id: 'exp-3',
        slug: 'kayak-privada',
        providerId: 'prov-1-uuid',
        mpConnected: false,
      };
      expect(component.getExpMpConnected(exp as Experience)).toBe(false);
    });

    it('should resolve provider by slug and return provider connection state', () => {
      const exp: Partial<Experience> = {
        id: 'exp-4',
        slug: 'kayak-salida-slug',
        providerSlug: 'patricio-catamarca',
      };
      expect(component.getExpMpConnected(exp as Experience)).toBe(true);
    });

    it('should fallback to exp.mpConnected if provider cannot be resolved', () => {
      const exp: Partial<Experience> = {
        id: 'exp-5',
        slug: 'external-salida',
        providerId: 'unknown-id',
        mpConnected: true,
      };
      expect(component.getExpMpConnected(exp as Experience)).toBe(true);
    });
  });

  describe('getExpMpCollectorId and getExpMpNickname', () => {
    it('should return CLUB-OFICIAL collector ID and Club name for club experiences', () => {
      const clubExp: Partial<Experience> = {
        id: 'club-exp-1',
        isClubExperience: true,
      };
      expect(component.getExpMpCollectorId(clubExp as Experience)).toBe('CLUB-OFICIAL');
      expect(component.getExpMpNickname(clubExp as Experience)).toBe('Club de Experiencias');
    });

    it('should return provider collector ID and nickname when resolved from provider', () => {
      const exp: Partial<Experience> = {
        id: 'exp-1',
        providerId: 'prov-1-uuid',
      };
      expect(component.getExpMpCollectorId(exp as Experience)).toBe('123456789');
      expect(component.getExpMpNickname(exp as Experience)).toBe('PATRICIO_MP');
    });
  });

  describe('openEditModal - date extraction', () => {
    it('should extract dates from comma-separated cached value inside an array element', () => {
      const exp: Partial<Experience> = {
        id: 'exp-dates-1',
        slug: 'exp-dates-1',
        title: 'Exp Con Fechas Coma',
        dates: ['2026-11-20, 2026-11-25'],
      };
      component.openEditModal(exp as Experience);
      expect(component.editScheduledDates()).toEqual(['2026-11-20', '2026-11-25']);
      expect(component.editDatesRaw()).toBe('2026-11-20, 2026-11-25');
    });

    it('should preserve standard ISO dates array', () => {
      const exp: Partial<Experience> = {
        id: 'exp-dates-2',
        slug: 'exp-dates-2',
        title: 'Exp ISO Dates',
        dates: ['2026-12-01', '2026-12-15'],
      };
      component.openEditModal(exp as Experience);
      expect(component.editScheduledDates()).toEqual(['2026-12-01', '2026-12-15']);
      expect(component.editDatesRaw()).toBe('2026-12-01, 2026-12-15');
    });

    it('should handle dates as a single comma-separated string', () => {
      const exp: any = {
        id: 'exp-dates-3',
        slug: 'exp-dates-3',
        title: 'Exp String Dates',
        dates: '2026-11-10, 2026-11-18',
      };
      component.openEditModal(exp as Experience);
      expect(component.editScheduledDates()).toEqual(['2026-11-10', '2026-11-18']);
      expect(component.editDatesRaw()).toBe('2026-11-10, 2026-11-18');
    });

    it('should fallback to empty list and "A coordinar" when dates are absent or unscheduled', () => {
      const exp: Partial<Experience> = {
        id: 'exp-dates-4',
        slug: 'exp-dates-4',
        title: 'Exp Sin Fechas',
        dates: ['A coordinar'],
      };
      component.openEditModal(exp as Experience);
      expect(component.editScheduledDates()).toEqual([]);
      expect(component.editDatesRaw()).toBe('A coordinar');
    });
  });

  describe('delete confirmation modal', () => {
    it('should display the selected record ID alongside its title and route', () => {
      const exp: Partial<Experience> = {
        id: 'exp-delete-999',
        slug: 'kayak-sunset-del-valle',
        title: 'Kayak Sunset del Valle',
      };
      component.openDeleteModal(exp as Experience);
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.confirm-delete-modal-dialog');
      expect(modal).toBeTruthy();

      const targetTitle = modal.querySelector('.target-title');
      expect(targetTitle?.textContent).toContain('Kayak Sunset del Valle');

      const targetId = modal.querySelector('.target-id');
      expect(targetId?.textContent).toContain('exp-delete-999');
      expect(targetId?.textContent).toContain('/experiencias/kayak-sunset-del-valle');
    });
  });

  describe('duration dropdown', () => {
    it('should have duration dropdown options matching provider form', () => {
      expect(component.durationOptions).toContain('4 horas (Media jornada)');
      expect(component.durationOptions).toContain('8 horas (Jornada completa)');
      expect(component.durationOptions).toContain('1 hora');
    });

    it('should initialize create modal with 4 horas (Media jornada)', () => {
      component.openCreateModal();
      expect(component.editDurationLabel()).toBe('4 horas (Media jornada)');
    });
  });

  describe('web section / category dropdown', () => {
    it('should have category options including expediciones and hospedajes', () => {
      expect(component.categoryOptions.some((c) => c.value === 'expediciones')).toBe(true);
      expect(component.categoryOptions.some((c) => c.value === 'hospedajes')).toBe(true);
    });

    it('should initialize create modal with expediciones by default', () => {
      component.openCreateModal();
      expect(component.editCategory()).toBe('expediciones');
    });

    it('should load experience category when editing an existing lodging', () => {
      const exp: Partial<Experience> = {
        id: 'hosp-1',
        slug: 'refugio-puna',
        title: 'Refugio Puna',
        category: 'hospedajes',
      };
      component.openEditModal(exp as Experience);
      expect(component.editCategory()).toBe('hospedajes');
    });
  });

  describe('proposal resolution without catalog record', () => {
    it('should resolve pending proposal from providerStore when not in catalog', async () => {
      const proposal = {
        id: 'req-pending-only-1',
        slug: 'travesia-sierra-puna',
        title: 'Travesía Sierra Puna',
        subheading: 'Aventura única',
        region: 'Catamarca',
        difficulty: 'Moderada',
        duration: '1 día',
        priceArs: 50000,
        capacity: 10,
        dates: '2026-12-01',
        status: 'pendiente',
        providerName: 'Guía Juan',
        providerEmail: 'juan@test.com',
      };
      mockAdminStore.providerStore.experienceRequests.set([proposal]);

      await (component as any).syncRouteState('/admin/experiencias/travesia-sierra-puna', 'travesia-sierra-puna');

      expect(component.notFound()).toBe(false);
      expect(component.isRouteDetailMode()).toBe(true);
      const editing = component.editingExperience();
      expect(editing).toBeTruthy();
      expect(editing?.id).toBe('req-pending-only-1');
      expect(editing?.slug).toBe('travesia-sierra-puna');
      expect(editing?.status).toBe('pendiente');
    });

    it('should resolve pending proposal by request ID when slug is not matched in catalog', async () => {
      const proposal = {
        id: 'req-uuid-12345',
        title: 'Cabalgata en la Puna',
        subheading: 'Cabalgata increíble',
        region: 'Catamarca',
        difficulty: 'Baja',
        duration: '2 horas',
        priceArs: 30000,
        capacity: 8,
        status: 'pendiente',
      };
      mockAdminStore.providerStore.experienceRequests.set([proposal]);

      await (component as any).syncRouteState('/admin/experiencias/req-uuid-12345', 'req-uuid-12345');

      expect(component.notFound()).toBe(false);
      expect(component.editingExperience()?.id).toBe('req-uuid-12345');
    });

    it('should resolve providerPhone in initialExperience from matching request for external proposal', () => {
      const proposal = {
        id: 'req-ext-1',
        slug: 'exp-ext-1',
        title: 'Travesía Externa',
        providerName: 'Carlos Guía',
        providerPhone: '+5493834112233',
        status: 'pendiente',
      };
      mockAdminStore.providerStore.experienceRequests.set([proposal]);

      const exp: Partial<Experience> = {
        id: 'req-ext-1',
        slug: 'exp-ext-1',
        title: 'Travesía Externa',
        providerName: 'Carlos Guía',
      };

      component.openEditModal(exp as Experience);
      const initExp = component.initialExperience();
      expect(initExp).toBeTruthy();
      expect(initExp?.providerPhone).toBe('+5493834112233');
      expect(component.editProviderPhone()).toBe('+5493834112233');
    });

    it('should not overwrite resolved phone when onSaveAdminExperience receives an untouched empty phone', async () => {
      const proposal = {
        id: 'req-ext-2',
        slug: 'exp-ext-2',
        title: 'Travesía Externa 2',
        providerName: 'Carlos Guía',
        providerPhone: '+5493834998877',
        status: 'pendiente',
      };
      mockAdminStore.providerStore.experienceRequests.set([proposal]);

      const exp: Partial<Experience> = {
        id: 'req-ext-2',
        slug: 'exp-ext-2',
        title: 'Travesía Externa 2',
        providerName: 'Carlos Guía',
      };

      component.openEditModal(exp as Experience);
      expect(component.editProviderPhone()).toBe('+5493834998877');

      vi.spyOn(component as any, 'saveExperience').mockReturnValue(Promise.resolve());

      await component.onSaveAdminExperience({
        payload: {
          title: 'Travesía Externa 2',
          slug: 'exp-ext-2',
          tagline: 'Tagline',
          description: 'Desc',
          category: 'expediciones',
          region: 'Catamarca',
          meetingPoint: 'Plaza',
          meetingPointUrl: '',
          itinerary: '',
          difficulty: 'Moderada',
          durationLabel: '1 día',
          altitudeMeters: 850,
          capacityPerDate: 10,
          priceArs: 50000,
          dates: ['2026-12-01'],
          pricingPacks: [],
          coverImage: '',
          videoUrl: '',
          albumPhotos: [],
          includedServices: '',
          participantRequirements: '',
          highlights: [],
          providerName: 'Carlos Guía',
          providerPhone: '', // Untouched empty field
        } as any,
      });

      expect(component.editProviderPhone()).toBe('+5493834998877');
    });
  });
});

