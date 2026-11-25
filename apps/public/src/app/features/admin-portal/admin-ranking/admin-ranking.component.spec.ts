import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AdminRankingComponent } from './admin-ranking.component';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderRatingService } from '../../../core/services/provider-rating.service';
import { FavoritesService } from '../../../core/services/favorites.service';

describe('AdminRankingComponent', () => {
  let component: AdminRankingComponent;
  let fixture: ComponentFixture<AdminRankingComponent>;
  const allProvidersSignal = signal<any[]>([]);
  const applicationsSignal = signal<any[]>([]);
  const experiencesSignal = signal<any[]>([]);

  beforeEach(async () => {
    allProvidersSignal.set([]);
    applicationsSignal.set([]);
    experiencesSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [AdminRankingComponent],
      providers: [
        provideRouter([]),
        {
          provide: AdminStoreService,
          useValue: {
            members: signal([]),
            loadAllMembers: vi.fn().mockResolvedValue(undefined),
            providerStore: {
              allProviders: allProvidersSignal,
            },
            applications: applicationsSignal,
          },
        },
        {
          provide: ExperienceService,
          useValue: {
            experiences: experiencesSignal,
            getExperienceBySlug: (s: string) => experiencesSignal().find((e) => e.slug === s || e.id === s),
            getExperienceById: (id: string) => experiencesSignal().find((e) => e.id === id),
          },
        },
        {
          provide: ProviderRatingService,
          useValue: {
            getRating: () => ({ score: 4.8, count: 12 }),
          },
        },
        {
          provide: FavoritesService,
          useValue: {
            favoriteSlugs: signal([]),
            getFavoritesCount: () => 5,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRankingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display VERIFICADO for verified providers and APROBADO for approved unverified providers', () => {
    allProvidersSignal.set([
      {
        id: 'prov-verified-1',
        name: 'Prestador Verificado',
        agency: 'Agencia 1',
        slug: 'prestador-verificado',
        status: 'aprobado',
        verified: true,
      },
      {
        id: 'prov-unverified-2',
        name: 'Prestador Solo Aprobado',
        agency: 'Agencia 2',
        slug: 'prestador-solo-aprobado',
        status: 'aprobado',
        verified: false,
      },
    ]);
    fixture.detectChanges();

    const rows = component.providerRanking();
    expect(rows.length).toBe(2);

    const verifiedPill = fixture.nativeElement.querySelector('.verified-pill');
    expect(verifiedPill).toBeTruthy();
    expect(verifiedPill.textContent.trim()).toBe('VERIFICADO');

    const approvedPill = fixture.nativeElement.querySelector('.approved-pill');
    expect(approvedPill).toBeTruthy();
    expect(approvedPill.textContent.trim()).toBe('APROBADO');
  });

  it('should exclude applications belonging to providers with dado_de_baja status', () => {
    allProvidersSignal.set([
      {
        id: 'prov-baja-1',
        name: 'Prestador Baja',
        email: 'baja@club.com',
        slug: 'prestador-baja',
        status: 'dado_de_baja',
        verified: false,
      },
    ]);
    applicationsSignal.set([
      {
        id: 'app-baja-1',
        type: 'prestador',
        fullName: 'Prestador Baja',
        email: 'baja@club.com',
        slug: 'prestador-baja',
        status: 'aprobado',
      },
      {
        id: 'app-active-2',
        type: 'prestador',
        fullName: 'Prestador Nuevo Activo',
        email: 'nuevo@club.com',
        slug: 'prestador-nuevo',
        status: 'aprobado',
      },
    ]);
    fixture.detectChanges();

    const rows = component.providerRanking();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Prestador Nuevo Activo');
  });

  it('should exclude applications that have dado_de_baja status directly', () => {
    applicationsSignal.set([
      {
        id: 'app-direct-baja',
        type: 'prestador',
        fullName: 'Solicitud Baja',
        email: 'solicitud-baja@club.com',
        status: 'dado_de_baja',
      },
    ]);
    fixture.detectChanges();

    const rows = component.providerRanking();
    expect(rows.length).toBe(0);
  });

  it('should not fallback to application id for slug and show IR AL PERFIL PÚBLICO only when slug is present', () => {
    applicationsSignal.set([
      {
        id: 'app-no-slug-123',
        type: 'prestador',
        fullName: 'Prestador Sin Slug',
        email: 'noslug@club.com',
        status: 'aprobado',
      },
      {
        id: 'app-with-slug-456',
        type: 'prestador',
        fullName: 'Prestador Con Slug',
        email: 'withslug@club.com',
        slug: 'prestador-con-slug',
        status: 'aprobado',
      },
    ]);
    fixture.detectChanges();

    const rows = component.providerRanking();
    expect(rows.length).toBe(2);

    const rowNoSlug = rows.find((r) => r.name === 'Prestador Sin Slug');
    expect(rowNoSlug?.slug).toBe('');

    const rowWithSlug = rows.find((r) => r.name === 'Prestador Con Slug');
    expect(rowWithSlug?.slug).toBe('prestador-con-slug');

    const webLinks = fixture.nativeElement.querySelectorAll('.dash-table tbody tr .btn-web-link');
    expect(webLinks.length).toBe(1);
    expect(webLinks[0].getAttribute('href')).toContain('prestador-con-slug');
    expect(fixture.nativeElement.textContent).not.toContain('app-no-slug-123');

    const ficheLinks = fixture.nativeElement.querySelectorAll('.dash-table tbody tr .btn-fiche-action');
    expect(ficheLinks.length).toBe(2);
  });

  it('should exclude generic registration survey keys (e.g. kayak, astroturismo) from inflating experience favorites', () => {
    experiencesSignal.set([
      {
        id: 'exp-kayak',
        slug: 'kayak',
        title: 'Travesía Kayak',
        status: 'publicada',
        favoritesCount: 0,
      },
      {
        id: 'exp-trekking',
        slug: 'trekking-valle',
        title: 'Trekking Valle',
        status: 'publicada',
        favoritesCount: 0,
      },
    ]);

    const membersSignal = (component as any).adminStore.members;
    membersSignal.set([
      {
        id: 'socio-1',
        membershipTier: 'activo',
        type: 'socio',
        experiencesWishlist: ['kayak', 'astroturismo', 'trekking-valle'],
      },
      {
        id: 'waitlist-1',
        membershipTier: 'waitlist',
        type: 'waitlist',
        experiencesWishlist: ['kayak'],
      },
    ]);
    fixture.detectChanges();

    const ranking = component.experienceRanking();
    const kayakRow = ranking.find((r) => r.slug === 'kayak');
    const trekkingRow = ranking.find((r) => r.slug === 'trekking-valle');

    expect(kayakRow?.favoritesCount).toBe(0);
    expect(trekkingRow?.favoritesCount).toBe(1);
  });

  it('should not allow unfiltered exp.favoritesCount to inflate ranking count over eligible members count', () => {
    experiencesSignal.set([
      {
        id: 'exp-inflated',
        slug: 'exp-inflated',
        title: 'Experiencia Inflada',
        status: 'publicada',
        favoritesCount: 25, // Unfiltered stored count (e.g. from waitlist or deleted members)
      },
      {
        id: 'exp-real',
        slug: 'exp-real',
        title: 'Experiencia Real',
        status: 'publicada',
        favoritesCount: 0,
      },
    ]);

    const membersSignal = (component as any).adminStore.members;
    membersSignal.set([
      // Only 2 eligible members have exp-inflated
      {
        id: 'socio-1',
        membershipTier: 'activo',
        type: 'socio',
        experiencesWishlist: ['exp-inflated'],
      },
      {
        id: 'socio-2',
        membershipTier: 'activo',
        type: 'socio',
        experiencesWishlist: ['exp-inflated'],
      },
      // 3 eligible members have exp-real
      {
        id: 'socio-3',
        membershipTier: 'activo',
        type: 'socio',
        experiencesWishlist: ['exp-real'],
      },
      {
        id: 'socio-4',
        membershipTier: 'activo',
        type: 'socio',
        experiencesWishlist: ['exp-real'],
      },
      {
        id: 'socio-5',
        membershipTier: 'activo',
        type: 'socio',
        experiencesWishlist: ['exp-real'],
      },
      // Ineligible waitlist members
      {
        id: 'waitlist-1',
        membershipTier: 'waitlist',
        type: 'waitlist',
        experiencesWishlist: ['exp-inflated'],
      },
      // Ineligible dado_de_baja members
      {
        id: 'baja-1',
        membershipTier: 'dado_de_baja',
        type: 'socio',
        experiencesWishlist: ['exp-inflated'],
      },
    ]);
    fixture.detectChanges();

    const ranking = component.experienceRanking();
    const inflatedRow = ranking.find((r) => r.slug === 'exp-inflated');
    const realRow = ranking.find((r) => r.slug === 'exp-real');

    // exp-inflated must have 2 (not 25)
    expect(inflatedRow?.favoritesCount).toBe(2);
    // exp-real must have 3
    expect(realRow?.favoritesCount).toBe(3);

    // exp-real (3) must rank above exp-inflated (2)
    expect(ranking[0].slug).toBe('exp-real');
    expect(ranking[1].slug).toBe('exp-inflated');

    // totalFavoritesCount must be 5 (3 + 2), not 28 (25 + 3)
    expect(component.totalFavoritesCount()).toBe(5);
  });

  describe('getProviderFicheRoute and provider votes modal', () => {
    it('should generate correct provider fiche route using slug or fallback to name/id', () => {
      const withSlug = { slug: 'experiencias-extremas', name: 'Pablo Vegvarel' };
      expect(component.getProviderFicheRoute(withSlug)).toContain('/prestadores/experiencias-extremas');

      const withoutSlug = { slug: '', name: 'Pablo Vegvarel', agency: 'Experiencias Extremas' };
      expect(component.getProviderFicheRoute(withoutSlug)).toContain('/prestadores/experiencias-extremas');

      const appOrigin = { slug: '', provider: { id: 'app-pablo-123', origin: 'application', name: 'Pablo' } as any };
      expect(component.getProviderFicheRoute(appOrigin)).toContain('/prestadores/app-pablo-123');
    });

    it('should open and close provider votes modal and load ratings', async () => {
      const mockMembers = (component as any).adminStore.members;
      mockMembers.set([
        {
          email: 'socio@club.com',
          fullName: 'Socio Calificador',
          membershipTier: 'fundador',
          position: 1,
          avatarUrl: 'https://avatar.com/socio.jpg',
        },
      ]);

      const mockRatingService = (component as any).ratingService;
      mockRatingService.getProviderVotes = vi.fn().mockResolvedValue({
        votes: [
          {
            socioEmail: 'socio@club.com',
            score: 5,
            comment: 'Excelente servicio y guía!',
            createdAt: '2026-11-20T10:00:00Z',
          },
        ],
        status: 'complete',
      });

      const testProv = {
        id: 'prov-pablo',
        name: 'Pablo Vegvarel',
        agency: 'Experiencias Extremas',
        email: 'pablo@extremas.com',
        slug: 'pablo-vegvarel',
      } as any;

      expect(component.selectedRankingProviderForVotes()).toBeNull();

      await component.openProviderVotesModal(testProv);

      expect(component.selectedRankingProviderForVotes()).toBe(testProv);
      expect(component.rankingProviderVotes().length).toBe(1);
      expect(component.rankingProviderVotes()[0].socioName).toBe('Socio Calificador');
      expect(component.rankingProviderVotes()[0].score).toBe(5);
      expect(component.rankingProviderVotes()[0].comment).toBe('Excelente servicio y guía!');

      component.closeProviderVotesModal();

      expect(component.selectedRankingProviderForVotes()).toBeNull();
      expect(component.rankingProviderVotes()).toEqual([]);
      expect(component.isLoadingRankingVotes()).toBe(false);
    });

    it('should invalidate pending requests and clear loading state when closing modal', async () => {
      let resolvePromise: (val: any) => void;
      const deferred = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const mockRatingService = (component as any).ratingService;
      mockRatingService.getProviderVotes = vi.fn().mockReturnValue(deferred);

      const testProv = {
        id: 'prov-pending',
        name: 'Guia Pendiente',
      } as any;

      const openPromise = component.openProviderVotesModal(testProv);
      expect(component.isLoadingRankingVotes()).toBe(true);

      // Close modal before promise resolves
      component.closeProviderVotesModal();
      expect(component.isLoadingRankingVotes()).toBe(false);
      expect(component.selectedRankingProviderForVotes()).toBeNull();

      // Resolve the pending network call
      resolvePromise!({
        votes: [
          {
            socioEmail: 'socio@club.com',
            score: 4,
            comment: 'Llegó tarde',
          },
        ],
      });
      await openPromise;

      // Ensure state was not modified by the cancelled/invalidated request
      expect(component.rankingProviderVotes()).toEqual([]);
      expect(component.isLoadingRankingVotes()).toBe(false);
      expect(component.rankingVotesError()).toBeNull();
    });

    it('should guard state updates so an older slower request does not overwrite the current request', async () => {
      const mockMembers = (component as any).adminStore.members;
      mockMembers.set([
        {
          email: 'socio1@club.com',
          fullName: 'Socio Uno',
        },
        {
          email: 'socio2@club.com',
          fullName: 'Socio Dos',
        },
      ]);

      let resolveFirst: (val: any) => void;
      const firstDeferred = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const mockRatingService = (component as any).ratingService;
      mockRatingService.getProviderVotes = vi.fn()
        .mockReturnValueOnce(firstDeferred)
        .mockResolvedValueOnce({
          votes: [
            {
              socioEmail: 'socio2@club.com',
              score: 5,
              comment: 'Voto del segundo prestador',
            },
          ],
        });

      const prov1 = { id: 'prov-1', name: 'Prestador 1' } as any;
      const prov2 = { id: 'prov-2', name: 'Prestador 2' } as any;

      // Start first request
      const firstPromise = component.openProviderVotesModal(prov1);
      // Immediately switch to second provider
      const secondPromise = component.openProviderVotesModal(prov2);

      await secondPromise;
      expect(component.rankingProviderVotes().length).toBe(1);
      expect(component.rankingProviderVotes()[0].comment).toBe('Voto del segundo prestador');

      // Now resolve the older first request
      resolveFirst!({
        votes: [
          {
            socioEmail: 'socio1@club.com',
            score: 1,
            comment: 'Voto obsoleto del primer prestador',
          },
        ],
      });
      await firstPromise;

      // Ensure the second provider's data was NOT overwritten by the first request
      expect(component.rankingProviderVotes().length).toBe(1);
      expect(component.rankingProviderVotes()[0].comment).toBe('Voto del segundo prestador');
    });

    it('should display the score from ratingService.getRating(prov) in the modal header', async () => {
      const mockRatingService = (component as any).ratingService;
      mockRatingService.getProviderVotes = vi.fn().mockResolvedValue({ votes: [] });
      mockRatingService.getRating = vi.fn().mockReturnValue({ score: 4.8, count: 12 });

      const testProv = {
        id: 'prov-test',
        name: 'Guia Test',
        ratingScore: 2.1, // prov has old/different score
      } as any;

      component.openProviderVotesModal(testProv);
      fixture.detectChanges();

      const modalScore = fixture.nativeElement.querySelector('.stats-score-num');
      expect(modalScore).toBeTruthy();
      expect(modalScore.textContent.trim()).toBe('4.8');
      expect(mockRatingService.getRating).toHaveBeenCalledWith(testProv);
    });

    it('should route unavailable getProviderVotes results into rankingVotesError instead of showing empty results', async () => {
      const mockRatingService = (component as any).ratingService;
      mockRatingService.getProviderVotes = vi.fn().mockResolvedValue({
        votes: [],
        status: 'unavailable',
        error: 'Servidor no disponible',
      });

      const testProv = { id: 'prov-err', name: 'Prestador Error' } as any;
      await component.openProviderVotesModal(testProv);
      fixture.detectChanges();

      expect(component.rankingVotesError()).toBe('Servidor no disponible');
      expect(component.rankingProviderVotes()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.modal-error-box')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.modal-empty-box')).toBeNull();
    });

    it('should display warning banner and preserve local votes when getProviderVotes returns partial results', async () => {
      const mockRatingService = (component as any).ratingService;
      mockRatingService.getProviderVotes = vi.fn().mockResolvedValue({
        votes: [
          {
            socioEmail: 'socio.local@club.com',
            score: 5,
            comment: 'Voto guardado en almacenamiento local',
          },
        ],
        status: 'partial',
        error: 'No se pudo sincronizar con el servidor; mostrando votos locales.',
      });

      const testProv = { id: 'prov-part', name: 'Prestador Parcial' } as any;
      await component.openProviderVotesModal(testProv);
      fixture.detectChanges();

      expect(component.rankingVotesError()).toBeNull();
      expect(component.rankingVotesPartialWarning()).toBe('No se pudo sincronizar con el servidor; mostrando votos locales.');
      expect(component.rankingProviderVotes().length).toBe(1);
      expect(fixture.nativeElement.querySelector('.modal-warning-box')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.modal-warning-box').textContent).toContain('mostrando votos locales');
      expect(fixture.nativeElement.querySelector('.modal-table-wrap')).toBeTruthy();
    });
  });
});

