import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProviderPublicProfileComponent } from './provider-public-profile.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { ProviderUser } from '../../../core/models/provider.model';
import { Experience } from '../../../core/models/experience.model';
import { signal } from '@angular/core';

describe('ProviderPublicProfileComponent - Rating Eligibility', () => {
  let component: ProviderPublicProfileComponent;
  let fixture: ComponentFixture<ProviderPublicProfileComponent>;

  const sampleProvider: ProviderUser = {
    id: 'prov-patricio-uuid',
    name: 'Patricio Diaz',
    email: 'patricio@kayak.com',
    slug: 'patricio-catamarca',
    agency: 'Kayak Catamarca',
  } as ProviderUser;

  const mockNewsletter = {
    currentMember: signal<{ email: string; name: string } | null>({
      email: 'socio@experiencias.club',
      name: 'Socio Activo',
    }),
  };

  const mockActivities = signal<any[]>([]);
  const mockActivityHistory = {
    activities: mockActivities,
  };

  const mockSubmissions = signal<any[]>([]);
  const mockProviderStore = {
    submissions: mockSubmissions,
    getPublicProvider: vi.fn().mockResolvedValue(sampleProvider),
    currentProvider: signal(null),
    providers: signal([]),
  };

  const mockExperiences = signal<Experience[]>([]);
  const mockExpService = {
    remoteLoadPromise: Promise.resolve(),
    experiences: mockExperiences,
    publishedExperiences: signal<Experience[]>([]),
    getExperiencesByProvider: vi.fn().mockReturnValue([]), // 0 published experiences!
  };

  beforeEach(async () => {
    mockActivities.set([]);
    mockSubmissions.set([]);
    mockExperiences.set([]);

    await TestBed.configureTestingModule({
      imports: [ProviderPublicProfileComponent],
      providers: [
        provideRouter([]),
        { provide: NewsletterService, useValue: mockNewsletter },
        { provide: ActivityHistoryService, useValue: mockActivityHistory },
        { provide: ProviderStoreService, useValue: mockProviderStore },
        { provide: ExperienceService, useValue: mockExpService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderPublicProfileComponent);
    component = fixture.componentInstance;
    component.provider.set(sampleProvider);
  });

  it('should allow rating when member has paid activity matching provider identity even if published experiences list is empty', () => {
    // 0 published experiences
    expect(component.providerExperiences()).toEqual([]);

    // Member has a confirmed activity matching provider agency
    mockActivities.set([
      {
        id: 'act-1',
        title: 'Travesía Pasada',
        status: 'confirmada',
        provider: {
          name: 'Kayak Catamarca',
        },
      },
    ]);

    expect(component.canRateProvider()).toBe(true);
  });

  it('should allow rating when member has paid submission matching provider email even if published experiences list is empty', () => {
    // 0 published experiences
    expect(component.providerExperiences()).toEqual([]);

    // Submission paid matching provider email
    mockSubmissions.set([
      {
        id: 'sub-1',
        email: 'socio@experiencias.club',
        providerEmail: 'patricio@kayak.com',
        status: 'aprobado',
      },
    ]);

    expect(component.canRateProvider()).toBe(true);
  });

  it('should prioritize experience ID and reject rating when IDs conflict even if title matches', () => {
    // Provider owns exp-patricio-1 with title "Kayak Atardecer"
    mockExperiences.set([
      {
        id: 'exp-patricio-1',
        title: 'Kayak Atardecer',
        providerEmail: 'patricio@kayak.com',
      } as Experience,
    ]);

    // Member has a submission for another provider's experience (exp-other-99),
    // but with the homonymous title "Kayak Atardecer"
    mockSubmissions.set([
      {
        id: 'sub-other',
        email: 'socio@experiencias.club',
        experienceId: 'exp-other-99', // Conflicting ID
        experienceTitle: 'Kayak Atardecer', // Matching Title
        status: 'aprobado',
      },
    ]);

    expect(component.canRateProvider()).toBe(false);
  });

  it('should resolve legacy title-only payments to provider before accepting title match', () => {
    // Unique experience belonging to Patricio
    mockExperiences.set([
      {
        id: 'exp-patricio-1',
        title: 'Travesía Secreta Las Pirquitas',
        providerEmail: 'patricio@kayak.com',
      } as Experience,
    ]);

    // Legacy submission with no experienceId, matching the unique title
    mockSubmissions.set([
      {
        id: 'sub-legacy',
        email: 'socio@experiencias.club',
        experienceId: '',
        experienceTitle: 'Travesía Secreta Las Pirquitas',
        status: 'aprobado',
      },
    ]);

    expect(component.canRateProvider()).toBe(true);

    // If another provider also offers an experience with that title, it is ambiguous and should be rejected without provider match
    mockExperiences.set([
      {
        id: 'exp-patricio-1',
        title: 'Travesía Secreta Las Pirquitas',
        providerEmail: 'patricio@kayak.com',
      } as Experience,
      {
        id: 'exp-other-2',
        title: 'Travesía Secreta Las Pirquitas',
        providerEmail: 'other@prestador.com',
      } as Experience,
    ]);

    expect(component.canRateProvider()).toBe(false);
  });

  it('should not allow rating when member has no paid records with this provider', () => {
    expect(component.providerExperiences()).toEqual([]);
    mockActivities.set([]);
    mockSubmissions.set([]);

    expect(component.canRateProvider()).toBe(false);
  });

  it('should not allow rating when not logged in as a member', () => {
    mockNewsletter.currentMember.set(null);
    expect(component.canRateProvider()).toBe(false);
  });

  it('should reset hasRemotePaidRecord and reject stale responses when member or provider changes', async () => {
    (component as any).hasRemotePaidRecord.set(true);
    expect(component.canRateProvider()).toBe(true);

    // Member changes -> effect resets hasRemotePaidRecord
    mockNewsletter.currentMember.set({ email: 'otro@socio.com', name: 'Otro Socio' });
    fixture.detectChanges();
    expect((component as any).hasRemotePaidRecord()).toBe(false);

    // Stale response resolution test
    let resolveQuery: (res: any) => void = () => {};
    const pendingQuery = new Promise((resolve) => {
      resolveQuery = resolve;
    });

    const mockSupabaseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col: string, val: string) => {
        if (col === 'status') {
          return pendingQuery;
        }
        return mockSupabaseQuery;
      }),
    };
    (component as any).supabase = {
      from: vi.fn().mockReturnValue(mockSupabaseQuery),
    };

    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://test.supabase.co');
    localStorage.setItem('CATAMARCA_SUPABASE_ANON_KEY', 'valid_key_test');

    // Start remote payment lookup for Patricio Diaz and socio@experiencias.club
    const lookupPromise = (component as any).checkRemotePayments(sampleProvider, 'socio@experiencias.club');

    // Now, before response arrives, provider changes to a different provider!
    const anotherProvider: ProviderUser = {
      id: 'prov-another-uuid',
      name: 'Otro Prestador',
      email: 'otro@prestador.com',
      slug: 'otro-prestador',
    } as ProviderUser;
    component.provider.set(anotherProvider);

    // The remote query finally resolves with paid record for sampleProvider
    resolveQuery({
      data: [{
        id: 'pay-1',
        experience_id: 'exp-patricio-1',
        provider_email: sampleProvider.email,
        status: 'aprobado',
      }],
      error: null,
    });
    await lookupPromise;

    // Because current provider changed, the stale response must NOT set hasRemotePaidRecord to true!
    expect((component as any).hasRemotePaidRecord()).toBe(false);
  });

  it('should accept rating eligibility when can_socio_rate_provider RPC confirms can_vote', async () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';
    const providerWithUuid: ProviderUser = {
      ...sampleProvider,
      id: validUuid,
    };
    component.provider.set(providerWithUuid);

    (component as any).supabase = {
      from: vi.fn(),
      rpc: vi.fn().mockImplementation((fn: string) => {
        if (fn === 'can_socio_rate_provider') {
          return Promise.resolve({
            data: { can_vote: true, has_voted: false, reason: 'Habilitado' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    await (component as any).checkRemotePayments(providerWithUuid, 'socio@experiencias.club');
    expect((component as any).hasRemotePaidRecord()).toBe(true);
    expect(component.canRateProvider()).toBe(true);
  });

  it('should reflect eligibility when payment is linked via socio_id in fallback query', async () => {
    const socioUuid = '99998888-7777-6666-5555-444433332222';
    mockNewsletter.currentMember.set({
      id: socioUuid,
      email: 'socio@experiencias.club',
      name: 'Socio Test',
    } as any);

    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({
        data: [{
          id: 'pay-socio-link',
          experience_id: 'exp-patricio-1',
          provider_email: sampleProvider.email,
          socio_id: socioUuid,
          email: 'otro-email-de-compra@gmail.com',
          status: 'aprobado',
        }],
        error: null,
      }),
    };

    (component as any).supabase = {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
    };

    mockExperiences.set([
      {
        id: 'exp-patricio-1',
        title: 'Travesía Valle',
        providerEmail: sampleProvider.email,
      } as Experience,
    ]);

    await (component as any).checkRemotePayments(sampleProvider, 'socio@experiencias.club');
    expect((component as any).hasRemotePaidRecord()).toBe(true);
    expect(component.canRateProvider()).toBe(true);
  });

  it('should render role="status" and aria-live="polite" for confirmations, and role="alert" for errors in rating toast', () => {
    // 1. Success confirmation message
    const ratingService = (component as any).ratingService;
    ratingService.ratingToast.set('¡Calificaste a Kayak Catamarca con 5 estrellas!');
    fixture.detectChanges();

    let toastEl = fixture.nativeElement.querySelector('.rating-feedback-toast');
    expect(toastEl).not.toBeNull();
    expect(toastEl.getAttribute('role')).toBe('status');
    expect(toastEl.getAttribute('aria-live')).toBe('polite');
    expect(toastEl.textContent).toContain('¡Calificaste a Kayak Catamarca con 5 estrellas!');

    // 2. Error message
    ratingService.ratingToast.set('No se pudo registrar la calificación.');
    fixture.detectChanges();

    toastEl = fixture.nativeElement.querySelector('.rating-feedback-toast');
    expect(toastEl).not.toBeNull();
    expect(toastEl.getAttribute('role')).toBe('alert');
    expect(toastEl.getAttribute('aria-live')).toBe('polite');
    expect(toastEl.textContent).toContain('No se pudo registrar la calificación.');
  });

  it('should render star buttons with role="radio", proper aria-checked state and singular/plural aria-label', () => {
    // Enable rating
    (component as any).hasRemotePaidRecord.set(true);

    // Mock existing user vote of 4 stars
    const ratingService = (component as any).ratingService;
    vi.spyOn(ratingService, 'getRating').mockReturnValue({
      score: 4.5,
      count: 10,
      userVote: 4,
    });

    fixture.detectChanges();

    const starBtns = fixture.nativeElement.querySelectorAll('.star-vote-btn');
    expect(starBtns.length).toBe(5);

    // Star 1: singular '1 estrella'
    expect(starBtns[0].getAttribute('role')).toBe('radio');
    expect(starBtns[0].getAttribute('aria-label')).toBe('Calificar con 1 estrella');
    expect(starBtns[0].getAttribute('aria-checked')).toBe('false');

    // Star 4: plural '4 estrellas' and aria-checked="true"
    expect(starBtns[3].getAttribute('role')).toBe('radio');
    expect(starBtns[3].getAttribute('aria-label')).toBe('Calificar con 4 estrellas');
    expect(starBtns[3].getAttribute('aria-checked')).toBe('true');

    // Star 5: plural '5 estrellas' and aria-checked="false"
    expect(starBtns[4].getAttribute('role')).toBe('radio');
    expect(starBtns[4].getAttribute('aria-label')).toBe('Calificar con 5 estrellas');
    expect(starBtns[4].getAttribute('aria-checked')).toBe('false');
  });
});

