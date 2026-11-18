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
    };
    clubProfile: ReturnType<typeof signal<any>>;
    experiences: ReturnType<typeof signal<Experience[]>>;
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
      },
      clubProfile: signal({
        name: 'Club de Experiencias',
        phone: '123',
        cbuAlias: 'club.cbu',
        cuitDni: '30-12345678-9',
        bankName: 'Banco Nacion',
      }),
      experiences: signal<Experience[]>([]),
    };

    await TestBed.configureTestingModule({
      imports: [AdminExperiencesComponent],
      providers: [
        provideRouter([]),
        { provide: AdminStoreService, useValue: mockAdminStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminExperiencesComponent);
    component = fixture.componentInstance;
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
});

