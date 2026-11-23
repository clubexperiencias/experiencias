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

    const links = fixture.nativeElement.querySelectorAll('.dash-table tbody tr .btn-action-outline');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href') || links[0].getAttribute('ng-reflect-router-link')).toContain('prestador-con-slug');
    expect(fixture.nativeElement.textContent).not.toContain('app-no-slug-123');
  });
});

